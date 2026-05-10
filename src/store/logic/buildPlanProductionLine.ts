import { buildFlowPlanGraph } from '@/store/logic/buildFlowPlanGraph'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'
import { findBestProducer } from '@/store/logic/bestModuleSelector'
import {
  autoFillForLine,
  buildTopologicalOrder,
  expandGoalDependencies,
  makeSchemesWithGroups,
  mergeModules,
  splitTargetLineSchemes,
} from '@/store/logic/calculateBuildFlowPlan'
import type {
  BuildFlowPlanGraph,
  BuildFlowPlanView,
  BuildGoal,
  BuildScheme,
  BuildSchemeGroup,
  DemandDetail,
  ComputeInput,
  ComputeResult,
  ComputeLineResult,
  PreviewLinePlan,
  PreviewResponsibility,
  PreviewResult,
  ResponsibilityType,
  ProductionLineAllocation,
} from '@/types/build-plan'
import type {
  ProductionLineGroup,
  SavedModule,
  StationSettings,
  X4Module,
  X4Ware,
} from '@/types/x4'

export const DEFAULT_BUILD_PLAN_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: true,
  internalSupply: true,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1,
  primaryProductBufferHours: 12,
  secondaryProductBufferHours: 2,
  transportMinutes: 30,
  transportShipCapacity: 62000,
  enforceDlcActivation: false,
}

function createEmptyGraph(): BuildFlowPlanGraph {
  return {
    nodes: new Map(),
    edges: [],
    sccGroups: [],
    targetModules: [],
    targetBuildCostRates: {},
  }
}

export function collectIsolatedWares(groups: ProductionLineGroup[]): Set<string> {
  const isolatedWares = new Set<string>()
  for (const group of groups) {
    for (const node of group.nodes) {
      if (node.isIsolated) isolatedWares.add(node.wareId)
    }
  }
  return isolatedWares
}

export function enrichGoalsWithIsolatedRequirements(
  goals: BuildGoal[],
  groups: ProductionLineGroup[],
): BuildGoal[] {
  const isolatedWares = collectIsolatedWares(groups)
  return [
    ...goals,
    ...[...isolatedWares].map(wareId => ({
      type: 'required-production' as const,
      wareId,
      ratePerHour: 0,
    })),
  ]
}

export function buildTargetModulesForProductionLine(
  goals: BuildGoal[],
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
): { enrichedGoals: BuildGoal[]; targetModules: SavedModule[] } {
  const enrichedGoals = enrichGoalsWithIsolatedRequirements(goals, groups)
  const baseModules = enrichedGoals.flatMap(goal => expandGoalDependencies(goal, modulesMap, waresMap, settings.racePreference))
  const mergedBase = mergeModules(baseModules)
  const autoFill = autoFillForLine(mergedBase, enrichedGoals, settings, modulesMap, waresMap)
  return {
    enrichedGoals,
    targetModules: mergeModules([...mergedBase, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules]),
  }
}

/**
 * 从依赖图构建 PreviewLinePlan[]（带显式责任对象）。
 * 消费方 → 供给方 的边方向保持一致。
 */
export function computePreviewLinePlans(
  graph: BuildFlowPlanGraph,
  lineageByGroupId: Map<string, string> = new Map(),
): PreviewLinePlan[] {
  const consumerRequired = new Map<string, Set<string>>()
  const producerSupplied = new Map<string, Set<string>>()

  // 消费方通过 isolated 边声明它需要某 ware；供给方通过 isolated 边声明它提供某 ware
  for (const edge of graph.edges) {
    if (!edge.sourceLabel.includes('isolated')) continue

    const consumerSet = consumerRequired.get(edge.fromLineKey) || new Set<string>()
    consumerSet.add(edge.wareId)
    consumerRequired.set(edge.fromLineKey, consumerSet)

    const producerSet = producerSupplied.get(edge.toLineKey) || new Set<string>()
    producerSet.add(edge.wareId)
    producerSupplied.set(edge.toLineKey, producerSet)
  }

  const lines: PreviewLinePlan[] = []
  let respIdCounter = 0

  for (const [groupId, node] of graph.nodes) {
    const responsibilities: PreviewResponsibility[] = []
    const derivedSet = producerSupplied.get(groupId) || new Set<string>()
    const requiredSet = consumerRequired.get(groupId) || new Set<string>()

    for (const wareId of node.trackedWares) {
      const type: ResponsibilityType = derivedSet.has(wareId) ? 'derived-production' : 'derived-build-material'
      const relatedLineGroupIds = collectRelatedLineGroupsForBuildMaterial(groupId, wareId, graph)
      responsibilities.push({
        id: `resp_${++respIdCounter}`,
        type,
        wareId,
        relatedLineGroupIds,
        sourceRef: `graph:${groupId}:${wareId}`,
      })
    }

    for (const wareId of requiredSet) {
      // required Wares that are not already in trackedWares (consumers declaring need)
      // These are covered if another node produces them; for this line it's a required-production marker
      if (node.trackedWares.has(wareId)) continue
      responsibilities.push({
        id: `resp_${++respIdCounter}`,
        type: 'required-production',
        wareId,
        relatedLineGroupIds: [groupId],
        sourceRef: `graph-required:${groupId}:${wareId}`,
      })
    }

    if (responsibilities.length === 0) continue
    lines.push({
      groupId,
      groupName: node.lineName,
      isUnmatched: false,
      lineage: lineageByGroupId.get(groupId) || 'default',
      responsibilities,
    })
  }

  return lines
}

