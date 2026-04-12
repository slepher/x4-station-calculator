import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { StationPlan, EmpireGroupedFlows, GroupedFlows } from '@/types/x4'
import { calculateWareFlowDerived } from '@/store/logic/calculateWareFlowDerived'
import { analyzeEmpireWareFlow } from '@/store/logic/analyzeEmpireWareFlow'
import { getProductionFlows, getWarePriorityLevels, getSettings, getPlannedModules, getAutoIndustryModules } from '@/store/logic/stationComputeService'

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

export interface UseEmpireWareFlowDerivedDeps {
  stations: ComputedRef<StationPlan[]>
  modulesMap: ComputedRef<Record<string, any>>
}

export interface UseEmpireWareFlowDerivedReturn {
  priceMultiplier: Ref<number>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
}

export function useEmpireWareFlowDerived(deps: UseEmpireWareFlowDerivedDeps): UseEmpireWareFlowDerivedReturn {
  const { stations, modulesMap } = deps

  const priceMultiplier = ref(0.5)

  const stationDerivedFlows = computed<Map<string, GroupedFlows>>(() => {
    const cache = new Map<string, GroupedFlows>()

    stations.value.forEach(station => {
      const productionFlows = getProductionFlows(station.id)
      const warePriorityLevels = getWarePriorityLevels(station.id)
      const settings = getSettings(station.id)

      if (productionFlows.length === 0) {
        cache.set(station.id, createEmptyGroupedFlows())
        return
      }

      const filteredFlows = productionFlows.filter(f => {
        if (f.netRate <= 0) return true
        return (warePriorityLevels[f.wareId] ?? 0) > 0
      })

      if (filteredFlows.length === 0) {
        cache.set(station.id, createEmptyGroupedFlows())
        return
      }

      const derivedSettings = {
        racePreference: settings.racePreference,
        resourceBufferHours: settings.resourceBufferHours,
        primaryProductBufferHours: settings.primaryProductBufferHours,
        secondaryProductBufferHours: settings.secondaryProductBufferHours,
        buyMultiplier: priceMultiplier.value,
        sellMultiplier: priceMultiplier.value,
        transportMinutes: settings.transportMinutes,
        transportShipCapacity: settings.transportShipCapacity,
        sunlight: settings.sunlight
      }

      const result = calculateWareFlowDerived({
        productionFlows: filteredFlows,
        autoIndustryModules: getAutoIndustryModules(station.id),
        plannedModules: getPlannedModules(station.id),
        modulesMap: modulesMap.value,
        settings: derivedSettings,
        warePriorityLevels
      })

      cache.set(station.id, result.groupedFlows)
    })

    return cache
  })

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    if (stations.value.length === 0) {
      return {
        flows: [],
        empireGroups: { operations: [], supply: [] }
      }
    }

    return analyzeEmpireWareFlow(
      stations.value,
      (stationId) => stationDerivedFlows.value.get(stationId) || createEmptyGroupedFlows()
    )
  })

  return {
    priceMultiplier,
    empireGroupedFlows
  }
}