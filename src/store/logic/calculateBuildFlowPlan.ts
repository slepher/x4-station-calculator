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

/** Unified autoFill wrapper — always passes line's isolatedWares as lockedWares */
export function autoFillForLine(
  plannedModules: SavedModule[],
  isolatedWares: Set<string>,
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
): { autoIndustryModules: SavedModule[]; autoHabitationModules: SavedModule[] } {
  return calculateAutoFillModules({
    plannedModules,
    settings,
    modulesMap,
    waresMap,
    lockedWares: [...isolatedWares],
  })
}

export function expandGoalsWithAutoFill(
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  isolatedWares: Set<string> = new Set(),
): SavedModule[] {
  const lockedWares = [...isolatedWares]
  let result: SavedModule[] = []
  for (const goal of goals) {
    const base = expandGoalDependencies(goal, modulesMap, waresMap)
    const merged = mergeModules(base)
    const autoFill = calculateAutoFillModules({
      plannedModules: merged,
      settings,
      modulesMap,
      waresMap,
      lockedWares,
    })
    result = mergeModules([...result, ...merged, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
  }
  return result
}

export function computeSourceSatisfaction(
  targetRate: number,
  prodRate: number,
): number {
  if (targetRate <= 0) return prodRate > 0 ? 999 : 0
  return Math.min(prodRate / targetRate * 100, 999)
}

export interface SourceSatisfaction {
  label: string
  rate: number
  satisfaction: number
}

export interface WareSatisfaction {
  wareId: string
  sources: SourceSatisfaction[]
  totalTarget: number
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

    const maxBuildMat = scheme.targetRates?.[wareId] || 0
    const allTarget = maxBuildMat + (gap[wareId] || 0) + (manualWares[wareId] || 0) + (manualModules[wareId] || 0)
    results.push({ wareId, sources, totalTarget: allTarget, totalProd: prodRate })
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

function planProductionForRates(
  demandSources: BuildRateSource[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  race: string
): SavedModule[] {
  const targetRates: Record<string, number> = {}
  for (const src of demandSources) {
    for (const [wareId, rate] of Object.entries(src.rates)) {
      targetRates[wareId] = Math.max(targetRates[wareId] || 0, rate)
    }
  }

  const produced = new Map<string, number>()
  const modules: SavedModule[] = []

  for (const [wareId, targetRate] of Object.entries(targetRates)) {
    if (targetRate <= 0) continue
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

function greedyFillForLine(
  externalSources: BuildRateSource[],
  currentEmpireModules: SavedModule[],
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  _gap2: Record<string, number> = {},
  lockedWares: string[] = [],
): BuildGroup[] {
  const built: SavedModule[] = []
  const groups: BuildGroup[] = []
  let maxIterations = 60

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
      if (w !== 'energycells' && produced.has(w)) filtered[w] = rate
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
    // Add gap rates additively to the first external source
    const gapRates: Record<string, number> = {}
    for (const [w, r] of Object.entries(_gap2)) {
      if (r > 0) gapRates[w] = r
    }
    if (Object.keys(gapRates).length > 0 && allSources.length > 0) {
      const first = allSources[0]
      if (first) {
        for (const [w, r] of Object.entries(gapRates)) {
          first.rates[w] = (first.rates[w] || 0) + r
        }
      }
    } else if (Object.keys(gapRates).length > 0) {
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

function buildTopologicalOrder(graph: BuildFlowPlanGraph): Array<string[] | string> {
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
        // Only include rates for wares this node tracks
        for (const [w, r] of Object.entries(br)) {
          if (r > 0 && node.trackedWares.has(w)) rates[w] = r
        }
        materials = computeBuildMaterials(upstreamNode.modules, modulesMap)
      }
    }

    if (Object.keys(rates).length === 0) continue

    const label = edge.sourceLabel
    // Dedup: group by upstream node base name (strip action suffix)
    const baseLabel = label.replace(/ (buildCost|isolated)$/, '')
    const existing = byLabel.get(baseLabel)
    if (existing) {
      for (const [w, r] of Object.entries(rates)) {
        existing.rates[w] = Math.max(existing.rates[w] || 0, r)
      }
      // Merge materials too
      if (materials && existing.materials) {
        for (const [w, q] of Object.entries(materials)) {
          existing.materials[w] = Math.max(existing.materials[w] || 0, q)
        }
      }
    } else {
      byLabel.set(baseLabel, { label: baseLabel, rates, materials })
    }
  }

  return [...byLabel.values()]
}

export function computeFlowPlanLines(
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[],
  gap: Record<string, number> = {},
): void {
  const order = buildTopologicalOrder(graph)

  for (const entry of order) {
    if (Array.isArray(entry)) {
      computeSCCGroup(entry, graph, modulesMap, waresMap, settings, currentEmpireModules, gap)
    } else {
      const node = graph.nodes.get(entry)
      if (!node) continue
      computeDagLine(node, graph, modulesMap, waresMap, settings, currentEmpireModules, gap)
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
  _gap: Record<string, number> = {},
): void {
  const demandSources = collectDemandSources(node, graph, modulesMap)
  node.demandSources = demandSources

  // Check self-bootstrap
  const buildCostWares = getBuildCostWares(node, modulesMap)
  const selfWares = new Set<string>()
  for (const w of node.trackedWares) {
    if (buildCostWares.has(w)) selfWares.add(w)
  }
  node.isSelfBootstrap = selfWares.size > 0

  if (node.isSelfBootstrap && selfWares.size > 0) {
    const locked = [...(node.isolatedWares ?? [])]
    const groups = greedyFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap, {}, locked)
    node.buildGroups = groups
    node.modules = mergeModules(groups.flatMap(g => g.modules))
  } else {
    node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference)
    const autoFill = autoFillForLine(
      mergeModules([...currentEmpireModules, ...node.modules]),
      node.isolatedWares ?? new Set(),
      settings, modulesMap, waresMap,
    )
    node.modules = mergeModules([...node.modules, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
    node.buildGroups = [{ reason: node.lineName, modules: node.modules }]
  }

  updateNodeDerivedFields(node, modulesMap, settings)
}

function computeSCCGroup(
  sccKeys: string[],
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[],
  _gap: Record<string, number> = {},
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
    if (Object.keys(gapRates).length > 0 && demandSources.length > 0) {
      const first = demandSources[0]
      if (first) {
        for (const [w, r] of Object.entries(gapRates)) {
          first.rates[w] = (first.rates[w] || 0) + r
        }
      }
    } else if (Object.keys(gapRates).length > 0) {
      demandSources.push({ label: 'gap_demand', rates: { ...gapRates } })
    }
    const groups = greedyFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap)
    node.buildGroups = groups
    node.modules = mergeModules(groups.flatMap(g => g.modules))
    updateNodeDerivedFields(node, modulesMap, settings)
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

      const buildCostWares = getBuildCostWares(node, modulesMap)
      const selfWares = new Set<string>()
      for (const w of node.trackedWares) {
        if (buildCostWares.has(w)) selfWares.add(w)
      }

      // Add gap rates additively to the first demand source
      if (Object.keys(gapRates).length > 0 && demandSources.length > 0) {
        const first = demandSources[0]
        if (first) {
          for (const [w, r] of Object.entries(gapRates)) {
            first.rates[w] = (first.rates[w] || 0) + r
          }
        }
      } else if (Object.keys(gapRates).length > 0) {
        demandSources.push({ label: 'gap_demand', rates: { ...gapRates } })
      }

      if (selfWares.size > 0) {
        const locked = [...(node.isolatedWares ?? [])]
        const groups = greedyFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap, {}, locked)
        node.buildGroups = groups
        node.modules = mergeModules(groups.flatMap(g => g.modules))
      } else {
        node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference)
        const autoFill = autoFillForLine(
          mergeModules([...currentEmpireModules, ...node.modules]),
          node.isolatedWares ?? new Set(),
          settings, modulesMap, waresMap,
        )
        node.modules = mergeModules([...node.modules, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
        node.buildGroups = [{ reason: node.lineName, modules: node.modules }]
      }

      updateNodeDerivedFields(node, modulesMap, settings)

      const countKey = node.moduleIds.map(id => {
        const m = node.modules.find(mod => mod.id === id)
        return `${id}:${m?.count || 0}`
      }).join(';')

      if (prevCounts.get(key) !== countKey) {
        stable = false
        prevCounts.set(key, countKey)
      }
    }

    if (stable) break
    if (maxIterations-- <= 0) break
  }
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
      targetRates[wareId] = Math.max(targetRates[wareId] || 0, rate)
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

  const netProduction = calculateNetProduction(
    node.modules, modulesMap,
    settings.considerWorkforceForAutoFill, settings.sunlight
  )

  const wareNames = [...node.trackedWares].map(w => waresMap[w]?.name || w).join(', ')

  const groups: BuildGroup[] = node.buildGroups && node.buildGroups.length > 0
    ? node.buildGroups
    : [{ reason: node.lineName, modules: node.modules }]

  const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings, contextModules)

  return {
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
  }
}

export function splitCToLineSchemes(
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): BuildScheme[] {
  const schemes: BuildScheme[] = []

  function makeLineScheme(
    lineName: string,
    goals: BuildGoal[],
  ): BuildScheme | null {
    if (goals.length === 0) return null
    const baseModules = goals.flatMap(g => expandGoalDependencies(g, modulesMap, waresMap))
    const merged = mergeModules(baseModules)
    const autoFill = calculateAutoFillModules({
      plannedModules: merged,
      settings,
      modulesMap,
      waresMap,
      lockedWares: [],
    })
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

    const purposeWareSet = new Set(purposeModules)
    const primaryModuleIds = lineModules
      .filter(m => {
        const mod = modulesMap[m.id]
        return mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w))
      })
      .map(m => m.id)

    const groups: BuildGroup[] = [{ reason: lineName, modules: lineModules }]
    const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings)

    return {
      label: lineName || '目标产线',
      description: `产出: ${purposeModules.map(w => waresMap[w]?.name || w).join(', ')}`,
      purposeModules,
      primaryModuleIds: primaryModuleIds.length > 0 ? primaryModuleIds : lineModules.map(m => m.id),
      modules: lineModules,
      targetRates: {},
      targetRateSources: [],
      netProduction,
      steps,
      totalDuration: steps.length > 0 ? steps[steps.length - 1]!.estimatedDuration : 0,
      totalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
      stepsCount: steps.length,
      isFeasible: lineModules.length > 0,
      totalModuleBuildTime,
      buildMaterialTotals,
    }
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

export function makeSchemesWithGroups(
  graph: BuildFlowPlanGraph,
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  groupLabels?: { buildMaterial: string; production: string },
): BuildSchemeGroup[] {
  // 1. Build-material schemes from graph nodes (excluding C scheme)
  const order = buildTopologicalOrder(graph)
  order.reverse()
  const builtSoFar: SavedModule[] = []
  const buildSchemes: BuildScheme[] = []
  for (const entry of order) {
    if (Array.isArray(entry)) {
      for (const key of entry) {
        const node = graph.nodes.get(key)
        if (!node || node.modules.length === 0) continue
        buildSchemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
        builtSoFar.push(...node.modules)
      }
    } else {
      const node = graph.nodes.get(entry)
      if (!node || node.modules.length === 0) continue
      buildSchemes.push(makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar))
      builtSoFar.push(...node.modules)
    }
  }

  const buildNodeGroupIds = new Set<string>()
  for (const [groupId] of graph.nodes) {
    buildNodeGroupIds.add(groupId)
  }

  // 2. Production schemes from C split
  const productionSchemes = splitCToLineSchemes(allocations, modulesMap, waresMap, settings)

  // 3. Detect overlaps: skip production schemes that overlap with graph nodes
  const overlappingGroupIds = new Set<string>()
  for (const prodScheme of productionSchemes) {
    const groupId = (prodScheme as any)._groupId
    if (groupId && buildNodeGroupIds.has(groupId)) {
      overlappingGroupIds.add(groupId)
    }
  }

  const mergedBuildSchemes: BuildScheme[] = [...buildSchemes]
  const mergedProductionSchemes: BuildScheme[] = []

  for (const prodScheme of productionSchemes) {
    const groupId = (prodScheme as any)._groupId
    if (groupId && overlappingGroupIds.has(groupId)) {
      // Overlap: production demand is already satisfied by the graph node's scheme.
      // The build-material scheme from the graph already covers this line.
      // TODO: 叠加相加 — add production target rates to the graph node's demand sources.
    } else {
      mergedProductionSchemes.push(prodScheme)
    }
  }

  // 4. Clean up internal _groupId
  for (const s of mergedBuildSchemes) delete (s as any)._groupId
  for (const s of mergedProductionSchemes) delete (s as any)._groupId

  return [
    {
      groupType: 'build-material',
      groupLabel: groupLabels?.buildMaterial || 'Build Material Lines',
      schemes: mergedBuildSchemes,
    },
    {
      groupType: 'production',
      groupLabel: groupLabels?.production || 'Production Lines',
      schemes: mergedProductionSchemes,
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
  }
}
