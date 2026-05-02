import { Graph } from '@antv/x6'
import { register, getTeleport } from '@antv/x6-vue-shape'
import type { BuildFlowGroup, BuildFlowAssignment } from '@/types/x4'
import { computeTargetKey } from '@/store/logic/buildFlowDerivation'
import BuildFlowLineCardNode from '../BuildFlowLineCardNode.vue'
import BuildFlowOutputCardNode from '../BuildFlowOutputCardNode.vue'

register({
  shape: 'build-flow-line-card',
  width: 320,
  height: 160,
  component: BuildFlowLineCardNode,
  inherit: 'vue-shape',
})

register({
  shape: 'build-flow-output-card',
  width: 160,
  height: 160,
  component: BuildFlowOutputCardNode,
  inherit: 'vue-shape',
})

export const BuildFlowTeleport = getTeleport()

const GROUP_PAD = 20
const GROUP_GAP_X = 40
const CARD_GAP_Y = 12
const LINE_CARD_WIDTH = 320
const OUTPUT_CARD_WIDTH = 160
const LEFT_COL_WIDTH = LINE_CARD_WIDTH + CARD_GAP_Y
const RIGHT_COL_OFFSET = LEFT_COL_WIDTH + 40
const GROUP_DRAG_PADDING = 60

function resolveShapeFromInteractionArg(target: unknown): string | null {
  if (!target || typeof target !== 'object') return null
  const maybeCell = target as { getShape?: () => string; cell?: { getShape?: () => string } }
  if (typeof maybeCell.getShape === 'function') return maybeCell.getShape()
  if (maybeCell.cell && typeof maybeCell.cell.getShape === 'function') return maybeCell.cell.getShape()
  return null
}

function isEdgeInteractionArg(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const maybeCell = target as { isEdge?: () => boolean; cell?: { isEdge?: () => boolean } }
  if (typeof maybeCell.isEdge === 'function') return maybeCell.isEdge()
  if (maybeCell.cell && typeof maybeCell.cell.isEdge === 'function') return maybeCell.cell.isEdge()
  return false
}

