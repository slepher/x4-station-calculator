/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import type { X4Module, X4Ware } from '@/types/x4'
import { StationStateMap, migrateStationSettings } from '@/store/state/StationStateMap'

const modulesMap: Record<string, X4Module> = {
  prod_energy: {
    id: 'prod_energy',
    wareId: 'energycells',
    nameId: 'prod_energy',
    name: 'Energy',
    type: 'production',
    method: 'default',
    group: 'production',
    race: 'default',
    buildTime: 0,
    buildCost: {},
    cycleTime: 60,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 },
    outputs: { energycells: 10 },
    inputs: {},
    color: '',
    color_rgb: '',
    tier: 1
  }
}

const waresMap: Record<string, X4Ware> = {
  energycells: {
    id: 'energycells',
    nameId: 'energycells',
    name: 'Energy Cells',
    transport: 'container',
    volume: 1,
    price: 10,
    minPrice: 8,
    maxPrice: 12,
    tier: 0,
    group: 'energy'
  }
}

describe('StationStateMap', () => {
  it('clone 后状态隔离', () => {
    const map = new StationStateMap()
    map.patch('A', {
      plannedModules: [{ id: 'prod_energy', count: 1 }],
      lockedWares: ['energycells'],
      warePriority: { energycells: 1 },
      settings: { racePreference: 'argon' } as any
    })

    map.clone('A', 'B')
    map.mutate('B', state => {
      state.plannedModules[0]!.count = 5
      state.lockedWares = []
      state.warePriority.energycells = 2
    })

    const a = map.get('A')!
    const b = map.get('B')!
    expect(a.plannedModules[0]!.count).toBe(1)
    expect(b.plannedModules[0]!.count).toBe(5)
    expect(a.lockedWares).toEqual(['energycells'])
    expect(b.lockedWares).toEqual([])
  })

  it('recompute 会更新 auto 与 groupedFlows', () => {
    const map = new StationStateMap()
    map.patch('A', {
      plannedModules: [{ id: 'prod_energy', count: 1 }],
      settings: { racePreference: 'argon' } as any
    })

    map.recompute('A', {
      modulesMap,
      waresMap,
      workforceConsumptionMap: { default: { idle: {}, busy: {} } }
    })

    const state = map.get('A')!
    expect(state.autoIndustryModules).toBeDefined()
    expect(state.groupedFlows?.flows.length).toBeGreaterThan(0)
    expect(state.groupedFlows?.rateGroups.positive.some(f => f.wareId === 'energycells')).toBe(true)
  })

  it('resourceBufferHours 迁移逻辑保留 0 并对 undefined 回退', () => {
    const keepZero = migrateStationSettings({ resourceBufferHours: 0 } as any)
    const fallback = migrateStationSettings({} as any)

    expect(keepZero.resourceBufferHours).toBe(0)
    expect(fallback.resourceBufferHours).toBe(2)
  })

  it('showEmpireGaps 进入持久化输入字段', () => {
    const map = new StationStateMap()
    map.patch('A', {
      settings: { showEmpireGaps: true, racePreference: 'argon' } as any
    })

    const persisted = map.toPersisted('A')!
    expect(persisted.settings.showEmpireGaps).toBe(true)
  })
})
