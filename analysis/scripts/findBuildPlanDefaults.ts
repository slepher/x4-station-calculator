import { readFileSync } from 'fs'
import { resolve } from 'path'

const WARE = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, any> = Object.fromEntries(WARE.map((w: any) => [w.id, w]))
const modulesMap: Record<string, any> = Object.fromEntries(MOD.map((m: any) => [m.id, m]))

const waresByName: Record<string, any> = {}
for (const w of WARE) waresByName[w.name.toLowerCase()] = w
const modulesByName: Record<string, any> = {}
for (const m of MOD) modulesByName[m.name.toLowerCase()] = m

function modName(id: string): string { const m = modulesMap[id]; return m?.name || id }
function wareName(id: string): string { const w = waresMap[id]; return w?.name || id }

function resolveModuleId(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const m of MOD) {
    if (m.name.toLowerCase().replace(/\s+/g, '') === key) return m.id
  }
  const partial = MOD.find((m: any) => m.name.toLowerCase().includes(name.toLowerCase()))
  return partial?.id || null
}

function resolveWareId(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const w of WARE) {
    if (w.name.toLowerCase().replace(/\s+/g, '') === key) return w.id
  }
  const partial = WARE.find((w: any) => w.name.toLowerCase().includes(name.toLowerCase()))
  return partial?.id || null
}

import { calculateBuildPlan } from '../../src/store/logic/calculateBuildPlan'
import { buildFlowPlanGraph } from '../../src/store/logic/buildFlowPlanGraph'
import { computeFlowPlanLines, makeSchemes } from '../../src/store/logic/calculateBuildFlowPlan'
import { BootstrapMode, type BuildGoal, type BuildFlowPlanView } from '../../src/types/build-plan'
import type { BuildFlowGroup, BuildFlowLineCard, BuildFlowTag } from '../../src/types/x4'

const baseSettings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false
}

function fmtCr(n: number): string { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}` }
function fmtH(s: number): string { return `${(s / 3600).toFixed(2)}h` }

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: npx vite-node analysis/scripts/findBuildPlanDefaults.ts [options]

Options:
  --bootstrap=<mode>  Bootstrap mode (default: none)
                       none       - No bootstrap, only target production line
                       joint      - D (A+B) joint bootstrap with full self-sustain
                       coupled    - Coupled iterative: A↔B loop with B one-shot calculation
                       isolated   - Isolated specialized: B first, then A, no loop
                       nested     - Nested joint: A first, then D(A+B) joint bootstrap

  --module="Name*N"   Build-module goal (comma-separated for multiple)
                       Name: module name (fuzzy match)
                       N: count (default: 1)
                       Example: --module="Missile Component Production*5"

  --ware="Name*R"     Production-rate goal (comma-separated for multiple)
                       Name: ware name (fuzzy match)
                       R: rate per hour (default: 1000)
                       Example: --ware="Hull Parts*1000"

  --help, -h           Show this help message

Default (no --module or --ware): Missile Component Production ×5

Examples:
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts --bootstrap=joint
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts --bootstrap=coupled --module="Missile Component Production*5"
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts --bootstrap=isolated --ware="Hull Parts*2000"
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts --bootstrap=nested`)
  process.exit(0)
}

let parsedBootstrap = BootstrapMode.None
const bootstrapFlag = process.argv.find(a => a.startsWith('--bootstrap='))
if (bootstrapFlag) {
  const val = bootstrapFlag.slice('--bootstrap='.length).toLowerCase()
  if (val === 'joint') parsedBootstrap = BootstrapMode.Joint
  else if (val === 'coupled' || val === 'iterative') parsedBootstrap = BootstrapMode.CoupledIterative
  else if (val === 'isolated') parsedBootstrap = BootstrapMode.IsolatedSpecialized
  else if (val === 'nested') parsedBootstrap = BootstrapMode.NestedJoint
}

const useClassical = process.argv.includes('--classical')
const useJson = process.argv.includes('--json')
const useDebugGreedy = process.argv.includes('--debug-greedy')

if (useDebugGreedy) {
  ;(globalThis as any).__GREEDY_DEBUG__ = true
}

