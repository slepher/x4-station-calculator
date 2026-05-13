import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    isReady: true,
    initialize: vi.fn(),
    getStorageKey: vi.fn(() => 'x4_logic_flow_plans_test'),
    waresMap: {},
    modulesMap: {},
    modulesByMacroId: {}
  }))
}))

describe('Logic Flow empty dirty state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      clear: vi.fn()
    })
  })

  it('无存档初始化时空工作区 isDirty 为 false', async () => {
    const store = useLogicFlowStore()
    await store.init()
    expect(store.isDirty).toBe(false)
  })

  it('clearAll 回到空工作区后 isDirty 为 false', () => {
    const store = useLogicFlowStore()
    store.lastSavedSnapshot = JSON.stringify({ groups: [], settings: { isDefaultLocked: true } })
    store.addGroup('industrial', 'default', undefined, false)
    expect(store.isDirty).toBe(true)

    store.clearAll()
    expect(store.isDirty).toBe(false)
  })

  it('空工作区即便修改设置也不应 dirty', () => {
    const store = useLogicFlowStore()
    store.lastSavedSnapshot = JSON.stringify({ groups: [], settings: { isDefaultLocked: true } })

    store.settings.isDefaultLocked = false

    expect(store.isDirty).toBe(false)
  })
})
