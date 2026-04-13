import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { StationPlan, EmpireGroupedFlows } from '@/types/x4'
import { analyzeEmpireWareFlow } from '@/store/logic/analyzeEmpireWareFlow'
import { getFilteredProductionFlows } from '@/store/logic/stationComputeService'

export interface UseEmpireWareFlowDerivedDeps {
  stations: ComputedRef<StationPlan[]>
  modulesMap: ComputedRef<Record<string, any>>
}

export interface UseEmpireWareFlowDerivedReturn {
  buyMultiplier: Ref<number>
  sellMultiplier: Ref<number>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
}

export function useEmpireWareFlowDerived(deps: UseEmpireWareFlowDerivedDeps): UseEmpireWareFlowDerivedReturn {
  const { stations } = deps

  const buyMultiplier = ref(0.5)
  const sellMultiplier = ref(0.5)

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    if (stations.value.length === 0) {
      return {
        flows: [],
        empireGroups: { operations: [], supply: [] }
      }
    }

    return analyzeEmpireWareFlow(
      stations.value,
      (stationId) => getFilteredProductionFlows(stationId)
    )
  })

  return {
    buyMultiplier,
    sellMultiplier,
    empireGroupedFlows
  }
}