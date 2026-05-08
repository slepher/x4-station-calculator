import { describe, it, expect } from 'vitest'
import type { BuildScheme, BuildPlan, BuildSchemeGroup } from '@/types/build-plan'

function makeScheme(overrides: Partial<BuildScheme> & { label: string }): BuildScheme {
  return {
    description: '',
    purposeModules: [],
    primaryModuleIds: [],
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
    manualWares: [],
    manualModules: [],
    derivedWareIds: [],
    ...overrides,
  }
}

function makePlan(schemes: BuildScheme[]): BuildPlan {
  return {
    goals: [],
    selfSufficient: false,
    bootstrapMode: 'none',
    schemes,
    totalDuration: 0,
    totalCredits: 0,
    goalsAchieved: [],
    goalsRemaining: [],
    halted: false,
    haltReason: '',
  }
}

describe('mergeIntoExistingPlan', () => {
  it('preserves manual modules when merging with new computed scheme', async () => {
    const existing = makePlan([makeScheme({
      label: '产线 L',
      modules: [{ id: 'mod_hull_parts_fab', count: 2 }],
      manualModules: [{ id: 'mod_hull_parts_fab', count: 2 }],
    })])

    const incomingSchemes: BuildScheme[] = [makeScheme({
      label: '产线 L',
      modules: [{ id: 'mod_hull_parts_fab', count: 1 }],
    })]

    const { mergeIntoExistingPlan } = await import('@/store/logic/mergeIntoExistingPlan')
    const merged = mergeIntoExistingPlan(incomingSchemes, existing)

    expect(merged).toHaveLength(1)
    expect(merged[0].manualModules).toEqual([{ id: 'mod_hull_parts_fab', count: 2 }])
    const hullMod = merged[0].modules.find(m => m.id === 'mod_hull_parts_fab')
    expect(hullMod?.count).toBe(3)
  })

  it('preserves manual wares and replaces derivedWareIds on recalc', async () => {
    const existing = makePlan([makeScheme({
      label: '产线 L',
      targetRates: { hullparts: 30 },
      manualWares: [{ type: 'production-rate', wareId: 'hullparts', ratePerHour: 30 }],
      derivedWareIds: ['hullparts'],
    })])

    const incomingSchemes: BuildScheme[] = [makeScheme({
      label: '产线 L',
      targetRates: { hullparts: 15 },
      derivedWareIds: ['hullparts', 'energycells'],
    })]

    const { mergeIntoExistingPlan } = await import('@/store/logic/mergeIntoExistingPlan')
    const merged = mergeIntoExistingPlan(incomingSchemes, existing)

    // manualWares preserved unchanged
    expect(merged[0].manualWares).toEqual([
      { type: 'production-rate', wareId: 'hullparts', ratePerHour: 30 },
    ])
    // derivedWareIds replaced with incoming's
    expect(merged[0].derivedWareIds).toEqual(['hullparts', 'energycells'])
    // targetRates = existing.manualWares rates + incoming targetRates
    expect(merged[0].targetRates.hullparts).toBe(45)
  })

  it('does not stack plans: same line label produces one merged scheme', async () => {
    const existing = makePlan([makeScheme({
      label: '产线 L',
      modules: [{ id: 'mod_hull_parts_fab', count: 1 }],
      manualModules: [{ id: 'mod_hull_parts_fab', count: 1 }],
    })])

    const incomingSchemes: BuildScheme[] = [
      makeScheme({ label: '产线 L', modules: [{ id: 'mod_hull_parts_fab', count: 1 }] }),
      makeScheme({ label: '产线 M', modules: [{ id: 'mod_shield_fab', count: 1 }] }),
    ]

    const { mergeIntoExistingPlan } = await import('@/store/logic/mergeIntoExistingPlan')
    const merged = mergeIntoExistingPlan(incomingSchemes, existing)

    // 产线 L only appears once
    const lineL = merged.filter(s => s.label === '产线 L')
    expect(lineL).toHaveLength(1)
    // Manual modules from existing preserved
    expect(lineL[0].manualModules).toEqual([{ id: 'mod_hull_parts_fab', count: 1 }])
    // Total = incoming(1) + manual(1) = 2
    const hullMod = lineL[0].modules.find(m => m.id === 'mod_hull_parts_fab')
    expect(hullMod?.count).toBe(2)
  })

  it('rebuildSchemeGroups maps merged schemes back into group structure preserving order', async () => {
    const { rebuildSchemeGroups } = await import('@/store/logic/mergeIntoExistingPlan')
    const groups: BuildSchemeGroup[] = [
      {
        groupType: 'build-material',
        groupLabel: '建材产线',
        schemes: [makeScheme({ label: '产线 A' }), makeScheme({ label: '产线 B' })],
      },
      {
        groupType: 'production',
        groupLabel: '生产产线',
        schemes: [makeScheme({ label: '产线 C' })],
      },
    ]
    const mergedSchemes: BuildScheme[] = [
      makeScheme({ label: '产线 A', modules: [{ id: 'mod_a', count: 3 }] }),
      makeScheme({ label: '产线 B', modules: [{ id: 'mod_b', count: 5 }] }),
      makeScheme({ label: '产线 C', modules: [{ id: 'mod_c', count: 7 }] }),
    ]

    const result = rebuildSchemeGroups(groups, mergedSchemes)

    expect(result).toHaveLength(2)
    expect(result[0].groupType).toBe('build-material')
    expect(result[0].schemes).toHaveLength(2)
    expect(result[0].schemes[0].modules[0].count).toBe(3)
    expect(result[0].schemes[1].modules[0].count).toBe(5)
    expect(result[1].groupType).toBe('production')
    expect(result[1].schemes).toHaveLength(1)
    expect(result[1].schemes[0].modules[0].count).toBe(7)
  })

  it('returns incoming schemes as-is when existingPlan is null', async () => {
    const incomingSchemes: BuildScheme[] = [makeScheme({
      label: '产线 L',
      modules: [{ id: 'mod_hull_parts_fab', count: 1 }],
    })]

    const { mergeIntoExistingPlan } = await import('@/store/logic/mergeIntoExistingPlan')
    const merged = mergeIntoExistingPlan(incomingSchemes, null)

    expect(merged).toEqual(incomingSchemes)
  })
})
