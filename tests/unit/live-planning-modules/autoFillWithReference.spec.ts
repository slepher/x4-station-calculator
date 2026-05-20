import { describe, it, expect } from 'vitest'
import { findBestProducerWithRef } from '@/store/logic/bestModuleSelector'
import { calculateAutoFillModules } from '@/store/logic/calculateProductionFlows'
import { calculateInfrastructureModules } from '@/store/logic/calculateInfrastructureModules'
import type { WareProductionFlow } from '@/types/production-flow'
import type { X4Module, X4Ware, SavedModule, StationSettings } from '@/types/x4'

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
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

describe('findBestProducerWithRef P1-P8 priority', () => {
  const ecWares = makeWare({ id: 'energycells' })
  const waresMap = { energycells: ecWares } as Record<string, X4Ware>

  const argonSolar = makeModule({ id: 'sol_argon', race: 'argon', group: 'energy', outputs: { energycells: 1000 } })
  const terranSolar = makeModule({ id: 'sol_terran', race: 'terran', group: 'energy', outputs: { energycells: 1200 } })

  const modulesMap = {
    sol_argon: argonSolar,
    sol_terran: terranSolar
  } as Record<string, X4Module>

  it('P1 selects race-matching ref module with quota', () => {
    const result = findBestProducerWithRef(
      'energycells', 'argon',
      [], modulesMap, waresMap,
      [{ id: 'sol_argon', count: 2 }],
      { sol_argon: 2000 }
    )
    expect(result).toBeDefined()
    expect(result!.module.id).toBe('sol_argon')
    expect(result!.exhaustedQuota).toBe(false)
  })

  it('P2 selects non-race ref module when P1 has no race match', () => {
    const result = findBestProducerWithRef(
      'energycells', 'argon',
      [], modulesMap, waresMap,
      [{ id: 'sol_terran', count: 1 }],
      { sol_terran: 1200 }
    )
    expect(result).toBeDefined()
    expect(result!.module.id).toBe('sol_terran')
    expect(result!.exhaustedQuota).toBe(false)
  })

  it('P5 selects race-matching ref when quota=0', () => {
    const result = findBestProducerWithRef(
      'energycells', 'argon',
      [], modulesMap, waresMap,
      [{ id: 'sol_argon', count: 2 }],
      { sol_argon: 0 }
    )
    expect(result).toBeDefined()
    expect(result!.module.id).toBe('sol_argon')
    expect(result!.exhaustedQuota).toBe(true)
  })

  it('P6 non-race ref selected when quota=0', () => {
    const result = findBestProducerWithRef(
      'energycells', 'argon',
      [], modulesMap, waresMap,
      [{ id: 'sol_terran', count: 1 }],
      { sol_terran: 0 }
    )
    expect(result).toBeDefined()
    expect(result!.module.id).toBe('sol_terran')
    expect(result!.exhaustedQuota).toBe(true)
  })

  it('falls to P7 (race+db) when no ref', () => {
    const result = findBestProducerWithRef(
      'energycells', 'argon',
      [], modulesMap, waresMap,
      [], {}
    )
    expect(result).toBeDefined()
    expect(result!.module.race).toBe('argon')
    expect(result!.exhaustedQuota).toBe(true)
  })

  it('P8 (any db) when no race match in db', () => {
    const result = findBestProducerWithRef(
      'energycells', 'split',
      [], modulesMap, waresMap,
      [], {}
    )
    expect(result).toBeDefined()
    expect(result!.exhaustedQuota).toBe(true)
  })
})

