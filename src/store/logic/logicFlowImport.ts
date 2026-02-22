import type { SavedFlowGroup, SavedFlowNode, SavedModule, X4Ware } from '@/types/x4'
import { getLogicFlowGroupDisplayName } from './logicFlowGroupName'

export type LogicFlowImportWarningType = 'empty_group_skipped' | 'isolated_non_container_ignored'

export interface LogicFlowImportWarning {
  type: LogicFlowImportWarningType
  groupId: string
  groupName: string
  wareId?: string
  wareName?: string
}

export interface StationImportPayload {
  groupId: string
  groupName: string
  plannedModules: SavedModule[]
  lockedWares: string[]
  warnings: LogicFlowImportWarning[]
  manualModuleCount: number
}

function isImportableManualNode(node: SavedFlowNode): boolean {
  return node.source === 'manual' && Boolean(node.moduleId)
}

export function buildStationImportPayload(
  group: SavedFlowGroup,
  waresMap: Record<string, X4Ware>,
  getWareDisplayName: (wareId: string) => string
): StationImportPayload {
  const groupName = getLogicFlowGroupDisplayName(group, getWareDisplayName)
  const moduleCounts = new Map<string, number>()
  const lockedWareSet = new Set<string>()
  const warnings: LogicFlowImportWarning[] = []

  group.nodes.forEach((node) => {
    if (isImportableManualNode(node)) {
      const moduleId = node.moduleId!
      moduleCounts.set(moduleId, (moduleCounts.get(moduleId) || 0) + 1)
    }

    if (!node.isIsolated) return
    const ware = waresMap[node.wareId]
    if (ware?.transport === 'container') {
      lockedWareSet.add(node.wareId)
      return
    }

    warnings.push({
      type: 'isolated_non_container_ignored',
      groupId: group.id,
      groupName,
      wareId: node.wareId,
      wareName: getWareDisplayName(node.wareId)
    })
  })

  return {
    groupId: group.id,
    groupName,
    plannedModules: Array.from(moduleCounts.entries()).map(([id, count]) => ({ id, count })),
    lockedWares: Array.from(lockedWareSet),
    warnings,
    manualModuleCount: Array.from(moduleCounts.values()).reduce((sum, count) => sum + count, 0)
  }
}

export interface EmpireImportPlanResult {
  targets: StationImportPayload[]
  warnings: LogicFlowImportWarning[]
}

export function buildEmpireImportTargets(
  groups: SavedFlowGroup[],
  waresMap: Record<string, X4Ware>,
  getWareDisplayName: (wareId: string) => string
): EmpireImportPlanResult {
  const targets: StationImportPayload[] = []
  const warnings: LogicFlowImportWarning[] = []

  groups.forEach((group) => {
    const payload = buildStationImportPayload(group, waresMap, getWareDisplayName)
    warnings.push(...payload.warnings)

    if (payload.manualModuleCount === 0) {
      warnings.push({
        type: 'empty_group_skipped',
        groupId: payload.groupId,
        groupName: payload.groupName
      })
      return
    }

    targets.push(payload)
  })

  return { targets, warnings }
}

export function hasImportableGroups(groups: SavedFlowGroup[]): boolean {
  return groups.some((group) => group.nodes.some(isImportableManualNode))
}
