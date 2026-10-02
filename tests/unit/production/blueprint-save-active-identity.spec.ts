// @vitest-environment jsdom
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import type { X4Module, X4Ware } from '@/types/x4'

vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => useTestGame() }))

const STORAGE = 'blueprint-save-identity-unit'
const ENERGY = 'module_gen_prod_energycells_01'
const energy = {
  id: ENERGY, macroId: ENERGY, name: 'Energy', type: 'production', race: 'argon', dlc_tag: 'base',
  outputs: { energycells: 3000 }, inputs: {}, buildCost: { hullparts: 2 }, buildTime: 5,
  workforce: { needed: 0, capacity: 0, maxBonus: 0 }
} as X4Module
const wares = Object.fromEntries(['energycells', 'hullparts'].map((id, index) => [id, {
  id, name: id, tier: index, transport: 'container', volume: 2, price: 10, minPrice: 10, maxPrice: 10
}])) as Record<string, X4Ware>
const useTestGame = defineStore('blueprint-save-identity-game', {
  state: () => ({
    isReady: true, modulesMap: { [ENERGY]: energy }, modulesByMacroId: { [ENERGY]: energy },
    waresMap: wares, workforceConsumptionMap: {}, enforceDlcActivation: false, activeDlcs: [],
    maps: { sectors: {} }, mapResources: { sectors: {} }
  }),
  actions: {
    async initialize() {},
    isDlcActive() { return true },
    getStorageKey() { return STORAGE },
    findModuleForWare() { return null }
  }
})

function existingEmpire() {
  const store = useBlueprintProductionStore()
  const view = useActiveViewStore()
  store.createEmpire('A', 'First')
  store.updateStationModules(store.activeStationId!, [{ id: ENERGY, count: 1 }])
  store.saveEmpire()
  store.loadEmpire(store.activeEmpire!.id)
  store.selectStation(store.activeEmpire!.stations[0]!.id)
  return { store, view, original: JSON.parse(JSON.stringify(store.activeEmpire)) }
}

async function reopen() {
  setActivePinia(createPinia())
  const view = useActiveViewStore()
  await view.init()
  const store = useBlueprintProductionStore()
  await store.initialize()
  return { store, view }
}

