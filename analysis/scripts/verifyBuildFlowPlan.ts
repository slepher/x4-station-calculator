/**
 * verifyBuildFlowPlan.ts
 *
 * Compare old bootstrapMode algorithm output with new build-flow-plan algorithm output.
 *
 * Usage:
 *   npx tsx analysis/scripts/verifyBuildFlowPlan.ts [--classical <mode>] [--json]
 *
 * Modes: joint, coupled, nested, isolated
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

import type { X4Module, X4Ware, StationSettings, BuildFlowGroup, BuildFlowLineCard, BuildFlowTag, BuildFlowAssignment } from '@/types/x4'
import type { BuildGoal, BuildFlowPlanView } from '@/types/build-plan'
import { BootstrapMode } from '@/types/build-plan'
import { calculateBuildPlan } from '@/store/logic/calculateBuildPlan'
import { buildFlowPlanGraph } from '@/store/logic/buildFlowPlanGraph'
import { computeFlowPlanLines, makeSchemes } from '@/store/logic/calculateBuildFlowPlan'

// Load real game data
const WARE_DATA = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD_DATA = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, X4Ware> = {}
for (const w of WARE_DATA) waresMap[w.id] = w

const modulesMap: Record<string, X4Module> = {}
for (const m of MOD_DATA) modulesMap[m.id] = m

const modulesByOutputMap: Record<string, X4Module[]> = {}
for (const mod of MOD_DATA) {
  if (!mod.outputs) continue
  for (const w of Object.keys(mod.outputs)) {
    if (!modulesByOutputMap[w]) modulesByOutputMap[w] = []
    modulesByOutputMap[w]!.push(mod)
  }
}

function findModuleIdByName(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const m of MOD_DATA) {
    if (m.name.toLowerCase().replace(/\s+/g, '') === key) return m.id
  }
  const partial = MOD_DATA.find((m: any) => m.name.toLowerCase().includes(name.toLowerCase()))
  return partial?.id || null
}

const MISSILE_MODULE_ID = findModuleIdByName('MissileComponentProduction')!

const DEFAULT_SETTINGS: StationSettings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false,
}

// ---------------------------------------------------------------------------
// C goal: Missile Component Production x5
// ---------------------------------------------------------------------------
const C_GOAL: BuildGoal = { type: 'build-module', moduleId: MISSILE_MODULE_ID, count: 5 }

// ---------------------------------------------------------------------------
// Build Flow View builders for each bootstrap mode topology
// ---------------------------------------------------------------------------

function tag(wareId: string, suffix: string): BuildFlowTag {
  return { tagId: `tag-${wareId}-${suffix}`, wareId, label: wareId }
}

function card(groupId: string, name: string, sourceWares: string[], buildWares: string[]): BuildFlowLineCard {
  return { groupId, title: name, sourceTags: sourceWares.map(w => tag(w, 'src')), buildMaterialTags: buildWares.map(w => tag(w, 'bld')) }
}

function group(lineCards: BuildFlowLineCard[]): BuildFlowGroup {
  const allSourceWares = new Set(lineCards.flatMap(c => c.sourceTags.map(t => t.wareId)))
  return { groupKey: lineCards.map(c => c.groupId).join(':'), lineCards, outputBuildTags: [...allSourceWares].map(w => tag(w, 'outbuild')), outputMaterialTags: [...allSourceWares].map(w => tag(w, 'outmat')) }
}

/**
 * Joint Mode: D(A+B) produces hullparts, claytronics, advancedcomposites, plasmaconductors
 * D's buildCost includes all 4 → self-bootstrap via greedyFill
 */
