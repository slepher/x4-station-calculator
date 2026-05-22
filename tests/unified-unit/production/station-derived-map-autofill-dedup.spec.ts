import { describe, expect, it, vi, afterEach } from 'vitest'
import type { SavedModule, StationSettings, X4Module, X4Ware } from '@/types/x4'

vi.mock('@/store/logic/calculateProductionFlows', async () => {
  const actual = await vi.importActual<typeof import('@/store/logic/calculateProductionFlows')>(
    '@/store/logic/calculateProductionFlows'
  )

  return {
    ...actual,
    calculateProductionFlows: vi.fn(actual.calculateProductionFlows)
  }
})

import { StationDerivedMap } from '@/store/state/StationDerivedMap'
import {
  calculateProductionFlows
} from '@/store/logic/calculateProductionFlows'

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
    id: overrides.id,
    name: overrides.id,
    nameId: '',
    type: 'production',
    method: 'default',
    race: 'argon',
    dlc_tag: 'base',
    tier: 1,
    group: 'energy',
    macroId: '',
    isPlayerBlueprint: true,
    buildTime: 3600,
    buildCost: {},
    inputs: {},
    outputs: {},
    workforce: { capacity: 0, needed: 0, maxBonus: 0 },
    ...overrides
  } as X4Module
}

function makeWare(overrides: Partial<X4Ware> & { id: string }): X4Ware {
  return {
    id: overrides.id,
    name: overrides.id,
    nameId: '',
    dlc_tag: 'base',
    transport: 'container',
    volume: 1,
    price: 100,
    minPrice: 50,
    maxPrice: 200,
    ...overrides
  }
}

const SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: false,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: false,
  internalSupply: true,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1,
  primaryProductBufferHours: 12,
  secondaryProductBufferHours: 2,
  transportMinutes: 30,
  transportShipCapacity: 62000
}

function makeTestDeps() {
  const energyCells = makeWare({ id: 'energycells' })
  const hullParts = makeWare({ id: 'hullparts' })

  const argonSolar = makeModule({
    id: 'sol_argon',
    race: 'argon',
    group: 'energy',
    outputs: { energycells: 1500 }
  })

  const consumer = makeModule({
    id: 'cons_argon',
    race: 'argon',
    group: 'hightech',
    outputs: { hullparts: 100 },
    inputs: { energycells: 500 }
  })

  return {
    modulesMap: {
      sol_argon: argonSolar,
      cons_argon: consumer
    } as Record<string, X4Module>,
    waresMap: {
      energycells: energyCells,
      hullparts: hullParts
    } as Record<string, X4Ware>,
    workforceConsumptionMap: {}
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('StationDerivedMap autoFill dedup', () => {
  it('runs production calculation once for a plan upsert', () => {
    const map = new StationDerivedMap(makeTestDeps())

    map.upsertStation('plan-station', {
      modulesMode: 'plan',
      modules: [{ id: 'cons_argon', count: 3 }],
      settings: SETTINGS,
      lockedWares: [],
      warePriority: {}
    })

    expect(calculateProductionFlows).toHaveBeenCalledTimes(1)
  })

  it('keeps cache outputs and fullModules consistent for plan stations', () => {
    const map = new StationDerivedMap(makeTestDeps())

    map.upsertStation('plan-station', {
      modulesMode: 'plan',
      modules: [{ id: 'cons_argon', count: 3 }],
      settings: SETTINGS,
      lockedWares: [],
      warePriority: {}
    })

    expect(map.getAutoIndustryModules('plan-station')).toEqual([{ id: 'sol_argon', count: 1 }])
    expect(map.getAutoHabitationModules('plan-station')).toEqual([])

    const cache = map.getCache('plan-station')
    expect(cache?.productionFlows.some((flow) => flow.wareId === 'energycells')).toBe(true)
    expect(cache?.productionFlows.some((flow) => flow.wareId === 'hullparts')).toBe(true)
    expect(cache?.actualWorkforce).toBe(0)
    expect(cache?.currentEfficiency).toBe(1)

    const snapshot = map.getSnapshot('plan-station')
    expect(snapshot?.fullModules).toEqual([
      { id: 'cons_argon', count: 3 },
      { id: 'sol_argon', count: 1 }
    ])
  })
})
