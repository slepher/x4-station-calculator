import { describe, it, expect } from 'vitest'
import { calculateBuildPlan } from '@/store/logic/calculateBuildPlan'
import { BootstrapMode } from '@/types/build-plan'
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
  buildCost: { hullparts: 10, advancedcomposites: 5, plasmaconductors: 3 },
  buildTime: 7200
})

const hullpartsModule = makeModule({
  id: 'module_hullparts',
  name: 'Hull Parts Production',
  group: 'refined',
  outputs: { hullparts: 60 },
  inputs: { energycells: 15, ore: 40, claytronics: 10 },
  buildCost: { hullparts: 5, ore: 20, advancedcomposites: 2 },
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

const advancedModule = makeModule({
  id: 'module_advanced',
  name: 'Advanced Composites Production',
  group: 'hightech',
  outputs: { advancedcomposites: 30 },
  inputs: { energycells: 20, silicon: 15 },
  buildCost: { hullparts: 8, claytronics: 3 },
  buildTime: 6000
})

const plasmaModule = makeModule({
  id: 'module_plasma',
  name: 'Plasma Conductors Production',
  group: 'hightech',
  outputs: { plasmaconductors: 25 },
  inputs: { energycells: 15, ore: 20 },
  buildCost: { hullparts: 6, claytronics: 4 },
  buildTime: 5400
})

const modulesMap: Record<string, X4Module> = {
  module_claytronics: claytronicsModule,
  module_hullparts: hullpartsModule,
  module_energy: energyModule,
  module_missile: missileModule,
  module_advanced: advancedModule,
  module_plasma: plasmaModule
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
  missilecomponents: [missileModule],
  advancedcomposites: [advancedModule],
  plasmaconductors: [plasmaModule]
}

function makeInput(overrides: Partial<CalculateBuildPlanInput> = {}): CalculateBuildPlanInput {
  return {
    goals: [],
    selfSufficient: false,
    bootstrapMode: BootstrapMode.None,
    currentModules: [],
    settings: DEFAULT_SETTINGS,
    modulesMap,
    waresMap,
    modulesByOutputMap,
    currentNetProduction: {},
    ...overrides
  }
}

describe('BootstrapMode enum', () => {
  it('has all four values', () => {
    expect(BootstrapMode.None).toBe('none')
    expect(BootstrapMode.Joint).toBe('joint')
    expect(BootstrapMode.CoupledIterative).toBe('coupled')
    expect(BootstrapMode.IsolatedSpecialized).toBe('isolated')
  })

  it('accepts bootstrapMode in CalculateBuildPlanInput', () => {
    const input: CalculateBuildPlanInput = {
      goals: [],
      bootstrapMode: BootstrapMode.Joint,
      currentModules: [],
      settings: DEFAULT_SETTINGS,
      modulesMap: {},
      waresMap: {},
      modulesByOutputMap: {},
      currentNetProduction: {}
    }
    expect(input.bootstrapMode).toBe(BootstrapMode.Joint)
  })
})

describe('BootstrapMode.Joint', () => {
  it('produces 2 schemes (A+B joint + target C) with production-rate goal', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.Joint,
      goals: [goal],
      currentNetProduction: {}
    }))

    expect(result.schemes.length).toBe(2)
    expect(result.schemes[0]!.label).toBe('D 联合自举')
    expect(result.schemes[1]!.label).toBe('目标产线')
  })

  it('produces 1 scheme when no goals (bootstrap only)', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.Joint,
      goals: []
    }))

    expect(result.schemes.length).toBe(1)
    expect(result.schemes[0]!.label).toBe('D 联合自举')
  })

  it('purposeModules contains C buildCost wares that D produces', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.Joint,
      goals: [goal],
      currentNetProduction: {}
    }))

    const dScheme = result.schemes[0]!
    expect(dScheme.purposeModules).toContain('hullparts')
    expect(dScheme.purposeModules).toContain('claytronics')
    expect(dScheme.purposeModules).not.toContain('ore')
    expect(dScheme.purposeModules).not.toContain('energycells')
    expect(dScheme.purposeModules).not.toContain('silicon')
  })

  it('outputs bootstrapMode in BuildPlan result', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.Joint,
      goals: []
    }))

    expect(result.bootstrapMode).toBe(BootstrapMode.Joint)
  })
})

describe('BootstrapMode.IsolatedSpecialized', () => {
  it('produces 3 schemes with production-rate goal', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.IsolatedSpecialized,
      goals: [goal],
      currentNetProduction: {}
    }))

    expect(result.schemes.length).toBe(3)
    expect(result.schemes[0]!.label).toBe('B 特种孤岛')
    expect(result.schemes[1]!.label).toBe('A 建材自举')
    expect(result.schemes[2]!.label).toBe('目标产线')
  })

  it('produces 1 scheme when no goals', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.IsolatedSpecialized,
      goals: []
    }))

    expect(result.schemes.length).toBe(1)
    expect(result.schemes[0]!.label).toBe('B 特种孤岛')
  })
})

describe('BootstrapMode.CoupledIterative', () => {
  it('produces 3 schemes with production-rate goal', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.CoupledIterative,
      goals: [goal],
      currentNetProduction: {}
    }))

    expect(result.schemes.length).toBe(3)
    expect(result.schemes[0]!.label).toBe('A 建材自举')
    expect(result.schemes[1]!.label).toBe('B 特种产线')
    expect(result.schemes[2]!.label).toBe('目标产线')
  })

  it('produces 1 scheme when no goals', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.CoupledIterative,
      goals: []
    }))

    expect(result.schemes.length).toBe(1)
    expect(result.schemes[0]!.label).toBe('A 建材自举')
  })
})

describe('BootstrapMode store integration', () => {
  it('bootstrapMode is passed through calculateBuildPlan input', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.Joint,
      goals: [{
        type: 'production-rate',
        wareId: 'missilecomponents',
        ratePerHour: 1337.6
      }],
      currentNetProduction: {}
    }))

    expect(result.bootstrapMode).toBe(BootstrapMode.Joint)
  })

  it('BuildPlan output contains bootstrapMode field', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.None,
      goals: []
    }))

    expect(result).toHaveProperty('bootstrapMode')
    expect(result.bootstrapMode).toBe(BootstrapMode.None)
  })
})

describe('BootstrapMode.None', () => {
  it('with no goals generates no schemes', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.None,
      goals: []
    }))

    expect(result.schemes).toHaveLength(0)
  })

  it('with production-rate goal generates 1 scheme (target line)', () => {
    const goal: BuildGoal = {
      type: 'production-rate',
      wareId: 'missilecomponents',
      ratePerHour: 1337.6
    }

    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.None,
      goals: [goal]
    }))

    expect(result.schemes.length).toBe(1)
    expect(result.schemes[0]!.label).toBe('目标产线')
  })

  it('outputs bootstrapMode in BuildPlan result', () => {
    const result = calculateBuildPlan(makeInput({
      bootstrapMode: BootstrapMode.None,
      goals: []
    }))

    expect(result.bootstrapMode).toBe(BootstrapMode.None)
  })
})
