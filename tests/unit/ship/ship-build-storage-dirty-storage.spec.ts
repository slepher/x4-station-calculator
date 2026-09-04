/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const STORAGE_KEY = 'x4_ship_blueprints'
const ODACHI_ID = 'ship_ter_m_corvette_02_a'

describe('ship-build-storage: storage dirty behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('载入已保存蓝图后修改 U 槽无人机应触发 dirty，且未保存前不落盘', async () => {
    const setupStore = useShipBuildStore()
    setupStore.setSelectedShipId(ODACHI_ID)
    setupStore.saveAsBlueprint('Drone Dirty Check')
    const activeId = setupStore.savedBlueprints.activeBlueprintId
    expect(activeId).toBeTruthy()

    setActivePinia(createPinia())
    const store = useShipBuildStore()
    await Promise.resolve()

    expect(store.isDirty).toBe(false)
    store.updateBlueprintStorage({
      deployables: [],
      countermeasure: null,
      drones: [{ id: 'drone_transport_mk1', name: '', count: 1 }],
      missiles: []
    })
    expect(store.isDirty).toBe(true)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const persistedActive = (persisted.ships || [])
      .flatMap((bucket: any) => bucket.blueprints || [])
      .find((bp: any) => bp.id === activeId)
    expect(persistedActive).toBeTruthy()
    expect((persistedActive.storage?.drones || []).length).toBe(0)
  })

  it('载入已保存蓝图后修改 C 槽消耗品应触发 dirty，且未保存前不落盘', async () => {
    const setupStore = useShipBuildStore()
    setupStore.setSelectedShipId(ODACHI_ID)
    setupStore.saveAsBlueprint('Consumable Dirty Check')
    const activeId = setupStore.savedBlueprints.activeBlueprintId
    expect(activeId).toBeTruthy()

    setActivePinia(createPinia())
    const store = useShipBuildStore()
    await Promise.resolve()

    expect(store.isDirty).toBe(false)
    store.updateBlueprintStorage({
      deployables: [{ id: 'deployable_satellite_01_mk1', name: '', count: 1 }],
      countermeasure: null,
      drones: [],
      missiles: []
    })
    expect(store.isDirty).toBe(true)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const persistedActive = (persisted.ships || [])
      .flatMap((bucket: any) => bucket.blueprints || [])
      .find((bp: any) => bp.id === activeId)
    expect(persistedActive).toBeTruthy()
    expect((persistedActive.storage?.deployables || []).length).toBe(0)
  })
})
