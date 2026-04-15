import { reactive } from 'vue'
import type { GroupedFlows, SavedModule, StationPlan, StationSettings, X4Module, X4Ware, WareFlow, EmpirePlan } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { calculateProductionFlows } from '@/store/logic/calculateProductionFlows'

export interface ProductionFlowComputeDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier?: number
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export interface ProductionFlowInput {
  plannedModules: SavedModule[]
  settings: StationSettings
  lockedWares: string[]
  warePriority: Record<string, number>
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

function filterProductionFlowsByPriority(
  flows: WareProductionFlow[],
  priorityLevels: Record<string, number>
): WareProductionFlow[] {
  return flows.filter(f => {
    if (f.netRate <= 0) return true
    return (priorityLevels[f.wareId] ?? 0) > 0
  })
}

function convertProductionFlowToWareFlow(prod: WareProductionFlow): WareFlow {
  return {
    wareId: prod.wareId,
    orderIndex: prod.orderIndex,
    tier: prod.tier,
    transportType: prod.transportType,
    unitVolume: prod.unitVolume,
    production: prod.production,
    consumption: prod.consumption,
    workforceConsumption: prod.workforceConsumption,
    netRate: prod.netRate,
    productionVolume: 0,
    consumptionVolume: 0,
    netVolume: 0,
    transportDemand: 0,
    totalOccupiedCount: 0,
    totalOccupiedConsumptionCount: 0,
    totalOccupiedVolume: 0,
    unitPrice: prod.price,
    netValue: prod.netRate * prod.price,
    contributions: prod.contributions
  }
}

function groupProductionFlows(flows: WareProductionFlow[]): GroupedFlows {
  const wareFlows = flows.map(convertProductionFlowToWareFlow)

  const result: GroupedFlows = {
    flows: wareFlows,
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }

  wareFlows.forEach(flow => {
    if (flow.netRate > 0) result.rateGroups.positive.push(flow)
    else if (flow.workforceConsumption > 0) result.rateGroups.supply.push(flow)
    else if (flow.transportType === 'container') result.rateGroups.operations.push(flow)
    else result.rateGroups.resources.push(flow)

    if (flow.transportType === 'solid') result.volumeGroups.solid.push(flow)
    else if (flow.transportType === 'liquid') result.volumeGroups.liquid.push(flow)
    else result.volumeGroups.container.push(flow)
  })

  return result
}

function mergeFlows(flowsArray: WareProductionFlow[][]): WareProductionFlow[] {
  const mergedMap: Record<string, WareProductionFlow> = {}

  for (const flows of flowsArray) {
    for (const flow of flows) {
      let entry = mergedMap[flow.wareId]
      if (!entry) {
        entry = {
          wareId: flow.wareId,
          orderIndex: flow.orderIndex,
          tier: flow.tier,
          transportType: flow.transportType,
          unitVolume: flow.unitVolume,
          minPrice: flow.minPrice,
          price: flow.price,
          maxPrice: flow.maxPrice,
          production: 0,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 0,
          contributions: []
        }
        mergedMap[flow.wareId] = entry
      }
      entry.production += flow.production
      entry.consumption += flow.consumption
      entry.workforceConsumption += flow.workforceConsumption
      entry.netRate += flow.netRate
      entry.contributions.push(...deepClone(flow.contributions))
    }
  }

  const merged = Object.values(mergedMap)
  merged.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  return merged
}

function groupBySector(
  flowsMap: Map<string, WareProductionFlow[]>,
  stations: StationPlan[]
): Map<string, WareProductionFlow[]> {
  const sectorMap = new Map<string, WareProductionFlow[]>()

  for (const station of stations) {
    const sectorId = station.sectorId || '__no_sector__'
    const flows = flowsMap.get(station.id) || []
    
    if (!sectorMap.has(sectorId)) {
      sectorMap.set(sectorId, [])
    }
    
    const existing = sectorMap.get(sectorId)!
    sectorMap.set(sectorId, mergeFlows([existing, flows]))
  }

  return sectorMap
}

export class StationProductionFlowMap {
  private flowsMap = reactive(new Map<string, WareProductionFlow[]>())
  private empireFlowsCache: WareProductionFlow[] = []
  private sectorFlowsCache: Map<string, WareProductionFlow[]> = new Map()

  compute(stationId: string, input: ProductionFlowInput, deps: ProductionFlowComputeDeps): void {
    const result = calculateProductionFlows({
      plannedModules: input.plannedModules,
      settings: input.settings,
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      lockedWares: input.lockedWares,
      medicalConsumptionMap: deps.medicalConsumptionMap,
      warePriority: input.warePriority
    })

    this.flowsMap.set(stationId, result.productionFlows)
  }

  computeAll(empire: EmpirePlan, deps: ProductionFlowComputeDeps): void {
    this.flowsMap.clear()
    this.sectorFlowsCache.clear()
    this.empireFlowsCache = []

    for (const station of empire.stations) {
      this.compute(station.id, {
        plannedModules: station.modules || [],
        settings: station.settings,
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
    }

    this.updateAggregation(empire.stations)
  }

  updateAggregation(stations: StationPlan[]): void {
    const allFlows = Array.from(this.flowsMap.values())
    this.empireFlowsCache = mergeFlows(allFlows)
    this.sectorFlowsCache = groupBySector(this.flowsMap, stations)
  }

  getStationFlows(stationId: string): WareProductionFlow[] {
    return this.flowsMap.get(stationId) || []
  }

  getSectorFlows(sectorId: string): WareProductionFlow[] {
    return this.sectorFlowsCache.get(sectorId) || []
  }

  getEmpireFlows(): WareProductionFlow[] {
    return this.empireFlowsCache
  }

  getGrouped(stationId: string): GroupedFlows {
    const flows = this.getStationFlows(stationId)
    if (flows.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(flows)
  }

  getFilteredGrouped(stationId: string, priorityLevels: Record<string, number>): GroupedFlows {
    const flows = this.getStationFlows(stationId)
    const filtered = filterProductionFlowsByPriority(flows, priorityLevels)
    if (filtered.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(filtered)
  }

  remove(stationId: string): void {
    this.flowsMap.delete(stationId)
  }

  clear(): void {
    this.flowsMap.clear()
    this.sectorFlowsCache.clear()
    this.empireFlowsCache = []
  }
}

export const stationProductionFlowMap = new StationProductionFlowMap()

export function updateProductionFlowAggregation(stations: StationPlan[]): void {
  stationProductionFlowMap.updateAggregation(stations)
}