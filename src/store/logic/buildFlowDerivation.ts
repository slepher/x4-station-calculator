import type {
  ProductionLineGroup,
  FlowNode,
  X4Module,
  BuildFlowAssignment,
  BuildFlowLineCard,
  BuildFlowOutputCard,
  BuildFlowTag
} from '@/types/x4'

export type { BuildFlowAssignment, BuildFlowLineCard, BuildFlowOutputCard, BuildFlowTag }

function getModuleScopeNodes(group: ProductionLineGroup, modulesMap: Record<string, X4Module>): FlowNode[] {
  return group.nodes.filter(node => {
    if (node.isIsolated) return false
    if (!node.moduleId) return false
    const mod = modulesMap[node.moduleId]
    if (!mod) return false
    if (mod.tier <= 0) return false
    return true
  })
}

export function getManualProductNodes(group: ProductionLineGroup): FlowNode[] {
  return group.nodes.filter(n => n.source === 'manual' && !n.isIsolated)
}

export function computeDemandMaterialSet(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>
): Set<string> {
  const wareSet = new Set<string>()
  for (const group of groups) {
    const scopeNodes = getModuleScopeNodes(group, modulesMap)
    for (const node of scopeNodes) {
      const mod = modulesMap[node.moduleId!]
      if (!mod) continue
      for (const wareId of Object.keys(mod.buildCost)) {
        wareSet.add(wareId)
      }
    }
  }
  return wareSet
}

export function isGroupInBuildFlow(
  group: ProductionLineGroup,
  demandMaterialSet: Set<string>
): boolean {
  const manualProducts = getManualProductNodes(group)
  return manualProducts.some(n => demandMaterialSet.has(n.wareId))
}

export function computeSourceTags(
  group: ProductionLineGroup,
  demandMaterialSet: Set<string>,
  waresMap: Record<string, { name: string }>
): BuildFlowTag[] {
  const manualProducts = getManualProductNodes(group)
  const seen = new Set<string>()
  const tags: BuildFlowTag[] = []
  for (const node of manualProducts) {
    if (!demandMaterialSet.has(node.wareId)) continue
    if (seen.has(node.wareId)) continue
    seen.add(node.wareId)
    const ware = waresMap[node.wareId]
    tags.push({
      tagId: `build-flow-source:${group.id}:${node.wareId}`,
      wareId: node.wareId,
      label: ware?.name || node.wareId
    })
  }
  return tags
}

export function computeBuildMaterialTags(
  group: ProductionLineGroup,
  outputMaterialWareIds: Set<string>,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, { name: string }>
): BuildFlowTag[] {
  const scopeNodes = getModuleScopeNodes(group, modulesMap)
  const materialWareIds = new Set<string>()
  for (const node of scopeNodes) {
    const mod = modulesMap[node.moduleId!]
    if (!mod) continue
    for (const wareId of Object.keys(mod.buildCost)) {
      if (outputMaterialWareIds.has(wareId)) {
        materialWareIds.add(wareId)
      }
    }
  }
  return Array.from(materialWareIds).map(wareId => {
    const ware = waresMap[wareId]
    return {
      tagId: `build-flow-target:line:${group.id}:${wareId}`,
      wareId,
      label: ware?.name || wareId
    }
  })
}

export function computeOutputTags(
  lineCards: BuildFlowLineCard[]
): BuildFlowTag[] {
  const seen = new Set<string>()
  const tags: BuildFlowTag[] = []
  for (const card of lineCards) {
    for (const tag of card.sourceTags) {
      if (seen.has(tag.wareId)) continue
      seen.add(tag.wareId)
      tags.push({
        tagId: `build-flow-target:output:${tag.wareId}`,
        wareId: tag.wareId,
        label: tag.label
      })
    }
  }
  return tags
}

