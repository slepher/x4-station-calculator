import type {
  SavedModule,
  X4Module,
  X4Ware,
  StationSettings
} from '@/types/x4'
import type {
  BuildGoal,
  BuildScheme,
  BuildSchemeStep,
  BuildMaterial,
  CalculateBuildPlanInput,
  BuildPlan,
  BuildGroup,
  BuildRateSource
} from '@/types/build-plan'
import { getProductionEfficiency, findBestProducer } from './bestModuleSelector'
import { calculateAutoFillModules } from './calculateProductionFlows'

export function calculateNetProduction(
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

function mergeModules(modules: SavedModule[]): SavedModule[] {
  const map = new Map<string, number>()
  for (const m of modules) {
    map.set(m.id, (map.get(m.id) || 0) + m.count)
  }
  return Array.from(map.entries()).map(([id, count]) => ({ id, count }))
}

interface BuildRatesResult {
  rates: Record<string, number>
  totalTime: number
  totalCost: number
}

function computeBuildRates(
  modules: SavedModule[],
  moduleMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): BuildRatesResult {
  const materials: Record<string, number> = {}
  let totalTime = 0
  for (const m of modules) {
    const mod = moduleMap[m.id]
    if (!mod) continue
    totalTime += mod.buildTime * m.count
    const cost = mod.buildCost
    if (!cost || Object.keys(cost).length === 0) continue
    for (const [wareId, qty] of Object.entries(cost)) {
      if (wareId === 'energycells') continue
      materials[wareId] = (materials[wareId] || 0) + qty * m.count
    }
  }
  const rates: Record<string, number> = {}
  let totalCost = 0
  for (const [wareId, qty] of Object.entries(materials)) {
    const ware = waresMap[wareId]
    if (!ware) continue
    totalCost += qty * ware.price
    rates[wareId] = qty / (totalTime / 3600)
  }
  return { rates, totalTime, totalCost }
}

function expandGoalDependencies(
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
    case 'production-rate': {
      expandWareUpstream(goal.wareId, goal.ratePerHour, new Set())
      break
    }
    case 'build-module': {
      const mod = modulesMap[goal.moduleId]
      if (!mod) break
      addModule(goal.moduleId, goal.count)
      break
    }
  }

  return Object.entries(required).map(([id, count]) => ({ id, count }))
}

function makeSchemeSteps(
  groups: BuildGroup[],
  moduleMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  contextModules?: SavedModule[]
): BuildSchemeStep[] {
  let builtSoFar: SavedModule[] = contextModules ? [...contextModules] : []

  let cumDuration = 0
  let cumCredits = 0
  let order = 0
  const result: BuildSchemeStep[] = []
  const stock = new Map<string, number>()

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]!
    const sorted = [...group.modules].sort(
      (a, b) => (moduleMap[a.id]?.tier || 0) - (moduleMap[b.id]?.tier || 0)
    )
    for (const m of sorted) {
    const mod = moduleMap[m.id]
    if (!mod) continue
    for (let ci = 0; ci < m.count; ci++) {
    const buildTime = mod.buildTime
    const net = calculateNetProduction(builtSoFar, moduleMap, settings.considerWorkforceForAutoFill, settings.sunlight)
    const cost = mod.buildCost && Object.keys(mod.buildCost).length > 0 ? mod.buildCost : {}
    const buildTimeH = buildTime / 3600
    const materials: BuildMaterial[] = Object.entries(cost).map(([wareId, val]) => {
      const totalQty = (val as number)
      const prodRate = Math.max(0, net[wareId] || 0)
      const warePrice = waresMap[wareId]?.price || 0
      const prevStock = stock.get(wareId) || 0
      const coveredByStock = Math.min(totalQty, prevStock)
      const deficitQty = totalQty - coveredByStock
      const credits = deficitQty * warePrice
      stock.set(wareId, prevStock - coveredByStock)
      const produced = prodRate * buildTimeH
      return {
        wareId,
        quantity: totalQty,
        currentProdRate: prodRate,
        stockBefore: prevStock,
        producedDuringBuild: produced,
        estimatedTime: 0,
        creditsNeeded: credits
      }
    })
    for (const [wareId, val] of Object.entries(net)) {
      const rate = val as number
      if (rate > 0) stock.set(wareId, (stock.get(wareId) || 0) + rate * buildTimeH)
    }

    cumDuration += buildTime
    cumCredits += materials.reduce((s, mat) => s + mat.creditsNeeded, 0)

    builtSoFar = mergeModules([...builtSoFar, { id: m.id, count: 1 }])

    order++
    result.push({
      order,
      moduleId: m.id,
      moduleCount: 1,
      moduleBuildTime: buildTime,
      materials,
      estimatedDuration: cumDuration,
      estimatedCredits: cumCredits,
      reason: group.reason,
      groupIndex: gi
    })
  }
  }
  }
  return result
}

