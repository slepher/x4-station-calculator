/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: true,
    waresMap: {},
    modulesMap: {},
    workforceConsumptionMap: {}
  }))
}))

import { useEmpireStore } from '@/store/useEmpireStore'

describe.skip('station-tab-drag unit tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('U1: reorderStations 正常重排', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    store.createStation('Alpha', 'industrial')
    store.createStation('Beta', 'industrial')
    store.createStation('Gamma', 'industrial')

    const current = store.activeEmpire!.stations
    const reordered = [current[2]!, current[0]!, current[1]!]
    store.reorderStations(reordered)

    expect(store.activeEmpire!.stations.map(s => s.name)).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  it('U2: reorderStations 非法输入保护', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    store.createStation('Alpha', 'industrial')
    store.createStation('Beta', 'industrial')
    store.createStation('Gamma', 'industrial')

    const baseOrder = store.activeEmpire!.stations.map(s => s.id)

    store.reorderStations(store.activeEmpire!.stations.slice(0, 2))
    expect(store.activeEmpire!.stations.map(s => s.id)).toEqual(baseOrder)

    const unknownStation = {
      ...store.activeEmpire!.stations[0]!,
      id: 'unknown-station-id'
    }
    const withUnknown = [unknownStation, ...store.activeEmpire!.stations.slice(1)]
    store.reorderStations(withUnknown)
    expect(store.activeEmpire!.stations.map(s => s.id)).toEqual(baseOrder)
  })

  it('U3: 重排不影响激活站', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    const a = store.createStation('Alpha', 'industrial')
    const b = store.createStation('Beta', 'industrial')
    const c = store.createStation('Gamma', 'industrial')

    store.selectStation(b!.id)
    const reordered = [c!, a!, b!]
    store.reorderStations(reordered)

    expect(store.activeStationId).toBe(b!.id)
  })

  it('U4: 重排后保存数据顺序', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    const a = store.createStation('Alpha', 'industrial')
    const b = store.createStation('Beta', 'industrial')
    const c = store.createStation('Gamma', 'industrial')

    store.reorderStations([c!, a!, b!])
    store.saveEmpire()

    const persisted = JSON.parse(localStorage.getItem('x4_empire_data')!)
    expect(persisted.list[0].stations.map((s: { name: string }) => s.name)).toEqual(['Gamma', 'Alpha', 'Beta'])
  })
})
