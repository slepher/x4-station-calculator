<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import type { BuildFlowTag } from '@/types/x4'
import type { Node, Graph } from '@antv/x6'

const props = defineProps<{
  node: Node
  graph: Graph
}>()

const { t } = useI18n()
const logicFlow = useLogicFlowStore()

const nodeData = computed(() => {
  const data = props.node.getData() as {
    outputTags: BuildFlowTag[]
    groupKey: string
  }
  return data
})

const outputTags = computed(() => nodeData.value.outputTags)
const groupKey = computed(() => nodeData.value.groupKey)

const boundTargetTagIds = computed(() => {
  const ids = new Set<string>()
  for (const a of logicFlow.buildFlowAssignments) {
    if (a.targetType === 'output-material') {
      ids.add(`build-flow-target:output:${a.wareId}`)
    }
  }
  return ids
})

const draggingTag = ref<{ groupId: string; wareId: string } | null>(null)

function onTargetDrop(wareId: string) {
  if (!draggingTag.value) return
  const { groupId, wareId: sourceWareId } = draggingTag.value
  if (sourceWareId !== wareId) return
  logicFlow.bindBuildFlowAssignment({
    wareId,
    sourceGroupId: groupId,
    targetType: 'output-material',
  })
  draggingTag.value = null
  logicFlow.stopBuildFlowDrag()
}

function onUnbind(wareId: string) {
  logicFlow.unbindBuildFlowAssignment(`output:${wareId}`)
}

const menuTargetTag = ref<{ wareId: string; tagId: string } | null>(null)
const menuSources = ref<any[]>([])
const menuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

interface MenuSourceItem {
  targetGroupId: string
  wareId: string
  wareLabel: string
  cardTitle: string
  tagId: string
}

function getSourcesForTarget(wareId: string, targetGroupKey: string): MenuSourceItem[] {
  const sources: MenuSourceItem[] = []
  const targetGroup = logicFlow.buildFlowGroups.find(bg => bg.groupKey === targetGroupKey)
  if (!targetGroup) return sources

  for (const c of targetGroup.lineCards) {
    for (const tag of c.sourceTags) {
      if (tag.wareId !== wareId) continue
      sources.push({
        targetGroupId: c.groupId,
        wareId,
        wareLabel: tag.label,
        cardTitle: c.title,
        tagId: tag.tagId,
      })
    }
  }
  return sources
}

function onPlusClick(wareId: string, tagId: string, event: MouseEvent) {
  const sources = getSourcesForSource(wareId, groupKey.value)
  if (sources.length === 0) return
  const currentTargetKey = `output:${wareId}`
  const currentBoundAssignment = logicFlow.buildFlowAssignments.find(a => {
    return a.targetType === 'output-material' && `output:${a.wareId}` === currentTargetKey
  })
  menuTargetTag.value = { wareId, tagId }
  menuSources.value = sources.map(item => ({
    ...item,
    isBound: currentBoundAssignment != null
      && currentBoundAssignment.sourceGroupId === item.targetGroupId,
    bindingState: currentBoundAssignment != null
      && currentBoundAssignment.sourceGroupId === item.targetGroupId
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

function getSourcesForSource(wareId: string, gKey: string): MenuSourceItem[] {
  return getSourcesForTarget(wareId, gKey)
}

function onMenuSelect(item: MenuSourceItem) {
  if (menuTargetTag.value) {
    logicFlow.bindBuildFlowAssignment({
      wareId: menuTargetTag.value.wareId,
      sourceGroupId: item.targetGroupId,
      targetType: 'output-material',
    })
  }
  closeMenu()
}

function closeMenu() {
  menuTargetTag.value = null
  menuSources.value = []
}

function onDocumentClick(e: MouseEvent) {
  if (!menuTargetTag.value) return
  const target = e.target as HTMLElement
  if (target.closest('.build-flow-menu, .build-flow-target-tag')) return
  closeMenu()
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onUnmounted(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <div class="bg-gray-800/60 border border-gray-600 rounded p-2 min-w-[120px]">
    <div class="text-xs text-gray-300 font-medium mb-2">
      {{ t('buildFlow.build_flow_output_card_title') }}
    </div>
    <div class="build-flow-target-list flex flex-col gap-1 items-start">
      <span
        v-for="tag in outputTags"
        :key="tag.tagId"
        :data-tag-id="tag.tagId"
        class="build-flow-tag build-flow-target-tag whitespace-nowrap"
        @mousedown.stop
        @dragover.prevent
        @drop.prevent="onTargetDrop(tag.wareId)"
      >
        <button
          class="target-tag-segment target-tag-segment-add"
          :class="boundTargetTagIds.has(tag.tagId)
            ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
            : 'bg-gray-700/40 border-gray-500/50 text-gray-300'"
          @click.stop="onPlusClick(tag.wareId, tag.tagId, $event)"
        >+</button>
        <span
          class="target-tag-segment target-tag-segment-main"
          :class="[
            boundTargetTagIds.has(tag.tagId)
              ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
              : 'bg-gray-700/40 border-gray-500/50 text-gray-300'
          ]"
        >
          <span class="target-tag-text">{{ tag.label }}</span>
          <button
            v-if="boundTargetTagIds.has(tag.tagId)"
            class="target-tag-unbind"
            @click.stop="onUnbind(tag.wareId)"
            :title="t('buildFlow.build_flow_unbind')"
          >&times;</button>
        </span>
      </span>
    </div>

    <Teleport to="body">
      <div
        v-if="menuTargetTag"
        class="build-flow-menu fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[192px]"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      >
        <div class="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-700">
          {{ t('buildFlow.build_flow_build_materials') }}
        </div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button
            v-for="source in menuSources"
            :key="source.tagId"
            class="w-full text-left px-3 py-1.5 text-xs transition-colors"
            :class="[
              source.bindingState === 'self'
                ? 'text-emerald-300 bg-emerald-900/20'
                : 'text-gray-300 hover:bg-gray-700'
            ]"
            @click="onMenuSelect(source)"
          >
            <span class="flex-1 truncate">{{ source.cardTitle }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.build-flow-target-list {
  width: 142px;
}

.build-flow-target-tag {
  width: 142px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  overflow: visible;
  z-index: 1;
  position: relative;
  justify-content: flex-start;
  margin-left: -16px;
}

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

.target-tag-segment-main {
  width: 118px;
  justify-content: flex-end;
  padding-left: 0.5rem;
  padding-right: 0.375rem;
  @apply rounded-r-md border-l-0;
}

.target-tag-text {
  @apply truncate text-right;
  flex: 1 1 auto;
}

.target-tag-segment-add {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  @apply flex items-center justify-center text-[10px] font-bold cursor-pointer;
  margin-right: -1px;
  @apply rounded-l-md border-r-0;
  z-index: 3;
}

.target-tag-unbind {
  @apply ml-1 text-[9px] text-orange-400 hover:text-orange-200;
}
</style>
