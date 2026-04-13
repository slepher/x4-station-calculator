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
  X4Module,
  X4Ware,
  RaceMedicalConsumption
} from '@/types/x4'
import type { SaveArchive } from '@/types/saveArchive'
import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { solveMultiWareByLink, type SectorLinkInput, type SolveMultiWareByLinkOutput } from './sectorLinkFlow'
import { buildTransitHubViewModel } from './transitHubViewModel'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './stationGapViewModel'
import { buildSaveBindingProductionFlows, type SaveBindingProductionDeps } from './productionSourceAdapter'
import { getFilteredGroupedFlows } from './stationComputeService'
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
  selectedArchive: Ref<SaveArchive | null>
  sourceView: EmpireSourceView
  modulesMap: Ref<Record<string, X4Module> | null>
  waresMap: Ref<Record<string, X4Ware> | null>
  medicalConsumptionMap: Ref<RaceMedicalConsumption | null>
  enforceDlcActivation: Ref<boolean>
  isModuleDlcActive: (moduleId: string) => boolean
}

export interface EmpireFlowFacade {
  stationFlowCache: ComputedRef<Map<string, GroupedFlows>>
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
  sectorInternalDataMap: ComputedRef<Map<string, SectorInternalData>>
  sectorLinkCalcMap: ComputedRef<Map<string, SectorLinkCalcEntry>>
  getSupplyPlanningInput: (sectorId: string) => SupplyPlanningInput
  getSectorInternalData: (sectorId: string) => SectorInternalData
  getSectorLinkCalc: (sectorId: string) => SectorLinkCalcEntry | null
  getStationComponentGapFlows: (stationId: string | null, activeStationId: string | null) => StationComponentGapFlows
  getTransitHubViewModel: (input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
    buyMultiplier?: number
    sellMultiplier?: number
  }) => TransitHubViewModel
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
    selectedArchive,
    sourceView,
    modulesMap,
    waresMap,
    medicalConsumptionMap,
    enforceDlcActivation,
    isModuleDlcActive
  } = deps

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
        cache.set(item.station.id, getFilteredGroupedFlows(item.station.id))
      })
      return cache
    }
    if (!activeEmpire.value) return cache
    activeEmpire.value.stations.forEach(station => {
      cache.set(station.id, getFilteredGroupedFlows(station.id))
    })
    return cache
  })

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    if (productionSource.value === 'save-binding') {
      const binding = activeBinding.value
      const saveBindingDeps: SaveBindingProductionDeps = {
        modulesMap: modulesMap.value!,
        waresMap: waresMap.value!,
        medicalConsumptionMap: medicalConsumptionMap.value!,
        enforceDlcActivation: enforceDlcActivation.value,
        isModuleDlcActive,
        archive: selectedArchive.value
      }
      return buildSaveBindingProductionFlows(binding, saveBindingDeps).groupedFlows
    }
    
    if (!activeEmpire.value || !modulesMap.value) {
      return createEmptyEmpireGroupedFlows()
    }
    
    return analyzeEmpireWareFlow(
      activeEmpire.value.stations,
      (stationId) => getFilteredGroupedFlows(stationId)
    )
  })

  const rawSectorGroupedFlowsMap = computed<Map<string, EmpireGroupedFlows>>(() => {
    const map = new Map<string, EmpireGroupedFlows>()
    if (!modulesMap.value) return map

    const sectorList = productionSectors.value
    const stations = productionStations.value

    sectorList.forEach((sector) => {
      const localStations = stations.filter((station) => station.sectorId === sector.id)
      const rawGroupedFlows = analyzeEmpireWareFlow(localStations, (stationId) => getFilteredGroupedFlows(stationId))
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
        supplyStorageFlows: buildSupplyStorageFlows(rawGroupedFlows)
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
      supplyStorageFlows: createEmptySupplyStorageFlows()
    }
  }

  function getSectorLinkCalc(sectorId: string): SectorLinkCalcEntry | null {
    return sectorLinkCalcMap.value.get(sectorId) || null
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

  return {
    stationFlowCache,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    getTransitHubViewModel
  }
}