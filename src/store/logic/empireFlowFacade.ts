import { computed, type Ref, type ComputedRef } from 'vue'
import type {
  EmpirePlan,
  SaveBindingPlan,
  GroupedFlows,
  EmpireGroupedFlows,
  EmpireWareFlow,
  SectorInternalData,
  SupplyStorageFlow,
  SupplyPlanningInput,
  X4Module,
  X4Ware
} from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './stationGapViewModel'
import { readSaveBindingAggregatedFlows, buildTransitHubsFromBinding } from './liveProductionFlows'
import { StationDerivedMap } from '@/store/state/StationDerivedMap'
import type { EmpireSourceView } from './empireSourceView'

export interface EmpireFlowFacadeDeps {
  productionSource: Ref<'empire' | 'save-binding'>
  activeEmpire: Ref<EmpirePlan | null>
  activeBinding: Ref<SaveBindingPlan | null>
  sourceView: EmpireSourceView
  modulesMap: Ref<Record<string, X4Module> | null>
  waresMap: Ref<Record<string, X4Ware> | null>
  flowMap: Ref<StationDerivedMap | null> | ComputedRef<StationDerivedMap | null>
}

export interface EmpireFlowFacade {
  stationFlowCache: ComputedRef<Map<string, GroupedFlows>>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
  sectorInternalDataMap: ComputedRef<Map<string, SectorInternalData>>
  getSupplyPlanningInput: (sectorId: string) => SupplyPlanningInput
  getSectorInternalData: (sectorId: string) => SectorInternalData
  getSectorFinalProductionFlows: (sectorId: string) => WareProductionFlow[]
  getStationComponentGapFlows: (stationId: string | null, activeStationId: string | null) => StationComponentGapFlows
}

