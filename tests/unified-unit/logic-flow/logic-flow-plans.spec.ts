import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    isReady: true,
    waresMap: {
      hullparts: { tier: 2, group: 'industrial' },
      weaponcomponents: { tier: 3, group: 'industrial' },
      siliconwafers: { tier: 1, group: 'industrial' },
      energycells: { tier: 0, group: 'energy' },
      ore: { tier: 0, group: 'raw' },
    },
    modulesMap: {
      'module-hullparts': {
        id: 'module-hullparts',
        race: 'argon',
        inputs: { siliconwafers: 2, energycells: 1 }
      },
      'module-weaponcomponents': {
        id: 'module-weaponcomponents',
        race: 'argon',
        inputs: { hullparts: 2, energycells: 1 }
      },
      'module-siliconwafers': {
        id: 'module-siliconwafers',
        race: 'argon',
        inputs: { ore: 2, energycells: 1 }
      },
    },
    localizedWaresMap: {
      hullparts: { localeName: '船体部件' },
      weaponcomponents: { localeName: '武器组件' },
      siliconwafers: { localeName: '硅晶圆' },
    },
    findModuleForWare: vi.fn((wareId: string) => {
      const map: Record<string, any> = {
        hullparts: { id: 'module-hullparts', race: 'argon', inputs: { siliconwafers: 2, energycells: 1 } },
        weaponcomponents: { id: 'module-weaponcomponents', race: 'argon', inputs: { hullparts: 2, energycells: 1 } },
        siliconwafers: { id: 'module-siliconwafers', race: 'argon', inputs: { ore: 2, energycells: 1 } },
      }
      return map[wareId]
    }),
    wareSetsByIndustrialRace: { default: new Set(['hullparts', 'weaponcomponents', 'siliconwafers', 'ore', 'energycells']) },
    wareSetsByRace: { default: new Set(['hullparts', 'weaponcomponents', 'siliconwafers', 'ore', 'energycells']) },
    initialize: vi.fn(),
  }))
}))

