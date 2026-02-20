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
    modulesMap: {}
  }))
}))

import { useEmpireStore } from '@/store/useEmpireStore'
import type { V1StorageState, StationPlan } from '@/types/x4'

describe('EmpireStore - V2 数据结构', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('V2 数据结构初始化测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    expect(store.version).toBe(2)
    expect(store.empires).toBeDefined()
    expect(store.activeStationId).toBe(null)
    expect(store.activeEmpireId).toBeDefined()
    expect(store.empires.length).toBeGreaterThan(0)
  })

  it('V1 → V2 数据迁移测试', async () => {
    const v1Station: StationPlan = {
      id: 'test-station-1',
      name: 'Test Station',
      modules: [],
      settings: {
        sunlight: 100,
        useHQ: false,
        manualWorkforce: 0,
        workforcePercent: 100,
        workforceAuto: true,
        considerWorkforceForAutoFill: false,
        supplyWorkforceBonus: false,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        minersEnabled: false,
        internalSupply: false,
        racePreference: 'argon',
        resourceBufferHours: 1.0,
        primaryProductBufferHours: 12.0,
        secondaryProductBufferHours: 2.0,
        transportShipCapacity: 62000
      },
      lastUpdated: Date.now()
    }

    const v1Data: V1StorageState = {
      version: 1,
      activeId: 'test-station-1',
      list: [v1Station]
    }

    localStorage.setItem('x4_station_data', JSON.stringify(v1Data))
    localStorage.removeItem('x4_empire_data')

    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    expect(store.version).toBe(2)
    expect(store.empires.length).toBe(1)
    expect(store.activeStationId).toBe('test-station-1')
    
    const migratedStation = store.getStationById('test-station-1')
    expect(migratedStation).toBeDefined()
    expect(migratedStation?.type).toBe('industrial')
    
    expect(localStorage.getItem('x4_station_data')).toBeNull()
  })
})

describe('EmpireStore - 分站 CRUD 操作', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('分站 CRUD 操作测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const empire = store.activeEmpire
    expect(empire).toBeDefined()
    
    const initialCount = empire!.stations.length
    
    const newStation = store.createStation('New Test Station', 'industrial')
    expect(newStation).toBeDefined()
    expect(newStation?.name).toBe('New Test Station')
    expect(newStation?.type).toBe('industrial')
    expect(empire!.stations.length).toBe(initialCount + 1)
    
    const updated = store.renameStation(newStation!.id, 'Renamed Station')
    expect(updated).toBe(true)
    expect(store.getStationById(newStation!.id)?.name).toBe('Renamed Station')
    
    const duplicated = store.duplicateStation(newStation!.id)
    expect(duplicated).toBeDefined()
    expect(duplicated?.name).toBe('Renamed Station (Copy)')
    expect(empire!.stations.length).toBe(initialCount + 2)
    
    store.deleteStation(newStation!.id)
    expect(store.getStationById(newStation!.id)).toBeNull()
    expect(empire!.stations.length).toBe(initialCount + 1)
  })

  it('activeStation 计算属性测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    expect(store.activeStation).toBeNull()
    
    const newStation = store.createStation('Active Test Station', 'industrial')
    expect(store.activeStation).toBeDefined()
    expect(store.activeStation?.id).toBe(newStation?.id)
    
    store.selectStation(null)
    expect(store.activeStation).toBeNull()
  })
})

describe('EmpireStore - 帝国总工人需求计算', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('帝国总工人需求计算测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const industrialStations = store.industrialStations
    expect(Array.isArray(industrialStations)).toBe(true)
    
    const station1 = store.createStation('Industrial 1', 'industrial')
    const station2 = store.createStation('Industrial 2', 'industrial')
    const supplyStation = store.createStation('Supply 1', 'supply')
    
    expect(store.getStationById(station1!.id)?.type).toBe('industrial')
    expect(store.getStationById(station2!.id)?.type).toBe('industrial')
    expect(store.getStationById(supplyStation!.id)?.type).toBe('supply')
    
    const industrialCount = store.industrialStations.filter(
      item => item.station.id === station1?.id || item.station.id === station2?.id
    ).length
    expect(industrialCount).toBe(2)
  })
})

describe('EmpireStore - 站内补给开关', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('站内补给开关测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const station = store.createStation('Supply Test Station', 'industrial')
    expect(station).toBeDefined()
    
    expect(station?.settings.supplyWorkforceBonus).toBe(false)
    
    store.updateStationSettings(station!.id, { supplyWorkforceBonus: true })
    const updatedStation = store.getStationById(station!.id)
    expect(updatedStation?.settings.supplyWorkforceBonus).toBe(true)
    
    store.updateStationSettings(station!.id, { supplyWorkforceBonus: false })
    const finalStation = store.getStationById(station!.id)
    expect(finalStation?.settings.supplyWorkforceBonus).toBe(false)
  })

  it('工人运算开关测试', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const station = store.createStation('Workforce Test Station', 'industrial')
    expect(station).toBeDefined()
    
    expect(station?.settings.considerWorkforceForAutoFill).toBe(false)
    
    store.updateStationSettings(station!.id, { considerWorkforceForAutoFill: true })
    const updatedStation = store.getStationById(station!.id)
    expect(updatedStation?.settings.considerWorkforceForAutoFill).toBe(true)
  })
})

describe('EmpireStore - 分站标签排序与持久化边界', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('运行时重排应立即更新 activeEmpire.stations 顺序', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    store.createStation('A', 'industrial')
    store.createStation('B', 'industrial')
    store.createStation('C', 'industrial')

    const beforeOrder = store.activeEmpire!.stations.map(s => s.name)
    expect(beforeOrder).toEqual(['A', 'B', 'C'])

    const moved = store.activeEmpire!.stations.splice(2, 1)[0]!
    store.activeEmpire!.stations.splice(0, 0, moved)

    const afterOrder = store.activeEmpire!.stations.map(s => s.name)
    expect(afterOrder).toEqual(['C', 'A', 'B'])
  })

  it('重排不会自动保存，需显式调用 saveEmpire 才会持久化', async () => {
    const store = useEmpireStore()
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })

    store.createStation('A', 'industrial')
    store.createStation('B', 'industrial')
    store.createStation('C', 'industrial')
    store.saveEmpire()

    const savedBeforeReorder = JSON.parse(localStorage.getItem('x4_empire_data')!)
    const savedOrderBefore = savedBeforeReorder.list[0].stations.map((s: { name: string }) => s.name)
    expect(savedOrderBefore).toEqual(['A', 'B', 'C'])
    expect(store.isDirty).toBe(false)

    const moved = store.activeEmpire!.stations.splice(2, 1)[0]!
    store.activeEmpire!.stations.splice(0, 0, moved)

    expect(store.activeEmpire!.stations.map(s => s.name)).toEqual(['C', 'A', 'B'])
    expect(store.isDirty).toBe(true)

    const snapshotWithoutSave = JSON.parse(localStorage.getItem('x4_empire_data')!)
    const orderWithoutSave = snapshotWithoutSave.list[0].stations.map((s: { name: string }) => s.name)
    expect(orderWithoutSave).toEqual(['A', 'B', 'C'])

    store.saveEmpire()
    expect(store.isDirty).toBe(false)

    const snapshotAfterSave = JSON.parse(localStorage.getItem('x4_empire_data')!)
    const orderAfterSave = snapshotAfterSave.list[0].stations.map((s: { name: string }) => s.name)
    expect(orderAfterSave).toEqual(['C', 'A', 'B'])
  })
})
