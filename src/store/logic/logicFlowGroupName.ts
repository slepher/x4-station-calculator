import type { FlowNode, ProductionLineGroup, SavedFlowGroup, SavedFlowNode } from '@/types/x4'

type GroupNode = FlowNode | SavedFlowNode
type GroupLike = ProductionLineGroup | SavedFlowGroup

function isFlowNode(node: GroupNode): node is FlowNode {
  return 'wareId' in node
}

function getNodeWareId(node: GroupNode): string | null {
  if (isFlowNode(node)) return node.wareId
  return node.isolated || null
}

function isManualNode(node: GroupNode): boolean {
  if (isFlowNode(node)) {
    return node.source !== 'auto'
  }
  return true
}

function pickTopManualNode(nodes: GroupNode[]): GroupNode | null {
  const manualNodes = nodes.filter(isManualNode)
  if (manualNodes.length === 0) return null

  const flowNodes = manualNodes.filter(isFlowNode)
  if (flowNodes.length === 0) {
    const isolatedFirst = manualNodes.find((node) => !isFlowNode(node) && Boolean(node.isolated))
    return isolatedFirst || manualNodes[0] || null
  }

  const maxTier = Math.max(...flowNodes.map((node) => node.column))
  const highestTierNodes = flowNodes
    .filter((node) => node.column === maxTier)
    .sort((a, b) => {
      if (a.isIsolated && !b.isIsolated) return 1
      if (!a.isIsolated && b.isIsolated) return -1
      return a.order - b.order
    })

  return highestTierNodes[0] || null
}

export function getLogicFlowGroupDisplayName(
  group: GroupLike,
  getWareDisplayName: (wareId: string) => string,
  emptyLabel: string = '空'
): string {
  if (group.name) return group.name
  const topNode = pickTopManualNode(group.nodes)
  if (!topNode) return emptyLabel
  const wareId = getNodeWareId(topNode)
  if (!wareId) return emptyLabel
  return getWareDisplayName(wareId)
}
