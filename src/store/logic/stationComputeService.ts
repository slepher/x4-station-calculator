import type { StationPlan, SavedModule, StationSettings, X4Module, X4Ware, GroupedFlows } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import {
  stationStateMap,
  DEFAULT_STATION_SETTINGS,
  migrateStationSettings,
  type StationComputeDeps
} from '@/store/state/StationStateMap'
import { calculateWareFlowDerived } from '@/store/logic/calculateWareFlowDerived'

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

export function syncPersistedToStateMap(stationId: string, station: StationPlan): void {
  station.settings = migrateStationSettings(station.settings)
  stationStateMap.fromPersisted(stationId, station)
}

export function recomputeStation(stationId: string, deps: StationComputeDeps): void {
  stationStateMap.recompute(stationId, deps)
}

export function syncStateMapToPersisted(stationId: string): Pick<StationPlan, 'modules' | 'lockedWares' | 'warePriority' | 'settings'> | null {
  return stationStateMap.toPersisted(stationId)
}

export function getGroupedFlows(stationId: string): GroupedFlows {
  return stationStateMap.getGroupedFlows(stationId)
}

export function getFilteredGroupedFlows(stationId: string): GroupedFlows {
  return stationStateMap.getFilteredGroupedFlows(stationId)
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
  modulesMap: Record<string, X4Module>,
  derivedSettings: DerivedSettings
): GroupedFlows {
  return getDerivedStationData(stationId, modulesMap, derivedSettings).groupedFlows
}

export function getDerivedStationData(
  stationId: string,
  modulesMap: Record<string, X4Module>,
  derivedSettings: DerivedSettings
): { groupedFlows: GroupedFlows; autoInfrastructureModules: SavedModule[] } {
  const state = stationStateMap.get(stationId)
  if (!state || !state.productionFlows || !state.warePriorityLevels) {
    return {
      groupedFlows: createEmptyGroupedFlows(),
      autoInfrastructureModules: []
    }
  }

  if (state.productionFlows.length === 0) {
    return {
      groupedFlows: createEmptyGroupedFlows(),
      autoInfrastructureModules: []
    }
  }

  return calculateWareFlowDerived({
    productionFlows: state.productionFlows,
    autoIndustryModules: state.autoIndustryModules,
    plannedModules: state.plannedModules,
    modulesMap,
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
  return stationStateMap.getProductionFlows(stationId)
}

export function getFilteredProductionFlows(stationId: string): WareProductionFlow[] {
  return stationStateMap.getFilteredProductionFlows(stationId)
}

export function getAutoInfrastructureModules(stationId: string): SavedModule[] {
  return stationStateMap.get(stationId)?.autoInfrastructureModules || []
}

export function getWarePriorityLevels(stationId: string): Record<string, number> {
  return stationStateMap.getWarePriorityLevels(stationId)
}

export function updateAutoInfrastructureModules(stationId: string, modules: SavedModule[]): void {
  stationStateMap.mutate(stationId, (state) => {
    state.autoInfrastructureModules = modules
  })
}
