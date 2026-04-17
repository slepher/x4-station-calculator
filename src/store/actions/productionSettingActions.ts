import type { SavedModule, StationSettings } from '@/types/x4'
import type { StationComputeDeps } from '@/store/state/stationSettings'

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

export interface ProductionSettingStation {
  id: string
  settings: StationSettings
  modules?: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  lastUpdated?: number
}

export interface ProductionSettingActionDeps<TStation extends ProductionSettingStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  mergeSettings(base: StationSettings, patch: Partial<StationSettings>): StationSettings
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionSettingActions {
  updateSetting<K extends keyof StationSettings>(key: K, value: StationSettings[K]): ActionResult
  updateSettings(patch: Partial<StationSettings>): ActionResult
  updateSunlight(value: number): ActionResult
  updateTransportMinutes(value: number): ActionResult
  updateRacePreference(value: string): ActionResult
  updateWorkforce(value: boolean): ActionResult
  updateShowEmpireGaps(value: boolean): ActionResult
  updateResourceBufferHours(value: number): ActionResult
  updatePrimaryProductBufferHours(value: number): ActionResult
  updateSecondaryProductBufferHours(value: number): ActionResult
  updateBuyMultiplier(value: number): ActionResult
  updateSellMultiplier(value: number): ActionResult
  updateTransportShipCapacity(value: number): ActionResult
  updateManualWorkforce(value: number): ActionResult
  updateWorkforceAuto(value: boolean): ActionResult
  updateUseHQ(value: boolean): ActionResult
}

export function createProductionSettingActions<TStation extends ProductionSettingStation>(
  deps: ProductionSettingActionDeps<TStation>
): ProductionSettingActions {
  function updateSettings(patch: Partial<StationSettings>): ActionResult {
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }

    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }

    station.settings = deps.mergeSettings(station.settings, patch)
    station.lastUpdated = deps.now()

    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)

    return { ok: true }
  }

  function updateSetting<K extends keyof StationSettings>(key: K, value: StationSettings[K]): ActionResult {
    return updateSettings({ [key]: value })
  }

  function updateSunlight(value: number): ActionResult {
    return updateSetting('sunlight', value)
  }

  function updateTransportMinutes(value: number): ActionResult {
    return updateSetting('transportMinutes', value)
  }

  function updateRacePreference(value: string): ActionResult {
    return updateSetting('racePreference', value)
  }

  function updateWorkforce(value: boolean): ActionResult {
    return updateSetting('considerWorkforceForAutoFill', value)
  }

  function updateShowEmpireGaps(value: boolean): ActionResult {
    return updateSetting('showEmpireGaps', value)
  }

  function updateResourceBufferHours(value: number): ActionResult {
    return updateSetting('resourceBufferHours', value)
  }

  function updatePrimaryProductBufferHours(value: number): ActionResult {
    return updateSetting('primaryProductBufferHours', value)
  }

  function updateSecondaryProductBufferHours(value: number): ActionResult {
    return updateSetting('secondaryProductBufferHours', value)
  }

  function updateBuyMultiplier(value: number): ActionResult {
    return updateSetting('buyMultiplier', value)
  }

  function updateSellMultiplier(value: number): ActionResult {
    return updateSetting('sellMultiplier', value)
  }

  function updateTransportShipCapacity(value: number): ActionResult {
    return updateSetting('transportShipCapacity', value)
  }

  function updateManualWorkforce(value: number): ActionResult {
    return updateSetting('manualWorkforce', value)
  }

  function updateWorkforceAuto(value: boolean): ActionResult {
    return updateSetting('workforceAuto', value)
  }

  function updateUseHQ(value: boolean): ActionResult {
    return updateSetting('useHQ', value)
  }

  return {
    updateSetting,
    updateSettings,
    updateSunlight,
    updateTransportMinutes,
    updateRacePreference,
    updateWorkforce,
    updateShowEmpireGaps,
    updateResourceBufferHours,
    updatePrimaryProductBufferHours,
    updateSecondaryProductBufferHours,
    updateBuyMultiplier,
    updateSellMultiplier,
    updateTransportShipCapacity,
    updateManualWorkforce,
    updateWorkforceAuto,
    updateUseHQ
  }
}