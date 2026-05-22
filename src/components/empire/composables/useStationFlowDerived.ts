import { computed, type ComputedRef } from 'vue'
import type { SavedModule, X4Module, X4Ware, GroupedFlows } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { calculateWareFlowDerived } from '@/store/logic/calculateWareFlowDerived'

export interface StationFlowDerivedProps {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  settings: DerivedSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  warePriorityLevels: Record<string, number>
}

export interface DerivedSettings {
  racePreference: string
  resourceBufferHours: number
  primaryProductBufferHours: number
  secondaryProductBufferHours: number
  buyMultiplier: number
  sellMultiplier: number
  transportMinutes: number
  transportShipCapacity: number
  sunlight: number
}

export interface StationFlowDerivedResult {
  groupedFlows: GroupedFlows
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

export function useStationFlowDerived(
  props: ComputedRef<StationFlowDerivedProps>
): ComputedRef<StationFlowDerivedResult> {
  return computed(() => {
    if (props.value.productionFlows.length === 0) {
      return {
        groupedFlows: createEmptyGroupedFlows()
      }
    }
    
    return calculateWareFlowDerived({
      productionFlows: props.value.productionFlows,
      autoIndustryModules: props.value.autoIndustryModules,
      plannedModules: props.value.plannedModules,
      modulesMap: props.value.modulesMap,
      waresMap: props.value.waresMap,
      settings: props.value.settings,
      warePriorityLevels: props.value.warePriorityLevels
    })
  })
}

export function computeStationDerived(
  props: StationFlowDerivedProps
): StationFlowDerivedResult {
  if (props.productionFlows.length === 0) {
    return {
      groupedFlows: createEmptyGroupedFlows()
    }
  }
  
  return calculateWareFlowDerived({
    productionFlows: props.productionFlows,
    autoIndustryModules: props.autoIndustryModules,
    plannedModules: props.plannedModules,
    modulesMap: props.modulesMap,
    waresMap: props.waresMap,
    settings: props.settings,
    warePriorityLevels: props.warePriorityLevels
  })
}

export type { StationFlowDerivedResult as DerivedData }