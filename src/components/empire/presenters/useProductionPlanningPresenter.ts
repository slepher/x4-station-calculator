import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule, X4Module } from '@/types/x4'
import type { ArchiveStationData } from '@/types/saveArchive'
import { useGameDataStore } from '@/store/useGameDataStore'
import { mergeSavedModules } from '@/store/logic/planningRecommendedModules'
function annotateDiff(module: SavedModule, totalMap: Record<string, number>): SavedModule {
  const archiveTotal = totalMap[module.id] || 0
  const diff = module.count - archiveTotal
  if (diff === 0) {
    return {
      id: module.id,
      count: module.count
    }
  }

  return {
    id: module.id,
    count: module.count,
    diffAnnotation: `${diff > 0 ? '+' : ''}${diff}`
  }
}
function maybeAnnotateDiff(module: SavedModule, totalMap: Record<string, number>, hasArchive: boolean): SavedModule {
  if (!hasArchive) return { id: module.id, count: module.count }
  return annotateDiff(module, totalMap)
}
function shouldShowPlannedDiff(module: SavedModule, totalMap: Record<string, number>, autoCount: number): boolean {
  if (!totalMap[module.id]) return true
  const archiveTotal = totalMap[module.id] || 0
  const totalCount = module.count + autoCount
  return module.count > archiveTotal || totalCount < archiveTotal
}

export interface PlanningPresenterProps {
  workbenchMode: ComputedRef<ProductionSessionState['workbenchMode']>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchive: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  autoHabitationModules: ComputedRef<SavedModule[]>
  autoInfrastructureModules: ComputedRef<SavedModule[]>
  effectiveAutoIndustryModules: ComputedRef<SavedModule[]>
  effectiveAutoHabitationModules: ComputedRef<SavedModule[]>
  effectiveAutoInfrastructureModules: ComputedRef<SavedModule[]>
  archiveTotalMap: ComputedRef<Record<string, number>>
  recommendedModules: ComputedRef<SavedModule[]>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
  enforceDlcActivation: ComputedRef<boolean>
}

export interface PlanningPresenterEmits {
  updatePlannedModules: (modules: SavedModule[]) => void
}

export interface UseProductionPlanningPresenterReturn {
  props: PlanningPresenterProps
  emits: PlanningPresenterEmits
}

export interface PlanningPresenterStore {
  session: ProductionSessionState
  context: ProductionContextState
  stationState: ProductionStationState | null
  archiveStation?: ArchiveStationData | null
  moduleActions: {
    updatePlannedModules(modules: SavedModule[]): void
  }
}