function makeScheme(
  groups: BuildGroup[],
  label: string,
  description: string,
  purposeModules: string[],
  settings: StationSettings,
  moduleMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  contextModules?: SavedModule[],
  targetRateSources?: BuildRateSource[]
): BuildScheme {
  const steps = makeSchemeSteps(groups, moduleMap, waresMap, settings, contextModules)
  const lastStep = steps[steps.length - 1]
  const mergedModules = mergeModules(groups.flatMap(g => g.modules))
  const ownNetProduction = calculateNetProduction(
    mergedModules,
    moduleMap, settings.considerWorkforceForAutoFill, settings.sunlight
  )
  const buildMaterialTotals: Record<string, number> = {}
  let totalModuleBuildTime = 0
  for (const m of mergedModules) {
    const mod = moduleMap[m.id]
    if (!mod) continue
    totalModuleBuildTime += mod.buildTime * m.count
    const cost = mod.buildCost && Object.keys(mod.buildCost).length > 0 ? mod.buildCost : {}
    for (const [wareId, qty] of Object.entries(cost)) {
      buildMaterialTotals[wareId] = (buildMaterialTotals[wareId] || 0) + (qty as number) * m.count
    }
  }
  const targetRates: Record<string, number> = {}
  for (const src of (targetRateSources || [])) {
    for (const [wareId, rate] of Object.entries(src.rates)) {
      targetRates[wareId] = Math.max(targetRates[wareId] || 0, rate)
    }
  }
  const purposeWareSet = new Set(purposeModules)
  const primaryModuleIds = mergedModules
    .filter(m => {
      const mod = moduleMap[m.id]
      return mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w))
    })
    .map(m => m.id)
  return {
    label,
    description,
    purposeModules,
    primaryModuleIds,
    modules: mergedModules,
    targetRates,
    targetRateSources: targetRateSources || [],
    netProduction: ownNetProduction,
    steps,
    totalDuration: lastStep?.estimatedDuration || 0,
    totalCredits: lastStep?.estimatedCredits || 0,
    stepsCount: steps.length,
    isFeasible: steps.length > 0,
    totalModuleBuildTime,
    buildMaterialTotals
  }
}

