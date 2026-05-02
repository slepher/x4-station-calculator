<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueFlow, Handle, Position } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useBuildFlowPresenter, type MenuTargetItem } from './presenters/useBuildFlowPresenter'
import type { BuildFlowTag, BuildFlowTargetType } from '@/types/x4'

const { t } = useI18n()
const logicFlow = useLogicFlowStore()

const presenter = useBuildFlowPresenter({
  lineCards: computed(() => logicFlow.buildFlowLineCards),
  buildFlowGroups: computed(() => logicFlow.buildFlowGroups),
  assignments: logicFlow.buildFlowAssignments,
  isDragging: computed(() => logicFlow.isBuildFlowDragging),
  bindAssignment: logicFlow.bindBuildFlowAssignment,
  unbindAssignment: logicFlow.unbindBuildFlowAssignment,
  startBuildFlowDrag: logicFlow.startBuildFlowDrag,
  stopBuildFlowDrag: logicFlow.stopBuildFlowDrag
})

const shouldHide = computed(() => {
  return logicFlow.isDragging && !logicFlow.isBuildFlowDragging
})

const hasContent = computed(() => presenter.lineCards.value.length > 0)

const cardIndexByGroupId = computed(() => {
  const map = new Map<string, number>()
  presenter.lineCards.value.forEach((card, idx) => map.set(card.groupId, idx))
  return map
})

const sortedGroupTags = computed(() => {
  return presenter.buildFlowGroups.value.map(group => {
    const sorted = [...group.outputTags].sort((a, b) => a.wareId.localeCompare(b.wareId))
    const order = new Map(sorted.map((t, i) => [t.wareId, i]))
    return { groupKey: group.groupKey, outputTags: sorted, order, lineCards: group.lineCards }
  })
})

function getSortedRows(cardGroupId: string, order: Map<string, number>) {
  const idx = cardIndexByGroupId.value.get(cardGroupId)
  if (idx === undefined) return []
  const rows = [...(presenter.cardRows.value[idx] ?? [])]
  rows.sort((a, b) => {
    const ia = order.get(a.wareId) ?? 999
    const ib = order.get(b.wareId) ?? 999
    return ia - ib
  })
  return rows
}

const CARD_W = 320, OUT_W = 160, CARD_GAP = 64
const groupNodes = computed(() => {
  const result: any[] = []
  const groups = presenter.buildFlowGroups.value
  groups.forEach((group, gi) => {
    const nodes: any[] = []
    let y = 0
    group.lineCards.forEach(card => {
      const rows = Math.max(card.sourceTags.length, card.buildMaterialTags.length)
      const h = 50 + rows * 28
      nodes.push({ id: `line:${card.groupId}`, type: 'card', position: { x: 96, y }, data: { card, groupKey: group.groupKey, cardRows: getSortedRows(card.groupId, sortedGroupTags.value[gi]?.order ?? new Map()) }, style: { width: `${CARD_W}px`, height: `${h}px` } })
      y += h + CARD_GAP
    })
    const outH = 50 + group.outputTags.length * 28
    nodes.push({ id: `output:${group.groupKey}`, type: 'output', position: { x: 480, y: Math.max(0, (y - outH) / 2) }, data: { outputTags: sortedGroupTags.value[gi]?.outputTags ?? [], groupKey: group.groupKey }, style: { width: `${OUT_W}px`, height: `${outH}px` } })
    result.push({ groupKey: group.groupKey, nodes, height: Math.max(y, outH) + 16 })
  })
  return result
})

