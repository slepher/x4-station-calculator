import type { SavedModule, X4Module, StationSettings } from '@/types/x4'
import type { StationComputeDeps } from '@/store/state/stationSettings'

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

export interface ProductionModuleStation {
  id: string
  modules?: SavedModule[]
  settings: StationSettings
  lockedWares?: string[]
  warePriority?: Record<string, number>
  lastUpdated?: number
}

export interface ProductionModuleActionDeps<TStation extends ProductionModuleStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  findModuleForWare(wareId: string, racePreference: string): X4Module | null
  getRacePreference(): string
  getModulesMap(): Record<string, X4Module>
  isModuleCountEditable?(moduleId: string): boolean
  getPlannedModules(): SavedModule[]
  getAutoIndustryModules(): SavedModule[]
  cloneModules(modules: SavedModule[]): SavedModule[]
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionModuleActions {
  updatePlannedModules(modules: SavedModule[]): ActionResult
  addModule(moduleId: string, count?: number): ActionResult
  addModuleByWare(wareId: string): ActionResult
  removeModule(index: number): ActionResult
  removeModuleByWare(wareId: string): ActionResult
  removeModuleById(moduleId: string): ActionResult
  updateModuleCount(index: number, count: number): ActionResult
  clearAllModules(): ActionResult
  transferModuleFromAutoIndustry(module: SavedModule): ActionResult
}

export function createProductionModuleActions<TStation extends ProductionModuleStation>(
  deps: ProductionModuleActionDeps<TStation>
): ProductionModuleActions {
  function updatePlannedModules(modules: SavedModule[]): ActionResult {
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }
    
    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }
    
    station.modules = deps.cloneModules(modules)
    station.lastUpdated = deps.now()
    
    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)
    
    return { ok: true }
  }
  
  function addModule(moduleId: string, count = 1): ActionResult {
    if (moduleId !== '' && !deps.getModulesMap()[moduleId]) {
      return { ok: false, reason: 'module-not-found' }
    }
    
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }
    
    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }
    
    const current = deps.cloneModules(station.modules || [])
    const existingIndex = current.findIndex(m => m.id === moduleId)
    
    if (existingIndex !== -1) {
      const existing = current[existingIndex]
      if (existing) existing.count += count
      station.modules = current
    } else {
      station.modules = [...current, { id: moduleId, count }]
    }
    
    station.lastUpdated = deps.now()
    
    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)
    
    return { ok: true }
  }
  
  function addModuleByWare(wareId: string): ActionResult {
    const racePreference = deps.getRacePreference()
    const module = deps.findModuleForWare(wareId, racePreference)
    
    if (!module) {
      return { ok: false, reason: 'module-not-found-for-ware' }
    }
    
    return addModule(module.id, 1)
  }
  
  function removeModule(index: number): ActionResult {
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }
    
    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }
    
    const current = station.modules || []
    station.modules = current.filter((_, i) => i !== index)
    station.lastUpdated = deps.now()
    
    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)
    
    return { ok: true }
  }
  
  function removeModuleByWare(wareId: string): ActionResult {
    const racePreference = deps.getRacePreference()
    const module = deps.findModuleForWare(wareId, racePreference)
    
    if (!module) {
      return { ok: false, reason: 'module-not-found-for-ware' }
    }
    
    const plannedModules = deps.getPlannedModules()
    const plannedIndex = plannedModules.findIndex(m => m.id === module.id)
    
    if (plannedIndex === -1) {
      return { ok: false, reason: 'module-not-in-planned-list' }
    }
    
    const currentCount = plannedModules[plannedIndex]?.count ?? 0
    if (currentCount <= 1) {
      return removeModule(plannedIndex)
    } else {
      return updateModuleCount(plannedIndex, currentCount - 1)
    }
  }
  
  function removeModuleById(moduleId: string): ActionResult {
    const plannedModules = deps.getPlannedModules()
    const index = plannedModules.findIndex(m => m.id === moduleId)
    
    if (index === -1) {
      return { ok: false, reason: 'module-not-in-planned-list' }
    }
    
    return removeModule(index)
  }
  
  function updateModuleCount(index: number, count: number): ActionResult {
    const plannedModules = deps.getPlannedModules()
    const module = plannedModules[index]
    
    if (!module) {
      return { ok: false, reason: 'module-index-invalid' }
    }
    
    if (deps.isModuleCountEditable && !deps.isModuleCountEditable(module.id)) {
      return { ok: false, reason: 'module-count-not-editable' }
    }
    
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }
    
    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }
    
    const next = deps.cloneModules(station.modules || [])
    const target = next[index]
    if (target) target.count = count
    station.modules = next
    station.lastUpdated = deps.now()
    
    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)
    
    return { ok: true }
  }
  
  function clearAllModules(): ActionResult {
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }
    
    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }
    
    station.modules = []
    station.lastUpdated = deps.now()
    
    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)
    
    return { ok: true }
  }
  
  function transferModuleFromAutoIndustry(module: SavedModule): ActionResult {
    const inIndustry = deps.getAutoIndustryModules().some(m => m.id === module.id)
    if (!inIndustry) {
      return { ok: false, reason: 'module-not-in-auto-industry' }
    }
    
    return addModule(module.id, module.count)
  }
  
  return {
    updatePlannedModules,
    addModule,
    addModuleByWare,
    removeModule,
    removeModuleByWare,
    removeModuleById,
    updateModuleCount,
    clearAllModules,
    transferModuleFromAutoIndustry
  }
}