export function useBuildFlowGraph(containerEl: HTMLElement) {
  const graph = new Graph({
    container: containerEl,
    autoResize: false,
    background: { color: 'transparent' },
    grid: false,
    panning: false,
    mousewheel: false,
    connecting: { snap: false, allowLoop: false, allowNode: false, allowEdge: false, allowPort: false, allowMulti: false, highlight: false, validateConnection: () => false },
    interacting: (cellView: unknown) => {
      if (isEdgeInteractionArg(cellView)) {
        return {
          edgeMovable: false,
          vertexAddable: false,
          vertexMovable: false,
          vertexDeletable: false,
          arrowheadMovable: false,
        }
      }
      const shape = resolveShapeFromInteractionArg(cellView)
      const movable = shape === 'build-flow-line-card' || shape === 'build-flow-output-card'
      return { nodeMovable: movable }
    },
    embedding: { enabled: false },
  })
  graph.on('node:change:position', ({ node }) => {
    const parent = node.getParent()
    if (parent) {
      resizeParentNode(graph, parent.id)
    }
  })

  function syncGraph(groups: BuildFlowGroup[], assignments: BuildFlowAssignment[]) {
    const existingNodeIds = new Set(graph.getNodes().map(n => n.id))
    const existingEdgeIds = new Set(graph.getEdges().map(e => e.id))
    const desiredNodeIds = new Set<string>()
    const desiredEdgeIds = new Set<string>()

    const containerWidth = containerEl.clientWidth || 1000
    const cols = Math.min(groups.length, 2)
    const minGroupWidth = RIGHT_COL_OFFSET + OUTPUT_CARD_WIDTH + GROUP_PAD + GROUP_DRAG_PADDING * 2
    const groupWidth = cols === 1
      ? Math.max(minGroupWidth, containerWidth)
      : Math.max(minGroupWidth, Math.floor((containerWidth - GROUP_GAP_X) / 2))

    let offsetX = 0
    let offsetY = 0

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const groupNodeId = `group:${group.groupKey}`
      desiredNodeIds.add(groupNodeId)

      if (i > 0 && i % 2 === 0) {
        offsetX = 0
        offsetY += GROUP_GAP_X
      }

      let maxCardHeight = 0
      let currentY = GROUP_PAD
      const cardLayouts = group.lineCards.map(card => {
        const h = 40 + Math.max(card.sourceTags.length, card.buildMaterialTags.length) * 28
        const y = currentY
        maxCardHeight = Math.max(maxCardHeight, currentY + h + GROUP_PAD)
        currentY += h + CARD_GAP_Y
        return { card, height: h, y }
      })

      const outputEstHeight = 40 + group.outputTags.length * 28
      maxCardHeight = Math.max(maxCardHeight, GROUP_PAD + outputEstHeight + GROUP_PAD)

      const groupHeight = maxCardHeight + GROUP_DRAG_PADDING * 2

      if (!existingNodeIds.has(groupNodeId)) {
        graph.addNode({
          id: groupNodeId,
          shape: 'rect',
          x: offsetX,
          y: offsetY,
          width: groupWidth,
          height: groupHeight,
          attrs: {
            body: {
              fill: 'rgba(55, 65, 81, 0.15)',
              stroke: '#374151',
              strokeWidth: 1,
              rx: 8,
              ry: 8,
            },
          },
          interacting: { nodeMovable: false },
          zIndex: 0,
        })
        existingNodeIds.add(groupNodeId)
      } else {
        const groupNode = graph.getCellById(groupNodeId)! as import('@antv/x6').Node
        groupNode.position(offsetX, offsetY)
        groupNode.resize(groupWidth, groupHeight)
        graph.toBack(groupNode)
      }

      const cardAreaWidth = groupWidth - GROUP_DRAG_PADDING * 2
      const lineCardX = offsetX + GROUP_PAD
      const outputCardX = offsetX + GROUP_PAD + RIGHT_COL_OFFSET

      for (const layout of cardLayouts) {
        const cardNodeId = `line-card:${layout.card.groupId}`
        desiredNodeIds.add(cardNodeId)

        const x = lineCardX
        const y = layout.y + GROUP_DRAG_PADDING + offsetY

        if (!existingNodeIds.has(cardNodeId)) {
          graph.addNode({
            id: cardNodeId,
            shape: 'build-flow-line-card',
            x,
            y,
            width: LINE_CARD_WIDTH,
            height: layout.height,
            data: { card: layout.card, groupKey: group.groupKey },
            zIndex: 10,
          })
          existingNodeIds.add(cardNodeId)
        } else {
          const cell = graph.getCellById(cardNodeId)!
          cell.setData({ card: layout.card, groupKey: group.groupKey }, { overwrite: true })
          cell.position(x, y)
          cell.resize(LINE_CARD_WIDTH, layout.height)
        }
      }

      const outputNodeId = `output-card:${group.groupKey}`
      desiredNodeIds.add(outputNodeId)
      const outX = outputCardX
      const outY = GROUP_PAD + GROUP_DRAG_PADDING + offsetY

      if (!existingNodeIds.has(outputNodeId)) {
        graph.addNode({
          id: outputNodeId,
          shape: 'build-flow-output-card',
          x: outX,
          y: outY,
          width: OUTPUT_CARD_WIDTH,
          height: outputEstHeight,
          data: { outputTags: group.outputTags, groupKey: group.groupKey },
          zIndex: 10,
        })
        existingNodeIds.add(outputNodeId)
      } else {
        const cell = graph.getCellById(outputNodeId)!
        cell.setData({ outputTags: group.outputTags, groupKey: group.groupKey }, { overwrite: true })
        cell.position(outX, outY)
        cell.resize(OUTPUT_CARD_WIDTH, outputEstHeight)
      }

      offsetX += groupWidth + GROUP_GAP_X
    }

    for (const assignment of assignments) {
      const edgeId = `edge:${assignment.sourceGroupId}:${assignment.wareId}->${computeTargetKey(assignment)}`
      desiredEdgeIds.add(edgeId)

      if (!existingEdgeIds.has(edgeId)) {
        const sourceCellId = `line-card:${assignment.sourceGroupId}`
        const targetCellId = assignment.targetType === 'line-build-material'
          ? `line-card:${assignment.targetGroupId}`
          : `output-card:${getGroupKeyForGroupId(groups, assignment.sourceGroupId)}`

        graph.addEdge({
          id: edgeId,
          source: { cell: sourceCellId, anchor: { name: 'right' }, connectionPoint: { name: 'anchor' } },
          target: { cell: targetCellId, anchor: { name: 'left' }, connectionPoint: { name: 'anchor' } },
          router: { name: 'manhattan', args: { padding: 20 } },
          connector: { name: 'rounded', args: { radius: 8 } },
          attrs: {
            line: {
              stroke: 'rgba(251, 146, 60, 0.7)',
              strokeWidth: 2,
              targetMarker: { name: 'block', width: 10, height: 8 },
            },
          },
          zIndex: 5,
          interacting: {
            edgeMovable: false,
            vertexAddable: false,
            vertexMovable: false,
            vertexDeletable: false,
            arrowheadMovable: false,
          },
        })
        existingEdgeIds.add(edgeId)
      }

      const edge = graph.getCellById(edgeId)
      if (edge && edge.isEdge()) {
        setTimeout(() => {
          const sourceEl = containerEl.querySelector(`[data-tag-id="build-flow-source:${assignment.sourceGroupId}:${assignment.wareId}"]`) as HTMLElement | null
          const targetTagId = assignment.targetType === 'line-build-material'
            ? `build-flow-target:line:${assignment.targetGroupId}:${assignment.wareId}`
            : `build-flow-target:output:${assignment.wareId}`
          const targetEl = containerEl.querySelector(`[data-tag-id="${targetTagId}"]`) as HTMLElement | null
          if (!sourceEl || !targetEl) return
          const sourceRect = sourceEl.getBoundingClientRect()
          const targetRect = targetEl.getBoundingClientRect()
          const containerRect = containerEl.getBoundingClientRect()
          edge.setSource({
            x: sourceRect.right - containerRect.left,
            y: sourceRect.top - containerRect.top + sourceRect.height / 2,
          })
          edge.setTarget({
            x: targetRect.left - containerRect.left,
            y: targetRect.top - containerRect.top + targetRect.height / 2,
          })
        }, 0)
      }
    }

    const nodesToRemove = graph.getNodes().filter(n => !desiredNodeIds.has(n.id))
    for (const node of nodesToRemove) {
      graph.removeCell(node)
    }

    const edgesToRemove = graph.getEdges().filter(e => !desiredEdgeIds.has(e.id))
    for (const edge of edgesToRemove) {
      graph.removeCell(edge)
    }

    if (graph.getNodes().length > 0) {
      const bbox = graph.getCellsBBox(graph.getNodes())
      if (bbox) {
        const padding = 10
        const width = Math.ceil(bbox.width + padding * 2)
        const height = Math.ceil(bbox.height + padding * 2)
        graph.resize(width, height)
        containerEl.style.width = `${width}px`
        containerEl.style.height = `${height}px`
      }
    }

  }

  function dispose() {
    graph.dispose()
  }

  return { graph, syncGraph, dispose }
}

function getGroupKeyForGroupId(groups: BuildFlowGroup[], groupId: string): string {
  for (const g of groups) {
    for (const card of g.lineCards) {
      if (card.groupId === groupId) return g.groupKey
    }
  }
  return ''
}

function resizeParentNode(graph: Graph, parentId: string) {
  const parent = graph.getCellById(parentId)
  if (!parent || !parent.isNode()) return
  const children = parent.getChildren()
  if (!children || children.length === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const child of children) {
    if (!child.isNode()) continue
    const pos = child.getPosition()
    const size = child.getSize()
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + size.width)
    maxY = Math.max(maxY, pos.y + size.height)
  }

  const parentPos = parent.getPosition()
  const newWidth = maxX - parentPos.x + GROUP_PAD
  const newHeight = maxY - parentPos.y + GROUP_PAD
  parent.resize(newWidth, newHeight)
}
