import { readFileSync } from 'fs'
import { resolve } from 'path'

const WARE = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, any> = Object.fromEntries(WARE.map((w: any) => [w.id, w]))
const modulesMap: Record<string, any> = Object.fromEntries(MOD.map((m: any) => [m.id, m]))

function modName(id: string): string { const m = modulesMap[id]; return m?.name || id }
function wareName(id: string): string { const w = waresMap[id]; return w?.name || id }

import { calculateBuildPlan } from '../../src/store/logic/calculateBuildPlan'

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

function calcNet(mods: any[]) {
  const state: Record<string, number> = {}
  for (const item of mods) {
    const m = modulesMap[item.id]
    if (!m) continue
    for (const [w, val] of Object.entries(m.outputs)) state[w] = (state[w] || 0) + (item.count as number) * (val as number)
    for (const [w, val] of Object.entries(m.inputs)) state[w] = (state[w] || 0) - (item.count as number) * (val as number)
  }
  return state
}

const MISSILE_MODULE = 'module_gen_prod_missilecomponents_01'

console.log('=== Build Plan: Missile Component ×5 (empty empire) ===')
console.log()

const result = calculateBuildPlan({
  goals: [{ type: 'build-module', moduleId: MISSILE_MODULE, count: 5 }],
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
  console.log(`  目的模块: ${scheme.purposeModules.map(modName).join(', ')}`)
  console.log(sep)

  if (scheme.steps.length === 0) {
    console.log('  (无建造步骤)')
    console.log()
    continue
  }

  let cumDur = 0
  let cumCr = 0
  let stock = new Map<string, number>()
  let currentGroup = -1
  for (const step of scheme.steps) {
    if (step.groupIndex !== currentGroup) {
      currentGroup = step.groupIndex
      console.log(`\n  ▸ ${step.reason || '主产线'}`)
    }

    const buildTimeH = step.moduleBuildTime / 3600
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
        const prevStock = stock.get(mat.wareId) || 0
        const produced = mat.currentProdRate * buildTimeH
        const newStock = prevStock - consumed + produced
        stock.set(mat.wareId, newStock)
        console.log(`           ${wareName(mat.wareId).padEnd(30)} ×${String(consumed).padStart(6)}  ` +
          `库存: ${String(Math.round(prevStock)).padStart(7)}  ` +
          `自产: ${String(Math.round(mat.currentProdRate)).padStart(5)}/h  +${Math.round(produced)}  ` +
          `买: ${fmtCr(mat.creditsNeeded).padStart(7)}  (单价: ${fmtCr(price)})`)
      }
    } else {
      console.log(`         材料: 无`)
    }
  }
  console.log()
}

console.log('═'.repeat(80))
console.log(`  总计: ${fmtH(result.totalDuration)}  │  ${fmtCr(result.totalCredits)}`)
console.log('═'.repeat(80))
