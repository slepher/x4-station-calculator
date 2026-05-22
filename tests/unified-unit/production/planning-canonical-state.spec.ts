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
    effectivePlannedModules: [{ id: 'planned-prod', count: 1 }],
    recommendedModules: [],
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

  it('re-derives habitation before canonical infrastructure and final modules', () => {
    const deps: StationComputeDeps = {
      modulesMap: {
        'planned-prod': {
          id: 'planned-prod',
          type: 'production',
          race: 'argon',
          outputs: { hullparts: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0, maxBonus: 0 }
        } as any,
        'auto-prod': {
          id: 'auto-prod',
          type: 'production',
          race: 'argon',
          outputs: { energycells: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0, maxBonus: 0 }
        } as any,
        habitat: {
          id: 'habitat',
          type: 'habitation',
          race: 'argon',
          outputs: {},
          inputs: {},
          workforce: { needed: 0, capacity: 20, maxBonus: 0 }
        } as any
      },
      waresMap: {
        hullparts: { id: 'hullparts', tier: 1, transport: 'container', volume: 1 } as any,
        energycells: { id: 'energycells', tier: 1, transport: 'container', volume: 1 } as any
      },
      workforceConsumptionMap: {},
      enforceDlcActivation: false,
      isModuleDlcActive: () => true
    }

    const state = buildCanonicalPlanningStationState({
      planState: createPlanState(),
      archiveBuiltModules: [],
      archiveBuildingModules: [],
      referenceModules: [{ id: 'habitat', count: 1 }],
      settings: {
        racePreference: 'argon',
        sunlight: 100,
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportShipCapacity: 999999,
        considerWorkforceForAutoFill: true,
        workforceAuto: true,
        manualWorkforce: 0,
        useHQ: false,
        showEmpireGaps: false
      },
      deps,
      calculateInfrastructureModules: () => [],
      calculateCanonicalFlows: () => ({
        productionFlows: createPlanState().productionFlows,
        actualWorkforce: 20,
        currentEfficiency: 1
      })
    })

    expect(state.autoHabitationModules).toEqual([{ id: 'habitat', count: 1 }])
    expect(state.finalPlannedModules).toEqual([
      { id: 'planned-prod', count: 1 },
      { id: 'auto-prod', count: 1 },
      { id: 'habitat', count: 1 }
    ])
    expect(state.effectiveTargetModules).toEqual([
      { id: 'planned-prod', count: 1 },
      { id: 'auto-prod', count: 1 },
      { id: 'habitat', count: 1 }
    ])
  })

  it('preserves effective planned ordering when rebuilding canonical base', () => {
    const deps: StationComputeDeps = {
      modulesMap: {
        explicit_prod: {
          id: 'explicit_prod',
          type: 'production',
          race: 'argon',
          outputs: { explicit_ware: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        recommended_prod: {
          id: 'recommended_prod',
          type: 'production',
          race: 'argon',
          outputs: { recommended_ware: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        support_floor: {
          id: 'support_floor',
          type: 'production',
          race: 'argon',
          outputs: { support_ware: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any
      },
      waresMap: {
        explicit_ware: { id: 'explicit_ware', tier: 3, transport: 'container', volume: 1 } as any,
        recommended_ware: { id: 'recommended_ware', tier: 2, transport: 'container', volume: 1 } as any,
        support_ware: { id: 'support_ware', tier: 1, transport: 'container', volume: 1 } as any
      },
      workforceConsumptionMap: {},
      enforceDlcActivation: false,
      isModuleDlcActive: () => true
    }

    const state = buildCanonicalPlanningStationState({
      planState: {
        actualWorkforce: 0,
        currentEfficiency: 1,
        warePriorityLevels: {},
        productionFlows: [],
        plannedModules: [{ id: 'explicit_prod', count: 1 }],
        effectivePlannedModules: [
          { id: 'explicit_prod', count: 1 },
          { id: 'recommended_prod', count: 1 }
        ],
        recommendedModules: [{ id: 'recommended_prod', count: 1 }],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: [
          { id: 'explicit_prod', count: 1 },
          { id: 'recommended_prod', count: 1 }
        ]
      },
      archiveBuiltModules: [{ id: 'support_floor', count: 1 }],
      archiveBuildingModules: [],
      settings: {
        racePreference: 'argon',
        sunlight: 100,
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportShipCapacity: 999999,
        considerWorkforceForAutoFill: false,
        workforceAuto: false,
        manualWorkforce: 0,
        useHQ: false,
        showEmpireGaps: false
      },
      deps,
      calculateInfrastructureModules: () => [],
      calculateCanonicalFlows: (modules) => ({
        productionFlows: modules.map((module, index) => {
          const wareId = Object.keys(deps.modulesMap[module.id]!.outputs || {})[0]!
          return {
            wareId,
            orderIndex: index,
            tier: deps.waresMap[wareId]!.tier || 0,
            transportType: 'container' as const,
            unitVolume: 1,
            production: 10,
            consumption: 0,
            netRate: 10,
            contributions: []
          }
        }),
        actualWorkforce: 0,
        currentEfficiency: 1
      })
    })

    expect(state.resolvedModules).toEqual([
      { id: 'explicit_prod', count: 1 },
      { id: 'recommended_prod', count: 1 },
      { id: 'support_floor', count: 1 }
    ])
  })

  it('sizes habitation from canonical production base when archive has larger production counts', () => {
    const deps: StationComputeDeps = {
      modulesMap: {
        'planned-prod': {
          id: 'planned-prod',
          type: 'production',
          race: 'argon',
          outputs: { hullparts: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0, maxBonus: 0 }
        } as any,
        'auto-prod': {
          id: 'auto-prod',
          type: 'production',
          race: 'argon',
          outputs: { energycells: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0, maxBonus: 0 }
        } as any,
        habitat: {
          id: 'habitat',
          type: 'habitation',
          race: 'argon',
          outputs: {},
          inputs: {},
          workforce: { needed: 0, capacity: 20, maxBonus: 0 }
        } as any
      },
      waresMap: {
        hullparts: { id: 'hullparts', tier: 1, transport: 'container', volume: 1 } as any,
        energycells: { id: 'energycells', tier: 1, transport: 'container', volume: 1 } as any
      },
      workforceConsumptionMap: {},
      enforceDlcActivation: false,
      isModuleDlcActive: () => true
    }

    const state = buildCanonicalPlanningStationState({
      planState: createPlanState(),
      archiveBuiltModules: [
        { id: 'planned-prod', count: 3 },
        { id: 'auto-prod', count: 2 }
      ],
      archiveBuildingModules: [],
      referenceModules: [{ id: 'habitat', count: 10 }],
      settings: {
        racePreference: 'argon',
        sunlight: 100,
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportShipCapacity: 999999,
        considerWorkforceForAutoFill: true,
        workforceAuto: true,
        manualWorkforce: 0,
        useHQ: false,
        showEmpireGaps: false
      },
      deps,
      calculateInfrastructureModules: () => [],
      calculateCanonicalFlows: () => ({
        productionFlows: createPlanState().productionFlows,
        actualWorkforce: 50,
        currentEfficiency: 1
      })
    })

    expect(state.autoHabitationModules).toEqual([{ id: 'habitat', count: 3 }])
    expect(state.finalPlannedModules).toEqual([
      { id: 'planned-prod', count: 3 },
      { id: 'auto-prod', count: 2 },
      { id: 'habitat', count: 3 }
    ])
  })
})
