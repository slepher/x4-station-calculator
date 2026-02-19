import type { SavedModule, X4Module } from '../../types/x4'

export interface WarePriorityContext {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  modulesMap: Record<string, X4Module>
  userPriorityOverride: Record<string, number>
}

export function buildResolvedWarePriority(
  context: WarePriorityContext,
  allWareIds: string[]
): Record<string, number> {
  const { plannedModules, autoIndustryModules, modulesMap, userPriorityOverride } = context

  const plannedWareSet = new Set<string>()
  plannedModules.forEach(m => {
    const info = modulesMap[m.id]
    if (info?.outputs) {
      Object.keys(info.outputs).forEach(w => plannedWareSet.add(w))
    }
  })

  const autoWareSet = new Set<string>()
  autoIndustryModules.forEach(m => {
    const info = modulesMap[m.id]
    if (info?.outputs) {
      Object.keys(info.outputs).forEach(w => autoWareSet.add(w))
    }
  })

  const isPlannedWare = (wareId: string) => plannedWareSet.has(wareId)
  const isAutoWare = (wareId: string) => autoWareSet.has(wareId) && !plannedWareSet.has(wareId)

  const getResolvedLevel = (wareId: string): number => {
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)
    const override = userPriorityOverride[wareId]

    if (planned && override === 0) return 1
    if (auto && override === 2) return 1

    if (override !== undefined) return override

    if (planned) return 2
    if (auto) return 0
    return 0
  }

  const result: Record<string, number> = {}
  allWareIds.forEach(wareId => {
    result[wareId] = getResolvedLevel(wareId)
  })

  return result
}
