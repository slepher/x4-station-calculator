import { computed, type Ref, type ComputedRef } from 'vue'
import type { SavedModule, ModuleGroupResult } from '@/types/x4'
import type { StationPlanningPanelProps, StationPlanningPanelEmits } from '@/types/production-ui'

export interface UseStationPlanningPanelModelDeps {
  plannedModules: ComputedRef<SavedModule[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  filteredModulesGrouped: ComputedRef<ModuleGroupResult[]>
  searchQuery: Ref<string>
  enforceDlcActivation: ComputedRef<boolean>
}

export interface UseStationPlanningPanelModelReturn {
  props: ComputedRef<StationPlanningPanelProps>
  emits: StationPlanningPanelEmits
}

export function useStationPlanningPanelModel(deps: UseStationPlanningPanelModelDeps): UseStationPlanningPanelModelReturn {
  const {
    plannedModules,
    autoIndustryModules,
    filteredModulesGrouped,
    searchQuery,
    enforceDlcActivation
  } = deps

  const props = computed<StationPlanningPanelProps>(() => ({
    plannedModules: plannedModules.value,
    autoIndustryModules: autoIndustryModules.value,
    filteredModulesGrouped: filteredModulesGrouped.value,
    searchQuery: searchQuery.value,
    enforceDlcActivation: enforceDlcActivation.value,
    flashingModuleIds: [],
    highlightedModuleIds: []
  }))

  const emits: StationPlanningPanelEmits = {
    updateSearchQuery: (value: string) => {
      searchQuery.value = value
    },
    addModule: (_moduleId: string) => {
      // Handled by parent
    },
    removeModule: (_index: number) => {
      // Handled by parent
    },
    updateModuleCount: (_index: number, _count: number) => {
      // Handled by parent
    },
    reorderModules: (_modules: SavedModule[]) => {
      // Handled by parent
    },
    applyScale: (_scale: number) => {
      // Handled by parent
    },
    transferAutoModule: (_module: SavedModule) => {
      // Handled by parent
    }
  }

  return {
    props,
    emits
  }
}