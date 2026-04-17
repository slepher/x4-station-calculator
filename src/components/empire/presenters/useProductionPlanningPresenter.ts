import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'

export interface PlanningPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchive: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  autoHabitationModules: ComputedRef<SavedModule[]>
  autoInfrastructureModules: ComputedRef<SavedModule[]>
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
  moduleActions: {
    updatePlannedModules(modules: SavedModule[]): void
  }
  getEnforceDlcActivation(): boolean
}

export function useProductionPlanningPresenter(store: PlanningPresenterStore): UseProductionPlanningPresenterReturn {
  const props: PlanningPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    hasArchive: computed(() => store.context.hasArchive),
    plannedModules: computed(() => store.stationState?.plannedModules || []),
    autoIndustryModules: computed(() => store.stationState?.autoIndustryModules || []),
    autoHabitationModules: computed(() => store.stationState?.autoHabitationModules || []),
    autoInfrastructureModules: computed(() => store.stationState?.autoInfrastructureModules || []),
    liveModules: computed(() => store.context.archiveModules),
    liveBuildingModules: computed(() => store.context.buildingModules),
    enforceDlcActivation: computed(() => store.getEnforceDlcActivation())
  }

  const emits: PlanningPresenterEmits = {
    updatePlannedModules: (modules) => store.moduleActions.updatePlannedModules(modules)
  }

  return { props, emits }
}