describe('calculateAutoFillModules with reference modules', () => {
  const ecWares = makeWare({ id: 'energycells' })
  const waresMap = { energycells: ecWares } as Record<string, X4Ware>

  const argonSolar = makeModule({ id: 'sol_argon', race: 'argon', group: 'energy', outputs: { energycells: 1500 } })
  const terranSolar = makeModule({ id: 'sol_terran', race: 'terran', group: 'energy', outputs: { energycells: 1500 } })

  const consumer = makeModule({ id: 'cons_argon', race: 'argon', group: 'hightech', outputs: { hullparts: 100 }, inputs: { energycells: 500 } })

  const modulesMap = {
    sol_argon: argonSolar,
    sol_terran: terranSolar,
    cons_argon: consumer
  } as Record<string, X4Module>

  it('generates auto modules to fill deficit (no reference)', () => {
    const result = calculateAutoFillModules({
      plannedModules: [{ id: 'cons_argon', count: 3 }],
      settings: { ...SETTINGS, racePreference: 'argon' },
      modulesMap,
      waresMap,
      lockedWares: [],
      referenceModules: []
    })
    // 3 consumers each need 500 = 1500 EC deficit. 1 argon solar produces 1500. Expect 1 solar.
    const solar = result.autoIndustryModules.find(m => m.id === 'sol_argon')
    expect(solar).toBeDefined()
    expect(solar!.count).toBeGreaterThanOrEqual(1)
  })

  it('with reference: race-matching ref gets priority', () => {
    const result = calculateAutoFillModules({
      plannedModules: [{ id: 'cons_argon', count: 3 }],
      settings: { ...SETTINGS, racePreference: 'argon' },
      modulesMap,
      waresMap,
      lockedWares: [],
      referenceModules: [
        { id: 'sol_argon', count: 1 },
        { id: 'sol_terran', count: 10 }
      ]
    })

    const argon = result.autoIndustryModules.find(m => m.id === 'sol_argon')
    const terran = result.autoIndustryModules.find(m => m.id === 'sol_terran')
    // P1 argon(ref,race) gets first pick from quota. Deficit is 1500, 1 module needed.
    // argon ref has 1*1500 = 1500 quota, covers entire deficit.
    expect(argon?.count ?? 0).toBe(1)
    expect(terran?.count ?? 0).toBe(0)
  })

  it('with reference: non-race ref used after race ref exhausted', () => {
    const result = calculateAutoFillModules({
      plannedModules: [{ id: 'cons_argon', count: 3 }],
      settings: { ...SETTINGS, racePreference: 'terran' },
      modulesMap,
      waresMap,
      lockedWares: [],
      referenceModules: [
        { id: 'sol_terran', count: 1 },
        { id: 'sol_argon', count: 3 }
      ]
    })

    const terran = result.autoIndustryModules.find(m => m.id === 'sol_terran')
    const argon = result.autoIndustryModules.find(m => m.id === 'sol_argon')
    // race=terran, deficit 1500. P1 terran(ref) quota=1500, covers all. Just 1 terran solar.
    expect(terran?.count ?? 0).toBe(1)
    expect(argon?.count ?? 0).toBe(0)
  })

  it('no reference -> same as original behavior', () => {
    const withRef = calculateAutoFillModules({
      plannedModules: [{ id: 'cons_argon', count: 3 }],
      settings: { ...SETTINGS, racePreference: 'argon' },
      modulesMap,
      waresMap,
      lockedWares: [],
      referenceModules: []
    })

    const withoutRef = calculateAutoFillModules({
      plannedModules: [{ id: 'cons_argon', count: 3 }],
      settings: { ...SETTINGS, racePreference: 'argon' },
      modulesMap,
      waresMap,
      lockedWares: []
    })

    expect(withRef.autoIndustryModules).toEqual(withoutRef.autoIndustryModules)
  })
})

