import type { FlowNode, ProductionLineGroup, SavedFlowGroup, SavedFlowNode } from '@/types/x4'

type GroupNode = FlowNode | SavedFlowNode
type GroupLike = ProductionLineGroup | SavedFlowGroup

function isManualNode(node: GroupNode): boolean {
  return node.source !== 'auto'
}

function pickTopManualNode(nodes: GroupNode[]): GroupNode | null {
  const manualNodes = nodes.filter(isManualNode)
  if (manualNodes.length === 0) return null

  const maxTier = Math.max(...manualNodes.map((node) => node.column))
  const highestTierNodes = manualNodes
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
  return getWareDisplayName(topNode.wareId)
}

export function getLogicFlowGroupTopManualNode(group: GroupLike): GroupNode | null {
  return pickTopManualNode(group.nodes)
}
