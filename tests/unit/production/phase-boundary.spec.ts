import { describe, expect, it } from 'vitest'
import { buildDerivedActiveStationState } from '@/store/logic/productionStationShared'
import { StationDerivedMap, type StationDerivedCache } from '@/store/state/StationDerivedMap'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'

describe('production phase boundary', () => {
  it('does not expose sector phase-two aggregation APIs on flow map', () => {
    const flowMapApi = new StationDerivedMap({
      modulesMap: {},
      waresMap: {},
      workforceConsumptionMap: {}
    }) as unknown as Record<string, unknown>

    expect('computeSectorAggregation' in flowMapApi).toBe(false)
    expect('getSectorAggregation' in flowMapApi).toBe(false)
  })

  it('keeps final planning flow in StationDerivedMap cache for aggregation', () => {
    const flowMap = new StationDerivedMap({
      modulesMap: {
        prod: {
          id: 'prod',
          macroId: 'module_prod',
          type: 'production',
          race: 'argon',
          outputs: { hullparts: 10 },
          inputs: {},
          workforce: { needed: 10, capacity: 0, maxBonus: 0 }
        } as any,
        habitat: {
          id: 'habitat',
          macroId: 'module_habitat',
          type: 'habitation',
          race: 'argon',
          outputs: {},
          inputs: {},
          workforce: { needed: 0, capacity: 20, maxBonus: 0 }
        } as any
      },
      waresMap: {
        hullparts: { id: 'hullparts', transport: 'container', volume: 1, tier: 1 } as any
      },
      workforceConsumptionMap: {}
    })

    flowMap.upsertStation('station-1', {
      modulesMode: 'plan',
      modules: [{ id: 'prod', count: 1 }],
      settings: {
        considerWorkforceForAutoFill: true,
        workforceAuto: true,
        racePreference: 'argon'
      },
      referenceModules: [{ id: 'habitat', count: 1 }]
    })

    const cache = flowMap.getCache('station-1')
    expect(cache).not.toBeNull()
    expect(cache!.autoHabitationModules).toEqual([])
    expect(cache!.actualWorkforce).toBe(10)
    expect(cache!.currentEfficiency).toBe(1)
    expect((cache as Record<string, unknown>).autoInfrastructureModules).toBeUndefined()
    expect((cache as Record<string, unknown>).resolvedModules).toBeUndefined()
  })

  it('re-derives habitation and final flow in shared stage for one-shot blueprint state', () => {
    const cache: StationDerivedCache = {
      autoIndustryModules: [{ id: 'auto-industry', count: 1 }],
      autoHabitationModules: [],
      productionFlows: [],
      warePriorityLevels: { hullparts: 2 },
      actualWorkforce: 0,
      currentEfficiency: 0
    }

    const state = buildDerivedActiveStationState({
      stationId: 'station-2',
      plannedModules: [{ id: 'planned-prod', count: 1 }],
      settings: {
        ...DEFAULT_STATION_SETTINGS,
        considerWorkforceForAutoFill: true,
        workforceAuto: true,
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        transportShipCapacity: 999999
      },
      cache,
      deps: {
        modulesMap: {
          'planned-prod': {
            id: 'planned-prod',
            macroId: 'module_planned_prod',
            type: 'production',
            race: 'argon',
            outputs: { hullparts: 10 },
            inputs: {},
            workforce: { needed: 10, capacity: 0, maxBonus: 0 }
          } as any,
          'auto-industry': {
            id: 'auto-industry',
            macroId: 'module_auto_industry',
            type: 'production',
            race: 'argon',
            outputs: { energycells: 10 },
            inputs: {},
            workforce: { needed: 10, capacity: 0, maxBonus: 0 }
          } as any,
          habitat: {
            id: 'habitat',
            macroId: 'module_habitat',
            type: 'habitation',
            race: 'argon',
            outputs: {},
            inputs: {},
            workforce: { needed: 0, capacity: 20, maxBonus: 0 }
          } as any
        },
        waresMap: {
          hullparts: { id: 'hullparts', transport: 'container', volume: 1, tier: 1 } as any,
          energycells: { id: 'energycells', transport: 'container', volume: 1, tier: 1 } as any
        },
        workforceConsumptionMap: {},
        enforceDlcActivation: false,
        isModuleDlcActive: () => true
      }
    })

    expect(state.autoIndustryModules).toEqual([{ id: 'auto-industry', count: 1 }])
    expect(state.autoHabitationModules).toEqual([{ id: 'habitat', count: 1 }])
    expect(state.actualWorkforce).toBe(20)
    expect(state.currentEfficiency).toBe(1)
    expect(state.resolvedModules).toEqual([
      { id: 'planned-prod', count: 1 },
      { id: 'auto-industry', count: 1 },
      { id: 'habitat', count: 1 }
    ])
  })

  it('uses effective planned ordering for flow and keeps recommended ahead of other floor modules', () => {
    const flowMap = new StationDerivedMap({
      modulesMap: {
        explicit_prod: {
          id: 'explicit_prod',
          macroId: 'module_explicit_prod',
          type: 'production',
          method: 'default',
          race: 'argon',
          outputs: { explicit_ware: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        support_floor: {
          id: 'support_floor',
          macroId: 'module_support_floor',
          type: 'production',
          method: 'default',
          race: 'argon',
          outputs: { support_ware: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        recommended_prod: {
          id: 'recommended_prod',
          macroId: 'module_recommended_prod',
          type: 'production',
          method: 'default',
          race: 'argon',
          outputs: { recommended_ware: 10 },
          inputs: { support_ware: 5 },
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any
      },
      waresMap: {
        explicit_ware: { id: 'explicit_ware', transport: 'container', volume: 1, tier: 3 } as any,
        recommended_ware: { id: 'recommended_ware', transport: 'container', volume: 1, tier: 2 } as any,
        support_ware: { id: 'support_ware', transport: 'container', volume: 1, tier: 1 } as any
      },
      workforceConsumptionMap: {}
    })

    flowMap.upsertStation('station-ordered', {
      modulesMode: 'plan',
      modules: [{ id: 'explicit_prod', count: 1 }],
      settings: {
        ...DEFAULT_STATION_SETTINGS,
        considerWorkforceForAutoFill: false,
        workforceAuto: false,
        racePreference: 'argon'
      },
      referenceModules: [
        { id: 'support_floor', count: 1 },
        { id: 'recommended_prod', count: 1 }
      ]
    })

    const snapshot = flowMap.getSnapshot('station-ordered')
    expect(snapshot?.fullModules).toEqual([
      { id: 'explicit_prod', count: 1 },
      { id: 'recommended_prod', count: 1 },
      { id: 'support_floor', count: 1 }
    ])

    const cache = flowMap.getCache('station-ordered')
    expect(cache?.productionFlows.map((flow) => flow.wareId)).toEqual([
      'explicit_ware',
      'recommended_ware',
      'support_ware'
    ])
    expect(cache?.warePriorityLevels.recommended_ware).toBe(2)
  })

  it('does not treat reference floor energycells as planned ware by default', () => {
    const flowMap = new StationDerivedMap({
      modulesMap: {
        planned_prod: {
          id: 'planned_prod',
          macroId: 'module_planned_prod',
          type: 'production',
          method: 'default',
          race: 'argon',
          outputs: { hullparts: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        reference_consumer: {
          id: 'reference_consumer',
          macroId: 'module_reference_consumer',
          type: 'production',
          method: 'default',
          race: 'argon',
          outputs: { intermediate_ware: 10 },
          inputs: { energycells: 5 },
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any,
        solar_floor: {
          id: 'solar_floor',
          macroId: 'module_solar_floor',
          type: 'production',
          method: 'default',
          race: 'terran',
          outputs: { energycells: 10 },
          inputs: {},
          workforce: { needed: 0, capacity: 0, maxBonus: 0 }
        } as any
      },
      waresMap: {
        hullparts: { id: 'hullparts', transport: 'container', volume: 1, tier: 2 } as any,
        intermediate_ware: { id: 'intermediate_ware', transport: 'container', volume: 1, tier: 1 } as any,
        energycells: { id: 'energycells', transport: 'container', volume: 1, tier: 1 } as any
      },
      workforceConsumptionMap: {}
    })

    flowMap.upsertStation('station-energy-floor', {
      modulesMode: 'plan',
      modules: [{ id: 'planned_prod', count: 1 }],
      settings: {
        ...DEFAULT_STATION_SETTINGS,
        considerWorkforceForAutoFill: false,
        workforceAuto: false,
        racePreference: 'argon'
      },
      referenceModules: [
        { id: 'solar_floor', count: 1 },
        { id: 'reference_consumer', count: 1 }
      ]
    })

    const cache = flowMap.getCache('station-energy-floor')
    expect(cache?.warePriorityLevels.hullparts).toBe(2)
    expect(cache?.warePriorityLevels.energycells).toBe(0)
  })
})
