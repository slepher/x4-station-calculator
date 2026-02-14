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

describe('LogicFlow Locked Node Behavior', () => {
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
      isLocked: true, // LOCKED
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
      isLocked: false, // UNLOCKED
      source: 'manual',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(node)

    expect(store.isWareInAnyGroup('hullparts')).toBe(true)
  })

  it('should NOT expand upstream if existing node is locked', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Manually add a locked Refined Metals node
    const lockedNode = {
      id: 'node-rm-locked',
      wareId: 'refinedmetals',
      moduleId: undefined, // Locked usually has no module
      race: 'default',
      isLocked: true,
      source: 'manual',
      column: 1,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(lockedNode)

    // 2. Add Hull Parts (Manual) which needs Refined Metals
    // This calls expandUpstream('hullparts') -> expands 'refinedmetals'
    store.expandUpstream(group.id, 'hullparts', 'manual')

    // 3. Verify:
    // - Hull Parts node created
    // - Refined Metals node: Should still be the LOCKED one (no new auto node)
    // - Ore node: Should NOT be created (because recursion stopped at locked Refined Metals)

    const hullParts = group.nodes.find(n => n.wareId === 'hullparts')
    expect(hullParts).toBeDefined()

    const refinedMetals = group.nodes.filter(n => n.wareId === 'refinedmetals')
    expect(refinedMetals.length).toBe(1)
    if (refinedMetals[0]) {
      expect(refinedMetals[0].isLocked).toBe(true)
      expect(refinedMetals[0].id).toBe('node-rm-locked') // Same instance
    }

    const ore = group.nodes.find(n => n.wareId === 'ore')
    expect(ore).toBeUndefined() // Recursion stopped
  })

  it('should NOT modify locked node properties during expansion', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Locked Auto node (simulated scenario)
    const lockedNode = {
      id: 'node-rm-locked',
      wareId: 'refinedmetals',
      moduleId: 'old_module',
      race: 'default',
      isLocked: true,
      source: 'auto', // It was auto, then locked
      column: 1,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(lockedNode)

    // 2. Try to manually expand Refined Metals (simulating drag same item)
    store.expandUpstream(group.id, 'refinedmetals', 'manual')

    // 3. Verify it wasn't touched
    const node = group.nodes[0]
    expect(node).toBeDefined()
    if (node) {
      expect(node.isLocked).toBe(true)
      expect(node.source).toBe('auto') // Should NOT change to manual
      expect(node.moduleId).toBe('old_module') // Should NOT change module
    }
  })

  it('should unlock and expand when unlockAndExpand is called', () => {
    const group = store.addGroup('industrial', 'default')
    
    // 1. Add a locked Hull Parts node
    const lockedNode = {
      id: 'node-hp-locked',
      wareId: 'hullparts',
      moduleId: undefined,
      race: 'default',
      isLocked: true,
      source: 'manual',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(lockedNode)

    // 2. Unlock and expand
    store.unlockAndExpand(group.id, 'hullparts')

    // 3. Verify
    const hullParts = group.nodes.find(n => n.wareId === 'hullparts')
    expect(hullParts?.isLocked).toBe(false)
    
    // Should have expanded upstream (added Refined Metals)
    const refinedMetals = group.nodes.find(n => n.wareId === 'refinedmetals')
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
      isLocked: false,
      source: 'auto',
      column: 2,
      order: 0
    }
    // @ts-ignore
    group.nodes.push(autoNode)

    // 2. Promote it
    store.promoteNode(group.id, 'hullparts')

    // 3. Verify
    const node = group.nodes.find(n => n.wareId === 'hullparts')
    expect(node?.source).toBe('manual')
  })
})
