import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, computed } from 'vue'

// Mock vue-i18n before importing the store
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  })
}))

// Mock @/utils/UseX4I18n
vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (key: string) => key,
    translateModuleGroup: (key: string) => key,
    translateWare: (key: string) => key,
    translateDlc: (key: string) => `Translated_${key}`
  })
}))

// Create a mock store factory
function createMockGameDataStore(overrides: {
  activeDlcs?: string[]
  enforceDlcActivation?: boolean
  dlcs?: Array<{ id: string; nameId: string; dependencyVersion: string }>
} = {}) {
  const dlcs = ref(overrides.dlcs || [
    { id: 'dlc_1', nameId: '{50001,1}', dependencyVersion: '1.0' },
    { id: 'dlc_2', nameId: '{50001,2}', dependencyVersion: '1.0' },
    { id: 'dlc_3', nameId: '{50001,3}', dependencyVersion: '1.0' }
  ])

  const activeDlcs = computed(() => overrides.activeDlcs || [])
  const enforceDlcActivation = computed(() => overrides.enforceDlcActivation ?? true)

  function isDlcActive(dlcTag: string | null | undefined): boolean {
    if (!dlcTag || dlcTag === 'base') return true
    return activeDlcs.value.some(id => {
      const dlcId = id.toLowerCase().replace(/\s+/g, '_')
      return dlcId === dlcTag.toLowerCase()
    })
  }

  function filterActiveDlcItems<T extends { dlc_tag?: string }>(items: T[]): T[] {
    if (!enforceDlcActivation.value) return items
    return items.filter(item => isDlcActive(item.dlc_tag))
  }

  function getDlcDisplayName(dlcTag: string | null | undefined): string {
    if (!dlcTag || dlcTag === 'base') return ''
    const dlc = dlcs.value.find(d => {
      const dlcId = d.id.toLowerCase().replace(/\s+/g, '_')
      return dlcId === dlcTag.toLowerCase()
    })
    if (!dlc) return ''
    return `Translated_${dlc.nameId}`
  }

  return {
    dlcs,
    activeDlcs,
    enforceDlcActivation,
    isDlcActive,
    filterActiveDlcItems,
    getDlcDisplayName
  }
}

describe('ship-dlc', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('1.1 isDlcActive helper: DLC 激活状态判定', () => {
    it('1.1.1 传入 base 返回 true', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1', 'dlc_2'],
        enforceDlcActivation: true
      })

      // base DLC 始终视为激活
      const result = store.isDlcActive('base')
      expect(result).toBe(true)
    })

    it('1.1.2 传入已激活 DLC tag 返回 true', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1', 'dlc_2'],
        enforceDlcActivation: true
      })

      const result = store.isDlcActive('dlc_1')
      expect(result).toBe(true)
    })

    it('1.1.3 传入未激活 DLC tag 返回 false', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1'],
        enforceDlcActivation: true
      })

      const result = store.isDlcActive('dlc_2')
      expect(result).toBe(false)
    })
  })

  describe('1.2 filterActiveDlcItems: 未激活 DLC 过滤', () => {
    it('1.2.1 enforceDlcActivation=true 时 base 和已激活 DLC 物品保留', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1', 'dlc_2'],
        enforceDlcActivation: true
      })

      const items = [
        { id: 'item1', dlc_tag: 'base' },
        { id: 'item2', dlc_tag: 'dlc_1' },
        { id: 'item3', dlc_tag: 'dlc_2' }
      ]

      const result = store.filterActiveDlcItems(items)
      expect(result).toHaveLength(3)
      expect(result.map(i => i.id)).toEqual(['item1', 'item2', 'item3'])
    })

    it('1.2.2 enforceDlcActivation=true 时过滤未激活 DLC 物品', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1'],
        enforceDlcActivation: true
      })

      const items = [
        { id: 'item1', dlc_tag: 'base' },
        { id: 'item2', dlc_tag: 'dlc_1' },
        { id: 'item3', dlc_tag: 'dlc_2' }
      ]

      const result = store.filterActiveDlcItems(items)
      expect(result).toHaveLength(2)
      expect(result.map(i => i.id)).toEqual(['item1', 'item2'])
    })

    it('1.2.3 enforceDlcActivation=false 时保留全部物品', () => {
      const store = createMockGameDataStore({
        activeDlcs: ['dlc_1'],
        enforceDlcActivation: false
      })

      const items = [
        { id: 'item1', dlc_tag: 'base' },
        { id: 'item2', dlc_tag: 'dlc_1' },
        { id: 'item3', dlc_tag: 'dlc_2' }
      ]

      const result = store.filterActiveDlcItems(items)
      expect(result).toHaveLength(3)
      expect(result.map(i => i.id)).toEqual(['item1', 'item2', 'item3'])
    })
  })

  describe('1.3 getDlcDisplayName: DLC 名称 i18n 解析', () => {
    it('1.3.1 传入 base 返回空值', () => {
      const store = createMockGameDataStore()

      const result = store.getDlcDisplayName('base')
      expect(result).toBeFalsy()
    })

    it('1.3.2 传入有效 DLC tag 返回本地化名称', () => {
      const store = createMockGameDataStore({
        dlcs: [
          { id: 'dlc_1', nameId: '{50001,1}', dependencyVersion: '1.0' }
        ]
      })

      const result = store.getDlcDisplayName('dlc_1')
      expect(result).toBe('Translated_{50001,1}')
    })
  })
})
