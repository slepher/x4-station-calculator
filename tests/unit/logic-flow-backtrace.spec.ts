/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLogicFlowStore } from '../../src/store/useLogicFlowStore'
import { useGameDataStore } from '../../src/store/useGameDataStore'
import type { FlowNode } from '../../src/types/x4'
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

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn()
  }
}))

// Mock useX4I18n
vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: vi.fn(),
    translateModuleGroup: vi.fn()
  })
}))

describe('LogicFlow Fallback & Teladi Tracing Logic', () => {
  let logicFlow: any
  let gameData: any

  beforeEach(() => {
    setActivePinia(createPinia())
    logicFlow = useLogicFlowStore()
    gameData = useGameDataStore()

    const modules = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8'))
    const wares = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8'))
    
    const modulesMap: Record<string, any> = {}
    modules.forEach((m: any) => {
      modulesMap[m.id] = {
        ...m,
        outputs: m.outputs || {},
        inputs: m.inputs || {}
      }
    })
    
    const modulesByOutputMap: Record<string, any[]> = {}
    modules.forEach((m: any) => {
      Object.keys(m.outputs || {}).forEach(wareId => {
        if (!modulesByOutputMap[wareId]) {
          modulesByOutputMap[wareId] = []
        }
        modulesByOutputMap[wareId].push(modulesMap[m.id])
      })
    })
    
    const waresMap: Record<string, any> = {}
    wares.forEach((w: any) => waresMap[w.id] = w)

    gameData.modulesMap = modulesMap
    gameData.waresMap = waresMap
    gameData.modulesByOutputMap = modulesByOutputMap
    gameData.isReady = true
  })

  describe('findModuleForWare Fallback Logic', () => {
    it('should prefer specified race for industrial candidates (e.g., terran)', () => {
      // Energy Cells has both default and terran methods/races
      const wareId = 'energycells'
      const module = gameData.findModuleForWare(wareId, 'terran')
      expect(module.race).toBe('terran')
    })

    it('should fallback to method matching if specified race does not exist', () => {
      // Advanced Electronics (advancedelectronics) only has default method
      const wareId = 'advancedelectronics'
      const module = gameData.findModuleForWare(wareId, 'terran')
      expect(module.race).toBe('default')
    })

    it('should fallback to race if neither specified candidate nor default exist (Agricultural case)', () => {
      // Scruffin Fruit (scruffinfruits) is produced by Split modules (race: split, method: default)
      const wareId = 'scruffinfruits'
      const module = gameData.findModuleForWare(wareId, 'other', 'split')
      expect(module).not.toBeNull()
      expect(module.race).toBe('split')
    })
  })

  describe('Teladi T3 Tracing & Default Fallback', () => {
    it('should correctly trace Teladi T3 ware using default modules for upstream components', () => {
      const group = logicFlow.addGroup('industrial', 'teladi', 'Teladi Test Group')
      
      // Scanning Arrays (scanningarrays)
      const wareId = 'scanningarrays'
      logicFlow.expandUpstream(group.id, wareId, 'manual')

      const addedNodes = group.nodes
      expect(addedNodes.some((n: FlowNode) => n.wareId === wareId)).toBe(true)

      // Check Silicon Wafers (siliconwafers)
      const siliconNode = addedNodes.find((n: FlowNode) => n.wareId === 'siliconwafers')
      expect(siliconNode).toBeDefined()
      // Silicon Wafers does NOT have a teladi race in game data, should fallback to default
      expect(siliconNode.race).toBe('default')

      // Check Teladianium (teladianium) - This IS a Teladi specific ware
      const teladianiumNode = addedNodes.find((n: FlowNode) => n.wareId === 'teladianium')
      if (teladianiumNode) {
        expect(teladianiumNode.race).toBe('teladi')
      }
    })
  })

  describe('Node Lifecycle & Cleanup', () => {
    it('should downgrade manual node to auto if still needed by others', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      // Scanning Arrays (T3) -> Silicon Wafers (T1)
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual')
      
      const siliconNode = group.nodes.find((n: FlowNode) => n.wareId === 'siliconwafers')
      expect(siliconNode).toBeDefined()
      expect(siliconNode.source).toBe('auto')
      
      // Upgrade Silicon Wafers to manual
      siliconNode.source = 'manual'
      
      // Now try to remove Silicon Wafers. 
      // It is still needed by Scanning Arrays, so it should NOT be removed, but downgraded.
      logicFlow.removeNode(group.id, siliconNode.id)
      
      const nodeAfter = group.nodes.find((n: FlowNode) => n.wareId === 'siliconwafers')
      expect(nodeAfter).toBeDefined()
      expect(nodeAfter.source).toBe('auto') // Successfully downgraded
    })

    it('should physically remove manual node if not needed by others', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'antimattercells', 'manual')
      
      const node = group.nodes.find((n: FlowNode) => n.wareId === 'antimattercells')
      logicFlow.removeNode(group.id, node.id)
      
      expect(group.nodes.find((n: FlowNode) => n.wareId === 'antimattercells')).toBeUndefined()
    })

    it('should cleanup unused auto nodes when a parent is locked', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual')
      
      const scanningArrayNode = group.nodes.find((n: FlowNode) => n.wareId === 'scanningarrays')
      expect(group.nodes.length).toBeGreaterThan(1)
      
      // Lock Scanning Arrays
      logicFlow.toggleLock(group.id, scanningArrayNode.id)
      
      // Upstream nodes should be cleaned up because they were auto
      expect(group.nodes.length).toBe(1)
      expect(group.nodes[0].wareId).toBe('scanningarrays')
    })
  })

  describe('Bug Fixes & Race Logic Enhancements', () => {
    it('should NOT add a node if no module is found and it is not a basic resource', () => {
      const group = logicFlow.addGroup('industrial', 'terran')
      
      // Assume 'advancedelectronics' does not have a terran module (it doesn't in default data)
      // And if we force a very specific check that fails findModuleForWare:
      // We'll mock findModuleForWare to return null for a specific ware
      const originalFind = gameData.findModuleForWare
      gameData.findModuleForWare = vi.fn().mockReturnValue(null)
      
      logicFlow.expandUpstream(group.id, 'advancedelectronics', 'manual')
      
      expect(group.nodes.length).toBe(0)
      
      gameData.findModuleForWare = originalFind
    })

    it('should re-activate and connect a node if manually added again', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual')
      
      const node = group.nodes.find((n: FlowNode) => n.wareId === 'scanningarrays')
      // Isolate it (clears moduleId)
      logicFlow.toggleNodeIsolation(group.id, node.id)
      expect(node.isIsolated).toBe(true)
      expect(node.moduleId).toBeUndefined()
      
      // Manually add again
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual')
      
      expect(node.isIsolated).toBe(false)
      expect(node.moduleId).toBeDefined()
      expect(group.nodes.length).toBeGreaterThan(1) // Should have expanded upstream
    })

    it('should respect overrideRace in recursive calls', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      // Force teladi race for a ware that has both default and teladi (e.g., scanningarrays)
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual', 'teladi')
      
      // In Teladi mode, Scanning Arrays should require Silicon Wafers and Teladianium
      const scanningNode = group.nodes.find((n: FlowNode) => n.wareId === 'scanningarrays')
      expect(scanningNode).toBeDefined()
      expect(scanningNode.race).toBe('teladi')
      
      const teladianiumNode = group.nodes.find((n: FlowNode) => n.wareId === 'teladianium')
      expect(teladianiumNode).toBeDefined()
      expect(teladianiumNode.race).toBe('teladi')
    })

    it('should correctly handle weaponcomponents tracing without No Module nodes', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      // Weapon Components (weaponcomponents) in Default mode
      logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default')
      
      const weaponNode = group.nodes.find((n: FlowNode) => n.wareId === 'weaponcomponents')
      expect(weaponNode).toBeDefined()
      expect(weaponNode.moduleId).toBeDefined()
      expect(weaponNode.race).toBe('default')
      
      // Check upstream dependencies for Default Weapon Components:
      // Hull Parts (T2), Plasma Conductors (T2)
      const hullParts = group.nodes.find((n: FlowNode) => n.wareId === 'hullparts')
      expect(hullParts).toBeDefined()
      expect(hullParts.race).toBe('default')
      
      const plasmaConductors = group.nodes.find((n: FlowNode) => n.wareId === 'plasmaconductors')
      expect(plasmaConductors).toBeDefined()
      expect(plasmaConductors.race).toBe('default')
      
      // Ensure no "No Module" nodes (nodes without moduleId and not basic)
      const noModuleNodes = group.nodes.filter((n: FlowNode) => {
        const ware = gameData.waresMap[n.wareId]
        const isBasic = ware.tier === 0 || n.wareId === 'energycells'
        return !isBasic && !n.moduleId
      })
      
      expect(noModuleNodes.length).toBe(0)
    })

    it('should respect Teladi race context for Missile Components dependencies', () => {
      // Repro Bug 2: Missile Components (missilecomponents) in Teladi context
      const group = logicFlow.addGroup('industrial', 'teladi')
      
      // We mock a Teladi module for missilecomponents that uses Teladianium
      const originalModules = gameData.modulesMap
      gameData.modulesMap = {
        ...originalModules,
        'teladi_missile_module': {
          id: 'teladi_missile_module',
          race: 'teladi',
          method: 'default',
          outputs: { 'missilecomponents': 1 },
          inputs: { 'teladianium': 10, 'energycells': 20 }
        }
      }
      
      logicFlow.expandUpstream(group.id, 'missilecomponents', 'manual', 'teladi')
      
      const missileNode = group.nodes.find((n: FlowNode) => n.wareId === 'missilecomponents')
      expect(missileNode).toBeDefined()
      expect(missileNode.moduleId).toBe('teladi_missile_module')
      
      // Upstream T1 should be Teladianium, NOT Refined Metals
      const teladianiumNode = group.nodes.find((n: FlowNode) => n.wareId === 'teladianium')
      const refinedMetalsNode = group.nodes.find((n: FlowNode) => n.wareId === 'refinedmetals')
      
      expect(teladianiumNode).toBeDefined()
      expect(refinedMetalsNode).toBeUndefined()
      
      gameData.modulesMap = originalModules
    })
  })

  describe('Smart Insertion Logic', () => {
    it('should insert nodes in correct Tier order (High Tier first, Same Tier appended, Low Tier pushed back)', () => {
      const group = logicFlow.addGroup('industrial', 'default')
      
      // 1. Add T3 (Scanning Arrays)
      logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual')
      // Current order (manual): [Scanning Arrays (T3)]
      
      // 2. Add T1 (Silicon Wafers) manually
      logicFlow.expandUpstream(group.id, 'siliconwafers', 'manual')
      // Silicon Wafers (T1) should be AFTER Scanning Arrays (T3)
      let manualNodes = group.nodes.filter((n: any) => n.source === 'manual')
      expect(manualNodes[0].wareId).toBe('scanningarrays')
      expect(manualNodes[1].wareId).toBe('siliconwafers')
      
      // 3. Add T2 (Microchips) manually
      // Microchips (T2) should be inserted BETWEEN T3 and T1
      logicFlow.expandUpstream(group.id, 'microchips', 'manual')
      manualNodes = group.nodes.filter((n: any) => n.source === 'manual')
      expect(manualNodes[0].wareId).toBe('scanningarrays') // T3
      expect(manualNodes[1].wareId).toBe('microchips')     // T2
      expect(manualNodes[2].wareId).toBe('siliconwafers')  // T1
      
      // 4. Add another T2 (Hull Parts) manually
      // Hull Parts (T2) should be appended AFTER existing T2 (Microchips) but BEFORE T1
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual')
      manualNodes = group.nodes.filter((n: any) => n.source === 'manual')
      expect(manualNodes[0].wareId).toBe('scanningarrays') // T3
      expect(manualNodes[1].wareId).toBe('microchips')     // T2 (First T2)
      expect(manualNodes[2].wareId).toBe('hullparts')      // T2 (Second T2)
      expect(manualNodes[3].wareId).toBe('siliconwafers')  // T1
    })
  })
})
