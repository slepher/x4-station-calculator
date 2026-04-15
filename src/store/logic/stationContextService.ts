import type { StationPlan, SavedModule, StationSettings, X4Module, X4Ware, GroupedFlows, EmpirePlan } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { StationAnalysis } from '@/store/logic/analyzeStation'
import {
  stationProductionFlowMap,
  type ProductionFlowComputeDeps,
  updateProductionFlowAggregation
} from '@/store/state/StationProductionFlowMap'
import { calculateWorkforceBreakdown, calculateActualWorkforce, calculateEfficiencySaturation } from '@/store/logic/workforceCalculator'
import { buildResolvedWarePriority } from '@/store/logic/warePriorityResolver'
import { analyzeStation } from '@/store/logic/analyzeStation'

export interface ActiveStationContext {
  stationId: string | null
  station: StationPlan | null
  
  plannedModules: SavedModule[]
  settings: StationSettings
  lockedWares: string[]
  warePriority: Record<string, number>
  
  resolvedModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  
  stationAnalysis: StationAnalysis | null
  actualWorkforce: number
  currentEfficiency: number
  warePriorityLevels: Record<string, number>
  
  groupedFlows: GroupedFlows
}

function createEmptyContext(): ActiveStationContext {
  return {
    stationId: null,
    station: null,
    plannedModules: [],
    settings: {
      sunlight: 100,
      useHQ: false,
      manualWorkforce: 0,
      workforcePercent: 100,
      workforceAuto: true,
      considerWorkforceForAutoFill: false,
      supplyWorkforceBonus: false,
      buyMultiplier: 0.5,
      sellMultiplier: 0.5,
      minersEnabled: false,
      internalSupply: false,
      showEmpireGaps: false,
      racePreference: 'argon',
      resourceBufferHours: 1.0,
      primaryProductBufferHours: 12.0,
      secondaryProductBufferHours: 2.0,
      transportMinutes: 30,
      transportShipCapacity: 62000
    },
    lockedWares: [],
    warePriority: {},
    resolvedModules: [],
    productionFlows: [],
    autoIndustryModules: [],
    autoInfrastructureModules: [],
    stationAnalysis: null,
    actualWorkforce: 0,
    currentEfficiency: 0,
    warePriorityLevels: {},
    groupedFlows: {
      flows: [],
      rateGroups: { positive: [], operations: [], supply: [], resources: [] },
      volumeGroups: { solid: [], liquid: [], container: [] }
    }
  }
}

export function getActiveStationContext(
  station: StationPlan | null,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): ActiveStationContext {
  if (!station) return createEmptyContext()
  
  const cache = stationProductionFlowMap.getCache(station.id)
  if (!cache) {
    return {
      ...createEmptyContext(),
      stationId: station.id,
      station,
      plannedModules: station.modules || [],
      settings: station.settings,
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }
  }
  
  const plannedModules = station.modules || []
  const settings = station.settings
  const autoIndustryModules = cache.resolvedModules.filter(m => 
    !plannedModules.some(p => p.id === m.id)
  )
  
  const workforceBreakdown = calculateWorkforceBreakdown(cache.resolvedModules, modulesMap, settings)
  const actualWorkforce = calculateActualWorkforce(workforceBreakdown, settings)
  const currentEfficiency = calculateEfficiencySaturation(workforceBreakdown.needed.total, actualWorkforce)
  
  const warePriorityLevels = buildResolvedWarePriority(
    {
      plannedModules,
      autoIndustryModules,
      modulesMap,
      userPriorityOverride: station.warePriority || {}
    },
    Object.keys(waresMap)
  )
  
  const allModules = [...cache.resolvedModules]
  const stationAnalysis = analyzeStation(
    allModules,
    modulesMap,
    waresMap,
    0.5,
    settings.useHQ
  )
  
  return {
    stationId: station.id,
    station,
    plannedModules,
    settings,
    lockedWares: station.lockedWares || [],
    warePriority: station.warePriority || {},
    resolvedModules: cache.resolvedModules,
    productionFlows: cache.productionFlows,
    autoIndustryModules,
    autoInfrastructureModules: [],
    stationAnalysis,
    actualWorkforce,
    currentEfficiency,
    warePriorityLevels,
    groupedFlows: stationProductionFlowMap.getGrouped(station.id)
  }
}

export function computeStationFlowCache(
  stationId: string,
  input: {
    plannedModules: SavedModule[]
    settings: StationSettings
    lockedWares: string[]
    warePriority: Record<string, number>
  },
  deps: ProductionFlowComputeDeps
): void {
  stationProductionFlowMap.compute(stationId, input, deps)
}

export function computeAllStationFlowCaches(
  empire: EmpirePlan,
  deps: ProductionFlowComputeDeps
): void {
  stationProductionFlowMap.computeAll(empire, deps)
}

export function clearStationFlowCache(stationId: string): void {
  stationProductionFlowMap.remove(stationId)
}

export function getEmpireFlows(): WareProductionFlow[] {
  return stationProductionFlowMap.getEmpireFlows()
}

export function getSectorFlows(sectorId: string): WareProductionFlow[] {
  return stationProductionFlowMap.getSectorFlows(sectorId)
}

export function updateAggregationAfterCompute(empireOrStations: EmpirePlan | StationPlan[]): void {
  const stations = Array.isArray(empireOrStations) ? empireOrStations : empireOrStations.stations
  updateProductionFlowAggregation(stations)
}

export const stationContextService = {
  getActiveStationContext,
  computeStationFlowCache,
  computeAllStationFlowCaches,
  clearStationFlowCache,
  getEmpireFlows,
  getSectorFlows,
  updateAggregationAfterCompute
}