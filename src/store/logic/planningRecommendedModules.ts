import type { SavedModule, X4Module } from '@/types/x4'

export interface RecommendedPlanningSubset {
  recommendedModuleIds: Set<string>
  recommendedGapModules: SavedModule[]
  recommendedDisplayModules: SavedModule[]
  effectivePlannedModules: SavedModule[]
}

export function buildEffectivePlannedModules(
  plannedModules: SavedModule[],
  recommendedModules: SavedModule[]
): SavedModule[] {
  return maxSavedModules(plannedModules, recommendedModules)
}

export function mergeSavedModules(modules: SavedModule[]): SavedModule[] {
  const counts = new Map<string, number>()
  const order: string[] = []

  for (const module of modules) {
    if (!counts.has(module.id)) order.push(module.id)
    counts.set(module.id, (counts.get(module.id) || 0) + module.count)
  }

  return order
    .map((id) => ({ id, count: counts.get(id) || 0 }))
    .filter((module) => module.count > 0)
}

export function maxSavedModules(preferred: SavedModule[], fallback: SavedModule[]): SavedModule[] {
  const preferredMerged = mergeSavedModules(preferred)
  const fallbackMerged = mergeSavedModules(fallback)
  const preferredCounts = new Map(preferredMerged.map((module) => [module.id, module.count]))
  const fallbackCounts = new Map(fallbackMerged.map((module) => [module.id, module.count]))
  const order = [
    ...preferredMerged.map((module) => module.id),
    ...fallbackMerged.map((module) => module.id).filter((id) => !preferredCounts.has(id))
  ]

  return order
    .map((id) => ({
      id,
      count: Math.max(preferredCounts.get(id) || 0, fallbackCounts.get(id) || 0)
    }))
    .filter((module) => module.count > 0)
}

export function computeOrphanReferenceModuleIds(
  referenceModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): Set<string> {
  const mergedReferenceModules = mergeSavedModules(referenceModules)
  if (mergedReferenceModules.length === 0) return new Set()

  const referenceDefinitions = mergedReferenceModules
    .map((module) => modulesMap[module.id])
    .filter((module): module is X4Module => Boolean(module))

  const orphanIds = new Set<string>()
  referenceDefinitions.forEach((module) => {
    const outputWareIds = Object.keys(module.outputs || {})
    if (outputWareIds.length === 0) return

    const isOrphan = outputWareIds.some((wareId) => {
      return !referenceDefinitions.some((otherModule) => {
        if (otherModule.id === module.id) return false
        return (otherModule.inputs?.[wareId] || 0) > 0
      })
    })

    if (isOrphan) {
      orphanIds.add(module.id)
    }
  })

  return orphanIds
}

export function computeRecommendedPlanningSubset(
  plannedModules: SavedModule[],
  referenceModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): RecommendedPlanningSubset {
  const mergedReferenceModules = mergeSavedModules(referenceModules)
  const orphanIds = computeOrphanReferenceModuleIds(mergedReferenceModules, modulesMap)
  const plannedCountMap = new Map(mergeSavedModules(plannedModules).map((module) => [module.id, module.count]))

  const recommendedGapModules: SavedModule[] = []
  const recommendedDisplayModules: SavedModule[] = []

  mergedReferenceModules.forEach((module) => {
    if (!orphanIds.has(module.id)) return
    const plannedCount = plannedCountMap.get(module.id) || 0
    if (plannedCount >= module.count) return

    recommendedGapModules.push({
      id: module.id,
      count: module.count - plannedCount
    })
    if (plannedCount === 0) {
      recommendedDisplayModules.push({
        id: module.id,
        count: module.count
      })
    }
  })

  return {
    recommendedModuleIds: new Set(recommendedDisplayModules.map((module) => module.id)),
    recommendedGapModules,
    recommendedDisplayModules,
    effectivePlannedModules: maxSavedModules(plannedModules, recommendedDisplayModules)
  }
}

export function getReferenceProductionFloorModules(
  referenceModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): SavedModule[] {
  return mergeSavedModules(
    referenceModules.filter((module) => {
      const info = modulesMap[module.id]
      return Boolean(info && info.type === 'production' && info.method !== 'recycling')
    })
  )
}