function greedyFill(
  targetRateSources: BuildRateSource[],
  currentEmpireModules: SavedModule[],
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): BuildGroup[] {
  let built: SavedModule[] = []
  let maxIterations = 60
  const groups: BuildGroup[] = []
  let prevAutoModules: SavedModule[] = []

  const targetRates: Record<string, number> = {}
  for (const src of targetRateSources) {
    for (const [wareId, rate] of Object.entries(src.rates)) {
      targetRates[wareId] = Math.max(targetRates[wareId] || 0, rate)
    }
  }

  function addModule(modList: SavedModule[], modId: string, count: number) {
    const existing = modList.find(m => m.id === modId)
    if (existing) existing.count += count
    else modList.push({ id: modId, count })
  }

  function findLowestSatisfaction(contextNet: Record<string, number>): string | null {
    if (built.length === 0) {
      let best: string | null = null
      let highest = 0
      for (const [wareId, rate] of Object.entries(targetRates)) {
        if (wareId === 'energycells') continue
        const prodRate = Math.max(0, contextNet[wareId] ?? 0)
        if (prodRate < rate && rate > highest) {
          highest = rate
          best = wareId
        }
      }
      return best
    }
    const totals = new Map<string, number>()
    let totalBuildTime = 0
    for (const m of built) {
      const mod = modulesMap[m.id]
      if (!mod) continue
      totalBuildTime += mod.buildTime * m.count
    const cost = mod.buildCost
    if (!cost || Object.keys(cost).length === 0) continue
      for (const [wareId, qty] of Object.entries(cost)) {
        totals.set(wareId, (totals.get(wareId) || 0) + qty * m.count)
      }
    }
    const cons = Array.from(totals.entries())
      .map(([wareId, qty]) => ({ wareId, rate: totalBuildTime > 0 ? qty / (totalBuildTime / 3600) : 0 }))
      .filter(item => {
        if (item.wareId === 'energycells') return false
        const w = waresMap[item.wareId]
        if (!w || w.transport === 'solid' || w.transport === 'liquid') return false
        return !!findBestProducer(item.wareId, settings.racePreference, [...currentEmpireModules, ...built], modulesMap, waresMap)
      })
    let bestWare: string | null = null
    let worstSat = Infinity
    for (const c of cons) {
      if (c.rate <= 0) continue
      const prodRate = Math.max(0, contextNet[c.wareId] ?? 0)
      const satRate = prodRate / c.rate
      if (satRate < worstSat) {
        worstSat = satRate
        bestWare = c.wareId
      }
    }
    return bestWare
  }

  function getAutoModules(mods: SavedModule[]): SavedModule[] {
    const r = calculateAutoFillModules({
      plannedModules: mergeModules([...currentEmpireModules, ...mods]),
      settings, modulesMap, waresMap, lockedWares: []
    })
    return [...r.autoIndustryModules, ...r.autoHabitationModules]
  }

  while (maxIterations-- > 0) {
    const combined = [...currentEmpireModules, ...built]
    const contextNet = calculateNetProduction(
      combined,
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight
    )

    let allMet = true
    for (const src of targetRateSources) {
      for (const [wareId, rate] of Object.entries(src.rates)) {
        if ((contextNet[wareId] || 0) < rate) allMet = false
      }
    }
    if (allMet) break

    let bottleneck: string | null = null
    if (built.length === 0 && targetRates['hullparts'] !== undefined) {
      bottleneck = 'hullparts'
    } else {
      bottleneck = findLowestSatisfaction(contextNet)
    }
    if (!bottleneck) break

    const producer = findBestProducer(bottleneck, settings.racePreference, combined, modulesMap, waresMap)
    if (!producer) break

    if (bottleneck === 'energycells') continue

    addModule(built, producer.id, 1)

    const currentAuto = getAutoModules(built)
    const deltaAuto = currentAuto.filter(m => {
      const prev = prevAutoModules.find(p => p.id === m.id)
      return !prev || prev.count < m.count
    }).map(m => {
      const prev = prevAutoModules.find(p => p.id === m.id)
      return { id: m.id, count: m.count - (prev?.count || 0) }
    })
    prevAutoModules = currentAuto.map(m => ({ ...m }))

    const groupMods = mergeModules([{ id: producer.id, count: 1 }, ...deltaAuto])
    groups.push({ reason: `Build mat: ${bottleneck}`, modules: groupMods })
  }

  return groups
}

