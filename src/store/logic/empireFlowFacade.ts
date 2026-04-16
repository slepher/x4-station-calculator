import { computed, type Ref, type ComputedRef } from 'vue'
import type {
  EmpirePlan,
  SaveBindingPlan,
  GroupedFlows,
  EmpireGroupedFlows,
  SectorInternalData,
  SupplyStorageFlow,
  SupplyPlanningInput,
  TransitHubViewModel,
  SavedModule,
  StationSettings,
  X4Module,
  X4Ware
} from '@/types/x4'
import type { ProductionPanelSource, ProductionPanelModeSource } from '@/types/production-panel-source'
import type { WareProductionFlow } from '@/types/production-flow'
import { createEmptyProductionPanelModeSource } from '@/types/production-panel-source'
import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { solveMultiWareByLink, type SectorLinkInput, type SolveMultiWareByLinkOutput } from './sectorLinkFlow'
import { buildTransitHubViewModel, buildTransitHubStorageFlows, buildTransitHubStorageModulePlans, mergeLinkFlowsIntoGroupedFlows } from './transitHubViewModel'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './stationGapViewModel'
import { readSaveBindingAggregatedFlows, buildTransitHubsFromBinding } from './liveProductionFlows'
import { stationProductionFlowMap, StationProductionFlowMap } from '@/store/state/StationProductionFlowMap'
import { parseSectorLinkKey } from './sectorLinks'
import type { EmpireSourceView } from './empireSourceView'

export interface SectorLinkCalcEntry {
  sectorId: string
  sectorsInput: Array<{ sectorId: string; netByWare: Record<string, number> }>
  solverOutput: SolveMultiWareByLinkOutput
}

export interface EmpireFlowFacadeDeps {
  productionSource: Ref<'empire' | 'save-binding'>
  activeEmpire: Ref<EmpirePlan | null>
  activeBinding: Ref<SaveBindingPlan | null>
  sourceView: EmpireSourceView
  modulesMap: Ref<Record<string, X4Module> | null>
  waresMap: Ref<Record<string, X4Ware> | null>
  flowMap?: StationProductionFlowMap
}

export interface EmpireFlowFacade {
  stationFlowCache: ComputedRef<Map<string, GroupedFlows>>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
  sectorInternalDataMap: ComputedRef<Map<string, SectorInternalData>>
  sectorLinkCalcMap: ComputedRef<Map<string, SectorLinkCalcEntry>>
  getSupplyPlanningInput: (sectorId: string) => SupplyPlanningInput
  getSectorInternalData: (sectorId: string) => SectorInternalData
  getSectorLinkCalc: (sectorId: string) => SectorLinkCalcEntry | null
  getSectorFinalProductionFlows: (sectorId: string) => WareProductionFlow[]
  getStationComponentGapFlows: (stationId: string | null, activeStationId: string | null) => StationComponentGapFlows
  getTransitHubViewModel: (input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
    buyMultiplier?: number
    sellMultiplier?: number
  }) => TransitHubViewModel
  getStationPanelSource: (input: {
    stationId: string | null
    archiveModules: SavedModule[]
    buildingModules: SavedModule[]
  }) => ProductionPanelSource
  getTransitPanelSource: (input: {
    sectorId: string | null
    archiveModules: SavedModule[]
    buildingModules: SavedModule[]
    hasArchiveTradeStation: boolean
    transitSettings: Partial<StationSettings>
    globalSettings: StationSettings
    mode: 'planning' | 'live'
  }) => ProductionPanelSource
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

  const flowMap = inputFlowMap || stationProductionFlowMap

  const derivedBindingStations = sourceView.derivedBindingStations
  const productionStations = sourceView.productionStations
  const productionSectors = sourceView.productionSectors
  const productionSectorLinks = sourceView.productionSectorLinks
  const sectors = sourceView.sectors
  const sectorLinks = sourceView.sectorLinks
  const orderedStationsBySector = sourceView.orderedStationsBySector

