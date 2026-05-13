import type { BuildGoal } from '@/types/build-plan'
import type {
  ProductionLineGroup,
  X4Module,
  BuildFlowGroup,
  BuildFlowAssignment,
  VirtualEdge,
} from '@/types/x4'
import { findGroupWithIsolatedWare } from './productionLineSearch'

export interface LogicFlowGroupFact {
  groupId: string
  manualProducedWareIds: string[]
  isolatedWareIds: string[]
  autoProducedWareIds: string[]
}

interface BuildFlowView {
  buildFlowGroups: BuildFlowGroup[]
  assignments: BuildFlowAssignment[]
  virtualEdges: VirtualEdge[]
}

export function collectLogicFlowGroupFacts(
  groups: ProductionLineGroup[],
): LogicFlowGroupFact[] {
  return groups.map((group) => {
    const manualProducedWareIds = new Set<string>()
    const isolatedWareIds = new Set<string>()
    const autoProducedWareIds = new Set<string>()

    for (const node of group.nodes) {
      if (node.isIsolated) {
        isolatedWareIds.add(node.wareId)
        continue
      }
      if (node.source === 'manual') {
        manualProducedWareIds.add(node.wareId)
        continue
      }
      if (node.source === 'auto') {
        autoProducedWareIds.add(node.wareId)
      }
    }

    return {
      groupId: group.id,
      manualProducedWareIds: [...manualProducedWareIds],
      isolatedWareIds: [...isolatedWareIds],
      autoProducedWareIds: [...autoProducedWareIds],
    }
  })
}

export function findExplicitIsolatedOwnerGroupId(
  wareId: string,
  groups: ProductionLineGroup[],
): string | null {
  for (const fact of collectLogicFlowGroupFacts(groups)) {
    if (fact.isolatedWareIds.includes(wareId)) {
      return fact.groupId
    }
  }
  return null
}

export function groupHasExplicitIsolatedWare(
  groupId: string | null | undefined,
  wareId: string,
  groups: ProductionLineGroup[],
): boolean {
  if (!groupId) return false
  for (const fact of collectLogicFlowGroupFacts(groups)) {
    if (fact.groupId !== groupId) continue
    return fact.isolatedWareIds.includes(wareId)
  }
  return false
}

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

function findConnection(
  wareId: string,
  assignments: BuildFlowAssignment[],
  virtualEdges: VirtualEdge[],
): string | null {
  for (const assignment of assignments) {
    if (assignment.targetType === 'output-material' && assignment.wareId === wareId) {
      return assignment.sourceGroupId
    }
  }
  for (const edge of virtualEdges) {
    if (edge.targetType === 'output-material' && edge.wareId === wareId) {
      return edge.sourceGroupId
    }
  }
  return null
}

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

export function resolveGoalOwnerGroupId(
  goal: BuildGoal,
  flowGroups: ProductionLineGroup[],
  buildFlowView: BuildFlowView | null,
  modulesMap: Record<string, X4Module>,
): string | null {
  const wareId = extractWareId(goal, modulesMap)

  if (buildFlowView) {
    for (const flowGroup of buildFlowView.buildFlowGroups) {
      for (const tag of flowGroup.outputMaterialTags) {
        if (tag.wareId !== wareId) continue
        const sourceGroupId = findConnection(wareId, buildFlowView.assignments, buildFlowView.virtualEdges)
        if (sourceGroupId && flowGroups.some((group) => group.id === sourceGroupId)) {
          return sourceGroupId
        }
      }
    }
  }

  for (const group of flowGroups) {
    for (const node of group.nodes) {
      if (node.source !== 'manual' || node.isIsolated) continue
      if (
        (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production')
        && node.wareId === wareId
      ) {
        return group.id
      }
      if (goal.type === 'build-module' && node.moduleId === goal.moduleId) {
        return group.id
      }
    }
  }

  for (const group of flowGroups) {
    for (const node of group.nodes) {
      if (node.source !== 'auto' || node.isIsolated) continue
      if (
        (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production')
        && node.wareId === wareId
      ) {
        return group.id
      }
      if (goal.type === 'build-module' && node.moduleId === goal.moduleId) {
        return group.id
      }
    }
  }

  return null
}

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
        for (const wareId of Object.keys(mod.outputs)) {
          covered.add(wareId)
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

  return covered
}

function walkUpstream(
  module: X4Module,
  covered: Set<string>,
  flowGroups: ProductionLineGroup[],
  modulesByOutputMap: Record<string, X4Module[]>,
  seenIsolatedWares: Set<string>,
  ownerGroupId: string | null,
): BuildGoal[] {
  if (!module || !module.inputs) return []
  const derived: BuildGoal[] = []

  for (const inputWareId of Object.keys(module.inputs)) {
    const isolatedResult = ownerGroupId
      ? groupHasExplicitIsolatedWare(ownerGroupId, inputWareId, flowGroups)
      : findGroupWithIsolatedWare(inputWareId, flowGroups)
    if (isolatedResult && !seenIsolatedWares.has(inputWareId)) {
      derived.push({ type: 'derived-production', wareId: inputWareId, ratePerHour: 0 })
      seenIsolatedWares.add(inputWareId)
    }

    if (covered.has(inputWareId)) continue

    const nextModule = findModuleForWare(inputWareId, modulesByOutputMap)
    if (nextModule) {
      derived.push(...walkUpstream(nextModule, covered, flowGroups, modulesByOutputMap, seenIsolatedWares, ownerGroupId))
    }
  }

  return derived
}

export function generateDerivedGoalsFromLogicFlow(
  userGoals: BuildGoal[],
  flowGroups: ProductionLineGroup[],
  buildFlowView: BuildFlowView | null,
  modulesMap: Record<string, X4Module>,
  modulesByOutputMap: Record<string, X4Module[]>,
): { derivedGoals: BuildGoal[]; requiredMap: Map<string, string[]> } {
  const covered = buildCoveredSet(userGoals, flowGroups, modulesMap)
  const seenIsolatedWares = new Set<string>()
  const allDerived: BuildGoal[] = []
  const requiredMap = new Map<string, string[]>()

  for (const goal of userGoals) {
    let mod: X4Module | undefined
    if (goal.type === 'production-rate') {
      mod = findModuleForWare(goal.wareId, modulesByOutputMap)
    } else if (goal.type === 'build-module') {
      mod = modulesMap[goal.moduleId]
    }
    if (!mod) continue
    const ownerGroupId = resolveGoalOwnerGroupId(goal, flowGroups, buildFlowView, modulesMap)

    const beforeSize = seenIsolatedWares.size
    const derived = walkUpstream(mod, covered, flowGroups, modulesByOutputMap, seenIsolatedWares, ownerGroupId)
    if (seenIsolatedWares.size > beforeSize) {
      const wares: string[] = []
      for (const item of derived) {
        if ('wareId' in item && item.wareId) wares.push(item.wareId)
      }
      const key = extractWareId(goal, modulesMap)
      if (key) requiredMap.set(key, wares)
    }
    allDerived.push(...derived)
  }

  return { derivedGoals: allDerived, requiredMap }
}
