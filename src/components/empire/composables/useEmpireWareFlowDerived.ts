import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { StationPlan, EmpireGroupedFlows, X4Ware } from '@/types/x4'
import { analyzeEmpireWareFlow } from '@/store/logic/analyzeEmpireWareFlow'
import { stationProductionFlowMap } from '@/store/state/StationProductionFlowMap'

export interface UseEmpireWareFlowDerivedDeps {
  stations: ComputedRef<StationPlan[]>
  modulesMap: ComputedRef<Record<string, any>>
  waresMap: ComputedRef<Record<string, X4Ware>>
}

export interface UseEmpireWareFlowDerivedReturn {
  buyMultiplier: Ref<number>
  sellMultiplier: Ref<number>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
}

export function useEmpireWareFlowDerived(deps: UseEmpireWareFlowDerivedDeps): UseEmpireWareFlowDerivedReturn {
  const { stations, waresMap } = deps

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
      (stationId) => {
        const cache = stationProductionFlowMap.getCache(stationId)
        if (!cache) return []
        return cache.productionFlows.filter(f => {
          if (f.netRate <= 0) return true
          return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
        })
      },
      waresMap.value
    )
  })

  return {
    buyMultiplier,
    sellMultiplier,
    empireGroupedFlows
  }
}