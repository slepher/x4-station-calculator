import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationPlanningPanelEmits } from '@/types/production-ui'
import type { SavedModule } from '@/types/x4'

export interface PlanningPresenterProps {
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  autoHabitationModules: ComputedRef<SavedModule[]>
  autoInfrastructureModules: ComputedRef<SavedModule[]>
  enforceDlcActivation: ComputedRef<boolean>
}

export interface UseProductionPlanningPresenterReturn {
  props: PlanningPresenterProps
  emits: StationPlanningPanelEmits
}

export function useProductionPlanningPresenter(store: ProductionWorkbenchStoreContract): UseProductionPlanningPresenterReturn {
  const props: PlanningPresenterProps = {
    plannedModules: computed(() => store.getPlannedModules()),
    autoIndustryModules: computed(() => store.getAutoModules()),
    autoHabitationModules: computed(() => store.getAutoHabitationModules()),
    autoInfrastructureModules: computed(() => store.getAutoInfrastructureModules()),
    enforceDlcActivation: computed(() => store.getEnforceDlcActivation())
  }

  const emits: StationPlanningPanelEmits = {
    updatePlannedModules: (modules) => store.updatePlannedModules(modules)
  }

  return { props, emits }
}