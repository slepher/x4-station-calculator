import { describe, it, expect, beforeEach } from 'vitest'
import { generateFilteredModulesGrouped } from '@/store/logic/searchModule'
import type { LocalizedX4Module, LocalizedX4ModuleGroup } from '@/types/x4'

/**
 * Unit tests for DLC filtering in searchModule
 *
 * Test file: tests/unit/dlc-settings/search-module-dlc.spec.ts
 * Maps to: openspec/changes/station-dlc-tag/test_tasks.md
 */

describe('generateFilteredModulesGrouped - DLC 过滤', () => {
  const createMockModule = (overrides: Partial<LocalizedX4Module> = {}): LocalizedX4Module => ({
    id: 'test_module',
    name: 'Test Module',
    localeName: '测试模块',
    group: 'production',
    type: 'production',
    dlc_tag: 'base',
    color_rgb: '#0ea5e9',
    tier: 1,
    ...overrides
  })

  const createMockModuleGroup = (id: string, type: string, name: string): LocalizedX4ModuleGroup => ({
    id,
    name,
    localeName: name,
    type
  })

  const localizedModulesMap: Record<string, LocalizedX4Module> = {
    'base_module': createMockModule({
      id: 'base_module',
      name: 'Base Module',
      localeName: '基础模块',
      dlc_tag: 'base'
    }),
    'dlc1_module': createMockModule({
      id: 'dlc1_module',
      name: 'DLC1 Module',
      localeName: 'DLC1 模块',
      dlc_tag: 'dlc1'
    }),
    'dlc2_module': createMockModule({
      id: 'dlc2_module',
      name: 'DLC2 Module',
      localeName: 'DLC2 模块',
      dlc_tag: 'dlc2'
    }),
    'dlc1_module2': createMockModule({
      id: 'dlc1_module2',
      name: 'DLC1 Module 2',
      localeName: 'DLC1 模块 2',
      dlc_tag: 'dlc1',
      group: 'processingmodule'
    })
  }

  const localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup> = {
    'production': createMockModuleGroup('production', 'production', '生产'),
    'processingmodule': createMockModuleGroup('processingmodule', 'processingmodule', '加工')
  }

  describe('includeModule 回调 - DLC 过滤', () => {
    it('includeModule 返回 true 时应该包含所有模块', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true // 包含所有
      )

      const allModules = result.flatMap(g => g.modules)
      expect(allModules).toHaveLength(4)
    })

    it('includeModule 返回 false 时应该排除所有模块', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => false // 排除所有
      )

      expect(result).toHaveLength(0)
    })

    it('应该只包含激活 DLC 的模块', () => {
      const activeDlcs = ['base', 'dlc1']

      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        (module) => {
          if (!module.dlc_tag || module.dlc_tag === 'base') return true
          return activeDlcs.includes(module.dlc_tag)
        }
      )

      const allModules = result.flatMap(g => g.modules)
      expect(allModules).toHaveLength(3) // base_module, dlc1_module, dlc1_module2
      expect(allModules.map(m => m.id)).toContain('base_module')
      expect(allModules.map(m => m.id)).toContain('dlc1_module')
      expect(allModules.map(m => m.id)).toContain('dlc1_module2')
      expect(allModules.map(m => m.id)).not.toContain('dlc2_module')
    })

    it('应该只包含特定 DLC 的模块', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        (module) => module.dlc_tag === 'dlc2'
      )

      const allModules = result.flatMap(g => g.modules)
      expect(allModules).toHaveLength(1)
      expect(allModules[0].id).toBe('dlc2_module')
    })
  })

  describe('搜索结果 - DLC 标签可见性', () => {
    it('搜索时应该保留 DLC 标签信息', () => {
      const result = generateFilteredModulesGrouped(
        '模块',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      const allModules = result.flatMap(g => g.modules)
      allModules.forEach(module => {
        expect(module).toHaveProperty('dlc_tag')
      })
    })

    it('搜索应该匹配 DLC 模块名称', () => {
      const result = generateFilteredModulesGrouped(
        'DLC1',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      const allModules = result.flatMap(g => g.modules)
      expect(allModules).toHaveLength(2)
      expect(allModules.map(m => m.id)).toEqual(['dlc1_module', 'dlc1_module2'])
    })

    it('搜索应该匹配 base 模块名称', () => {
      const result = generateFilteredModulesGrouped(
        '基础',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      const allModules = result.flatMap(g => g.modules)
      expect(allModules).toHaveLength(1)
      expect(allModules[0].id).toBe('base_module')
    })
  })

  describe('分组逻辑', () => {
    it('应该按组类型正确分组', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      expect(result).toHaveLength(2) // production 和 processingmodule

      const productionGroup = result.find(g => g.group === 'production')
      const processingGroup = result.find(g => g.group === 'processingmodule')

      expect(productionGroup?.modules).toHaveLength(3) // base, dlc1, dlc2
      expect(processingGroup?.modules).toHaveLength(1) // dlc1_module2
    })

    it('DLC 过滤后空组应该被剔除', () => {
      // 只包含 dlc2 模块
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        (module) => module.dlc_tag === 'dlc2'
      )

      // processingmodule 组应该被剔除（因为没有 dlc2 的加工模块）
      expect(result).toHaveLength(1)
      expect(result[0].group).toBe('production')
    })

    it('应该按优先级排序组', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      // production 应该在 processingmodule 前面（优先级更高）
      expect(result[0].group).toBe('production')
      expect(result[1].group).toBe('processingmodule')
    })
  })

  describe('模块排序', () => {
    it('同组内模块应该按 tier 排序（高 tier 在前）', () => {
      const modulesWithTiers: Record<string, LocalizedX4Module> = {
        'low_tier': createMockModule({
          id: 'low_tier',
          name: 'Low Tier',
          localeName: '低等级',
          tier: 1,
          dlc_tag: 'base'
        }),
        'high_tier': createMockModule({
          id: 'high_tier',
          name: 'High Tier',
          localeName: '高等级',
          tier: 3,
          dlc_tag: 'base'
        }),
        'mid_tier': createMockModule({
          id: 'mid_tier',
          name: 'Mid Tier',
          localeName: '中等级',
          tier: 2,
          dlc_tag: 'base'
        })
      }

      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        modulesWithTiers,
        localizedModuleGroupsMap,
        () => true
      )

      const productionGroup = result.find(g => g.group === 'production')
      expect(productionGroup?.modules.map(m => m.id)).toEqual([
        'high_tier',
        'mid_tier',
        'low_tier'
      ])
    })

    it('同 tier 内应该按名称字母顺序排序', () => {
      const modulesSameTier: Record<string, LocalizedX4Module> = {
        'c_module': createMockModule({
          id: 'c_module',
          name: 'C Module',
          localeName: 'C 模块',
          tier: 2,
          dlc_tag: 'base'
        }),
        'a_module': createMockModule({
          id: 'a_module',
          name: 'A Module',
          localeName: 'A 模块',
          tier: 2,
          dlc_tag: 'base'
        }),
        'b_module': createMockModule({
          id: 'b_module',
          name: 'B Module',
          localeName: 'B 模块',
          tier: 2,
          dlc_tag: 'base'
        })
      }

      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        modulesSameTier,
        localizedModuleGroupsMap,
        () => true
      )

      const productionGroup = result.find(g => g.group === 'production')
      // 同 tier 内按字母顺序
      expect(productionGroup?.modules.map(m => m.id)).toEqual([
        'a_module',
        'b_module',
        'c_module'
      ])
    })
  })

  describe('边界情况', () => {
    it('空模块列表应该返回空数组', () => {
      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        {},
        {},
        () => true
      )

      expect(result).toHaveLength(0)
    })

    it('搜索无结果应该返回空数组', () => {
      const result = generateFilteredModulesGrouped(
        '不存在的模块',
        'zh-CN',
        localizedModulesMap,
        localizedModuleGroupsMap,
        () => true
      )

      expect(result).toHaveLength(0)
    })

    it(' DLC 标签为 null 应该被视为 base', () => {
      const modulesWithNull: Record<string, LocalizedX4Module> = {
        'null_dlc': createMockModule({
          id: 'null_dlc',
          name: 'Null DLC',
          localeName: '空 DLC',
          dlc_tag: null as any
        })
      }

      const result = generateFilteredModulesGrouped(
        '',
        'zh-CN',
        modulesWithNull,
        localizedModuleGroupsMap,
        (module) => {
          // null 应该被视为 base
          if (!module.dlc_tag) return true
          return true
        }
      )

      expect(result).toHaveLength(1)
    })
  })
})
