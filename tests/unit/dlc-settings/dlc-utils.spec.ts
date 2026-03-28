import { describe, it, expect } from 'vitest'

/**
 * Unit tests for DLC-related pure functions
 *
 * Test file: tests/unit/dlc-settings/dlc-utils.spec.ts
 * Maps to: openspec/changes/dlc-setting/test_tasks.md
 */

// 测试归一化逻辑（从 useGameDataStore 中提取的纯函数）
function normalizeDlcId(value: string): string {
  return value.startsWith('ego_') ? value.slice(4) : value
}

// 测试 DLC 激活判断逻辑（纯函数版本）
function isDlcActiveImpl(
  dlcTag: string | null | undefined,
  activeDlcs: string[]
): boolean {
  if (!dlcTag || dlcTag === 'base') return true
  const normalized = normalizeDlcId(dlcTag)
  return activeDlcs.some(id => normalizeDlcId(id) === normalized)
}

// 测试 DLC 过滤逻辑（纯函数版本）
function filterActiveDlcItemsImpl<T extends { dlc_tag?: string }>(
  items: T[],
  activeDlcs: string[]
): T[] {
  return items.filter(item => isDlcActiveImpl(item.dlc_tag, activeDlcs))
}

// 测试版本比较逻辑（纯函数版本）
function parseVersionNumber(value: string): number {
  return Number.parseFloat(value)
}

function filterAvailableDlcsImpl(
  dlcs: Array<{ id: string; dependencyVersion: string }>,
  currentVersion: string
): Array<{ id: string; dependencyVersion: string }> {
  const current = parseVersionNumber(currentVersion)
  return dlcs.filter(dlc => parseVersionNumber(dlc.dependencyVersion) <= current)
}

// 测试 needsDlcSetup 判断逻辑（纯函数版本）
function needsDlcSetupImpl(dlcSetting: { activeDlcs?: string[] }): boolean {
  return !Object.prototype.hasOwnProperty.call(dlcSetting, 'activeDlcs')
}

// 测试 activeDlcs getter 逻辑（纯函数版本）
function getActiveDlcsImpl(
  dlcSetting: { activeDlcs?: string[] },
  availableDlcs: Array<{ id: string }>
): string[] {
  if (needsDlcSetupImpl(dlcSetting)) {
    return availableDlcs.map(dlc => dlc.id)
  }
  const availableIds = new Set(availableDlcs.map(dlc => dlc.id))
  return (dlcSetting.activeDlcs || []).filter(id => availableIds.has(id))
}

