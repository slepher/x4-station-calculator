/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' },
      t: (key: string) => key
    }),
    createI18n: actual.createI18n
  }
})

import { useEmpireStore } from '@/store/useEmpireStore'
import { useStationStore } from '@/store/useStationStore'

describe('useStationStore 代理写入', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('写入只作用于当前 active station', async () => {
    const empire = useEmpireStore()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 10000 })

    const a = empire.createStation('A', 'industrial')!
    const b = empire.createStation('B', 'industrial')!

    const station = useStationStore()
    await vi.waitFor(() => expect(station.isReady).toBe(true), { timeout: 10000 })

    empire.selectStation(a.id)
    station.addModule('prod_gen_claytronics_macro', 1)

    empire.selectStation(b.id)
    station.addModule('prod_gen_hullparts_macro', 2)

    const stationA = empire.getStationById(a.id)!
    const stationB = empire.getStationById(b.id)!

    expect(stationA.modules.some(m => m.id === 'prod_gen_claytronics_macro')).toBe(true)
    expect(stationA.modules.some(m => m.id === 'prod_gen_hullparts_macro')).toBe(false)
    expect(stationB.modules.some(m => m.id === 'prod_gen_hullparts_macro')).toBe(true)
  })

  it('updateSetting 修改 racePreference 会同步到 active station', async () => {
    const empire = useEmpireStore()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 10000 })

    const a = empire.createStation('A', 'industrial')!
    const station = useStationStore()
    await vi.waitFor(() => expect(station.isReady).toBe(true), { timeout: 10000 })

    empire.selectStation(a.id)
    station.updateSetting('racePreference', 'terran')

    const stationA = empire.getStationById(a.id)!
    expect(station.settings.racePreference).toBe('terran')
    expect(stationA.settings.racePreference).toBe('terran')
  })

  it('updateSetting 修改价格倍率会触发利润重算', async () => {
    const empire = useEmpireStore()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 10000 })

    const a = empire.createStation('A', 'industrial')!
    const station = useStationStore()
    await vi.waitFor(() => expect(station.isReady).toBe(true), { timeout: 10000 })

    empire.selectStation(a.id)
    station.addModule('prod_gen_hullparts_macro', 1)

    const beforeProfit = station.groupedFlows.flows.reduce((sum, flow: any) => sum + (flow.netValue || 0), 0)
    station.updateSetting('sellMultiplier', 1)
    const afterProfit = station.groupedFlows.flows.reduce((sum, flow: any) => sum + (flow.netValue || 0), 0)

    expect(afterProfit).not.toBe(beforeProfit)
  })

  it('updateSetting 修改手动劳动力会触发效率重算', async () => {
    const empire = useEmpireStore()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 10000 })

    const a = empire.createStation('A', 'industrial')!
    const station = useStationStore()
    await vi.waitFor(() => expect(station.isReady).toBe(true), { timeout: 10000 })

    empire.selectStation(a.id)
    const modules = Object.values(station.modules || {}) as any[]
    const neededModule = modules.find((m: any) => (m?.workforce?.needed || 0) > 0)
    const capacityModule = modules.find((m: any) => (m?.workforce?.capacity || 0) > 0)

    expect(neededModule?.id).toBeTruthy()
    expect(capacityModule?.id).toBeTruthy()

    station.addModule(neededModule.id, 1)
    station.addModule(capacityModule.id, 1)
    expect(station.stationAnalysis.totalNeeded).toBeGreaterThan(0)
    expect(station.stationAnalysis.totalCapacity).toBeGreaterThan(0)

    station.updateSetting('workforceAuto', false)
    station.updateSetting('manualWorkforce', 0)
    const beforeWorkforce = station.actualWorkforce

    station.updateSetting('manualWorkforce', 100000)
    const afterWorkforce = station.actualWorkforce

    expect(afterWorkforce).toBeGreaterThan(beforeWorkforce)
  })
})