const groupEdges = computed(() => {
  const result = new Map<string, any[]>()
  for (const a of logicFlow.buildFlowAssignments) {
    const gKey = getGroupKeyForGroupId(presenter.buildFlowGroups.value, a.sourceGroupId)
    if (!gKey) continue
    if (!result.has(gKey)) result.set(gKey, [])
    const targetNodeId = a.targetType === 'line-build-material' ? `line:${a.targetGroupId}` : `output:${gKey}`
    const targetHandle = a.targetType === 'line-build-material' ? `tgt:${a.wareId}` : `out:${a.wareId}`
    const edge = { id: `e:${a.sourceGroupId}:${a.wareId}:${a.targetType}`, source: `line:${a.sourceGroupId}`, sourceHandle: `src:${a.wareId}`, target: targetNodeId, targetHandle, type: 'step', style: { stroke: 'rgba(251,146,60,0.7)', strokeWidth: 2 } }
    result.get(gKey)!.push(edge)
  }
  return result
})

function getGroupKeyForGroupId(groups: any[], groupId: string) {
  for (const g of groups) if (g.lineCards.some((c: any) => c.groupId === groupId)) return g.groupKey
  return ''
}

const boundTargetTagIds = computed(() => {
  const ids = new Set<string>()
  for (const a of logicFlow.buildFlowAssignments) {
    const tagId = a.targetType === 'line-build-material'
      ? `build-flow-target:line:${a.targetGroupId}:${a.wareId}`
      : `build-flow-target:output:${a.wareId}`
    ids.add(tagId)
  }
  return ids
})

// --- Drag state ---
const draggingTag = ref<{ groupId: string; wareId: string } | null>(null)

function onSourceDragStart(groupId: string, wareId: string) {
  draggingTag.value = { groupId, wareId }
  presenter.startDrag()
}

function onSourceDragEnd() {
  draggingTag.value = null
  presenter.stopDrag()
}

function onTargetDrop(targetType: BuildFlowTargetType, targetGroupId?: string) {
  if (!draggingTag.value) return
  const { groupId, wareId } = draggingTag.value
  presenter.bindFromDrag(groupId, wareId, targetType, targetGroupId)
  draggingTag.value = null
  presenter.stopDrag()
}

// --- Menu state ---
const menuSourceTag = ref<{ groupId: string; wareId: string; tagId: string } | null>(null)
const menuTargetTag = ref<{ wareId: string; tagId: string; targetType: BuildFlowTargetType; targetGroupId?: string } | null>(null)
const menuTargets = ref<MenuTargetItem[]>([])
const menuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

function onPlusClick(groupId: string, wareId: string, tagId: string, event: MouseEvent) {
  const targets = presenter.getTargetsForSource(wareId, groupId)
  if (targets.length === 0) return
  menuTargets.value = targets.map((item) => {
    const assignment = logicFlow.buildFlowAssignments.find((candidate) => {
      if (candidate.targetType === 'line-build-material') {
        return item.targetKey === `line:${candidate.targetGroupId}:${candidate.wareId}`
      }
      return item.targetKey === `output:${candidate.wareId}`
    })
    let bindingState: 'self' | 'other' | 'none' = 'none'
    if (assignment) {
      bindingState = assignment.sourceGroupId === groupId ? 'self' : 'other'
    }
    return {
      ...item,
      isBound: assignment != null,
      bindingState
    }
  })
  menuSourceTag.value = { groupId, wareId, tagId }
  menuTargetTag.value = null
  const btn = (event.target as HTMLElement).closest('.source-tag-add-btn') || (event.currentTarget as HTMLElement)
  const rect = btn.getBoundingClientRect()
  const menuWidth = 192
  const windowWidth = window.innerWidth
  let x = rect.right + 8
  if (x + menuWidth > windowWidth) {
    x = rect.left - menuWidth - 8
  }
  menuPosition.value = { x, y: rect.top }
}

