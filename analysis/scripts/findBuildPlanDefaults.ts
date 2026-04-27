import { readFileSync } from 'fs'
import { resolve } from 'path'

const WARE = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, any> = Object.fromEntries(WARE.map((w: any) => [w.id, w]))
const modulesMap: Record<string, any> = Object.fromEntries(MOD.map((m: any) => [m.id, m]))

function modName(id: string): string { const m = modulesMap[id]; return m?.name || id }

import { calculateBuildPlan } from '../../src/store/logic/calculateBuildPlan'

const hours = parseInt(process.argv.find(a => a.startsWith('--hours='))?.split('=')[1] || '24', 10)
const creditsM = parseInt(process.argv.find(a => a.startsWith('--credits='))?.split('=')[1] || '200', 10)
const credits = creditsM * 1_000_000

const baseSettings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false
}

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

function calcConsumption(steps: any[]) {
  const totals = new Map<string, number>()
  let totalTime = 0
  for (const s of steps) {
    totalTime += s.moduleBuildTime
    for (const mat of s.materials) {
      if (mat.quantity > 0) totals.set(mat.wareId, (totals.get(mat.wareId) || 0) + mat.quantity)
    }
  }
  return { totals, totalTime }
}

const TARGET_MATS = ['advancedcomposites', 'plasmaconductors', 'hullparts', 'claytronics']

const result = calculateBuildPlan({
  goals: [{ type: 'self-sufficient' }], timeBudget: hours * 3600, creditBudget: credits,
  currentModules: [], settings: baseSettings, modulesMap, waresMap, modulesByOutputMap: {}
})

let currentGroup: string | null = null
let groupSteps: typeof result.steps = []
let groupId = 0
const cumulativeTotal = new Map<string, number>()

for (const step of result.steps) {
  const r = step.reason
  const isNew = r !== currentGroup
  if (isNew && groupSteps.length > 0) {
    groupId++
    const allSteps = result.steps.slice(0, step.order - 1)
    const currentMods: any[] = []
    for (const s of allSteps) {
      const ex = currentMods.find((c: any) => c.id === s.moduleId)
      if (ex) ex.count += s.moduleCount
      else currentMods.push({ id: s.moduleId, count: s.moduleCount })
    }
    const { totals: consTotals, totalTime: consTime } = calcConsumption(allSteps)
    const net = calcNet(currentMods)
    const totalH = Math.max(1, consTime / 3600)

    const main = groupSteps[groupSteps.length - 1]
    console.log(`[Batch ${groupId}] Target: ${modName(main.moduleId)} — ${main.reason}`)
    console.log(`  Score:`)
    for (const mat of TARGET_MATS) {
      const qty = consTotals.get(mat) || 0
      const prod = net[mat] ?? 0
      const rate = qty / totalH
      const sat = rate > 0 ? ((prod / rate) * 100).toFixed(1) : rate === 0 && prod > 0 ? '∞' : '0.0'
      console.log(`    ${modName(mat)}: qty=${Math.round(qty)} prod=${Math.round(prod)}/h demand=${Math.round(rate)}/h sat=${sat}%`)
    }

    console.log(`  Build order (${groupSteps.length} modules):`)
    for (const s of groupSteps) {
      cumulativeTotal.set(s.moduleId, (cumulativeTotal.get(s.moduleId) || 0) + s.moduleCount)
      console.log(`    #${s.order} ${modName(s.moduleId)} (tier${modulesMap[s.moduleId]?.tier ?? 0}) +${s.moduleCount}=${cumulativeTotal.get(s.moduleId)} build=${(s.moduleBuildTime / 3600).toFixed(2)}h`)
    }
    console.log('')
    groupSteps = []
  }
  currentGroup = r
  groupSteps.push(step)
}

if (groupSteps.length > 0) {
  groupId++
  const allSteps = result.steps
  const currentMods: any[] = []
  for (const s of allSteps) {
    const ex = currentMods.find((c: any) => c.id === s.moduleId)
    if (ex) ex.count += s.moduleCount
    else currentMods.push({ id: s.moduleId, count: s.moduleCount })
  }
  const { totals: consTotals, totalTime: consTime } = calcConsumption(allSteps)
  const net = calcNet(currentMods)
  const totalH = Math.max(1, consTime / 3600)
  const main = groupSteps[groupSteps.length - 1]
  console.log(`[Batch ${groupId}] Target: ${modName(main.moduleId)} — ${main.reason}`)
  console.log(`  Score:`)
  for (const mat of TARGET_MATS) {
    const qty = consTotals.get(mat) || 0
    const prod = net[mat] ?? 0
    const rate = qty / totalH
    const sat = rate > 0 ? ((prod / rate) * 100).toFixed(1) : rate === 0 && prod > 0 ? '∞' : '0.0'
    console.log(`    ${modName(mat)}: qty=${Math.round(qty)} prod=${Math.round(prod)}/h demand=${Math.round(rate)}/h sat=${sat}%`)
  }
  console.log(`  Build order (${groupSteps.length} modules):`)
  for (const s of groupSteps) {
    cumulativeTotal.set(s.moduleId, (cumulativeTotal.get(s.moduleId) || 0) + s.moduleCount)
    console.log(`    #${s.order} ${modName(s.moduleId)} (tier${modulesMap[s.moduleId]?.tier ?? 0}) +${s.moduleCount}=${cumulativeTotal.get(s.moduleId)} build=${(s.moduleBuildTime / 3600).toFixed(2)}h`)
  }
}

// Summary
const lastStep = result.steps[result.steps.length - 1]
console.log(`\n--- Summary: ${result.steps.length} steps, ${lastStep ? (lastStep.estimatedDuration / 3600).toFixed(1) : 0}h used, ${lastStep ? (lastStep.estimatedCredits / 1e6).toFixed(0) : 0}M cr ---`)
