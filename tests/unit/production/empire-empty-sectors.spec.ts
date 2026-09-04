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

describe('EmpireStore empty sectors behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('新 empire 初始化时不应自动创建默认星区', async () => {
    const store = useEmpireStore()
    await store.initialize()

    expect(store.activeEmpire?.sectors || []).toEqual([])
    expect(store.sectors).toEqual([])
    expect(store.isEmptyForSave()).toBe(true)
  })

  it('加载空 sectors 存档时不应自动补默认星区', async () => {
    localStorage.setItem('x4_empire_data', JSON.stringify({
      version: 2,
      activeId: 'empire-1',
      activeStationId: null,
      list: [{
        id: 'empire-1',
        name: 'Empty Empire',
        sectors: [],
        sectorLinks: [],
        stations: []
      }]
    }))

    const store = useEmpireStore()
    await store.initialize()

    expect(store.activeEmpire?.sectors || []).toEqual([])
    expect(store.sectors).toEqual([])
    expect(store.isEmptyForSave()).toBe(true)
  })
})