function onTargetTagPlusClick(wareId: string, tagId: string, targetType: BuildFlowTargetType, targetGroupId: string | undefined, groupKey: string, event: MouseEvent) {
  const sources = presenter.getSourcesForTarget(wareId, groupKey)
  if (sources.length === 0) return
  const currentTargetKey = targetType === 'line-build-material'
    ? `line:${targetGroupId}:${wareId}`
    : `output:${wareId}`
  const currentBoundAssignment = logicFlow.buildFlowAssignments.find((assignment) => {
    if (assignment.targetType === 'line-build-material') {
      return currentTargetKey === `line:${assignment.targetGroupId}:${assignment.wareId}`
    }
    return currentTargetKey === `output:${assignment.wareId}`
  })
  menuSourceTag.value = null
  menuTargetTag.value = { wareId, tagId, targetType, targetGroupId }
  menuTargets.value = sources.map((item) => ({
    ...item,
    isBound: currentBoundAssignment != null
      && currentBoundAssignment.sourceGroupId === item.targetGroupId
      && currentBoundAssignment.wareId === item.wareId,
    bindingState: currentBoundAssignment != null
      && currentBoundAssignment.sourceGroupId === item.targetGroupId
      && currentBoundAssignment.wareId === item.wareId
      ? 'self'
      : 'none'
  }))
  const btn = (event.target as HTMLElement).closest('.target-tag-add-btn') || (event.currentTarget as HTMLElement)
  const rect = btn.getBoundingClientRect()
  const menuWidth = 192
  const windowWidth = window.innerWidth
  let x = rect.right + 8
  if (x + menuWidth > windowWidth) {
    x = rect.left - menuWidth - 8
  }
  menuPosition.value = { x, y: rect.top }
}

function onMenuSelect(item: MenuTargetItem) {
  if (menuSourceTag.value) {
    presenter.bindFromMenu(menuSourceTag.value.groupId, menuSourceTag.value.wareId, item)
  } else if (menuTargetTag.value) {
    logicFlow.bindBuildFlowAssignment({
      wareId: menuTargetTag.value.wareId,
      sourceGroupId: item.targetGroupId!,
      targetType: menuTargetTag.value.targetType,
      targetGroupId: menuTargetTag.value.targetGroupId
    })
  }
  closeMenu()
}

function closeMenu() {
  menuSourceTag.value = null
  menuTargetTag.value = null
  menuTargets.value = []
}

function onUnbind(targetKey: string) {
  presenter.unbind(targetKey)
}

function computeTargetKey(tag: BuildFlowTag, targetType: BuildFlowTargetType): string {
  if (targetType === 'line-build-material') {
    const match = tag.tagId.match(/^build-flow-target:line:([^:]+):(.+)$/)
    if (match) return `line:${match[1]}:${match[2]}`
  }
  if (targetType === 'output-material') {
    return `output:${tag.wareId}`
  }
  return ''
}

