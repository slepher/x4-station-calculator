/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ensureStationState, getSettings, patchStationState } from '@/store/logic/stationComputeService'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/StationStateMap'

describe('showEmpireGaps 设置', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认值为 false', () => {
    ensureStationState('test-station', { settings: { ...DEFAULT_STATION_SETTINGS } })
    const settings = getSettings('test-station')
    expect(settings?.showEmpireGaps).toBe(false)
  })

  it('可以设置为 true 并持久化', () => {
    ensureStationState('test-station', { settings: { ...DEFAULT_STATION_SETTINGS } })
    patchStationState('test-station', { settings: { showEmpireGaps: true } })
    const settings = getSettings('test-station')
    expect(settings?.showEmpireGaps).toBe(true)
  })
})