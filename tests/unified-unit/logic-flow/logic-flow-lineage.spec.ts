/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, '../../src/assets/x4_game_data/8.0-Diplomacy/data')

// Mock crypto
if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
}

// Mock vue-i18n
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

// Mock useX4I18n
vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: vi.fn(),
    translateModuleGroup: vi.fn(),
    translateWare: vi.fn()
  })
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(true)
}))

describe('LogicFlow Lineage & PK Verification', () => {
  let logicFlow: any
  let gameData: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    gameData = useGameDataStore()
    logicFlow = useLogicFlowStore()

    // Initialize real data via store's method
    await gameData.initialize()

    // Override or check isReady
    gameData.isReady = true
  })

  it('should isolate production lines based on moduleId (PK)', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. Add Teladi Hull Parts
    // In X4, Hull Parts has different modules for Teladi vs Default
    // prod_tel_hullparts_macro vs prod_gen_hullparts_macro
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
    
    const teladiNode = group.nodes.find((n: any) => n.wareId === 'hullparts' && n.lineage === 'teladi')
    expect(teladiNode).toBeDefined()
    expect(teladiNode.moduleId).toContain('tel')

    // 2. Add Default Hull Parts
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    
    const defaultNode = group.nodes.find((n: any) => n.wareId === 'hullparts' && n.lineage === 'default')
    expect(defaultNode).toBeDefined()
    expect(defaultNode.moduleId).not.toContain('teladi')
    
    // 3. Both should coexist because moduleId is the PK
    expect(group.nodes.filter((n: any) => n.wareId === 'hullparts').length).toBe(2)
  })

  it('should merge T0 resources across different lineages', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // Add Teladi Hull Parts (needs Energy Cells)
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
    // Add Terran Hull Parts (needs Energy Cells)
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'terran')
    
    // Verify T0 Energy Cells is merged (only 1 node)
    const energyCellsNodes = group.nodes.filter((n: any) => n.wareId === 'energycells')
    expect(energyCellsNodes.length).toBe(1)
    expect(energyCellsNodes[0].lineage).toBe('default') // T0 always default
  })

  it('should promote an auto node to manual', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    
    const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene')
    expect(grapheneNode.source).toBe('auto')
    
    logicFlow.promoteNode(group.id, grapheneNode.id)
    expect(grapheneNode.source).toBe('manual')
    expect(grapheneNode.isAuto).toBe(false)
  })

  it('should isolate a node and its upstream when toggled', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    
    const hullPartsNode = group.nodes.find((n: any) => n.wareId === 'hullparts')
    expect(group.nodes.some((n: any) => n.wareId === 'graphene')).toBe(true)
    
    // Isolate Hull Parts (Manual → Auto + Isolated)
    logicFlow.toggleNodeIsolation(group.id, hullPartsNode.id)
    expect(hullPartsNode.isIsolated).toBe(true)
    expect(hullPartsNode.source).toBe('auto') // 降级为 Auto
    
    // Upstream (Graphene) should be cleaned up if not needed by others
    expect(group.nodes.some((n: any) => n.wareId === 'graphene')).toBe(false)
    
    // Connect back (Isolated → Auto, not Manual)
    logicFlow.toggleNodeIsolation(group.id, hullPartsNode.id)
    expect(hullPartsNode.isIsolated).toBe(false)
    expect(hullPartsNode.source).toBe('auto') // 保持 Auto，用户需要手动转正
    expect(group.nodes.some((n: any) => n.wareId === 'graphene')).toBe(true)
  })

  it('should respect group lock when adding new nodes', () => {
    const group = logicFlow.addGroup('industrial', 'default', 'Locked Group', true)
    group.lockedLineage = 'terran'
    
    // Add Hull Parts without specifying lineage - should use group's locked lineage
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual')
    
    const node = group.nodes.find((n: any) => n.wareId === 'hullparts')
    expect(node.lineage).toBe('terran')
  })

  it('should allow same wareId with different lineages (not duplicated)', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. Add default Hull Parts
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    
    const defaultNode = group.nodes.find((n: any) => n.wareId === 'hullparts')
    expect(defaultNode).toBeDefined()
    expect(defaultNode.source).toBe('manual')
    
    // 2. Check status for Teladi Hull Parts - should be 'available', not 'duplicated'
    const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi')
    expect(status).toBe('available')
    
    // 3. Add Teladi Hull Parts - should succeed
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi')
    
    // 4. Both should coexist
    expect(group.nodes.filter((n: any) => n.wareId === 'hullparts').length).toBe(2)
  })
})