function onDocumentClick(e: MouseEvent) {
  if (!menuSourceTag.value && !menuTargetTag.value) return
  const target = e.target as HTMLElement
  if (target.closest('.build-flow-menu, .build-flow-source-tag, .build-flow-target-tag')) return
  closeMenu()
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onUnmounted(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <div
    v-if="hasContent && !shouldHide"
    class="build-flow-zone border border-dashed border-gray-600 rounded-lg p-3"
  >
    <div class="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
      {{ t('buildFlow.build_flow_zone_title') }}
    </div>
    <div class="grid gap-5" :class="groupNodes.length === 1 ? '' : 'grid-cols-2'">
      <div
        v-for="gn in groupNodes"
        :key="gn.groupKey"
        class="border border-gray-700 rounded p-3"
        :style="{ height: `${gn.height}px` }"
      >
        <VueFlow
          :nodes="gn.nodes"
          :edges="groupEdges.get(gn.groupKey) ?? []"
          :default-viewport="{ x: 0, y: 0, zoom: 1 }"
          :min-zoom="1"
          :max-zoom="1"
          :nodes-draggable="false"
          :pan-on-drag="false"
          :zoom-on-scroll="false"
        >
          <template #node-card="nodeProps">
            <div class="bg-gray-800/60 border border-gray-600 rounded p-2 relative" style="width:320px">
              <div class="text-xs text-gray-300 font-medium mb-2 truncate">{{ nodeProps.data.card.title }}</div>
              <div class="flex flex-col gap-1">
                <div class="flex justify-between">
                  <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_build_materials') }}</span>
                  <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_source_materials') }}</span>
                </div>
                <div v-for="(row) in nodeProps.data.cardRows" :key="row.wareId" class="flex justify-between items-center" style="min-height: 24px; position: relative">
                  <Handle v-if="row.buildMaterialTag" type="target" :position="Position.Left" :id="`tgt:${row.wareId}`" :style="{ top: '12px' }" class="!bg-transparent !border-0 !w-2 !h-2" />
                  <span v-if="row.buildMaterialTag" class="build-flow-tag build-flow-target-tag whitespace-nowrap" :data-tag-id="row.buildMaterialTag.tagId" @dragover.prevent @drop.prevent="onTargetDrop('line-build-material', nodeProps.data.card.groupId)">
                    <button class="target-tag-segment target-tag-segment-add" :class="boundTargetTagIds.has(row.buildMaterialTag.tagId) ? 'bg-orange-700/40 border-orange-500/50 text-orange-300' : 'bg-gray-700/40 border-gray-500/50 text-gray-300'" @click.stop="onTargetTagPlusClick(row.buildMaterialTag.wareId, row.buildMaterialTag.tagId, 'line-build-material', nodeProps.data.card.groupId, nodeProps.data.groupKey, $event)">+</button>
                    <span class="target-tag-segment target-tag-segment-main" :class="[boundTargetTagIds.has(row.buildMaterialTag.tagId) ? 'bg-orange-700/40 border-orange-500/50 text-orange-300' : 'bg-gray-700/40 border-gray-500/50 text-gray-300']">
                      <span class="target-tag-text">{{ row.buildMaterialTag.label }}</span>
                      <button v-if="boundTargetTagIds.has(row.buildMaterialTag.tagId)" class="target-tag-unbind" @click.stop="onUnbind(computeTargetKey(row.buildMaterialTag, 'line-build-material'))">&times;</button>
                    </span>
                  </span>
                  <div v-else class="w-[142px] h-[24px] shrink-0"></div>
                  <Handle v-if="row.sourceTag" type="source" :position="Position.Right" :id="`src:${row.wareId}`" :style="{ top: '12px' }" class="!bg-transparent !border-0 !w-2 !h-2" />
                  <span v-if="row.sourceTag" class="build-flow-tag build-flow-source-tag whitespace-nowrap" :data-tag-id="row.sourceTag.tagId" draggable="true" @dragstart="onSourceDragStart(nodeProps.data.card.groupId, row.sourceTag.wareId)" @dragend="onSourceDragEnd">
                    <span class="source-tag-segment source-tag-segment-main"><span class="source-tag-text">{{ row.sourceTag.label }}</span></span>
                    <button class="source-tag-segment source-tag-segment-add" @click.stop="onPlusClick(nodeProps.data.card.groupId, row.sourceTag.wareId, row.sourceTag.tagId, $event)">+</button>
                  </span>
                  <div v-else class="w-[142px] h-[24px] shrink-0"></div>
                </div>
              </div>
            </div>
          </template>
          <template #node-output="nodeProps">
            <div class="bg-gray-800/60 border border-gray-600 rounded p-2 relative" style="width:160px">
              <div class="text-xs text-gray-300 font-medium mb-2">{{ t('buildFlow.build_flow_output_card_title') }}</div>
              <div class="flex justify-start mb-1"><span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_output_materials') }}</span></div>
              <div class="build-flow-target-list flex flex-col gap-1 items-start">
                <span v-for="tag in nodeProps.data.outputTags" :key="tag.tagId" class="build-flow-tag build-flow-target-tag whitespace-nowrap relative" :data-tag-id="tag.tagId" @dragover.prevent @drop.prevent="onTargetDrop('output-material')">
                  <Handle type="target" :position="Position.Left" :id="`out:${tag.wareId}`" :style="{ top: '12px' }" class="!bg-transparent !border-0 !w-2 !h-2" />
                  <button class="target-tag-segment target-tag-segment-add" :class="boundTargetTagIds.has(tag.tagId) ? 'bg-orange-700/40 border-orange-500/50 text-orange-300' : 'bg-gray-700/40 border-gray-500/50 text-gray-300'" @click.stop="onTargetTagPlusClick(tag.wareId, tag.tagId, 'output-material', undefined, nodeProps.data.groupKey, $event)">+</button>
                  <span class="target-tag-segment target-tag-segment-main" :class="[boundTargetTagIds.has(tag.tagId) ? 'bg-orange-700/40 border-orange-500/50 text-orange-300' : 'bg-gray-700/40 border-gray-500/50 text-gray-300']">
                    <span class="target-tag-text">{{ tag.label }}</span>
                    <button v-if="boundTargetTagIds.has(tag.tagId)" class="target-tag-unbind" @click.stop="onUnbind(computeTargetKey(tag, 'output-material'))">&times;</button>
                  </span>
                </span>
              </div>
            </div>
          </template>
        </VueFlow>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="menuSourceTag || menuTargetTag" class="build-flow-menu fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[192px]" :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }">
        <div class="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-700">{{ menuSourceTag ? t('buildFlow.build_flow_source_materials') : t('buildFlow.build_flow_build_materials') }}</div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button v-for="target in menuTargets" :key="target.targetKey" class="w-full text-left px-3 py-1.5 text-xs transition-colors" :class="[target.bindingState === 'self' ? 'text-emerald-300 bg-emerald-900/20' : target.bindingState === 'other' ? 'text-amber-300 bg-amber-900/20' : 'text-gray-300 hover:bg-gray-700']" @click="onMenuSelect(target)"><span class="flex-1 truncate">{{ target.targetType === 'line-build-material' ? target.cardTitle : t('buildFlow.build_flow_output_card_title') }}</span></button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.build-flow-target-list {
  width: 142px;
}

.build-flow-source-tag,
.build-flow-target-tag {
  width: 142px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  overflow: visible;
  z-index: 1;
  position: relative;
}

.build-flow-source-tag {
  justify-content: flex-end;
  margin-right: -16px;
}

.build-flow-target-tag {
  justify-content: flex-start;
  margin-left: -16px;
}

.source-tag-segment,
.target-tag-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  border-width: 1px;
  font-size: 11px;
  position: relative;
  z-index: 2;
}

