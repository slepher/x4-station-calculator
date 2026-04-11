/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  deepClone,
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getGroupedFlows,
  getFilteredGroupedFlows,
  getStationState,
  patchStationState,
  ensureStationState,
  clearStationState,
  getPlannedModules,
  getLockedWares,
  getWarePriority,
  getSettings
} from '@/store/logic/stationComputeService'
import type { StationPlan, SavedModule, StationSettings } from '@/types/x4'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/StationStateMap'

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
  }
}

const mockWaresMap: Record<string, any> = {
  'ware_1': {
    id: 'ware_1',
    name: 'Ware 1',
    volume: 10,
    transport: 'container'
  }
}

const mockMedicalConsumptionMap: any = {
  argon: { food: 1, medical: 1 }
}

const mockComputeDeps = buildStationComputeDeps({
  modulesMap: mockModulesMap,
  waresMap: mockWaresMap,
  medicalConsumptionMap: mockMedicalConsumptionMap,
  buildPriceMultiplier: 0.5,
  enforceDlcActivation: false,
  isModuleDlcActive: () => true
})

describe('stationComputeService', () => {
  beforeEach(() => {
    clearStationState('__local__')
    clearStationState('test_station')
  })

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
    })

    it('should deep clone arrays', () => {
      const original = [{ id: 'a', count: 1 }, { id: 'b', count: 2 }]
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
    })
  })

  describe('buildStationComputeDeps', () => {
    it('should build compute deps with all fields', () => {
      const deps = buildStationComputeDeps({
        modulesMap: mockModulesMap,
        waresMap: mockWaresMap,
        medicalConsumptionMap: mockMedicalConsumptionMap,
        buildPriceMultiplier: 0.5
      })

      expect(deps.modulesMap).toBe(mockModulesMap)
      expect(deps.waresMap).toBe(mockWaresMap)
      expect(deps.medicalConsumptionMap).toBe(mockMedicalConsumptionMap)
      expect(deps.buildPriceMultiplier).toBe(0.5)
    })

    it('should use default buildPriceMultiplier', () => {
      const deps = buildStationComputeDeps({
        modulesMap: mockModulesMap,
        waresMap: mockWaresMap,
        medicalConsumptionMap: mockMedicalConsumptionMap
      })

      expect(deps.buildPriceMultiplier).toBe(0.5)
    })
  })

  describe('ensureStationState', () => {
    it('should create state if not exists', () => {
      const state = ensureStationState('test_station')
      expect(state).toBeDefined()
      expect(state.stationId).toBe('test_station')
      expect(state.plannedModules).toEqual([])
    })

    it('should return existing state', () => {
      ensureStationState('test_station')
      patchStationState('test_station', { plannedModules: [{ id: 'module_1', count: 5 }] })
      const state = ensureStationState('test_station')
      expect(state.plannedModules).toEqual([{ id: 'module_1', count: 5 }])
    })
  })

  describe('patchStationState', () => {
    it('should patch plannedModules', () => {
      patchStationState('test_station', { plannedModules: [{ id: 'module_1', count: 3 }] })
      const modules = getPlannedModules('test_station')
      expect(modules).toEqual([{ id: 'module_1', count: 3 }])
    })

    it('should patch lockedWares', () => {
      patchStationState('test_station', { lockedWares: ['ware_1'] })
      const locked = getLockedWares('test_station')
      expect(locked).toEqual(['ware_1'])
    })

    it('should patch warePriority', () => {
      patchStationState('test_station', { warePriority: { ware_1: 1 } })
      const priority = getWarePriority('test_station')
      expect(priority).toEqual({ ware_1: 1 })
    })

    it('should patch settings', () => {
      patchStationState('test_station', { settings: { sunlight: 50 } as StationSettings })
      const settings = getSettings('test_station')
      expect(settings.sunlight).toBe(50)
    })
  })

  describe('syncPersistedToStateMap', () => {
    it('should sync persisted station to state map', () => {
      const station: StationPlan = {
        id: 'test_station',
        name: 'Test Station',
        type: 'industrial',
        modules: [{ id: 'module_1', count: 2 }],
        settings: { sunlight: 100 },
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }

      syncPersistedToStateMap('test_station', station)
      const modules = getPlannedModules('test_station')
      expect(modules).toEqual([{ id: 'module_1', count: 2 }])
    })
  })

  describe('recomputeStation', () => {
    it('should recompute station state', () => {
      ensureStationState('test_station')
      patchStationState('test_station', { plannedModules: [{ id: 'module_1', count: 1 }] })
      recomputeStation('test_station', mockComputeDeps)
      const flows = getGroupedFlows('test_station')
      expect(flows).toBeDefined()
      expect(flows.flows).toBeDefined()
    })
  })

  describe('getGroupedFlows', () => {
    it('should return empty flows for non-existent station', () => {
      const flows = getGroupedFlows('non_existent')
      expect(flows.flows).toEqual([])
    })

    it('should return flows after recompute', () => {
      ensureStationState('test_station')
      patchStationState('test_station', { plannedModules: [{ id: 'module_1', count: 1 }] })
      recomputeStation('test_station', mockComputeDeps)
      const flows = getGroupedFlows('test_station')
      expect(flows).toBeDefined()
    })
  })

  describe('getFilteredGroupedFlows', () => {
    it('should return filtered flows', () => {
      ensureStationState('test_station')
      patchStationState('test_station', { plannedModules: [{ id: 'module_1', count: 1 }] })
      recomputeStation('test_station', mockComputeDeps)
      const flows = getFilteredGroupedFlows('test_station')
      expect(flows).toBeDefined()
    })
  })

  describe('getStationState', () => {
    it('should return null for non-existent station', () => {
      const state = getStationState('non_existent')
      expect(state).toBeNull()
    })

    it('should return state for existing station', () => {
      ensureStationState('test_station')
      const state = getStationState('test_station')
      expect(state).toBeDefined()
      expect(state?.stationId).toBe('test_station')
    })
  })

  describe('clearStationState', () => {
    it('should remove station state', () => {
      ensureStationState('test_station')
      clearStationState('test_station')
      const state = getStationState('test_station')
      expect(state).toBeNull()
    })
  })
})