import { computed, type Ref, type ComputedRef } from 'vue'
import type {
  EmpirePlan,
  SaveBindingPlan,
  GroupedFlows,
  EmpireGroupedFlows,
  SectorInternalData,
  SupplyStorageFlow,
  SupplyPlanningInput,
  X4Module,
  X4Ware
} from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { solveMultiWareByLink, type SectorLinkInput, type SolveMultiWareByLinkOutput } from './sectorLinkFlow'
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

function createEmptySolverOutput(): SolveMultiWareByLinkOutput {
  return {
    linkWareFlows: [],
    allocatedDemandBySector: [],
    deficitSummary: {
      totalDeficit: 0,
      deficitByNode: [],
      producerNodes: []
    }
  }
}

function mergeSectorLinkIntoEmpireGroupedFlows(
  groupedFlows: EmpireGroupedFlows,
  solverOutput: SolveMultiWareByLinkOutput | null,
  sectorId: string,
  sectors: { id: string; name: string }[],
  waresMap: Record<string, X4Ware>
): EmpireGroupedFlows {
  const safeSolverOutput = solverOutput || createEmptySolverOutput()
  const sectorNameMap = new Map(sectors.map((sector) => [sector.id, sector.name]))
  const pendingFlowsByWareId = new Map<string, EmpireGroupedFlows['flows'][number]>()

  groupedFlows.flows.forEach((flow) => {
    pendingFlowsByWareId.set(flow.wareId, {
      ...flow,
      contributions: (flow.contributions || []).map((contrib) => ({ ...contrib }))
    })
  })

  safeSolverOutput.linkWareFlows.forEach((linkFlow) => {
    const isFromHere = linkFlow.from === sectorId
    const isToHere = linkFlow.to === sectorId
    if (!isFromHere && !isToHere) return

    const peerSectorId = isFromHere ? linkFlow.to : linkFlow.from
    const peerSectorName = sectorNameMap.get(peerSectorId) || peerSectorId
    const amount = Math.abs(linkFlow.amount || 0)
    const contribution = {
      stationId: `external:${peerSectorId}`,
      stationName: peerSectorName,
      stationCount: 1,
      production: isToHere ? amount : 0,
      consumption: isFromHere ? amount : 0,
      workforceConsumption: 0,
      netRate: isToHere ? amount : -amount
    }

    const existingFlow = pendingFlowsByWareId.get(linkFlow.wareId)
    if (existingFlow) {
      existingFlow.contributions.push(contribution)
      existingFlow.production += contribution.production
      existingFlow.consumption += contribution.consumption
      existingFlow.netRate += contribution.netRate
      return
    }

    const ware = waresMap[linkFlow.wareId]
    pendingFlowsByWareId.set(linkFlow.wareId, {
      wareId: linkFlow.wareId,
      orderIndex: Number.MAX_SAFE_INTEGER,
      tier: ware?.tier || 0,
      transportType: ware?.transport || 'container',
      unitVolume: ware?.volume || 1,
      production: contribution.production,
      consumption: contribution.consumption,
      workforceConsumption: 0,
      netRate: contribution.netRate,
      minPrice: ware?.minPrice || 0,
      avgPrice: ware?.price || 0,
      maxPrice: ware?.maxPrice || 0,
      contributions: [contribution]
    })
  })

  const flows = Array.from(pendingFlowsByWareId.values()).sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
  const operations = flows.filter((flow) => flow.transportType === 'container' && flow.workforceConsumption <= 0)
  const supply = flows.filter((flow) => flow.workforceConsumption > 0 || flow.transportType !== 'container')
  return { flows, empireGroups: { operations, supply } }
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
    const merged = mergeSectorLinkIntoEmpireGroupedFlows(
      rawGroupedFlows,
      sectorLinkCalc?.solverOutput || createEmptySolverOutput(),
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
      contributions: [],
      stationContributions: flow.contributions.map((contrib) => ({ ...contrib }))
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

  return {
    stationFlowCache,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getSectorFinalProductionFlows,
    getStationComponentGapFlows
  }
}