describe('Blueprint save active identity transaction', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE)
    localStorage.removeItem('x4_station_active_view')
    setActivePinia(createPinia())
  })

  it('preserves full station membership and selection when saving and reopening sidebar order', async () => {
    const { store } = existingEmpire()
    const second = store.createStation('Second')!
    store.updateStationModules(second, [{ id: ENERGY, count: 2 }])
    store.saveEmpire()
    const originalIds = store.activeEmpire!.stations.map(station => station.id)
    const originalStations = JSON.parse(JSON.stringify(store.activeEmpire!.stations))
    expect(store.reorderStations([{ id: second }, { id: second }])).toBe(false)
    expect(store.reorderStations([...originalIds].reverse().map(id => ({ id })))).toBe(true)
    expect(store.activeStationId).toBe(second)
    expect(store.activeEmpire!.stations.map(station => station.id)).toEqual([...originalIds].reverse())
    expect(store.savedEmpires.list.find(empire => empire.id === store.activeEmpire!.id)!.stations).toEqual(originalStations)
    expect([...store.activeEmpire!.stations].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...originalStations].sort((a, b) => a.id.localeCompare(b.id)))
    store.saveEmpire()
    const restored = await reopen()
    expect(restored.store.activeEmpire!.stations.map(station => station.id)).toEqual([...originalIds].reverse())
    expect(restored.store.activeStationId).toBe(second)
  })

  it.each(['save', 'saveAs'] as const)('%s of B restores B across new Pinia while retaining saved A', async action => {
    const { store, view, original } = existingEmpire()
    store.createEmpire('B', 'B station')
    store.updateStationModules(store.activeStationId!, [{ id: ENERGY, count: 2 }])
    if (action === 'save') store.saveEmpire()
    else expect(store.saveEmpireAs('B copy')).toBe(true)
    const expected = JSON.parse(JSON.stringify(store.activeEmpire))
    expect(store.savedEmpires.activeId).toBe(expected.id)
    expect(store.savedEmpires.list.find(e => e.id === original.id)).toEqual(original)
    expect.soft(view.activeEmpireId).toBe(expected.id)
    expect.soft(JSON.parse(localStorage.getItem('x4_station_active_view')!).activeEmpireId).toBe(expected.id)
    const restored = await reopen()
    expect(restored.store.activeEmpire).toEqual(expected)
    expect(restored.store.savedEmpires.list.find(e => e.id === original.id)).toEqual(original)
    expect(restored.view.activeEmpireId).toBe(expected.id)
  })

  it('SaveAs maps the selected second station to its new identity without switching workbench', () => {
    const { store, view } = existingEmpire()
    const second = store.createStation('Second')!
    store.updateStationModules(second, [{ id: ENERGY, count: 2 }])
    store.selectStation(second)
    store.saveEmpire()
    const original = JSON.parse(JSON.stringify(store.activeEmpire))
    const oldIds = original.stations.map((station: any) => station.id)
    expect(store.saveEmpireAs('Copy')).toBe(true)
    const copied = store.activeEmpire!
    expect(copied.id).not.toBe(original.id)
    expect(copied.stations.map(station => station.id).some(id => oldIds.includes(id))).toBe(false)
    expect(store.activeStationId).toBe(copied.stations[1]!.id)
    expect(store.activeStation!.name).toBe('Second')
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.production).toBe(6000)
    expect(view.activeEmpireWorkbench).toBe('station')
    expect(view.activeView).toBe('blueprint-production')
    expect(store.savedEmpires.list.find(e => e.id === original.id)).toEqual(original)
    expect(JSON.parse(localStorage.getItem('x4_station_active_view')!).activeEmpireStation).toBe(copied.stations[1]!.id)
  })

  it('SaveAs rebuilds derived caches for new station IDs and retains both independent flows', () => {
    const { store } = existingEmpire()
    const second = store.createStation('Second')!
    store.updateStationModules(second, [{ id: ENERGY, count: 2 }])
    store.saveEmpire()
    const oldIds = store.activeEmpire!.stations.map(station => station.id)
    store.saveEmpireAs('Copy')
    const copiedIds = store.activeEmpire!.stations.map(station => station.id)
    expect(oldIds.map(id => store.planningDerivedMap!.getCache(id))).toEqual([null, null])
    expect(copiedIds.map(id => store.planningDerivedMap!.getCache(id)!.productionFlows.find(flow => flow.wareId === 'energycells')!.production)).toEqual([3000, 6000])
    expect(store.planningDerivedMap!.getEmpireFlows().find(flow => flow.wareId === 'energycells')!.production).toBe(9000)
  })

  it.each(['save', 'saveAs'] as const)('%s synchronizes empire identity without switching away from another view', action => {
    const { store, view } = existingEmpire()
    store.createEmpire('B', 'B station')
    view.activeView = 'ship-build'
    if (action === 'save') store.saveEmpire()
    else store.saveEmpireAs('B copy')
    expect(view.activeView).toBe('ship-build')
    expect(view.activeEmpireId).toBe(store.activeEmpire!.id)
  })

  it('SaveAs from overview keeps no station selected and retains the overview workbench', () => {
    const { store, view } = existingEmpire()
    store.selectStation(null)
    store.saveEmpireAs('Overview copy')
    expect(store.activeStationId).toBeNull()
    expect(view.activeEmpireWorkbench).toBe('overview')
    expect(view.activeView).toBe('blueprint-production')
  })

  it('ordinary in-place save retains current station identity and existing calculation cache', () => {
    const { store, view } = existingEmpire()
    const id = store.activeStationId!
    const map = store.planningDerivedMap
    store.updateStationModules(id, [{ id: ENERGY, count: 3 }])
    store.saveEmpire()
    expect(store.activeStationId).toBe(id)
    expect(view.activeEmpireWorkbench).toBe('station')
    expect(store.planningDerivedMap).toBe(map)
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.production).toBe(9000)
  })
})
