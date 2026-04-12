import { computed, type Ref, type ComputedRef } from 'vue'
import type { SavedModule, EmpireGroupedFlows } from '@/types/x4'
import type { TransitHubWorkbenchProps, TransitHubWorkbenchEmits, WareFlowViewMode } from '@/types/production-ui'

export interface TransitHubViewModelInput {
  sectorId: string
  racePreference: string
  transportShipCapacity: number
}

export interface UseTransitHubWorkbenchModelDeps {
  sectorId: Ref<string | null>
  groupedFlows: ComputedRef<EmpireGroupedFlows>
  storageFlows: ComputedRef<any[]>
  storageModulePlans: ComputedRef<any[]>
  supplyBuildModules: ComputedRef<SavedModule[]>
  viewMode: Ref<WareFlowViewMode>
}

export interface UseTransitHubWorkbenchModelReturn {
  props: ComputedRef<TransitHubWorkbenchProps | null>
  emits: TransitHubWorkbenchEmits
}

export function useTransitHubWorkbenchModel(deps: UseTransitHubWorkbenchModelDeps): UseTransitHubWorkbenchModelReturn {
  const {
    sectorId,
    groupedFlows,
    storageFlows,
    storageModulePlans,
    supplyBuildModules,
    viewMode
  } = deps

  const props = computed<TransitHubWorkbenchProps | null>(() => {
    if (!sectorId.value) return null
    return {
      sectorId: sectorId.value,
      groupedFlows: groupedFlows.value,
      storageFlows: storageFlows.value,
      storageModulePlans: storageModulePlans.value,
      supplyBuildModules: supplyBuildModules.value,
      viewMode: viewMode.value
    }
  })

  const emits: TransitHubWorkbenchEmits = {
    updateViewMode: (value: WareFlowViewMode) => {
      viewMode.value = value
    }
  }

  return {
    props,
    emits
  }
}