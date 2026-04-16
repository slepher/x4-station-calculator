import type { StationPlan, SavedModule, StationSettings, X4Module, X4Ware, RaceMedicalConsumption } from '@/types/x4'
import type { StationComputeDeps } from '../state/stationSettings'
import type { StationFlowCache } from '../state/StationProductionFlowMap'
import { stationProductionFlowMap } from '../state/StationProductionFlowMap'
import { DEFAULT_STATION_SETTINGS, migrateStationSettings } from '../state/stationSettings'
import { deepClone } from '@/utils/deepClone'

export interface ActiveStationState {
  actualWorkforce: number
  currentEfficiency: number
  warePriorityLevels: Record<string, number>
  productionFlows: any[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  resolvedModules: SavedModule[]
}

export interface ComputeDepsInput {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier: number
  enforceDlcActivation: boolean
  isModuleDlcActive: (moduleId: string) => boolean
}

export function buildComputeDeps(input: ComputeDepsInput): StationComputeDeps {
  return {
    modulesMap: input.modulesMap,
    waresMap: input.waresMap,
    medicalConsumptionMap: input.medicalConsumptionMap,
    buildPriceMultiplier: input.buildPriceMultiplier,
    enforceDlcActivation: input.enforceDlcActivation,
    isModuleDlcActive: input.isModuleDlcActive
  }
}

export function buildActiveStationState(
  stationId: string | undefined,
  plannedModules: SavedModule[],
  cache: StationFlowCache | null
): ActiveStationState {
  if (!stationId) {
    return {
      actualWorkforce: 0,
      currentEfficiency: 0,
      warePriorityLevels: {},
      productionFlows: [],
      plannedModules: [],
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: [],
      resolvedModules: []
    }
  }
  
  const autoIndustry = cache?.autoIndustryModules || []
  const autoHabitation = cache?.autoHabitationModules || []
  const autoInfrastructure = cache?.autoInfrastructureModules || []
  const resolved = [...plannedModules, ...autoIndustry, ...autoHabitation, ...autoInfrastructure]
  
  return {
    actualWorkforce: cache?.actualWorkforce || 0,
    currentEfficiency: cache?.currentEfficiency || 0,
    warePriorityLevels: cache?.warePriorityLevels || {},
    productionFlows: stationProductionFlowMap.getProductionFlows(stationId),
    plannedModules,
    autoIndustryModules: autoIndustry,
    autoHabitationModules: autoHabitation,
    autoInfrastructureModules: autoInfrastructure,
    resolvedModules: resolved
  }
}

export function computeStationFlow(
  stationId: string,
  station: StationPlan,
  deps: StationComputeDeps
): void {
  stationProductionFlowMap.compute(stationId, {
    plannedModules: station.modules || [],
    settings: migrateStationSettings(station.settings),
    lockedWares: station.lockedWares || [],
    warePriority: station.warePriority || {}
  }, deps)
}

export function isWareOperable(wareId: string, waresMap: Record<string, X4Ware>): boolean {
  const ware = waresMap[wareId]
  return ware?.transport === 'container'
}

export function isWareLocked(wareId: string, lockedWares: string[], waresMap: Record<string, X4Ware>): boolean {
  if (!isWareOperable(wareId, waresMap)) return true
  return lockedWares.includes(wareId)
}

export function isPlannedWare(wareId: string, plannedModules: SavedModule[], modulesMap: Record<string, X4Module>): boolean {
  return plannedModules.some(module => {
    const moduleInfo = modulesMap[module.id]
    if (!moduleInfo) return false
    return Object.keys(moduleInfo.outputs || {}).includes(wareId)
  })
}

export function isAutoWare(
  wareId: string,
  plannedModules: SavedModule[],
  autoIndustryModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): boolean {
  if (isPlannedWare(wareId, plannedModules, modulesMap)) return false
  return autoIndustryModules.some(module => {
    const moduleInfo = modulesMap[module.id]
    if (!moduleInfo) return false
    return Object.keys(moduleInfo.outputs || {}).includes(wareId)
  })
}

export function getResolvedLevel(
  wareId: string,
  plannedModules: SavedModule[],
  autoIndustryModules: SavedModule[],
  warePriority: Record<string, number>,
  modulesMap: Record<string, X4Module>
): number {
  const planned = isPlannedWare(wareId, plannedModules, modulesMap)
  const auto = isAutoWare(wareId, plannedModules, autoIndustryModules, modulesMap)
  const override = warePriority[wareId]

  if (planned && override === 0) return 1
  if (auto && override === 2) return 1
  if (override !== undefined) return override
  if (planned) return 2
  if (auto) return 0
  return 0
}

export function toggleWareLockForActiveStation(
  station: StationPlan,
  wareId: string,
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean,
  waresMap: Record<string, X4Ware>
): void {
  if (!isWareOperable(wareId, waresMap)) return
  const current = station.lockedWares || []
  station.lockedWares = current.includes(wareId)
    ? current.filter((id: string) => id !== wareId)
    : [...current, wareId]
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function toggleWarePriorityForActiveStation(
  station: StationPlan,
  wareId: string,
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean,
  plannedModules: SavedModule[],
  autoIndustryModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): void {
  const currentLevel = getResolvedLevel(wareId, plannedModules, autoIndustryModules, station.warePriority || {}, modulesMap)
  const planned = isPlannedWare(wareId, plannedModules, modulesMap)
  const auto = isAutoWare(wareId, plannedModules, autoIndustryModules, modulesMap)

  const nextPriority = deepClone(station.warePriority || {})

  if (planned) {
    if (currentLevel === 2) nextPriority[wareId] = 1
    else delete nextPriority[wareId]
  } else if (auto) {
    if (currentLevel === 0) nextPriority[wareId] = 1
    else delete nextPriority[wareId]
  }

  station.warePriority = nextPriority
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function getFallbackModuleInfo(id: string, modulesMap: Record<string, X4Module>): X4Module {
  return modulesMap[id] || {
    id,
    macroId: '',
    wareId: '',
    nameId: id,
    type: 'unknown',
    group: 'others',
    race: 'unknown',
    buildTime: 0,
    buildCost: {},
    cycleTime: 0,
    outputs: {},
    inputs: {},
    dockingCount: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 }
  } as X4Module
}

export function addModuleToStation(
  station: StationPlan,
  moduleId: string,
  count: number,
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean,
  modulesMap: Record<string, X4Module>
): void {
  if (moduleId !== '' && !modulesMap[moduleId]) return
  const current = station.modules || []
  const existingIndex = current.findIndex(m => m.id === moduleId)
  if (existingIndex !== -1) {
    const next = deepClone(current)
    const existing = next[existingIndex]
    if (existing) existing.count += count
    station.modules = next
  } else {
    station.modules = [...current, { id: moduleId, count }]
  }
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function removeModuleFromStation(
  station: StationPlan,
  index: number,
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean
): void {
  const current = station.modules || []
  station.modules = current.filter((_, i) => i !== index)
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function updateModuleCountInStation(
  station: StationPlan,
  index: number,
  count: number,
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean,
  plannedModules: SavedModule[],
  enforceDlcActivation: boolean,
  isModuleDlcActive: (moduleId: string) => boolean
): void {
  const module = plannedModules[index]
  if (!module) return
  if (enforceDlcActivation && !isModuleDlcActive(module.id)) return
  const next = deepClone(station.modules || [])
  const target = next[index]
  if (target) target.count = count
  station.modules = next
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function updateStationSettingsDirect(
  station: StationPlan,
  key: keyof StationSettings,
  value: StationSettings[keyof StationSettings],
  deps: StationComputeDeps,
  persistCallback: (stationId: string, patch: Partial<StationPlan>) => boolean
): void {
  station.settings = migrateStationSettings({ ...station.settings, [key]: value })
  station.lastUpdated = Date.now()
  computeStationFlow(station.id, station, deps)
  persistCallback(station.id, {
    modules: station.modules,
    lockedWares: station.lockedWares,
    warePriority: station.warePriority,
    settings: station.settings
  })
}

export function getDefaultStationPlan(
  id: string,
  name: string,
  sunlight?: number
): StationPlan {
  return {
    id,
    name: name || id,
    type: 'industrial',
    modules: [],
    settings: { ...DEFAULT_STATION_SETTINGS, sunlight: sunlight ?? 100 },
    lastUpdated: 0,
    lockedWares: [],
    warePriority: {}
  }
}