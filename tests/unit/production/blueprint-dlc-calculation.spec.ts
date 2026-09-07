// @vitest-environment jsdom
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { analyzeStation } from '@/store/logic/analyzeStation'
import type { X4Module, X4Ware } from '@/types/x4'

vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => useTestGame() }))

function module(id: string, dlc_tag: string, fields: Partial<X4Module>): X4Module {
  return { id, macroId: id, name: id, type: 'production', race: 'argon', dlc_tag,
    outputs: {}, inputs: {}, buildCost: { hullparts: 2 }, buildTime: 5,
    workforce: { needed: 0, capacity: 0, maxBonus: 0 }, ...fields } as X4Module
}
const modules = {
  energy: module('energy', 'terran', { outputs: { energycells: 3000 }, workforce: { needed: 10, capacity: 0, maxBonus: 0 } }),
  product: module('product', 'base', { outputs: { hullparts: 10 }, inputs: { energycells: 100 }, workforce: { needed: 20, capacity: 0, maxBonus: 0 } }),
  habitat: module('habitat', 'terran', { type: 'habitation', workforce: { needed: 0, capacity: 100, maxBonus: 0 } }),
  storage: module('storage', 'terran', { type: 'storage', cargo: { type: 'container', capacity: 1000000 } }),
  pier: module('pier', 'terran', { type: 'pier', macroId: 'harbor_03', dockingCount: 3 })
}
const wares = Object.fromEntries(['energycells', 'hullparts'].map((id, index) => [id, {
  id, name: id, tier: index, transport: 'container', volume: 2, price: 10, minPrice: 10, maxPrice: 10
}])) as Record<string, X4Ware>
const useTestGame = defineStore('blueprint-dlc-test-game', {
  state: () => ({
    isReady: true, modulesMap: modules, waresMap: wares, workforceConsumptionMap: {},
    enforceDlcActivation: false, activeDlcs: ['terran'], maps: { sectors: {} }, mapResources: { sectors: {} }
  }),
  actions: {
    isDlcActive(tag: string) { return tag === 'base' || this.activeDlcs.includes(tag) },
    getStorageKey() { return 'blueprint-dlc-unit' },
    findModuleForWare() { return null }
  }
})

function setup() {
  const game = useTestGame()
  const store = useBlueprintProductionStore()
  store.createEmpire('DLC unit', 'One')
  return { game, store }
}

