<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import type { BuildFlowLineCard, BuildFlowTag, BuildFlowTargetType } from '@/types/x4'
import type { Node, Graph } from '@antv/x6'

const props = defineProps<{
  node: Node
  graph: Graph
}>()

const { t } = useI18n()
const logicFlow = useLogicFlowStore()

const cardData = computed(() => {
  const data = props.node.getData() as {
    card: BuildFlowLineCard
    groupKey: string
  }
  return data
})

const card = computed(() => cardData.value.card)

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

interface Row {
  wareId: string
  buildMaterialTag: BuildFlowTag | null
  sourceTag: BuildFlowTag | null
}

const cardRows = computed<Row[]>(() => {
  const c = card.value
  if (!c) return []
  const seenWareIds = new Set<string>()
  const rows: Row[] = []
  for (const tag of c.buildMaterialTags) {
    seenWareIds.add(tag.wareId)
    const sourceTag = c.sourceTags.find(t2 => t2.wareId === tag.wareId) || null
    rows.push({ wareId: tag.wareId, buildMaterialTag: tag, sourceTag })
  }
  for (const tag of c.sourceTags) {
    if (seenWareIds.has(tag.wareId)) continue
    seenWareIds.add(tag.wareId)
    rows.push({ wareId: tag.wareId, buildMaterialTag: null, sourceTag: tag })
  }
  return rows
})

const draggingTag = ref<{ groupId: string; wareId: string } | null>(null)
const hoverTargetTagId = ref<string | null>(null)

function onSourceDragStart(groupId: string, wareId: string) {
  draggingTag.value = { groupId, wareId }
  logicFlow.startBuildFlowDrag()
}

function onSourceDragEnd() {
  draggingTag.value = null
  hoverTargetTagId.value = null
  logicFlow.stopBuildFlowDrag()
}

function onTargetDragEnter(tagId: string) {
  hoverTargetTagId.value = tagId
}

function onTargetDragLeave() {
  hoverTargetTagId.value = null
}

function onTargetDrop(targetType: BuildFlowTargetType, targetGroupId?: string) {
  if (!draggingTag.value) return
  const { groupId, wareId } = draggingTag.value
  logicFlow.bindBuildFlowAssignment({
    wareId,
    sourceGroupId: groupId,
    targetType,
    targetGroupId,
  })
  draggingTag.value = null
  hoverTargetTagId.value = null
  logicFlow.stopBuildFlowDrag()
}

function computeTargetKeyForTag(tag: BuildFlowTag, targetType: BuildFlowTargetType): string {
  if (targetType === 'line-build-material') {
    const match = tag.tagId.match(/^build-flow-target:line:([^:]+):(.+)$/)
    if (match) return `line:${match[1]}:${match[2]}`
  }
  if (targetType === 'output-material') {
    return `output:${tag.wareId}`
  }
  return ''
}

function onUnbind(targetKey: string) {
  logicFlow.unbindBuildFlowAssignment(targetKey)
}

const menuSourceTag = ref<{ groupId: string; wareId: string; tagId: string } | null>(null)
const menuTargets = ref<any[]>([])
const menuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

interface MenuTargetItem {
  targetType: BuildFlowTargetType
  targetGroupId?: string
  wareId: string
  wareLabel: string
  cardTitle: string
  tagId: string
  targetKey: string
}

