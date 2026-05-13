import { buildFlowPlanGraph, ROOT_BUILD_COST_KEY } from '@/store/logic/buildFlowPlanGraph'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'
import { findBestProducer } from '@/store/logic/bestModuleSelector'
import {
  autoFillForLine,
  buildTopologicalOrder,
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
  PreviewDerivedItem,
  PreviewDerivedTag,
  PreviewItem,
  PreviewLinePlan,
  PreviewResult,
  PreviewRequiredTag,
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

function collectExpandedModulesFromGroup(
  groupId: string,
  groups: ProductionLineGroup[],
): SavedModule[] {
  const group = groups.find(item => item.id === groupId)
  if (!group) return []

  return mergeModules(
    group.nodes
      .filter(node => !node.isIsolated && node.moduleId)
      .map(node => ({ id: node.moduleId!, count: 1 })),
  )
}

function extractTargetGoalWares(
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
): string[] {
  const wares = new Set<string>()
  for (const goal of goals) {
    if (goal.type === 'production-rate') {
      wares.add(goal.wareId)
      continue
    }
    if (goal.type !== 'build-module') continue
    const module = modulesMap[goal.moduleId]
    if (!module?.outputs) continue
    for (const wareId of Object.keys(module.outputs)) {
      wares.add(wareId)
    }
  }
  return [...wares]
}

export function buildPreviewTargetModulesForProductionLine(
  goals: BuildGoal[],
  allocations: ProductionLineAllocation[],
  groups: ProductionLineGroup[],
): SavedModule[] {
  const targetModules: SavedModule[] = []
  const coveredGroupIds = new Set<string>()

  for (const allocation of allocations) {
    const hasTargetGoal = allocation.goals.some(goal =>
      goal.type === 'build-module' || goal.type === 'production-rate',
    )
    if (!hasTargetGoal) continue

    if (allocation.groupId) {
      if (coveredGroupIds.has(allocation.groupId)) continue
      coveredGroupIds.add(allocation.groupId)
      targetModules.push(...collectExpandedModulesFromGroup(allocation.groupId, groups))
      continue
    }

    for (const goal of allocation.goals) {
      if (goal.type !== 'build-module') continue
      targetModules.push({ id: goal.moduleId, count: 1 })
    }
  }

  if (targetModules.length > 0) {
    return mergeModules(targetModules)
  }

  for (const goal of goals) {
    if (goal.type !== 'build-module') continue
    targetModules.push({ id: goal.moduleId, count: 1 })
  }

  return mergeModules(targetModules)
}

/**
 * 从依赖图构建 PreviewLinePlan[]（带显式责任对象）。
 * 消费方 → 供给方 的边方向保持一致。
 */
export function computePreviewLinePlans(
  graph: BuildFlowPlanGraph,
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  lineageByGroupId: Map<string, string> = new Map(),
): PreviewLinePlan[] {
  const groupById = new Map(groups.map(group => [group.id, group]))
  const consumerRequired = new Map<string, Set<string>>()
  const producerSupplied = new Map<string, Set<string>>()
  const producerBuildMaterial = new Map<string, Set<string>>()

  // 消费方通过 isolated 边声明它需要某 ware；供给方通过 isolated 边声明它提供某 ware
  for (const edge of graph.edges) {
    if (edge.fromLineKey !== ROOT_BUILD_COST_KEY) {
      const producerSet = producerBuildMaterial.get(edge.toLineKey) || new Set<string>()
      producerSet.add(edge.wareId)
      producerBuildMaterial.set(edge.toLineKey, producerSet)
    }

    if (!edge.sourceLabel.includes('isolated')) continue

    const consumerSet = consumerRequired.get(edge.fromLineKey) || new Set<string>()
    consumerSet.add(edge.wareId)
    consumerRequired.set(edge.fromLineKey, consumerSet)

    const producerSet = producerSupplied.get(edge.toLineKey) || new Set<string>()
    producerSet.add(edge.wareId)
    producerSupplied.set(edge.toLineKey, producerSet)
  }

  const lines: PreviewLinePlan[] = []

  for (const [groupId, node] of graph.nodes) {
    const items: PreviewItem[] = []
    const derivedSet = producerSupplied.get(groupId) || new Set<string>()
    const buildMaterialSet = producerBuildMaterial.get(groupId) || new Set<string>()
    const requiredSet = consumerRequired.get(groupId) || new Set<string>()
    const group = groupById.get(groupId)
    const lineage = lineageByGroupId.get(groupId) || 'default'

    for (const wareId of node.trackedWares) {
      const derivedTags: PreviewDerivedTag[] = []
      if (buildMaterialSet.has(wareId)) derivedTags.push('build-material')
      if (derivedSet.has(wareId)) derivedTags.push('production')
      if (derivedTags.length === 0) derivedTags.push('build-material')
      const relatedLineGroupIds = collectRelatedLineGroupsForBuildMaterial(groupId, wareId, graph)
      const moduleId = resolvePreviewDerivedModuleId(wareId, group, lineage, modulesMap, waresMap)
      if (!moduleId) continue
      items.push({
        kind: 'derived',
        wareId,
        moduleId,
        derived: derivedTags,
        relatedLineGroupIds,
        sourceRef: `graph:${groupId}:${wareId}`,
      })
    }

    for (const wareId of requiredSet) {
      if (node.trackedWares.has(wareId)) continue
      items.push({
        kind: 'required',
        wareId,
        required: ['production'],
        relatedLineGroupIds: [groupId],
        sourceRef: `graph-required:${groupId}:${wareId}`,
      })
    }

    if (items.length === 0) continue
    lines.push({
      groupId,
      groupName: node.lineName,
      isUnmatched: false,
      lineage,
      items: mergePreviewItems(items),
    })
  }

  return lines
}

function resolvePreviewDerivedModuleId(
  wareId: string,
  group: ProductionLineGroup | undefined,
  lineage: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
): string | null {
  if (!group) {
    const producer = findBestProducer(wareId, lineage, [], modulesMap, waresMap)
    return producer?.id || null
  }

  const manualMatches = group.nodes.filter(node =>
    node.source === 'manual'
    && !node.isIsolated
    && node.wareId === wareId
    && node.moduleId,
  )
  const manualLineageMatches = manualMatches.filter(node => node.lineage === lineage)
  if (manualLineageMatches.length > 0) return manualLineageMatches[0]!.moduleId || null
  if (manualMatches.length > 0) return manualMatches[0]!.moduleId || null

  const autoMatches = group.nodes.filter(node =>
    node.source === 'auto'
    && !node.isIsolated
    && node.wareId === wareId
    && node.moduleId,
  )
  const autoLineageMatches = autoMatches.filter(node => node.lineage === lineage)
  if (autoLineageMatches.length > 0) return autoLineageMatches[0]!.moduleId || null
  if (autoMatches.length > 0) return autoMatches[0]!.moduleId || null

  const producer = findBestProducer(wareId, lineage, [], modulesMap, waresMap)
  return producer?.id || null
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
    if (edge.wareId === wareId && edge.toLineKey === groupId && edge.fromLineKey !== ROOT_BUILD_COST_KEY) {
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
  const modulesByOutputMap: Record<string, X4Module[]> = {}
  for (const mod of Object.values(modulesMap)) {
    if (!mod.outputs) continue
    for (const w of Object.keys(mod.outputs)) {
      if (!modulesByOutputMap[w]) modulesByOutputMap[w] = []
      modulesByOutputMap[w]!.push(mod)
    }
  }
  const allocations = computeProductionLineAllocation(goals, groups, buildFlowView, modulesMap, modulesByOutputMap)

  if (!buildFlowView) {
    return {
      buildMaterialPlanningEnabled,
      lines: buildAllocationOnlyPreviewLines(allocations, modulesMap, waresMap, settings),
      graph: null,
      sccGroups: [],
    }
  }

  if (!buildMaterialPlanningEnabled) {
    return {
      buildMaterialPlanningEnabled: false,
      lines: buildAllocationOnlyPreviewLines(allocations, modulesMap, waresMap, settings),
      graph: null,
      sccGroups: [],
    }
  }

  const lineageByGroupId = new Map<string, string>()
  for (const group of groups) {
    const lineage = group.isLocked ? (group.lockedLineage || group.subCategory) : group.subCategory
    lineageByGroupId.set(group.id, lineage || 'default')
  }

  const targetModules = buildPreviewTargetModulesForProductionLine(goals, allocations, groups)
  const targetGroupIds = allocations
    .filter(a => a.groupId && a.goals.some(g => g.type === 'build-module' || g.type === 'production-rate'))
    .map(a => a.groupId!)
  const graph = buildFlowPlanGraph(targetModules, buildFlowView, modulesMap, groups, targetGroupIds)
  graph.targetGoalWareIds = extractTargetGoalWares(goals, modulesMap)

  // 1. Graph-based lines (derived-build-material + derived-production + required-production responsibilities)
  const graphLines = computePreviewLinePlans(graph, groups, modulesMap, waresMap, lineageByGroupId)

  // 2. Compute production allocations (target-production responsibilities)
  // 3. Merge: graph-based lines + target-production responsibilities from allocations
  const mergedLines = mergeGraphAndAllocationLines(graphLines, allocations, lineageByGroupId, modulesMap, waresMap, settings)

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
  allocations: { groupId?: string; groupName: string; isUnmatched: boolean; goals: BuildGoal[]; lineage: string }[],
  lineageByGroupId: Map<string, string> = new Map(),
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
): PreviewLinePlan[] {
  const result: PreviewLinePlan[] = [...graphLines]
  const graphGroupIds = new Set(graphLines.map(l => l.groupId).filter(Boolean) as string[])
  const lineByGroupId = new Map(graphLines.map(line => [line.groupId, line]))

  const requiredConsumersByWare = new Map<string, Set<string>>()
  for (const graphLine of graphLines) {
    if (!graphLine.groupId) continue
    for (const item of graphLine.items) {
      if (item.kind !== 'required') continue
      const consumers = requiredConsumersByWare.get(item.wareId) || new Set<string>()
      consumers.add(graphLine.groupId)
      requiredConsumersByWare.set(item.wareId, consumers)
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

  for (const alloc of allocations) {
    const isGraphOverlap = Boolean(alloc.groupId && graphGroupIds.has(alloc.groupId))
    const respLine: PreviewLinePlan = {
      groupId: alloc.groupId,
      groupName: alloc.groupName,
      isUnmatched: alloc.isUnmatched,
      lineage: (alloc.groupId && lineageByGroupId.get(alloc.groupId)) || 'default',
      items: alloc.goals
        .map(g => goalToPreviewItem(
          g,
          `goal:${alloc.groupId || 'unmatched'}`,
          respLineLineage(alloc.groupId, alloc.lineage, lineageByGroupId),
          modulesMap,
          waresMap,
          alloc.groupId,
          settings,
        ))
        .filter((item): item is PreviewItem => Boolean(item))
        .filter(item => isGraphOverlap
          ? item.kind === 'derived'
          : true),
    }

    if (isGraphOverlap && alloc.groupId) {
      const existing = lineByGroupId.get(alloc.groupId)
      if (existing) {
        for (const item of respLine.items) {
          if (item.kind === 'derived' && item.wareId && item.derived.includes('production')) {
            const consumers = requiredConsumersByWare.get(item.wareId)
            item.relatedLineGroupIds = consumers ? [...consumers] : []
          }
        }
        existing.items = mergePreviewItems([...existing.items, ...respLine.items])
      }
    } else {
      result.push({
        ...respLine,
        items: mergePreviewItems(respLine.items),
      })
    }
  }

  const externalTargetGroupIds = allocations
    .filter(alloc => alloc.groupId && !graphGroupIds.has(alloc.groupId))
    .filter(alloc => alloc.goals.some(goal => goal.type === 'build-module' || goal.type === 'production-rate'))
    .map(alloc => alloc.groupId!)

  for (const line of result) {
    for (const item of line.items) {
      if (item.kind !== 'derived' || !item.derived.includes('build-material')) continue
      item.relatedLineGroupIds = [...new Set([
        ...item.relatedLineGroupIds,
        ...externalTargetGroupIds,
      ])]
    }
    line.items = mergePreviewItems(line.items)
  }

  return result
}

function respLineLineage(
  groupId: string | undefined,
  allocationLineage: string,
  lineageByGroupId: Map<string, string>,
): string {
  return (groupId && lineageByGroupId.get(groupId)) || allocationLineage || 'default'
}

function mergePreviewItems(
  items: PreviewItem[],
): PreviewItem[] {
  const map = new Map<string, PreviewItem>()
  for (const item of items) {
    const relatedLineGroupIds = [...new Set(item.relatedLineGroupIds)].sort()
    const key = item.kind === 'derived'
      ? ['derived', item.wareId || '', item.moduleId].join('|')
      : ['required', item.wareId].join('|')

    if (!map.has(key)) {
      map.set(key, item.kind === 'derived'
        ? {
            ...item,
            derived: [...new Set(item.derived)].sort() as PreviewDerivedTag[],
            targets: item.targets ? [...item.targets] : undefined,
            relatedLineGroupIds,
          }
        : {
            ...item,
            required: [...new Set(item.required)].sort() as PreviewRequiredTag[],
            relatedLineGroupIds,
          })
      continue
    }

    const existing = map.get(key)!
    if (existing.kind === 'derived' && item.kind === 'derived') {
      existing.derived = [...new Set([...existing.derived, ...item.derived])].sort() as PreviewDerivedTag[]
      existing.targets = [...(existing.targets || []), ...(item.targets || [])]
      existing.relatedLineGroupIds = [...new Set([...existing.relatedLineGroupIds, ...relatedLineGroupIds])].sort()
    } else if (existing.kind === 'required' && item.kind === 'required') {
      existing.required = [...new Set([...existing.required, ...item.required])].sort() as PreviewRequiredTag[]
      existing.relatedLineGroupIds = [...new Set([...existing.relatedLineGroupIds, ...relatedLineGroupIds])].sort()
    }
  }
  return [...map.values()]
}

function buildAllocationOnlyPreviewLines(
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
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

  return allocations.map((alloc) => {
    const items = alloc.goals
      .map(goal => goalToPreviewItem(
        goal,
        `goal:${alloc.groupId || 'unmatched'}`,
        alloc.lineage,
        modulesMap,
        waresMap,
        alloc.groupId,
        settings,
      ))
      .filter((item): item is PreviewItem => Boolean(item))
      .map((item) => {
        if (item.kind !== 'derived' || !item.wareId || !item.derived.includes('production')) return item
        const consumers = requiredConsumersByWare.get(item.wareId)
        return {
          ...item,
          relatedLineGroupIds: consumers ? [...consumers] : [],
        }
      })

    return {
      groupId: alloc.groupId,
      groupName: alloc.groupName,
      isUnmatched: alloc.isUnmatched,
      lineage: alloc.lineage || 'default',
      items: mergePreviewItems(items),
    }
  })
}

// ─── Compute 阶段 ──────────────────────────────────────────────

/**
 * 合并单条产线的全部责任（三类责任合并）。
 */
export function mergeLineResponsibilities(
  line: PreviewLinePlan,
): PreviewItem[] {
  return line.items
}

/**
 * 从责任挂接的 relatedLineGroupIds 收集建筑集合。
 */
export function collectBuildingsForResponsibilities(
  items: PreviewItem[],
  preview: PreviewResult,
  resolvedModulesByGroupId?: Map<string, SavedModule[]>,
): SavedModule[] {
  const relatedGroupIds = new Set<string>()
  for (const item of items) {
    for (const gid of item.relatedLineGroupIds) {
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
  items: PreviewItem[],
  preview: PreviewResult,
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings,
): Record<string, number> {
  const targetProductionRates = collectTargetProductionRates(items)
  const rates: Record<string, number> = {}

  for (const item of items) {
    if (item.kind !== 'derived' || !item.wareId || !item.derived.includes('build-material')) continue
    const buildings = collectBuildingsForResponsibilities(
      [item],
      preview,
      resolvedModulesByGroupId,
    )
    const buildMaterialRates = computeTargetRatesFromBuildings(buildings, modulesMap)
    const rate = buildMaterialRates[item.wareId] || 0
    if (rate <= 0) continue
    rates[item.wareId] = (rates[item.wareId] || 0) + rate
  }

  for (const item of items) {
    if (item.kind !== 'derived' || !item.wareId || !item.derived.includes('production')) continue
    const operationalRate = computeOperationalDemandRateForWare(
      item.wareId,
      item.relatedLineGroupIds,
      preview,
      resolvedModulesByGroupId,
      modulesMap,
      settings,
    )
    if (operationalRate <= 0) continue
    rates[item.wareId] = (rates[item.wareId] || 0) + operationalRate
  }

  for (const [wareId, targetRate] of Object.entries(targetProductionRates)) {
    if (targetRate <= 0) continue
    rates[wareId] = (rates[wareId] || 0) + targetRate
  }

  return rates
}

function collectTargetProductionRates(
  items: PreviewItem[],
): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const item of items) {
    if (item.kind !== 'derived' || !item.wareId || !item.targets) continue
    for (const target of item.targets) {
      if (target.type === 'build-module') continue
      rates[item.wareId] = (rates[item.wareId] || 0) + (target.ratePerHour || 0)
    }
  }
  return rates
}

function computeOperationalDemandRateForWare(
  wareId: string,
  relatedLineGroupIds: string[],
  preview: PreviewResult,
  resolvedModulesByGroupId: Map<string, SavedModule[]>,
  modulesMap: Record<string, X4Module>,
  _settings: StationSettings,
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

    let demand = 0
    for (const module of modules) {
      const definition = modulesMap[module.id]
      if (!definition) continue
      demand += (definition.inputs?.[wareId] || 0) * module.count
    }
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
  const hasPreviewGraph = preview.graph !== null
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
        allocationGoalsByGroupId.set(groupId, buildGoalsFromItems(lineResult.mergedItems, lineResult.targetRates))
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
      allocationGoalsByGroupId.set(previewLine.groupId, buildGoalsFromItems(lineResult.mergedItems, lineResult.targetRates))
    }
    lines.push(lineResult)
  }

  const compatAllocations = preview.lines.map((previewLine, index) => {
    const computedLine = lines[index]
    const goals = previewLine.groupId
      ? allocationGoalsByGroupId.get(previewLine.groupId) || []
      : computedLine
        ? buildGoalsFromItems(computedLine.mergedItems, computedLine.targetRates)
        : []
    return toCompatAllocation(previewLine, goals)
  })

  const schemeGroups = preview.buildMaterialPlanningEnabled && hasPreviewGraph
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

  if (preview.buildMaterialPlanningEnabled && hasPreviewGraph) {
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
    const targetRates = collectTargetProductionRates(previewLine.items)
    const goals = buildGoalsFromItems(previewLine.items, targetRates)
    if (goals.length === 0) continue
    const allModules = computeGoalModules(goals, modulesMap, waresMap, settings, previewLine.lineage, buildPreferredModuleIds(previewLine.items))
    const primaryModules = separatePrimaryModules(allModules, goals, modulesMap)
    const auxiliaryModules = separateAuxiliaryModules(allModules, primaryModules)
    const lineResult: ComputeLineResult = {
      groupId: previewLine.groupId,
      groupName: previewLine.groupName,
      mergedItems: mergeLineResponsibilities(previewLine),
      relatedLineGroupIds: [...new Set(previewLine.items.flatMap(item => item.relatedLineGroupIds))],
      targetRates,
      primaryModules,
      auxiliaryModules,
      allModules,
    }

    resolvedModulesByGroupId.set(groupId, allModules)
    allocationGoalsByGroupId.set(groupId, buildGoalsFromItems(lineResult.mergedItems, targetRates))
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
  const mergedItems = mergeLineResponsibilities(previewLine)
  const targetRates = computeTargetRatesForResponsibilities(
    mergedItems,
    preview,
    resolvedModulesByGroupId,
    modulesMap,
    settings,
  )
  const mergedGoals = buildGoalsFromItems(mergedItems, targetRates)
  const allModules = computeGoalModules(mergedGoals, modulesMap, waresMap, settings, previewLine.lineage, buildPreferredModuleIds(mergedItems))
  const primaryModules = separatePrimaryModules(allModules, mergedGoals, modulesMap)
  const auxiliaryModules = separateAuxiliaryModules(allModules, primaryModules)

  return {
    groupId: previewLine.groupId,
    groupName: previewLine.groupName,
    mergedItems,
    relatedLineGroupIds: [...new Set(mergedItems.flatMap(item => item.relatedLineGroupIds))],
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
    line.mergedItems
      .filter((item): item is PreviewDerivedItem => item.kind === 'derived' && Boolean(item.wareId))
      .map(item => item.wareId!),
  )
  const buildMaterialWares = new Set(
    line.mergedItems
      .filter((item): item is PreviewDerivedItem => item.kind === 'derived' && item.derived.includes('build-material') && Boolean(item.wareId))
      .map(item => item.wareId!),
  )
  const perWareSources: Record<string, { label: string; qty: number; seconds: number; rate: number }[]> = {}
  const buildSourceSecondsByWare = new Map<string, Map<string, number>>()
  const buildMaterialQtyByWare: Record<string, number> = {}

  for (const item of line.mergedItems) {
    if (item.kind !== 'derived' || !item.wareId) continue
    if (!trackedWares.has(item.wareId)) continue

    for (const relatedGroupId of item.relatedLineGroupIds) {
      const relatedScheme = schemeByGroupId.get(relatedGroupId)
      if (!relatedScheme) continue
      if (item.derived.includes('build-material')) {
        const { seconds, materials } = summarizeBuildModules(relatedScheme.modules, modulesMap)
        if (seconds <= 0) continue
        const qty = materials[item.wareId] || 0
        if (qty <= 0) continue

        pushDemandEntry(
          perWareSources,
          item.wareId,
          relatedScheme.label,
          qty,
          seconds,
        )
        const wareSeconds = buildSourceSecondsByWare.get(item.wareId) || new Map<string, number>()
        if (!wareSeconds.has(relatedScheme.label)) {
          wareSeconds.set(relatedScheme.label, seconds)
        }
        buildSourceSecondsByWare.set(item.wareId, wareSeconds)
        buildMaterialQtyByWare[item.wareId] = (buildMaterialQtyByWare[item.wareId] || 0) + qty
      }
    }
  }

  const gapRates: Record<string, number> = {}
  for (const item of line.mergedItems) {
    if (item.kind !== 'derived' || !item.wareId || !item.derived.includes('production')) continue
    let rate = 0
    for (const relatedGroupId of item.relatedLineGroupIds) {
      const relatedScheme = schemeByGroupId.get(relatedGroupId)
      if (!relatedScheme) continue
      rate += Math.max(0, -((relatedScheme.netProduction || {})[item.wareId] || 0))
    }
    if (rate > 0) {
      gapRates[item.wareId] = (gapRates[item.wareId] || 0) + rate
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

  const aggregateRates: Record<string, number> = {}
  for (const wareId of buildMaterialWares) {
    const totals = perWareTotals[wareId]
    if (!totals || totals.seconds <= 0 || totals.qty <= 0) continue
    aggregateRates[wareId] = totals.qty / (totals.seconds / 3600)
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
  preferredModuleIdsByWare: Map<string, string> = new Map(),
): SavedModule[] {
  const baseModules = expandGoalsRespectingLockedWares(goals, modulesMap, waresMap, lineage, preferredModuleIdsByWare)
  const merged = mergeModules(baseModules)
  const autoFill = autoFillForLine(merged, goals, settings, modulesMap, waresMap)
  return mergeModules([...merged, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])
}

function expandGoalsRespectingLockedWares(
  goals: BuildGoal[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  racePreference: string,
  preferredModuleIdsByWare: Map<string, string>,
): SavedModule[] {
  const lockedWares = new Set(
    goals
      .flatMap((goal) => {
        if (goal.type === 'required-production') return [goal.wareId]
        if (goal.type === 'production-rate') return [goal.wareId]
        if (goal.type === 'target-production' && goal.wareId) return [goal.wareId]
        return []
      }),
  )
  const required: Record<string, number> = {}

  function addModule(moduleId: string, count: number): void {
    required[moduleId] = (required[moduleId] || 0) + count
  }

  function expandWareUpstream(
    wareId: string,
    targetRate: number,
    visited: Set<string>,
    allowLockedRoot = false,
  ): void {
    if (lockedWares.has(wareId) && !allowLockedRoot) return
    if (visited.has(wareId)) return
    visited.add(wareId)

    const lockedModuleId = preferredModuleIdsByWare.get(wareId)
    const producer = lockedModuleId
      ? modulesMap[lockedModuleId]
      : findBestProducer(wareId, racePreference, [], modulesMap, waresMap)
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
      expandWareUpstream(goal.wareId, goal.ratePerHour, new Set(), true)
    }
  }

  return Object.entries(required).map(([id, count]) => ({ id, count }))
}

function buildPreferredModuleIds(
  items: PreviewItem[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.kind !== 'derived') continue
    if (!item.wareId) continue
    map.set(item.wareId, item.moduleId)
  }
  return map
}

function buildGoalsFromItems(
  items: PreviewItem[],
  targetRates: Record<string, number>,
): BuildGoal[] {
  const moduleGoals: BuildGoal[] = []
  const wareKinds = new Map<string, { hasDerivedBuildMaterial: boolean; hasDerivedProduction: boolean; hasRequiredProduction: boolean; manualRate: number }>()

  for (const item of items) {
    if (item.kind === 'derived') {
      for (const target of item.targets || []) {
        if (target.type === 'build-module') {
          moduleGoals.push({
            type: 'build-module',
            moduleId: item.moduleId,
            count: target.count || 1,
          })
        }
      }
      if (item.wareId) {
        const current = wareKinds.get(item.wareId) || {
          hasDerivedBuildMaterial: false,
          hasDerivedProduction: false,
          hasRequiredProduction: false,
          manualRate: 0,
        }
        if (item.derived.includes('build-material')) current.hasDerivedBuildMaterial = true
        if (item.derived.includes('production')) current.hasDerivedProduction = true
        for (const target of item.targets || []) {
          if (target.type !== 'build-module') current.manualRate += target.ratePerHour || 0
        }
        wareKinds.set(item.wareId, current)
      }
      continue
    }

    const current = wareKinds.get(item.wareId) || {
      hasDerivedBuildMaterial: false,
      hasDerivedProduction: false,
      hasRequiredProduction: false,
      manualRate: 0,
    }
    if (item.required.includes('build-material')) current.hasRequiredProduction = true
    if (item.required.includes('production')) current.hasRequiredProduction = true
    wareKinds.set(item.wareId, current)
  }

  const goals: BuildGoal[] = [...moduleGoals]
  for (const [wareId, kinds] of wareKinds) {
    const ratePerHour = targetRates[wareId] || 0
    if (kinds.hasDerivedProduction) {
      if (kinds.hasDerivedBuildMaterial) {
        const combinedRate = ratePerHour + kinds.manualRate
        if (combinedRate <= 0) continue
        goals.push({
          type: 'derived-build-material',
          wareId,
          ratePerHour: combinedRate,
        })
        continue
      }
      if (ratePerHour <= 0) continue
      if (kinds.manualRate > 0) {
        goals.push({
          type: 'production-rate',
          wareId,
          ratePerHour,
        })
        continue
      }
      goals.push({
        type: 'derived-production',
        wareId,
        ratePerHour,
      })
      continue
    }
    if (kinds.hasDerivedBuildMaterial) {
      const combinedRate = ratePerHour + kinds.manualRate
      if (combinedRate <= 0) continue
      goals.push({
        type: 'derived-build-material',
        wareId,
        ratePerHour: combinedRate,
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
      goals: buildGoalsFromItems(line.mergedItems, line.targetRates),
    })),
    schemeGroups: result.schemeGroups,
  }
}

function goalToPreviewItem(
  goal: BuildGoal,
  sourceRef: string,
  lineage: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  groupId?: string,
  settings: StationSettings = DEFAULT_BUILD_PLAN_SETTINGS,
): PreviewItem | null {
  const relatedLineGroupIds = groupId ? [groupId] : []
  const producerLineage = groupId ? lineage : settings.racePreference

  if (goal.type === 'build-module') {
    return {
      kind: 'derived',
      moduleId: goal.moduleId,
      derived: ['target'],
      targets: [{ type: 'build-module', count: goal.count }],
      relatedLineGroupIds,
      sourceRef,
    }
  }

  if (goal.type === 'production-rate') {
    const moduleId = findBestProducer(goal.wareId, producerLineage, [], modulesMap, waresMap)?.id
    return moduleId ? {
      kind: 'derived',
      wareId: goal.wareId,
      moduleId,
      derived: ['target'],
      targets: [{ type: 'production-rate', ratePerHour: goal.ratePerHour }],
      relatedLineGroupIds,
      sourceRef,
    } : null
  }

  if (goal.type === 'derived-build-material') {
    const moduleId = findBestProducer(goal.wareId, producerLineage, [], modulesMap, waresMap)?.id
    return moduleId ? {
      kind: 'derived',
      wareId: goal.wareId,
      moduleId,
      derived: ['build-material'],
      relatedLineGroupIds,
      sourceRef,
    } : null
  }

  if (goal.type === 'derived-production') {
    const moduleId = findBestProducer(goal.wareId, producerLineage, [], modulesMap, waresMap)?.id
    return moduleId ? {
      kind: 'derived',
      wareId: goal.wareId,
      moduleId,
      derived: ['production'],
      relatedLineGroupIds,
      sourceRef,
    } : null
  }

  if (goal.type === 'required-production') {
    return {
      kind: 'required',
      wareId: goal.wareId,
      required: ['production'],
      relatedLineGroupIds,
      sourceRef,
    }
  }
  return null
}
