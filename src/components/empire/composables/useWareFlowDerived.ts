import { computed, watch, type ComputedRef } from 'vue'
import type { SavedModule, GroupedFlows } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { calculateWareFlowDerived } from '@/store/logic/calculateWareFlowDerived'

export interface UseWareFlowDerivedDeps {
  productionFlows: ComputedRef<WareProductionFlow[]>
  autoIndustryModules: ComputedRef<SavedModule[]>
  plannedModules: ComputedRef<SavedModule[]>
  warePriorityLevels: ComputedRef<Record<string, number>>
  modulesMap: ComputedRef<Record<string, any>>
  settings: ComputedRef<{
    racePreference: string
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    transportMinutes: number
    transportShipCapacity: number
    sunlight: number
  }>
}

export interface UseWareFlowDerivedReturn {
  groupedFlows: ComputedRef<GroupedFlows>
  autoInfrastructureModules: ComputedRef<SavedModule[]>
  setAutoInfrastructureModules: (modules: SavedModule[]) => void
}

export function useWareFlowDerived(
  deps: UseWareFlowDerivedDeps,
  onUpdateInfrastructure: (modules: SavedModule[]) => void
): UseWareFlowDerivedReturn {
  const {
    productionFlows,
    autoIndustryModules,
    plannedModules,
    warePriorityLevels,
    modulesMap,
    settings
  } = deps

  const result = computed(() => {
    if (productionFlows.value.length === 0) {
      return {
        groupedFlows: {
          flows: [],
          rateGroups: { positive: [], operations: [], supply: [], resources: [] },
          volumeGroups: { solid: [], liquid: [], container: [] }
        },
        autoInfrastructureModules: []
      }
    }

    return calculateWareFlowDerived({
      productionFlows: productionFlows.value,
      autoIndustryModules: autoIndustryModules.value,
      plannedModules: plannedModules.value,
      modulesMap: modulesMap.value,
      settings: settings.value,
      warePriorityLevels: warePriorityLevels.value
    })
  })

  const groupedFlows = computed(() => result.value.groupedFlows)
  const autoInfrastructureModules = computed(() => result.value.autoInfrastructureModules)

  watch(
    () => result.value.autoInfrastructureModules,
    (newModules) => {
      onUpdateInfrastructure(newModules)
    },
    { deep: true, immediate: false }
  )

  return {
    groupedFlows,
    autoInfrastructureModules,
    setAutoInfrastructureModules: onUpdateInfrastructure
  }
}