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

const DEBUG_GREEDY = false

export function setGreedyDebug(enabled: boolean) { ;(globalThis as any).__GREEDY_DEBUG__ = enabled }
function isGreedyDebug() { return DEBUG_GREEDY || (globalThis as any).__GREEDY_DEBUG__ }

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
  materials: Record<string, number>
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
    const mt = mod.buildTime * m.count
    totalTime += mt
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
  return { rates, totalTime, totalCost, materials }
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

export function makeSchemeSteps(
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
  waresMap: Record<string, X4Ware>,
  fullBootstrap: boolean = true
): BuildGroup[] {
  let built: SavedModule[] = []
  let maxIterations = 60
  const groups: BuildGroup[] = []

  const targetRates: Record<string, number> = {}
  for (const src of targetRateSources) {
    for (const [wareId, rate] of Object.entries(src.rates)) {
      targetRates[wareId] = Math.max(targetRates[wareId] || 0, rate)
    }
  }

  const sourceWares = new Set<string>()
  for (const src of targetRateSources) {
    for (const w of Object.keys(src.rates)) sourceWares.add(w)
  }

  function addModule(modList: SavedModule[], modId: string, count: number) {
    const existing = modList.find(m => m.id === modId)
    if (existing) existing.count += count
    else modList.push({ id: modId, count })
  }

  function getAutoModules(mods: SavedModule[]): SavedModule[] {
    const r = calculateAutoFillModules({
      plannedModules: mergeModules([...currentEmpireModules, ...mods]),
      settings, modulesMap, waresMap, lockedWares: []
    })
    return [...r.autoIndustryModules, ...r.autoHabitationModules]
  }

  let currentAutoModules: SavedModule[] = []

  function fullBuilt(): SavedModule[] {
    return mergeModules([...currentEmpireModules, ...built, ...currentAutoModules])
  }

  function selfDemand(): BuildRateSource | null {
    const fb = fullBuilt()
    if (fb.length === 0) return null
    const br = computeBuildRates(fb, modulesMap, waresMap)
    const filtered: Record<string, number> = {}
    if (fullBootstrap) {
      const produced = new Set<string>()
      for (const m of fb) {
        const mod = modulesMap[m.id]
        if (!mod) continue
        for (const w of Object.keys(mod.outputs)) produced.add(w)
      }
      for (const [w, rate] of Object.entries(br.rates)) {
        if (w !== 'energycells' && produced.has(w)) filtered[w] = rate
      }
    } else {
      for (const [w, rate] of Object.entries(br.rates)) {
        if (w !== 'energycells' && sourceWares.has(w)) filtered[w] = rate
      }
    }
    return Object.keys(filtered).length > 0 ? { label: 'self_demand', rates: filtered } : null
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
    
    // Find ware with lowest satisfaction across ALL sources (targetRateSources + self_demand)
    let bestWare: string | null = null
    let worstSat = Infinity
    
    // Check all sources
    for (const src of [...targetRateSources, selfDemand()]) {
      if (!src) continue
      for (const [wareId, rate] of Object.entries(src.rates)) {
        if (wareId === 'energycells') continue
        if (rate <= 0) continue
        const prodRate = Math.max(0, contextNet[wareId] ?? 0)
        const satRate = prodRate / rate
        if (satRate < worstSat) {
          worstSat = satRate
          bestWare = wareId
        }
      }
    }
    
    return bestWare
  }

  while (maxIterations-- > 0) {
    currentAutoModules = getAutoModules(built)
    const combined = [...currentEmpireModules, ...fullBuilt()]
    // 不看 empire 现有产能，只看 built + autoFill 的产能
    const contextNet = calculateNetProduction(
      fullBuilt(),
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight
    )

    const allSources = [...targetRateSources]
    const sd = selfDemand()
    if (sd) allSources.push(sd)
    
    let allMet = true
    for (const src of allSources) {
      for (const [wareId, rate] of Object.entries(src.rates)) {
        if ((contextNet[wareId] || 0) + 0.001 < rate) allMet = false
      }
    }
    if (isGreedyDebug()) {
      const builtSummary = built.map(m => `${m.id}:${m.count}`).join(',')
      const autoSummary = currentAutoModules.map(m => `${m.id}:${m.count}`).join(',')
      console.log(`[OLD] iter ${built.length}: built=[${builtSummary}], auto=[${autoSummary}]`)
      console.log(`[OLD]   contextNet:`, JSON.stringify(Object.fromEntries(
        Object.entries(contextNet).filter(([,v]) => Math.abs(v as number) > 0.1)
      )))
      for (const src of allSources) {
        console.log(`[OLD]   ----- ${src.label} -----`)
        let srcMet = true
        for (const [w, rate] of Object.entries(src.rates)) {
          if (rate <= 0) continue
          const prod = contextNet[w] || 0
          const sat = rate > 0 ? (prod / rate * 100) : 0
          console.log(`[OLD]     ${w}: 需要=${rate.toFixed(0)}/h  产能=${prod.toFixed(0)}/h  满足=${sat.toFixed(0)}%`)
          if (prod + 0.001 < rate) srcMet = false
        }
        if (!srcMet) console.log(`[OLD]     -> NOT met`)
      }
      console.log(`[OLD]   allMet=${allMet}`)
    }
    if (allMet) break

    let bottleneck: string | null = null
    if (isGreedyDebug() && built.length === 0) {
      console.log('[OLD] built.length === 0, targetRates:', JSON.stringify(targetRates))
      console.log('[OLD] contextNet:', JSON.stringify(contextNet))
    }
    if (built.length === 0 && targetRates['hullparts'] !== undefined) {
      bottleneck = 'hullparts'
      if (isGreedyDebug()) console.log('[OLD] seed -> hullparts')
    } else {
      bottleneck = findLowestSatisfaction(contextNet)
    }
    if (!bottleneck) break
    if (isGreedyDebug()) console.log(`[OLD] iter ${built.length}: bottleneck=${bottleneck}`)

    const producer = findBestProducer(bottleneck, settings.racePreference, combined, modulesMap, waresMap)
    if (!producer) break

    if (bottleneck === 'energycells') continue

    const lastAutoModules = currentAutoModules
    addModule(built, producer.id, 1)

    const newAuto = getAutoModules(built)
    const deltaAuto = newAuto.filter(m => {
      const prev = lastAutoModules.find(p => p.id === m.id)
      return !prev || prev.count < m.count
    }).map(m => {
      const prev = lastAutoModules.find(p => p.id === m.id)
      return { id: m.id, count: m.count - (prev?.count || 0) }
    })
    currentAutoModules = newAuto

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
        currentModules, settings, modulesMap, waresMap,
        true
      )
      if (jointGroups.length > 0) {
        const jointFlat = jointGroups.flatMap(g => g.modules)
        const allRates = computeBuildRates(jointFlat, modulesMap, waresMap)
        const produced = new Set<string>()
        for (const m of jointFlat) {
          const mod = modulesMap[m.id]
          if (mod) for (const w of Object.keys(mod.outputs)) produced.add(w)
        }
        const finalSelf: Record<string, number> = {}
        for (const [w, r] of Object.entries(allRates.rates)) {
          if (w !== 'energycells' && produced.has(w)) finalSelf[w] = r
        }
        const purposeWares = Object.keys(rates3).filter(w => w !== 'energycells' && produced.has(w))
        const jointSources_display: BuildRateSource[] = [
          { label: 'C', rates: rates3 },
          { label: 'D_self_demand', rates: finalSelf },
        ]
        const s1 = makeScheme(jointGroups, 'scheme_joint',
          '',
          purposeWares,
          settings, modulesMap, waresMap, currentModules,
          jointSources_display)
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], 'scheme_production_line',
        '',
        uniquePurpose, settings, modulesMap, waresMap, currentModules,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.CoupledIterative) {
      const rC_raw = rates3
      const cBuildCostWares = new Set(Object.keys(rC_raw))
      const cPrime = allMods3.filter(m => {
        const mod = modulesMap[m.id]
        if (!mod) return true
        return !Object.keys(mod.outputs).some(w => cBuildCostWares.has(w))
      })
      const cPrimeRates = computeBuildRates(cPrime, modulesMap, waresMap)
      const wareList = new Set(Object.keys(cPrimeRates.materials))
      const rC: Record<string, number> = {}
      const rC_rest: Record<string, number> = {}
      for (const [w, r] of Object.entries(rC_raw)) {
        if (wareList.has(w)) rC[w] = r
        else rC_rest[w] = r
      }

      const aGroups = greedyFill(
        [{ label: 'C建材需求', rates: rC }],
        currentModules, settings, modulesMap, waresMap,
        false
      )
      let aFlat = mergeModules([...currentModules, ...aGroups.flatMap(g => g.modules)])
      let allAGroups = [...aGroups]

      const aBuildRates = computeBuildRates(aFlat, modulesMap, waresMap)
      const aPlusC: Record<string, number> = {}
      for (const [w, r] of Object.entries(aBuildRates.rates)) aPlusC[w] = (aPlusC[w] || 0) + r
      for (const [w, r] of Object.entries(rC)) aPlusC[w] = (aPlusC[w] || 0) + r

      const aProduced = new Set<string>()
      for (const m of aFlat) {
        const mod = modulesMap[m.id]
        if (mod) for (const w of Object.keys(mod.outputs)) aProduced.add(w)
      }

      function computeBPrimaryModules(aModules: SavedModule[]): SavedModule[] {
        const aRates = computeBuildRates(aModules, modulesMap, waresMap)
        const bDemand: Record<string, number> = {}
        for (const [w, r] of Object.entries(aRates.rates)) {
          if (w === 'energycells') continue
          if (aProduced.has(w)) continue
          bDemand[w] = Math.max(bDemand[w] || 0, r)
        }
        for (const [w, r] of Object.entries(rC_rest)) {
          if (w === 'energycells') continue
          bDemand[w] = Math.max(bDemand[w] || 0, r)
        }
        const bResult: SavedModule[] = []
        for (const [wareId, demand] of Object.entries(bDemand)) {
          if (demand <= 0) continue
          const producer = findBestProducer(wareId, settings.racePreference, [...currentModules, ...aModules], modulesMap, waresMap)
          if (!producer) continue
          const outputRate = producer.outputs[wareId] || 0
          if (outputRate <= 0) continue
          const count = Math.ceil(demand / outputRate)
          const existing = bResult.find(m => m.id === producer.id)
          if (existing) existing.count = Math.max(existing.count, count)
          else bResult.push({ id: producer.id, count })
        }
        return bResult
      }

      let bPrimaryModules = computeBPrimaryModules(aFlat)

      for (let iter = 0; iter < 10; iter++) {
        const bAutoFill = calculateAutoFillModules({
          plannedModules: mergeModules([...currentModules, ...aFlat, ...bPrimaryModules]),
          settings, modulesMap, waresMap, lockedWares: []
        })
        const bModules = mergeModules([...bPrimaryModules, ...bAutoFill.autoIndustryModules, ...bAutoFill.autoHabitationModules])
        const bRates = computeBuildRates(bModules, modulesMap, waresMap)
        const bRatesFiltered: Record<string, number> = {}
        for (const [w, r] of Object.entries(bRates.rates)) {
          if (w !== 'energycells' && wareList.has(w)) bRatesFiltered[w] = r
        }

        // Check if aFlat already satisfies C + B demand
        const aAutoFill = calculateAutoFillModules({
          plannedModules: mergeModules([...currentModules, ...aFlat]),
          settings, modulesMap, waresMap, lockedWares: []
        })
        const aWithAuto = mergeModules([...aFlat, ...aAutoFill.autoIndustryModules, ...aAutoFill.autoHabitationModules])
        const aNet = calculateNetProduction(aWithAuto, modulesMap, false, settings.sunlight)
        let alreadySatisfied = true
        for (const [w, rate] of Object.entries(rC)) {
          if (w === 'energycells' || rate <= 0) continue
          if ((aNet[w] || 0) + 0.001 < rate) { alreadySatisfied = false; break }
        }
        if (alreadySatisfied) {
          for (const [w, rate] of Object.entries(bRatesFiltered)) {
            if (w === 'energycells' || rate <= 0) continue
            if ((aNet[w] || 0) + 0.001 < rate) { alreadySatisfied = false; break }
          }
        }

        if (isGreedyDebug()) {
          console.log(`[OLD] COUPLED iter ${iter}: aFlat=[${aFlat.map(m => `${m.id}:${m.count}`).join(',')}], alreadySatisfied=${alreadySatisfied}`)
          console.log(`[OLD]   rC rates:`, rC)
          console.log(`[OLD]   bRatesFiltered:`, bRatesFiltered)
          console.log(`[OLD]   aNet (key wares): hullparts=${(aNet['hullparts']||0).toFixed(0)}, claytronics=${(aNet['claytronics']||0).toFixed(0)}`)
        }

        if (!alreadySatisfied) {
          const aDelta = greedyFill(
            [
              { label: 'C建材需求', rates: rC },
              { label: 'B建材需求', rates: bRatesFiltered },
            ],
            aFlat, settings, modulesMap, waresMap,
            false
          )
          aFlat = mergeModules([...aFlat, ...aDelta.flatMap(g => g.modules)])
          allAGroups = [...allAGroups, ...aDelta]
        } else {
          break
        }

        const prevBPrimaryModules = bPrimaryModules
        bPrimaryModules = computeBPrimaryModules(aFlat)

        let bChanged = false
        if (bPrimaryModules.length !== prevBPrimaryModules.length) {
          bChanged = true
        } else {
          for (const m of bPrimaryModules) {
            const prev = prevBPrimaryModules.find(p => p.id === m.id)
            if (!prev || prev.count !== m.count) { bChanged = true; break }
          }
        }
        if (!bChanged) break
      }

      const bAutoFill = calculateAutoFillModules({
        plannedModules: mergeModules([...currentModules, ...aFlat, ...bPrimaryModules]),
        settings, modulesMap, waresMap, lockedWares: []
      })
      const bModules = mergeModules([...bPrimaryModules, ...bAutoFill.autoIndustryModules, ...bAutoFill.autoHabitationModules])
      const bRates = computeBuildRates(bModules, modulesMap, waresMap)

      const aPurposeWares = Object.keys(rC).filter(w => w !== 'energycells')

      if (aFlat.length > 0) {
        const aRates = computeBuildRates(aFlat, modulesMap, waresMap)
        const aSelfDemand = Object.fromEntries(
          Object.entries(aRates.rates).filter(([w]) => w !== 'energycells' && wareList.has(w))
        )
        const aSelfDemandMaterials: Record<string, number> = {}
        for (const [w, qty] of Object.entries(aRates.materials)) {
          if (w !== 'energycells' && wareList.has(w)) aSelfDemandMaterials[w] = qty
        }
        const cMaterials: Record<string, number> = {}
        for (const [w, qty] of Object.entries(cPrimeRates.materials)) {
          if (w !== 'energycells') cMaterials[w] = qty
        }
        const bMaterials: Record<string, number> = {}
        for (const [w, qty] of Object.entries(bRates.materials)) {
          if (w !== 'energycells' && wareList.has(w)) bMaterials[w] = qty
        }
        const bRatesFiltered: Record<string, number> = {}
        for (const [w, r] of Object.entries(bRates.rates)) {
          if (w !== 'energycells' && wareList.has(w)) bRatesFiltered[w] = r
        }
        const aSources: BuildRateSource[] = [
          { label: 'C建材需求', rates: rC, materials: cMaterials },
          { label: 'B建材需求', rates: bRatesFiltered, materials: bMaterials },
          { label: 'A_self_demand', rates: aSelfDemand, materials: aSelfDemandMaterials },
        ]
        const s1 = makeScheme(allAGroups, 'scheme_materials',
          '',
          aPurposeWares,
          settings, modulesMap, waresMap, currentModules,
          aSources)
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }

      if (bModules.length > 0) {
        const aRates = computeBuildRates(aFlat, modulesMap, waresMap)
        const aFinalProduced = new Set<string>()
        for (const m of aFlat) {
          const mod = modulesMap[m.id]
          if (mod) for (const w of Object.keys(mod.outputs)) aFinalProduced.add(w)
        }
        const aCantSelfProduce: Record<string, number> = {}
        const aCantSelfProduceMaterials: Record<string, number> = {}
        for (const [w, r] of Object.entries(aRates.rates)) {
          if (w !== 'energycells' && !aFinalProduced.has(w)) aCantSelfProduce[w] = r
        }
        for (const [w, qty] of Object.entries(aRates.materials)) {
          if (w !== 'energycells' && !aFinalProduced.has(w)) aCantSelfProduceMaterials[w] = qty
        }
        const cRestMaterials: Record<string, number> = {}
        const allMods3Rates = computeBuildRates(allMods3, modulesMap, waresMap)
        for (const [w, qty] of Object.entries(allMods3Rates.materials)) {
          if (w !== 'energycells' && !wareList.has(w)) cRestMaterials[w] = qty
        }
        const bSources: BuildRateSource[] = [
          { label: 'A不能自产', rates: aCantSelfProduce, materials: aCantSelfProduceMaterials },
          { label: 'C_rest', rates: rC_rest, materials: cRestMaterials },
        ]
        const bPurposeWares = [...new Set(bPrimaryModules.flatMap(m => {
          const mod = modulesMap[m.id]
          if (!mod) return []
          return Object.keys(mod.outputs).filter(w => w !== 'energycells')
        }))]
        const s2 = makeScheme([{ reason: 'scheme_specialized', modules: bModules }], 'scheme_specialized',
          '',
          bPurposeWares,
          settings, modulesMap, waresMap,
          mergeModules(aFlat),
          bSources)
        if (s2.stepsCount > 0) allSchemes.push(s2)
      }

      const prior = mergeModules([...aFlat, ...bModules])
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], 'scheme_production_line',
        '',
        uniquePurpose, settings, modulesMap, waresMap, prior,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.NestedJoint) {
      const rC_raw = rates3
      const cBuildCostWares = new Set(Object.keys(rC_raw))
      const cPrime = allMods3.filter(m => {
        const mod = modulesMap[m.id]
        if (!mod) return true
        return !Object.keys(mod.outputs).some(w => cBuildCostWares.has(w))
      })
      const cPrimeRates = computeBuildRates(cPrime, modulesMap, waresMap)
      const wareList = new Set(Object.keys(cPrimeRates.materials))
      const rC: Record<string, number> = {}
      const rC_rest: Record<string, number> = {}
      for (const [w, r] of Object.entries(rC_raw)) {
        if (wareList.has(w)) rC[w] = r
        else rC_rest[w] = r
      }

      // A 一次性计算
      const aPrimaryModules: SavedModule[] = []
      for (const [wareId, demand] of Object.entries(rC)) {
        if (demand <= 0 || wareId === 'energycells') continue
        const producer = findBestProducer(wareId, settings.racePreference, currentModules, modulesMap, waresMap)
        if (!producer) continue
        const outputRate = producer.outputs[wareId] || 0
        if (outputRate <= 0) continue
        const count = Math.ceil(demand / outputRate)
        const existing = aPrimaryModules.find(m => m.id === producer.id)
        if (existing) existing.count = Math.max(existing.count, count)
        else aPrimaryModules.push({ id: producer.id, count })
      }

      // A autoFill
      const aAutoFill = calculateAutoFillModules({
        plannedModules: mergeModules([...currentModules, ...aPrimaryModules]),
        settings, modulesMap, waresMap, lockedWares: []
      })
      const aModules = mergeModules([...aPrimaryModules, ...aAutoFill.autoIndustryModules, ...aAutoFill.autoHabitationModules])
      const aRates = computeBuildRates(aModules, modulesMap, waresMap)

      // D greedyFill(fullBootstrap=true) 从空开始，sources = A buildCost + R_C_rest
      const dGroups = greedyFill(
        [
          { label: 'A建材需求', rates: aRates.rates },
          { label: 'C_rest建材需求', rates: rC_rest },
        ],
        currentModules, settings, modulesMap, waresMap,
        true
      )
const dModules = dGroups.flatMap(g => g.modules)

      // D scheme
      const dPurposeWares = [...new Set([...Object.keys(rC), ...Object.keys(rC_rest)].filter(w => w !== 'energycells'))]
      const dRates = computeBuildRates(dModules, modulesMap, waresMap)
      const dSelfDemand: Record<string, number> = {}
      const dProduced = new Set<string>()
      for (const m of dModules) {
        const mod = modulesMap[m.id]
        if (mod) for (const w of Object.keys(mod.outputs)) dProduced.add(w)
      }
      for (const [w, r] of Object.entries(dRates.rates)) {
        if (w !== 'energycells' && dProduced.has(w)) dSelfDemand[w] = r
      }
      const aMaterials: Record<string, number> = {}
      for (const [w, qty] of Object.entries(aRates.materials)) {
        if (w !== 'energycells') aMaterials[w] = qty
      }
      const cRestMaterials: Record<string, number> = {}
      const allMods3Rates = computeBuildRates(allMods3, modulesMap, waresMap)
      for (const [w, qty] of Object.entries(allMods3Rates.materials)) {
        if (w !== 'energycells' && !wareList.has(w)) cRestMaterials[w] = qty
      }
      const dSources: BuildRateSource[] = [
        { label: 'A建材需求', rates: aRates.rates, materials: aMaterials },
        { label: 'C_rest建材需求', rates: rC_rest, materials: cRestMaterials },
        { label: 'D_self_demand', rates: dSelfDemand, materials: dRates.materials },
      ]
      const s1 = makeScheme(dGroups, 'scheme_joint',
        '',
        dPurposeWares,
        settings, modulesMap, waresMap, currentModules,
        dSources)
      if (s1.stepsCount > 0) allSchemes.push(s1)

      // A scheme (从 D 提取)
      if (aModules.length > 0) {
const aPurposeWares = Object.keys(rC).filter(w => w !== 'energycells')
      const aRates = computeBuildRates(aModules, modulesMap, waresMap)
      const aSelfDemandMaterials: Record<string, number> = {}
      for (const [w, qty] of Object.entries(aRates.materials)) {
        if (w !== 'energycells' && wareList.has(w)) aSelfDemandMaterials[w] = qty
      }
      const cPrimeMaterials: Record<string, number> = {}
      for (const [w, qty] of Object.entries(cPrimeRates.materials)) {
        if (w !== 'energycells' && wareList.has(w)) cPrimeMaterials[w] = qty
      }
      const aSources: BuildRateSource[] = [
        { label: 'C建材需求', rates: rC, materials: cPrimeMaterials },
      ]
        const s2 = makeScheme([{ reason: 'scheme_basic_materials', modules: aModules }], 'scheme_basic_materials',
          '',
          aPurposeWares,
          settings, modulesMap, waresMap, currentModules,
          aSources)
        if (s2.stepsCount > 0) allSchemes.push(s2)
      }

      // C scheme
      const prior = mergeModules(dModules)
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], 'scheme_production_line',
        '',
        uniquePurpose, settings, modulesMap, waresMap, prior,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.IsolatedSpecialized) {
      const rC_raw = rates3
      const cBuildCostWares = new Set(Object.keys(rC_raw))
      const cPrime = allMods3.filter(m => {
        const mod = modulesMap[m.id]
        if (!mod) return true
        return !Object.keys(mod.outputs).some(w => cBuildCostWares.has(w))
      })
      const cPrimeRates = computeBuildRates(cPrime, modulesMap, waresMap)
      const wareList = new Set(Object.keys(cPrimeRates.materials))
      const rC: Record<string, number> = {}
      const rC_rest: Record<string, number> = {}
      for (const [w, r] of Object.entries(rC_raw)) {
        if (wareList.has(w)) rC[w] = r
        else rC_rest[w] = r
      }

      const aGroups = greedyFill(
        [{ label: 'C建材需求', rates: rC }],
        currentModules, settings, modulesMap, waresMap,
        false
      )
      const aFlat = mergeModules([...currentModules, ...aGroups.flatMap(g => g.modules)])

      const aProduced = new Set<string>()
      for (const m of aFlat) {
        const mod = modulesMap[m.id]
        if (mod) for (const w of Object.keys(mod.outputs)) aProduced.add(w)
      }
      const aRates = computeBuildRates(aFlat, modulesMap, waresMap)
      const aCantSelfProduce: Record<string, number> = {}
      for (const [w, r] of Object.entries(aRates.rates)) {
        if (w !== 'energycells' && !aProduced.has(w)) aCantSelfProduce[w] = r
      }

      const bDemandSources: BuildRateSource[] = [
        { label: 'R_C_rest', rates: rC_rest },
        { label: 'A_不能自产', rates: aCantSelfProduce },
      ]
      const bGroups = greedyFill(
        bDemandSources,
        currentModules, settings, modulesMap, waresMap,
        false
      )
      const bModules = bGroups.flatMap(g => g.modules)

      if (bModules.length > 0) {
        const bPurposeWares = [...new Set(bDemandSources.flatMap(s => Object.keys(s.rates)))].filter(w => w !== 'energycells')
        const s1 = makeScheme(bGroups, 'scheme_isolated',
          '',
          bPurposeWares,
          settings, modulesMap, waresMap, currentModules,
          bDemandSources)
        if (s1.stepsCount > 0) allSchemes.push(s1)
      }
      if (aFlat.length > 0) {
        const aSources: BuildRateSource[] = [
          { label: 'C', rates: rC },
          { label: 'A_self_demand', rates: Object.fromEntries(
            Object.entries(aRates.rates).filter(([w]) => w !== 'energycells' && wareList.has(w))
          ) },
        ]
        const aPurposeWares = Object.keys(rC).filter(w => w !== 'energycells')
        const bCombined = [...currentModules, ...bModules]
        const s2 = makeScheme(aGroups, 'scheme_materials',
          '',
          aPurposeWares,
          settings, modulesMap, waresMap,
          mergeModules(bCombined),
          aSources)
        if (s2.stepsCount > 0) allSchemes.push(s2)
      }
      const prior = mergeModules([...currentModules, ...aFlat, ...bModules])
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], 'scheme_production_line',
        '',
        uniquePurpose, settings, modulesMap, waresMap, prior,
        [])
      if (s3.stepsCount > 0) allSchemes.push(s3)
      return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
    }

    if (bootstrapMode === BootstrapMode.None) {
      const s3 = makeScheme([{ reason: '', modules: allMods3 }], 'scheme_production_line',
        '',
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
    const label = bootstrapMode === BootstrapMode.Joint ? 'D 联合自举'
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
      [{ label: 'scheme_self_sufficient', rates: computeBuildRates(allMods, modulesMap, waresMap).rates }]
    )
    if (scheme.stepsCount > 0) allSchemes.push(scheme)
  }

  return planResult(goals, selfSufficient, bootstrapMode, allSchemes)
}