function makeJointFlowView(): BuildFlowPlanView {
  const dCard = card('D', 'D 联合产线',
    ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'],
    ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const grp = group([dCard])
  return {
    buildFlowGroups: [grp],
    assignments: [
      { wareId: 'hullparts', sourceGroupId: 'D', targetType: 'output-build-material' },
      { wareId: 'claytronics', sourceGroupId: 'D', targetType: 'output-build-material' },
      { wareId: 'advancedcomposites', sourceGroupId: 'D', targetType: 'output-build-material' },
      { wareId: 'plasmaconductors', sourceGroupId: 'D', targetType: 'output-build-material' },
    ],
    virtualEdges: [],
  }
}

/**
 * CoupledIterative Mode: A produces hullparts+claytronics, B produces advancedcomposites+plasmaconductors
 * A↔B outer loop: A needs to satisfy C+B buildCost, B needs A's buildCost
 */
function makeCoupledFlowView(): BuildFlowPlanView {
  const aCard = card('A', 'A 建材产线',
    ['hullparts', 'claytronics'],
    ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const bCard = card('B', 'B 特种产线',
    ['advancedcomposites', 'plasmaconductors'],
    ['hullparts', 'claytronics'])
  const grp = group([aCard, bCard])
  return {
    buildFlowGroups: [grp],
    assignments: [
      { wareId: 'hullparts', sourceGroupId: 'A', targetType: 'output-build-material' },
      { wareId: 'claytronics', sourceGroupId: 'A', targetType: 'output-build-material' },
      { wareId: 'advancedcomposites', sourceGroupId: 'B', targetType: 'output-build-material' },
      { wareId: 'plasmaconductors', sourceGroupId: 'B', targetType: 'output-build-material' },
    ],
    virtualEdges: [],
  }
}

/**
 * NestedJoint Mode: A produces hullparts+claytronics, D produces A+B
 */
function makeNestedFlowView(): BuildFlowPlanView {
  const aCard = card('A_N', 'A 基础建材',
    ['hullparts', 'claytronics'],
    ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const dCard = card('D_N', 'D 联合自举',
    ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'],
    ['advancedcomposites', 'plasmaconductors'])
  const grp = group([aCard, dCard])
  return {
    buildFlowGroups: [grp],
    assignments: [
      { wareId: 'hullparts', sourceGroupId: 'A_N', targetType: 'output-build-material' },
      { wareId: 'claytronics', sourceGroupId: 'A_N', targetType: 'output-build-material' },
      { wareId: 'advancedcomposites', sourceGroupId: 'D_N', targetType: 'output-build-material' },
      { wareId: 'plasmaconductors', sourceGroupId: 'D_N', targetType: 'output-build-material' },
    ],
    virtualEdges: [],
  }
}

/**
 * IsolatedSpecialized Mode: B produces advancedcomposites+plasmaconductors (isolated), A produces hullparts+claytronics (self-bootstrap)
 */
function makeIsolatedFlowView(): BuildFlowPlanView {
  const aCard = card('A_I', 'A 建材产线', ['hullparts', 'claytronics'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const bCard = card('B_I', 'B 特种孤岛', ['advancedcomposites', 'plasmaconductors'], [])
  return { buildFlowGroups: [group([aCard, bCard])], assignments: [
    { wareId: 'hullparts', sourceGroupId: 'A_I', targetType: 'output-build-material' },
    { wareId: 'claytronics', sourceGroupId: 'A_I', targetType: 'output-build-material' },
    { wareId: 'advancedcomposites', sourceGroupId: 'B_I', targetType: 'output-build-material' },
    { wareId: 'plasmaconductors', sourceGroupId: 'B_I', targetType: 'output-build-material' },
  ], virtualEdges: [] }
}

// ---------------------------------------------------------------------------
// Algorithm runners
// ---------------------------------------------------------------------------

function runClassical(modeName: string) {
  const modeMap: Record<string, string> = {
    joint: BootstrapMode.Joint,
    coupled: BootstrapMode.CoupledIterative,
    nested: BootstrapMode.NestedJoint,
    isolated: BootstrapMode.IsolatedSpecialized,
  }
  const mode = modeMap[modeName]
  if (!mode) throw new Error(`Unknown mode: ${modeName}`)

  return calculateBuildPlan({
    goals: [C_GOAL],
    selfSufficient: false,
    bootstrapMode: mode,
    currentModules: [],
    currentNetProduction: {},
    settings: DEFAULT_SETTINGS,
    modulesMap,
    waresMap,
    modulesByOutputMap,
  })
}

function runNew(buildFlowView: BuildFlowPlanView) {
  // Get C modules from classical None mode
  const cResult = calculateBuildPlan({
    goals: [C_GOAL],
    selfSufficient: false,
    bootstrapMode: BootstrapMode.None,
    currentModules: [],
    currentNetProduction: {},
    settings: DEFAULT_SETTINGS,
    modulesMap,
    waresMap,
    modulesByOutputMap,
  })
  const cModules = cResult.schemes.length > 0 ? cResult.schemes[cResult.schemes.length - 1]!.modules : []

  const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)
  computeFlowPlanLines(graph, modulesMap, waresMap, DEFAULT_SETTINGS, [])
  return {
    goals: [C_GOAL],
    selfSufficient: false,
    bootstrapMode: BootstrapMode.None,
    schemes: makeSchemes(graph, modulesMap, waresMap, DEFAULT_SETTINGS),
    totalDuration: 0, totalCredits: 0,
    goalsAchieved: [C_GOAL], goalsRemaining: [], halted: false, haltReason: '',
  }
}

function extractSummary(plan: ReturnType<typeof calculateBuildPlan>) {
  return plan.schemes.map(s => ({
    label: s.label,
    primaryModuleIds: s.primaryModuleIds,
    allModules: s.modules.map(m => `${m.id}:${m.count}`),
    moduleSummaries: s.moduleSummaries.map(ms => ({
      moduleId: ms.moduleId,
      moduleCount: ms.moduleCount,
      materials: ms.materials.length,
    })),
    netProduction: Object.fromEntries(
      Object.entries(s.netProduction)
        .filter(([, v]) => Math.abs(v) > 0.01)
        .map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    targetRateSources: s.targetRateSources.map(src => ({
      label: src.label,
      rates: Object.fromEntries(
        Object.entries(src.rates).filter(([, v]) => v > 0)
      ),
      materials: src.materials || {},
    })),
    buildMaterialTotals: s.buildMaterialTotals,
  }))
}

type SchemeSummary = ReturnType<typeof extractSummary>[number]

function printSources(s: SchemeSummary) {
  if (s.targetRateSources.length > 0) {
    s.targetRateSources.forEach(src => {
      console.log(`    ── ${src.label} ──`)
      for (const [w, r] of Object.entries(src.rates)) {
        const prod = s.netProduction[w] || 0
        const pct = r > 0 ? Math.round(prod / r * 100) : 0
        console.log(`      ${w}: 需要: ${r.toFixed(1)}/h  产能: ${prod.toFixed(1)}/h  满足: ${pct}%`)
      }
    })
  }
}

function printModuleSummaries(s: SchemeSummary) {
  if (s.moduleSummaries.length > 0) {
    console.log(`    Module Summaries: ${s.moduleSummaries.length}`)
    s.moduleSummaries.slice(0, 8).forEach(ms => {
      console.log(`      ${ms.moduleId} ×${ms.moduleCount} (${ms.materials} materials)`)
    })
    if (s.moduleSummaries.length > 8) console.log(`      ... +${s.moduleSummaries.length - 8} more`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const classicalMode = args.includes('--classical') ? args[args.indexOf('--classical') + 1] : null
const useJson = args.includes('--json')

const modes = ['joint', 'coupled', 'nested', 'isolated'] as const
const flowViewBuilders: Record<string, () => BuildFlowPlanView> = {
  joint: makeJointFlowView,
  coupled: makeCoupledFlowView,
  nested: makeNestedFlowView,
  isolated: makeIsolatedFlowView,
}

if (classicalMode) {
  // Run classical mode only
  const plan = runClassical(classicalMode)
  if (useJson) {
    console.log(JSON.stringify(extractSummary(plan), null, 2))
  } else {
    console.log(`Classical ${classicalMode}:`)
    const summary = extractSummary(plan)
    summary.forEach(s => {
      console.log(`  ${s.label}: [${s.allModules.join(', ')}]`)
      if (s.targetRateSources.length > 0) {
        s.targetRateSources.forEach(src => {
          console.log(`    ── ${src.label} ──`)
          for (const [w, r] of Object.entries(src.rates)) {
            const prod = s.netProduction[w] || 0
            const pct = r > 0 ? Math.round(prod / r * 100) : 0
            console.log(`      ${w}: 需要: ${r.toFixed(1)}/h  产能: ${prod.toFixed(1)}/h  满足: ${pct}%`)
          }
        })
      }
      if (s.moduleSummaries.length > 0) {
        console.log(`    Module Summaries: ${s.moduleSummaries.length}`)
        s.moduleSummaries.slice(0, 5).forEach(ms => {
          console.log(`      ${ms.moduleId} ×${ms.moduleCount} (${ms.materials} materials)`)
        })
        if (s.moduleSummaries.length > 5) console.log(`      ... +${s.moduleSummaries.length - 5} more`)
      }
    })
  }
} else {
  // Run comparison for all modes
  for (const mode of modes) {
    const classical = runClassical(mode)
    const newPlan = runNew(flowViewBuilders[mode]!())

    const classicalSummary = extractSummary(classical)
    const newSummary = extractSummary(newPlan)

    if (useJson) {
      console.log(JSON.stringify({ mode, classical: classicalSummary, new: newSummary }, null, 2))
    } else {
      console.log(`\n=== ${mode.toUpperCase()} ===`)
      console.log('--- CLASSICAL ---')
      classicalSummary.forEach(s => {
        console.log(`  ${s.label}: [${s.allModules.join(', ')}]`)
        printSources(s)
        printModuleSummaries(s)
      })
      console.log('--- NEW ---')
      newSummary.forEach(s => {
        console.log(`  ${s.label}: [${s.allModules.join(', ')}]`)
        printSources(s)
        printModuleSummaries(s)
      })
    }
  }
}
