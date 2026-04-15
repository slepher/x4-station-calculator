import type { StationPlan, SavedModule, StationSettings, X4Module, X4Ware, GroupedFlows, EmpirePlan } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { StationAnalysis } from '@/store/logic/analyzeStation'
import {
  stationStateMap,
  DEFAULT_STATION_SETTINGS,
  migrateStationSettings,
  type StationComputeDeps
} from '@/store/state/StationStateMap'
import {
  stationProductionFlowMap,
  type ProductionFlowComputeDeps,
  updateProductionFlowAggregation
} from '@/store/state/StationProductionFlowMap'
import { calculateWareFlowDerived } from '@/store/logic/calculateWareFlowDerived'

export interface ActiveStationState {
  stationAnalysis: StationAnalysis | null
  actualWorkforce: number
  currentEfficiency: number
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  warePriorityLevels: Record<string, number>
  productionFlows: WareProductionFlow[]
  groupedFlows: GroupedFlows
}

function createEmptyActiveStationState(): ActiveStationState {
  return {
    stationAnalysis: null,
    actualWorkforce: 0,
    currentEfficiency: 0,
    autoIndustryModules: [],
    autoInfrastructureModules: [],
    warePriorityLevels: {},
    productionFlows: [],
    groupedFlows: {
      flows: [],
      rateGroups: { positive: [], operations: [], supply: [], resources: [] },
      volumeGroups: { solid: [], liquid: [], container: [] }
    }
  }
}

