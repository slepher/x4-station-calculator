import { describe, expect, it } from 'vitest'
import {
  buildCanonicalPlanningStationState,
  type ActiveStationState
} from '@/store/logic/productionStationShared'
import type { StationComputeDeps } from '@/store/state/stationSettings'

function createPlanState(): ActiveStationState {
  return {
    actualWorkforce: 10,
    currentEfficiency: 0.5,
    warePriorityLevels: { energycells: 2 },
    productionFlows: [
      {
        wareId: 'energycells',
        orderIndex: 0,
        tier: 1,
        transportType: 'container',
        unitVolume: 1,
        production: 10,
        consumption: 0,
        netRate: 10,
        contributions: []
      }
    ],
    plannedModules: [{ id: 'planned-prod', count: 1 }],
    autoIndustryModules: [{ id: 'auto-prod', count: 1 }],
    autoHabitationModules: [],
    autoInfrastructureModules: [{ id: 'stale-storage', count: 1 }],
    resolvedModules: [
      { id: 'planned-prod', count: 1 },
      { id: 'auto-prod', count: 1 },
      { id: 'stale-storage', count: 1 }
    ]
  }
}

describe('buildCanonicalPlanningStationState', () => {
  it('re-derives infrastructure modules from canonical planning flow', () => {
    const deps: StationComputeDeps = {
      modulesMap: {
        'planned-prod': {
          id: 'planned-prod',
          outputs: { energycells: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0 },
          transport: 'container'
        } as any,
        'auto-prod': {
          id: 'auto-prod',
          outputs: { energycells: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0 },
          transport: 'container'
        } as any,
        'stale-storage': {
          id: 'stale-storage',
          outputs: {},
          inputs: {},
          type: 'storage',
          macroclass: 'storage',
          transport: 'container'
        } as any
      },
      waresMap: {
        energycells: {
          id: 'energycells',
          tier: 1,
          transport: 'container',
          volume: 1
        } as any
      },
      workforceConsumptionMap: {},
      enforceDlcActivation: false,
      isModuleDlcActive: () => true
    }

    const state = buildCanonicalPlanningStationState({
      planState: createPlanState(),
      archiveBuiltModules: [],
      archiveBuildingModules: [],
      settings: {
        racePreference: 'argon',
        sunlight: 100,
        resourceBufferHours: 1,
        primaryProductBufferHours: 12,
        secondaryProductBufferHours: 2,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportShipCapacity: 62000,
        considerWorkforceForAutoFill: true,
        workforceAuto: true,
        manualWorkforce: 0,
        useHQ: false,
        showEmpireGaps: false
      },
      deps,
      calculateInfrastructureModules: () => [{ id: 'fresh-storage', count: 2 }],
      calculateCanonicalFlows: () => ({
        productionFlows: createPlanState().productionFlows,
        actualWorkforce: 20,
        currentEfficiency: 1
      })
    })

    expect(state.autoInfrastructureModules).toEqual([{ id: 'fresh-storage', count: 2 }])
    expect(state.finalPlannedModules).toEqual([
      { id: 'planned-prod', count: 1 },
      { id: 'auto-prod', count: 1 },
      { id: 'fresh-storage', count: 2 }
    ])
    expect(state.effectiveTargetModules).toEqual([
      { id: 'planned-prod', count: 1 },
      { id: 'auto-prod', count: 1 },
      { id: 'fresh-storage', count: 2 }
    ])
    expect(state.actualWorkforce).toBe(20)
    expect(state.currentEfficiency).toBe(1)
  })
})