function parseArgs(): BuildGoal[] {
  const goals: BuildGoal[] = []
  const moduleArg = process.argv.find(a => a.startsWith('--module='))
  const wareArg = process.argv.find(a => a.startsWith('--ware='))

  if (moduleArg) {
    const value = moduleArg.slice('--module='.length)
    for (const part of value.split(',')) {
      const [name, countStr] = part.split('*')
      const modId = resolveModuleId(name.trim())
      if (!modId) { console.error(`Module not found: ${name.trim()}`); process.exit(1) }
      const count = parseInt(countStr || '1')
      goals.push({ type: 'build-module', moduleId: modId, count })
    }
  }

  if (wareArg) {
    const value = wareArg.slice('--ware='.length)
    for (const part of value.split(',')) {
      const [name, rateStr] = part.split('*')
      const wareId = resolveWareId(name.trim())
      if (!wareId) { console.error(`Ware not found: ${name.trim()}`); process.exit(1) }
      const ratePerHour = parseFloat(rateStr || '1000')
      goals.push({ type: 'production-rate', wareId, ratePerHour })
    }
  }

  if (goals.length === 0) {
    goals.push({ type: 'build-module', moduleId: 'module_gen_prod_missilecomponents_01', count: 5 })
  }

  return goals
}

const goals = parseArgs()

// ---- Mock build-flow data builders for new algorithm ----

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

