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

export interface PlanningPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
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
  const effectiveTargetModules = computed(() => store.stationState?.effectiveTargetModules || [])
  const finalPlannedModules = computed(() => store.stationState?.finalPlannedModules || [])
  const resolvedModules = computed(() => store.stationState?.resolvedModules || [])

  const plannedDisplayModules = computed(() => {
    const recommendedIds = new Set(recommendedModules.value.map((module) => module.id))
    const visibleExplicitModules = plannedModules.value.filter((module) => !recommendedIds.has(module.id))
    return visibleExplicitModules.map((module) => annotateDiff(module, archiveTotalMap.value))
  })

  const recommendedDisplayModules = computed(() => {
    return recommendedModules.value.map((module) => ({
      ...annotateDiff(module, archiveTotalMap.value),
      isReferenceRecommended: true
    }))
  })

  const displaySource = computed(() => {
    if (effectiveTargetModules.value.length > 0) {
      return {
        mode: 'target' as const,
        modules: effectiveTargetModules.value
      }
    }
    if (finalPlannedModules.value.length > 0) {
      return {
        mode: 'final' as const,
        modules: finalPlannedModules.value
      }
    }
    if (resolvedModules.value.length > 0) {
      return {
        mode: 'resolved' as const,
        modules: resolvedModules.value
      }
    }
    return {
      mode: 'raw' as const,
      modules: [] as SavedModule[]
    }
  })

  function buildEffectiveAutoDisplayModules(
    rawModules: SavedModule[],
    isTargetModule: (info: X4Module) => boolean,
    options?: { excludeRecommended?: boolean }
  ): SavedModule[] {
    const sourceMode = displaySource.value.mode
    const sourceModules = sourceMode === 'raw' ? rawModules : displaySource.value.modules
    const recommendedIds = options?.excludeRecommended
      ? new Set(recommendedModules.value.map((module) => module.id))
      : null

    return mergeSavedModules(
      sourceModules.filter((module) => {
        if (recommendedIds?.has(module.id)) return false
        const info = gameDataStore.modulesMap[module.id] as X4Module | undefined
        if (!info || !isTargetModule(info)) return false
        if (sourceMode === 'raw') return true
        const explicitPlannedCount = explicitPlannedCountMap.value.get(module.id) || 0
        return module.count > explicitPlannedCount
      })
    ).map((module) => annotateDiff(module, archiveTotalMap.value))
  }

  const effectiveAutoIndustryDisplayModules = computed(() =>
    buildEffectiveAutoDisplayModules(
      rawAutoIndustry.value,
      (info) => info.type === 'production' && info.method !== 'recycling',
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
