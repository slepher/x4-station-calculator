import type {
  ProductionLineGroup,
  FlowNode,
  X4Module,
  BuildFlowAssignment,
  BuildFlowLineCard,
  BuildFlowGroup,
  BuildFlowTag,
  VirtualEdge
} from '@/types/x4'

export type { BuildFlowAssignment, BuildFlowLineCard, BuildFlowGroup, BuildFlowTag, VirtualEdge }

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
  modulesMap: Record<string, X4Module>,
  archivedGroupIds?: string[]
): Set<string> {
  const wareSet = new Set<string>()
  const archivedSet = new Set(archivedGroupIds || [])
  for (const group of groups) {
    if (archivedSet.has(group.id)) continue
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
  getWareLabel: (wareId: string) => string
): BuildFlowTag[] {
  const manualProducts = getManualProductNodes(group)
  const seen = new Set<string>()
  const tags: BuildFlowTag[] = []
  for (const node of manualProducts) {
    if (!demandMaterialSet.has(node.wareId)) continue
    if (seen.has(node.wareId)) continue
    seen.add(node.wareId)
    tags.push({
      tagId: `build-flow-source:${group.id}:${node.wareId}`,
      wareId: node.wareId,
      label: getWareLabel(node.wareId)
    })
  }
  return tags
}

export function computeBuildMaterialTags(
  group: ProductionLineGroup,
  outputMaterialWareIds: Set<string>,
  modulesMap: Record<string, X4Module>,
  getWareLabel: (wareId: string) => string
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
    return {
      tagId: `build-flow-target:line:${group.id}:${wareId}`,
      wareId,
      label: getWareLabel(wareId)
    }
  })
}

export function computeBuildFlowGroups(lineCards: BuildFlowLineCard[]): BuildFlowGroup[] {
  const cardOrder = new Map<string, number>()
  lineCards.forEach((card, idx) => cardOrder.set(card.groupId, idx))

  const U = new Set<string>()
  for (const card of lineCards) {
    for (const tag of card.sourceTags) {
      U.add(tag.wareId)
    }
  }

  const cardBySourceWare = new Map<string, BuildFlowLineCard[]>()
  for (const card of lineCards) {
    for (const tag of card.sourceTags) {
      let arr = cardBySourceWare.get(tag.wareId)
      if (!arr) {
        arr = []
        cardBySourceWare.set(tag.wareId, arr)
      }
      arr.push(card)
    }
  }

  const buildMatWareIdsByCard = new Map<string, Set<string>>()
  for (const card of lineCards) {
    const wares = new Set<string>()
    for (const tag of card.buildMaterialTags) {
      wares.add(tag.wareId)
    }
    buildMatWareIdsByCard.set(card.groupId, wares)
  }

  const visitedWares = new Set<string>()
  const result: BuildFlowGroup[] = []

  for (const seedWare of U) {
    if (visitedWares.has(seedWare)) continue

    const groupCards = new Map<string, BuildFlowLineCard>()
    const queue: string[] = [seedWare]

    while (queue.length > 0) {
      const wareId = queue.shift()!
      if (visitedWares.has(wareId)) continue
      visitedWares.add(wareId)

      const cards = cardBySourceWare.get(wareId)
      if (!cards) continue

      for (const card of cards) {
        if (groupCards.has(card.groupId)) continue
        groupCards.set(card.groupId, card)

        const buildMats = buildMatWareIdsByCard.get(card.groupId)
        if (buildMats) {
          for (const matWareId of buildMats) {
            if (U.has(matWareId) && !visitedWares.has(matWareId)) {
              queue.push(matWareId)
            }
          }
        }
      }
    }

    const orderedCards = Array.from(groupCards.values())
    orderedCards.sort((a, b) => (cardOrder.get(a.groupId) ?? 0) - (cardOrder.get(b.groupId) ?? 0))

    const outputBuildSeen = new Set<string>()
    const outputBuildTags: BuildFlowTag[] = []
    const outputMaterialTags: BuildFlowTag[] = []
    for (const card of orderedCards) {
      for (const tag of card.sourceTags) {
        if (outputBuildSeen.has(tag.wareId)) continue
        outputBuildSeen.add(tag.wareId)
        outputBuildTags.push({
          tagId: `build-flow-target:output-build:${tag.wareId}`,
          wareId: tag.wareId,
          label: tag.label
        })
        outputMaterialTags.push({
          tagId: `build-flow-target:output:${tag.wareId}`,
          wareId: tag.wareId,
          label: tag.label
        })
      }
    }

    const groupKey = orderedCards.map(c => c.groupId).sort().join(':')
    result.push({ groupKey, lineCards: orderedCards, outputBuildTags, outputMaterialTags })
  }

  return result
}

