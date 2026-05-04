import type { ProductionLineGroup } from '@/types/x4'

export interface FindGroupProducingWareResult {
  sourceGroupId: string
}

export function findGroupProducingWare(
  wareId: string,
  groups: ProductionLineGroup[],
): FindGroupProducingWareResult | null {
  for (const group of groups) {
    for (const node of group.nodes) {
      if (node.source === 'manual' && !node.isIsolated && node.wareId === wareId) {
        return { sourceGroupId: group.id }
      }
    }
  }
  for (const group of groups) {
    for (const node of group.nodes) {
      if (node.source === 'auto' && node.wareId === wareId) {
        return { sourceGroupId: group.id }
      }
    }
  }
  return null
}

export function findGroupWithIsolatedWare(
  wareId: string,
  groups: ProductionLineGroup[],
): FindGroupProducingWareResult | null {
  for (const group of groups) {
    for (const node of group.nodes) {
      if (node.isIsolated && node.wareId === wareId) {
        return { sourceGroupId: group.id }
      }
    }
  }
  return null
}
