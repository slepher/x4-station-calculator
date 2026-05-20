import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'
import type { ArchiveStationData } from '@/types/saveArchive'
import { useGameDataStore } from '@/store/useGameDataStore'

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
  orphanArchiveModuleIds: ComputedRef<Set<string>>
  recommendedModules: ComputedRef<SavedModule[]>
  recommendedModulesExpanded: ComputedRef<boolean>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
  enforceDlcActivation: ComputedRef<boolean>
}

export interface PlanningPresenterEmits {
  updatePlannedModules: (modules: SavedModule[]) => void
  setRecommendedModulesExpanded: (expanded: boolean) => void
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
  recommendedModulesExpanded?: boolean
  moduleActions: {
    updatePlannedModules(modules: SavedModule[]): void
  }
  setRecommendedModulesExpanded?: (expanded: boolean) => void
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

  const orphanArchiveModuleIds = computed<Set<string>>(() => {
    const archiveModuleIds = Array.from(new Set([
      ...liveModules.value.map(module => module.id),
      ...liveBuildingModules.value.map(module => module.id)
    ]))
    if (archiveModuleIds.length === 0) return new Set()

    const archiveDefinitions = archiveModuleIds
      .map(moduleId => gameDataStore.modulesMap[moduleId])
      .filter((module): module is NonNullable<typeof module> => Boolean(module))

    const orphanIds = new Set<string>()
    archiveDefinitions.forEach((module) => {
      const outputWareIds = Object.keys(module.outputs || {})
      if (outputWareIds.length === 0) return

      const isOrphan = outputWareIds.some((wareId) => {
        return !archiveDefinitions.some((otherModule) => {
          if (otherModule.id === module.id) return false
          return (otherModule.inputs?.[wareId] || 0) > 0
        })
      })

      if (isOrphan) {
        orphanIds.add(module.id)
      }
    })

    return orphanIds
  })

  const recommendedModules = computed<SavedModule[]>(() => {
    if (orphanArchiveModuleIds.value.size === 0) return []

    const plannedCountMap = plannedModules.value.reduce<Record<string, number>>((map, module) => {
      map[module.id] = (map[module.id] || 0) + module.count
      return map
    }, {})

    return Object.entries(archiveTotalMap.value)
      .filter(([moduleId, archiveTotal]) => {
        if (!orphanArchiveModuleIds.value.has(moduleId)) return false
        return (plannedCountMap[moduleId] || 0) < archiveTotal
      })
      .map(([moduleId, archiveTotal]) => ({
        id: moduleId,
        count: archiveTotal - (plannedCountMap[moduleId] || 0)
      }))
  })

  const props: PlanningPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    hasArchive: computed(() => store.archiveStation != null),
    plannedModules: computed(() => plannedModules.value.map(module => annotateDiff(module, archiveTotalMap.value))),
    autoIndustryModules: computed(() => rawAutoIndustry.value),
    autoHabitationModules: computed(() => rawAutoHabitation.value),
    autoInfrastructureModules: computed(() => rawAutoInfrastructure.value),
    effectiveAutoIndustryModules: computed(() => rawAutoIndustry.value.map(module => annotateDiff(module, archiveTotalMap.value))),
    effectiveAutoHabitationModules: computed(() => rawAutoHabitation.value.map(module => annotateDiff(module, archiveTotalMap.value))),
    effectiveAutoInfrastructureModules: computed(() => rawAutoInfrastructure.value.map(module => annotateDiff(module, archiveTotalMap.value))),
    archiveTotalMap,
    orphanArchiveModuleIds,
    recommendedModules,
    recommendedModulesExpanded: computed(() => store.recommendedModulesExpanded ?? false),
    liveModules,
    liveBuildingModules,
    enforceDlcActivation: computed(() => store.stationState?.enforceDlcActivation ?? false)
  }

  const emits: PlanningPresenterEmits = {
    updatePlannedModules: (modules) => store.moduleActions.updatePlannedModules(modules),
    setRecommendedModulesExpanded: (expanded) => store.setRecommendedModulesExpanded?.(expanded)
  }

  return { props, emits }
}