/**
 * 收集与建材责任相关的产线集合。
 * 对于产出 wareId 的产线，相关产线是所有消费该材料的产线。
 */
function collectRelatedLineGroupsForBuildMaterial(
  groupId: string,
  wareId: string,
  graph: BuildFlowPlanGraph,
): string[] {
  const related = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.wareId === wareId && edge.toLineKey === groupId && edge.fromLineKey !== '__C__') {
      related.add(edge.fromLineKey)
    }
  }
  return [...related]
}

/**
 * Preview 阶段入口 —— 返回 PreviewResult（含显式责任对象、依赖图、SCC）。
 * 同时合并 graph 责任与 production 责任（user-goal），确保重叠产线在求解前已合并。
 */
export function createBuildFlowPlanPreview(
  goals: BuildGoal[],
  groups: ProductionLineGroup[],
  buildFlowView: BuildFlowPlanView | null,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
  buildMaterialPlanningEnabled = true,
): PreviewResult | null {
  if (!buildFlowView) return null

  const modulesByOutputMap: Record<string, X4Module[]> = {}
  for (const mod of Object.values(modulesMap)) {
    if (!mod.outputs) continue
    for (const w of Object.keys(mod.outputs)) {
      if (!modulesByOutputMap[w]) modulesByOutputMap[w] = []
      modulesByOutputMap[w]!.push(mod)
    }
  }
  const allocations = groups.length > 0
    ? computeProductionLineAllocation(goals, groups, buildFlowView, modulesMap, modulesByOutputMap)
    : []

  if (!buildMaterialPlanningEnabled) {
    return {
      buildMaterialPlanningEnabled: false,
      lines: buildAllocationOnlyPreviewLines(allocations),
      graph: null,
      sccGroups: [],
    }
  }

  const lineageByGroupId = new Map<string, string>()
  for (const group of groups) {
    const lineage = group.isLocked ? (group.lockedLineage || group.subCategory) : group.subCategory
    lineageByGroupId.set(group.id, lineage || 'default')
  }

  const { targetModules } = buildTargetModulesForProductionLine(goals, groups, modulesMap, waresMap, settings)
  const graph = buildFlowPlanGraph(targetModules, buildFlowView, modulesMap, groups)

  // 1. Graph-based lines (derived-build-material + derived-production + required-production responsibilities)
  const graphLines = computePreviewLinePlans(graph, lineageByGroupId)

  // 2. Compute production allocations (target-production responsibilities)
  // 3. Merge: graph-based lines + target-production responsibilities from allocations
  const mergedLines = mergeGraphAndAllocationLines(graphLines, allocations, lineageByGroupId)

  return {
    buildMaterialPlanningEnabled: true,
    lines: mergedLines,
    graph,
    sccGroups: graph.sccGroups,
  }
}

/**
 * 合并 graph-based preview lines 与 production allocations。
 * 重叠产线（同一 groupId）的 responsibility 合并在一起；
 * 仅出现在 allocations 中的新产线单独加入。
 */
function mergeGraphAndAllocationLines(
  graphLines: PreviewLinePlan[],
  allocations: { groupId?: string; groupName: string; isUnmatched: boolean; goals: BuildGoal[] }[],
  lineageByGroupId: Map<string, string> = new Map(),
): PreviewLinePlan[] {
  const result: PreviewLinePlan[] = [...graphLines]
  const graphGroupIds = new Set(graphLines.map(l => l.groupId).filter(Boolean) as string[])
  const lineByGroupId = new Map(graphLines.map(line => [line.groupId, line]))

  const requiredConsumersByWare = new Map<string, Set<string>>()
  for (const graphLine of graphLines) {
    if (!graphLine.groupId) continue
    for (const responsibility of graphLine.responsibilities) {
      if (responsibility.type !== 'required-production') continue
      if (!responsibility.wareId) continue
      const consumers = requiredConsumersByWare.get(responsibility.wareId) || new Set<string>()
      consumers.add(graphLine.groupId)
      requiredConsumersByWare.set(responsibility.wareId, consumers)
    }
  }
  for (const alloc of allocations) {
    if (!alloc.groupId) continue
    for (const goal of alloc.goals) {
      if (goal.type !== 'required-production') continue
      const consumers = requiredConsumersByWare.get(goal.wareId) || new Set<string>()
      consumers.add(alloc.groupId)
      requiredConsumersByWare.set(goal.wareId, consumers)
    }
  }

  let respIdCounter = 0
  for (const alloc of allocations) {
    const isGraphOverlap = Boolean(alloc.groupId && graphGroupIds.has(alloc.groupId))
    const respLine: PreviewLinePlan = {
      groupId: alloc.groupId,
      groupName: alloc.groupName,
      isUnmatched: alloc.isUnmatched,
      lineage: (alloc.groupId && lineageByGroupId.get(alloc.groupId)) || 'default',
      responsibilities: alloc.goals
        .map(g => goalToResponsibility(g, `goal:${alloc.groupId || 'unmatched'}`, ++respIdCounter, alloc.groupId))
        .filter(resp => isGraphOverlap
          ? (resp.type === 'target-production' || resp.type === 'derived-production')
          : (resp.type === 'target-production' || resp.type === 'required-production')),
    }

    if (isGraphOverlap && alloc.groupId) {
      const existing = lineByGroupId.get(alloc.groupId)
      if (existing) {
        for (const responsibility of respLine.responsibilities) {
          if (responsibility.type === 'derived-production' && responsibility.wareId) {
            const consumers = requiredConsumersByWare.get(responsibility.wareId)
            responsibility.relatedLineGroupIds = consumers ? [...consumers] : []
          }
        }
        existing.responsibilities = dedupeResponsibilities([
          ...existing.responsibilities,
          ...respLine.responsibilities,
        ])
      }
    } else {
      result.push({
        ...respLine,
        responsibilities: dedupeResponsibilities(respLine.responsibilities),
      })
    }
  }

  const externalTargetGroupIds = allocations
    .filter(alloc => alloc.groupId && !graphGroupIds.has(alloc.groupId))
    .filter(alloc => alloc.goals.some(goal => goal.type === 'build-module' || goal.type === 'production-rate'))
    .map(alloc => alloc.groupId!)

  for (const line of result) {
    for (const responsibility of line.responsibilities) {
      if (responsibility.type !== 'derived-build-material') continue
      responsibility.relatedLineGroupIds = [...new Set([
        ...responsibility.relatedLineGroupIds,
        ...externalTargetGroupIds,
      ])]
    }
    line.responsibilities = dedupeResponsibilities(line.responsibilities)
  }

  return result
}

