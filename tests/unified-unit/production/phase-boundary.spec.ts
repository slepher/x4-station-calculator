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
})