describe('auxiliary module reference priority', () => {
  it('habitation allocation consumes reference quota before collapsing to one type', () => {
    const argonHabitat = makeModule({
      id: 'hab_argon',
      type: 'habitation',
      race: 'argon',
      workforce: { capacity: 1000, needed: 0, maxBonus: 0 }
    })
    const terranHabitat = makeModule({
      id: 'hab_terran',
      type: 'habitation',
      race: 'terran',
      workforce: { capacity: 500, needed: 0, maxBonus: 0 }
    })
    const workerConsumer = makeModule({
      id: 'worker_consumer',
      type: 'production',
      race: 'argon',
      outputs: { hullparts: 10 },
      workforce: { capacity: 0, needed: 3000, maxBonus: 0 }
    })

    const modulesMap = {
      hab_argon: argonHabitat,
      hab_terran: terranHabitat,
      worker_consumer: workerConsumer
    } as Record<string, X4Module>

    const result = calculateAutoFillModules({
      plannedModules: [{ id: 'worker_consumer', count: 1 }],
      settings: { ...SETTINGS, considerWorkforceForAutoFill: true, racePreference: 'argon' },
      modulesMap,
      waresMap: {} as Record<string, X4Ware>,
      lockedWares: [],
      referenceModules: [
        { id: 'hab_argon', count: 2 },
        { id: 'hab_terran', count: 2 }
      ]
    })

    expect(result.autoHabitationModules).toContainEqual({ id: 'hab_argon', count: 2 })
    expect(result.autoHabitationModules).toContainEqual({ id: 'hab_terran', count: 2 })
  })

  it('infrastructure storage allocation consumes reference quota before collapsing to one type', () => {
    const argonStorage = makeModule({
      id: 'storage_argon',
      type: 'storage',
      race: 'argon',
      cargo: { type: 'container', capacity: 600000 }
    } as Partial<X4Module> & { id: string })
    const terranStorage = makeModule({
      id: 'storage_terran',
      type: 'storage',
      race: 'terran',
      cargo: { type: 'container', capacity: 600000 }
    } as Partial<X4Module> & { id: string })
    const dbStorage = makeModule({
      id: 'storage_db',
      type: 'storage',
      race: 'argon',
      cargo: { type: 'container', capacity: 1000000 }
    } as Partial<X4Module> & { id: string })

    const modulesMap = {
      storage_argon: argonStorage,
      storage_terran: terranStorage,
      storage_db: dbStorage
    } as Record<string, X4Module>

    const flows: WareProductionFlow[] = [{
      wareId: 'container_ware',
      orderIndex: 0,
      tier: 1,
      transportType: 'container',
      unitVolume: 1,
      production: 4200000,
      consumption: 0,
      netRate: 4200000,
      contributions: []
    }]

    const result = calculateInfrastructureModules({
      productionFlows: flows,
      plannedModules: [],
      autoIndustryModules: [],
      modulesMap,
      settings: {
        racePreference: 'argon',
        resourceBufferHours: 0,
        primaryProductBufferHours: 1,
        secondaryProductBufferHours: 0,
        transportShipCapacity: 100000000
      },
      warePriorityLevels: { container_ware: 2 },
      referenceModules: [
        { id: 'storage_argon', count: 3 },
        { id: 'storage_terran', count: 3 }
      ]
    })

    expect(result).toContainEqual({ id: 'storage_argon', count: 4 })
    expect(result).toContainEqual({ id: 'storage_terran', count: 3 })
    expect(result.find(m => m.id === 'storage_db')).toBeUndefined()
  })

  it('infrastructure pier allocation consumes reference quota before collapsing to one type', () => {
    const argonPier = makeModule({
      id: 'pier_argon',
      type: 'pier',
      race: 'argon',
      macroId: 'pier_argon',
      dockingCount: 3
    })
    const terranPier = makeModule({
      id: 'pier_terran',
      type: 'pier',
      race: 'terran',
      macroId: 'pier_terran',
      dockingCount: 3
    })
    const dbPier = makeModule({
      id: 'pier_db',
      type: 'pier',
      race: 'argon',
      macroId: 'module_argon_harbor_03_macro',
      dockingCount: 8
    })

    const modulesMap = {
      pier_argon: argonPier,
      pier_terran: terranPier,
      pier_db: dbPier
    } as Record<string, X4Module>

    const flows: WareProductionFlow[] = [{
      wareId: 'transport_ware',
      orderIndex: 0,
      tier: 1,
      transportType: 'container',
      unitVolume: 1,
      production: 0,
      consumption: 0,
      netRate: -13000,
      contributions: []
    }]

    const result = calculateInfrastructureModules({
      productionFlows: flows,
      plannedModules: [],
      autoIndustryModules: [],
      modulesMap,
      settings: {
        racePreference: 'argon',
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        transportShipCapacity: 100,
      },
      warePriorityLevels: {},
      referenceModules: [
        { id: 'pier_argon', count: 1 },
        { id: 'pier_terran', count: 1 }
      ]
    })

    expect(result).toContainEqual({ id: 'pier_argon', count: 2 })
    expect(result).toContainEqual({ id: 'pier_terran', count: 1 })
    expect(result.find(m => m.id === 'pier_db')).toBeUndefined()
  })
})