function dedupeResponsibilities(
  responsibilities: PreviewResponsibility[],
): PreviewResponsibility[] {
  const map = new Map<string, PreviewResponsibility>()
  for (const responsibility of responsibilities) {
    const relatedLineGroupIds = [...new Set(responsibility.relatedLineGroupIds)].sort()
    const key = [
      responsibility.type,
      responsibility.wareId || '',
      responsibility.moduleId || '',
      String(responsibility.count || ''),
      String(responsibility.ratePerHour || ''),
      relatedLineGroupIds.join(','),
    ].join('|')

    if (!map.has(key)) {
      map.set(key, {
        ...responsibility,
        relatedLineGroupIds,
      })
    }
  }
  return [...map.values()]
}

function buildAllocationOnlyPreviewLines(
  allocations: ProductionLineAllocation[],
): PreviewLinePlan[] {
  const requiredConsumersByWare = new Map<string, Set<string>>()
  for (const alloc of allocations) {
    if (!alloc.groupId) continue
    for (const goal of alloc.goals) {
      if (goal.type !== 'required-production') continue
      const consumers = requiredConsumersByWare.get(goal.wareId) || new Set<string>()
      consumers.add(alloc.groupId)
      requiredConsumersByWare.set(goal.wareId, consumers)
    }
  }

  let respIdCounter = 0
  return allocations.map((alloc) => {
    const responsibilities = alloc.goals
      .map(goal => goalToResponsibility(goal, `goal:${alloc.groupId || 'unmatched'}`, ++respIdCounter, alloc.groupId))
      .map((responsibility) => {
        if (responsibility.type !== 'derived-production' || !responsibility.wareId) return responsibility
        const consumers = requiredConsumersByWare.get(responsibility.wareId)
        return {
          ...responsibility,
          relatedLineGroupIds: consumers ? [...consumers] : [],
        }
      })

    return {
      groupId: alloc.groupId,
      groupName: alloc.groupName,
      isUnmatched: alloc.isUnmatched,
      lineage: alloc.lineage || 'default',
      responsibilities: dedupeResponsibilities(responsibilities),
    }
  })
}

// ─── Compute 阶段 ──────────────────────────────────────────────

/**
 * 合并单条产线的全部责任（三类责任合并）。
 */
export function mergeLineResponsibilities(
  line: PreviewLinePlan,
): PreviewResponsibility[] {
  return line.responsibilities
}

/**
 * 从责任挂接的 relatedLineGroupIds 收集建筑集合。
 */
export function collectBuildingsForResponsibilities(
  responsibilities: PreviewResponsibility[],
  preview: PreviewResult,
  resolvedModulesByGroupId?: Map<string, SavedModule[]>,
): SavedModule[] {
  const relatedGroupIds = new Set<string>()
  for (const resp of responsibilities) {
    for (const gid of resp.relatedLineGroupIds) {
      relatedGroupIds.add(gid)
    }
  }

  const modules: SavedModule[] = []
  if (!preview.graph) return modules
  for (const gid of relatedGroupIds) {
    const resolvedModules = resolvedModulesByGroupId?.get(gid)
    if (resolvedModules && resolvedModules.length > 0) {
      modules.push(...resolvedModules)
      continue
    }
    const node = preview.graph.nodes.get(gid)
    if (node && node.modules.length > 0) {
      modules.push(...node.modules)
    }
  }
  return mergeModules(modules)
}

/**
 * 从建筑集合计算目标速率：sum(qty) / sum(time)。
 */
export function computeTargetRatesFromBuildings(
  buildings: SavedModule[],
  modulesMap: Record<string, X4Module>,
): Record<string, number> {
  const totalQty: Record<string, number> = {}
  let totalBuildTime = 0

  for (const m of buildings) {
    const mod = modulesMap[m.id]
    if (!mod || !mod.buildCost) continue
    totalBuildTime += mod.buildTime * m.count
    for (const [wareId, qty] of Object.entries(mod.buildCost)) {
      if (wareId === 'energycells') continue
      totalQty[wareId] = (totalQty[wareId] || 0) + (qty as number) * m.count
    }
  }

  const rates: Record<string, number> = {}
  const totalHours = totalBuildTime / 3600
  if (totalHours > 0) {
    for (const [wareId, qty] of Object.entries(totalQty)) {
      rates[wareId] = qty / totalHours
    }
  }
  return rates
}

