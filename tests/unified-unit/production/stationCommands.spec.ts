/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStationCommands, type StationCommandContext } from '@/store/logic/stationCommands'
import type { StationPlan, SavedModule, StationSettings } from '@/types/x4'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/StationStateMap'
import {
  ensureStationState,
  clearStationState,
  getPlannedModules,
  getLockedWares,
  getWarePriority,
  getSettings,
  getGroupedFlows,
  deepClone,
  syncPersistedToStateMap
} from '@/store/logic/stationComputeService'

const mockModulesMap: Record<string, any> = {
  'module_1': {
    id: 'module_1',
    macroId: 'macro_1',
    wareId: 'ware_1',
    nameId: 'Module 1',
    type: 'production',
    group: 'production',
    race: 'argon',
    buildTime: 100,
    buildCost: {},
    cycleTime: 60,
    outputs: { 'ware_1': 100 },
    inputs: {},
    workforce: { capacity: 0, needed: 0, maxBonus: 0 }
  },
  'module_2': {
    id: 'module_2',
    macroId: 'macro_2',
    wareId: 'ware_2',
    nameId: 'Module 2',
    type: 'production',
    group: 'production',
    race: 'argon',
    buildTime: 100,
    buildCost: {},
    cycleTime: 60,
    outputs: { 'ware_2': 100 },
    inputs: {},
    workforce: { capacity: 0, needed: 0, maxBonus: 0 }
  }
}

const mockWaresMap: Record<string, any> = {
  'ware_1': { id: 'ware_1', name: 'Ware 1', volume: 10, transport: 'container' },
  'ware_2': { id: 'ware_2', name: 'Ware 2', volume: 20, transport: 'liquid' }
}

const mockComputeDeps = {
  modulesMap: mockModulesMap,
  waresMap: mockWaresMap,
  workforceConsumptionMap: { argon: { idle: { food: 1, medical: 1 }, busy: { food: 1, medical: 1 } } },
  buildPriceMultiplier: 0.5,
  enforceDlcActivation: false,
  isModuleDlcActive: () => true
}

const mockStation: StationPlan = {
  id: 'test_station',
  name: 'Test Station',
  type: 'industrial',
  modules: [{ id: 'module_1', count: 2 }],
  settings: { ...DEFAULT_STATION_SETTINGS },
  lastUpdated: 0,
  lockedWares: [],
  warePriority: {}
}

function createMockContext(): StationCommandContext {
  const stations: Record<string, StationPlan> = {}
  stations['test_station'] = deepClone(mockStation)
  stations['__local__'] = {
    id: '__local__',
    name: '',
    type: 'industrial',
    modules: [],
    settings: { ...DEFAULT_STATION_SETTINGS },
    lastUpdated: 0,
    lockedWares: [],
    warePriority: {}
  }

  return {
    productionSource: 'empire',
    getStationById: (id: string) => stations[id] || null,
    updateEmpireStationModules: (id: string, modules: SavedModule[]) => {
      if (!stations[id]) return false
      stations[id].modules = deepClone(modules)
      return true
    },
    updateEmpireStationSettings: (id: string, settings: Partial<StationSettings>) => {
      if (!stations[id]) return false
      stations[id].settings = { ...stations[id].settings, ...settings }
      return true
    },
    updateBindingStationPlan: vi.fn(() => true),
    getComputeDeps: () => mockComputeDeps,
    getWaresMap: () => mockWaresMap
  }
}

describe('stationCommands', () => {
  let commands: ReturnType<typeof createStationCommands>
  let mockContext: StationCommandContext

  beforeEach(() => {
    clearStationState('test_station')
    clearStationState('__local__')
    mockContext = createMockContext()
    commands = createStationCommands(mockContext)
    
    const station = mockContext.getStationById('test_station')
    if (station) {
      syncPersistedToStateMap('test_station', station)
    }
  })

  describe('addModule', () => {
    it('should add new module', () => {
      commands.addModule('test_station', 'module_2', 3)
      const modules = getPlannedModules('test_station')
      expect(modules.some(m => m.id === 'module_2' && m.count === 3)).toBe(true)
    })

    it('should increment existing module count', () => {
      commands.addModule('test_station', 'module_1', 1)
      const modules = getPlannedModules('test_station')
      const mod = modules.find(m => m.id === 'module_1')
      expect(mod?.count).toBe(3)
    })
  })

  describe('removeModule', () => {
    it('should remove module at index', () => {
      commands.removeModule('test_station', 0)
      const modules = getPlannedModules('test_station')
      expect(modules.length).toBe(0)
    })
  })

  describe('updateModuleId', () => {
    it('should update module id at index', () => {
      commands.updateModuleId('test_station', 0, 'module_2')
      const modules = getPlannedModules('test_station')
      expect(modules[0]?.id).toBe('module_2')
    })
  })

  describe('updateModuleCount', () => {
    it('should update module count at index', () => {
      commands.updateModuleCount('test_station', 0, 5)
      const modules = getPlannedModules('test_station')
      expect(modules[0]?.count).toBe(5)
    })
  })

  describe('toggleWareLock', () => {
    it('should lock container ware', () => {
      commands.toggleWareLock('test_station', 'ware_1')
      const locked = getLockedWares('test_station')
      expect(locked).toContain('ware_1')
    })

    it('should unlock ware', () => {
      commands.toggleWareLock('test_station', 'ware_1')
      commands.toggleWareLock('test_station', 'ware_1')
      const locked = getLockedWares('test_station')
      expect(locked).not.toContain('ware_1')
    })

    it('should not lock non-container ware', () => {
      commands.toggleWareLock('test_station', 'ware_2')
      const locked = getLockedWares('test_station')
      expect(locked).not.toContain('ware_2')
    })
  })

  describe('updateWarePriority', () => {
    it('should set ware priority', () => {
      commands.updateWarePriority('test_station', 'ware_1', 1)
      const priority = getWarePriority('test_station')
      expect(priority['ware_1']).toBe(1)
    })

    it('should remove ware priority when undefined', () => {
      commands.updateWarePriority('test_station', 'ware_1', 1)
      commands.updateWarePriority('test_station', 'ware_1', undefined)
      const priority = getWarePriority('test_station')
      expect(priority['ware_1']).toBeUndefined()
    })
  })

  describe('clearAll', () => {
    it('should clear all modules, lockedWares, warePriority', () => {
      commands.addModule('test_station', 'module_1', 1)
      commands.toggleWareLock('test_station', 'ware_1')
      commands.updateWarePriority('test_station', 'ware_1', 1)
      commands.clearAll('test_station')
      
      expect(getPlannedModules('test_station')).toEqual([])
      expect(getLockedWares('test_station')).toEqual([])
      expect(getWarePriority('test_station')).toEqual({})
    })
  })

  describe('applyPlan', () => {
    it('should apply plan modules and settings', () => {
      const plan: StationPlan = {
        id: 'plan_1',
        name: 'Plan 1',
        type: 'industrial',
        modules: [{ id: 'module_2', count: 10 }],
        settings: { sunlight: 50 },
        lastUpdated: 0,
        lockedWares: ['ware_1'],
        warePriority: { ware_1: 2 }
      }
      
      commands.applyPlan('test_station', plan)
      
      const modules = getPlannedModules('test_station')
      expect(modules.some(m => m.id === 'module_2' && m.count === 10)).toBe(true)
      
      const locked = getLockedWares('test_station')
      expect(locked).toContain('ware_1')
      
      const priority = getWarePriority('test_station')
      expect(priority['ware_1']).toBe(2)
    })
  })
})