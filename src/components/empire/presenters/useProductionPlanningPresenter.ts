import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'
import type { ArchiveStationData } from '@/types/saveArchive'

function deductArchive(modules: SavedModule[], totalMap: Record<string, number>): SavedModule[] {
  if (Object.keys(totalMap).length === 0) return modules
  return modules
    .map(m => ({ ...m, count: Math.max(0, m.count - (totalMap[m.id] || 0)) }))
    .filter(m => m.count > 0)
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

  const props: PlanningPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    hasArchive: computed(() => store.archiveStation != null),
    plannedModules: computed(() => store.stationState?.plannedModules || []),
    autoIndustryModules: computed(() => rawAutoIndustry.value),
    autoHabitationModules: computed(() => rawAutoHabitation.value),
    autoInfrastructureModules: computed(() => rawAutoInfrastructure.value),
    effectiveAutoIndustryModules: computed(() => deductArchive(rawAutoIndustry.value, archiveTotalMap.value)),
    effectiveAutoHabitationModules: computed(() => deductArchive(rawAutoHabitation.value, archiveTotalMap.value)),
    effectiveAutoInfrastructureModules: computed(() => deductArchive(rawAutoInfrastructure.value, archiveTotalMap.value)),
    archiveTotalMap,
    liveModules,
    liveBuildingModules,
    enforceDlcActivation: computed(() => store.stationState?.enforceDlcActivation ?? false)
  }

  const emits: PlanningPresenterEmits = {
    updatePlannedModules: (modules) => store.moduleActions.updatePlannedModules(modules)
  }

  return { props, emits }
}
