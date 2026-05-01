import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  BuildFlowAssignment,
  BuildFlowLineCard,
  BuildFlowOutputCard,
  BuildFlowTargetType
} from '@/types/x4'
import { computeTargetKey } from '@/store/logic/buildFlowDerivation'

export interface BuildFlowPresenterStore {
  lineCards: ComputedRef<BuildFlowLineCard[]>
  outputCard: ComputedRef<BuildFlowOutputCard>
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
}

export interface UseBuildFlowPresenterReturn {
  lineCards: ComputedRef<BuildFlowLineCard[]>
  outputCard: ComputedRef<BuildFlowOutputCard>
  edges: ComputedRef<BuildFlowEdge[]>
  isDragging: ComputedRef<boolean>
  getTargetsForSource(wareId: string): MenuTargetItem[]
  bindFromMenu(sourceGroupId: string, wareId: string, target: MenuTargetItem): void
  bindFromDrag(sourceGroupId: string, wareId: string, targetType: BuildFlowTargetType, targetGroupId?: string): void
  unbind(targetKey: string): void
  startDrag(): void
  stopDrag(): void
  getTargetKeyForAssignment(assignment: BuildFlowAssignment): string
  isTagBoundAsTarget(tagId: string): ComputedRef<boolean>
  getBoundSourceForTarget(targetKey: string): ComputedRef<BuildFlowAssignment | undefined>
}

export function useBuildFlowPresenter(store: BuildFlowPresenterStore): UseBuildFlowPresenterReturn {
  const getAssignments = () => {
    const a = store.assignments
    return Array.isArray(a) ? a : a.value
  }

  const lineCards = computed(() => store.lineCards.value)
  const outputCard = computed(() => store.outputCard.value)
  const isDragging = computed(() => store.isDragging.value)

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

  function getTargetsForSource(wareId: string): MenuTargetItem[] {
    const targets: MenuTargetItem[] = []
    for (const card of store.lineCards.value) {
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
          targetKey
        })
      }
    }
    for (const tag of store.outputCard.value.outputTags) {
      if (tag.wareId !== wareId) continue
      const targetKey = `output:${wareId}`
      targets.push({
        targetType: 'output-material',
        wareId,
        wareLabel: tag.label,
        cardTitle: '',
        tagId: tag.tagId,
        targetKey
      })
    }
    return targets
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

  function isTagBoundAsTarget(tagId: string): ComputedRef<boolean> {
    return computed(() => {
      return getAssignments().some(a => {
        const targetTagId = a.targetType === 'line-build-material'
          ? `build-flow-target:line:${a.targetGroupId}:${a.wareId}`
          : `build-flow-target:output:${a.wareId}`
        return targetTagId === tagId
      })
    })
  }

  function getBoundSourceForTarget(targetKey: string): ComputedRef<BuildFlowAssignment | undefined> {
    return computed(() => {
      return getAssignments().find(a => computeTargetKey(a) === targetKey)
    })
  }

  return {
    lineCards,
    outputCard,
    edges,
    isDragging,
    getTargetsForSource,
    bindFromMenu,
    bindFromDrag,
    unbind,
    startDrag,
    stopDrag,
    getTargetKeyForAssignment,
    isTagBoundAsTarget,
    getBoundSourceForTarget
  }
}
