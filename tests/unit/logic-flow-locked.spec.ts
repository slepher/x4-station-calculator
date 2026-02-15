/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogicFlowStore } from '../../src/store/useLogicFlowStore'
import { useGameDataStore } from '../../src/store/useGameDataStore'

// Mock game data
vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn()
}))

describe('LogicFlow Isolated Node Behavior', () => {
  let store: ReturnType<typeof useLogicFlowStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    
    // Setup minimal game data mock
    const mockGameData = {
      waresMap: {
        'hullparts': { id: 'hullparts', tier: 2, name: 'Hull Parts' },
        'refinedmetals': { id: 'refinedmetals', tier: 1, name: 'Refined Metals' },
        'ore': { id: 'ore', tier: 0, name: 'Ore' }
      },
      findModuleForWare: vi.fn((wareId) => {
        if (wareId === 'hullparts') return { id: 'prod_hullparts', race: 'default', inputs: { 'refinedmetals': 1 } }
        if (wareId === 'refinedmetals') return { id: 'prod_refinedmetals', race: 'default', inputs: { 'ore': 1 } }
        return null
      }),
      initialize: vi.fn(),
       isReady: true,
       localizedWaresMap: {
         'hullparts': { id: 'hullparts', localeName: 'Hull Parts' },
         'refinedmetals': { id: 'refinedmetals', localeName: 'Refined Metals' }
       },
       wareSetsByIndustrialRace: {
         'default': new Set(['hullparts', 'refinedmetals', 'ore'])
       },
       wareSetsByRace: {
         'default': new Set(['hullparts', 'refinedmetals', 'ore'])
       }
     }
    
    // @ts-ignore
    useGameDataStore.mockReturnValue(mockGameData)
    
    store = useLogicFlowStore()
    store.init()
  })

  it('should ignore locked nodes when checking isWareInAnyGroup', () => {
    // 1. Add a group and a locked node
    const group = store.addGroup('industrial', 'default')
    const node = {
      id: 'node-1',
      wareId: 'hullparts',
      moduleId: 'prod_hullparts',
      race: 'default',
      isIsolated: true, // ISOLATED
      source: 'manual',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(node)

    // 2. Check isWareInAnyGroup
    // Should be FALSE because it's locked
    expect(store.isWareInAnyGroup('hullparts')).toBe(false)
  })

  it('should return true for isWareInAnyGroup if unlocked node exists', () => {
    const group = store.addGroup('industrial', 'default')
    const node = {
      id: 'node-1',
      wareId: 'hullparts',
      moduleId: 'prod_hullparts',
      race: 'default',
      isIsolated: false, // NOT ISOLATED
      source: 'manual',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(node)

    expect(store.isWareInAnyGroup('hullparts')).toBe(true)
  })

  it('should transform isolated node when user drags same ware (UI path)', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Manually add a isolated Refined Metals node
    const isolatedNode = {
      id: 'node-rm-isolated',
      wareId: 'refinedmetals',
      moduleId: undefined, // Isolated usually has no module
      race: 'default',
      lineage: 'default',
      isIsolated: true,
      source: 'auto',
      column: 1,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(isolatedNode)

    // 2. 模拟 UI 调用路径
    const status = store.getWareGroupStatus(group.id, 'refinedmetals', 'default')
    expect(status).toBe('isolated')
    
    // UI 会调用 connectAndExpand
    store.connectAndExpand(group.id, 'refinedmetals', 'default')

    // 3. Verify:
    // - Refined Metals node: Should be transformed (no longer isolated)
    // - Ore node: Should be created (because recursion continues)

    const refinedMetals = group.nodes.find((n: any) => n.wareId === 'refinedmetals')
    expect(refinedMetals).toBeDefined()
    expect(refinedMetals.isIsolated).toBe(false)
    expect(refinedMetals.source).toBe('manual')
    expect(refinedMetals.moduleId).toBe('prod_refinedmetals')

    const ore = group.nodes.find((n: any) => n.wareId === 'ore')
    expect(ore).toBeDefined() // Recursion continues
  })

  it('should transform isolated node properties when user drags (UI path)', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Isolated Auto node (simulated scenario)
    const isolatedNode = {
      id: 'node-rm-isolated',
      wareId: 'refinedmetals',
      moduleId: 'old_module',
      race: 'default',
      lineage: 'default',
      isIsolated: true,
      source: 'auto', // It was auto, then isolated
      column: 1,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(isolatedNode)

    // 2. 模拟 UI 调用路径
    const status = store.getWareGroupStatus(group.id, 'refinedmetals', 'default')
    expect(status).toBe('isolated')
    
    // UI 会调用 connectAndExpand
    store.connectAndExpand(group.id, 'refinedmetals', 'default')

    // 3. Verify it was transformed
    const node = group.nodes[0]
    expect(node).toBeDefined()
    if (node) {
      expect(node.isIsolated).toBe(false)
      expect(node.source).toBe('manual') // Changed to manual
      expect(node.moduleId).toBe('prod_refinedmetals') // Changed to correct module
    }
  })

  it('should connect and expand when connectAndExpand is called', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Add a isolated Hull Parts node (隔离后应该是 auto)
    const isolatedNode = {
      id: 'node-hp-isolated',
      wareId: 'hullparts',
      moduleId: undefined,
      race: 'default',
      lineage: 'default',
      isIsolated: true,
      source: 'auto', // 隔离后是 auto
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(isolatedNode)

    // 2. Connect and expand (模拟用户拖拽)
    store.connectAndExpand(group.id, 'hullparts', 'default')

    // 3. Verify
    const hullParts = group.nodes.find((n: any) => n.wareId === 'hullparts')
    expect(hullParts?.isIsolated).toBe(false)
    expect(hullParts?.source).toBe('manual') // 用户拖拽是主动行为，变为 manual
    
    // Should have expanded upstream (added Refined Metals)
    const refinedMetals = group.nodes.find((n: any) => n.wareId === 'refinedmetals')
    expect(refinedMetals).toBeDefined()
    expect(refinedMetals?.source).toBe('auto')
  })

  it('should promote an auto node to manual when promoteNode is called', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Add an auto node
    const autoNode = {
      id: 'node-auto',
      wareId: 'hullparts',
      moduleId: 'prod_hullparts',
      race: 'default',
      isIsolated: false,
      source: 'auto',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(autoNode)

    // 2. Promote it (使用 nodeId，不是 wareId)
    store.promoteNode(group.id, 'node-auto')

    // 3. Verify
    const node = group.nodes.find((n: any) => n.wareId === 'hullparts')
    expect(node?.source).toBe('manual')
  })
})
