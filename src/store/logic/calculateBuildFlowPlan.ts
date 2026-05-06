import type {
  BuildFlowPlanGraph,
  BuildFlowPlanLine,
  BuildRateSource,
  BuildScheme,
  BuildSchemeGroup,
  BuildGroup,
  BuildGoal,
  BuildSchemeStep,
  BuildMaterial,
  ProductionLineAllocation,
} from '@/types/build-plan'
import type {
  X4Module,
  X4Ware,
  SavedModule,
  StationSettings,
} from '@/types/x4'
import { findBestProducer } from './bestModuleSelector'
import { calculateAutoFillModules } from './calculateProductionFlows'

const DEBUG_GREEDY = false

function isGreedyDebug() { return DEBUG_GREEDY || (globalThis as any).__GREEDY_DEBUG__ }

export function mergeModules(modules: SavedModule[]): SavedModule[] {
  const map = new Map<string, number>()
  for (const m of modules) {
    map.set(m.id, (map.get(m.id) || 0) + m.count)
  }
  return Array.from(map.entries()).map(([id, count]) => ({ id, count }))
}

/** Unified autoFill wrapper — derives lockedWares from required-production goals */
export function autoFillForLine(
  plannedModules: SavedModule[],
  goals: BuildGoal[],
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
): { autoIndustryModules: SavedModule[]; autoHabitationModules: SavedModule[] } {
  const lockedWares: string[] = []
  for (const g of goals) {
    if (g.type === 'required-production') lockedWares.push(g.wareId)
  }
  return calculateAutoFillModules({
    plannedModules,
    settings,
    modulesMap,
    waresMap,
    lockedWares,
  })
}

export function computeSourceSatisfaction(
  targetRate: number,
  prodRate: number,
): { satisfied: boolean; satRate: number } {
  const satisfied = prodRate + 0.001 >= targetRate
  const satRate = targetRate > 0 ? Math.min(prodRate / targetRate * 100, 999) : 999
  return { satisfied, satRate }
}

export interface SourceSatisfaction {
  label: string
  rate: number
  satisfaction: { satisfied: boolean; satRate: number }
}

export interface WareSatisfaction {
  wareId: string
  sources: SourceSatisfaction[]
  totalProd: number
}

export function computeWareSatisfactions(
  scheme: BuildScheme,
  netProduction: Record<string, number>,
  gap: Record<string, number>,
  manualWares: Record<string, number>,
  manualModules: Record<string, number>,
): WareSatisfaction[] {
  const results: WareSatisfaction[] = []
  for (const [wareId, prodRate] of Object.entries(netProduction)) {
    if (prodRate <= 0.01) continue
    if (!scheme.targetRates?.[wareId] && !gap[wareId] && !manualWares[wareId] && !manualModules[wareId]) continue

    const sources: SourceSatisfaction[] = []
    for (const src of scheme.targetRateSources || []) {
      const r = src.rates[wareId]
      if (r && r > 0) {
        sources.push({ label: src.label, rate: r, satisfaction: computeSourceSatisfaction(r, prodRate) })
      }
    }
    if ((gap[wareId] || 0) > 0) {
      sources.push({ label: 'gap', rate: gap[wareId] || 0, satisfaction: computeSourceSatisfaction(gap[wareId] || 0, prodRate) })
    }
    if ((manualWares[wareId] || 0) > 0) {
      sources.push({ label: 'manual_ware', rate: manualWares[wareId] || 0, satisfaction: computeSourceSatisfaction(manualWares[wareId] || 0, prodRate) })
    }
    if ((manualModules[wareId] || 0) > 0) {
      sources.push({ label: 'manual_module', rate: manualModules[wareId] || 0, satisfaction: computeSourceSatisfaction(manualModules[wareId] || 0, prodRate) })
    }

    results.push({ wareId, sources, totalProd: prodRate })
  }
  return results
}

function computeBuildRates(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>
): Record<string, number> {
  const materials: Record<string, number> = {}
  let totalTime = 0
  for (const m of modules) {
    const mod = modulesMap[m.id]
    if (!mod) continue
    totalTime += mod.buildTime * m.count
    const cost = mod.buildCost as Record<string, number> | undefined
    if (!cost || Object.keys(cost).length === 0) continue
    for (const [wareId, qty] of Object.entries(cost)) {
      if (wareId === 'energycells') continue
      materials[wareId] = (materials[wareId] || 0) + qty * m.count
    }
  }
  const rates: Record<string, number> = {}
  for (const [wareId, qty] of Object.entries(materials)) {
    rates[wareId] = totalTime > 0 ? qty / (totalTime / 3600) : 0
  }
  return rates
}

function computeBuildMaterials(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const m of modules) {
    const mod = modulesMap[m.id]
    if (!mod?.buildCost) continue
    for (const [wareId, qty] of Object.entries(mod.buildCost)) {
      if (wareId === 'energycells') continue
      result[wareId] = (result[wareId] || 0) + qty * m.count
    }
  }
  return result
}

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
    const eff = bonus ? 1.3 : 1.0
    for (const [ware, val] of Object.entries(mod.outputs)) {
      let sf = 1.0
      if (ware === 'energycells') sf = sunlight / 100.0
      state[ware] = (state[ware] || 0) + item.count * (val as number) * eff * sf
    }
    for (const [ware, val] of Object.entries(mod.inputs)) {
      state[ware] = (state[ware] || 0) - item.count * (val as number)
    }
  }
  return state
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
    case 'derived-rate':
    case 'derived-production':
    case 'derived-build-material': {
      expandWareUpstream(goal.wareId, goal.ratePerHour, new Set())
      break
    }
  }

  return Object.entries(required).map(([id, count]) => ({ id, count }))
}

function computeModuleBuildDetails(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
): { moduleId: string; count: number; buildTime: number; materials: Record<string, number> }[] {
  return modules.map(m => {
    const mod = modulesMap[m.id]
    const buildTime = mod?.buildTime || 0
    const materials: Record<string, number> = {}
    if (mod?.buildCost) {
      for (const [w, qty] of Object.entries(mod.buildCost)) {
        if (w !== 'energycells') materials[w] = (qty as number) * m.count
      }
    }
    return { moduleId: m.id, count: m.count, buildTime, materials }
  })
}

