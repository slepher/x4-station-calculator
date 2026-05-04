import type {
  BuildFlowPlanGraph,
  BuildFlowPlanLine,
  BuildRateSource,
  BuildScheme,
  BuildGroup,
  BuildGoal,
  BuildSchemeStep,
  BuildMaterial,
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
    case 'derived-rate': {
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
  waresMap: Record<string, X4Ware>
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
      lockedWares: [],
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

  while (true) {
    currentAutoModules = getAutoModules(built)
    const net = contextNet()

    const allSources = [...externalSources]
    const sd = selfDemand()
    if (sd) allSources.push(sd)

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
      for (const src of allSources) {
        for (const [wareId, rate] of Object.entries(src.rates)) {
          if (wareId === 'energycells' || rate <= 0) continue
          const prodRate = Math.max(0, net[wareId] ?? 0)
          const satRate = prodRate / rate
          if (satRate < worstSat) {
            worstSat = satRate
            bottleneckWare = wareId
          }
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
    const existing = byLabel.get(label)
    if (existing) {
      for (const [w, r] of Object.entries(rates)) {
        existing.rates[w] = Math.max(existing.rates[w] || 0, r)
      }
    } else {
      byLabel.set(label, { label, rates, materials })
    }
  }

  return [...byLabel.values()]
}

export function computeFlowPlanLines(
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[]
): void {
  const order = buildTopologicalOrder(graph)

  for (const entry of order) {
    if (Array.isArray(entry)) {
      computeSCCGroup(entry, graph, modulesMap, waresMap, settings, currentEmpireModules)
    } else {
      const node = graph.nodes.get(entry)
      if (!node) continue
      computeDagLine(node, graph, modulesMap, waresMap, settings, currentEmpireModules)
    }
  }
}

function computeDagLine(
  node: BuildFlowPlanLine,
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  currentEmpireModules: SavedModule[]
): void {
  const demandSources = collectDemandSources(node, graph, modulesMap)

  // Check self-bootstrap
  const buildCostWares = getBuildCostWares(node, modulesMap)
  const selfWares = new Set<string>()
  for (const w of node.trackedWares) {
    if (buildCostWares.has(w)) selfWares.add(w)
  }
  node.isSelfBootstrap = selfWares.size > 0

  if (node.isSelfBootstrap && selfWares.size > 0) {
    const groups = greedyFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap)
    node.buildGroups = groups
    node.modules = mergeModules(groups.flatMap(g => g.modules))
  } else {
    node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference)
    const autoFill = calculateAutoFillModules({
      plannedModules: mergeModules([...currentEmpireModules, ...node.modules]),
      settings, modulesMap, waresMap, lockedWares: [],
    })
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
  currentEmpireModules: SavedModule[]
): void {
  const sccNodes = sccKeys.map(k => graph.nodes.get(k)!).filter(Boolean)
  if (sccNodes.length === 0) return

  // Single-node SCC: call greedyFillForLine once (same as old algorithm)
  if (sccNodes.length === 1) {
    const node = sccNodes[0]!
    const demandSources = collectDemandSources(node, graph, modulesMap)
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

      const buildCostWares = getBuildCostWares(node, modulesMap)
      const selfWares = new Set<string>()
      for (const w of node.trackedWares) {
        if (buildCostWares.has(w)) selfWares.add(w)
      }

      if (selfWares.size > 0) {
        const groups = greedyFillForLine(demandSources, currentEmpireModules, settings, modulesMap, waresMap)
        node.buildGroups = groups
        node.modules = mergeModules(groups.flatMap(g => g.modules))
      } else {
        node.modules = planProductionForRates(demandSources, modulesMap, waresMap, settings.racePreference)
        const autoFill = calculateAutoFillModules({
          plannedModules: mergeModules([...currentEmpireModules, ...node.modules]),
          settings, modulesMap, waresMap, lockedWares: [],
        })
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
