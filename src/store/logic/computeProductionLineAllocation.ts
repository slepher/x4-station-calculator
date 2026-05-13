import type { BuildGoal, ProductionLineAllocation } from '@/types/build-plan'
import type {
  X4Module,
  ProductionLineGroup,
  BuildFlowGroup,
  BuildFlowAssignment,
  VirtualEdge,
} from '@/types/x4'
import { generateDerivedGoalsFromLogicFlow } from './logicFlowResponsibility'

interface BuildFlowView {
  buildFlowGroups: BuildFlowGroup[]
  assignments: BuildFlowAssignment[]
  virtualEdges: VirtualEdge[]
}

/**
 * 为每个 goal 提取对应的 wareId
 */
function extractWareId(goal: BuildGoal, modulesMap: Record<string, X4Module>): string {
  if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') {
    return goal.wareId
  }
  if (goal.type === 'build-module') {
    const mod = modulesMap[goal.moduleId]
    if (mod && mod.outputs) {
      const outputWares = Object.keys(mod.outputs)
      if (outputWares.length > 0) return outputWares[0]!
    }
    return goal.moduleId
  }
  return ''
}

/**
 * 在 build-flow 中查找 outputMaterialTag 的连线
 */
function findConnection(
  wareId: string,
  assignments: BuildFlowAssignment[],
  virtualEdges: VirtualEdge[],
): string | null {
  for (const a of assignments) {
    if (a.targetType === 'output-material' && a.wareId === wareId) {
      return a.sourceGroupId
    }
  }
  for (const e of virtualEdges) {
    if (e.targetType === 'output-material' && e.wareId === wareId) {
      return e.sourceGroupId
    }
  }
  return null
}

/**
 * 产线自动分配核心算法
 */
