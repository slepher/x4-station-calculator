import { reactive } from 'vue'
import type { GroupedFlows, SavedModule, StationPlan, StationSettings, X4Module, WareFlow, EmpirePlan } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { WorkforceEntry } from '@/types/saveArchive'
import { calculateProductionFlows, calculateProductionFlowsCore } from '@/store/logic/calculateProductionFlows'
import { calculateInfrastructureModules } from '@/store/logic/calculateInfrastructureModules'
import { buildResolvedWarePriority } from '@/store/logic/warePriorityResolver'

export interface ProductionFlowComputeDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, any>
  medicalConsumptionMap: Record<string, any>
  buildPriceMultiplier?: number
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export interface StationSemanticDerived {
  tag?: string
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

export interface StationDerivedCache {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  actualWorkforce: number
  currentEfficiency: number
  semantics?: StationSemanticDerived
}

export interface ProductionFlowInput {
  plannedModules: SavedModule[]
  settings: StationSettings
  lockedWares: string[]
  warePriority: Record<string, number>
  skipAutoFill?: boolean
  workforceOverride?: WorkforceEntry[]
  actualWorkforceOverride?: number
  saturationOverride?: number
}

export interface ComputeInfrastructureModulesInput {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  settings: Pick<
    StationSettings,
    | 'racePreference'
    | 'resourceBufferHours'
    | 'primaryProductBufferHours'
    | 'secondaryProductBufferHours'
    | 'transportShipCapacity'
  >
  warePriorityLevels: Record<string, number>
  deps: ProductionFlowComputeDeps
}

export interface DeriveInfrastructureModulesInput extends ComputeInfrastructureModulesInput {}

export function computeInfrastructureModulesFromFlows(input: ComputeInfrastructureModulesInput): SavedModule[] {
  return calculateInfrastructureModules({
    productionFlows: input.productionFlows,
    plannedModules: input.plannedModules,
    autoIndustryModules: input.autoIndustryModules,
    modulesMap: input.deps.modulesMap,
    settings: input.settings,
    warePriorityLevels: input.warePriorityLevels
  })
}

export function deriveInfrastructureModules(input: DeriveInfrastructureModulesInput): SavedModule[] {
  return computeInfrastructureModulesFromFlows(input)
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
  const productionVolume = prod.production * prod.unitVolume
  const consumptionVolume = prod.consumption * prod.unitVolume
  const netVolume = prod.netRate * prod.unitVolume

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
    productionVolume,
    consumptionVolume,
    netVolume,
    transportDemand: 0,
    totalOccupiedCount: 0,
    totalOccupiedConsumptionCount: 0,
    totalOccupiedVolume: 0,
    unitPrice: 0,
    netValue: 0,
    contributions: prod.contributions.map((atom) => ({
      moduleId: atom.moduleId,
      count: atom.count,
      type: atom.type,
      amount: atom.amount,
      bonusPercent: atom.bonusPercent,
      volumeFlow: atom.amount * prod.unitVolume,
      valueFlow: 0,
      transportFlow: 0
    }))
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
          production: 0,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 0,
          contributions: []
        }
        mergedMap[flow.wareId] = entry
      }
      const currentEntry = entry
      currentEntry.production += flow.production
      currentEntry.consumption += flow.consumption
      currentEntry.workforceConsumption += flow.workforceConsumption
      currentEntry.netRate += flow.netRate
      currentEntry.contributions.push(...deepClone(flow.contributions))
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

function groupBySectorFiltered(
  cacheMap: Map<string, StationDerivedCache>,
  stations: StationPlan[]
): Map<string, WareProductionFlow[]> {
  const sectorMap = new Map<string, WareProductionFlow[]>()

  for (const station of stations) {
    const sectorId = station.sectorId || '__no_sector__'
    const cache = cacheMap.get(station.id)
    if (!cache) continue
    
    const filteredFlows = filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)
    
    if (!sectorMap.has(sectorId)) {
      sectorMap.set(sectorId, [])
    }
    
    const existing = sectorMap.get(sectorId)!
    sectorMap.set(sectorId, mergeFlows([existing, filteredFlows]))
  }

  return sectorMap
}

export class StationDerivedMap {
  private cacheMap = reactive(new Map<string, StationDerivedCache>())
  private empireFlowsCache: WareProductionFlow[] = []
  private sectorFlowsCache: Map<string, WareProductionFlow[]> = new Map()

