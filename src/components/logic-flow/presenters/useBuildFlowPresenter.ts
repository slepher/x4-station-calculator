import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  BuildFlowAssignment,
  BuildFlowLineCard,
  BuildFlowGroup,
  BuildFlowTag,
  BuildFlowTargetType
} from '@/types/x4'
import { computeTargetKey } from '@/store/logic/buildFlowDerivation'

export interface BuildFlowPresenterStore {
  lineCards: ComputedRef<BuildFlowLineCard[]>
  buildFlowGroups: ComputedRef<BuildFlowGroup[]>
  assignments: Ref<BuildFlowAssignment[]> | BuildFlowAssignment[]
  isDragging: ComputedRef<boolean>
  bindAssignment(assignment: BuildFlowAssignment): void
  unbindAssignment(targetKey: string): void
  startBuildFlowDrag(): void
  stopBuildFlowDrag(): void
}

export interface BuildFlowEdge {
  id: string
  sourceTagId: string
  targetTagId: string
  wareId: string
  sourceGroupId: string
  targetType: BuildFlowTargetType
  targetGroupId?: string
}

export interface MenuTargetItem {
  targetType: BuildFlowTargetType
  targetGroupId?: string
  wareId: string
  wareLabel: string
  cardTitle: string
  tagId: string
  targetKey: string
  isBound: boolean
  bindingState?: 'self' | 'other' | 'none'
}

export interface BuildFlowRow {
  wareId: string
  buildMaterialTag: BuildFlowTag | null
  sourceTag: BuildFlowTag | null
}

export interface UseBuildFlowPresenterReturn {
  lineCards: ComputedRef<BuildFlowLineCard[]>
  buildFlowGroups: ComputedRef<BuildFlowGroup[]>
  cardRows: ComputedRef<BuildFlowRow[][]>
  edges: ComputedRef<BuildFlowEdge[]>
  isDragging: ComputedRef<boolean>
  getTargetsForSource(wareId: string, sourceGroupId: string): MenuTargetItem[]
  getSourcesForTarget(wareId: string, targetGroupKey: string): MenuTargetItem[]
  bindFromMenu(sourceGroupId: string, wareId: string, target: MenuTargetItem): void
  bindFromDrag(sourceGroupId: string, wareId: string, targetType: BuildFlowTargetType, targetGroupId?: string): void
  unbind(targetKey: string): void
  startDrag(): void
  stopDrag(): void
  getTargetKeyForAssignment(assignment: BuildFlowAssignment): string
  getBoundSourceForTarget(targetKey: string): ComputedRef<BuildFlowAssignment | undefined>
}

