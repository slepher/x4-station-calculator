/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: true,
    waresMap: ref({}),
    modulesMap: ref({}),
    localizedModulesMap: ref({}),
    localizedModuleGroupsMap: ref({}),
    medicalConsumptionMap: ref({}),
    searchQuery: ref(''),
    currentLocale: ref('en')
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    isReady: true,
    isDirty: false,
    activeStation: null,
    activeStationId: null
  })
}))

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    init: vi.fn()
  })
}))

import { useStationStore } from '@/store/useStationStore'

describe('showEmpireGaps 设置', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认值为 false', () => {
    const store = useStationStore()
    expect(store.settings.showEmpireGaps).toBe(false)
  })

  it('保存方案时写入 localStorage', () => {
    const store = useStationStore()
    store.settings.showEmpireGaps = true
    store.saveCurrentPlan('Test Plan')

    const plan = store.savedPlans.list.find((item: any) => item.name === 'Test Plan')
    expect(plan).toBeDefined()
    expect(plan?.settings.showEmpireGaps).toBe(true)
  })
})