function computeTargetRatesForResponsibilities(
  responsibilities: PreviewResponsibility[],
  preview: PreviewResult,
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings,
): Record<string, number> {
  const targetProductionRates = collectTargetProductionRates(responsibilities)

  const rates: Record<string, number> = {}

  for (const responsibility of responsibilities) {
    if (responsibility.type !== 'derived-build-material') continue
    if (!responsibility.wareId) continue
    const buildings = collectBuildingsForResponsibilities(
      [responsibility],
      preview,
      resolvedModulesByGroupId,
    )
    const buildMaterialRates = computeTargetRatesFromBuildings(buildings, modulesMap)
    const rate = buildMaterialRates[responsibility.wareId] || 0
    const targetRate = targetProductionRates[responsibility.wareId] || 0
    const combinedRate = rate + targetRate
    if (combinedRate <= 0) continue
    rates[responsibility.wareId] = (rates[responsibility.wareId] || 0) + combinedRate
  }

  for (const responsibility of responsibilities) {
    if (responsibility.type !== 'derived-production') continue
    if (!responsibility.wareId) continue
    const operationalRate = computeOperationalDemandRateForWare(
      responsibility.wareId,
      responsibility.relatedLineGroupIds,
      preview,
      resolvedModulesByGroupId,
      modulesMap,
      settings,
    )
    const targetRate = targetProductionRates[responsibility.wareId] || 0
    const combinedRate = operationalRate + targetRate
    if (combinedRate <= 0) continue
    rates[responsibility.wareId] = (rates[responsibility.wareId] || 0) + combinedRate
  }

  return rates
}

function collectTargetProductionRates(
  responsibilities: PreviewResponsibility[],
): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const resp of responsibilities) {
    if (resp.type !== 'target-production') continue
    if (!resp.wareId) continue
    rates[resp.wareId] = (rates[resp.wareId] || 0) + (resp.ratePerHour || 0)
  }
  return rates
}

function computeOperationalDemandRateForWare(
  wareId: string,
  relatedLineGroupIds: string[],
  preview: PreviewResult,
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings,
): number {
  let totalRate = 0

  for (const groupId of relatedLineGroupIds) {
    const resolvedModules = resolvedModulesByGroupId.get(groupId)
    let modules: SavedModule[] = []
    if (resolvedModules && resolvedModules.length > 0) {
      modules = resolvedModules
    } else if (preview.graph) {
      const node = preview.graph.nodes.get(groupId)
      if (node) modules = node.modules
    }
    if (modules.length === 0) continue

    const netProduction = calculateNetProductionForModules(
      modules,
      modulesMap,
      settings.sunlight,
      settings.considerWorkforceForAutoFill,
    )
    const demand = -(netProduction[wareId] || 0)
    if (demand > 0) totalRate += demand
  }

  return totalRate
}

/**
 * Compute 阶段入口 —— 只读 PreviewResult，不重新分配责任。
 * 重叠产线（同一 groupId 同时有 graph 责任与 target-production 责任）在求解前已合并责任。
 */