export function deriveBuildFlowView(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, { name: string }>,
  groupDisplayNames: Map<string, string>
): {
  demandMaterialSet: Set<string>
  lineCards: BuildFlowLineCard[]
  outputCard: BuildFlowOutputCard
} {
  const demandMaterialSet = computeDemandMaterialSet(groups, modulesMap)

  const lineCardsWithSource: Array<{ group: ProductionLineGroup; sourceTags: BuildFlowTag[] }> = []
  for (const group of groups) {
    if (!isGroupInBuildFlow(group, demandMaterialSet)) continue
    const sourceTags = computeSourceTags(group, demandMaterialSet, waresMap)
    lineCardsWithSource.push({ group, sourceTags })
  }

  const outputMaterialWareIds = new Set<string>()
  for (const item of lineCardsWithSource) {
    for (const tag of item.sourceTags) {
      outputMaterialWareIds.add(tag.wareId)
    }
  }

  const lineCards: BuildFlowLineCard[] = lineCardsWithSource.map(({ group, sourceTags }) => ({
    groupId: group.id,
    title: groupDisplayNames.get(group.id) || group.name || group.id,
    sourceTags,
    buildMaterialTags: computeBuildMaterialTags(group, outputMaterialWareIds, modulesMap, waresMap)
  }))

  const outputTags = computeOutputTags(lineCards)
  const outputCard: BuildFlowOutputCard = { outputTags }

  return { demandMaterialSet, lineCards, outputCard }
}

export function computeTargetKey(assignment: BuildFlowAssignment): string {
  if (assignment.targetType === 'line-build-material') {
    return `line:${assignment.targetGroupId}:${assignment.wareId}`
  }
  return `output:${assignment.wareId}`
}

export function addAssignment(
  assignments: BuildFlowAssignment[],
  newAssignment: BuildFlowAssignment
): BuildFlowAssignment[] {
  const targetKey = computeTargetKey(newAssignment)
  const filtered = assignments.filter(a => computeTargetKey(a) !== targetKey)
  filtered.push(newAssignment)
  return filtered
}

export function removeAssignment(
  assignments: BuildFlowAssignment[],
  targetKey: string
): BuildFlowAssignment[] {
  return assignments.filter(a => computeTargetKey(a) !== targetKey)
}

export function cleanupStaleAssignments(
  assignments: BuildFlowAssignment[],
  groups: ProductionLineGroup[],
  demandMaterialSet: Set<string>,
  modulesMap: Record<string, X4Module>
): BuildFlowAssignment[] {
  const groupIdSet = new Set(groups.map(g => g.id))
  const buildFlowGroupIds = new Set<string>()
  const sourceTagWareIdsByGroup = new Map<string, Set<string>>()

  for (const group of groups) {
    if (!isGroupInBuildFlow(group, demandMaterialSet)) continue
    buildFlowGroupIds.add(group.id)

    const sourceWares = new Set<string>()
    for (const node of getManualProductNodes(group)) {
      if (demandMaterialSet.has(node.wareId)) sourceWares.add(node.wareId)
    }
    sourceTagWareIdsByGroup.set(group.id, sourceWares)
  }

  const outputWareIds = new Set<string>()
  for (const [, sourceWares] of sourceTagWareIdsByGroup) {
    for (const wareId of sourceWares) {
      outputWareIds.add(wareId)
    }
  }

  const buildMaterialTagWareIdsByGroup = new Map<string, Set<string>>()
  for (const groupId of buildFlowGroupIds) {
    const group = groups.find(g => g.id === groupId)
    if (!group) continue
    const buildMatWares = new Set<string>()
    for (const node of getModuleScopeNodes(group, modulesMap)) {
      const mod = modulesMap[node.moduleId!]
      if (!mod) continue
      for (const wareId of Object.keys(mod.buildCost)) {
        if (outputWareIds.has(wareId)) buildMatWares.add(wareId)
      }
    }
    buildMaterialTagWareIdsByGroup.set(group.id, buildMatWares)
  }

  return assignments.filter(a => {
    if (!groupIdSet.has(a.sourceGroupId)) return false
    if (!buildFlowGroupIds.has(a.sourceGroupId)) return false
    const sourceWares = sourceTagWareIdsByGroup.get(a.sourceGroupId)
    if (!sourceWares || !sourceWares.has(a.wareId)) return false

    if (a.targetType === 'line-build-material') {
      if (!a.targetGroupId || !groupIdSet.has(a.targetGroupId)) return false
      if (!buildFlowGroupIds.has(a.targetGroupId)) return false
      const targetBuildMats = buildMaterialTagWareIdsByGroup.get(a.targetGroupId)
      if (!targetBuildMats || !targetBuildMats.has(a.wareId)) return false
    } else {
      if (!outputWareIds.has(a.wareId)) return false
    }

    return true
  })
}
