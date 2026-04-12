import { computed, type ComputedRef } from 'vue'
import type { SavedModule } from '@/types/x4'
import type { StationPlanningPanelProps, StationPlanningPanelEmits } from '@/types/production-ui'

export interface UseStationPlanningPanelModelDeps {
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  enforceDlcActivation: ComputedRef<boolean>
  onUpdatePlannedModules: (modules: SavedModule[]) => void
}

export interface UseStationPlanningPanelModelReturn {
  props: ComputedRef<StationPlanningPanelProps>
  emits: StationPlanningPanelEmits
}

export function useStationPlanningPanelModel(deps: UseStationPlanningPanelModelDeps): UseStationPlanningPanelModelReturn {
  const {
    plannedModules,
    autoIndustryModules,
    enforceDlcActivation,
    onUpdatePlannedModules
  } = deps

  const props = computed<StationPlanningPanelProps>(() => ({
    plannedModules: plannedModules.value,
    autoIndustryModules: autoIndustryModules.value,
    enforceDlcActivation: enforceDlcActivation.value
  }))

  const emits: StationPlanningPanelEmits = {
    updatePlannedModules: (modules: SavedModule[]) => {
      onUpdatePlannedModules(modules)
    }
  }

  return {
    props,
    emits
  }
}