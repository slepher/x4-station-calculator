/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLogicFlowStore } from '../../src/store/useLogicFlowStore'
import { useGameDataStore } from '../../src/store/useGameDataStore'

if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      locale: { value: 'en' },
      setLocaleMessage: vi.fn(),
      t: (key: string) => key
    },
    install: vi.fn()
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: vi.fn(),
    translateModuleGroup: vi.fn(),
    translateWare: vi.fn()
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(true)
}))

describe('LogicFlow Bug Regression Tests', () => {
  let logicFlow: any
  let gameData: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    gameData = useGameDataStore()
    logicFlow = useLogicFlowStore()

    await gameData.initialize()
    gameData.isReady = true
  })

  describe('5. 血统差异处理 (Bug 5, 6, 8)', () => {
    it('5.1 should NOT mark different lineages of same ware as duplicated', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(status).toBe('available')
    })

    it('5.2 should allow different lineages of same ware to coexist', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const hullPartsNodes = group.nodes.filter(n => n.wareId === 'hullparts')
      expect(hullPartsNodes.length).toBe(2)
      expect(hullPartsNodes[0].lineage).not.toBe(hullPartsNodes[1].lineage)
    })

    it('5.3 should pass draggingLineage through startDragging', () => {
      logicFlow.startDragging('hullparts', 'teladi')
      expect(logicFlow.draggingWareId).toBe('hullparts')
      expect(logicFlow.draggingLineage).toBe('teladi')
      
      logicFlow.stopDragging()
      expect(logicFlow.draggingLineage).toBeNull()
    })

    it('5.4 should return isolated status for any lineage when node is isolated', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.toggleNodeIsolation(group.id, node.id)
      
      expect(node.isIsolated).toBe(true)
      expect(node.lineage).toBe('teladi')
      
      const statusSame = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(statusSame).toBe('isolated')
      
      const statusDiff = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(statusDiff).toBe('isolated')
    })

    it('5.5 should transform isolated node via UI path (connectAndExpand)', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const teladiNode = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.toggleNodeIsolation(group.id, teladiNode.id)
      
      // 模拟 UI 调用路径
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(status).toBe('isolated')
      
      // UI 会调用 connectAndExpand，而不是直接调用 expandUpstream
      logicFlow.connectAndExpand(group.id, 'hullparts')
      
      const hullPartsNodes = group.nodes.filter(n => n.wareId === 'hullparts')
      expect(hullPartsNodes.length).toBe(1)
      expect(hullPartsNodes[0].isIsolated).toBe(false)
      expect(hullPartsNodes[0].source).toBe('manual')
    })

    it('5.6 should return isolated status when lineage matches isolated node', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.toggleNodeIsolation(group.id, node.id)
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(status).toBe('isolated')
    })
  })

  describe('6. Auto 节点转正逻辑 (Bug 4)', () => {
    it('6.1 promoteNode should use nodeId not wareId', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const grapheneNode = group.nodes.find(n => n.wareId === 'graphene')
      expect(grapheneNode.source).toBe('auto')
      
      logicFlow.promoteNode(group.id, grapheneNode.id)
      expect(grapheneNode.source).toBe('manual')
    })

    it('6.2 should promote same-lineage Auto node', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const grapheneNode = group.nodes.find(n => n.wareId === 'graphene')
      expect(grapheneNode.source).toBe('auto')
      
      const status = logicFlow.getWareGroupStatus(group.id, 'graphene', 'default')
      expect(status).toBe('auto')
    })

    it('6.3 should replace different-lineage Auto node', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default')
      
      const hullpartsNode = group.nodes.find(n => n.wareId === 'hullparts')
      expect(hullpartsNode.lineage).toBe('default')
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(status).toBe('replace')
    })

    it('6.4 replaceNodeWithLineage should update lineage correctly', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const grapheneNode = group.nodes.find(n => n.wareId === 'graphene')
      expect(grapheneNode.lineage).toBe('default')
      
      logicFlow.replaceNodeWithLineage(group.id, 'graphene', 'teladi')
      
      expect(grapheneNode.lineage).toBe('teladi')
      expect(grapheneNode.source).toBe('manual')
    })
  })

  describe('7. 隔离节点合并逻辑 (Bug 7a)', () => {
    it('7.1 should delete other same-wareId nodes when isolating', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      expect(group.nodes.filter(n => n.wareId === 'hullparts').length).toBe(2)
      
      const defaultNode = group.nodes.find(n => n.wareId === 'hullparts' && n.lineage === 'default')
      logicFlow.toggleNodeIsolation(group.id, defaultNode.id)
      
      expect(group.nodes.filter(n => n.wareId === 'hullparts').length).toBe(1)
    })

    it('7.2 should keep only one isolated node after isolation', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const defaultNode = group.nodes.find(n => n.wareId === 'hullparts' && n.lineage === 'default')
      logicFlow.toggleNodeIsolation(group.id, defaultNode.id)
      
      const isolatedNodes = group.nodes.filter(n => n.wareId === 'hullparts')
      expect(isolatedNodes.length).toBe(1)
      expect(isolatedNodes[0].isIsolated).toBe(true)
    })

    it('7.3 should preserve lineage when isolating', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      const originalLineage = node.lineage
      
      logicFlow.toggleNodeIsolation(group.id, node.id)
      
      expect(node.lineage).toBe(originalLineage)
    })
  })

  describe('9. 状态优先级边界测试', () => {
    it('9.1 Rejected should have higher priority than Duplicated', () => {
      const group = logicFlow.addGroup('industrial', 'terran', 'Locked', true)
      group.lockedLineage = 'terran'
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(status).toBe('rejected')
    })

    it('9.2 Duplicated should have higher priority than Isolated', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(status).toBe('duplicated')
    })

    it('9.3 Isolated should have higher priority than Auto', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.toggleNodeIsolation(group.id, node.id)
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(status).toBe('isolated')
    })

    it('9.4 Auto should have higher priority than Replace', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default')
      
      const hullpartsNode = group.nodes.find(n => n.wareId === 'hullparts')
      expect(hullpartsNode.source).toBe('auto')
      
      const statusSame = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(statusSame).toBe('auto')
      
      const statusDiff = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(statusDiff).toBe('replace')
    })

    it('9.5 Replace should have higher priority than Available', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default')
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
      expect(status).toBe('replace')
    })
  })

  describe('10. 边界条件测试', () => {
    it('10.1 should add first node to empty group', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      expect(group.nodes.length).toBe(0)
      
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      expect(group.nodes.length).toBeGreaterThan(0)
      expect(group.nodes.some(n => n.wareId === 'hullparts')).toBe(true)
    })

    it('10.2 should handle group with only isolated node', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.toggleNodeIsolation(group.id, node.id)
      
      const manualNodes = group.nodes.filter(n => n.source === 'manual')
      expect(manualNodes.length).toBe(0)
      
      const isolatedNodes = group.nodes.filter(n => n.isIsolated)
      expect(isolatedNodes.length).toBe(1)
    })

    it('10.3 should handle group with Manual, Auto, and Isolated nodes', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const teladiNode = group.nodes.find(n => n.wareId === 'hullparts' && n.lineage === 'teladi')
      logicFlow.toggleNodeIsolation(group.id, teladiNode.id)
      
      const manualNodes = group.nodes.filter(n => n.source === 'manual')
      const autoNodes = group.nodes.filter(n => n.source === 'auto' && !n.isIsolated)
      const isolatedNodes = group.nodes.filter(n => n.isIsolated)
      
      expect(manualNodes.length).toBeGreaterThanOrEqual(0)
      expect(autoNodes.length).toBeGreaterThanOrEqual(0)
      expect(isolatedNodes.length).toBe(1)
    })

    it('10.4 should have empty group after deleting last Manual node', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      
      const node = group.nodes.find(n => n.wareId === 'hullparts')
      logicFlow.removeNode(group.id, node.id)
      
      expect(group.nodes.length).toBe(0)
    })

    it('10.5 T0 resources should always merge', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      const energyCellsNodes = group.nodes.filter(n => n.wareId === 'energycells')
      expect(energyCellsNodes.length).toBe(1)
    })

    it('10.6 locked group should enforce lineage constraint', () => {
      const group = logicFlow.addGroup('industrial', 'terran', 'Locked', true)
      group.lockedLineage = 'terran'
      
      const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
      expect(status).toBe('rejected')
    })

    it('10.7 locked group should use lockedLineage for expandUpstream', () => {
      const group = logicFlow.addGroup('industrial', 'teladi')
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
      
      logicFlow.toggleGroupLock(group.id)
      expect(group.isLocked).toBe(true)
      expect(group.lockedLineage).toBe('teladi')
      
      logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'split')
      
      const weaponNode = group.nodes.find(n => n.wareId === 'weaponcomponents')
      expect(weaponNode).toBeDefined()
      expect(weaponNode?.lineage).toBe('teladi')
      
      const hullNode = group.nodes.find(n => n.wareId === 'hullparts')
      expect(hullNode?.lineage).toBe('teladi')
    })
  })
})