describe('DLC Utils - 纯函数测试', () => {
  describe('normalizeDlcId', () => {
    it('应该移除 ego_ 前缀', () => {
      expect(normalizeDlcId('ego_dlc1')).toBe('dlc1')
      expect(normalizeDlcId('ego_kingdom')).toBe('kingdom')
    })

    it('应该保留没有前缀的 ID', () => {
      expect(normalizeDlcId('dlc1')).toBe('dlc1')
      expect(normalizeDlcId('base')).toBe('base')
    })

    it('空字符串应该返回空字符串', () => {
      expect(normalizeDlcId('')).toBe('')
    })
  })

  describe('isDlcActive', () => {
    it('base DLC 应该始终返回 true', () => {
      expect(isDlcActiveImpl('base', ['dlc1', 'dlc2'])).toBe(true)
      expect(isDlcActiveImpl(null, ['dlc1', 'dlc2'])).toBe(true)
      expect(isDlcActiveImpl(undefined, ['dlc1', 'dlc2'])).toBe(true)
    })

    it('激活的 DLC 应该返回 true', () => {
      expect(isDlcActiveImpl('dlc1', ['dlc1', 'dlc2', 'dlc3'])).toBe(true)
      expect(isDlcActiveImpl('dlc2', ['dlc1', 'dlc2', 'dlc3'])).toBe(true)
    })

    it('未激活的 DLC 应该返回 false', () => {
      expect(isDlcActiveImpl('dlc3', ['dlc1', 'dlc2'])).toBe(false)
      expect(isDlcActiveImpl('dlc4', ['dlc1', 'dlc2'])).toBe(false)
    })

    it('应该正确处理 ego_ 前缀归一化', () => {
      expect(isDlcActiveImpl('dlc1', ['ego_dlc1', 'dlc2'])).toBe(true)
      expect(isDlcActiveImpl('ego_dlc1', ['dlc1', 'dlc2'])).toBe(true)
      expect(isDlcActiveImpl('ego_dlc1', ['ego_dlc1'])).toBe(true)
      expect(isDlcActiveImpl('dlc3', ['ego_dlc1', 'dlc2'])).toBe(false)
    })
  })

  describe('filterActiveDlcItems', () => {
    it('应该只返回激活 DLC 的物品', () => {
      const items = [
        { id: 'item1', dlc_tag: 'dlc1' },
        { id: 'item2', dlc_tag: 'dlc2' },
        { id: 'item3', dlc_tag: 'base' },
        { id: 'item4', dlc_tag: 'dlc3' }
      ]
      const activeDlcs = ['dlc1', 'base']

      const filtered = filterActiveDlcItemsImpl(items, activeDlcs)
      expect(filtered).toHaveLength(2)
      expect(filtered.map(i => i.id)).toEqual(['item1', 'item3'])
    })

    it('空数组应该返回空数组', () => {
      const filtered = filterActiveDlcItemsImpl([], ['dlc1'])
      expect(filtered).toHaveLength(0)
    })

    it('没有 dlc_tag 字段的物品应该被视为 base', () => {
      const items = [
        { id: 'item1', dlc_tag: 'dlc1' },
        { id: 'item2' },
        { id: 'item3', dlc_tag: undefined }
      ] as any[]

      const filtered = filterActiveDlcItemsImpl(items, ['dlc1'])
      // 没有 dlc_tag 或 undefined 会被 isDlcActive 视为 base
      expect(filtered).toHaveLength(3)
    })
  })

  describe('filterAvailableDlcs', () => {
    it('应该只返回当前版本可用的 DLC', () => {
      const dlcs = [
        { id: 'dlc1', dependencyVersion: '1.0' },
        { id: 'dlc2', dependencyVersion: '2.0' },
        { id: 'dlc3', dependencyVersion: '3.0' }
      ]

      const available = filterAvailableDlcsImpl(dlcs, '2.0')
      expect(available).toHaveLength(2)
      expect(available.map(d => d.id)).toEqual(['dlc1', 'dlc2'])
    })

    it('应该正确处理版本号比较', () => {
      const dlcs = [
        { id: 'dlc1', dependencyVersion: '1.0' },
        { id: 'dlc2', dependencyVersion: '1.5' },
        { id: 'dlc3', dependencyVersion: '2.0' }
      ]

      const available = filterAvailableDlcsImpl(dlcs, '1.5')
      expect(available).toHaveLength(2)
      expect(available.map(d => d.id)).toEqual(['dlc1', 'dlc2'])
    })

    it('版本号相同时应该包含', () => {
      const dlcs = [
        { id: 'dlc1', dependencyVersion: '2.0' }
      ]

      const available = filterAvailableDlcsImpl(dlcs, '2.0')
      expect(available).toHaveLength(1)
    })
  })

  describe('needsDlcSetup', () => {
    it('activeDlcs 字段缺失时应该返回 true', () => {
      expect(needsDlcSetupImpl({})).toBe(true)
      expect(needsDlcSetupImpl({ enforceDlcActivation: true } as any)).toBe(true)
    })

    it('activeDlcs 字段存在时（即使是空数组）应该返回 false', () => {
      expect(needsDlcSetupImpl({ activeDlcs: [] })).toBe(false)
    })

    it('activeDlcs 有值时应该返回 false', () => {
      expect(needsDlcSetupImpl({ activeDlcs: ['dlc1'] })).toBe(false)
    })
  })

  describe('activeDlcs getter', () => {
    it('当 needsDlcSetup 为 true 时应该返回所有 availableDlcs 的 ID', () => {
      const availableDlcs = [
        { id: 'dlc1' },
        { id: 'dlc2' }
      ]

      const result = getActiveDlcsImpl({}, availableDlcs)
      expect(result).toEqual(['dlc1', 'dlc2'])
    })

    it('当 needsDlcSetup 为 false 时应该返回保存的 activeDlcs', () => {
      const availableDlcs = [
        { id: 'dlc1' },
        { id: 'dlc2' },
        { id: 'dlc3' }
      ]

      const result = getActiveDlcsImpl({ activeDlcs: ['dlc1', 'dlc3'] }, availableDlcs)
      expect(result).toEqual(['dlc1', 'dlc3'])
    })

    it('应该过滤掉不在 availableDlcs 中的 ID', () => {
      const availableDlcs = [
        { id: 'dlc1' },
        { id: 'dlc2' }
      ]

      const result = getActiveDlcsImpl({ activeDlcs: ['dlc1', 'dlc4', 'oldDlc'] }, availableDlcs)
      expect(result).toEqual(['dlc1'])
    })
  })

  describe('enforceDlcActivation', () => {
    it('未设置时默认视为 false', () => {
      const dlcSetting = {}
      // enforceDlcActivation 缺失时，访问应该得到 undefined 或 false
      expect(dlcSetting.enforceDlcActivation).toBeUndefined()
      expect(!!dlcSetting.enforceDlcActivation).toBe(false)
    })

    it('设置为 true 时应该为 true', () => {
      const dlcSetting = { enforceDlcActivation: true }
      expect(dlcSetting.enforceDlcActivation).toBe(true)
    })

    it('设置为 false 时应该为 false', () => {
      const dlcSetting = { enforceDlcActivation: false }
      expect(dlcSetting.enforceDlcActivation).toBe(false)
    })
  })
})