.source-tag-segment-main {
  width: 118px;
  justify-content: flex-start;
  padding-left: 0.375rem;
  padding-right: 0.5rem;
  @apply rounded-l-md border-r-0 bg-green-700/40 border-green-600/50 text-green-300;
}

.target-tag-segment-main {
  width: 118px;
  justify-content: flex-end;
  padding-left: 0.5rem;
  padding-right: 0.375rem;
  @apply rounded-r-md border-l-0;
}

.source-tag-text {
  @apply truncate text-left;
  flex: 1 1 auto;
}

.target-tag-text {
  @apply truncate text-right;
  flex: 1 1 auto;
}

.source-tag-segment-add,
.target-tag-segment-add {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  @apply flex items-center justify-center text-[10px] font-bold cursor-pointer;
}

.source-tag-segment-add {
  margin-left: -1px;
  @apply rounded-r-md border-l-0 bg-green-700/40 border-green-600/50 text-green-300;
  z-index: 3;
}

.target-tag-segment-add {
  margin-right: -1px;
  @apply rounded-l-md border-r-0;
  z-index: 3;
}

.target-tag-unbind {
  @apply ml-1 text-[9px] text-orange-400 hover:text-orange-200;
}
</style>

<style>
.vue-flow__node { background: transparent !important; }
</style>