export function computeProductionLineAllocation(
  goals: BuildGoal[],
  flowGroups: ProductionLineGroup[],
  buildFlowView: BuildFlowView | null,
  modulesMap: Record<string, X4Module>,
  modulesByOutputMap: Record<string, X4Module[]>,
): ProductionLineAllocation[] {
  const groupMap = new Map<string, BuildGoal[]>()
  const unmatchedGoals: BuildGoal[] = []

  // 1. 生成派生 goals
  let derivedGoalList: BuildGoal[] = []
  const requiredMap = new Map<string, string[]>()
  if (flowGroups.length > 0) {
    const result = generateDerivedGoalsFromLogicFlow(goals, flowGroups, buildFlowView, modulesMap, modulesByOutputMap)
    derivedGoalList = result.derivedGoals
    result.requiredMap.forEach((v, k) => requiredMap.set(k, v))
  }
  const allGoals = [...goals, ...derivedGoalList]

  // 2. 为每个 goal 分配产线
  const assignedGroupIds = new Set<string>()

  // Layer 1: Build-flow outputMaterialTag 匹配（逐 goal 独立处理）
  const afterLayer1: BuildGoal[] = []
  for (const goal of allGoals) {
    const wareId = extractWareId(goal, modulesMap)
    let assigned = false

    if (buildFlowView) {
      for (const bfg of buildFlowView.buildFlowGroups) {
        for (const tag of bfg.outputMaterialTags) {
          if (tag.wareId === wareId) {
            const sourceGroupId = findConnection(wareId, buildFlowView.assignments, buildFlowView.virtualEdges)
            if (sourceGroupId && flowGroups.some((g) => g.id === sourceGroupId)) {
              const list = groupMap.get(sourceGroupId) || []
              list.push(goal)
              groupMap.set(sourceGroupId, list)
              assignedGroupIds.add(sourceGroupId)
              assigned = true
              break
            }
          }
        }
        if (assigned) break
      }
    }

    if (!assigned) {
      afterLayer1.push(goal)
    }
  }

  // Round 1: Manual 全局分配
  const afterManual: BuildGoal[] = []
  for (const goal of afterLayer1) {
    const wareId = extractWareId(goal, modulesMap)
    let assigned = false

    for (const group of flowGroups) {
      let matched = false
      for (const node of group.nodes) {
        if (node.source === 'manual' && !node.isIsolated) {
          if ((goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') && node.wareId === wareId) {
            matched = true
            break
          }
          if (goal.type === 'build-module' && node.moduleId === goal.moduleId) {
            matched = true
            break
          }
        }
      }
      if (matched) {
        const list = groupMap.get(group.id) || []
        list.push(goal)
        groupMap.set(group.id, list)
        assignedGroupIds.add(group.id)
        assigned = true
        break
      }
    }

    if (!assigned) {
      afterManual.push(goal)
    }
  }

  // Round 2: Auto 分配 — 优先在「已分配产线」中查找
  const unassignedAfterAuto: BuildGoal[] = []

  // 第一优先：在已分配产线中找 auto 节点
  const afterFirstAuto: BuildGoal[] = []
  for (const goal of afterManual) {
    const wareId = extractWareId(goal, modulesMap)
    let assigned = false

    for (const group of flowGroups) {
      if (!assignedGroupIds.has(group.id)) continue
      let matched = false
      for (const node of group.nodes) {
        if (node.source === 'auto' && !node.isIsolated) {
          if ((goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') && node.wareId === wareId) {
            matched = true
            break
          }
          if (goal.type === 'build-module' && node.moduleId === goal.moduleId) {
            matched = true
            break
          }
        }
      }
      if (matched) {
        const list = groupMap.get(group.id) || []
        list.push(goal)
        groupMap.set(group.id, list)
        assigned = true
        break
      }
    }

    if (!assigned) {
      afterFirstAuto.push(goal)
    }
  }

  // 第二优先：在其余产线中找 auto 节点
  const preAssignedGroupIds = new Set(assignedGroupIds)
  for (const goal of afterFirstAuto) {
    const wareId = extractWareId(goal, modulesMap)
    let assigned = false

    for (const group of flowGroups) {
      if (preAssignedGroupIds.has(group.id)) continue
      let matched = false
      for (const node of group.nodes) {
        if (node.source === 'auto' && !node.isIsolated) {
          if ((goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') && node.wareId === wareId) {
            matched = true
            break
          }
          if (goal.type === 'build-module' && node.moduleId === goal.moduleId) {
            matched = true
            break
          }
        }
      }
      if (matched) {
        const list = groupMap.get(group.id) || []
        list.push(goal)
        groupMap.set(group.id, list)
        assignedGroupIds.add(group.id)
        assigned = true
        break
      }
    }

    if (!assigned) {
      unassignedAfterAuto.push(goal)
    }
  }

  // Layer 2.5: Isolated node matching（仅 derived 类型）
  for (const goal of unassignedAfterAuto) {
    if (goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') {
      const wareId = extractWareId(goal, modulesMap)
      let assigned = false
      for (const group of flowGroups) {
        for (const node of group.nodes) {
          if (node.isIsolated && node.wareId === wareId) {
            const list = groupMap.get(group.id) || []
            list.push(goal)
            groupMap.set(group.id, list)
            assigned = true
            break
          }
        }
        if (assigned) break
      }
      if (!assigned) {
        unmatchedGoals.push(goal)
      }
    } else {
      unmatchedGoals.push(goal)
    }
  }

  // 3. 构建输出
  const result: ProductionLineAllocation[] = []

  const groupIdToName = new Map<string, string>()
  const groupIdToLineage = new Map<string, string>()
  for (const g of flowGroups) {
    groupIdToName.set(g.id, g.name || g.id)
    const lineage = g.isLocked ? (g.lockedLineage || g.subCategory) : g.subCategory
    groupIdToLineage.set(g.id, lineage || 'default')
  }

  for (const [groupId, goalList] of groupMap) {
    if (goalList.length > 0) {
      const goals = [...goalList]
      // 添加 required-production
      const existingRequiredWares = new Set(
        goals
          .filter((goal): goal is Extract<BuildGoal, { type: 'required-production' }> => goal.type === 'required-production')
          .map(goal => goal.wareId),
      )
      for (const g of goalList) {
        const sourceKey = extractWareId(g, modulesMap)
        if (!sourceKey) continue
        const required = requiredMap.get(sourceKey)
        if (required) {
          for (const wareId of required) {
            if (!existingRequiredWares.has(wareId)) {
              goals.push({ type: 'required-production', wareId, ratePerHour: 0 })
              existingRequiredWares.add(wareId)
            }
          }
        }
      }
      result.push({
        groupId,
        groupName: groupIdToName.get(groupId) || groupId,
        isUnmatched: false,
        lineage: groupIdToLineage.get(groupId) || 'default',
        goals,
      })
    }
  }

  if (unmatchedGoals.length > 0) {
    result.push({
      groupId: undefined,
      groupName: '',
      isUnmatched: true,
      lineage: 'default',
      goals: unmatchedGoals,
    })
  }

  return result
}