const stationFlowCache = computed<Map<string, GroupedFlows>>(() => {
    const cache = new Map<string, GroupedFlows>()
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
    
    if (!activeEmpire.value || !modulesMap.value) {
      return createEmptyEmpireGroupedFlows()
    }
    
    return analyzeEmpireWareFlow(
      activeEmpire.value.stations,
      (stationId) => {
        const cache = flowMap.getCache(stationId)
        if (!cache) return []
        return cache.productionFlows.filter(f => {
          if (f.netRate <= 0) return true
          return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
        })
      },
      waresMap.value || {}
    )
  })

  const rawSectorGroupedFlowsMap = computed<Map<string, EmpireGroupedFlows>>(() => {
    const map = new Map<string, EmpireGroupedFlows>()
    if (!modulesMap.value || !waresMap.value) return map

    const sectorList = productionSectors.value
    const stations = productionStations.value

    sectorList.forEach((sector) => {
      const localStations = stations.filter((station) => station.sectorId === sector.id)
      const rawGroupedFlows = analyzeEmpireWareFlow(localStations, (stationId) => {
        const cache = flowMap.getCache(stationId)
        if (!cache) return []
        return cache.productionFlows.filter(f => {
          if (f.netRate <= 0) return true
          return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
        })
      }, waresMap.value!)
      map.set(sector.id, rawGroupedFlows)
    })

    return map
  })

  const sectorInternalDataMap = computed<Map<string, SectorInternalData>>(() => {
    const map = new Map<string, SectorInternalData>()
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
          const station = stationMap.get(contribution.stationId)
          if (!station) return

          const staticProduction = Math.max(contribution.netRate, 0)
          const staticConsumption = Math.max(-contribution.netRate, 0)
          const productionStorageVolume = staticProduction * flow.unitVolume * station.settings.primaryProductBufferHours
          const consumptionStorageVolume = staticConsumption * flow.unitVolume * station.settings.resourceBufferHours

          if (productionStorageVolume > 0) {
            details.push({
              stationId: contribution.stationId,
              stationName: contribution.stationName,
              stationCount: contribution.stationCount,
              kind: 'production',
              staticRate: staticProduction,
              storageVolume: productionStorageVolume
            })
            totalProductionStorageVolume += productionStorageVolume
          }

          if (consumptionStorageVolume > 0) {
            details.push({
              stationId: contribution.stationId,
              stationName: contribution.stationName,
              stationCount: contribution.stationCount,
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

  const sectorLinkCalcMap = computed<Map<string, SectorLinkCalcEntry>>(() => {
    const result = new Map<string, SectorLinkCalcEntry>()
    if (!modulesMap.value) return result

    const links: SectorLinkInput[] = productionSectorLinks.value
      .map((key) => parseSectorLinkKey(key))
      .filter((item): item is { a: string; b: string } => !!item)
      .map((item) => ({
        linkId: `${item.a}|${item.b}`,
        a: item.a,
        b: item.b,
        distance: 1
      }))

    const sectorsInput = productionSectors.value.map((sector) => {
      const rawGroupedFlows = rawSectorGroupedFlowsMap.value.get(sector.id) || createEmptyEmpireGroupedFlows()
      const netByWare: Record<string, number> = {}
      rawGroupedFlows.flows
        .filter((flow) => flow.transportType === 'container')
        .forEach((flow) => {
          netByWare[flow.wareId] = Number(flow.netRate || 0)
        })
      return {
        sectorId: sector.id,
        netByWare
      }
    })

    const solverOutput = solveMultiWareByLink({
      sectors: sectorsInput,
      links,
      epsilon: 1e-9
    })

    if (import.meta.env.DEV) {
      const wareIds = Array.from(new Set(
        sectorsInput.flatMap((sectorInput) => Object.keys(sectorInput.netByWare || {}))
      )).sort()
      console.groupCollapsed(`[SectorLinkCalc][TransitHub] mode=global-all-container wares=${wareIds.join(',')}`)
      console.log('[SectorLinkCalc][TransitHub] links', links)
      sectorsInput.forEach((sectorInput) => {
        const relatedFlows = solverOutput.linkWareFlows.filter(
          (flow) => flow.from === sectorInput.sectorId || flow.to === sectorInput.sectorId
        )
        const allocated = solverOutput.allocatedDemandBySector.find((item) => item.sectorId === sectorInput.sectorId)
        const deficit = solverOutput.deficitSummary.deficitByNode.find((item) => item.sectorId === sectorInput.sectorId)
        const producers = solverOutput.deficitSummary.producerNodes.find((item) => item.sectorId === sectorInput.sectorId)
        console.groupCollapsed(`[SectorLinkCalc][TransitHub][Sector] ${sectorInput.sectorId}`)
        console.log('input.netByWare', sectorInput.netByWare)
        console.log('output.linkWareFlows', relatedFlows)
        console.log('output.allocatedDemand', allocated || null)
        console.log('output.deficit', deficit || null)
        console.log('output.producers', producers || null)
        console.groupEnd()
      })
      console.log('[SectorLinkCalc][TransitHub] totalDeficit', solverOutput.deficitSummary.totalDeficit)
      console.groupEnd()
    }

    productionSectors.value.forEach((viewSector) => {
      result.set(viewSector.id, {
        sectorId: viewSector.id,
        sectorsInput,
        solverOutput
      })
    })

    return result
  })

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal.planning
    return {
      sectorId,
      localStationIds: []
    }
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
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

  function getSectorLinkCalc(sectorId: string): SectorLinkCalcEntry | null {
    return sectorLinkCalcMap.value.get(sectorId) || null
  }

  function getSectorFinalProductionFlows(sectorId: string): WareProductionFlow[] {
    const rawGroupedFlows = rawSectorGroupedFlowsMap.value.get(sectorId) || createEmptyEmpireGroupedFlows()
    const sectorLinkCalc = getSectorLinkCalc(sectorId)
    const merged = mergeLinkFlowsIntoGroupedFlows(
      rawGroupedFlows,
      sectorLinkCalc?.solverOutput || { linkWareFlows: [], allocatedDemandBySector: [], deficitSummary: { totalDeficit: 0, deficitByNode: [], producerNodes: [] } },
      sectorId,
      sectors.value,
      waresMap.value || {}
    )
    return merged.flows.map((flow) => ({
      wareId: flow.wareId,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      production: flow.production,
      consumption: flow.consumption,
      workforceConsumption: flow.workforceConsumption,
      netRate: flow.netRate,
      productionVolume: flow.production * flow.unitVolume,
      consumptionVolume: flow.consumption * flow.unitVolume,
      netVolume: flow.netRate * flow.unitVolume,
      contributions: []
    }))
  }

  function getStationComponentGapFlows(stationId: string | null, activeStationId: string | null): StationComponentGapFlows {
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

  function getTransitHubViewModel(input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
    buyMultiplier?: number
    sellMultiplier?: number
  }): TransitHubViewModel {
    if (!input.sectorId) {
      return buildTransitHubViewModel({
        sectorId: null,
        sectors: sectors.value,
        stations: orderedStationsBySector.value,
        localGroupedFlows: createEmptyEmpireGroupedFlows(),
        solverOutput: null,
        waresMap: waresMap.value || undefined,
        modulesMap: modulesMap.value || undefined,
        racePreference: input.racePreference,
        transportShipCapacity: input.transportShipCapacity,
        storageBufferHours: input.storageBufferHours,
        buyMultiplier: input.buyMultiplier,
        sellMultiplier: input.sellMultiplier
      })
    }

    const sectorData = getSectorInternalData(input.sectorId)
    const sectorLinkCalc = getSectorLinkCalc(input.sectorId)

    return buildTransitHubViewModel({
      sectorId: input.sectorId,
      sectors: sectors.value,
      stations: orderedStationsBySector.value,
      localGroupedFlows: sectorData.localGroupedFlows,
      solverOutput: sectorLinkCalc?.solverOutput || null,
      waresMap: waresMap.value || undefined,
      modulesMap: modulesMap.value || undefined,
      racePreference: input.racePreference,
      transportShipCapacity: input.transportShipCapacity,
      storageBufferHours: input.storageBufferHours,
      buyMultiplier: input.buyMultiplier,
      sellMultiplier: input.sellMultiplier
    })
  }

  function getStationPanelSource(input: {
    stationId: string | null
    archiveModules: SavedModule[]
    buildingModules: SavedModule[]
  }): ProductionPanelSource {
    const stationId = input.stationId
    if (!stationId) {
      return {
        id: '',
        entityType: 'station',
        planning: createEmptyProductionPanelModeSource(),
        live: createEmptyProductionPanelModeSource(),
        liveVisualState: 'planning',
        canUseLiveModules: false
      }
    }

    const cache = flowMap.getCache(stationId)
    const station = productionStations.value.find(s => s.id === stationId)

    const planningMode: ProductionPanelModeSource = cache ? {
      modules: station?.modules || [],
      buildingModules: [],
      autoIndustryModules: cache.autoIndustryModules,
      autoHabitationModules: cache.autoHabitationModules,
      autoInfrastructureModules: cache.autoInfrastructureModules,
      productionFlows: cache.productionFlows,
      localGroupedFlows: null,
      solverOutput: null,
      supplyStorageFlows: [],
      storageModulePlans: []
    } : createEmptyProductionPanelModeSource()

    const liveMode: ProductionPanelModeSource = {
      modules: input.archiveModules,
      buildingModules: input.buildingModules,
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: [],
      productionFlows: flowMap.getProductionFlows(stationId),
      localGroupedFlows: null,
      solverOutput: null,
      supplyStorageFlows: [],
      storageModulePlans: []
    }

    return {
      id: stationId,
      entityType: 'station',
      planning: planningMode,
      live: liveMode,
      liveVisualState: 'planning',
      canUseLiveModules: input.archiveModules.length > 0
    }
  }

  function getTransitPanelSource(input: {
    sectorId: string | null
    archiveModules: SavedModule[]
    buildingModules: SavedModule[]
    hasArchiveTradeStation: boolean
    transitSettings: Partial<StationSettings>
    globalSettings: StationSettings
    mode: 'planning' | 'live'
  }): ProductionPanelSource {
    const sectorId = input.sectorId
    if (!sectorId) {
      return {
        id: '',
        entityType: 'transit',
        planning: createEmptyProductionPanelModeSource(),
        live: createEmptyProductionPanelModeSource(),
        liveVisualState: 'planning',
        canUseLiveModules: false
      }
    }

    const sectorData = getSectorInternalData(sectorId)
    const sectorLinkCalc = getSectorLinkCalc(sectorId)
    const sectorAggregation = flowMap.getSectorAggregation(sectorId)

    const effectiveSettings = {
      racePreference: input.transitSettings.racePreference ?? input.globalSettings.racePreference,
      resourceBufferHours: input.transitSettings.resourceBufferHours ?? input.globalSettings.resourceBufferHours,
      primaryProductBufferHours: input.transitSettings.primaryProductBufferHours ?? input.globalSettings.primaryProductBufferHours,
      secondaryProductBufferHours: input.transitSettings.secondaryProductBufferHours ?? input.globalSettings.secondaryProductBufferHours,
      transportShipCapacity: input.transitSettings.transportShipCapacity ?? input.globalSettings.transportShipCapacity,
      buyMultiplier: input.transitSettings.buyMultiplier ?? input.globalSettings.buyMultiplier,
      sellMultiplier: input.transitSettings.sellMultiplier ?? input.globalSettings.sellMultiplier
    }

    const mergedGroupedFlows = mergeLinkFlowsIntoGroupedFlows(
      sectorData.localGroupedFlows,
      sectorLinkCalc?.solverOutput || { linkWareFlows: [], allocatedDemandBySector: [], deficitSummary: { totalDeficit: 0, deficitByNode: [], producerNodes: [] } },
      sectorId,
      sectors.value,
      waresMap.value || {}
    )

    const storageFlows = buildTransitHubStorageFlows({
      sectorId,
      sectors: sectors.value,
      stations: orderedStationsBySector.value,
      groupedFlows: mergedGroupedFlows,
      storageBufferHours: effectiveSettings.primaryProductBufferHours
    })

    const storageModulePlans = buildTransitHubStorageModulePlans({
      storageFlows,
      modulesMap: modulesMap.value || {},
      racePreference: effectiveSettings.racePreference,
      transportShipCapacity: effectiveSettings.transportShipCapacity
    })

    const autoInfrastructureModules = sectorAggregation?.autoInfrastructureModules || flowMap.getSectorAutoInfrastructureModules(sectorId)

    const planningMode: ProductionPanelModeSource = {
      modules: autoInfrastructureModules,
      buildingModules: [],
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: autoInfrastructureModules,
      productionFlows: [],
      localGroupedFlows: sectorData.localGroupedFlows,
      solverOutput: sectorLinkCalc?.solverOutput || null,
      supplyStorageFlows: storageFlows,
      storageModulePlans: storageModulePlans
    }

    const liveMode: ProductionPanelModeSource = input.hasArchiveTradeStation ? {
      modules: input.archiveModules,
      buildingModules: input.buildingModules,
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: [],
      productionFlows: [],
      localGroupedFlows: sectorData.localGroupedFlows,
      solverOutput: sectorLinkCalc?.solverOutput || null,
      supplyStorageFlows: [],
      storageModulePlans: []
    } : {
      modules: planningMode.modules,
      buildingModules: [],
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: planningMode.autoInfrastructureModules,
      productionFlows: [],
      localGroupedFlows: sectorData.localGroupedFlows,
      solverOutput: sectorLinkCalc?.solverOutput || null,
      supplyStorageFlows: planningMode.supplyStorageFlows,
      storageModulePlans: []
    }

    const liveVisualState: 'planning' | 'live' = input.mode === 'planning'
      ? 'planning'
      : input.hasArchiveTradeStation
        ? 'live'
        : 'planning'

    return {
      id: sectorId,
      entityType: 'transit',
      planning: planningMode,
      live: liveMode,
      liveVisualState,
      canUseLiveModules: input.hasArchiveTradeStation
    }
  }

  return {
    stationFlowCache,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getSectorFinalProductionFlows,
    getStationComponentGapFlows,
    getTransitHubViewModel,
    getStationPanelSource,
    getTransitPanelSource
  }
}
