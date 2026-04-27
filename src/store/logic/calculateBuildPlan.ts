import type {
  SavedModule,
  X4Module,
  X4Ware,
  StationSettings
} from '@/types/x4'
import type {
  BuildGoal,
  BuildStep,
  BuildPlan,
  BuildMaterial,
  BuildConstraints,
  CalculateBuildPlanInput
} from '@/types/build-plan'
import { getProductionEfficiency, findBestProducer } from './bestModuleSelector'

function calculateNetProduction(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  bonus: boolean,
  sunlight: number
): Record<string, number> {
  const state: Record<string, number> = {}

  for (const item of modules) {
    const mod = modulesMap[item.id]
    if (!mod) continue

    const eff = getProductionEfficiency(mod, bonus)

    for (const [ware, val] of Object.entries(mod.outputs)) {
      let sf = 1.0
      if (ware === 'energycells') sf = sunlight / 100.0
      state[ware] = (state[ware] || 0) + item.count * val * eff * sf
    }

    for (const [ware, val] of Object.entries(mod.inputs)) {
      state[ware] = (state[ware] || 0) - item.count * val
    }
  }

  return state
}

function isGoalMet(
  goal: BuildGoal,
  netProduction: Record<string, number>,
  modules: SavedModule[]
): boolean {
  switch (goal.type) {
    case 'self-sufficient': {
      const clayNet = netProduction['claytronics'] ?? 0
      const hullNet = netProduction['hullparts'] ?? 0
      return clayNet > 0 && hullNet > 0
    }
    case 'production-rate': {
      const net = netProduction[goal.wareId] ?? 0
      return net >= goal.ratePerHour
    }
    case 'build-module': {
      const builtCount = modules.filter(m => m.id === goal.moduleId).reduce((s, m) => s + m.count, 0)
      return builtCount >= goal.count
    }
    default:
      return true
  }
}

export function expandGoalDependencies(
  goal: BuildGoal,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): SavedModule[] {
  const required: Record<string, number> = {}

  function addModule(modId: string, count: number) {
    required[modId] = (required[modId] || 0) + count
  }

  function expandWareUpstream(wareId: string, targetRate: number, visited: Set<string>) {
    if (visited.has(wareId)) return
    visited.add(wareId)

    const producer = findBestProducer(wareId, 'argon', [], modulesMap, waresMap)
    if (!producer) return

    const outputRate = producer.outputs[wareId] || 0
    if (outputRate <= 0) return

    const countNeeded = Math.ceil(targetRate / outputRate)
    addModule(producer.id, countNeeded)

    for (const [inputWare, inputRate] of Object.entries(producer.inputs)) {
      const isResource = waresMap[inputWare]?.transport === 'solid' || waresMap[inputWare]?.transport === 'liquid'
      const hasProducer = Object.values(modulesMap).some(m => m.outputs[inputWare] && m.type === 'production')
      if (!isResource && hasProducer) {
        expandWareUpstream(inputWare, inputRate * countNeeded, visited)
      }
    }
  }

  switch (goal.type) {
    case 'self-sufficient': {
      const selfSufficientWares = ['claytronics', 'hullparts']
      for (const wareId of selfSufficientWares) {
        expandWareUpstream(wareId, 1, new Set())
      }
      break
    }
    case 'production-rate': {
      expandWareUpstream(goal.wareId, goal.ratePerHour, new Set())
      break
    }
    case 'build-module': {
      const mod = modulesMap[goal.moduleId]
      if (!mod) break
      addModule(goal.moduleId, goal.count)
      for (const [wareId, qty] of Object.entries(mod.buildCost)) {
        const ware = waresMap[wareId]
        if (!ware) continue
        const isResource = ware.transport === 'solid' || ware.transport === 'liquid'
        const hasProducer = Object.values(modulesMap).some(m => m.outputs[wareId] && m.type === 'production')
        if (!isResource && hasProducer) {
          expandWareUpstream(wareId, qty * goal.count, new Set())
        }
      }
      break
    }
  }

  return Object.entries(required).map(([id, count]) => ({ id, count }))
}