export function getActiveStationState(stationId: string | null): ActiveStationState {
  if (!stationId) return createEmptyActiveStationState()
  
  const state = stationStateMap.get(stationId)
  const cache = stationProductionFlowMap.getCache(stationId)
  
  if (!state || !cache) return createEmptyActiveStationState()
  
  return {
    stationAnalysis: state.stationAnalysis || null,
    actualWorkforce: state.actualWorkforce || 0,
    currentEfficiency: state.currentEfficiency || 0,
    autoIndustryModules: cache.resolvedModules.filter(m => {
      const isPlanned = state.plannedModules.some(p => p.id === m.id)
      return !isPlanned
    }),
    autoInfrastructureModules: state.autoInfrastructureModules || [],
    warePriorityLevels: state.warePriorityLevels || {},
    productionFlows: cache.productionFlows,
    groupedFlows: stationProductionFlowMap.getGrouped(stationId)
  }
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export interface StationComputeServiceDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier?: number
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export function buildStationComputeDeps(gameData: {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier?: number
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}): StationComputeDeps {
  return {
    modulesMap: gameData.modulesMap,
    waresMap: gameData.waresMap,
    medicalConsumptionMap: gameData.medicalConsumptionMap,
    buildPriceMultiplier: gameData.buildPriceMultiplier ?? 0.5,
    enforceDlcActivation: gameData.enforceDlcActivation,
    isModuleDlcActive: gameData.isModuleDlcActive
  }
}

function toProductionFlowDeps(deps: StationComputeDeps): ProductionFlowComputeDeps {
  return {
    modulesMap: deps.modulesMap,
    waresMap: deps.waresMap,
    medicalConsumptionMap: deps.medicalConsumptionMap,
    buildPriceMultiplier: deps.buildPriceMultiplier,
    enforceDlcActivation: deps.enforceDlcActivation,
    isModuleDlcActive: deps.isModuleDlcActive
  }
}

export function syncPersistedToStateMap(stationId: string, station: StationPlan): void {
  station.settings = migrateStationSettings(station.settings)
  stationStateMap.fromPersisted(stationId, station)
}

export function recomputeStation(stationId: string, deps: StationComputeDeps): void {
  stationStateMap.recompute(stationId, deps)
  const state = stationStateMap.get(stationId)
  if (state) {
    stationProductionFlowMap.compute(stationId, {
      plannedModules: state.plannedModules,
      settings: state.settings,
      lockedWares: state.lockedWares,
      warePriority: state.warePriority
    }, toProductionFlowDeps(deps))
  }
}

export function computeAllProductionFlows(empire: EmpirePlan, deps: StationComputeDeps): void {
  stationProductionFlowMap.computeAll(empire, toProductionFlowDeps(deps))
}

export function getEmpireFlows(): WareProductionFlow[] {
  return stationProductionFlowMap.getEmpireFlows()
}

export function getSectorFlows(sectorId: string): WareProductionFlow[] {
  return stationProductionFlowMap.getSectorFlows(sectorId)
}

export function syncStateMapToPersisted(stationId: string): Pick<StationPlan, 'modules' | 'lockedWares' | 'warePriority' | 'settings'> | null {
  return stationStateMap.toPersisted(stationId)
}

export function getGroupedFlows(stationId: string): GroupedFlows {
  return stationProductionFlowMap.getGrouped(stationId)
}

export function getFilteredGroupedFlows(stationId: string): GroupedFlows {
  const priorityLevels = stationStateMap.getWarePriorityLevels(stationId)
  return stationProductionFlowMap.getFilteredGrouped(stationId, priorityLevels)
}

export function getFilteredProductionFlows(stationId: string): WareProductionFlow[] {
  const cache = stationProductionFlowMap.getCache(stationId)
  if (!cache) return []
  return cache.productionFlows.filter(f => {
    if (f.netRate <= 0) return true
    return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
  })
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
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

export function getDerivedGroupedFlows(
  stationId: string,
  _modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  derivedSettings: DerivedSettings
): GroupedFlows {
  return getDerivedStationData(stationId, waresMap, derivedSettings).groupedFlows
}

export function getDerivedStationData(
  stationId: string,
  waresMap: Record<string, X4Ware>,
  derivedSettings: DerivedSettings
): { groupedFlows: GroupedFlows } {
  const state = stationStateMap.get(stationId)
  const cache = stationProductionFlowMap.getCache(stationId)
  if (!state || !cache || cache.productionFlows.length === 0 || !state.warePriorityLevels) {
    return {
      groupedFlows: createEmptyGroupedFlows()
    }
  }

  return calculateWareFlowDerived({
    productionFlows: cache.productionFlows,
    autoIndustryModules: [],
    plannedModules: [],
    modulesMap: {},
    waresMap,
    settings: derivedSettings,
    warePriorityLevels: state.warePriorityLevels
  })
}

export function getStationAnalysis(stationId: string): ReturnType<typeof stationStateMap.get> extends infer T ? T extends { stationAnalysis: infer A } ? A : null : null {
  const state = stationStateMap.get(stationId)
  return state?.stationAnalysis || null
}

export function getStationState(stationId: string) {
  return stationStateMap.get(stationId)
}

export function patchStationState(stationId: string, partial: {
  plannedModules?: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  settings?: StationSettings
}): void {
  stationStateMap.patch(stationId, {
    plannedModules: partial.plannedModules,
    lockedWares: partial.lockedWares,
    warePriority: partial.warePriority,
    settings: partial.settings ? migrateStationSettings(partial.settings) : undefined
  })
}

export function mutateStationState(stationId: string, updater: (state: ReturnType<typeof stationStateMap.get>) => void): void {
  const state = stationStateMap.get(stationId)
  if (state) updater(state)
}

export function ensureStationState(stationId: string, seed?: Partial<{
  plannedModules: SavedModule[]
  lockedWares: string[]
  warePriority: Record<string, number>
  settings: StationSettings
}>): ReturnType<typeof stationStateMap.ensure> {
  return stationStateMap.ensure(stationId, seed)
}

export function fullRecomputeFlow(stationId: string, station: StationPlan, deps: StationComputeDeps): void {
  syncPersistedToStateMap(stationId, station)
  recomputeStation(stationId, deps)
}

export function writeAndRecompute(
  stationId: string,
  writer: () => void,
  deps: StationComputeDeps
): void {
  writer()
  recomputeStation(stationId, deps)
}

export function writePersistedAndRecompute(
  stationId: string,
  persistedWriter: (persisted: StationPlan) => void,
  station: StationPlan,
  deps: StationComputeDeps
): void {
  persistedWriter(station)
  syncPersistedToStateMap(stationId, station)
  recomputeStation(stationId, deps)
}

export function clearStationState(stationId: string): void {
  stationStateMap.remove(stationId)
  stationProductionFlowMap.remove(stationId)
}

export function getPlannedModules(stationId: string): SavedModule[] {
  return stationStateMap.get(stationId)?.plannedModules || []
}

export function getLockedWares(stationId: string): string[] {
  return stationStateMap.get(stationId)?.lockedWares || []
}

export function getWarePriority(stationId: string): Record<string, number> {
  return stationStateMap.get(stationId)?.warePriority || {}
}

export function getSettings(stationId: string): StationSettings {
  return stationStateMap.get(stationId)?.settings || { ...DEFAULT_STATION_SETTINGS }
}

export function getAutoIndustryModules(stationId: string): SavedModule[] {
  return stationStateMap.get(stationId)?.autoIndustryModules || []
}

export function getActualWorkforce(stationId: string): number {
  return stationStateMap.get(stationId)?.actualWorkforce || 0
}

export function getCurrentEfficiency(stationId: string): number {
  return stationStateMap.get(stationId)?.currentEfficiency || 0
}

export function cloneStationState(fromId: string, toId: string): void {
  stationStateMap.clone(fromId, toId)
}

export function getProductionFlows(stationId: string): WareProductionFlow[] {
  return stationProductionFlowMap.getProductionFlows(stationId)
}

export function getAutoInfrastructureModules(stationId: string, modulesMap: Record<string, X4Module>): SavedModule[] {
  const resolved = stationProductionFlowMap.getResolvedModules(stationId)
  const plannedIds = stationStateMap.get(stationId)?.plannedModules?.map(m => m.id) || []
  return resolved.filter(m => {
    if (plannedIds.includes(m.id)) return false
    const info = modulesMap[m.id]
    return info?.type === 'storage' || info?.type === 'pier'
  })
}

export function getWarePriorityLevels(stationId: string): Record<string, number> {
  return stationStateMap.getWarePriorityLevels(stationId)
}

export function updateAutoInfrastructureModules(stationId: string, modules: SavedModule[]): void {
  stationStateMap.mutate(stationId, (state) => {
    state.autoInfrastructureModules = modules
  })
}

export function updateProductionFlowAggregationAfterRecompute(empireOrStations: EmpirePlan | StationPlan[]): void {
  const stations = Array.isArray(empireOrStations) ? empireOrStations : empireOrStations.stations
  updateProductionFlowAggregation(stations)
}