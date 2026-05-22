import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import type {
  EmpireGroupedFlows,
  StationPlan,
  X4Ware,
  BindingSectorGroup
} from '@/types/x4'
import type { StationDerivedCache } from '@/store/state/StationDerivedMap'

export interface SectorSunlightMap {
  [sectorMacro: string]: { area?: { sunlight?: number } }
}

function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}

export interface TransitHubInfo {
  groupId: string
  groupName: string
  tradeStation: BindingSectorGroup['tradeStation']
}

export interface SaveBindingAggregateResult {
  groupedFlows: EmpireGroupedFlows
  transitHubs: TransitHubInfo[]
}

export interface ReadAggregatedFlowsInput {
  stations: StationPlan[]
  waresMap: Record<string, X4Ware>
  getCache: (stationId: string) => StationDerivedCache | null
}

export interface ReadAggregatedFlowsOptions {
  transitHubs?: TransitHubInfo[]
}

export function readSaveBindingAggregatedFlows(
  input: ReadAggregatedFlowsInput,
  options?: ReadAggregatedFlowsOptions
): SaveBindingAggregateResult {
  const { stations, waresMap, getCache } = input
  const transitHubs = options?.transitHubs || []

  if (stations.length === 0) {
    return {
      groupedFlows: createEmptyEmpireGroupedFlows(),
      transitHubs
    }
  }

  const groupedFlows = analyzeEmpireWareFlow(
    stations,
    (stationId) => {
      const cache = getCache(stationId)
      if (!cache) return []
      return cache.productionFlows.filter(f => {
        if (f.netRate <= 0) return true
        return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
      })
    },
    waresMap
  )

  return {
    groupedFlows,
    transitHubs
  }
}

export function buildTransitHubsFromBinding(groups: BindingSectorGroup[]): TransitHubInfo[] {
  return groups
    .filter((g) => g.tradeStation)
    .map((g) => ({
      groupId: g.id,
      groupName: g.name,
      tradeStation: g.tradeStation
    }))
}