function planProductionForRates(
  whichRates: Record<string, number>,
  targetRates: Record<string, number>,
  currentNetProd: Record<string, number>,
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): SavedModule[] {
  const modules: Record<string, number> = {}

  for (const wareId of Object.keys(whichRates)) {
    const targetRate = (targetRates[wareId] || whichRates[wareId] || 0)
    const existingRate = currentNetProd[wareId] || 0
    if (existingRate >= targetRate) continue

    const producer = findBestProducer(wareId, settings.racePreference, [], modulesMap, waresMap)
    if (!producer) continue

    const eff = getProductionEfficiency(producer, settings.considerWorkforceForAutoFill)
    let sf = 1.0
    if (wareId === 'energycells') sf = settings.sunlight / 100.0
    const singleOutput = (producer.outputs[wareId] || 0) * eff * sf
    if (singleOutput <= 0) continue

    const deficitRate = targetRate - existingRate
    const countNeeded = Math.ceil(deficitRate / singleOutput)
    if (countNeeded > 0) {
      modules[producer.id] = (modules[producer.id] || 0) + countNeeded
    }
  }

  return Object.entries(modules).map(([id, count]) => ({ id, count }))
}

export function calculateBuildPlan(input: CalculateBuildPlanInput): BuildPlan {
  const { goals, selfSufficient, currentModules, settings, modulesMap, waresMap, currentNetProduction } = input

  const allSchemes: BuildScheme[] = []

  if (goals.length > 0) {
    const base3 = goals.flatMap(g => expandGoalDependencies(g, modulesMap, waresMap))
    const merged3 = mergeModules(base3)
    const autoFill3 = calculateAutoFillModules({
      plannedModules: merged3,
      settings,
      modulesMap,
      waresMap,
      lockedWares: []
    })
    const allMods3 = mergeModules([...merged3, ...autoFill3.autoIndustryModules, ...autoFill3.autoHabitationModules])
    const { rates: rates3 } = computeBuildRates(allMods3, modulesMap, waresMap)

    const purposeWareSet = new Set(goals.flatMap(g => {
      if (g.type === 'build-module') return Object.keys(modulesMap[g.moduleId]?.outputs || {}).filter(w => w !== 'energycells')
      if (g.type === 'production-rate') return [g.wareId]
      return []
    }))

    const buildMatModuleIds = new Set<string>()
    for (const m of allMods3) {
      const mod = modulesMap[m.id]
      if (!mod) continue
      const isBuildMat = Object.keys(mod.outputs).some(w => rates3[w] !== undefined)
      if (isBuildMat) buildMatModuleIds.add(m.id)
    }

    const scheme3Prime = allMods3.filter(m => !buildMatModuleIds.has(m.id))
    const { rates: rates3prime } = computeBuildRates(scheme3Prime, modulesMap, waresMap)

    const uniquePurpose = [...purposeWareSet]

    if (!selfSufficient) {
      const capacityOK = Object.entries(rates3prime).every(
        ([wareId, rate]) => (currentNetProduction[wareId] || 0) >= rate
      )
      if (capacityOK) {
        const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
          '目标产线系列模块',
          uniquePurpose, settings, modulesMap, waresMap, currentModules,
          [{ label: '目标建材', rates: rates3 }])
        if (s3.stepsCount > 0) allSchemes.push(s3)
        return { goals, selfSufficient, schemes: allSchemes, totalDuration: allSchemes.reduce((s, sc) => s + sc.totalDuration, 0), totalCredits: allSchemes.reduce((s, sc) => s + sc.totalCredits, 0), goalsAchieved: [], goalsRemaining: [], halted: false, haltReason: '' }
      }
    }

    const prodMods = planProductionForRates(
      rates3prime, rates3, currentNetProduction,
      settings, modulesMap, waresMap
    )
    const autoFill2 = calculateAutoFillModules({
      plannedModules: prodMods,
      settings,
      modulesMap,
      waresMap,
      lockedWares: []
    })
    const allMods2 = mergeModules([...prodMods, ...autoFill2.autoIndustryModules, ...autoFill2.autoHabitationModules])
    const { rates: rates2 } = computeBuildRates(allMods2, modulesMap, waresMap)

    const r3Remaining: Record<string, number> = {}
    for (const [wareId, rate] of Object.entries(rates3)) {
      if (rates3prime[wareId] === undefined) {
        r3Remaining[wareId] = rate
      }
    }

    const s1Sources: BuildRateSource[] = [
      { label: '方案2建材', rates: rates2 },
      { label: '方案3剩余建材', rates: r3Remaining }
    ]

    let scheme1Groups: BuildGroup[] = []
    const hasS1Targets = s1Sources.some(s => Object.keys(s.rates).length > 0)
    if (hasS1Targets) {
      scheme1Groups = greedyFill(s1Sources,
        currentModules, settings, modulesMap, waresMap
      )
    }

    const scheme1Flat = scheme1Groups.flatMap(g => g.modules)
    if (scheme1Groups.length > 0) {
      const { rates: rates1 } = computeBuildRates(scheme1Flat, modulesMap, waresMap)
      const s1 = makeScheme(scheme1Groups, '自给自足',
        '建造基础材料产线，实现自给自足',
        ['claytronics', 'hullparts', 'plasmaconductors', 'advancedcomposites'],
        settings, modulesMap, waresMap, currentModules,
        [
          { label: '方案1建材', rates: rates1 },
          { label: '方案2建材', rates: rates2 },
          { label: '方案3剩余建材', rates: r3Remaining }
        ])
      if (s1.stepsCount > 0) allSchemes.push(s1)
    }

    if (allMods2.length > 0) {
      const s1Flat = scheme1Flat.length > 0 ? scheme1Flat : []
      const s2Purpose = Object.keys(rates3prime).filter(w => w !== 'energycells')
      const s2 = makeScheme([{ reason: '', modules: allMods2 }], '目标建材',
        '建造目标所需的建材产线模块组',
        s2Purpose,
        settings, modulesMap, waresMap,
        mergeModules([...currentModules, ...s1Flat]),
        [
          { label: 'R3建材需求(R3速率)', rates: Object.fromEntries(Object.keys(rates3prime).map(w => [w, rates3[w] || 0])) },
          { label: '方案2自身建材', rates: rates2 }
        ])
      if (s2.stepsCount > 0) allSchemes.push(s2)
    }

    const priorMods = mergeModules([...currentModules, ...scheme1Flat, ...allMods2])
    const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
      '目标产线系列模块',
      uniquePurpose, settings, modulesMap, waresMap, priorMods,
      [{ label: '目标建材', rates: rates3 }])
    if (s3.stepsCount > 0) allSchemes.push(s3)
  }

  if (selfSufficient && goals.length === 0) {
    const seedWares = ['claytronics', 'hullparts']
    const base = seedWares.flatMap(wareId =>
      expandGoalDependencies({ type: 'production-rate', wareId, ratePerHour: 1 }, modulesMap, waresMap)
    )
    const autoFill = calculateAutoFillModules({
      plannedModules: base,
      settings,
      modulesMap,
      waresMap,
      lockedWares: []
    })
    const allMods = mergeModules([...base, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
    const { rates: selfSuffRates } = computeBuildRates(allMods, modulesMap, waresMap)
    const scheme = makeScheme(
      [{ reason: '自给自足产线', modules: allMods }],
      '自给自足',
      '建造基础材料产线，实现自给自足',
      ['claytronics', 'hullparts', 'plasmaconductors', 'advancedcomposites'],
      settings,
      modulesMap,
      waresMap,
      currentModules,
      [{ label: '自给自足', rates: selfSuffRates }]
    )
    if (scheme.stepsCount > 0) allSchemes.push(scheme)
  }

  return {
    goals,
    selfSufficient,
    schemes: allSchemes,
    totalDuration: allSchemes.reduce((s, sc) => s + sc.totalDuration, 0),
    totalCredits: allSchemes.reduce((s, sc) => s + sc.totalCredits, 0),
    goalsAchieved: [],
    goalsRemaining: [],
    halted: false,
    haltReason: ''
  }
}
