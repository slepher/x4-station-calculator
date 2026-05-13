import { computeExpandUpstream, type ExpandContext, type GroupSnapshot } from './logicFlowStream'
import type {
  FlowNode,
  ProductionLineGroup,
  SavedFlowGroup,
  X4Module,
  X4Ware,
} from '@/types/x4'

export interface HydrateSavedFlowGroupsDeps {
  waresMap: Record<string, X4Ware>
  modulesMap: Record<string, X4Module>
  modulesByOutputMap?: Record<string, X4Module[]>
  findModuleForWare: (wareId: string, lineage: string) => X4Module | null
}

function insertNodeSorted(group: ProductionLineGroup, node: FlowNode) {
  const targetTier = node.column
  let insertIndex = 0
  for (let i = group.nodes.length - 1; i >= 0; i--) {
    const existing = group.nodes[i]
    if (existing && existing.column >= targetTier) {
      insertIndex = i + 1
      break
    }
  }
  group.nodes.splice(insertIndex, 0, node)
}

function resolveModuleOutputWareId(
  moduleId: string,
  modulesMap: Record<string, X4Module>,
): string | null {
  const module = modulesMap[moduleId]
  if (!module?.outputs) return null
  const outputWares = Object.keys(module.outputs)
  return outputWares.length > 0 ? outputWares[0]! : null
}

function expandUpstreamForHydration(
  groups: ProductionLineGroup[],
  groupId: string,
  wareId: string,
  source: 'manual' | 'auto',
  deps: HydrateSavedFlowGroupsDeps,
  overrideLineage?: string,
) {
  const group = groups.find(g => g.id === groupId)
  if (!group) return

  const ctx: ExpandContext = {
    waresMap: deps.waresMap,
    modulesMap: deps.modulesMap,
    modulesByOutputMap: deps.modulesByOutputMap || {},
    findModuleForWare: deps.findModuleForWare,
  }

  const groupSnapshot: GroupSnapshot = {
    id: group.id,
    nodes: group.nodes,
    isLocked: group.isLocked,
    lockedLineage: group.lockedLineage,
    subCategory: group.subCategory,
  }

  const result = computeExpandUpstream(ctx, groupSnapshot, wareId, source, overrideLineage)

  result.newNodes.forEach(node => {
    insertNodeSorted(group, node)
  })

  result.updatedNodes.forEach(update => {
    const node = group.nodes.find(n => n.id === update.nodeId)
    if (node) Object.assign(node, update.updates)
  })
}

export function hydrateSavedFlowGroups(
  savedGroups: SavedFlowGroup[],
  deps: HydrateSavedFlowGroupsDeps,
): ProductionLineGroup[] {
  const groups: ProductionLineGroup[] = []

  for (const savedGroup of savedGroups) {
    const newGroup: ProductionLineGroup = {
      id: savedGroup.id,
      name: savedGroup.name,
      category: savedGroup.category,
      subCategory: savedGroup.subCategory,
      isLocked: savedGroup.isLocked,
      lockedLineage: savedGroup.lockedLineage,
      nodes: [],
    }
    groups.push(newGroup)

    const orderByColumn = new Map<number, number>()
    const nextOrder = (column: number) => {
      const current = orderByColumn.get(column) || 0
      orderByColumn.set(column, current + 1)
      return current
    }

    for (const savedNode of savedGroup.nodes) {
      if (!savedNode.isolated) continue
      const ware = deps.waresMap[savedNode.isolated]
      if (!ware) continue
      const lineage = newGroup.isLocked ? (newGroup.lockedLineage || 'default') : (newGroup.subCategory || 'default')
      const isolatedNode: FlowNode = {
        id: crypto.randomUUID(),
        wareId: savedNode.isolated,
        race: lineage,
        lineage,
        column: ware.tier,
        isIsolated: true,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: nextOrder(ware.tier),
        isPreview: false,
      }
      insertNodeSorted(newGroup, isolatedNode)
    }

    for (const savedNode of savedGroup.nodes) {
      if (!savedNode.module) continue
      const module = deps.modulesMap[savedNode.module]
      if (!module) continue
      const wareId = resolveModuleOutputWareId(savedNode.module, deps.modulesMap)
      if (!wareId) continue
      const ware = deps.waresMap[wareId]
      if (!ware) continue

      const lineage = newGroup.isLocked
        ? (newGroup.lockedLineage || 'default')
        : (module.race || module.method || newGroup.subCategory || 'default')

      const existingNode = newGroup.nodes.find(n => n.moduleId === savedNode.module)
      if (existingNode) {
        if (existingNode.source === 'auto') {
          existingNode.source = 'manual'
          existingNode.isAuto = false
          existingNode.isRoot = true
          if (module.inputs) {
            Object.keys(module.inputs).forEach(inputWareId => {
              expandUpstreamForHydration(groups, newGroup.id, inputWareId, 'auto', deps, existingNode.lineage)
            })
          }
        }
        continue
      }

      const manualNode: FlowNode = {
        id: crypto.randomUUID(),
        wareId,
        moduleId: savedNode.module,
        race: module.race || lineage,
        lineage,
        column: ware.tier,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: nextOrder(ware.tier),
        isPreview: false,
      }
      insertNodeSorted(newGroup, manualNode)

      if (module.inputs) {
        Object.keys(module.inputs).forEach(inputWareId => {
          expandUpstreamForHydration(groups, newGroup.id, inputWareId, 'auto', deps, manualNode.lineage)
        })
      }
    }
  }

  return groups
}
