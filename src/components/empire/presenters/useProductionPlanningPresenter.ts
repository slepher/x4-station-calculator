import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationPlanningPanelEmits } from '@/types/production-ui'
import type { SavedModule, TransitHubStorageModulePlan } from '@/types/x4'

export interface PlanningPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchive: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  autoHabitationModules: ComputedRef<SavedModule[]>
  autoInfrastructureModules: ComputedRef<SavedModule[]>
  modulePlans: ComputedRef<TransitHubStorageModulePlan[]>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
  enforceDlcActivation: ComputedRef<boolean>
}

export interface UseProductionPlanningPresenterReturn {
  props: PlanningPresenterProps
  emits: StationPlanningPanelEmits
}

export function useProductionPlanningPresenter(store: ProductionWorkbenchStoreContract): UseProductionPlanningPresenterReturn {
  const session = computed(() => store.getSessionState())
  const context = computed(() => store.getContextState())
  const transitState = computed(() => store.getTransitState())
  const props: PlanningPresenterProps = {
    workbenchMode: computed(() => session.value.workbenchMode),
    visualMode: computed(() => session.value.visualMode),
    hasArchive: computed(() => context.value.hasArchive),
    plannedModules: computed(() => store.getPlannedModules()),
    autoIndustryModules: computed(() => store.getAutoModules()),
    autoHabitationModules: computed(() => store.getAutoHabitationModules()),
    autoInfrastructureModules: computed(() => store.getAutoInfrastructureModules()),
    modulePlans: computed(() => transitState.value.storageModulePlans),
    liveModules: computed(() => context.value.archiveModules),
    liveBuildingModules: computed(() => context.value.buildingModules),
    enforceDlcActivation: computed(() => store.getEnforceDlcActivation())
  }

  const emits: StationPlanningPanelEmits = {
    updatePlannedModules: (modules) => store.updatePlannedModules(modules)
  }

  return { props, emits }
}