export function useBuildFlowPresenter(store: BuildFlowPresenterStore): UseBuildFlowPresenterReturn {
  const getAssignments = () => {
    const a = store.assignments
    return Array.isArray(a) ? a : a.value
  }

  const lineCards = computed(() => store.lineCards.value)
  const buildFlowGroups = computed(() => store.buildFlowGroups.value)
  const isDragging = computed(() => store.isDragging.value)

  const groupIdToGroupKey = computed(() => {
    const map = new Map<string, string>()
    for (const bg of store.buildFlowGroups.value) {
      for (const card of bg.lineCards) {
        map.set(card.groupId, bg.groupKey)
      }
    }
    return map
  })

  const cardRows = computed<BuildFlowRow[][]>(() => {
    return store.lineCards.value.map(card => {
      const seenWareIds = new Set<string>()
      const rows: BuildFlowRow[] = []
      for (const tag of card.buildMaterialTags) {
        seenWareIds.add(tag.wareId)
        const sourceTag = card.sourceTags.find(t => t.wareId === tag.wareId) || null
        rows.push({ wareId: tag.wareId, buildMaterialTag: tag, sourceTag })
      }
      for (const tag of card.sourceTags) {
        if (seenWareIds.has(tag.wareId)) continue
        seenWareIds.add(tag.wareId)
        rows.push({ wareId: tag.wareId, buildMaterialTag: null, sourceTag: tag })
      }
      return rows
    })
  })

  const edges = computed<BuildFlowEdge[]>(() => {
    return getAssignments().map((a) => {
      const sourceTagId = `build-flow-source:${a.sourceGroupId}:${a.wareId}`
      let targetTagId: string
      if (a.targetType === 'line-build-material') {
        targetTagId = `build-flow-target:line:${a.targetGroupId}:${a.wareId}`
      } else {
        targetTagId = `build-flow-target:output:${a.wareId}`
      }
      return {
        id: `edge:${a.sourceGroupId}:${a.wareId}->${computeTargetKey(a)}`,
        sourceTagId,
        targetTagId,
        wareId: a.wareId,
        sourceGroupId: a.sourceGroupId,
        targetType: a.targetType,
        targetGroupId: a.targetGroupId
      }
    })
  })

  function getTargetsForSource(wareId: string, sourceGroupId: string): MenuTargetItem[] {
    const targets: MenuTargetItem[] = []
    const assignments = getAssignments()
    const sourceGroupKey = groupIdToGroupKey.value.get(sourceGroupId)
    const sourceGroup = store.buildFlowGroups.value.find(bg => bg.groupKey === sourceGroupKey)
    if (!sourceGroup) return targets

    for (const card of sourceGroup.lineCards) {
      for (const tag of card.buildMaterialTags) {
        if (tag.wareId !== wareId) continue
        const targetKey = `line:${card.groupId}:${wareId}`
        targets.push({
          targetType: 'line-build-material',
          targetGroupId: card.groupId,
          wareId,
          wareLabel: tag.label,
          cardTitle: card.title,
          tagId: tag.tagId,
          targetKey,
          isBound: assignments.some(a => computeTargetKey(a) === targetKey),
          bindingState: 'none'
        })
      }
    }
    for (const tag of sourceGroup.outputTags) {
      if (tag.wareId !== wareId) continue
      const targetKey = `output:${wareId}`
      targets.push({
        targetType: 'output-material',
        wareId,
        wareLabel: tag.label,
        cardTitle: '',
        tagId: tag.tagId,
        targetKey,
        isBound: assignments.some(a => computeTargetKey(a) === targetKey),
        bindingState: 'none'
      })
    }
    return targets
  }

  function getSourcesForTarget(wareId: string, targetGroupKey: string): MenuTargetItem[] {
    const sources: MenuTargetItem[] = []
    const assignments = getAssignments()
    const targetGroup = store.buildFlowGroups.value.find(bg => bg.groupKey === targetGroupKey)
    if (!targetGroup) return sources

    for (const card of targetGroup.lineCards) {
      for (const tag of card.sourceTags) {
        if (tag.wareId !== wareId) continue
        const targetKey = `line:${card.groupId}:${wareId}`
        sources.push({
          targetType: 'line-build-material',
          targetGroupId: card.groupId,
          wareId,
          wareLabel: tag.label,
          cardTitle: card.title,
          tagId: tag.tagId,
          targetKey,
          isBound: assignments.some(a => a.sourceGroupId === card.groupId && a.wareId === wareId),
          bindingState: 'none'
        })
      }
    }
    return sources
  }

  function bindFromMenu(sourceGroupId: string, wareId: string, target: MenuTargetItem): void {
    const assignment: BuildFlowAssignment = {
      wareId,
      sourceGroupId,
      targetType: target.targetType,
      targetGroupId: target.targetGroupId
    }
    store.bindAssignment(assignment)
  }

  function bindFromDrag(sourceGroupId: string, wareId: string, targetType: BuildFlowTargetType, targetGroupId?: string): void {
    const assignment: BuildFlowAssignment = {
      wareId,
      sourceGroupId,
      targetType,
      targetGroupId
    }
    store.bindAssignment(assignment)
  }

  function unbind(targetKey: string): void {
    store.unbindAssignment(targetKey)
  }

  function startDrag(): void {
    store.startBuildFlowDrag()
  }

  function stopDrag(): void {
    store.stopBuildFlowDrag()
  }

  function getTargetKeyForAssignment(assignment: BuildFlowAssignment): string {
    return computeTargetKey(assignment)
  }

  function getBoundSourceForTarget(targetKey: string): ComputedRef<BuildFlowAssignment | undefined> {
    return computed(() => {
      return getAssignments().find(a => computeTargetKey(a) === targetKey)
    })
  }

  return {
    lineCards,
    buildFlowGroups,
    cardRows,
    edges,
    isDragging,
    getTargetsForSource,
    getSourcesForTarget,
    bindFromMenu,
    bindFromDrag,
    unbind,
    startDrag,
    stopDrag,
    getTargetKeyForAssignment,
    getBoundSourceForTarget
  }
}