export function computeBuildFlowPlan(
  input: ComputeInput,
): ComputeResult {
  const { preview, modulesMap, waresMap, settings } = input
  const graph = preview.graph ?? createEmptyGraph()
  const allocationGoalsByGroupId = new Map<string, BuildGoal[]>()
  const resolvedModulesByGroupId = new Map<string, SavedModule[]>()
  const lineResultsByGroupId = new Map<string, ComputeLineResult>()
  const linesByGroupId = new Map<string, PreviewLinePlan>()

  for (const line of preview.lines) {
    if (!line.groupId) continue
    linesByGroupId.set(line.groupId, line)
  }

  seedResolvedModulesFromTargets(
    preview.lines,
    resolvedModulesByGroupId,
    allocationGoalsByGroupId,
    lineResultsByGroupId,
    graph,
    modulesMap,
    waresMap,
    settings,
  )

  const graphOrder = buildTopologicalOrder(graph).flatMap(entry => Array.isArray(entry) ? entry : [entry])
    .filter(groupId => linesByGroupId.has(groupId))
  const fallbackOrder = preview.lines
    .map(line => line.groupId)
    .filter((groupId): groupId is string => Boolean(groupId))
  const iterationOrder = graphOrder.length > 0 ? graphOrder : fallbackOrder

  if (iterationOrder.length > 0) {
    let iterations = 60

    while (iterations-- > 0) {
      let stable = true

      for (const groupId of iterationOrder) {
        const previewLine = linesByGroupId.get(groupId)
        if (!previewLine) continue

        const lineResult = computeLineResult(
          previewLine,
          preview,
          resolvedModulesByGroupId,
          modulesMap,
          waresMap,
          settings,
        )
        const previous = lineResultsByGroupId.get(groupId)
        const snapshot = makePrimarySnapshot(lineResult.primaryModules)
        const previousSnapshot = previous ? makePrimarySnapshot(previous.primaryModules) : ''

        if (snapshot !== previousSnapshot) stable = false

        lineResultsByGroupId.set(groupId, lineResult)
        allocationGoalsByGroupId.set(groupId, buildGoalsFromResponsibilities(lineResult.mergedResponsibilities, lineResult.targetRates))
        resolvedModulesByGroupId.set(groupId, lineResult.allModules)
        syncGraphNodeComputedState(graph, lineResult, modulesMap, settings)
      }

      if (stable) break
    }
  }

  const lines: ComputeLineResult[] = []
  for (const previewLine of preview.lines) {
    if (previewLine.groupId && lineResultsByGroupId.has(previewLine.groupId)) {
      lines.push(lineResultsByGroupId.get(previewLine.groupId)!)
      continue
    }

    const lineResult = computeLineResult(
      previewLine,
      preview,
      resolvedModulesByGroupId,
      modulesMap,
      waresMap,
      settings,
    )
    if (previewLine.groupId) {
      allocationGoalsByGroupId.set(previewLine.groupId, buildGoalsFromResponsibilities(lineResult.mergedResponsibilities, lineResult.targetRates))
    }
    lines.push(lineResult)
  }

  const compatAllocations = preview.lines.map((previewLine, index) => {
    const computedLine = lines[index]
    const goals = previewLine.groupId
      ? allocationGoalsByGroupId.get(previewLine.groupId) || []
      : computedLine
        ? buildGoalsFromResponsibilities(computedLine.mergedResponsibilities, computedLine.targetRates)
        : []
    return toCompatAllocation(previewLine, goals)
  })

  const schemeGroups = preview.buildMaterialPlanningEnabled
    ? makeSchemesWithGroups(
      graph,
      compatAllocations,
      modulesMap,
      waresMap,
      settings,
    )
    : [
      {
        groupType: 'production' as const,
        groupLabel: 'Production Lines',
        schemes: splitTargetLineSchemes(compatAllocations, modulesMap, waresMap, settings),
      }
    ]

  if (preview.buildMaterialPlanningEnabled) {
    const groupIdByName = new Map<string, string>()
    for (const line of lines) {
      if (!line.groupId) continue
      groupIdByName.set(line.groupName, line.groupId)
    }

    const schemeByGroupId = new Map<string, BuildScheme>()
    for (const schemeGroup of schemeGroups) {
      for (const scheme of schemeGroup.schemes) {
        const groupId = groupIdByName.get(scheme.label)
        if (groupId) schemeByGroupId.set(groupId, scheme)
      }
    }

    for (const line of lines) {
      if (!line.groupId) continue
      const node = graph.nodes.get(line.groupId)
      if (!node) continue
      node.demandAnalysis = buildDemandDetailForLine(
        line,
        schemeByGroupId,
        modulesMap,
      )
    }
  }

  return { lines, schemeGroups }
}

function seedResolvedModulesFromTargets(
  previewLines: PreviewLinePlan[],
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  allocationGoalsByGroupId: Map<string, BuildGoal[]>,
  lineResultsByGroupId: Map<string, ComputeLineResult>,
  graph: BuildFlowPlanGraph,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): void {
  for (const previewLine of previewLines) {
    const groupId = previewLine.groupId
    if (!groupId) continue
    const seedResponsibilities = previewLine.responsibilities.filter(resp =>
      resp.type === 'target-production' || resp.type === 'required-production'
    )
    if (seedResponsibilities.length === 0) continue

    const targetRates: Record<string, number> = {}
    const goals = buildGoalsFromResponsibilities(seedResponsibilities, targetRates)
    const allModules = computeGoalModules(goals, modulesMap, waresMap, settings, previewLine.lineage)
    const primaryModules = separatePrimaryModules(allModules, goals, modulesMap)
    const auxiliaryModules = separateAuxiliaryModules(allModules, primaryModules)
    const lineResult: ComputeLineResult = {
      groupId: previewLine.groupId,
      groupName: previewLine.groupName,
      mergedResponsibilities: mergeLineResponsibilities(previewLine),
      relatedLineGroupIds: [...new Set(previewLine.responsibilities.flatMap(resp => resp.relatedLineGroupIds))],
      targetRates,
      primaryModules,
      auxiliaryModules,
      allModules,
    }

    resolvedModulesByGroupId.set(groupId, allModules)
    allocationGoalsByGroupId.set(groupId, buildGoalsFromResponsibilities(lineResult.mergedResponsibilities, targetRates))
    lineResultsByGroupId.set(groupId, lineResult)
    syncGraphNodeComputedState(graph, lineResult, modulesMap, settings)
  }
}

function computeLineResult(
  previewLine: PreviewLinePlan,
  preview: PreviewResult,
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): ComputeLineResult {
  const mergedResponsibilities = mergeLineResponsibilities(previewLine)
  const targetRates = computeTargetRatesForResponsibilities(
    mergedResponsibilities,
    preview,
    resolvedModulesByGroupId,
    modulesMap,
    settings,
  )
  const mergedGoals = buildGoalsFromResponsibilities(mergedResponsibilities, targetRates)
  const allModules = computeGoalModules(mergedGoals, modulesMap, waresMap, settings, previewLine.lineage)
  const primaryModules = separatePrimaryModules(allModules, mergedGoals, modulesMap)
  const auxiliaryModules = separateAuxiliaryModules(allModules, primaryModules)

  return {
    groupId: previewLine.groupId,
    groupName: previewLine.groupName,
    mergedResponsibilities,
    relatedLineGroupIds: [...new Set(mergedResponsibilities.flatMap(r => r.relatedLineGroupIds))],
    targetRates,
    primaryModules,
    auxiliaryModules,
    allModules,
  }
}