export function simulateConstruction(
  initialModules: SavedModule[],
  goals: BuildGoal[],
  timeBudget: number,
  creditBudget: number,
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): { steps: BuildStep[]; halted: boolean; haltReason: string } {
  const steps: BuildStep[] = []
  const currentModules: SavedModule[] = initialModules.map(m => ({ ...m }))
  let remainingTime = timeBudget
  let remainingCredits = creditBudget
  const localGoals: BuildGoal[] = goals.map(g => ({ ...g }))

  function addModule(modList: SavedModule[], modId: string, count: number) {
    const existing = modList.find(m => m.id === modId)
    if (existing) existing.count += count
    else modList.push({ id: modId, count })
  }
  function calcBuildMatConsumption(): { wareId: string; rate: number }[] {
    const totals = new Map<string, number>()
    let totalBuildTime = 0
    for (const s of steps) {
      totalBuildTime += s.moduleBuildTime
      for (const m of s.materials) {
        if (m.quantity > 0) {
          totals.set(m.wareId, (totals.get(m.wareId) || 0) + m.quantity)
        }
      }
    }
    return Array.from(totals.entries())
      .map(([wareId, qty]) => ({
        wareId,
        rate: totalBuildTime > 0 ? qty / (totalBuildTime / 3600) : 0
      }))
      .filter(item => {
        const w = waresMap[item.wareId]
        if (!w || w.transport === 'solid' || w.transport === 'liquid') return false
        const p = findBestProducer(item.wareId, settings.racePreference, currentModules, modulesMap, waresMap)
        return !!p
      })
  }

  function findLowestSatisfaction(): { wareId: string; satRate: number } | null {
    const cons = calcBuildMatConsumption()
    const net = calculateNetProduction(currentModules, modulesMap, settings.considerWorkforceForAutoFill, settings.sunlight)
    let best: { wareId: string; satRate: number } | null = null
    for (const c of cons) {
      const demand = c.rate
      if (demand <= 0) continue
      const prodRate = Math.max(0, net[c.wareId] ?? 0)
      const satRate = prodRate / demand
      if (!best || satRate < best.satRate) {
        best = { wareId: c.wareId, satRate }
      }
    }
    return best
  }

  function planProducerGroup(targetWare: string): SavedModule[] {
    const p = findBestProducer(targetWare, settings.racePreference, currentModules, modulesMap, waresMap)
    if (!p) return []
    const planned = currentModules.map(m => ({ ...m }))
    addModule(planned, p.id, 1)
    let changed = true
    let safeguard = 20
    while (changed && safeguard-- > 0) {
      changed = false
      const curNet = calculateNetProduction(planned, modulesMap, settings.considerWorkforceForAutoFill, settings.sunlight)
      for (const pid of planned.map(m => m.id)) {
        const mod = modulesMap[pid]
        if (!mod) continue
        for (const inputWare of Object.keys(mod.inputs)) {
          const ware = waresMap[inputWare]
          if (!ware || ware.transport === 'solid' || ware.transport === 'liquid') continue
          if (!Object.values(modulesMap).some(x => x.outputs[inputWare] && x.type === 'production')) continue
          const existingNet = curNet[inputWare] ?? 0
          if (existingNet >= 0) continue
          const p2 = findBestProducer(inputWare, settings.racePreference, planned, modulesMap, waresMap)
          if (!p2) continue
          const outRate = p2.outputs[inputWare] ?? 0
          if (outRate <= 0) continue
          const cnt = Math.ceil(Math.abs(existingNet) / outRate)
          addModule(planned, p2.id, cnt)
          if (cnt > 0) changed = true
        }
      }
    }
    const target = new Map<string, number>()
    for (const m of planned) target.set(m.id, Math.max(target.get(m.id) || 0, m.count))
    return Array.from(target.entries())
      .map(([id, count]) => ({ id, count }))
      .filter(m => (currentModules.find(x => x.id === m.id)?.count || 0) < m.count)
      .sort((a, b) => (modulesMap[a.id]?.tier || 0) - (modulesMap[b.id]?.tier || 0))
  }

  let phase: 'initial' | 'buildmat' = 'initial'
  let queue: SavedModule[] = []
  let currentGroupReason = ''
  let maxIterations = 500

  while (maxIterations-- > 0) {
    if (remainingTime <= 0) break

    const net = calculateNetProduction(currentModules, modulesMap, settings.considerWorkforceForAutoFill, settings.sunlight)

    if (queue.length === 0) {
      if (phase === 'initial') {
        if (localGoals.some(g => g.type === 'self-sufficient' || g.type === 'production-rate')) {
          queue = planProducerGroup('hullparts')
          currentGroupReason = 'Initial hull part line'
        }
        phase = 'buildmat'
        if (queue.length > 0) continue
      }

      if (phase === 'buildmat') {
        const need = findLowestSatisfaction()
        if (need) {
          queue = planProducerGroup(need.wareId)
          currentGroupReason = `Build mat: ${need.wareId} (sat ${(need.satRate * 100).toFixed(0)}%)`
        }
        if (queue.length === 0) break
      }
    }

    if (queue.length === 0) break

    const next = queue[0]
    if (!next) break
    const mod = modulesMap[next.id]
    if (!mod) break

    const existingCount = currentModules.find(m => m.id === next.id)?.count || 0
    const stillNeeded = Math.max(0, next.count - existingCount)
    const stepCount = 1
    if (stillNeeded <= stepCount) queue.shift()
    else next.count -= stepCount
    const moduleBuildTime = mod.buildTime * stepCount
    if (moduleBuildTime > remainingTime) break

    const matWares = Object.keys(mod.buildCost).length > 0 ? mod.buildCost : mod.inputs
    const materials: BuildMaterial[] = Object.entries(matWares).map(([wareId, qty]) => {
      const totalQty = qty * stepCount
      const curNet = net[wareId] ?? 0
      const prodRate = Math.max(0, curNet)
      const warePrice = waresMap[wareId]?.price || 0
      const produced = prodRate * (moduleBuildTime / 3600)
      const deficitQty = Math.max(0, totalQty - produced)
      let credits = 0
      let used = 0
      if (deficitQty > 0 && remainingCredits > 0) {
        const aff = Math.floor(remainingCredits / warePrice)
        const canBuy = Math.min(deficitQty, aff)
        used = canBuy * warePrice
        remainingCredits -= used
        credits = used
      }
      const rem = Math.max(0, deficitQty - (used > 0 ? Math.floor(used / warePrice) : 0))
      let wait = 0
      if (rem > 0 && prodRate > 0) wait = (rem / prodRate) * 3600
      else if (rem > 0) wait = (rem / Math.max(1, Object.values(modulesMap).filter(m => m.outputs[wareId]).length)) * 60
      return { wareId, quantity: totalQty, currentProdRate: prodRate, estimatedTime: wait, creditsNeeded: credits }
    })

    const maxWait = Math.max(0, ...materials.map(m => m.estimatedTime))
    const stepTime = moduleBuildTime + maxWait
    if (stepTime > remainingTime) break

    remainingTime -= stepTime
    addModule(currentModules, next.id, stepCount)

    steps.push({
      order: steps.length + 1,
      moduleId: next.id,
      moduleCount: stepCount,
      moduleBuildTime,
      materials,
      estimatedDuration: timeBudget - remainingTime,
      estimatedCredits: creditBudget - remainingCredits,
      reason: currentGroupReason
    })
  }

  return { steps, halted: false, haltReason: '' }
}