  compute(stationId: string, input: ProductionFlowInput, deps: ProductionFlowComputeDeps): void {
    let autoIndustryModules: SavedModule[] = []
    let autoHabitationModules: SavedModule[] = []
    let productionFlows: WareProductionFlow[]
    let actualWorkforce: number
    let currentEfficiency: number

    if (input.skipAutoFill) {
      const coreResult = calculateProductionFlowsCore({
        plannedModules: input.plannedModules,
        autoIndustryModules: [],
        autoHabitationModules: [],
        modulesMap: deps.modulesMap,
        waresMap: deps.waresMap,
        medicalConsumptionMap: deps.medicalConsumptionMap,
        settings: input.settings,
        warePriority: input.warePriority,
        workforceOverride: input.workforceOverride,
        actualWorkforceOverride: input.actualWorkforceOverride,
        saturationOverride: input.saturationOverride
      })
      productionFlows = coreResult.productionFlows
      actualWorkforce = coreResult.actualWorkforce
      currentEfficiency = coreResult.currentEfficiency
    } else {
      const result = calculateProductionFlows({
        plannedModules: input.plannedModules,
        settings: input.settings,
        modulesMap: deps.modulesMap,
        waresMap: deps.waresMap,
        lockedWares: input.lockedWares,
        medicalConsumptionMap: deps.medicalConsumptionMap,
        warePriority: input.warePriority
      })
      autoIndustryModules = result.autoIndustryModules
      autoHabitationModules = result.autoHabitationModules
      productionFlows = result.productionFlows
      actualWorkforce = result.actualWorkforce
      currentEfficiency = result.currentEfficiency
    }

    const allWareIds = productionFlows.map(f => f.wareId)
    const warePriorityLevels = buildResolvedWarePriority({
      plannedModules: input.plannedModules,
      autoIndustryModules,
      modulesMap: deps.modulesMap,
      userPriorityOverride: input.warePriority || {}
    }, allWareIds)
    
    this.cacheMap.set(stationId, {
      autoIndustryModules,
      autoHabitationModules,
      productionFlows,
      warePriorityLevels,
      actualWorkforce,
      currentEfficiency
    })
  }

  computeAll(empire: EmpirePlan, deps: ProductionFlowComputeDeps): void {
    this.cacheMap.clear()
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
    const allFilteredFlows = stations.map(station => {
      const cache = this.cacheMap.get(station.id)
      if (!cache) return []
      return filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)
    })
    this.empireFlowsCache = mergeFlows(allFilteredFlows)
    this.sectorFlowsCache = groupBySectorFiltered(this.cacheMap, stations)
  }

  getCache(stationId: string): StationDerivedCache | null {
    return this.cacheMap.get(stationId) || null
  }

  getAutoIndustryModules(stationId: string): SavedModule[] {
    return this.cacheMap.get(stationId)?.autoIndustryModules || []
  }

  getAutoHabitationModules(stationId: string): SavedModule[] {
    return this.cacheMap.get(stationId)?.autoHabitationModules || []
  }

  getProductionFlows(stationId: string): WareProductionFlow[] {
    return this.cacheMap.get(stationId)?.productionFlows || []
  }

  getSectorFlows(sectorId: string): WareProductionFlow[] {
    return this.sectorFlowsCache.get(sectorId) || []
  }

  getEmpireFlows(): WareProductionFlow[] {
    return this.empireFlowsCache
  }

  getGrouped(stationId: string): GroupedFlows {
    const flows = this.getProductionFlows(stationId)
    if (flows.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(flows)
  }

  getFilteredGrouped(stationId: string, priorityLevels: Record<string, number>): GroupedFlows {
    const flows = this.getProductionFlows(stationId)
    const filtered = filterProductionFlowsByPriority(flows, priorityLevels)
    if (filtered.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(filtered)
  }

  remove(stationId: string): void {
    this.cacheMap.delete(stationId)
  }

  setSemantics(stationId: string, semantics: StationSemanticDerived): void {
    const cache = this.cacheMap.get(stationId)
    if (!cache) return
    this.cacheMap.set(stationId, { ...cache, semantics })
  }

  clear(): void {
    this.cacheMap.clear()
    this.sectorFlowsCache.clear()
    this.empireFlowsCache = []
  }
}

export const planningDerivedMap = new StationDerivedMap()

export function updateDerivedAggregation(stations: StationPlan[]): void {
  planningDerivedMap.updateAggregation(stations)
}