function makePrimarySnapshot(
  modules: SavedModule[],
): string {
  return modules
    .map(module => `${module.id}:${module.count}`)
    .sort()
    .join(';')
}

function syncGraphNodeComputedState(
  graph: BuildFlowPlanGraph,
  lineResult: ComputeLineResult,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings,
): void {
  if (!lineResult.groupId) return
  const node = graph.nodes.get(lineResult.groupId)
  if (!node) return

  node.modules = lineResult.allModules
  node.buildGroups = [{ reason: node.lineName, modules: lineResult.allModules }]
  node.moduleIds = lineResult.primaryModules.map(module => module.id)
  node.netProduction = calculateNetProductionForModules(
    lineResult.allModules,
    modulesMap,
    settings.sunlight,
    settings.considerWorkforceForAutoFill,
  )
}

function calculateNetProductionForModules(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  sunlight: number,
  considerWorkforceForAutoFill: boolean,
): Record<string, number> {
  const rates: Record<string, number> = {}

  for (const module of modules) {
    const definition = modulesMap[module.id]
    if (!definition) continue

    const bonusFactor = considerWorkforceForAutoFill ? 1.3 : 1.0

    for (const [wareId, rate] of Object.entries(definition.outputs || {})) {
      const sunlightFactor = wareId === 'energycells' ? sunlight / 100 : 1
      rates[wareId] = (rates[wareId] || 0) + module.count * rate * bonusFactor * sunlightFactor
    }
    for (const [wareId, rate] of Object.entries(definition.inputs || {})) {
      rates[wareId] = (rates[wareId] || 0) - module.count * rate
    }
  }

  return rates
}

function summarizeBuildModules(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
): { seconds: number; materials: Record<string, number> } {
  let seconds = 0
  const materials: Record<string, number> = {}

  for (const module of modules) {
    const mod = modulesMap[module.id]
    if (!mod) continue
    seconds += mod.buildTime * module.count
    for (const [wareId, qty] of Object.entries(mod.buildCost || {})) {
      if (wareId === 'energycells') continue
      materials[wareId] = (materials[wareId] || 0) + qty * module.count
    }
  }

  return { seconds, materials }
}

function buildDemandDetailForLine(
  line: ComputeLineResult,
  schemeByGroupId: Map<string, BuildScheme>,
  modulesMap: Record<string, X4Module>,
): DemandDetail {
  const trackedWares = new Set(
    line.mergedResponsibilities
      .filter(resp => resp.type !== 'required-production' && resp.wareId)
      .map(resp => resp.wareId!),
  )
  const buildMaterialWares = new Set(
    line.mergedResponsibilities
      .filter(resp => resp.type === 'derived-build-material' && resp.wareId)
      .map(resp => resp.wareId!),
  )
  const perWareSources: Record<string, { label: string; qty: number; seconds: number; rate: number }[]> = {}
  const buildSourceSecondsByWare = new Map<string, Map<string, number>>()
  const buildMaterialQtyByWare: Record<string, number> = {}

  for (const responsibility of line.mergedResponsibilities) {
    if (!responsibility.wareId) continue
    if (!trackedWares.has(responsibility.wareId)) continue
    if (responsibility.type === 'required-production') continue

    for (const relatedGroupId of responsibility.relatedLineGroupIds) {
      const relatedScheme = schemeByGroupId.get(relatedGroupId)
      if (!relatedScheme) continue
      if (responsibility.type === 'derived-build-material') {
        const { seconds, materials } = summarizeBuildModules(relatedScheme.modules, modulesMap)
        if (seconds <= 0) continue
        const qty = materials[responsibility.wareId] || 0
        if (qty <= 0) continue

        pushDemandEntry(
          perWareSources,
          responsibility.wareId,
          relatedScheme.label,
          qty,
          seconds,
        )
        const wareSeconds = buildSourceSecondsByWare.get(responsibility.wareId) || new Map<string, number>()
        if (!wareSeconds.has(relatedScheme.label)) {
          wareSeconds.set(relatedScheme.label, seconds)
        }
        buildSourceSecondsByWare.set(responsibility.wareId, wareSeconds)
        buildMaterialQtyByWare[responsibility.wareId] = (buildMaterialQtyByWare[responsibility.wareId] || 0) + qty
      }
    }
  }

  const aggregateRates: Record<string, number> = {}
  const gapRates: Record<string, number> = {}
  for (const [wareId, rate] of Object.entries(line.targetRates)) {
    if (buildMaterialWares.has(wareId)) {
      aggregateRates[wareId] = rate
    }
  }
  for (const responsibility of line.mergedResponsibilities) {
    if (responsibility.type !== 'derived-production') continue
    if (!responsibility.wareId) continue
    let rate = 0
    for (const relatedGroupId of responsibility.relatedLineGroupIds) {
      const relatedScheme = schemeByGroupId.get(relatedGroupId)
      if (!relatedScheme) continue
      rate += Math.max(0, -((relatedScheme.netProduction || {})[responsibility.wareId] || 0))
    }
    if (rate > 0) {
      gapRates[responsibility.wareId] = (gapRates[responsibility.wareId] || 0) + rate
    }
  }

  const perWareTotals: Record<string, { seconds: number; qty: number }> = {}
  let totalSeconds = 0
  let totalMaterialQty = 0
  for (const wareId of Object.keys(perWareSources)) {
    const buildSourceSeconds = buildSourceSecondsByWare.get(wareId)
    if (buildSourceSeconds && buildSourceSeconds.size > 0) {
      let seconds = 0
      for (const sourceSeconds of buildSourceSeconds.values()) {
        seconds += sourceSeconds
      }
      const qty = buildMaterialQtyByWare[wareId] || 0
      perWareTotals[wareId] = { seconds, qty }
      totalSeconds += seconds
      totalMaterialQty += qty
    }
  }

  return {
    perWareSources,
    aggregateRates,
    gapRates,
    targetRates: { ...line.targetRates },
    perWareTotals,
    totalSeconds,
    totalMaterialQty,
  }
}

