import type { BuildGoal, ProductionLineAllocation } from '@/types/build-plan'
import type {
  X4Module,
  ProductionLineGroup,
  BuildFlowGroup,
  BuildFlowAssignment,
  VirtualEdge,
} from '@/types/x4'
import { findGroupWithIsolatedWare } from './productionLineSearch'

interface BuildFlowView {
  buildFlowGroups: BuildFlowGroup[]
  assignments: BuildFlowAssignment[]
  virtualEdges: VirtualEdge[]
}

/**
 * 为每个 goal 提取对应的 wareId
 */
function extractWareId(goal: BuildGoal, modulesMap: Record<string, X4Module>): string {
  if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
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
 * 查找生产指定 ware 的模块（取第一个）
 */
function findModuleForWare(
  wareId: string,
  modulesByOutputMap: Record<string, X4Module[]>,
): X4Module | undefined {
  const modules = modulesByOutputMap[wareId]
  if (modules && modules.length > 0) {
    return modules[0]
  }
  return undefined
}

/**
 * 构建 covered 集合
 */
function buildCoveredSet(
  goals: BuildGoal[],
  flowGroups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
): Set<string> {
  const covered = new Set<string>()

  for (const goal of goals) {
    if (goal.type === 'production-rate') {
      covered.add(goal.wareId)
    } else if (goal.type === 'build-module') {
      const mod = modulesMap[goal.moduleId]
      if (mod && mod.outputs) {
        for (const w of Object.keys(mod.outputs)) {
          covered.add(w)
        }
      }
    }
  }

  for (const group of flowGroups) {
    for (const node of group.nodes) {
      if (!node.isIsolated) {
        covered.add(node.wareId)
      }
    }
  }

  console.log('[buildCoveredSet] covered:', [...covered])
  console.log('[buildCoveredSet] isolated wares NOT in covered:', flowGroups.flatMap(g => g.nodes).filter(n => n.isIsolated).map(n => n.wareId))

  return covered
}

/**
 * 递归向上游遍历，生成派生 goals
 * @param covered 非孤立节点的已覆盖 ware 集合
 * @param seenIsolatedWares 已生成 derived goal 的孤立 ware 集合（防止重复）
 */
function walkUpstream(
  module: X4Module,
  covered: Set<string>,
  flowGroups: ProductionLineGroup[],
  modulesByOutputMap: Record<string, X4Module[]>,
  seenIsolatedWares: Set<string>,
): BuildGoal[] {
  if (!module || !module.inputs) return []
  const derived: BuildGoal[] = []

  for (const inputWareId of Object.keys(module.inputs)) {
    const isolatedResult = findGroupWithIsolatedWare(inputWareId, flowGroups)
    if (isolatedResult && !seenIsolatedWares.has(inputWareId)) {
      derived.push({ type: 'derived-production', wareId: inputWareId, ratePerHour: 0 })
      seenIsolatedWares.add(inputWareId)
    }

    if (covered.has(inputWareId)) continue

    const nextModule = findModuleForWare(inputWareId, modulesByOutputMap)
    if (nextModule) {
      derived.push(...walkUpstream(nextModule, covered, flowGroups, modulesByOutputMap, seenIsolatedWares))
    }
  }

  return derived
}

/**
 * 生成派生 goals
 */
function generateDerivedGoals(
  userGoals: BuildGoal[],
  flowGroups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  modulesByOutputMap: Record<string, X4Module[]>,
): BuildGoal[] {
  const covered = buildCoveredSet(userGoals, flowGroups, modulesMap)
  const seenIsolatedWares = new Set<string>()
  const allDerived: BuildGoal[] = []

  for (const goal of userGoals) {
    let mod: X4Module | undefined
    if (goal.type === 'production-rate') {
      mod = findModuleForWare(goal.wareId, modulesByOutputMap)
    } else if (goal.type === 'build-module') {
      mod = modulesMap[goal.moduleId]
    }
    if (!mod) continue

    allDerived.push(...walkUpstream(mod, covered, flowGroups, modulesByOutputMap, seenIsolatedWares))
  }

  return allDerived
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
  const derivedGoals = flowGroups.length > 0
    ? generateDerivedGoals(goals, flowGroups, modulesMap, modulesByOutputMap)
    : []
  const allGoals = [...goals, ...derivedGoals]

  console.log('[allocation] allGoals:', allGoals.map(g => ({ type: g.type, wareId: (g as any).wareId, moduleId: (g as any).moduleId })))
  console.log('[allocation] flowGroups:', flowGroups.map(g => ({
    id: g.id,
    name: g.name,
    nodes: g.nodes.map(n => ({ wareId: n.wareId, source: n.source, isIsolated: n.isIsolated, moduleId: n.moduleId }))
  })))

  // 2. 为每个 goal 分配产线
  for (const goal of allGoals) {
    const wareId = extractWareId(goal, modulesMap)
    let assigned = false

    // Layer 1: Build-flow outputMaterialTag 匹配
    if (buildFlowView) {
      for (const bfg of buildFlowView.buildFlowGroups) {
        for (const tag of bfg.outputMaterialTags) {
          if (tag.wareId === wareId) {
            const sourceGroupId = findConnection(wareId, buildFlowView.assignments, buildFlowView.virtualEdges)
            if (sourceGroupId && flowGroups.some((g) => g.id === sourceGroupId)) {
              console.log(`[allocation] goal ${goal.type}:${wareId} → Layer1 → group ${sourceGroupId}`)
              const list = groupMap.get(sourceGroupId) || []
              list.push(goal)
              groupMap.set(sourceGroupId, list)
              assigned = true
              break
            }
          }
        }
        if (assigned) break
      }
    }
    if (assigned) continue

    // Layer 2: Logic-flow 节点匹配
    // manual
    for (const group of flowGroups) {
      let matched = false
      for (const node of group.nodes) {
        if (node.source === 'manual' && !node.isIsolated) {
          if ((goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') && node.wareId === wareId) {
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
    if (assigned) continue

    // auto
    for (const group of flowGroups) {
      let matched = false
      for (const node of group.nodes) {
        if (node.source === 'auto' && !node.isIsolated) {
          if ((goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') && node.wareId === wareId) {
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
        console.log(`[allocation] goal ${goal.type}:${wareId} → Layer2/auto → group ${group.id}`)
        const list = groupMap.get(group.id) || []
        list.push(goal)
        groupMap.set(group.id, list)
        assigned = true
        break
      }
    }
    if (assigned) continue

    // Layer 2.5: Isolated node matching (for derived goals)
    if (goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
      for (const group of flowGroups) {
        for (const node of group.nodes) {
          if (node.isIsolated && node.wareId === wareId) {
            console.log(`[allocation] goal ${goal.type}:${wareId} → Layer2.5/isolated → group ${group.id}`)
            const list = groupMap.get(group.id) || []
            list.push(goal)
            groupMap.set(group.id, list)
            assigned = true
            break
          }
        }
        if (assigned) break
      }
    }
    if (assigned) continue

    // Layer 3: 未命中
    console.log(`[allocation] goal ${goal.type}:${wareId} → UNMATCHED`)
    unmatchedGoals.push(goal)
  }

  // 3. 构建输出
  const result: ProductionLineAllocation[] = []

  const groupIdToName = new Map<string, string>()
  for (const g of flowGroups) {
    groupIdToName.set(g.id, g.name || g.id)
  }

  for (const [groupId, goalList] of groupMap) {
    if (goalList.length > 0) {
      result.push({
        groupId,
        groupName: groupIdToName.get(groupId) || groupId,
        isUnmatched: false,
        goals: goalList,
      })
    }
  }

  if (unmatchedGoals.length > 0) {
    result.push({
      groupId: undefined,
      groupName: '',
      isUnmatched: true,
      goals: unmatchedGoals,
    })
  }

  return result
}
