/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
    getStorageKey: vi.fn(() => 'x4_empire_data'),
    waresMap: {},
    modulesMap: {}
  }))
}))

import { useEmpireStore } from '@/store/useEmpireStore'

describe('EmpireStore deleteSector save binding cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('deletes group binding, connected references, and station sector refs together', async () => {
    localStorage.setItem('x4_empire_data', JSON.stringify({
      version: 2,
      activeId: 'empire-1',
      activeStationId: null,
      list: [{
        id: 'empire-1',
        name: 'Empire',
        sectors: [
          { id: 'a', name: 'A', order: 0 },
          { id: 'b', name: 'B', order: 1 }
        ],
        sectorLinks: [],
        stations: [
          { id: 's-1', name: 'Station 1', type: 'industrial', count: 1, modules: [], settings: {}, lastUpdated: 1, lockedWares: [], warePriority: {}, sectorId: 'a' }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            active: true,
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'a',
                sectorMacro: 'anchor_a',
                jumpRange: 2,
                coverageSectorMacros: [],
                connectedSectorGroupIds: ['b'],
                stationBindings: [],
                tradestationBinding: undefined
              },
              {
                sectorGroupId: 'b',
                sectorMacro: 'anchor_b',
                jumpRange: 2,
                coverageSectorMacros: [],
                connectedSectorGroupIds: ['a'],
                stationBindings: [],
                tradestationBinding: undefined
              }
            ]
          }
        ]
      }]
    }))

    const store = useEmpireStore()
    await store.initialize()

    expect(store.deleteSector('a')).toBe(true)

    const plan = store.activeEmpire?.saveBindings?.find((item) => item.gameGuid === 'g-1')
    expect(plan?.groupBindings.map((item) => item.sectorGroupId)).toEqual(['b'])
    expect(plan?.groupBindings[0]?.connectedSectorGroupIds || []).toEqual([])
    expect(store.activeEmpire?.stations[0]?.sectorId).toBe(null)
  })
})
