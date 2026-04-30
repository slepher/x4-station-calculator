import { describe, it, expect } from 'vitest'
import { calculateBuildPlan } from '@/store/logic/calculateBuildPlan'
import type { X4Module, X4Ware, SavedModule, StationSettings } from '@/types/x4'
import type { BuildGoal, CalculateBuildPlanInput } from '@/types/build-plan'

const DEFAULT_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: true,
  internalSupply: true,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1,
  primaryProductBufferHours: 12,
  secondaryProductBufferHours: 2,
  transportMinutes: 30,
  transportShipCapacity: 62000,
  enforceDlcActivation: false
}

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
    name: overrides.id,
    nameId: '',
    type: 'production',
    method: 'default',
    race: 'argon',
    dlc_tag: 'base',
    tier: 1,
    group: 'hightech',
    macroId: '',
    isPlayerBlueprint: true,
    buildTime: 3600,
    buildCost: {},
    inputs: {},
    outputs: {},
    workforceCapacity: 0,
    workforceNeeded: 0,
    ...overrides
  }
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
    tier: 1,
    group: 'hightech',
    ...overrides
  }
}

describe('calculateBuildPlan selfSufficient parameter', () => {
  const claytronicsWare = makeWare({ id: 'claytronics', name: 'Claytronics' })
  const hullpartsWare = makeWare({ id: 'hullparts', name: 'Hull Parts' })
  const plasmaWare = makeWare({ id: 'plasmaconductors', name: 'Plasma Conductors' })
  const advancedWare = makeWare({ id: 'advancedcomposites', name: 'Advanced Composites' })
  const oreWare = makeWare({ id: 'ore', name: 'Ore', transport: 'solid', group: 'minerals' })
  const siliconWare = makeWare({ id: 'silicon', name: 'Silicon', transport: 'solid', group: 'minerals' })
  const energyWare = makeWare({ id: 'energycells', name: 'Energy Cells', group: 'energy' })
  const missileWare = makeWare({ id: 'missilecomponents', name: 'Missile Components', group: 'shiptech' })

  const claytronicsModule = makeModule({
    id: 'module_claytronics',
    name: 'Claytronics Production',
    group: 'hightech',
    outputs: { claytronics: 40 },
    inputs: { energycells: 20, silicon: 30 },
    buildCost: { hullparts: 10, claytronics: 5 },
    buildTime: 7200
  })

  const hullpartsModule = makeModule({
    id: 'module_hullparts',
    name: 'Hull Parts Production',
    group: 'refined',
    outputs: { hullparts: 60 },
    inputs: { energycells: 15, ore: 40, claytronics: 10 },
    buildCost: { hullparts: 5, ore: 20 },
    buildTime: 5400
  })

  const energyModule = makeModule({
    id: 'module_energy',
    name: 'Energy Cell Production',
    group: 'energy',
    outputs: { energycells: 200 },
    inputs: {},
    buildCost: { hullparts: 3 },
    buildTime: 3600
  })

  const missileModule = makeModule({
    id: 'module_missile',
    name: 'Missile Component Production',
    group: 'shiptech',
    outputs: { missilecomponents: 1337.6 },
    inputs: { energycells: 30, hullparts: 20, claytronics: 15 },
    buildCost: { hullparts: 20, claytronics: 10 },
    buildTime: 10800
  })

  const modulesMap: Record<string, X4Module> = {
    module_claytronics: claytronicsModule,
    module_hullparts: hullpartsModule,
    module_energy: energyModule,
    module_missile: missileModule
  }

  const waresMap: Record<string, X4Ware> = {
    claytronics: claytronicsWare,
    hullparts: hullpartsWare,
    plasmaconductors: plasmaWare,
    advancedcomposites: advancedWare,
    ore: oreWare,
    silicon: siliconWare,
    energycells: energyWare,
    missilecomponents: missileWare
  }

  const modulesByOutputMap: Record<string, X4Module[]> = {
    claytronics: [claytronicsModule],
    hullparts: [hullpartsModule],
    energycells: [energyModule],
    missilecomponents: [missileModule]
  }

  function makeInput(overrides: Partial<CalculateBuildPlanInput> = {}): CalculateBuildPlanInput {
    return {
      goals: [],
      selfSufficient: false,
      currentModules: [],
      settings: DEFAULT_SETTINGS,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      currentNetProduction: {},
      ...overrides
    }
  }

  it('selfSufficient=true with no other goals generates only scheme 1', () => {
    const result = calculateBuildPlan(makeInput({
      selfSufficient: true,
      goals: []
    }))

    expect(result.schemes.length).toBeGreaterThanOrEqual(1)
    expect(result.schemes[0]!.label).toBe('自给自足')
  })

  it('selfSufficient=false with no goals generates no schemes', () => {
    const result = calculateBuildPlan(makeInput({
      selfSufficient: false,
      goals: []
    }))

    expect(result.schemes).toHaveLength(0)
  })

  it('selfSufficient=true with production-rate goal generates all 3 schemes', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      selfSufficient: true,
      goals: [goal]
    }))

    expect(result.schemes.length).toBe(3)
    expect(result.schemes[0]!.label).toBe('自给自足')
    expect(result.schemes[1]!.label).toBe('目标建材')
    expect(result.schemes[2]!.label).toBe('目标产线')
  })

  it('selfSufficient is returned in BuildPlan output', () => {
    const result = calculateBuildPlan(makeInput({
      selfSufficient: true,
      goals: []
    }))

    expect(result.selfSufficient).toBe(true)
  })

  it('selfSufficient=false with production-rate goal and insufficient capacity generates 3 schemes', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      selfSufficient: false,
      goals: [goal],
      currentNetProduction: {}
    }))

    expect(result.schemes.length).toBe(3)
  })

  it('selfSufficient=false with production-rate goal and sufficient capacity generates only scheme 3', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      selfSufficient: false,
      goals: [goal],
      currentModules: [{ id: 'module_missile', count: 1 }],
      currentNetProduction: {
        missilecomponents: 2000,
        hullparts: 10000,
        claytronics: 10000,
        energycells: 10000
      }
    }))

    expect(result.schemes.length).toBe(1)
    expect(result.schemes[0]!.label).toBe('目标产线')
  })
})
