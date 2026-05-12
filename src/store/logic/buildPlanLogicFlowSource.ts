import type {
  BuildFlowAssignment,
  FlowNode,
  LogicFlowPlan,
  ProductionLineGroup,
  SavedFlowGroup,
  VirtualEdge,
  X4Module,
  X4Ware,
} from '@/types/x4'
import type {
  BuildFlowPlanView,
  LogicFlowPlanSnapshot,
} from '@/types/build-plan'
import { computeExpandUpstream, type ExpandContext, type GroupSnapshot } from './logicFlowStream'
import { computeVirtualEdges, deriveBuildFlowView } from './buildFlowDerivation'
import { getLogicFlowGroupDisplayName } from './logicFlowGroupName'

interface LogicFlowSnapshotContext {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  modulesByOutputMap: Record<string, X4Module[]>
  getWareDisplayName: (wareId: string) => string
}

interface ActiveLogicFlowSnapshotInput {
  activePlanId: string | null
  groups: ProductionLineGroup[]
  buildFlowView: { buildFlowGroups: BuildFlowPlanView['buildFlowGroups'] } | null
  buildFlowAssignments: BuildFlowAssignment[]
  buildFlowVirtualEdges: VirtualEdge[]
}

function createBuildFlowPlanView(
  groups: ProductionLineGroup[],
  assignments: BuildFlowAssignment[],
  archivedGroupIds: string[],
  ctx: LogicFlowSnapshotContext,
): BuildFlowPlanView | null {
  const displayNames = new Map<string, string>()
  for (const group of groups) {
    const displayName = getLogicFlowGroupDisplayName(group, ctx.getWareDisplayName)
    displayNames.set(group.id, displayName)
  }

  const derived = deriveBuildFlowView(groups, ctx.modulesMap, displayNames, ctx.getWareDisplayName, archivedGroupIds)
  if (!derived.buildFlowGroups.length) return null

  return {
    buildFlowGroups: derived.buildFlowGroups,
    assignments,
    virtualEdges: computeVirtualEdges(
      derived.buildFlowGroups,
      assignments,
      archivedGroupIds,
      groups,
    ),
  }
}

function insertNodeSorted(group: ProductionLineGroup, node: FlowNode) {
  const targetTier = node.column
  let insertIndex = 0
  for (let i = group.nodes.length - 1; i >= 0; i--) {
    const existing = group.nodes[i]
    if (existing && existing.column >= targetTier) {
      insertIndex = i + 1
      break
    }
  }
  group.nodes.splice(insertIndex, 0, node)
}

function resolveModuleOutputWareId(moduleId: string, modulesMap: Record<string, X4Module>): string | null {
  const module = modulesMap[moduleId]
  if (!module?.outputs) return null
  const outputWareIds = Object.keys(module.outputs)
  if (outputWareIds.length === 0) return null
  return outputWareIds[0] || null
}

