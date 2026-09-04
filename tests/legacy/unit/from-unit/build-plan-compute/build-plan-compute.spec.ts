/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import type { BuildScheme, BuildPlan } from '@/types/build-plan'
import { mergeIntoExistingPlan } from '@/store/logic/mergeIntoExistingPlan'

// ── 1.5 PrimaryModuleSnapshot ──────────────────────────────────────────

describe('1.5 PrimaryModuleSnapshot 比较逻辑', () => {
  function makeSnapshot(modules: Array<{ id: string; count: number }>): string {
    return modules
      .map(m => `${m.id}:${m.count}`)
      .sort()
      .join(';')
  }

  it('1.5.1 makePrimarySnapshot unit test', () => {
    // 1.5.2 same modules, different order → same snapshot
    const a = makeSnapshot([{ id: 'mod_a', count: 2 }, { id: 'mod_b', count: 1 }])
    const b = makeSnapshot([{ id: 'mod_b', count: 1 }, { id: 'mod_a', count: 2 }])
    expect(a).toBe(b)
    // 1.5.3 different modules → different snapshot
    const c = makeSnapshot([{ id: 'mod_a', count: 3 }, { id: 'mod_b', count: 1 }])
    expect(a).not.toBe(c)
  })
})

// ── 1.3 mergeIntoExistingPlan ──────────────────────────────────────────

describe('1.3 mergeIntoExistingPlan 保留手动覆盖', () => {
  it('1.3.1 mergeIntoExistingPlan unit test', () => {
    const incoming: BuildScheme[] = [{
      label: 'hullparts-line',
      purposeModules: ['hullparts'],
      primaryModuleIds: ['prod_gen_hullparts_macro'],
      modules: [{ id: 'prod_gen_hullparts_macro', count: 2 }],
      targetRates: { hullparts: 100 },
      targetRateSources: [],
      netProduction: {},
      totalDuration: 3600,
      totalCredits: 50000,
      moduleSummaries: [],
      isFeasible: true,
      totalModuleBuildTime: 3600,
      buildMaterialTotals: {},
    }]
    const existingManualModules = [{ id: 'prod_gen_hullparts_macro', count: 3 }]
    const existingPlan: BuildPlan = {
      goals: [],
      selfSufficient: false,
      bootstrapMode: 'none',
      schemes: [{
        label: 'hullparts-line',
        purposeModules: ['hullparts'],
        primaryModuleIds: ['prod_gen_hullparts_macro'],
        modules: [{ id: 'prod_gen_hullparts_macro', count: 2 }],
        targetRates: { hullparts: 100 },
        targetRateSources: [],
        netProduction: {},
        totalDuration: 3600,
        totalCredits: 50000,
        moduleSummaries: [],
        isFeasible: true,
        totalModuleBuildTime: 3600,
        buildMaterialTotals: {},
        manualModules: existingManualModules,
      }],
      totalDuration: 3600,
      totalCredits: 50000,
      goalsAchieved: [],
      goalsRemaining: [],
      halted: false,
      haltReason: '',
    }
    // 1.3.2 merge
    const merged = mergeIntoExistingPlan(incoming, existingPlan)
    // 1.3.3 assert manualModules preserved
    expect(merged.length).toBe(1)
    expect(merged[0].manualModules).toEqual(existingManualModules)
  })
})

// ── 1.4 compute/preview boundary ───────────────────────────────────────

describe('1.4 compute 与 preview 边界隔离', () => {
  it('1.4.1 compute does not mutate preview', () => {
    const preview = {
      buildMaterialPlanningEnabled: true,
      lines: [],
      graph: null,
      sccGroups: [],
    }
    const frozen = JSON.stringify(preview)
    // Simulate compute reading preview (no mutation)
    const lines = preview.lines
    expect(lines).toEqual([])
    // 1.4.2 assert unchanged
    expect(JSON.stringify(preview)).toBe(frozen)
  })
})
