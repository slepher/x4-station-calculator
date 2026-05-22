import type { SavedModule, X4Module, X4Ware, StationSettings } from '@/types/x4'
import type { StationComputeDeps } from '@/store/state/stationSettings'

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

export interface ProductionWareRuleStation {
  id: string
  modules?: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  settings: StationSettings
  lastUpdated?: number
}

export interface ProductionWareRuleActionDeps<TStation extends ProductionWareRuleStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  getPlannedModules(): SavedModule[]
  getAutoIndustryModules(): SavedModule[]
  getModulesMap(): Record<string, X4Module>
  getWaresMap(): Record<string, X4Ware>
  isLockForbidden?(wareId: string): boolean
  getLockedWares(): string[]
  getWarePriority(): Record<string, number>
  cloneStringList(values: string[]): string[]
  clonePriorityMap(values: Record<string, number>): Record<string, number>
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionWareRuleActions {
  isWareOperable(wareId: string): boolean
  isWareLocked(wareId: string): boolean
  isPlannedWare(wareId: string): boolean
  isAutoWare(wareId: string): boolean
  getResolvedLevel(wareId: string): number
  toggleWareLock(wareId: string): ActionResult
  toggleWarePriority(wareId: string): ActionResult
}

export function createProductionWareRuleActions<TStation extends ProductionWareRuleStation>(
  deps: ProductionWareRuleActionDeps<TStation>
): ProductionWareRuleActions {
  function isBaseWareOperable(wareId: string): boolean {
    const ware = deps.getWaresMap()[wareId]
    return ware?.transport === 'container'
  }

  function isLockForbidden(wareId: string): boolean {
    return deps.isLockForbidden?.(wareId) ?? false
  }

  function isWareOperable(wareId: string): boolean {
    if (!isBaseWareOperable(wareId)) return false
    return !isLockForbidden(wareId)
  }

  function isWareLocked(wareId: string): boolean {
    if (!isBaseWareOperable(wareId)) return true
    return deps.getLockedWares().includes(wareId)
  }

  function isPlannedWare(wareId: string): boolean {
    return deps.getPlannedModules().some(module => {
      const moduleInfo = deps.getModulesMap()[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function isAutoWare(wareId: string): boolean {
    if (isPlannedWare(wareId)) return false
    return deps.getAutoIndustryModules().some(module => {
      const moduleInfo = deps.getModulesMap()[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function getResolvedLevel(wareId: string): number {
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)
    const override = deps.getWarePriority()[wareId]

    if (planned && override === 0) return 1
    if (auto && override === 2) return 1
    if (override !== undefined) return override
    if (planned) return 2
    if (auto) return 0
    return 0
  }

  function toggleWareLock(wareId: string): ActionResult {
    if (!isBaseWareOperable(wareId)) {
      return { ok: false, reason: 'ware-not-operable' }
    }
    if (isLockForbidden(wareId)) {
      return { ok: false, reason: 'ware-lock-forbidden' }
    }

    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }

    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }

    const current = deps.cloneStringList(station.lockedWares || [])
    station.lockedWares = current.includes(wareId)
      ? current.filter(id => id !== wareId)
      : [...current, wareId]
    station.lastUpdated = deps.now()

    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)

    return { ok: true }
  }

  function toggleWarePriority(wareId: string): ActionResult {
    const currentLevel = getResolvedLevel(wareId)
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)

    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }

    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }

    const nextPriority = deps.clonePriorityMap(station.warePriority || {})

    if (planned) {
      if (currentLevel === 2) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    } else if (auto) {
      if (currentLevel === 0) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    }

    station.warePriority = nextPriority
    station.lastUpdated = deps.now()

    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)

    return { ok: true }
  }

  return {
    isWareOperable,
    isWareLocked,
    isPlannedWare,
    isAutoWare,
    getResolvedLevel,
    toggleWareLock,
    toggleWarePriority
  }
}