function planProductionForRates(
  demandSources: BuildRateSource[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  race: string,
  gap: Record<string, number> = {},
  trackedWares?: Set<string>,
): SavedModule[] {
  const totalQty: Record<string, number> = {}
  let totalSeconds = 0

  for (const src of demandSources) {
    const materials = src.materials
    if (!materials) continue
    let srcSeconds = 0
    for (const [w, rate] of Object.entries(src.rates)) {
      if (rate > 0 && materials[w]) { srcSeconds = (materials[w] / rate) * 3600; break }
    }
    if (srcSeconds === 0) continue
    totalSeconds += srcSeconds
    for (const [w, qty] of Object.entries(materials)) {
      if (w !== 'energycells') totalQty[w] = (totalQty[w] || 0) + qty
    }
  }

  const totalHours = totalSeconds / 3600
  const targetRates: Record<string, number> = {}
  if (totalHours > 0) {
    for (const [w, qty] of Object.entries(totalQty)) {
      targetRates[w] = qty / totalHours
    }
  }
  for (const [w, r] of Object.entries(gap)) {
    if (r > 0) targetRates[w] = (targetRates[w] || 0) + r
  }

  const produced = new Map<string, number>()
  const modules: SavedModule[] = []

  for (const [wareId, targetRate] of Object.entries(targetRates)) {
    if (targetRate <= 0) continue
    if (trackedWares && !trackedWares.has(wareId)) continue
    const producer = findBestProducer(wareId, race, [], modulesMap, waresMap)
    if (!producer) continue

    const outputPerModule = (producer.outputs[wareId] || 0) as number
    if (outputPerModule <= 0) continue

    const currentRate = produced.get(wareId) || 0
    const remaining = targetRate - currentRate
    if (remaining <= 0) continue

    const count = Math.ceil(remaining / outputPerModule)
    modules.push({ id: producer.id, count })
    produced.set(wareId, currentRate + count * outputPerModule)
  }

  return mergeModules(modules)
}

// @ts-ignore — kept for future use (alternative SCC multi-node algorithm)
function greedyFillForLine(
  externalSources: BuildRateSource[],
  currentEmpireModules: SavedModule[],
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  _gap2: Record<string, number> = {},
  lockedWares: string[] = [],
  requiredWares: Set<string> = new Set(),
  trackedWares: Set<string> = new Set(),
): BuildGroup[] {
  const built: SavedModule[] = []
  const groups: BuildGroup[] = []
  let maxIterations = 60
  const lockedSet = new Set(lockedWares)

  function getAutoModules(mods: SavedModule[]): SavedModule[] {
    const full = mergeModules([...currentEmpireModules, ...mods])
    const r = calculateAutoFillModules({
      plannedModules: full,
      settings,
      modulesMap,
      waresMap,
      lockedWares,
    })
    return [...r.autoIndustryModules, ...r.autoHabitationModules]
  }

  let currentAutoModules: SavedModule[] = []

  function fullBuilt(): SavedModule[] {
    return mergeModules([...built, ...currentAutoModules])
  }

  function contextNet(): Record<string, number> {
    return calculateNetProduction(
      mergeModules([...currentEmpireModules, ...built, ...currentAutoModules]),
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight
    )
  }

  function selfDemand(): BuildRateSource | null {
    const fb = fullBuilt()
    if (fb.length === 0) return null
    const br = computeBuildRates(fb, modulesMap)
    const filtered: Record<string, number> = {}
    // Dynamically compute: wares that fullBuilt produces AND consumes (same as old algorithm)
    const produced = new Set<string>()
    for (const m of fb) {
      const mod = modulesMap[m.id]
      if (!mod) continue
      for (const w of Object.keys(mod.outputs)) produced.add(w)
    }
    for (const [w, rate] of Object.entries(br)) {
      if (w !== 'energycells' && produced.has(w) && !requiredWares.has(w) && trackedWares.has(w)) filtered[w] = rate
    }
    // Remove wares already covered by external demand (avoid double-counting)
    for (const src of externalSources) {
      for (const [w] of Object.entries(src.rates)) {
        if (filtered[w] !== undefined && !requiredWares.has(w)) {
          delete filtered[w]
        }
      }
    }
    return Object.keys(filtered).length > 0 ? { label: 'self_demand', rates: filtered } : null
  }

  // Collect all source wares for rate tracking
  const sourceRates: Record<string, number> = {}
  for (const src of externalSources) {
    for (const [w, r] of Object.entries(src.rates)) {
      sourceRates[w] = Math.max(sourceRates[w] || 0, r)
    }
  }

  // Add gap rates additively to external source rates
  for (const [w, r] of Object.entries(_gap2)) {
    if (r > 0) sourceRates[w] = (sourceRates[w] || 0) + r
  }


  // Identify wares with build material demand (non-zero in external sources)
  const hasExternalDemand = new Set<string>()
  for (const src of externalSources) {
    for (const [w, r] of Object.entries(src.rates)) {
      if (r > 0) hasExternalDemand.add(w)
    }
  }

  while (true) {
    currentAutoModules = getAutoModules(built)
    const net = contextNet()

    const allSources = [...externalSources]
    const sd = selfDemand()
    if (sd) allSources.push(sd)
    // Add gap as separate demand source (not merged into first — swallowed by Math.max)
    const gapRates: Record<string, number> = {}
    for (const [w, r] of Object.entries(_gap2)) {
      if (r > 0 && trackedWares.has(w)) gapRates[w] = r
    }
    if (Object.keys(gapRates).length > 0) {
      allSources.push({ label: 'gap_demand', rates: gapRates })
    }

    let allMet = true
    for (const src of allSources) {
      for (const [wareId, rate] of Object.entries(src.rates)) {
        if (rate <= 0) continue
        const prodRate = Math.max(0, net[wareId] ?? 0)
        if (prodRate + 0.001 < rate) { allMet = false; break }
      }
      if (!allMet) break
    }
    if (allMet) break
    if (allMet) break

    let worstSat = Infinity
    let bottleneckWare: string | null = null

    if (isGreedyDebug() && built.length === 0) {
      console.log('[NEW] built.length === 0, externalSources:', JSON.stringify(externalSources.map(s => ({ label: s.label, rates: s.rates }))))
    }
    if (built.length === 0) {
      // Empty built: pick ware with highest unsatisfied external rate (like old algorithm)
      let highest = 0
      for (const src of externalSources) {
        for (const [wareId, rate] of Object.entries(src.rates)) {
          if (wareId === 'energycells' || rate <= 0) continue
          if (lockedSet.has(wareId)) continue
          const prodRate = Math.max(0, net[wareId] ?? 0)
          if (prodRate < rate && rate > highest) {
            highest = rate
            bottleneckWare = wareId
          }
        }
      }
      if (isGreedyDebug()) console.log(`[NEW] built=0 bottleneck: ${bottleneckWare} (highest rate: ${highest})`)
    } else {
      // Phase 1: bottleneck among external-demand wares (建材>0)
      for (const src of allSources) {
        for (const [wareId, rate] of Object.entries(src.rates)) {
          if (wareId === 'energycells' || rate <= 0) continue
          if (!hasExternalDemand.has(wareId)) continue
          if (lockedSet.has(wareId)) continue
          const prodRate = Math.max(0, net[wareId] ?? 0)
          const satRate = prodRate / rate
          if (satRate < worstSat) {
            worstSat = satRate
            bottleneckWare = wareId
          }
        }
      }
      // Phase 2: if all external-demand wares satisfied, try zero-build wares
      if (!bottleneckWare) {
        for (const src of allSources) {
          for (const [wareId, rate] of Object.entries(src.rates)) {
            if (wareId === 'energycells' || rate <= 0) continue
            if (hasExternalDemand.has(wareId)) continue
            if (lockedSet.has(wareId)) continue
            const prodRate = Math.max(0, net[wareId] ?? 0)
            if (prodRate + 0.001 < rate) {
              bottleneckWare = wareId
              break
            }
          }
          if (bottleneckWare) break
        }
      }
    }

    if (!bottleneckWare) break

    const combined = mergeModules([...currentEmpireModules, ...built, ...currentAutoModules])
    const producer = findBestProducer(bottleneckWare, settings.racePreference, combined, modulesMap, waresMap)
    if (!producer) break

    // Add one producer
    const lastAutoModules = currentAutoModules
    const existing = built.find(m => m.id === producer.id)
    if (existing) existing.count += 1
    else built.push({ id: producer.id, count: 1 })

    // Compute deltaAuto
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
    groups.push({ reason: `Build mat: ${bottleneckWare}`, modules: groupMods })

    if (maxIterations-- <= 0) break
  }

  return groups
}

export function bootstrapFillForLine(
  externalSources: BuildRateSource[],
  currentEmpireModules: SavedModule[],
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  gap: Record<string, number> = {},
  lockedWares: string[] = [],
  requiredWares: Set<string> = new Set(),
  trackedWares: Set<string> = new Set(),
): BuildGroup[] {
  const built: SavedModule[] = []
  const groups: BuildGroup[] = []
  const lockedSet = new Set(lockedWares)

  function getAutoModules(mods: SavedModule[]): SavedModule[] {
    const full = mergeModules([...currentEmpireModules, ...mods])
    const r = calculateAutoFillModules({ plannedModules: full, settings, modulesMap, waresMap, lockedWares })
    return [...r.autoIndustryModules, ...r.autoHabitationModules]
  }

  let currentAutoModules: SavedModule[] = []

  function fullBuilt(): SavedModule[] {
    return mergeModules([...built, ...currentAutoModules])
  }

  function netProduction(): Record<string, number> {
    return calculateNetProduction(fullBuilt(), modulesMap, settings.considerWorkforceForAutoFill, settings.sunlight)
  }

  function selfDemandRates(): Record<string, number> {
    const fb = fullBuilt()
    if (fb.length === 0) return {}
    const br = computeBuildRates(fb, modulesMap)
    const produced = new Set<string>()
    for (const m of fb) {
      const mod = modulesMap[m.id]
      if (!mod) continue
      for (const w of Object.keys(mod.outputs)) produced.add(w)
    }
    const result: Record<string, number> = {}
    for (const [w, rate] of Object.entries(br)) {
      if (w !== 'energycells' && produced.has(w) && !requiredWares.has(w) && trackedWares.has(w)) result[w] = rate
    }
    for (const src of externalSources) {
      for (const [w] of Object.entries(src.rates)) delete result[w]
    }
    return result
  }

  function computeTargetRates(): Record<string, number> {
    const totalQty: Record<string, number> = {}
    let totalSeconds = 0

    for (const src of externalSources) {
      const materials = src.materials
      if (!materials) continue
      let srcSeconds = 0
      for (const [w, rate] of Object.entries(src.rates)) {
        if (rate > 0 && materials[w]) { srcSeconds = (materials[w] / rate) * 3600; break }
      }
      if (srcSeconds === 0) continue
      totalSeconds += srcSeconds
      for (const [w, qty] of Object.entries(materials)) {
        if (w !== 'energycells') totalQty[w] = (totalQty[w] || 0) + qty
      }
    }

    const fb = fullBuilt()
    if (fb.length > 0) {
      const sd = selfDemandRates()
      if (Object.keys(sd).length > 0) {
        const selfMat = computeBuildMaterials(fb, modulesMap)
        let selfSec = 0
        for (const [w, rate] of Object.entries(sd)) {
          if (rate > 0 && selfMat[w]) { selfSec = (selfMat[w] / rate) * 3600; break }
        }
        if (selfSec > 0) {
          totalSeconds += selfSec
          for (const [w, qty] of Object.entries(selfMat)) {
            if (w !== 'energycells') totalQty[w] = (totalQty[w] || 0) + qty
          }
        }
      }
    }

    const totalHours = totalSeconds / 3600
    const result: Record<string, number> = {}
    if (totalHours > 0) {
      for (const [w, qty] of Object.entries(totalQty)) {
        result[w] = qty / totalHours
      }
    }
    for (const [w, r] of Object.entries(gap)) {
      if (r > 0) result[w] = (result[w] || 0) + r
    }
    return result
  }

  let maxIterations = 10

  while (maxIterations-- > 0) {
    const snapshot = fullBuilt().map(m => `${m.id}:${m.count}`).sort().join(';')

    currentAutoModules = getAutoModules(built)
    const targetRates = computeTargetRates()
    const net = netProduction()
    const newModules: SavedModule[] = []
    const produced = new Map<string, number>()

    for (const [wareId, targetRate] of Object.entries(targetRates)) {
      if (targetRate <= 0 || wareId === 'energycells' || lockedSet.has(wareId)) continue
      if (!trackedWares.has(wareId)) continue

      const combined = mergeModules([...currentEmpireModules, ...built, ...currentAutoModules])
      const producer = findBestProducer(wareId, settings.racePreference, combined, modulesMap, waresMap)
      if (!producer) continue

      const outputPerModule = (producer.outputs[wareId] || 0) as number
      if (outputPerModule <= 0) continue

      const currentProd = Math.max(0, net[wareId] ?? 0) + (produced.get(wareId) || 0)
      const remaining = targetRate - currentProd
      if (remaining <= 0) continue

      const count = Math.ceil(remaining / outputPerModule)
      if (count <= 0) continue
      newModules.push({ id: producer.id, count })
      produced.set(wareId, currentProd + count * outputPerModule)
    }

    if (newModules.length === 0) break

    for (const m of newModules) {
      const existing = built.find(b => b.id === m.id)
      if (existing) existing.count += m.count
      else built.push({ ...m })
    }

    const newAuto = getAutoModules(built)
    const deltaAuto = newAuto.filter(m => {
      const prev = currentAutoModules.find(p => p.id === m.id)
      return !prev || prev.count < m.count
    }).map(m => {
      const prev = currentAutoModules.find(p => p.id === m.id)
      return { id: m.id, count: m.count - (prev?.count || 0) }
    })
    currentAutoModules = newAuto

    const groupMods = mergeModules([...newModules, ...deltaAuto])
    if (groupMods.length > 0) {
      groups.push({ reason: `Bootstrap fill`, modules: groupMods })
    }

    const newSnapshot = fullBuilt().map(m => `${m.id}:${m.count}`).sort().join(';')
    if (newSnapshot === snapshot) break
  }

  return groups
}

function computeDemandAnalysis(node: BuildFlowPlanLine): void {
  const sources = node.demandSources
  if (!sources || sources.length === 0) { node.demandAnalysis = undefined; return }

  const perWareSources: Record<string, { label: string; qty: number; seconds: number; rate: number }[]> = {}
  let totalSeconds = 0

  for (const src of sources) {
    const materials = src.materials
    if (!materials) continue
    let srcSeconds = 0
    for (const [w, rate] of Object.entries(src.rates)) {
      if (rate > 0 && materials[w]) { srcSeconds = (materials[w] / rate) * 3600; break }
    }
    if (srcSeconds === 0) continue
    totalSeconds += srcSeconds

    for (const [wareId, qty] of Object.entries(materials)) {
      if (wareId === 'energycells') continue
      if (!node.trackedWares.has(wareId)) continue
      const entries = perWareSources[wareId] || []
      entries.push({ label: src.label, qty, seconds: srcSeconds, rate: qty / (srcSeconds / 3600) })
      perWareSources[wareId] = entries
    }
  }

  const totalHours = totalSeconds / 3600
  const aggregateRates: Record<string, number> = {}
  const perWareTotals: Record<string, { seconds: number; qty: number }> = {}
  let totalMaterialQty = 0
  if (totalHours > 0) {
    for (const [wareId, entries] of Object.entries(perWareSources)) {
      let sumQty = 0
      for (const e of entries) sumQty += e.qty
      aggregateRates[wareId] = sumQty / totalHours
      perWareTotals[wareId] = { seconds: totalSeconds, qty: sumQty }
      totalMaterialQty += sumQty
    }
  }

  node.demandAnalysis = {
    perWareSources,
    aggregateRates,
    gapRates: {},
    targetRates: { ...aggregateRates },
    perWareTotals,
    totalSeconds,
    totalMaterialQty,
  }
}
export function buildTopologicalOrder(graph: BuildFlowPlanGraph): Array<string[] | string> {
  const inDegree = new Map<string, number>()
  for (const [key] of graph.nodes) inDegree.set(key, 0)
  for (const edge of graph.edges) {
    if (graph.nodes.has(edge.fromLineKey)) {
      inDegree.set(edge.toLineKey, (inDegree.get(edge.toLineKey) || 0) + 1)
    }
  }

  const nodeToScc = new Map<string, number>()
  const sccMembers = new Set<string>()
  for (let i = 0; i < graph.sccGroups.length; i++) {
    for (const nodeKey of graph.sccGroups[i]!) {
      nodeToScc.set(nodeKey, i)
      sccMembers.add(nodeKey)
    }
  }

  // Separate DAG nodes that depend on SCC from pure DAG nodes
  const pureDag = new Set<string>()
  const sccDependentDag = new Set<string>()
  for (const [key] of graph.nodes) {
    if (sccMembers.has(key)) continue
    // Check if this DAG node has incoming edges from any SCC node
    let dependsOnScc = false
    for (const edge of graph.edges) {
      if (edge.toLineKey === key && sccMembers.has(edge.fromLineKey)) {
        dependsOnScc = true
        break
      }
    }
    if (dependsOnScc) {
      sccDependentDag.add(key)
    } else {
      pureDag.add(key)
    }
  }

  const result: Array<string[] | string> = []

  // 1. Pure DAG nodes first (leaf)
  const sortedDag = [...pureDag].sort((a, b) => (inDegree.get(a) || 0) - (inDegree.get(b) || 0))
  for (const key of sortedDag) {
    result.push(key)
  }

  // 2. SCC groups
  const addedSccs = new Set<number>()
  const sccSorted = [...graph.sccGroups].sort((a, b) => {
    let minDegA = Infinity, minDegB = Infinity
    for (const key of a) minDegA = Math.min(minDegA, inDegree.get(key) || 0)
    for (const key of b) minDegB = Math.min(minDegB, inDegree.get(key) || 0)
    return minDegA - minDegB
  })
  for (let i = 0; i < sccSorted.length; i++) {
    if (!addedSccs.has(i)) {
      result.push(sccSorted[i]!)
      addedSccs.add(i)
    }
  }

  // 3. DAG nodes that depend on SCC (after SCCs)
  const sortedSccDag = [...sccDependentDag].sort((a, b) => (inDegree.get(a) || 0) - (inDegree.get(b) || 0))
  for (const key of sortedSccDag) {
    result.push(key)
  }

  return result
}

function getBuildCostWares(line: BuildFlowPlanLine, modulesMap: Record<string, X4Module>): Set<string> {
  const wares = new Set<string>()
  for (const m of line.modules) {
    const mod = modulesMap[m.id]
    if (!mod?.buildCost) continue
    for (const wid of Object.keys(mod.buildCost)) {
      if (wid !== 'energycells') wares.add(wid)
    }
  }
  return wares
}

function collectDemandSources(
  node: BuildFlowPlanLine,
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>
): BuildRateSource[] {
  const byLabel = new Map<string, BuildRateSource>()

  for (const edge of graph.edges) {
    if (edge.toLineKey !== node.lineGroupId) continue

    let rates: Record<string, number> = {}
    let materials: Record<string, number> | undefined

    if (edge.fromLineKey === '__C__') {
      const rate = graph.cBuildCostRates[edge.wareId]
      if (rate !== undefined && rate > 0) {
        rates[edge.wareId] = rate
      }
      materials = computeBuildMaterials(graph.cModules, modulesMap)
    } else {
      const upstreamNode = graph.nodes.get(edge.fromLineKey)
      if (upstreamNode && upstreamNode.modules.length > 0) {
        const br = computeBuildRates(upstreamNode.modules, modulesMap)
        // Only include rate for the edge's specific wareId
        const rate = br[edge.wareId]
        if (rate && rate > 0) rates[edge.wareId] = rate
        materials = computeBuildMaterials(upstreamNode.modules, modulesMap)
      }
    }

    if (Object.keys(rates).length === 0) continue

    const label = edge.sourceLabel
    const existing = byLabel.get(label)
    if (existing) {
      for (const [w, r] of Object.entries(rates)) {
        existing.rates[w] = (existing.rates[w] || 0) + r
      }
    } else {
      byLabel.set(label, { label, rates, materials })
    }
  }

  return [...byLabel.values()]
}

/** Build requiredWaresByGroup from graph edges + allocations */
export function buildRequiredWaresMap(
  graph: BuildFlowPlanGraph,
  allocations: ProductionLineAllocation[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  // From allocation goals
  for (const alloc of allocations) {
    if (!alloc.groupId) continue
    for (const g of alloc.goals) {
      if (g.type === 'required-production') {
        const s = map.get(alloc.groupId) || new Set()
        s.add(g.wareId)
        map.set(alloc.groupId, s)
      }
    }
  }
  // From graph edges (same logic as computeBuildFlowPlanAllocations)
  for (const edge of graph.edges) {
    if (edge.sourceLabel.includes('isolated')) {
      const s = map.get(edge.fromLineKey) || new Set()
      s.add(edge.wareId)
      map.set(edge.fromLineKey, s)
    }
  }
  return map
}

export function computeFlowPlanLines(
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[],
  gap: Record<string, number> = {},
  requiredWaresByGroup: Map<string, Set<string>> = new Map(),
): void {
  const order = buildTopologicalOrder(graph)

  for (const entry of order) {
    if (Array.isArray(entry)) {
      computeSCCGroup(entry, graph, modulesMap, waresMap, settings, currentEmpireModules, gap, requiredWaresByGroup)
    } else {
      const node = graph.nodes.get(entry)
      if (!node) continue
      computeDagLine(node, graph, modulesMap, waresMap, settings, currentEmpireModules, gap, requiredWaresByGroup)
    }
  }
}

function computeDagLine(
  node: BuildFlowPlanLine,
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[],
  gap: Record<string, number> = {},
  requiredWaresByGroup: Map<string, Set<string>> = new Map(),
): void {
  const demandSources = collectDemandSources(node, graph, modulesMap)
  node.demandSources = demandSources

  // Remove required wares from demand (not to be produced locally)
  const reqWares = requiredWaresByGroup.get(node.lineGroupId) || new Set()
  for (const src of demandSources) {
    for (const w of reqWares) delete src.rates[w]
  }

  // Tracked-ware-filtered gap for planProductionForRates
  const gapForPlan: Record<string, number> = {}
  for (const [w, r] of Object.entries(gap)) {
    if (r > 0 && node.trackedWares.has(w)) gapForPlan[w] = r
  }

  // Check self-bootstrap
  const buildCostWares = getBuildCostWares(node, modulesMap)
  const selfWares = new Set<string>()
  for (const w of node.trackedWares) {
    if (buildCostWares.has(w)) selfWares.add(w)
  }
  node.isSelfBootstrap = selfWares.size > 0

  if (node.isSelfBootstrap && selfWares.size > 0) {
    const locked = [...(requiredWaresByGroup.get(node.lineGroupId) || new Set())]
    const reqWares = requiredWaresByGroup.get(node.lineGroupId) || new Set()
    const groups = bootstrapFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap, gapForPlan, locked, reqWares, node.trackedWares)
    node.buildGroups = groups
    node.modules = mergeModules(groups.flatMap(g => g.modules))
  } else {
    node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference, gapForPlan, node.trackedWares)
    const autoFill = autoFillForLine(
      mergeModules([...currentEmpireModules, ...node.modules]),
      [...(requiredWaresByGroup.get(node.lineGroupId) || [])].map(w => ({ type: 'required-production' as const, wareId: w, ratePerHour: 0 })),
      settings, modulesMap, waresMap,
    )
    node.modules = mergeModules([...node.modules, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
    node.buildGroups = [{ reason: node.lineName, modules: node.modules }]
  }
  computeDemandAnalysis(node)
}

function computeSCCGroup(
  sccKeys: string[],
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[],
  _gap: Record<string, number> = {},
  requiredWaresByGroup: Map<string, Set<string>> = new Map(),
): void {
  const sccNodes = sccKeys.map(k => graph.nodes.get(k)!).filter(Boolean)
  if (sccNodes.length === 0) return

  // Pre-compute gapRates once
  const gapRates: Record<string, number> = {}
  for (const [w, r] of Object.entries(_gap)) {
    if (r > 0) gapRates[w] = r
  }

  // Single-node SCC: call greedyFillForLine once (same as old algorithm)
  if (sccNodes.length === 1) {
    const node = sccNodes[0]!
    const demandSources = collectDemandSources(node, graph, modulesMap)
    node.demandSources = demandSources
    const reqWares = requiredWaresByGroup.get(node.lineGroupId) || new Set()
    for (const src of demandSources) {
      for (const w of reqWares) delete src.rates[w]
    }
    // Filter gapRates by node's trackedWares
    const nodeGap: Record<string, number> = {}
    for (const [w, r] of Object.entries(gapRates)) {
      if (node.trackedWares.has(w)) nodeGap[w] = r
    }
    if (Object.keys(nodeGap).length > 0 && demandSources.length > 0) {
      const first = demandSources[0]
      if (first) {
        for (const [w, r] of Object.entries(nodeGap)) {
          first.rates[w] = (first.rates[w] || 0) + r
        }
      }
    }
    const required = requiredWaresByGroup.get(node.lineGroupId) || new Set()
    const groups = bootstrapFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap, gapRates, [], required, node.trackedWares)
    node.buildGroups = groups
    node.modules = mergeModules(groups.flatMap(g => g.modules))
    updateNodeDerivedFields(node, modulesMap, settings)
    computeDemandAnalysis(node)
    return
  }

  const prevCounts = new Map<string, string>()
  let maxIterations = 60

  while (true) {
    let stable = true
    const sorted = sortSccByConsumeOrder(sccKeys, graph)

    for (const key of sorted) {
      const node = graph.nodes.get(key)!
      const demandSources = collectDemandSources(node, graph, modulesMap)
      node.demandSources = demandSources
      const reqWares = requiredWaresByGroup.get(node.lineGroupId) || new Set()
      for (const src of demandSources) {
        for (const w of reqWares) delete src.rates[w]
      }

      const buildCostWares = getBuildCostWares(node, modulesMap)
      const selfWares = new Set<string>()
      for (const w of node.trackedWares) {
        if (buildCostWares.has(w)) selfWares.add(w)
      }

      if (selfWares.size > 0) {
        const locked = [...(requiredWaresByGroup.get(node.lineGroupId) || new Set())]
        const reqWares = requiredWaresByGroup.get(node.lineGroupId) || new Set()
        const groups = bootstrapFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap, gapRates, locked, reqWares, node.trackedWares)
        node.buildGroups = groups
        node.modules = mergeModules(groups.flatMap(g => g.modules))
      } else {
        const nodeGapForPlan: Record<string, number> = {}
        for (const [w, r] of Object.entries(gapRates)) {
          if (node.trackedWares.has(w)) nodeGapForPlan[w] = r
        }
        node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference, nodeGapForPlan, node.trackedWares)
        const autoFill = autoFillForLine(
          mergeModules([...currentEmpireModules, ...node.modules]),
          [...(requiredWaresByGroup.get(node.lineGroupId) || [])].map(w => ({ type: 'required-production' as const, wareId: w, ratePerHour: 0 })),
          settings, modulesMap, waresMap,
        )
        node.modules = mergeModules([...node.modules, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
        node.buildGroups = [{ reason: node.lineName, modules: node.modules }]
      }

      updateNodeDerivedFields(node, modulesMap, settings)
      computeDemandAnalysis(node)

      const countKey = makePrimaryModuleSnapshot(node)

      if (prevCounts.get(key) !== countKey) {
        stable = false
        prevCounts.set(key, countKey)
      }
    }

    if (stable) break
    if (maxIterations-- <= 0) break
  }
}

function makePrimaryModuleSnapshot(
  node: BuildFlowPlanLine,
): string {
  const primaryIds = new Set(node.moduleIds)
  return node.modules
    .filter(m => primaryIds.has(m.id))
    .map(m => `${m.id}:${m.count}`)
    .sort()
    .join(';')
}

function updateNodeDerivedFields(
  node: BuildFlowPlanLine,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings
): void {
  const primaryIds: string[] = []
  for (const trackedWare of node.trackedWares) {
    for (const m of node.modules) {
      const mod = modulesMap[m.id]
      if (mod && mod.outputs[trackedWare] !== undefined) {
        if (!primaryIds.includes(m.id)) primaryIds.push(m.id)
      }
    }
  }
  node.moduleIds = primaryIds

  node.netProduction = calculateNetProduction(
    node.modules,
    modulesMap,
    settings.considerWorkforceForAutoFill,
    settings.sunlight
  )
}

function sortSccByConsumeOrder(sccKeys: string[], graph: BuildFlowPlanGraph): string[] {
  const inDeg = new Map<string, number>()
  for (const key of sccKeys) inDeg.set(key, 0)
  for (const edge of graph.edges) {
    if (sccKeys.includes(edge.fromLineKey) && sccKeys.includes(edge.toLineKey)) {
      inDeg.set(edge.toLineKey, (inDeg.get(edge.toLineKey) || 0) + 1)
    }
  }
  return [...sccKeys].sort((a, b) => (inDeg.get(b) || 0) - (inDeg.get(a) || 0))
}

export function makeSchemes(
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings
): BuildScheme[] {
  const order = buildTopologicalOrder(graph)
  // Build order: reverse of computation order (supply before consumption)
  order.reverse()

  const schemes: BuildScheme[] = []
  const builtSoFar: SavedModule[] = []

  for (const entry of order) {
    if (Array.isArray(entry)) {
      for (const key of entry) {
        const node = graph.nodes.get(key)
        if (!node || node.modules.length === 0) continue
        schemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
        builtSoFar.push(...node.modules)
      }
    } else {
      const node = graph.nodes.get(entry)
      if (!node || node.modules.length === 0) continue
      schemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
      builtSoFar.push(...node.modules)
    }
  }

  const cScheme = makeSchemeForC(graph, modulesMap, waresMap, settings, builtSoFar)
  schemes.push(cScheme)
  return schemes
}

function makeSchemeFromLine(
  node: BuildFlowPlanLine,
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  contextModules?: SavedModule[]
): BuildScheme {
  const demandSources = collectDemandSources(node, graph, modulesMap)
  const purposeModules = [...node.trackedWares]
  const mergedModules = mergeModules(node.modules)

  const targetRates: Record<string, number> = {}
  for (const src of demandSources) {
    for (const [wareId, rate] of Object.entries(src.rates)) {
      targetRates[wareId] = (targetRates[wareId] || 0) + rate
    }
  }

  const purposeWareSet = new Set(purposeModules)
  const primaryModuleIds = mergedModules
    .filter(m => {
      const mod = modulesMap[m.id]
      return mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w))
    })
    .map(m => m.id)

  const buildMaterialTotals: Record<string, number> = {}
  let totalModuleBuildTime = 0
  for (const m of mergedModules) {
    const mod = modulesMap[m.id]
    if (!mod) continue
    totalModuleBuildTime += mod.buildTime * m.count
    const cost = mod.buildCost
    if (!cost || Object.keys(cost).length === 0) continue
    for (const [wareId, qty] of Object.entries(cost)) {
      if (wareId === 'energycells') continue
      buildMaterialTotals[wareId] = (buildMaterialTotals[wareId] || 0) + (qty as number) * m.count
    }
  }

  const moduleBuildDetails = computeModuleBuildDetails(mergedModules, modulesMap)

  const netProduction = calculateNetProduction(
    node.modules, modulesMap,
    settings.considerWorkforceForAutoFill, settings.sunlight
  )

  const wareNames = [...node.trackedWares].map(w => waresMap[w]?.name || w).join(', ')

  const groups: BuildGroup[] = node.buildGroups && node.buildGroups.length > 0
    ? node.buildGroups
    : [{ reason: node.lineName, modules: node.modules }]

  const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings, contextModules)
  const scheme: BuildScheme = {
    label: node.lineName,
    description: `产出: ${wareNames}`,
    purposeModules,
    primaryModuleIds,
    modules: mergedModules,
    targetRates,
    targetRateSources: demandSources,
    netProduction,
    steps,
    totalDuration: steps.length > 0 ? steps[steps.length - 1]!.estimatedDuration : 0,
    totalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
    stepsCount: steps.length,
    isFeasible: mergedModules.length > 0,
    totalModuleBuildTime,
    buildMaterialTotals,
    moduleBuildDetails,
  }
  ;(scheme as any)._groupId = node.lineGroupId
  return scheme
}