function classifyAndEnrichFlows(
  flows: WareProductionFlow[],
  waresMap: Record<string, X4Ware>
): EmpireGroupedFlows {
  const supply: EmpireWareFlow[] = []
  const operations: EmpireWareFlow[] = []

  for (const flow of flows) {
    const isWorkforce = flow.contributions.some(c => c.class === 'workforce')
    const isNonContainer = flow.transportType !== 'container'
    const category = (isWorkforce || isNonContainer) ? 'supply' : 'operations'

    const ware = waresMap[flow.wareId]
    const empireFlow: EmpireWareFlow = {
      wareId: flow.wareId,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      production: flow.production,
      consumption: flow.consumption,
      netRate: flow.netRate,
      minPrice: ware?.minPrice || 0,
      avgPrice: ware?.price || 0,
      maxPrice: ware?.maxPrice || 0,
      contributions: flow.contributions
    }

    if (category === 'supply') supply.push(empireFlow)
    else operations.push(empireFlow)
  }

  const allFlows = [...operations, ...supply].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  return { flows: allFlows, empireGroups: { operations, supply } }
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

function createEmptySupplyStorageFlows(): SupplyStorageFlow[] {
  return []
}



export function createEmpireFlowFacade(deps: EmpireFlowFacadeDeps): EmpireFlowFacade {
  const {
    productionSource,
    activeEmpire,
    activeBinding,
    sourceView,
    modulesMap,
    waresMap,
    flowMap: inputFlowMap
  } = deps

  const derivedBindingStations = sourceView.derivedBindingStations
  const productionStations = sourceView.productionStations
  const productionSectors = sourceView.productionSectors
  const sectors = sourceView.sectors
  const sectorLinks = sourceView.sectorLinks
  const orderedStationsBySector = sourceView.orderedStationsBySector

const stationFlowCache = computed<Map<string, GroupedFlows>>(() => {
    const cache = new Map<string, GroupedFlows>()
    const flowMap = inputFlowMap.value
    if (!flowMap) return cache
    if (productionSource.value === 'save-binding') {
      derivedBindingStations.value.forEach((item) => {
        const flowCache = flowMap.getCache(item.station.id)
        if (flowCache) {
          cache.set(item.station.id, flowMap.getFilteredGrouped(item.station.id, flowCache.warePriorityLevels))
        }
      })
      return cache
    }
    if (!activeEmpire.value) return cache
    activeEmpire.value.stations.forEach(station => {
      const flowCache = flowMap.getCache(station.id)
      if (flowCache) {
        cache.set(station.id, flowMap.getFilteredGrouped(station.id, flowCache.warePriorityLevels))
      }
    })
    return cache
  })

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    const flowMap = inputFlowMap.value
    if (!flowMap) return createEmptyEmpireGroupedFlows()
    if (productionSource.value === 'save-binding') {
      const binding = activeBinding.value
      if (!binding || !waresMap.value) {
        return createEmptyEmpireGroupedFlows()
      }
      const stations = derivedBindingStations.value.map((item) => item.station)
      const transitHubs = buildTransitHubsFromBinding(binding.groups)
      const result = readSaveBindingAggregatedFlows({
        stations,
        waresMap: waresMap.value,
        getCache: (stationId) => flowMap.getCache(stationId)
      }, { transitHubs })
      return result.groupedFlows
    }
    
    if (!activeEmpire.value || !waresMap.value) {
      return createEmptyEmpireGroupedFlows()
    }

    const rawFlows = flowMap.getEmpireFlows()
    return classifyAndEnrichFlows(rawFlows, waresMap.value)
  })

  const rawSectorGroupedFlowsMap = computed<Map<string, EmpireGroupedFlows>>(() => {
    const map = new Map<string, EmpireGroupedFlows>()
    const flowMap = inputFlowMap.value
    if (!flowMap) return map
    if (!waresMap.value) return map

    const sectorList = productionSectors.value

    sectorList.forEach((sector) => {
      const rawFlows = flowMap.getSectorFlows(sector.id)
      map.set(sector.id, classifyAndEnrichFlows(rawFlows, waresMap.value!))
    })

    return map
  })

  const sectorInternalDataMap = computed<Map<string, SectorInternalData>>(() => {
    const map = new Map<string, SectorInternalData>()
    const flowMap = inputFlowMap.value
    if (!flowMap) return map
    if (!modulesMap.value) return map

    const stations = productionStations.value
    const sectorList = productionSectors.value

    const buildSupplyStorageFlows = (groupedFlows: EmpireGroupedFlows): SupplyStorageFlow[] => {
      const stationMap = new Map(stations.map((station) => [station.id, station]))
      const byWareId = new Map<string, SupplyStorageFlow>()

      groupedFlows.flows.forEach((flow) => {
        const details: SupplyStorageFlow['details'] = []
        let totalProductionStorageVolume = 0
        let totalConsumptionStorageVolume = 0

        flow.contributions.forEach((contribution) => {
          const station = stationMap.get(contribution.id)
          if (!station) return

          const staticProduction = Math.max(contribution.amount, 0)
          const staticConsumption = Math.max(-contribution.amount, 0)
          const productionStorageVolume = staticProduction * flow.unitVolume * station.settings.primaryProductBufferHours
          const consumptionStorageVolume = staticConsumption * flow.unitVolume * station.settings.resourceBufferHours

          if (productionStorageVolume > 0) {
            details.push({
              stationId: contribution.id,
              stationName: (contribution as unknown as Record<string, string>).stationName || '',
              stationCount: contribution.count,
              kind: 'production',
              staticRate: staticProduction,
              storageVolume: productionStorageVolume
            })
            totalProductionStorageVolume += productionStorageVolume
          }

          if (consumptionStorageVolume > 0) {
            details.push({
              stationId: contribution.id,
              stationName: (contribution as unknown as Record<string, string>).stationName || '',
              stationCount: contribution.count,
              kind: 'consumption',
              staticRate: staticConsumption,
              storageVolume: consumptionStorageVolume
            })
            totalConsumptionStorageVolume += consumptionStorageVolume
          }
        })

        byWareId.set(flow.wareId, {
          wareId: flow.wareId,
          orderIndex: flow.orderIndex,
          tier: flow.tier,
          transportType: flow.transportType,
          unitVolume: flow.unitVolume,
          totalProductionStorageVolume,
          totalConsumptionStorageVolume,
          totalRequiredStorageVolume: Math.max(totalProductionStorageVolume, totalConsumptionStorageVolume),
          details
        })
      })

      const products = groupedFlows.empireGroups.operations
        .filter((flow) => flow.netRate > 0)
        .map((flow) => flow.wareId)
      const operations = groupedFlows.empireGroups.operations
        .filter((flow) => flow.netRate <= 0)
        .map((flow) => flow.wareId)
      const supply = groupedFlows.empireGroups.supply.map((flow) => flow.wareId)
      const orderedWareIds = [...products, ...operations, ...supply]

      return orderedWareIds
        .map((wareId) => byWareId.get(wareId))
        .filter((item): item is SupplyStorageFlow => !!item && item.transportType === 'container')
    }

    sectorList.forEach((sector) => {
      const localStationIds = stations
        .filter((station) => station.sectorId === sector.id)
        .map((station) => station.id)

      const rawGroupedFlows = rawSectorGroupedFlowsMap.value.get(sector.id) || createEmptyEmpireGroupedFlows()

      map.set(sector.id, {
        sectorId: sector.id,
        planning: {
          sectorId: sector.id,
          localStationIds
        },
        localGroupedFlows: rawGroupedFlows,
        supplyStorageFlows: buildSupplyStorageFlows(rawGroupedFlows),
        storageModulePlans: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: []
      })
    })

    return map
  })

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    if (!inputFlowMap.value) {
      return {
        sectorId,
        localStationIds: []
      }
    }
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal.planning
    return {
      sectorId,
      localStationIds: []
    }
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    if (!inputFlowMap.value) {
      return {
        sectorId,
        planning: getSupplyPlanningInput(sectorId),
        localGroupedFlows: createEmptyEmpireGroupedFlows(),
        supplyStorageFlows: createEmptySupplyStorageFlows(),
        storageModulePlans: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: []
      }
    }
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal
    return {
      sectorId,
      planning: getSupplyPlanningInput(sectorId),
      localGroupedFlows: createEmptyEmpireGroupedFlows(),
      supplyStorageFlows: createEmptySupplyStorageFlows(),
      storageModulePlans: [],
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: []
    }
  }

  function getSectorFinalProductionFlows(sectorId: string): WareProductionFlow[] {
    if (!inputFlowMap.value) return []
    return inputFlowMap.value.getSectorCombinedFlows(sectorId)
  }

  function getStationComponentGapFlows(stationId: string | null, activeStationId: string | null): StationComponentGapFlows {
    if (!inputFlowMap.value) {
      return { operations: [], supply: [] }
    }
    const effectiveStationId = stationId || activeStationId || null
    if (!effectiveStationId) {
      return { operations: [], supply: [] }
    }

    const station = productionStations.value.find((item) => item.id === effectiveStationId)
    const currentSectorId = station?.sectorId || ''
    if (!currentSectorId) {
      return { operations: [], supply: [] }
    }

    return buildStationComponentGapFlows({
      currentSectorId,
      sectors: sectors.value,
      sectorLinks: sectorLinks.value,
      orderedStations: orderedStationsBySector.value,
      sectorInternalDataMap: sectorInternalDataMap.value
    })
  }

  return {
    stationFlowCache,
    empireGroupedFlows,
    sectorInternalDataMap,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorFinalProductionFlows,
    getStationComponentGapFlows
  }
}
