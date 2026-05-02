import type {
  ProductionLineGroup,
  FlowNode,
  X4Module,
  BuildFlowAssignment,
  BuildFlowLineCard,
  BuildFlowGroup,
  BuildFlowTag
} from '@/types/x4'

export type { BuildFlowAssignment, BuildFlowLineCard, BuildFlowGroup, BuildFlowTag }

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
  let skippedNoModule = 0
  let skippedTierZero = 0
  let skippedIsolated = 0
  let skippedNoModuleId = 0
  for (const group of groups) {
    for (const node of group.nodes) {
      if (node.isIsolated) { skippedIsolated++; continue }
      if (!node.moduleId) { skippedNoModuleId++; continue }
      const mod = modulesMap[node.moduleId]
      if (!mod) { skippedNoModule++; continue }
      if (mod.tier <= 0) { skippedTierZero++; continue }
      for (const wareId of Object.keys(mod.buildCost)) {
        wareSet.add(wareId)
      }
    }
  }
  console.log('[BuildFlowDerivation] computeDemandMaterialSet: wareSet size:', wareSet.size,
    'skipped: noModuleId:', skippedNoModuleId, 'noModule:', skippedNoModule,
    'tierZero:', skippedTierZero, 'isolated:', skippedIsolated)
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
    orderedCards.sort((a, b) => a.groupId.localeCompare(b.groupId))

    const outputSeen = new Set<string>()
    const outputTags: BuildFlowTag[] = []
    for (const card of orderedCards) {
      for (const tag of card.sourceTags) {
        if (outputSeen.has(tag.wareId)) continue
        outputSeen.add(tag.wareId)
        outputTags.push({
          tagId: `build-flow-target:output:${tag.wareId}`,
          wareId: tag.wareId,
          label: tag.label
        })
      }
    }

    const groupKey = orderedCards.map(c => c.groupId).sort().join(':')
    result.push({ groupKey, lineCards: orderedCards, outputTags })
  }

  return result
}

export function deriveBuildFlowView(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  groupDisplayNames: Map<string, string>,
  getWareLabel: (wareId: string) => string
): {
  demandMaterialSet: Set<string>
  lineCards: BuildFlowLineCard[]
  buildFlowGroups: BuildFlowGroup[]
} {
  const demandMaterialSet = computeDemandMaterialSet(groups, modulesMap)
  console.log('[BuildFlowDerivation] deriveBuildFlowView: groups:', groups.length, 'demandMaterialSet size:', demandMaterialSet.size)

  const lineCardsWithSource: Array<{ group: ProductionLineGroup; sourceTags: BuildFlowTag[] }> = []
  for (const group of groups) {
    const inBuildFlow = isGroupInBuildFlow(group, demandMaterialSet)
    console.log('[BuildFlowDerivation] group:', group.id, 'nodes:', group.nodes.length, 'inBuildFlow:', inBuildFlow)
    if (!inBuildFlow) continue
    const sourceTags = computeSourceTags(group, demandMaterialSet, getWareLabel)
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
    buildMaterialTags: computeBuildMaterialTags(group, outputMaterialWareIds, modulesMap, getWareLabel)
  }))

  const buildFlowGroups = computeBuildFlowGroups(lineCards)

  return { demandMaterialSet, lineCards, buildFlowGroups }
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
    } else {
      if (!outputWareIds.has(a.wareId)) return false

      const sourceGroupKey = groupIdToGroupKey.get(a.sourceGroupId)
      const outputGroup = buildFlowGroups.find(bg => bg.outputTags.some(t => t.wareId === a.wareId))
      if (outputGroup && sourceGroupKey !== outputGroup.groupKey) return false
    }

    return true
  })
}