export function calculateBuildPlan(input: CalculateBuildPlanInput): BuildPlan {
  const { goals, timeBudget, creditBudget, currentModules, settings, modulesMap, waresMap } = input

  const constraints: BuildConstraints = {
    timeBudget,
    creditBudget,
    goals: [...goals]
  }

  const currentNet = calculateNetProduction(
    currentModules,
    modulesMap,
    settings.considerWorkforceForAutoFill,
    settings.sunlight
  )

  const goalsAchieved: BuildGoal[] = []
  const goalsRemaining: BuildGoal[] = []

  for (const g of goals) {
    if (isGoalMet(g, currentNet, currentModules)) {
      goalsAchieved.push(g)
    } else {
      goalsRemaining.push(g)
    }
  }

  if (goalsRemaining.length === 0) {
    return {
      goals,
      constraints,
      steps: [],
      totalDuration: 0,
      totalCredits: 0,
      goalsAchieved,
      goalsRemaining: [],
      halted: false,
      haltReason: ''
    }
  }

  const { steps, halted, haltReason } = simulateConstruction(
    currentModules,
    goals,
    timeBudget,
    creditBudget,
    settings,
    modulesMap,
    waresMap
  )

  const lastStep = steps.length > 0 ? steps[steps.length - 1] : undefined
  const totalDuration = lastStep?.estimatedDuration ?? 0
  const totalCredits = lastStep?.estimatedCredits ?? 0

  const finalNet = calculateNetProduction(
    [...currentModules, ...steps.map(s => ({ id: s.moduleId, count: s.moduleCount }))],
    modulesMap,
    settings.considerWorkforceForAutoFill,
    settings.sunlight
  )

  goalsAchieved.length = 0
  goalsRemaining.length = 0

  for (const g of goals) {
    const simModules = [
      ...currentModules,
      ...steps.map(s => ({ id: s.moduleId, count: s.moduleCount }))
    ]
    if (isGoalMet(g, finalNet, simModules)) {
      goalsAchieved.push(g)
    } else {
      goalsRemaining.push(g)
    }
  }

  return {
    goals,
    constraints,
    steps,
    totalDuration,
    totalCredits,
    goalsAchieved,
    goalsRemaining,
    halted,
    haltReason
  }
}