export function deriveBuildFlowView(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  groupDisplayNames: Map<string, string>,
  getWareLabel: (wareId: string) => string,
  archivedGroupIds?: string[]
): {
  demandMaterialSet: Set<string>
  lineCards: BuildFlowLineCard[]
  archivedLineCards: BuildFlowLineCard[]
  buildFlowGroups: BuildFlowGroup[]
} {
  const demandMaterialSet = computeDemandMaterialSet(groups, modulesMap, archivedGroupIds)
  const archivedSet = new Set(archivedGroupIds || [])

  const activeItems: Array<{ group: ProductionLineGroup; sourceTags: BuildFlowTag[] }> = []
  const archivedItems: Array<{ group: ProductionLineGroup; sourceTags: BuildFlowTag[] }> = []
  
  for (const group of groups) {
    if (!isGroupInBuildFlow(group, demandMaterialSet)) continue
    const sourceTags = computeSourceTags(group, demandMaterialSet, getWareLabel)
    if (archivedSet.has(group.id)) {
      archivedItems.push({ group, sourceTags })
    } else {
      activeItems.push({ group, sourceTags })
    }
  }

  const outputMaterialWareIds = new Set<string>()
  for (const item of activeItems) {
    for (const tag of item.sourceTags) {
      outputMaterialWareIds.add(tag.wareId)
    }
  }

  const lineCards: BuildFlowLineCard[] = activeItems.map(({ group, sourceTags }) => ({
    groupId: group.id,
    title: groupDisplayNames.get(group.id) || group.name || group.id,
    sourceTags,
    buildMaterialTags: computeBuildMaterialTags(group, outputMaterialWareIds, modulesMap, getWareLabel)
  }))

  const archivedLineCards: BuildFlowLineCard[] = archivedItems.map(({ group, sourceTags }) => ({
    groupId: group.id,
    title: groupDisplayNames.get(group.id) || group.name || group.id,
    sourceTags,
    buildMaterialTags: computeBuildMaterialTags(group, outputMaterialWareIds, modulesMap, getWareLabel)
  }))

  const buildFlowGroups = computeBuildFlowGroups(lineCards)

  return { demandMaterialSet, lineCards, archivedLineCards, buildFlowGroups }
}

export function computeVirtualEdges(
  buildFlowGroups: BuildFlowGroup[],
  assignments: BuildFlowAssignment[],
  archivedGroupIds: string[],
  allGroups: ProductionLineGroup[]
): VirtualEdge[] {
  const assignedTargetKeys = new Set(assignments.map(computeTargetKey))
  const archivedSet = new Set(archivedGroupIds)
  const result: VirtualEdge[] = []

  const archivedSourceWareIds = new Map<string, string[]>()
  for (const group of allGroups) {
    if (!archivedSet.has(group.id)) continue
    const wares = getManualProductNodes(group).map(n => n.wareId)
    if (wares.length > 0) archivedSourceWareIds.set(group.id, wares)
  }

  for (const group of buildFlowGroups) {
    for (const tag of group.outputBuildTags) {
      const targetKey = `output-build:${tag.wareId}`
      if (assignedTargetKeys.has(targetKey)) continue
      const sourceId = findFirstNonArchivedSourceInGroup(group, tag.wareId, archivedSet)
      if (sourceId) {
        result.push({
          wareId: tag.wareId,
          sourceGroupId: sourceId,
          targetType: 'output-build-material',
          isArchived: false,
          isDashed: true
        })
      }
    }

    for (const tag of group.outputMaterialTags) {
      const targetKey = `output:${tag.wareId}`
      if (assignedTargetKeys.has(targetKey)) continue
      let foundArchived = false
      for (const [gId, wares] of archivedSourceWareIds) {
        if (wares.includes(tag.wareId)) {
          result.push({
            wareId: tag.wareId,
            sourceGroupId: gId,
            targetType: 'output-material',
            isArchived: true,
            isDashed: false
          })
          foundArchived = true
          break
        }
      }
      if (foundArchived) continue

      const sourceId = findFirstNonArchivedSourceInGroup(group, tag.wareId, archivedSet)
      if (sourceId) {
        result.push({
          wareId: tag.wareId,
          sourceGroupId: sourceId,
          targetType: 'output-material',
          isArchived: false,
          isDashed: true
        })
      }
    }
  }

  return result
}

function findFirstNonArchivedSourceInGroup(group: BuildFlowGroup, wareId: string, archivedSet: Set<string>): string | null {
  for (const card of group.lineCards) {
    if (archivedSet.has(card.groupId)) continue
    if (card.sourceTags.some(t => t.wareId === wareId)) {
      return card.groupId
    }
  }
  return null
}

export function computeTargetKey(assignment: BuildFlowAssignment): string {
  if (assignment.targetType === 'line-build-material') {
    return `line:${assignment.targetGroupId}:${assignment.wareId}`
  }
  if (assignment.targetType === 'output-build-material') {
    return `output-build:${assignment.wareId}`
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
  modulesMap: Record<string, X4Module>,
  buildFlowGroups: BuildFlowGroup[]
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

  const groupIdToGroupKey = new Map<string, string>()
  for (const bg of buildFlowGroups) {
    for (const card of bg.lineCards) {
      groupIdToGroupKey.set(card.groupId, bg.groupKey)
    }
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

      const sourceGroupKey = groupIdToGroupKey.get(a.sourceGroupId)
      const targetGroupKey = groupIdToGroupKey.get(a.targetGroupId)
      if (sourceGroupKey !== targetGroupKey) return false
    } else if (a.targetType === 'output-build-material') {
      if (!outputWareIds.has(a.wareId)) return false

      const sourceGroupKey = groupIdToGroupKey.get(a.sourceGroupId)
      const outputGroup = buildFlowGroups.find(bg => bg.outputBuildTags.some(t => t.wareId === a.wareId))
      if (outputGroup && sourceGroupKey !== outputGroup.groupKey) return false
    } else {
      if (!outputWareIds.has(a.wareId)) return false

      const sourceGroupKey = groupIdToGroupKey.get(a.sourceGroupId)
      const outputGroup = buildFlowGroups.find(bg => bg.outputMaterialTags.some(t => t.wareId === a.wareId))
      if (outputGroup && sourceGroupKey !== outputGroup.groupKey) return false
    }

    return true
  })
}
