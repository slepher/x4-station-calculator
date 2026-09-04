import { describe, expect, it, vi } from 'vitest'
import {
  createProductionSettingActions,
  doesStationSettingsAffectFlowMap
} from '@/store/actions/productionSettingActions'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'
import type { StationSettings } from '@/types/x4'

describe('productionSettingActions', () => {
  it('only stage-one settings affect flow map recompute', () => {
    expect(doesStationSettingsAffectFlowMap({ buyMultiplier: 0.7 })).toBe(false)
    expect(doesStationSettingsAffectFlowMap({ resourceBufferHours: 4 })).toBe(false)
    expect(doesStationSettingsAffectFlowMap({ transportShipCapacity: 99999 })).toBe(false)
    expect(doesStationSettingsAffectFlowMap({ manualWorkforce: 1200 })).toBe(true)
  })

  it('skips recompute for phase-two-only settings patches', () => {
    const station = {
      id: 'station-1',
      settings: { ...DEFAULT_STATION_SETTINGS }
    }
    const recompute = vi.fn()
    const afterCommit = vi.fn()

    const actions = createProductionSettingActions({
      getActiveStation: () => station,
      getComputeDeps: () => ({
        modulesMap: {},
        waresMap: {},
        workforceConsumptionMap: { default: { idle: {}, busy: {} } }
      }),
      mergeSettings: (base: StationSettings, patch: Partial<StationSettings>) => ({ ...base, ...patch }),
      now: () => 1,
      commitStationMutation: vi.fn(),
      recompute,
      shouldRecompute: (_station, patch) => doesStationSettingsAffectFlowMap(patch),
      afterCommit
    })

    const result = actions.updateBuyMultiplier(0.7)

    expect(result).toEqual({ ok: true })
    expect(recompute).not.toHaveBeenCalled()
    expect(afterCommit).toHaveBeenCalledOnce()
    expect(station.settings.buyMultiplier).toBe(0.7)
  })

  it('recomputes when workforce settings change', () => {
    const station = {
      id: 'station-1',
      settings: { ...DEFAULT_STATION_SETTINGS }
    }
    const recompute = vi.fn()

    const actions = createProductionSettingActions({
      getActiveStation: () => station,
      getComputeDeps: () => ({
        modulesMap: {},
        waresMap: {},
        workforceConsumptionMap: { default: { idle: {}, busy: {} } }
      }),
      mergeSettings: (base: StationSettings, patch: Partial<StationSettings>) => ({ ...base, ...patch }),
      now: () => 1,
      commitStationMutation: vi.fn(),
      recompute,
      shouldRecompute: (_station, patch) => doesStationSettingsAffectFlowMap(patch)
    })

    const result = actions.updateManualWorkforce(1200)

    expect(result).toEqual({ ok: true })
    expect(recompute).toHaveBeenCalledOnce()
    expect(station.settings.manualWorkforce).toBe(1200)
  })
})
