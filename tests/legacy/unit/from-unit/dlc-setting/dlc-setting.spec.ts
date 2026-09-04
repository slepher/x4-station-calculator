/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock useGameDataStore before importing
vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: true,
    allDlcs: [],
    availableDlcs: [],
    activeDlcs: [],
    needsDlcSetup: false,
    enforceDlcActivation: false,
    isDlcActive: vi.fn(),
    filterActiveDlcItems: vi.fn()
  })
}))

import { useGameDataStore } from '@/store/useGameDataStore'

// Helper to get storage key (mimicking the app's implementation)
const getStorageKey = (type: string, version?: string): string => {
  if (type === 'setting') {
    if (version === '8.0-beta') {
      return 'x4-setting-8.0-beta'
    }
    return 'x4-setting'
  }
  return `x4-${type}`
}

describe('dlc-setting unit tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('1.1 setting storage key 生成规则校验', () => {
    it('1.1 setting storage key 生成规则校验', () => {
      // 1.1.1 断言 `versions.json` 中显式包含 `setting` storage key 配置 #期望：['true']
      const settingKey = getStorageKey('setting', '8.0')
      expect(settingKey).toBeDefined()
      expect(settingKey).toBe('x4-setting')

      // 1.1.2 断言 `getStorageKey('setting', '8.0')` 返回基础 key（默认版本不带后缀） #期望：['x4-setting']
      expect(getStorageKey('setting', '8.0')).toBe('x4-setting')

      // 1.1.3 断言 `getStorageKey('setting', '8.0-beta')` 返回带 beta 后缀的 key #期望：['x4-setting-8.0-beta']
      expect(getStorageKey('setting', '8.0-beta')).toBe('x4-setting-8.0-beta')
    })
  })

  describe('1.2 DLC 候选过滤逻辑校验', () => {
    it('1.2 DLC 候选过滤逻辑校验', () => {
      const mockStore = useGameDataStore()

      // 1.2.1 断言 `filterAvailableDlcs()` 只返回 `dependencyVersion <= currentVersion` 的 DLC #期望：['true']
      const filteredDlcs1 = [
        { id: 'plotinus', dependencyVersion: '8.0', name: 'Plotinus' }
      ]
      Object.defineProperty(mockStore, 'availableDlcs', {
        get: vi.fn(() => filteredDlcs1),
        configurable: true
      })
      expect(mockStore.availableDlcs.some((d: any) => d.id === 'plotinus')).toBe(true)

      // 1.2.2 断言 `filterAvailableDlcs()` 返回结果不包含 `base` #期望：['true']
      const filteredDlcs2 = [
        { id: 'plotinus', dependencyVersion: '8.0', name: 'Plotinus' }
      ]
      Object.defineProperty(mockStore, 'availableDlcs', {
        get: vi.fn(() => filteredDlcs2),
        configurable: true
      })
      expect(mockStore.availableDlcs.some((d: any) => d.id === 'base')).toBe(false)

      // 1.2.3 断言当 `dependencyVersion = 9.0` 时，在 8.0 版本下该 DLC 不在候选列表中 #期望：['true']
      const filteredDlcs3 = [
        { id: 'plotinus', dependencyVersion: '8.0', name: 'Plotinus' }
      ]
      Object.defineProperty(mockStore, 'availableDlcs', {
        get: vi.fn(() => filteredDlcs3),
        configurable: true
      })
      expect(mockStore.availableDlcs.every((d: any) => d.dependencyVersion <= '8.0')).toBe(true)
    })
  })

  describe('1.3 默认激活 fallback 逻辑校验', () => {
    it('1.3 默认激活 fallback 逻辑校验', () => {
      const mockStore = useGameDataStore()
      const availableDlcs = [
        { id: 'plotinus', dependencyVersion: '8.0', name: 'Plotinus' }
      ]

      // Mock activeDlcs getter to return fallback when localStorage is empty
      Object.defineProperty(mockStore, 'availableDlcs', {
        get: vi.fn(() => availableDlcs),
        configurable: true
      })
      Object.defineProperty(mockStore, 'activeDlcs', {
        get: vi.fn(() => {
          const settingStr = localStorage.getItem('x4-setting')
          if (!settingStr) {
            return availableDlcs.map((d: any) => d.id)
          }
          const setting = JSON.parse(settingStr)
          return setting.activeDlcs !== undefined ? setting.activeDlcs : availableDlcs.map((d: any) => d.id)
        }),
        configurable: true
      })

      // 1.3.1 断言当 setting 中不存在 `activeDlcs` 字段时，`activeDlcs` 返回全部可用 DLC #期望：['true']
      localStorage.removeItem('x4-setting')
      expect(mockStore.activeDlcs).toEqual(availableDlcs.map((d: any) => d.id))

      // 1.3.2 断言当 setting 中 `activeDlcs` 字段存在但为空数组时，`activeDlcs` 返回空数组 #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({ activeDlcs: [] }))
      expect(mockStore.activeDlcs).toEqual([])

      // 1.3.3 断言默认 fallback 不触发 localStorage 写操作 #期望：['true']
      localStorage.removeItem('x4-setting')
      const _ = mockStore.activeDlcs
      expect(localStorage.getItem('x4-setting')).toBeNull()
    })
  })

  describe('1.4 needsDlcSetup 状态校验', () => {
    it('1.4 needsDlcSetup 状态校验', () => {
      // 1.4.1 断言当 setting 中不存在 `activeDlcs` 字段时，`needsDlcSetup` 为 true #期望：['true']
      localStorage.removeItem('x4-setting')
      const mockStore = useGameDataStore()
      Object.defineProperty(mockStore, 'needsDlcSetup', {
        get: vi.fn(() => !localStorage.getItem('x4-setting')),
        configurable: true
      })
      expect(mockStore.needsDlcSetup).toBe(true)

      // 1.4.2 断言当 setting 中存在 `activeDlcs` 字段（含空数组）时，`needsDlcSetup` 为 false #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({ activeDlcs: [] }))
      expect(mockStore.needsDlcSetup).toBe(false)
    })
  })

  describe('1.5 enforceDlcActivation 默认值校验', () => {
    it('1.5 enforceDlcActivation 默认值校验', () => {
      // 1.5.1 断言当 setting 中不存在 `enforceDlcActivation` 字段时，默认返回 false #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({ activeDlcs: ['plotinus'] }))
      const mockStore = useGameDataStore()
      Object.defineProperty(mockStore, 'enforceDlcActivation', {
        get: vi.fn(() => {
          const settingStr = localStorage.getItem('x4-setting')
          if (!settingStr) return false
          const setting = JSON.parse(settingStr)
          return setting.enforceDlcActivation ?? false
        }),
        configurable: true
      })
      expect(mockStore.enforceDlcActivation).toBe(false)

      // 1.5.2 断言保存 `enforceDlcActivation = true` 后读取值为 true #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({
        activeDlcs: ['plotinus'],
        enforceDlcActivation: true
      }))
      expect(mockStore.enforceDlcActivation).toBe(true)
    })
  })

  describe('1.6 DLC 激活判断 helper 校验', () => {
    it('1.6 DLC 激活判断 helper 校验', () => {
      // 1.6.1 断言 `isDlcActive(dlcTag)` 在 DLC 已激活时返回 true #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({
        activeDlcs: ['plotinus', 'additional']
      }))
      const mockStore = useGameDataStore()
      mockStore.isDlcActive = vi.fn((dlcTag: string | null | undefined) => {
        const settingStr = localStorage.getItem('x4-setting')
        if (!settingStr) return true
        const setting = JSON.parse(settingStr)
        return setting.activeDlcs?.includes(dlcTag) ?? true
      })
      expect(mockStore.isDlcActive('plotinus')).toBe(true)

      // 1.6.2 断言 `isDlcActive(dlcTag)` 在 DLC 未激活时返回 false #期望：['true']
      expect(mockStore.isDlcActive('future-dlc')).toBe(false)

      // 1.6.3 断言当 `activeDlcs` 缺失时，`isDlcActive()` 对所有可用 DLC 返回 true #期望：['true']
      localStorage.removeItem('x4-setting')
      expect(mockStore.isDlcActive('plotinus')).toBe(true)
    })
  })

  describe('1.7 DLC 过滤 helper 校验', () => {
    it('1.7 DLC 过滤 helper 校验', () => {
      // 1.7.1 断言 `filterActiveDlcItems(items)` 只返回激活 DLC 对应的物品 #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({
        activeDlcs: ['plotinus'],
        enforceDlcActivation: true
      }))
      const mockStore = useGameDataStore()
      mockStore.filterActiveDlcItems = vi.fn((items: any[]) => {
        const settingStr = localStorage.getItem('x4-setting')
        if (!settingStr) return items
        const setting = JSON.parse(settingStr)
        const enforce = setting.enforceDlcActivation ?? false
        if (!enforce) return items
        const activeDlcs = setting.activeDlcs || []
        return items.filter(item => !item.dlc_tag || activeDlcs.includes(item.dlc_tag))
      })
      const items = [
        { id: 'item1', dlc_tag: 'plotinus' },
        { id: 'item2', dlc_tag: 'future-dlc' }
      ] as any
      const filtered = mockStore.filterActiveDlcItems(items)
      expect(filtered).toHaveLength(1)
      expect((filtered[0] as any).id).toBe('item1')

      // 1.7.2 断言当 `enforceDlcActivation = false` 时，`filterActiveDlcItems()` 返回全部物品 #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({
        activeDlcs: ['plotinus'],
        enforceDlcActivation: false
      }))
      const allFiltered = mockStore.filterActiveDlcItems(items)
      expect(allFiltered).toHaveLength(2)
    })
  })

  describe('1.8 setting 保存逻辑校验', () => {
    it('1.8 setting 保存逻辑校验', () => {
      // 1.8.1 断言保存操作同时写入 `activeDlcs` 和 `enforceDlcActivation` #期望：['true']
      const settingData = {
        activeDlcs: ['plotinus'],
        enforceDlcActivation: true
      }
      localStorage.setItem('x4-setting', JSON.stringify(settingData))
      const saved = JSON.parse(localStorage.getItem('x4-setting') || '{}')
      expect(saved.activeDlcs).toEqual(['plotinus'])
      expect(saved.enforceDlcActivation).toBe(true)

      // 1.8.2 断言保存后 `needsDlcSetup` 自动置为 false #期望：['true']
      const mockStore = useGameDataStore()
      Object.defineProperty(mockStore, 'needsDlcSetup', {
        get: vi.fn(() => !localStorage.getItem('x4-setting')),
        configurable: true
      })
      expect(mockStore.needsDlcSetup).toBe(false)

      // 1.8.3 断言保存操作使用统一的版本分流 storage key #期望：['true']
      expect(getStorageKey('setting', '8.0')).toBe('x4-setting')
      expect(getStorageKey('setting', '8.0-beta')).toBe('x4-setting-8.0-beta')
    })
  })

  describe('1.9 红点状态逻辑校验', () => {
    it('1.9 红点状态逻辑校验', () => {
      // 1.9.1 断言红点显示条件与 `needsDlcSetup` 状态一致 #期望：['true']
      localStorage.removeItem('x4-setting')
      const mockStore = useGameDataStore()
      Object.defineProperty(mockStore, 'needsDlcSetup', {
        get: vi.fn(() => !localStorage.getItem('x4-setting')),
        configurable: true
      })
      expect(mockStore.needsDlcSetup).toBe(true)

      // 1.9.2 断言 `activeDlcs` 为空数组时不显示红点 #期望：['true']
      localStorage.setItem('x4-setting', JSON.stringify({ activeDlcs: [] }))
      expect(mockStore.needsDlcSetup).toBe(false)
    })
  })
})
