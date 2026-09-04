/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: true,
    getStorageKey: vi.fn(() => 'x4_empire_data_test'),
    waresMap: {},
    modulesMap: {}
  }))
}))

import { useEmpireStore } from '@/store/useEmpireStore'

describe('empire empty dirty state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('empty empire 即便修改名称也不应 dirty', async () => {
    const store = useEmpireStore()
    await store.initialize()

    store.activeEmpire!.sectors = []
    store.updateEmpireName('Draft')

    expect(store.isEmptyForSave()).toBe(true)
    expect(store.isDirty).toBe(false)
  })
})