function getTargetsForSource(wareId: string, sourceGroupId: string): MenuTargetItem[] {
  const targets: MenuTargetItem[] = []
  const sourceGroup = logicFlow.buildFlowGroups.find(bg =>
    bg.lineCards.some(c => c.groupId === sourceGroupId)
  )
  if (!sourceGroup) return targets

  for (const c of sourceGroup.lineCards) {
    for (const tag of c.buildMaterialTags) {
      if (tag.wareId !== wareId) continue
      const targetKey = `line:${c.groupId}:${wareId}`
      targets.push({
        targetType: 'line-build-material',
        targetGroupId: c.groupId,
        wareId,
        wareLabel: tag.label,
        cardTitle: c.title,
        tagId: tag.tagId,
        targetKey,
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
    })
  }
  return targets
}

function onPlusClick(groupId: string, wareId: string, tagId: string, event: MouseEvent) {
  const targets = getTargetsForSource(wareId, groupId)
  if (targets.length === 0) return
  const assignments = logicFlow.buildFlowAssignments
  menuTargets.value = targets.map(item => {
    const assignment = assignments.find(a => {
      if (a.targetType === 'line-build-material') {
        return item.targetKey === `line:${a.targetGroupId}:${a.wareId}`
      }
      return item.targetKey === `output:${a.wareId}`
    })
    let bindingState: 'self' | 'other' | 'none' = 'none'
    if (assignment) {
      bindingState = assignment.sourceGroupId === groupId ? 'self' : 'other'
    }
    return { ...item, isBound: assignment != null, bindingState }
  })
  menuSourceTag.value = { groupId, wareId, tagId }
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

function onMenuSelect(item: MenuTargetItem & { bindingState?: string }) {
  if (menuSourceTag.value) {
    logicFlow.bindBuildFlowAssignment({
      wareId: menuSourceTag.value.wareId,
      sourceGroupId: menuSourceTag.value.groupId,
      targetType: item.targetType,
      targetGroupId: item.targetGroupId,
    })
  }
  closeMenu()
}

function closeMenu() {
  menuSourceTag.value = null
  menuTargets.value = []
}

function onDocumentClick(e: MouseEvent) {
  if (!menuSourceTag.value) return
  const target = e.target as HTMLElement
  if (target.closest('.build-flow-menu, .build-flow-source-tag')) return
  closeMenu()
}

onMounted(() => {
  console.log('[BuildFlowLineCardNode] mounted, nodeId:', props.node.id, 'shape:', props.node.shape)
  const data = props.node.getData()
  console.log('[BuildFlowLineCardNode] node data:', data ? 'present' : 'null', 'card:', data?.card?.title, 'sourceTags:', data?.card?.sourceTags?.length, 'buildMaterialTags:', data?.card?.buildMaterialTags?.length)
  document.addEventListener('click', onDocumentClick, true)
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <div v-if="card" class="bg-gray-800/60 border border-gray-600 rounded p-2 min-w-[280px]">
    <div class="text-xs text-gray-300 font-medium mb-2 truncate" :title="card.title">
      {{ card.title }}
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex justify-between">
        <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_build_materials') }}</span>
        <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_source_materials') }}</span>
      </div>
      <div
        v-for="row in cardRows"
        :key="row.wareId"
        class="flex justify-between items-center"
        style="min-height: 24px"
      >
        <span
          v-if="row.buildMaterialTag"
          :data-tag-id="row.buildMaterialTag.tagId"
          class="build-flow-tag build-flow-target-tag whitespace-nowrap"
          @mousedown.stop
          @dragenter.prevent="onTargetDragEnter(row.buildMaterialTag.tagId)"
          @dragleave="onTargetDragLeave"
          @dragover.prevent
          @drop.prevent="onTargetDrop('line-build-material', card.groupId)"
        >
          <button
            class="target-tag-segment target-tag-segment-add"
            :class="boundTargetTagIds.has(row.buildMaterialTag.tagId)
              ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
              : 'bg-gray-700/40 border-gray-500/50 text-gray-300'"
          >+</button>
          <span
            class="target-tag-segment target-tag-segment-main"
            :class="[
              boundTargetTagIds.has(row.buildMaterialTag.tagId)
                ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
                : 'bg-gray-700/40 border-gray-500/50 text-gray-300'
            ]"
          >
            <span class="target-tag-text">{{ row.buildMaterialTag.label }}</span>
            <button
              v-if="boundTargetTagIds.has(row.buildMaterialTag.tagId)"
              class="target-tag-unbind"
              @click.stop="onUnbind(computeTargetKeyForTag(row.buildMaterialTag, 'line-build-material'))"
              :title="t('buildFlow.build_flow_unbind')"
            >&times;</button>
          </span>
        </span>
        <div v-else class="w-[142px] h-[24px] shrink-0"></div>

        <span
          v-if="row.sourceTag"
          :data-tag-id="row.sourceTag.tagId"
          class="build-flow-tag build-flow-source-tag whitespace-nowrap"
          draggable="true"
          @mousedown.stop
          @dragstart="onSourceDragStart(card.groupId, row.sourceTag.wareId)"
          @dragend="onSourceDragEnd"
        >
          <span class="source-tag-segment source-tag-segment-main">
            <span class="source-tag-text">{{ row.sourceTag.label }}</span>
          </span>
          <button
            class="source-tag-segment source-tag-segment-add"
            @click.stop="onPlusClick(card.groupId, row.sourceTag.wareId, row.sourceTag.tagId, $event)"
          >+</button>
        </span>
        <div v-else class="w-[142px] h-[24px] shrink-0"></div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="menuSourceTag"
        class="build-flow-menu fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[192px]"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      >
        <div class="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-700">
          {{ t('buildFlow.build_flow_source_materials') }}
        </div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button
            v-for="target in menuTargets"
            :key="target.targetKey"
            class="w-full text-left px-3 py-1.5 text-xs transition-colors"
            :class="[
              target.bindingState === 'self'
                ? 'text-emerald-300 bg-emerald-900/20'
                : target.bindingState === 'other'
                  ? 'text-amber-300 bg-amber-900/20'
                  : 'text-gray-300 hover:bg-gray-700'
            ]"
            @click="onMenuSelect(target)"
          >
            <span class="flex-1 truncate">{{ target.targetType === 'line-build-material' ? target.cardTitle : t('buildFlow.build_flow_output_card_title') }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
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