function rebuildGroupsFromSavedPlan(
  savedGroups: SavedFlowGroup[],
  ctx: LogicFlowSnapshotContext,
): ProductionLineGroup[] {
  const groups: ProductionLineGroup[] = []
  const expandCtx: ExpandContext = {
    waresMap: ctx.waresMap,
    modulesMap: ctx.modulesMap,
    modulesByOutputMap: ctx.modulesByOutputMap,
  }

  for (const savedGroup of savedGroups) {
    const group: ProductionLineGroup = {
      id: savedGroup.id,
      name: savedGroup.name,
      category: savedGroup.category,
      subCategory: savedGroup.subCategory,
      isLocked: savedGroup.isLocked,
      lockedLineage: savedGroup.lockedLineage,
      nodes: [],
    }
    groups.push(group)

    const orderByColumn = new Map<number, number>()
    const nextOrder = (column: number) => {
      const current = orderByColumn.get(column) || 0
      orderByColumn.set(column, current + 1)
      return current
    }

    for (const savedNode of savedGroup.nodes) {
      if (!savedNode.isolated) continue
      const ware = ctx.waresMap[savedNode.isolated]
      if (!ware) continue
      const lineage = group.isLocked ? (group.lockedLineage || 'default') : (group.subCategory || 'default')
      insertNodeSorted(group, {
        id: crypto.randomUUID(),
        wareId: savedNode.isolated,
        race: lineage,
        lineage,
        column: ware.tier,
        isIsolated: true,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: nextOrder(ware.tier),
        isPreview: false,
      })
    }

    for (const savedNode of savedGroup.nodes) {
      if (!savedNode.module) continue
      const module = ctx.modulesMap[savedNode.module]
      if (!module) continue
      const wareId = resolveModuleOutputWareId(savedNode.module, ctx.modulesMap)
      if (!wareId) continue
      const ware = ctx.waresMap[wareId]
      if (!ware) continue

      const lineage = group.isLocked
        ? (group.lockedLineage || 'default')
        : (module.race || module.method || group.subCategory || 'default')

      const existingNode = group.nodes.find(node => node.moduleId === savedNode.module)
      if (existingNode) {
        if (existingNode.source === 'auto') {
          existingNode.source = 'manual'
          existingNode.isAuto = false
          existingNode.isRoot = true
          if (module.inputs) {
            Object.keys(module.inputs).forEach(inputWareId => {
              const result = computeExpandUpstream(
                expandCtx,
                {
                  id: group.id,
                  nodes: group.nodes,
                  isLocked: group.isLocked,
                  lockedLineage: group.lockedLineage,
                  subCategory: group.subCategory,
                } satisfies GroupSnapshot,
                inputWareId,
                'auto',
                existingNode.lineage,
              )
              result.newNodes.forEach(node => insertNodeSorted(group, node))
              result.updatedNodes.forEach(update => {
                const target = group.nodes.find(node => node.id === update.nodeId)
                if (target) Object.assign(target, update.updates)
              })
            })
          }
        }
        continue
      }

      insertNodeSorted(group, {
        id: crypto.randomUUID(),
        wareId,
        moduleId: savedNode.module,
        race: module.race || lineage,
        lineage,
        column: ware.tier,
        isIsolated: false,
        isAuto: false,
        isRoot: true,
        source: 'manual',
        order: nextOrder(ware.tier),
        isPreview: false,
      })

      if (!module.inputs) continue
      Object.keys(module.inputs).forEach(inputWareId => {
        const result = computeExpandUpstream(
          expandCtx,
          {
            id: group.id,
            nodes: group.nodes,
            isLocked: group.isLocked,
            lockedLineage: group.lockedLineage,
            subCategory: group.subCategory,
          } satisfies GroupSnapshot,
          inputWareId,
          'auto',
          lineage,
        )
        result.newNodes.forEach(node => insertNodeSorted(group, node))
        result.updatedNodes.forEach(update => {
          const target = group.nodes.find(node => node.id === update.nodeId)
          if (target) Object.assign(target, update.updates)
        })
      })
    }
  }

  return groups
}

export function createActiveLogicFlowSnapshot(input: ActiveLogicFlowSnapshotInput): LogicFlowPlanSnapshot {
  return {
    planId: input.activePlanId,
    groups: input.groups,
    buildFlowView: input.buildFlowView && input.buildFlowView.buildFlowGroups.length > 0
      ? {
        buildFlowGroups: input.buildFlowView.buildFlowGroups,
        assignments: input.buildFlowAssignments,
        virtualEdges: input.buildFlowVirtualEdges,
      }
      : null,
    buildFlowAssignments: input.buildFlowAssignments,
    buildFlowVirtualEdges: input.buildFlowVirtualEdges,
  }
}

export function rebuildLogicFlowSnapshotFromPlan(
  plan: LogicFlowPlan,
  ctx: LogicFlowSnapshotContext,
): LogicFlowPlanSnapshot {
  const groups = rebuildGroupsFromSavedPlan(plan.groups, ctx)
  const assignments = plan.buildFlow?.assignments ? [...plan.buildFlow.assignments] : []
  const archivedGroupIds = plan.buildFlow?.archivedGroupIds ? [...plan.buildFlow.archivedGroupIds] : []
  const buildFlowView = createBuildFlowPlanView(groups, assignments, archivedGroupIds, ctx)

  return {
    planId: plan.id,
    groups,
    buildFlowView,
    buildFlowAssignments: assignments,
    buildFlowVirtualEdges: buildFlowView?.virtualEdges || [],
  }
}