function makeJointFlowView(): BuildFlowPlanView {
  const dCard = card('D', 'D 联合产线', ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  return { buildFlowGroups: [group([dCard])], assignments: [
    { wareId: 'hullparts', sourceGroupId: 'D', targetType: 'output-build-material' },
    { wareId: 'claytronics', sourceGroupId: 'D', targetType: 'output-build-material' },
    { wareId: 'advancedcomposites', sourceGroupId: 'D', targetType: 'output-build-material' },
    { wareId: 'plasmaconductors', sourceGroupId: 'D', targetType: 'output-build-material' },
    { wareId: 'hullparts', sourceGroupId: 'D', targetType: 'line-build-material', targetGroupId: 'D' },
    { wareId: 'claytronics', sourceGroupId: 'D', targetType: 'line-build-material', targetGroupId: 'D' },
    { wareId: 'advancedcomposites', sourceGroupId: 'D', targetType: 'line-build-material', targetGroupId: 'D' },
    { wareId: 'plasmaconductors', sourceGroupId: 'D', targetType: 'line-build-material', targetGroupId: 'D' },
  ], virtualEdges: [] }
}

function makeCoupledFlowView(): BuildFlowPlanView {
  const aCard = card('A', 'A 建材产线', ['hullparts', 'claytronics'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const bCard = card('B', 'B 特种产线', ['advancedcomposites', 'plasmaconductors'], ['hullparts', 'claytronics'])
  return { buildFlowGroups: [group([aCard, bCard])], assignments: [
    { wareId: 'hullparts', sourceGroupId: 'A', targetType: 'output-build-material' },
    { wareId: 'claytronics', sourceGroupId: 'A', targetType: 'output-build-material' },
    { wareId: 'advancedcomposites', sourceGroupId: 'B', targetType: 'output-build-material' },
    { wareId: 'plasmaconductors', sourceGroupId: 'B', targetType: 'output-build-material' },
    // A self: hullparts→A, claytronics→A
    { wareId: 'hullparts', sourceGroupId: 'A', targetType: 'line-build-material', targetGroupId: 'A' },
    { wareId: 'claytronics', sourceGroupId: 'A', targetType: 'line-build-material', targetGroupId: 'A' },
    // A→B: advanced→B, plasma→B
    { wareId: 'advancedcomposites', sourceGroupId: 'B', targetType: 'line-build-material', targetGroupId: 'A' },
    { wareId: 'plasmaconductors', sourceGroupId: 'B', targetType: 'line-build-material', targetGroupId: 'A' },
    // B→A: hullparts→A, claytronics→A
    { wareId: 'hullparts', sourceGroupId: 'A', targetType: 'line-build-material', targetGroupId: 'B' },
    { wareId: 'claytronics', sourceGroupId: 'A', targetType: 'line-build-material', targetGroupId: 'B' },
  ], virtualEdges: [] }
}

function makeNestedFlowView(): BuildFlowPlanView {
  const aCard = card('A_N', 'A 基础建材', ['hullparts', 'claytronics'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const dCard = card('D_N', 'D 联合自举', ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  return { buildFlowGroups: [group([aCard, dCard])], assignments: [
    { wareId: 'hullparts', sourceGroupId: 'A_N', targetType: 'output-build-material' },
    { wareId: 'claytronics', sourceGroupId: 'A_N', targetType: 'output-build-material' },
    { wareId: 'advancedcomposites', sourceGroupId: 'D_N', targetType: 'output-build-material' },
    { wareId: 'plasmaconductors', sourceGroupId: 'D_N', targetType: 'output-build-material' },
    // A_N→D_N: all 4 from D_N for A_N
    { wareId: 'hullparts', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'A_N' },
    { wareId: 'claytronics', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'A_N' },
    { wareId: 'advancedcomposites', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'A_N' },
    { wareId: 'plasmaconductors', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'A_N' },
    // D_N self: all 4 from D_N for D_N
    { wareId: 'hullparts', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'D_N' },
    { wareId: 'claytronics', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'D_N' },
    { wareId: 'advancedcomposites', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'D_N' },
    { wareId: 'plasmaconductors', sourceGroupId: 'D_N', targetType: 'line-build-material', targetGroupId: 'D_N' },
  ], virtualEdges: [] }
}

function makeIsolatedFlowView(): BuildFlowPlanView {
  const aCard = card('A_I', 'A 建材产线', ['hullparts', 'claytronics'], ['hullparts', 'claytronics', 'advancedcomposites', 'plasmaconductors'])
  const bCard = card('B_I', 'B 特种孤岛', ['advancedcomposites', 'plasmaconductors'], [])
  return { buildFlowGroups: [group([aCard, bCard])], assignments: [
    { wareId: 'hullparts', sourceGroupId: 'A_I', targetType: 'output-build-material' },
    { wareId: 'claytronics', sourceGroupId: 'A_I', targetType: 'output-build-material' },
    { wareId: 'advancedcomposites', sourceGroupId: 'B_I', targetType: 'output-build-material' },
    { wareId: 'plasmaconductors', sourceGroupId: 'B_I', targetType: 'output-build-material' },
    // A self: hullparts→A_I, claytronics→A_I
    { wareId: 'hullparts', sourceGroupId: 'A_I', targetType: 'line-build-material', targetGroupId: 'A_I' },
    { wareId: 'claytronics', sourceGroupId: 'A_I', targetType: 'line-build-material', targetGroupId: 'A_I' },
    // A→B: advanced→B_I, plasma→B_I
    { wareId: 'advancedcomposites', sourceGroupId: 'B_I', targetType: 'line-build-material', targetGroupId: 'A_I' },
    { wareId: 'plasmaconductors', sourceGroupId: 'B_I', targetType: 'line-build-material', targetGroupId: 'A_I' },
  ], virtualEdges: [] }
}

const flowViewBuilders: Record<string, () => BuildFlowPlanView> = {
  joint: makeJointFlowView,
  coupled: makeCoupledFlowView,
  nested: makeNestedFlowView,
  isolated: makeIsolatedFlowView,
}

const goalDesc = goals.map(g => {
  if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
  if (g.type === 'production-rate') return `${wareName(g.wareId)} ${g.ratePerHour}/h`
  return '自给自足'
}).join(', ')

console.log(`=== Build Plan: ${goalDesc} (empty empire) ${useClassical ? '[CLASSICAL]' : '[NEW]'} ===`)
console.log()

const baseInput = {
  goals,
  selfSufficient: false,
  bootstrapMode: parsedBootstrap,
  currentModules: [],
  currentNetProduction: {},
  settings: baseSettings,
  modulesMap,
  waresMap,
  modulesByOutputMap: {}
} as const

let result: ReturnType<typeof calculateBuildPlan>

if (useClassical) {
  result = calculateBuildPlan(baseInput)
} else {
  // New algorithm: get C modules, build graph, compute, make schemes
  const cResult = calculateBuildPlan({ ...baseInput, bootstrapMode: BootstrapMode.None })
  const cModules = cResult.schemes.length > 0 ? cResult.schemes[cResult.schemes.length - 1]!.modules : []

  const modeKey = parsedBootstrap as string
  const buildFlowView = flowViewBuilders[modeKey]?.() || null

  if (!buildFlowView) {
    result = cResult
  } else {
    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)
    if (useDebugGreedy) {
      console.log('[GRAPH] nodes:', [...graph.nodes.keys()])
      console.log('[GRAPH] edges:')
      for (const e of graph.edges) {
        console.log(`  ${e.fromLineKey} → ${e.toLineKey} (${e.wareId}) [${e.sourceLabel}]`)
      }
      console.log('[GRAPH] sccGroups:', graph.sccGroups)
    }
    graph.cGoalWareIds = goals.map(g => {
      if (g.type === 'production-rate' || g.type === 'derived-rate') return g.wareId
      const mod = modulesMap[g.moduleId]
      if (mod?.outputs) return Object.keys(mod.outputs)[0]!
      return g.moduleId
    })
    computeFlowPlanLines(graph, modulesMap, waresMap, baseSettings, [])
    const schemes = makeSchemes(graph, modulesMap, waresMap, baseSettings)
    result = {
      goals,
      selfSufficient: false,
      bootstrapMode: parsedBootstrap,
      schemes,
      totalDuration: 0, totalCredits: 0,
      goalsAchieved: goals, goalsRemaining: [], halted: false, haltReason: '',
    }
  }
}

if (useJson) {
  console.log(JSON.stringify(result.schemes.map(s => ({
    label: s.label,
    description: s.description,
    modules: s.modules.map(m => ({ id: m.id, name: modName(m.id), count: m.count })),
    netProduction: s.netProduction,
    targetRateSources: s.targetRateSources,
    buildMaterialTotals: s.buildMaterialTotals,
    totalDuration: s.totalDuration,
    totalCredits: s.totalCredits,
    stepsCount: s.stepsCount,
    steps: s.steps.map(st => ({
      moduleId: st.moduleId,
      moduleName: modName(st.moduleId),
      count: st.moduleCount,
      duration: st.estimatedDuration,
      credits: st.estimatedCredits,
      reason: st.reason,
    })),
  })), null, 2))
  process.exit(0)
}

for (let si = 0; si < result.schemes.length; si++) {
  const scheme = result.schemes[si]
  const sep = '─'.repeat(80)
  console.log(sep)
  console.log(`  ${scheme.label}  │  ${fmtH(scheme.totalDuration)}  │  ${fmtCr(scheme.totalCredits)}  │  ${scheme.stepsCount} steps  │  ${fmtCr(scheme.totalCredits / Math.max(1, scheme.totalDuration / 3600))}/h`)
  console.log(`  ${scheme.description}`)
  console.log(`  目的产物: ${scheme.purposeModules.map(wareName).join(', ')}`)

  const primarySet = new Set(scheme.primaryModuleIds)
  const primaryModules = scheme.modules.filter(m => primarySet.has(m.id))
  const derivedModules = scheme.modules.filter(m => !primarySet.has(m.id))
  if (primaryModules.length > 0) {
    console.log(`  主要模块: ${primaryModules.map(m => `${modName(m.id)} ×${m.count}`).join(', ')}`)
  }
  if (derivedModules.length > 0) {
    console.log(`  配套模块: ${derivedModules.map(m => `${modName(m.id)} ×${m.count}`).join(', ')}`)
  }

  console.log(sep)

  if (scheme.steps.length === 0) {
    console.log('  (无建造步骤)')
    console.log()
    continue
  }

  let cumDur = 0
  let cumCr = 0
  let currentGroup = -1
  for (const step of scheme.steps) {
    if (step.groupIndex !== currentGroup) {
      currentGroup = step.groupIndex
      console.log(`\n  ▸ ${step.reason || '主产线'}`)
    }

    const stepDurInc = step.estimatedDuration - cumDur
    const stepCrInc = step.estimatedCredits - cumCr
    cumDur = step.estimatedDuration
    cumCr = step.estimatedCredits

    console.log(`    #${step.order}  ${modName(step.moduleId)} ×${step.moduleCount}`)
    console.log(`         建造: ${fmtH(step.moduleBuildTime)}  累计: ${fmtH(cumDur)}  步骤费: ${fmtCr(stepCrInc)}  累计费: ${fmtCr(cumCr)}`)

    if (step.materials.length > 0) {
      console.log(`         材料明细:`)
      for (const mat of step.materials) {
        const price = waresMap[mat.wareId]?.price || 0
        const consumed = Math.round(mat.quantity)
        console.log(`           ${wareName(mat.wareId).padEnd(30)} ×${String(consumed).padStart(6)}  ` +
          `库存: ${String(Math.round(mat.stockBefore)).padStart(7)}  ` +
          `自产: ${String(Math.round(mat.currentProdRate)).padStart(5)}/h  +${Math.round(mat.producedDuringBuild)}  ` +
          `买: ${fmtCr(mat.creditsNeeded).padStart(7)}  (单价: ${fmtCr(price)})`)
      }
    } else {
      console.log(`         材料: 无`)
    }
  }

  console.log()
  if (scheme.targetRateSources.length > 0) {
    console.log(`  ── 产能对各约束来源的满足率 ──`)
    for (const src of scheme.targetRateSources) {
      console.log(`  ── ${src.label} ──`)
      if (Object.keys(src.rates).length === 0) {
        console.log(`    (空)`)
        continue
      }
      for (const wareId of Object.keys(src.rates).sort()) {
        const target = src.rates[wareId]
        const net = scheme.netProduction[wareId] || 0
        const sat = target > 0 ? (net / target * 100) : (net >= 0 ? 100 : 0)
        const mark = sat >= 100 ? '✓' : '✗'
        const matQty = src.materials?.[wareId] || 0
        console.log(`    ${mark} ${wareName(wareId).padEnd(30)} ×${String(Math.round(matQty)).padStart(7)}  需要: ${String(target.toFixed(1)).padStart(8)}/h  ` +
          `产能: ${String(net.toFixed(1)).padStart(8)}/h  满足: ${sat.toFixed(0)}%`)
      }
    }
  }

  console.log()
}

console.log('═'.repeat(80))
console.log(`  总计: ${fmtH(result.totalDuration)}  │  ${fmtCr(result.totalCredits)}`)
console.log('═'.repeat(80))