function pushDemandEntry(
  perWareSources: Record<string, { label: string; qty: number; seconds: number; rate: number }[]>,
  wareId: string,
  label: string,
  qty: number,
  seconds: number,
): void {
  const entries = perWareSources[wareId] || []
  const existing = entries.find(entry => entry.label === label && entry.seconds === seconds)
  if (existing) {
    existing.qty += qty
    existing.rate = existing.qty / (existing.seconds / 3600)
  } else {
    entries.push({
      label,
      qty,
      seconds,
      rate: qty / (seconds / 3600),
    })
  }
  perWareSources[wareId] = entries
}

/**
 * 从 target-production 责任计算需要的模块（不含 autoFill）。
 */
function computeGoalModules(
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  lineage: string = 'argon',
): SavedModule[] {
  const baseModules = expandGoalsRespectingLockedWares(goals, modulesMap, waresMap, lineage)
  const merged = mergeModules(baseModules)
  const autoFill = autoFillForLine(merged, goals, settings, modulesMap, waresMap)
  return mergeModules([...merged, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
}

function expandGoalsRespectingLockedWares(
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  racePreference: string,
): SavedModule[] {
  const lockedWares = new Set(
    goals
      .filter((goal): goal is Extract<BuildGoal, { type: 'required-production' }> => goal.type === 'required-production')
      .map(goal => goal.wareId),
  )
  const required: Record<string, number> = {}

  function addModule(moduleId: string, count: number): void {
    required[moduleId] = (required[moduleId] || 0) + count
  }

  function expandWareUpstream(wareId: string, targetRate: number, visited: Set<string>): void {
    if (lockedWares.has(wareId)) return
    if (visited.has(wareId)) return
    visited.add(wareId)

    const producer = findBestProducer(wareId, racePreference, [], modulesMap, waresMap)
    if (!producer) return
    const outputRate = producer.outputs[wareId] || 0
    if (outputRate <= 0) return

    const countNeeded = Math.ceil(targetRate / outputRate)
    addModule(producer.id, countNeeded)

    for (const [inputWare, inputRate] of Object.entries(producer.inputs)) {
      if (lockedWares.has(inputWare)) continue
      const ware = waresMap[inputWare]
      const isResource = ware?.transport === 'solid' || ware?.transport === 'liquid'
      const hasProducer = Object.values(modulesMap).some(module => module.outputs[inputWare] && module.type === 'production')
      if (!isResource && hasProducer) {
        expandWareUpstream(inputWare, inputRate * countNeeded, visited)
      }
    }
  }

  for (const goal of goals) {
    if (goal.type === 'build-module') {
      addModule(goal.moduleId, goal.count)
      continue
    }
    if (goal.type === 'required-production') continue

    if (
      goal.type === 'production-rate'
      || goal.type === 'derived-production'
      || goal.type === 'derived-build-material'
    ) {
      expandWareUpstream(goal.wareId, goal.ratePerHour, new Set())
    }
  }

  return Object.entries(required).map(([id, count]) => ({ id, count }))
}

function buildGoalsFromResponsibilities(
  responsibilities: PreviewResponsibility[],
  targetRates: Record<string, number>,
): BuildGoal[] {
  const moduleGoals: BuildGoal[] = []
  const wareKinds = new Map<string, { hasDerivedBuildMaterial: boolean; hasDerivedProduction: boolean; hasRequiredProduction: boolean; manualRate: number }>()

  for (const responsibility of responsibilities) {
    if (responsibility.type === 'target-production') {
      if (responsibility.moduleId) {
        moduleGoals.push({
          type: 'build-module',
          moduleId: responsibility.moduleId,
          count: responsibility.count || 1,
        })
        continue
      }
      if (responsibility.wareId) {
        const current = wareKinds.get(responsibility.wareId) || {
          hasDerivedBuildMaterial: false,
          hasDerivedProduction: false,
          hasRequiredProduction: false,
          manualRate: 0,
        }
        current.manualRate += responsibility.ratePerHour || 0
        wareKinds.set(responsibility.wareId, current)
      }
      continue
    }

    if (!responsibility.wareId) continue
    const current = wareKinds.get(responsibility.wareId) || {
      hasDerivedBuildMaterial: false,
      hasDerivedProduction: false,
      hasRequiredProduction: false,
      manualRate: 0,
    }
    if (responsibility.type === 'derived-build-material') current.hasDerivedBuildMaterial = true
    if (responsibility.type === 'derived-production') current.hasDerivedProduction = true
    if (responsibility.type === 'required-production') current.hasRequiredProduction = true
    wareKinds.set(responsibility.wareId, current)
  }

  const goals: BuildGoal[] = [...moduleGoals]
  for (const [wareId, kinds] of wareKinds) {
    const ratePerHour = targetRates[wareId] || 0
    if (kinds.hasDerivedProduction) {
      if (ratePerHour <= 0) continue
      goals.push({
        type: 'derived-production',
        wareId,
        ratePerHour,
      })
      continue
    }
    if (kinds.hasDerivedBuildMaterial) {
      if (ratePerHour <= 0) continue
      goals.push({
        type: 'derived-build-material',
        wareId,
        ratePerHour,
      })
      continue
    }
    if (kinds.manualRate > 0) {
      goals.push({
        type: 'production-rate',
        wareId,
        ratePerHour: kinds.manualRate,
      })
    }
  }

  for (const [wareId, kinds] of wareKinds) {
    if (!kinds.hasRequiredProduction) continue
    goals.push({
      type: 'required-production',
      wareId,
      ratePerHour: targetRates[wareId] || 0,
    })
  }
  return goals
}

function separatePrimaryModules(
  allModules: SavedModule[],
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
): SavedModule[] {
  const targetWares = new Set<string>()
  const targetModules = new Set<string>()
  for (const goal of goals) {
    if ('wareId' in goal && goal.wareId && goal.type !== 'required-production') targetWares.add(goal.wareId)
    if (goal.type === 'build-module') targetModules.add(goal.moduleId)
  }

  const primary = allModules.filter(m => {
    if (targetModules.has(m.id)) return true
    const mod = modulesMap[m.id]
    if (!mod?.outputs) return false
    return Object.keys(mod.outputs).some(w => targetWares.has(w))
  })

  return primary
}

/**
 * 分离辅助模块：非主要模块的部分。
 */
function separateAuxiliaryModules(
  allModules: SavedModule[],
  primaryModules: SavedModule[],
): SavedModule[] {
  const remainingCounts = new Map<string, number>()
  for (const module of primaryModules) {
    remainingCounts.set(module.id, (remainingCounts.get(module.id) || 0) + module.count)
  }

  const auxiliary: SavedModule[] = []
  for (const module of allModules) {
    const primaryCount = remainingCounts.get(module.id) || 0
    if (primaryCount <= 0) {
      auxiliary.push(module)
      continue
    }
    if (module.count > primaryCount) {
      auxiliary.push({ id: module.id, count: module.count - primaryCount })
    }
    remainingCounts.set(module.id, Math.max(0, primaryCount - module.count))
  }
  return auxiliary
}

/**
 * 兼容转换：PreviewLinePlan → ProductionLineAllocation（供现有 makeSchemesWithGroups 使用）。
 */
function toCompatAllocation(
  line: PreviewLinePlan,
  goals: BuildGoal[],
): ProductionLineAllocation {
  return {
    groupId: line.groupId,
    groupName: line.groupName,
    isUnmatched: line.isUnmatched,
    lineage: line.lineage,
    goals,
  }
}

// ─── 保留旧接口作为兼容层 ──────────────────────────────────────

/**
 * @deprecated 使用 computeBuildFlowPlan(ComputeInput) 代替。
 */
export function computeBuildFlowPlanSchemeGroups(
  _graph: BuildFlowPlanGraph,
  goals: BuildGoal[],
  groups: ProductionLineGroup[],
  buildFlowView: BuildFlowPlanView | null,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  modulesByOutputMap: Record<string, X4Module[]>,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
  _groupLabels?: { buildMaterial: string; production: string },
): {
  lineAllocations: ProductionLineAllocation[]
  schemeGroups: BuildSchemeGroup[]
} {
  // 用新 preview → compute 流程实现
  const preview = createBuildFlowPlanPreview(goals, groups, buildFlowView, modulesMap, waresMap, settings)
  if (!preview) {
    return { lineAllocations: [], schemeGroups: [] }
  }

  const result = computeBuildFlowPlan({
    preview,
    modulesMap,
    waresMap,
    modulesByOutputMap,
    settings,
  })

  return {
    lineAllocations: result.lines.map(line => ({
      groupId: line.groupId,
      groupName: line.groupName,
      isUnmatched: false,
      lineage: preview.lines.find(pl => pl.groupId === line.groupId)?.lineage || 'default',
      goals: buildGoalsFromResponsibilities(line.mergedResponsibilities, line.targetRates),
    })),
    schemeGroups: result.schemeGroups,
  }
}

function goalToResponsibility(
  goal: BuildGoal,
  sourceRef: string,
  idSuffix: number,
  groupId?: string,
): PreviewResponsibility {
  const base = {
    id: `resp_goal_${groupId || 'unmatched'}_${idSuffix}`,
    relatedLineGroupIds: groupId ? [groupId] : [],
    sourceRef,
  }

  if (goal.type === 'build-module') {
    return {
      ...base,
      type: 'target-production',
      moduleId: goal.moduleId,
      count: goal.count,
    }
  }

  if (goal.type === 'production-rate') {
    return {
      ...base,
      type: 'target-production',
      wareId: goal.wareId,
      ratePerHour: goal.ratePerHour,
    }
  }

  if (goal.type === 'derived-build-material') {
    return {
      ...base,
      type: 'derived-build-material',
      wareId: goal.wareId,
      ratePerHour: goal.ratePerHour,
    }
  }

  return {
    ...base,
    type: goal.type === 'required-production' ? 'required-production' : 'derived-production',
    wareId: 'wareId' in goal ? goal.wareId : undefined,
    ratePerHour: 'ratePerHour' in goal ? goal.ratePerHour : undefined,
  }
}
