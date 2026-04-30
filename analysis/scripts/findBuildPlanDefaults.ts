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
import { BootstrapMode, type BuildGoal } from '../../src/types/build-plan'

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
  npx vite-node analysis/scripts/findBuildPlanDefaults.ts --bootstrap=isolated --ware="Hull Parts*2000"`)
  process.exit(0)
}

let parsedBootstrap = BootstrapMode.None
const bootstrapFlag = process.argv.find(a => a.startsWith('--bootstrap='))
if (bootstrapFlag) {
  const val = bootstrapFlag.slice('--bootstrap='.length).toLowerCase()
  if (val === 'joint') parsedBootstrap = BootstrapMode.Joint
  else if (val === 'coupled' || val === 'iterative') parsedBootstrap = BootstrapMode.CoupledIterative
  else if (val === 'isolated') parsedBootstrap = BootstrapMode.IsolatedSpecialized
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

const goalDesc = goals.map(g => {
  if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
  if (g.type === 'production-rate') return `${wareName(g.wareId)} ${g.ratePerHour}/h`
  return '自给自足'
}).join(', ')

console.log(`=== Build Plan: ${goalDesc} (empty empire) ===`)
console.log()

const result = calculateBuildPlan({
  goals,
  selfSufficient: false,
  bootstrapMode: parsedBootstrap,
  currentModules: [],
  currentNetProduction: {},
  settings: baseSettings,
  modulesMap,
  waresMap,
  modulesByOutputMap: {}
})

for (let si = 0; si < result.schemes.length; si++) {
  const scheme = result.schemes[si]
  const sep = '─'.repeat(80)
  console.log(sep)
  console.log(`  ${scheme.label}  │  ${fmtH(scheme.totalDuration)}  │  ${fmtCr(scheme.totalCredits)}  │  ${scheme.stepsCount} steps`)
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
    console.log(`  ── 本方案产能对各约束来源的满足率 ──`)
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
        const totalQty = scheme.buildMaterialTotals[wareId] || 0
        console.log(`    ${mark} ${wareName(wareId).padEnd(30)} ×${String(Math.round(totalQty)).padStart(7)}  需要: ${String(target.toFixed(1)).padStart(8)}/h  ` +
          `产能: ${String(net.toFixed(1)).padStart(8)}/h  满足: ${sat.toFixed(0)}%`)
      }
    }
  }

  console.log()
}

console.log('═'.repeat(80))
console.log(`  总计: ${fmtH(result.totalDuration)}  │  ${fmtCr(result.totalCredits)}`)
console.log('═'.repeat(80))