export function splitCToLineSchemes(
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): BuildScheme[] {
  const schemes: BuildScheme[] = []

  function buildTargetRatesFromGoals(goals: BuildGoal[]): Record<string, number> {
    const targetRates: Record<string, number> = {}
    for (const goal of goals) {
      if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
        targetRates[goal.wareId] = (targetRates[goal.wareId] || 0) + goal.ratePerHour
      }
    }
    return targetRates
  }

  function makeLineScheme(
    lineName: string,
    goals: BuildGoal[],
  ): BuildScheme | null {
    if (goals.length === 0) return null
    const baseModules = goals.flatMap(g => expandGoalDependencies(g, modulesMap, waresMap))
    const merged = mergeModules(baseModules)
    const autoFill = autoFillForLine(
      merged,
      goals,
      settings, modulesMap, waresMap,
    )
    const lineModules = mergeModules([...merged, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
    if (lineModules.length === 0) return null

    const netProduction = calculateNetProduction(lineModules, modulesMap, settings.considerWorkforceForAutoFill, settings.sunlight)
    const purposeModules: string[] = []
    for (const g of goals) {
      if (g.type === 'production-rate' || g.type === 'derived-rate' || g.type === 'derived-production' || g.type === 'derived-build-material') {
        if (!purposeModules.includes(g.wareId)) purposeModules.push(g.wareId)
      } else if (g.type === 'build-module') {
        const mod = modulesMap[g.moduleId]
        if (mod?.outputs) {
          for (const w of Object.keys(mod.outputs)) {
            if (!purposeModules.includes(w)) purposeModules.push(w)
          }
        }
      }
    }

    const buildMaterialTotals: Record<string, number> = {}
    let totalModuleBuildTime = 0
    for (const m of lineModules) {
      const mod = modulesMap[m.id]
      if (!mod) continue
      totalModuleBuildTime += mod.buildTime * m.count
      const cost = mod.buildCost
      if (!cost || Object.keys(cost).length === 0) continue
      for (const [wareId, qty] of Object.entries(cost)) {
        if (wareId === 'energycells') continue
        buildMaterialTotals[wareId] = (buildMaterialTotals[wareId] || 0) + (qty as number) * m.count
      }
    }

    const moduleBuildDetails = computeModuleBuildDetails(lineModules, modulesMap)

    const purposeWareSet = new Set(purposeModules)
    const primaryModuleIds = lineModules
      .filter(m => {
        const mod = modulesMap[m.id]
        return mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w))
      })
      .map(m => m.id)

    const groups: BuildGroup[] = [{ reason: lineName, modules: lineModules }]
    const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings)

    const scheme: BuildScheme = {
      label: lineName || '目标产线',
      description: `产出: ${purposeModules.map(w => waresMap[w]?.name || w).join(', ')}`,
      purposeModules,
      primaryModuleIds: primaryModuleIds.length > 0 ? primaryModuleIds : lineModules.map(m => m.id),
      modules: lineModules,
      targetRates: buildTargetRatesFromGoals(goals),
      targetRateSources: [],
      netProduction,
      steps,
      totalDuration: steps.length > 0 ? steps[steps.length - 1]!.estimatedDuration : 0,
      totalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
      stepsCount: steps.length,
      isFeasible: lineModules.length > 0,
      totalModuleBuildTime,
      buildMaterialTotals,
      moduleBuildDetails,
    }
    ;(scheme as any)._goals = goals
    return scheme
  }

  for (const alloc of allocations) {
    if (alloc.isUnmatched) continue
    const scheme = makeLineScheme(alloc.groupName, alloc.goals)
    if (scheme) {
      ;(scheme as any)._groupId = alloc.groupId
      schemes.push(scheme)
    }
  }

  const unmatchedAlloc = allocations.find(a => a.isUnmatched)
  if (unmatchedAlloc && unmatchedAlloc.goals.length > 0) {
    const scheme = makeLineScheme('待规划产线', unmatchedAlloc.goals)
    if (scheme) {
      ;(scheme as any)._groupId = undefined
      schemes.push(scheme)
    }
  }

  return schemes
}

