import type {
  SavedModule,
  X4Module,
  X4Ware,
  StationSettings
} from '@/types/x4'
import {
  BootstrapMode,
  type BuildGoal,
  type BuildScheme,
  type BuildSchemeStep,
  type BuildMaterial,
  type CalculateBuildPlanInput,
  type BuildPlan,
  type BuildGroup,
  type BuildRateSource
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




function planResult(
  goals: BuildGoal[],
  selfSufficient: boolean,
  bootstrapMode: BootstrapMode,
  allSchemes: BuildScheme[]
): BuildPlan {
  return {
    goals,
    selfSufficient,
    bootstrapMode,
    schemes: allSchemes,
    totalDuration: allSchemes.reduce((s, sc) => s + sc.totalDuration, 0),
    totalCredits: allSchemes.reduce((s, sc) => s + sc.totalCredits, 0),
    goalsAchieved: [],
    goalsRemaining: [],
    halted: false,
    haltReason: ''
  }
}

export function calculateBuildPlan(input: CalculateBuildPlanInput): BuildPlan {
  const { goals, selfSufficient, bootstrapMode, currentModules, settings, modulesMap, waresMap } = input

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

    const uniquePurpose = [...new Set(goals.flatMap(g => {
      if (g.type === 'build-module') return Object.keys(modulesMap[g.moduleId]?.outputs || {}).filter(w => w !== 'energycells')
      if (g.type === 'production-rate') return [g.wareId]
      return []
    }))]

    if (bootstrapMode === BootstrapMode.Joint) {
      const jointGroups = greedyFill(
        [{ label: '目标建材', rates: rates3 }],
        currentModules, settings, modulesMap, waresMap
      )
      if (jointGroups.length > 0) {
        const jointFlat = jointGroups.flatMap(g => g.modules)
        const jointAllRates = computeBuildRates(jointFlat, modulesMap, waresMap).rates
        const jointSelfDemand: Record<string, number> = {}
        for (const [w, r] of Object.entries(jointAllRates)) {
          if (w === 'claytronics' || w === 'hullparts' || w === 'advancedcomposites' || w === 'plasmaconductors') {
            jointSelfDemand[w] = r
          }
        }
        const jointSources: BuildRateSource[] = [
          { label: 'C', rates: rates3 },
          { label: 'A+B_autoFill', rates: jointSelfDemand },
        ]
        const s1 = makeScheme(jointGroups, 'A+B 联合自举',
          'A+B 联合自举模块',
          ['claytronics', 'hullparts', 'plasmaconductors', 'advancedcomposites'],
          settings, modulesMap, waresMap, currentModules,
          jointSources)
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
        '目标产线系列模块',
        uniquePurpose, settings, modulesMap, waresMap, currentModules,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.CoupledIterative) {
      const aGroups = greedyFill(
        [{ label: '目标建材', rates: rates3 }],
        currentModules, settings, modulesMap, waresMap
      )
      let aFlat = aGroups.flatMap(g => g.modules)
      let aCombined = [...currentModules, ...aFlat]
      const aBuildRates = computeBuildRates(aFlat, modulesMap, waresMap)

      function filterBOutputs(input: Record<string, number>): Record<string, number> {
        const out: Record<string, number> = {}
        for (const [wareId, rate] of Object.entries(input)) {
          if (wareId === 'advancedcomposites' || wareId === 'plasmaconductors') out[wareId] = rate
        }
        return out
      }

      const bSources: BuildRateSource[] = [
        { label: 'A建材需求(B产出)', rates: filterBOutputs(aBuildRates.rates) },
        { label: 'C建材需求(B产出)', rates: filterBOutputs(rates3) },
      ]
      const bGroups = greedyFill(bSources, currentModules, settings, modulesMap, waresMap)
      const bFlat = bGroups.flatMap(g => g.modules)
      const bAutoFill = calculateAutoFillModules({
        plannedModules: mergeModules([...aCombined, ...bFlat]),
        settings, modulesMap, waresMap, lockedWares: []
      })
      const bAutoFillMods = mergeModules([...bAutoFill.autoIndustryModules, ...bAutoFill.autoHabitationModules])
      const bFullRates = computeBuildRates([...bFlat, ...bAutoFillMods], modulesMap, waresMap)
      const cPlusBRates: Record<string, number> = {}
      for (const [w, r] of Object.entries(rates3)) cPlusBRates[w] = r + (bFullRates.rates[w] || 0)

      if (aGroups.length > 0) {
        const aSelfDemand: Record<string, number> = {}
        for (const [w, r] of Object.entries(aBuildRates.rates)) {
          if (w === 'claytronics' || w === 'hullparts') aSelfDemand[w] = r
        }
        const aSources: BuildRateSource[] = [
          { label: 'C+B', rates: cPlusBRates },
          { label: 'A_autoFill', rates: aSelfDemand },
        ]
        const s1 = makeScheme(aGroups, 'A 建材自举',
          'A 建材自举模块',
          ['claytronics', 'hullparts'],
          settings, modulesMap, waresMap, currentModules,
          aSources)
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }
      if (bGroups.length > 0) {
        const s2 = makeScheme(bGroups, 'B 特种产线',
          'B 特种产线模块',
          ['advancedcomposites', 'plasmaconductors'],
          settings, modulesMap, waresMap,
          mergeModules(aCombined),
          bSources)
        if (s2.stepsCount > 0) allSchemes.push(s2)
      }
      const prior = mergeModules([...aCombined, ...bFlat, ...bAutoFillMods])
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
        '目标产线系列模块',
        uniquePurpose, settings, modulesMap, waresMap, prior,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.IsolatedSpecialized) {
      const aInitGroups = greedyFill(
        [{ label: '目标建材', rates: rates3 }],
        currentModules, settings, modulesMap, waresMap
      )
      const aInitFlat = aInitGroups.flatMap(g => g.modules)
      const aInitRates = computeBuildRates(aInitFlat, modulesMap, waresMap)
      const bDemand: Record<string, number> = {}
      for (const [wareId, rate] of Object.entries(aInitRates.rates)) {
        if (wareId === 'advancedcomposites' || wareId === 'plasmaconductors') {
          bDemand[wareId] = rate
        }
      }
      const bGroups = greedyFill(
        [{ label: 'B 特种建材', rates: bDemand }],
        currentModules, settings, modulesMap, waresMap
      )

      if (bGroups.length > 0) {
        const s1 = makeScheme(bGroups, 'B 特种孤岛',
          'B 特种孤岛模块',
          ['advancedcomposites', 'plasmaconductors'],
          settings, modulesMap, waresMap, currentModules,
          [{ label: 'B 特种建材', rates: bDemand }])
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }
      if (aInitGroups.length > 0) {
        const bCombined = [...currentModules, ...bGroups.flatMap(g => g.modules)]
        const aSelfDemand: Record<string, number> = {}
        for (const [w, r] of Object.entries(aInitRates.rates)) {
          if (w === 'claytronics' || w === 'hullparts') aSelfDemand[w] = r
        }
        const aSources: BuildRateSource[] = [
          { label: 'C', rates: rates3 },
          { label: 'A_autoFill', rates: aSelfDemand },
        ]
        const s2 = makeScheme(aInitGroups, 'A 建材自举',
          'A 建材自举模块',
          ['claytronics', 'hullparts'],
          settings, modulesMap, waresMap,
          mergeModules(bCombined),
          aSources)
        if (s2.stepsCount > 0) allSchemes.push(s2)
      }
      const prior = mergeModules([...currentModules, ...aInitFlat, ...bGroups.flatMap(g => g.modules)])
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
        '目标产线系列模块',
        uniquePurpose, settings, modulesMap, waresMap, prior,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.None) {
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], '目标产线',
        '目标产线系列模块',
        uniquePurpose, settings, modulesMap, waresMap, currentModules,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
    }
  }

  if (goals.length === 0 && bootstrapMode !== BootstrapMode.None) {
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
    const label = bootstrapMode === BootstrapMode.Joint ? 'A+B 联合自举'
      : bootstrapMode === BootstrapMode.CoupledIterative ? 'A 建材自举'
      : 'B 特种孤岛'
    const scheme = makeScheme(
      [{ reason: '自给自足产线', modules: allMods }],
      label,
      '建造基础材料产线，实现自给自足',
      ['claytronics', 'hullparts', 'plasmaconductors', 'advancedcomposites'],
      settings,
      modulesMap,
      waresMap,
      currentModules,
      [{ label: '自给自足', rates: computeBuildRates(allMods, modulesMap, waresMap).rates }]
    )
    if (scheme.stepsCount > 0) allSchemes.push(scheme)
  }

  return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
}
