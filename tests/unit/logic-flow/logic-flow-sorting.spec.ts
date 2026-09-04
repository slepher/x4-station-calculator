import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' }
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  })
}))

// Mock useX4I18n (if it's a separatecomposable)
vi.mock('@/composables/useX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (id: string) => id,
    translateModuleGroup: (id: string) => id,
    translateWare: (id: string) => id
  })
}))

describe('useLogicFlowStore Sorting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Mock GameData
    const gameData = useGameDataStore()
    gameData.waresMap = {
      'refinedmetals': { id: 'refinedmetals', name: 'Refined Metals', tier: 1, transport: 'container', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'ore': { id: 'ore', name: 'Ore', tier: 0, transport: 'solid', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'siliconwafers': { id: 'siliconwafers', name: 'Silicon Wafers', tier: 1, transport: 'container', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'silicon': { id: 'silicon', name: 'Silicon', tier: 0, transport: 'solid', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'antimatterconverters': { id: 'antimatterconverters', name: 'AMC', tier: 2, transport: 'container', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'energycells': { id: 'energycells', name: 'Energy Cells', tier: 0, transport: 'container', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'hydrogen': { id: 'hydrogen', name: 'Hydrogen', tier: 0, transport: 'liquid', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' },
      'microchips': { id: 'microchips', name: 'Microchips', tier: 1, transport: 'container', volume: 1, price: { min: 0, max: 0, avg: 0 }, group: 'industrial' }
    } as any

    // Mock Module finding logic
    gameData.findModuleForWare = (wareId: string) => {
      if (wareId === 'refinedmetals') {
        return { 
          id: 'prod_refinedmetals', 
          race: 'default',
          inputs: { 'ore': 240, 'energycells': 100 } 
        } as any
      }
      if (wareId === 'siliconwafers') {
        return { 
          id: 'prod_siliconwafers', 
          race: 'default',
          inputs: { 'silicon': 120, 'energycells': 100 } 
        } as any
      }
      if (wareId === 'antimatterconverters') {
        return {
          id: 'prod_amc',
          race: 'default',
          inputs: { 'microchips': 20, 'energycells': 100, 'hydrogen': 500 } // Depends on T1 (Microchips) and T0 (Hydrogen)
        } as any
      }
      if (wareId === 'microchips') {
        return {
          id: 'prod_microchips',
          race: 'default',
          inputs: { 'siliconwafers': 10, 'energycells': 50 } // Depends on T1
        } as any
      }
      return null
    }
  })

  it('sorts T0 resources based on node order (Dependency-Follow)', () => {
    const store = useLogicFlowStore()
    
    // Scenario: Refined Metals (needs Ore) then Silicon Wafers (needs Silicon)
    const nodesA = [
      { id: '1', wareId: 'refinedmetals', race: 'default', source: 'manual', column: 1, isLocked: false },
      { id: '2', wareId: 'siliconwafers', race: 'default', source: 'manual', column: 1, isLocked: false }
    ] as any[]

    const resultA = store.getSortedGroupT0Resources(nodesA)
    // Ore comes from Refined Metals (1st), Silicon comes from Silicon Wafers (2nd)
    expect(resultA).toEqual(['ore', 'silicon'])

    // Scenario: Reverse order
    const nodesB = [
      { id: '2', wareId: 'siliconwafers', race: 'default', source: 'manual', column: 1, isLocked: false },
      { id: '1', wareId: 'refinedmetals', race: 'default', source: 'manual', column: 1, isLocked: false }
    ] as any[]

    const resultB = store.getSortedGroupT0Resources(nodesB)
    expect(resultB).toEqual(['silicon', 'ore'])
  })

  it('deduplicates resources while preserving first appearance order', () => {
    const store = useLogicFlowStore()
    
    // Scenario: 
    // 1. Refined Metals (needs Ore)
    // 2. Another Refined Metals (needs Ore) -> Should not add Ore again
    // 3. Silicon Wafers (needs Silicon)
    
    const nodes = [
      { id: '1', wareId: 'refinedmetals', race: 'default', source: 'manual', column: 1 },
      { id: '2', wareId: 'refinedmetals', race: 'default', source: 'manual', column: 1 },
      { id: '3', wareId: 'siliconwafers', race: 'default', source: 'manual', column: 1 }
    ] as any[]

    const result = store.getSortedGroupT0Resources(nodes)
    expect(result).toEqual(['ore', 'silicon'])
  })

  it('handles complex dependencies (T2 -> T1 -> T0)', () => {
    const store = useLogicFlowStore()
    
    // Antimatter Converters (AMC) -> needs Microchips (T1) + Hydrogen (T0)
    // Microchips -> needs Silicon Wafers (T1) + Silicon (T0) -- Wait, mock says Microchips -> Silicon Wafers
    // Let's adjust mock for Microchips to need Silicon directly to test T0 extraction
    
    const gameData = useGameDataStore()
    gameData.findModuleForWare = (wareId: string) => {
       if (wareId === 'antimatterconverters') { // T2
         return { inputs: { 'hydrogen': 100, 'microchips': 10, 'energycells': 10 } } as any
       }
       if (wareId === 'microchips') { // T1
         return { inputs: { 'silicon': 50, 'energycells': 10 } } as any
       }
       return null
    }

    const nodes = [
      { id: '1', wareId: 'antimatterconverters', race: 'default', source: 'manual', column: 2 }
    ] as any[]

    const result = store.getSortedGroupT0Resources(nodes)
    // Should find Hydrogen (direct T0) and Silicon (indirect T0 via Microchips)
    // Order depends on implementation of recursive traversal in `calculateRequiredT0Wares`
    // Usually Object.entries order. If 'hydrogen' key comes before 'microchips', it might be processed first?
    // Wait, `calculateRequiredT0Wares` recursively calls `trace`.
    // If inputs = { hydrogen, microchips }, and we iterate:
    // 1. hydrogen -> is T0 -> add to res
    // 2. microchips -> recurse -> silicon -> is T0 -> add to res
    // So order within one node depends on Object.entries(inputs) order + recursion.
    // The store implementation sorts keys for stability: `Object.keys(resources).sort()`
    // So `calculateRequiredT0Wares` returns a map. `getSortedGroupT0Resources` sorts the keys of that map alphabetically.
    // So for AMC, it needs Hydrogen and Silicon. 'hydrogen' < 'silicon'.
    // So result should be ['hydrogen', 'silicon'].
    
    expect(result).toEqual(['hydrogen', 'silicon'])
  })
})