function sumRecordValues(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = { ...left }
  for (const [key, value] of Object.entries(right)) {
    result[key] = (result[key] || 0) + value
  }
  return result
}

function mergeSchemePair(
  buildScheme: BuildScheme,
  productionScheme: BuildScheme,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): BuildScheme {
  const mergedModules = mergeModules([...buildScheme.modules, ...productionScheme.modules])
  const purposeModules = [...new Set([...buildScheme.purposeModules, ...productionScheme.purposeModules])]
  const purposeWareSet = new Set(purposeModules)
  const buildGroups: BuildGroup[] = [{ reason: buildScheme.label, modules: mergedModules }]
  const steps = makeSchemeSteps(buildGroups, modulesMap, waresMap, settings)

  let totalModuleBuildTime = 0
  for (const module of mergedModules) {
    const mod = modulesMap[module.id]
    if (!mod) continue
    totalModuleBuildTime += mod.buildTime * module.count
  }

  return {
    ...buildScheme,
    description: `产出: ${purposeModules.map(w => waresMap[w]?.name || w).join(', ')}`,
    purposeModules,
    primaryModuleIds: mergedModules
      .filter(module => {
        const mod = modulesMap[module.id]
        return mod && Object.keys(mod.outputs).some(wareId => purposeWareSet.has(wareId))
      })
      .map(module => module.id),
    modules: mergedModules,
    targetRates: sumRecordValues(buildScheme.targetRates, productionScheme.targetRates),
    targetRateSources: [...buildScheme.targetRateSources, ...productionScheme.targetRateSources],
    netProduction: calculateNetProduction(
      mergedModules,
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight,
    ),
    steps,
    totalDuration: steps.length > 0 ? steps[steps.length - 1]!.estimatedDuration : 0,
    totalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
    stepsCount: steps.length,
    isFeasible: mergedModules.length > 0,
    totalModuleBuildTime,
    buildMaterialTotals: sumRecordValues(buildScheme.buildMaterialTotals, productionScheme.buildMaterialTotals),
    moduleBuildDetails: computeModuleBuildDetails(mergedModules, modulesMap),
  }
}