describe('Blueprint DLC calculation policy', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('excludes inactive production, cost, workforce and volume, retains plans and restores through real watchers', async () => {
    const { game, store } = setup()
    store.settingActions.updateSetting('considerWorkforceForAutoFill', true)
    store.moduleActions.updatePlannedModules([{ id: 'energy', count: 1 }])
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.production).toBe(3000)
    expect(store.stationState!.actualWorkforce).toBe(10)
    game.activeDlcs = []
    game.enforceDlcActivation = true
    await nextTick()
    expect(store.stationState!.plannedModules).toEqual([{ id: 'energy', count: 1 }])
    expect(store.activeStation!.modules).toEqual([{ id: 'energy', count: 1 }])
    expect(store.stationState!.modules).toEqual([])
    expect(store.stationState!.productionFlows).toEqual([])
    expect(store.stationState!.actualWorkforce).toBe(0)
    const analysis = analyzeStation(store.stationState!.modules, modules, wares, 0.5)
    expect([analysis.totalCost, analysis.totalVolume, analysis.totalNeeded, analysis.totalCapacity]).toEqual([0, 0, 0, 0])
    game.enforceDlcActivation = false
    await nextTick()
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.production).toBe(3000)
    game.enforceDlcActivation = true
    await nextTick()
    game.activeDlcs.push('terran')
    await nextTick()
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.production).toBe(3000)
    expect(store.stationState!.plannedModules).toEqual([{ id: 'energy', count: 1 }])
  })

  it('updates all station caches and empire aggregation on active DLC content changes', async () => {
    const { game, store } = setup()
    const first = store.activeStationId!
    store.updateStationModules(first, [{ id: 'energy', count: 1 }])
    const second = store.createStation('Two')!
    store.updateStationModules(second, [{ id: 'energy', count: 2 }])
    game.enforceDlcActivation = true
    await nextTick()
    expect(store.planningDerivedMap!.getEmpireFlows().find(flow => flow.wareId === 'energycells')!.production).toBe(9000)
    game.activeDlcs.splice(0)
    await nextTick()
    expect(store.planningDerivedMap!.getEmpireFlows()).toEqual([])
    expect(store.planningDerivedMap!.getCache(first)!.productionFlows).toEqual([])
    expect(store.planningDerivedMap!.getCache(second)!.productionFlows).toEqual([])
    expect(store.empireDerivedProductionFlows).toEqual([])
    expect(store.empireCurrentNetProduction).toEqual({})
    game.activeDlcs.push('terran')
    await nextTick()
    expect(store.planningDerivedMap!.getEmpireFlows().find(flow => flow.wareId === 'energycells')!.production).toBe(9000)
  })

  it('filters automatic producer, habitat, storage and pier candidates together while keeping base analysis', async () => {
    const { game, store } = setup()
    store.settingActions.updateSetting('considerWorkforceForAutoFill', true)
    store.moduleActions.updatePlannedModules([{ id: 'product', count: 1 }])
    expect(store.stationState!.autoIndustryModules).toEqual([{ id: 'energy', count: 1 }])
    expect(store.stationState!.autoHabitationModules).toEqual([{ id: 'habitat', count: 1 }])
    expect(store.stationState!.autoInfrastructureModules.map(item => item.id).sort()).toEqual(['pier', 'storage'])
    game.enforceDlcActivation = true
    game.activeDlcs = []
    await nextTick()
    expect(store.stationState!.autoIndustryModules).toEqual([])
    expect(store.stationState!.autoHabitationModules).toEqual([])
    expect(store.stationState!.autoInfrastructureModules).toEqual([])
    expect(store.stationState!.modules).toEqual([{ id: 'product', count: 1 }])
    const analysis = analyzeStation(store.stationState!.modules, modules, wares, 0.5)
    expect([analysis.totalCost, analysis.totalVolume, analysis.totalNeeded, analysis.totalCapacity]).toEqual([20, 4, 20, 0])
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.consumption).toBe(100)
    game.activeDlcs = ['terran']
    await nextTick()
    expect(store.stationState!.autoIndustryModules).toEqual([{ id: 'energy', count: 1 }])
    expect(store.stationState!.autoHabitationModules).toEqual([{ id: 'habitat', count: 1 }])
    expect(store.stationState!.autoInfrastructureModules.map(item => item.id).sort()).toEqual(['pier', 'storage'])
  })

  it('keeps raw planned modules through active mutations and map initialization under an existing restriction', async () => {
    const { game, store } = setup()
    game.activeDlcs = []
    game.enforceDlcActivation = true
    await nextTick()
    const planned = [{ id: 'energy', count: 2 }, { id: 'habitat', count: 1 }, { id: 'storage', count: 1 }, { id: 'pier', count: 1 }]
    store.moduleActions.updatePlannedModules(planned)
    expect(store.stationState!.modules).toEqual([])
    expect(store.stationState!.plannedModules).toEqual(planned)
    store.updateStationModules(store.activeStationId!, [...planned, { id: 'product', count: 1 }])
    expect(store.stationState!.modules).toEqual([{ id: 'product', count: 1 }])
    store.initializeAllStationDerived()
    expect(store.stationState!.modules).toEqual([{ id: 'product', count: 1 }])
    expect(store.activeStation!.modules).toEqual([...planned, { id: 'product', count: 1 }])
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'hullparts')!.production).toBe(10)
    expect(store.stationState!.productionFlows.find(flow => flow.wareId === 'energycells')!.consumption).toBe(100)
  })
})
