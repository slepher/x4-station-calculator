import { describe, expect, it } from 'vitest'
import { buildDerivedActiveStationState } from '@/store/logic/productionStationShared'
import { StationDerivedMap, type StationDerivedCache } from '@/store/state/StationDerivedMap'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'

describe('production phase boundary', () => {
  it('does not expose sector phase-two aggregation APIs on flow map', () => {
    const flowMapApi = new StationDerivedMap({
      modulesMap: {},
      waresMap: {},
      medicalConsumptionMap: {}
    }) as unknown as Record<string, unknown>

    expect('computeSectorAggregation' in flowMapApi).toBe(false)
    expect('getSectorAggregation' in flowMapApi).toBe(false)
  })

  it('keeps phase-two derived modules in station state, not cache', () => {
    const cache: StationDerivedCache = {
      autoIndustryModules: [{ id: 'auto-industry', count: 1 }],
      autoHabitationModules: [{ id: 'auto-hab', count: 2 }],
      productionFlows: [{
        wareId: 'energycells',
        orderIndex: 1,
        tier: 0,
        transportType: 'container',
        unitVolume: 1,
        production: 10,
        consumption: 0,
        workforceConsumption: 0,
        netRate: 10,
        contributions: []
      }],
      warePriorityLevels: { energycells: 1 },
      actualWorkforce: 42,
      currentEfficiency: 0.95
    }

    const state = buildDerivedActiveStationState({
      stationId: 'station-1',
      plannedModules: [{ id: 'planned', count: 3 }],
      settings: { ...DEFAULT_STATION_SETTINGS },
      cache,
      deps: null
    })

    expect(state.productionFlows).toBe(cache.productionFlows)
    expect(state.autoIndustryModules).toEqual(cache.autoIndustryModules)
    expect(state.autoHabitationModules).toEqual(cache.autoHabitationModules)
    expect(state.autoInfrastructureModules).toEqual([])
    expect(state.resolvedModules).toEqual([
      { id: 'planned', count: 3 },
      { id: 'auto-industry', count: 1 },
      { id: 'auto-hab', count: 2 }
    ])
    expect((cache as Record<string, unknown>).autoInfrastructureModules).toBeUndefined()
    expect((cache as Record<string, unknown>).resolvedModules).toBeUndefined()
  })
})