export function mergeOverlappingLines(
  buildSchemes: BuildScheme[],
  productionSchemes: BuildScheme[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): { buildSchemes: BuildScheme[]; productionSchemes: BuildScheme[] } {
  const buildByGroupId = new Map<string, BuildScheme>()
  for (const scheme of buildSchemes) {
    const groupId = (scheme as any)._groupId
    if (typeof groupId === 'string' && groupId.length > 0) {
      buildByGroupId.set(groupId, scheme)
    }
  }

  const nextBuildSchemes = [...buildSchemes]
  const nextProductionSchemes: BuildScheme[] = []

  for (const productionScheme of productionSchemes) {
    const groupId = (productionScheme as any)._groupId
    if (!groupId || !buildByGroupId.has(groupId)) {
      nextProductionSchemes.push(productionScheme)
      continue
    }

    const buildScheme = buildByGroupId.get(groupId)!
    const merged = mergeSchemePair(buildScheme, productionScheme, modulesMap, waresMap, settings)
    const index = nextBuildSchemes.indexOf(buildScheme)
    if (index >= 0) nextBuildSchemes[index] = merged
    buildByGroupId.set(groupId, merged)
  }

  return {
    buildSchemes: nextBuildSchemes,
    productionSchemes: nextProductionSchemes,
  }
}

export function makeSchemesWithGroups(
  graph: BuildFlowPlanGraph,
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  groupLabels?: { buildMaterial: string; production: string },
): BuildSchemeGroup[] {
  // 1. Build-material schemes from graph nodes
  const order = buildTopologicalOrder(graph)
  order.reverse()
  const builtSoFar: SavedModule[] = []
  const buildSchemes: BuildScheme[] = []
  const graphGroupIds = new Set<string>()
  for (const entry of order) {
    if (Array.isArray(entry)) {
      for (const key of entry) {
        const node = graph.nodes.get(key)
        if (!node || node.modules.length === 0) continue
        graphGroupIds.add(key)
        buildSchemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
        builtSoFar.push(...node.modules)
      }
    } else {
      const node = graph.nodes.get(entry)
      if (!node || node.modules.length === 0) continue
      graphGroupIds.add(entry)
      buildSchemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
      builtSoFar.push(...node.modules)
    }
  }

  // 2. Production schemes: filter out allocations whose groupId already in graph (overlapping lines)
  //    Overlapping lines are already solved in graph nodes with merged responsibilities
  const productionAllocations = allocations.filter(
    a => !a.groupId || !graphGroupIds.has(a.groupId)
  )
  const splitSchemes = splitCToLineSchemes(productionAllocations, modulesMap, waresMap, settings)

  for (const scheme of buildSchemes) delete (scheme as any)._groupId
  for (const scheme of splitSchemes) delete (scheme as any)._groupId

  return [
    {
      groupType: 'build-material',
      groupLabel: groupLabels?.buildMaterial || 'Build Material Lines',
      schemes: buildSchemes,
    },
    {
      groupType: 'production',
      groupLabel: groupLabels?.production || 'Production Lines',
      schemes: splitSchemes,
    },
  ]
}

function makeSchemeForC(
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  contextModules?: SavedModule[]
): BuildScheme {
  const mergedModules = mergeModules(graph.cModules)

  const netProduction = calculateNetProduction(
    mergedModules, modulesMap,
    settings.considerWorkforceForAutoFill, settings.sunlight
  )

  const buildMaterialTotals: Record<string, number> = {}
  let totalModuleBuildTime = 0
  for (const m of mergedModules) {
    const mod = modulesMap[m.id]
    if (!mod) continue
    totalModuleBuildTime += mod.buildTime * m.count
    const cost = mod.buildCost
    if (!cost || Object.keys(cost).length === 0) continue
    for (const [wareId, qty] of Object.entries(cost)) {
      if (wareId === 'energycells') continue
      buildMaterialTotals[wareId] = (buildMaterialTotals[wareId] || 0) + (qty as number) * m.count
    }
  }

  const moduleBuildDetails = computeModuleBuildDetails(mergedModules, modulesMap)

  const groups: BuildGroup[] = [{
    reason: '目标产线',
    modules: graph.cModules,
  }]

  const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings, contextModules)

  // purposeModules = goal ware IDs, fallback to all C output wares
  const purposeArr = graph.cGoalWareIds && graph.cGoalWareIds.length > 0
    ? graph.cGoalWareIds
    : (() => {
        const s = new Set<string>()
        for (const m of mergedModules) {
          const mod = modulesMap[m.id]
          if (!mod) continue
          for (const w of Object.keys(mod.outputs)) {
            if (w !== 'energycells') s.add(w)
          }
        }
        return [...s]
      })()
  const purposeWareSet = new Set(purposeArr)

  return {
    label: '目标产线',
    description: '目标产线',
    purposeModules: purposeArr,
    primaryModuleIds: mergedModules
      .filter(m => {
        const mod = modulesMap[m.id]
        return mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w))
      })
      .map(m => m.id),
    modules: mergedModules,
    targetRates: graph.cBuildCostRates,
    targetRateSources: [],
    netProduction,
    steps,
    totalDuration: steps.length > 0 ? steps[steps.length - 1]!.estimatedDuration : 0,
    totalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
    stepsCount: steps.length,
    isFeasible: mergedModules.length > 0,
    totalModuleBuildTime,
    buildMaterialTotals,
    moduleBuildDetails,
  }
}
