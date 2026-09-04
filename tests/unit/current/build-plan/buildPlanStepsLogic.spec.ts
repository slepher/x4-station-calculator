import { describe, expect, it } from 'vitest'
import { buildStepsScheme } from '@/components/empire/presenters/buildPlanStepsLogic'
import type { BuildScheme } from '@/types/build-plan'
import type { StationSettings, X4Module, X4Ware } from '@/types/x4'

const settings: StationSettings = {
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
  enforceDlcActivation: false,
}

function makeScheme(overrides: Partial<BuildScheme> = {}): BuildScheme {
  return {
    label: 'Hull Parts Line',
    description: '',
    purposeModules: ['hullparts'],
    primaryModuleIds: ['prod_hullparts'],
    modules: [],
    targetRates: {},
    targetRateSources: [],
    netProduction: {},
    totalDuration: 0,
    totalCredits: 0,
    moduleSummaries: [],
    isFeasible: true,
    totalModuleBuildTime: 0,
    buildMaterialTotals: {},
    ...overrides,
  }
}

describe('buildPlanStepsLogic', () => {
  const modulesMap: Record<string, X4Module> = {
    prod_hullparts: {
      id: 'prod_hullparts',
      name: 'Hull Parts Production',
      type: 'production',
      tier: 2,
      race: 'argon',
      macroclass: '',
      tags: [],
      inputs: { energycells: 200 },
      outputs: { hullparts: 120 },
      workforce: 0,
      buildTime: 600,
      buildCost: { energycells: 20 },
      productionMethod: '',
    },
    solar: {
      id: 'solar',
      name: 'Solar Plant',
      type: 'production',
      tier: 1,
      race: 'argon',
      macroclass: '',
      tags: [],
      inputs: {},
      outputs: { energycells: 300 },
      workforce: 0,
      buildTime: 300,
      buildCost: { energycells: 5 },
      productionMethod: '',
    },
  } as unknown as Record<string, X4Module>

  const waresMap: Record<string, X4Ware> = {
    hullparts: { id: 'hullparts', name: 'Hull Parts', price: 100 } as X4Ware,
    energycells: { id: 'energycells', name: 'Energy Cells', price: 10 } as X4Ware,
  }

  it('returns null for production scheme groups', () => {
    const scheme = makeScheme({
      modules: [{ id: 'prod_hullparts', count: 1 }],
      targetRates: { hullparts: 120 },
    })

    const result = buildStepsScheme(
      scheme,
      'production',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).toBeNull()
  })

  it('replays greedy step with autoFill diff', () => {
    const scheme = makeScheme({
      modules: [
        { id: 'prod_hullparts', count: 1 },
        { id: 'solar', count: 1 },
      ],
      targetRates: { hullparts: 120 },
      totalDuration: 900,
    })

    const result = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(2)
    expect(result!.steps[0]?.moduleId).toBe('solar')
    expect(result!.steps[0]?.reason).toContain('hullparts')
    expect(result!.steps[1]?.moduleId).toBe('prod_hullparts')
    expect(result!.steps[1]?.reason).toContain('hullparts')
    expect(result!.stepsTotalCredits).toBeGreaterThan(0)
  })

  it('tail-fills remaining primary modules with autoFill diff in ordered batches', () => {
    const scheme = makeScheme({
      modules: [
        { id: 'prod_hullparts', count: 2 },
        { id: 'solar', count: 2 },
      ],
      targetRates: { hullparts: 120 },
      totalDuration: 1800,
    })

    const result = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(4)
    expect(result!.steps[0]?.moduleId).toBe('solar')
    expect(result!.steps[1]?.moduleId).toBe('prod_hullparts')
    expect(result!.steps[2]?.moduleId).toBe('solar')
    expect(result!.steps[2]?.reason).toContain('tail-fill')
    expect(result!.steps[3]?.moduleId).toBe('prod_hullparts')
    expect(result!.steps[3]?.reason).toContain('tail-fill')
  })

  it('keeps autoFill from expanding isolated wares during steps replay', () => {
    const scheme = makeScheme({
      modules: [
        { id: 'prod_hullparts', count: 1 },
        { id: 'solar', count: 1 },
      ],
      targetRates: { hullparts: 120 },
      isolatedWareIds: ['energycells'],
      totalDuration: 900,
    })

    const result = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(1)
    expect(result!.steps[0]?.moduleId).toBe('prod_hullparts')
    expect(result!.steps[0]?.reason).toContain('hullparts')
  })

  it('captures greedy exit satisfaction even when no producer can be chosen', () => {
    const scheme = makeScheme({
      modules: [{ id: 'solar', count: 1 }],
      targetRates: { hullparts: 120 },
      totalDuration: 300,
    })

    const result = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(0)
    expect(result!.greedyDebug?.exitSatisfactions).toEqual([
      {
        wareId: 'hullparts',
        targetRate: 120,
        prodRate: 0,
        satisfied: false,
      },
    ])
  })

  it('prefers build-material step target rates over scheme target rates', () => {
    const scheme = makeScheme({
      modules: [{ id: 'prod_hullparts', count: 1 }],
      targetRates: { hullparts: 240 },
      stepTargetRates: { hullparts: 120 },
      totalDuration: 600,
    })

    const result = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      settings,
    )

    expect(result).not.toBeNull()
    expect(result!.greedyDebug?.exitSatisfactions).toEqual([
      {
        wareId: 'hullparts',
        targetRate: 120,
        prodRate: 120,
        satisfied: true,
      },
    ])
  })
})
