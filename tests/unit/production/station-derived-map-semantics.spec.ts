import { describe, expect, it } from 'vitest'
import { StationDerivedMap } from '@/store/state/StationDerivedMap'

describe('StationDerivedMap semantics', () => {
  it('derives plan semantics internally for empty stations', () => {
    const map = new StationDerivedMap({
      modulesMap: {},
      waresMap: {},
      workforceConsumptionMap: {}
    })

    map.upsertStation('plan-station', {
      modulesMode: 'plan',
      modules: [],
      settings: {}
    })

    expect(map.getCache('plan-station')?.semantics).toEqual({
      tag: 'constructionsite',
      factoryGroup: undefined,
      productionProfile: undefined,
      profileName: undefined
    })
  })

  it('uses archive semantics source in full mode and preserves semantics on settings update', () => {
    const map = new StationDerivedMap({
      modulesMap: {},
      waresMap: {},
      workforceConsumptionMap: {}
    })

    map.upsertStation('archive-station', {
      modulesMode: 'full',
      modules: [],
      settings: {},
      archiveSemanticsSource: {
        tag: 'tradestation',
        factoryGroup: 'energy',
        productionProfile: 'energy',
        profileName: 'Energy'
      }
    })

    const initialSemantics = map.getCache('archive-station')?.semantics
    expect(initialSemantics).toEqual({
      tag: 'tradestation',
      factoryGroup: 'energy',
      productionProfile: 'energy',
      profileName: 'Energy'
    })

    map.updateSettings('archive-station', { sunlight: 150 })

    expect(map.getCache('archive-station')?.semantics).toEqual(initialSemantics)
  })
})