export function useProductionPlanningPresenter(store: PlanningPresenterStore): UseProductionPlanningPresenterReturn {
  const gameDataStore = useGameDataStore()
  const liveModules = computed(() => store.archiveStation?.modules || [])
  const liveBuildingModules = computed(() => store.archiveStation?.building?.modules || [])

  const archiveTotalMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const m of liveModules.value) {
      map[m.id] = (map[m.id] || 0) + m.count
    }
    for (const m of liveBuildingModules.value) {
      map[m.id] = (map[m.id] || 0) + m.count
    }
    return map
  })

  const rawAutoIndustry = computed(() => store.stationState?.autoIndustryModules || [])
  const rawAutoHabitation = computed(() => store.stationState?.autoHabitationModules || [])
  const rawAutoInfrastructure = computed(() => store.stationState?.autoInfrastructureModules || [])
  const plannedModules = computed(() => store.stationState?.plannedModules || [])
  const recommendedModules = computed(() => store.stationState?.recommendedModules || [])
  const explicitPlannedCountMap = computed(() => {
    return new Map(mergeSavedModules(plannedModules.value).map((module) => [module.id, module.count]))
  })
  const autoModulesCountMap = computed(() => {
    const map = new Map<string, number>()
    for (const m of rawAutoIndustry.value) map.set(m.id, (map.get(m.id) || 0) + m.count)
    for (const m of rawAutoHabitation.value) map.set(m.id, (map.get(m.id) || 0) + m.count)
    for (const m of rawAutoInfrastructure.value) map.set(m.id, (map.get(m.id) || 0) + m.count)
    return map
  })
  const plannedDisplayModules = computed(() => {
    const recommendedIds = new Set(recommendedModules.value.map((module) => module.id))
    const visibleExplicitModules = plannedModules.value.filter((module) => !recommendedIds.has(module.id))
    return visibleExplicitModules.map((module) => {
      if (!store.archiveStation) return { id: module.id, count: module.count }
      const autoCount = autoModulesCountMap.value.get(module.id) || 0
      if (!shouldShowPlannedDiff(module, archiveTotalMap.value, autoCount)) {
        return { id: module.id, count: module.count }
      }
      return annotateDiff(module, archiveTotalMap.value)
    })
  })

  const recommendedDisplayModules = computed(() => {
    return recommendedModules.value.map((module) => ({
      ...maybeAnnotateDiff(module, archiveTotalMap.value, !!store.archiveStation),
      isReferenceRecommended: true
    }))
  })

  function buildEffectiveAutoDisplayModules(
    rawModules: SavedModule[],
    isTargetModule: (info: X4Module) => boolean,
    options?: { excludeRecommended?: boolean }
  ): SavedModule[] {
    const recommendedIds = options?.excludeRecommended
      ? new Set(recommendedModules.value.map((module) => module.id))
      : null

    return mergeSavedModules(
      rawModules.filter((module) => {
        if (recommendedIds?.has(module.id)) return false
        const info = gameDataStore.modulesMap[module.id] as X4Module | undefined
        if (!info || !isTargetModule(info)) return false
        return true
      })
    ).map((module) => {
      if (!store.archiveStation) return { id: module.id, count: module.count }
      const explicitPlanned = explicitPlannedCountMap.value.get(module.id) || 0
      const archiveTotal = archiveTotalMap.value[module.id] || 0
      const remainingArchive = Math.max(0, archiveTotal - explicitPlanned)
      const diff = module.count - remainingArchive
      if (diff === 0) return { id: module.id, count: module.count }
      return { id: module.id, count: module.count, diffAnnotation: `${diff > 0 ? '+' : ''}${diff}` }
    })
  }

  const effectiveAutoIndustryDisplayModules = computed(() =>
    buildEffectiveAutoDisplayModules(
      rawAutoIndustry.value,
      (info) => (info.type === 'production' || info.type === 'processingmodule') && info.method !== 'recycling',
      { excludeRecommended: true }
    )
  )

  const effectiveAutoHabitationDisplayModules = computed(() =>
    buildEffectiveAutoDisplayModules(
      rawAutoHabitation.value,
      (info) => info.type === 'habitation' || info.type.includes('habitat')
    )
  )

  const effectiveAutoInfrastructureDisplayModules = computed(() =>
    buildEffectiveAutoDisplayModules(
      rawAutoInfrastructure.value,
      (info) => info.type === 'storage' || info.type === 'pier'
    )
  )

  const props: PlanningPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    hasArchive: computed(() => store.archiveStation != null),
    plannedModules: plannedDisplayModules,
    autoIndustryModules: effectiveAutoIndustryDisplayModules,
    autoHabitationModules: effectiveAutoHabitationDisplayModules,
    autoInfrastructureModules: effectiveAutoInfrastructureDisplayModules,
    effectiveAutoIndustryModules: effectiveAutoIndustryDisplayModules,
    effectiveAutoHabitationModules: effectiveAutoHabitationDisplayModules,
    effectiveAutoInfrastructureModules: effectiveAutoInfrastructureDisplayModules,
    archiveTotalMap,
    recommendedModules: recommendedDisplayModules,
    liveModules,
    liveBuildingModules,
    enforceDlcActivation: computed(() => store.stationState?.enforceDlcActivation ?? false)
  }

  const emits: PlanningPresenterEmits = {
    updatePlannedModules: (modules) => store.moduleActions.updatePlannedModules(modules)
  }

  return { props, emits }
}