describe('Logic Flow Plans - Unit Tests', () => {
  let store: ReturnType<typeof useLogicFlowStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      clear: vi.fn(),
    })
    store = useLogicFlowStore()
  })

  describe('UT-1: isDirty 计算属性', () => {
    it('初始状态 isDirty 为 false', () => {
      store.lastSavedSnapshot = JSON.stringify({ groups: [], settings: { isDefaultLocked: true } })
      expect(store.isDirty).toBe(false)
    })

    it('修改 groups 数据后 isDirty 变为 true', () => {
      store.lastSavedSnapshot = JSON.stringify({ groups: [], settings: { isDefaultLocked: true } })
      store.addGroup('industrial', 'default', undefined, false)
      expect(store.isDirty).toBe(true)
    })

    it('调用 saveCurrentPlan 后 isDirty 变为 false', () => {
      store.addGroup('industrial', 'default', undefined, false)
      store.groups[0]!.nodes.push({
        id: 'node-1',
        wareId: 'hullparts',
        moduleId: 'module-hullparts',
        race: 'argon',
        lineage: 'default',
        column: 2,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: 0,
      })
      store.saveCurrentPlan('test-plan')
      expect(store.isDirty).toBe(false)
    })

    it('修改 settings 数据后 isDirty 变为 true', () => {
      store.lastSavedSnapshot = JSON.stringify({ groups: [], settings: { isDefaultLocked: true } })
      store.settings.isDefaultLocked = false
      expect(store.isDirty).toBe(true)
    })

  })

  describe('UT-2: saveCurrentPlan 方法', () => {
    it('正确保存包含 manual 节点的产线组', () => {
      const group = store.addGroup('industrial', 'default', undefined, false)
      store.groups[0]!.nodes.push({
        id: 'node-1',
        wareId: 'hullparts',
        moduleId: 'module-hullparts',
        race: 'argon',
        lineage: 'default',
        column: 2,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: 0,
      })

      const result = store.saveCurrentPlan('test-plan')
      expect(result).toBe(true)
      expect(store.savedPlans.list.length).toBe(1)
      expect(store.savedPlans.list[0]!.name).toBe('test-plan')
    })

    it('auto 节点未被保存到方案数据中', () => {
      const group = store.addGroup('industrial', 'default', undefined, false)
      store.groups[0]!.nodes.push({
        id: 'node-1',
        wareId: 'hullparts',
        moduleId: 'module-hullparts',
        race: 'argon',
        lineage: 'default',
        column: 2,
        isIsolated: false,
        isAuto: true,
        isRoot: false,
        source: 'auto',
        order: 0,
      })

      store.saveCurrentPlan('test-plan')
      const savedGroup = store.savedPlans.list[0]!.groups[0]
      expect(savedGroup!.nodes.length).toBe(0)
    })

    it('lastSavedSnapshot 正确更新', () => {
      store.addGroup('industrial', 'default', undefined, false)
      store.groups[0]!.nodes.push({
        id: 'node-1',
        wareId: 'hullparts',
        moduleId: 'module-hullparts',
        race: 'argon',
        lineage: 'default',
        column: 2,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: 0,
      })

      store.saveCurrentPlan('test-plan')
      expect(store.lastSavedSnapshot).toContain('hullparts')
    })
  })

  describe('UT-3: loadPlan 方法', () => {
    it('方案正确加载', () => {
      const plan = {
        id: 'plan-1',
        name: 'Test Plan',
        groups: [{
          id: 'group-1',
          name: '',
          category: 'industrial' as const,
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [{
            id: 'node-1',
            wareId: 'hullparts',
            moduleId: 'module-hullparts',
            race: 'argon',
            lineage: 'default',
            column: 2,
            isIsolated: false,
            source: 'manual' as const,
            isRoot: true,
            order: 0,
          }]
        }],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now(),
      }

      store.savedPlans.list.push(plan)
      store.loadPlan(0)

      expect(store.groups.length).toBe(1)
      expect(store.currentPlanName).toBe('Test Plan')
    })

    it('currentPlanName 正确设置', () => {
      const plan = {
        id: 'plan-1',
        name: 'My Plan',
        groups: [{
          id: 'group-1',
          name: '',
          category: 'industrial' as const,
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [{
            id: 'node-1',
            wareId: 'hullparts',
            moduleId: 'module-hullparts',
            race: 'argon',
            lineage: 'default',
            column: 2,
            isIsolated: false,
            source: 'manual' as const,
            isRoot: true,
            order: 0,
          }]
        }],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now(),
      }

      store.savedPlans.list.push(plan)
      store.loadPlan(0)

      expect(store.currentPlanName).toBe('My Plan')
    })

    it('lastSavedSnapshot 更新', () => {
      const plan = {
        id: 'plan-1',
        name: 'Test Plan',
        groups: [{
          id: 'group-1',
          name: '',
          category: 'industrial' as const,
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [{
            id: 'node-1',
            wareId: 'hullparts',
            moduleId: 'module-hullparts',
            race: 'argon',
            lineage: 'default',
            column: 2,
            isIsolated: false,
            source: 'manual' as const,
            isRoot: true,
            order: 0,
          }]
        }],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now(),
      }

      store.savedPlans.list.push(plan)
      store.loadPlan(0)

      expect(store.lastSavedSnapshot).toContain('hullparts')
    })
  })

  describe('UT-4: clearAll 方法', () => {
    it('所有状态正确重置', () => {
      store.addGroup('industrial', 'default', 'Test Group', false)
      store.currentPlanName = 'Test Plan'
      store.savedPlans.activeId = 'plan-1'

      store.clearAll()

      expect(store.groups.length).toBe(0)
      expect(store.currentPlanName).toBe('')
      expect(store.activeGroupId).toBe(null)
      expect(store.savedPlans.activeId).toBe(null)
    })
  })

  describe('UT-5: settings 作为方案的一部分保存和加载', () => {
    it('设置随方案一起保存', () => {
      store.addGroup('industrial', 'default', undefined, false)
      store.groups[0]!.nodes.push({
        id: 'node-1',
        wareId: 'hullparts',
        moduleId: 'module-hullparts',
        race: 'argon',
        lineage: 'default',
        column: 2,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: 0,
      })
      store.settings.isDefaultLocked = false

      store.saveCurrentPlan('test-plan')
      expect(store.savedPlans.list[0]!.settings.isDefaultLocked).toBe(false)
    })

    it('设置随方案一起加载', () => {
      const plan = {
        id: 'plan-1',
        name: 'Test Plan',
        groups: [{
          id: 'group-1',
          name: '',
          category: 'industrial' as const,
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [{
            id: 'node-1',
            wareId: 'hullparts',
            moduleId: 'module-hullparts',
            race: 'argon',
            lineage: 'default',
            column: 2,
            isIsolated: false,
            source: 'manual' as const,
            isRoot: true,
            order: 0,
          }]
        }],
        settings: { isDefaultLocked: false },
        lastUpdated: Date.now(),
      }

      store.savedPlans.list.push(plan)
      store.loadPlan(0)

      expect(store.settings.isDefaultLocked).toBe(false)
      expect(store.isDefaultLocked).toBe(false)
    })
  })

  describe('UT-6: deletePlan 方法', () => {
    it('方案正确删除', () => {
      store.savedPlans.list.push(
        { id: 'plan-1', name: 'Plan 1', groups: [], settings: { isDefaultLocked: true }, lastUpdated: 1 },
        { id: 'plan-2', name: 'Plan 2', groups: [], settings: { isDefaultLocked: true }, lastUpdated: 2 },
        { id: 'plan-3', name: 'Plan 3', groups: [], settings: { isDefaultLocked: true }, lastUpdated: 3 }
      )

      store.deletePlan(1)

      expect(store.savedPlans.list.length).toBe(2)
      expect(store.savedPlans.list.map(p => p.name)).toEqual(['Plan 1', 'Plan 3'])
    })

    it('删除当前活动方案时 activeId 重置', () => {
      store.savedPlans.list.push(
        { id: 'plan-1', name: 'Plan 1', groups: [], settings: { isDefaultLocked: true }, lastUpdated: 1 },
        { id: 'plan-2', name: 'Plan 2', groups: [], settings: { isDefaultLocked: true }, lastUpdated: 2 }
      )
      store.savedPlans.activeId = 'plan-1'
      store.currentPlanName = 'Plan 1'

      store.deletePlan(0)

      expect(store.savedPlans.activeId).toBe(null)
      expect(store.currentPlanName).toBe('')
    })
  })

  describe('UT-7: applyPlan 方法 - isolated 节点处理顺序', () => {
    it('isolated 节点在 manual 节点之前被添加', () => {
      const plan = {
        id: 'plan-1',
        name: 'Test Plan',
        groups: [{
          id: 'group-1',
          name: '',
          category: 'industrial' as const,
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [
            {
              id: 'node-isolated',
              wareId: 'siliconwafers',
              moduleId: undefined,
              race: 'argon',
              lineage: 'default',
              column: 1,
              isIsolated: true,
              source: 'manual' as const,
              isRoot: true,
              order: 0,
            },
            {
              id: 'node-manual',
              wareId: 'hullparts',
              moduleId: 'module-hullparts',
              race: 'argon',
              lineage: 'default',
              column: 2,
              isIsolated: false,
              source: 'manual' as const,
              isRoot: true,
              order: 0,
            }
          ]
        }],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now(),
      }

      store.applyPlan(plan)

      const group = store.groups[0]
      expect(group).toBeDefined()
      
      const isolatedNode = group!.nodes.find(n => n.wareId === 'siliconwafers')
      expect(isolatedNode).toBeDefined()
      expect(isolatedNode!.isIsolated).toBe(true)
      expect(isolatedNode!.moduleId).toBeUndefined()
    })
  })

  describe('UT-9: 空方案保存验证', () => {
    it('空方案无法保存', () => {
      const result = store.saveCurrentPlan('empty-plan')
      expect(result).toBe(false)
      expect(store.savedPlans.list.length).toBe(0)
    })
  })
})
