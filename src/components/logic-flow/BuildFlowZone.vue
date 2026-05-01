<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useBuildFlowPresenter, type MenuTargetItem } from './presenters/useBuildFlowPresenter'
import BuildFlowEdgeLayer from './BuildFlowEdgeLayer.vue'
import type { BuildFlowTag, BuildFlowTargetType } from '@/types/x4'

const { t } = useI18n()
const logicFlow = useLogicFlowStore()

const presenter = useBuildFlowPresenter({
  lineCards: computed(() => logicFlow.buildFlowLineCards),
  outputCard: computed(() => logicFlow.buildFlowOutputCard),
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
const hoverTargetTagId = ref<string | null>(null)

function onSourceDragStart(groupId: string, wareId: string) {
  draggingTag.value = { groupId, wareId }
  presenter.startDrag()
}

function onSourceDragEnd() {
  draggingTag.value = null
  hoverTargetTagId.value = null
  presenter.stopDrag()
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
  presenter.bindFromDrag(groupId, wareId, targetType, targetGroupId)
  draggingTag.value = null
  hoverTargetTagId.value = null
  presenter.stopDrag()
}

// --- Menu state ---
const menuSourceTag = ref<{ groupId: string; wareId: string; tagId: string } | null>(null)
const menuTargetTag = ref<{ wareId: string; tagId: string; targetType: BuildFlowTargetType; targetGroupId?: string } | null>(null)
const menuTargets = ref<MenuTargetItem[]>([])
const menuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

function onPlusClick(groupId: string, wareId: string, tagId: string, event: MouseEvent) {
  const targets = presenter.getTargetsForSource(wareId)
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

function onTargetTagPlusClick(wareId: string, tagId: string, targetType: BuildFlowTargetType, targetGroupId: string | undefined, event: MouseEvent) {
  const sources = presenter.getSourcesForTarget(wareId)
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
    class="build-flow-zone border border-dashed border-gray-600 rounded-lg p-3 space-y-3"
  >
    <div class="text-xs text-gray-400 font-medium uppercase tracking-wide">
      {{ t('buildFlow.build_flow_zone_title') }}
    </div>

    <div class="flex flex-wrap gap-3 relative">
      <div
        v-for="card in presenter.lineCards.value"
        :key="card.groupId"
        class="build-flow-line-card bg-gray-800/60 border border-gray-600 rounded p-2 min-w-[280px]"
      >
        <div class="text-xs text-gray-300 font-medium mb-2 truncate" :title="card.title">
          {{ card.title }}
        </div>
        <div class="flex gap-3 justify-between">
          <div class="flex flex-col gap-1 shrink-0">
            <div class="text-[10px] text-gray-500 mb-0.5">{{ t('buildFlow.build_flow_build_materials') }}</div>
            <div class="build-flow-target-list flex flex-col gap-1 items-start">
              <span
                v-for="tag in card.buildMaterialTags"
                :key="tag.tagId"
                :data-tag-id="tag.tagId"
                class="build-flow-tag build-flow-target-tag group relative inline-flex items-center whitespace-nowrap"
                @dragenter.prevent="onTargetDragEnter(tag.tagId)"
                @dragleave="onTargetDragLeave"
                @dragover.prevent
                @drop.prevent="onTargetDrop('line-build-material', card.groupId)"
              >
              <span
                class="target-tag-bg absolute inset-y-0 left-0 rounded overflow-hidden transition-all duration-200"
                :class="[
                  boundTargetTagIds.has(tag.tagId)
                    ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
                    : 'bg-gray-700/40 border-gray-500/50'
                ]"
              >
                <button
                  class="target-tag-add-btn"
                  @click.stop="onTargetTagPlusClick(tag.wareId, tag.tagId, 'line-build-material', card.groupId, $event)"
                >+</button>
              </span>
              <span class="relative z-10 inline-flex items-center gap-1 px-1.5 py-[3px] text-[11px] rounded border border-transparent select-none"
                :class="boundTargetTagIds.has(tag.tagId) ? 'text-orange-300' : 'text-gray-300'"
              >
                {{ tag.label }}
                <button
                  v-if="boundTargetTagIds.has(tag.tagId)"
                  class="text-[9px] text-orange-400 hover:text-orange-200 ml-auto"
                  @click.stop="onUnbind(computeTargetKey(tag, 'line-build-material'))"
                  :title="t('buildFlow.build_flow_unbind')"
                >&times;</button>
              </span>
            </span>
            </div>
          </div>

          <div class="flex flex-col gap-1 shrink-0">
              <div class="flex justify-end">
              <div class="build-flow-source-list flex flex-col gap-1 items-start">
                <div class="text-[10px] text-gray-500 mb-0.5">{{ t('buildFlow.build_flow_source_materials') }}</div>
                <span
                  v-for="tag in card.sourceTags"
                  :key="tag.tagId"
                  :data-tag-id="tag.tagId"
                  class="build-flow-tag build-flow-source-tag relative inline-flex items-center whitespace-nowrap"
                  draggable="true"
                  @dragstart="onSourceDragStart(card.groupId, tag.wareId)"
                  @dragend="onSourceDragEnd"
                >
                  <span class="source-tag-bg absolute inset-y-0 left-0 rounded overflow-hidden">
                    <button
                      class="source-tag-add-btn"
                      @click.stop="onPlusClick(card.groupId, tag.wareId, tag.tagId, $event)"
                    >+</button>
                  </span>
                  <span class="relative z-10 inline-flex items-center gap-1 px-1.5 py-[3px] text-[11px] text-green-300 cursor-grab select-none">
                    {{ tag.label }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="presenter.outputCard.value.outputTags.length > 0"
        class="build-flow-output-card bg-gray-800/60 border border-gray-600 rounded p-2 min-w-[120px]"
      >
        <div class="text-xs text-gray-300 font-medium mb-2">
          {{ t('buildFlow.build_flow_output_card_title') }}
        </div>
        <div class="build-flow-target-list flex flex-col gap-1 items-start">
          <span
            v-for="tag in presenter.outputCard.value.outputTags"
            :key="tag.tagId"
            :data-tag-id="tag.tagId"
            class="build-flow-tag build-flow-target-tag group relative inline-flex items-center whitespace-nowrap"
            @dragenter.prevent="onTargetDragEnter(tag.tagId)"
            @dragleave="onTargetDragLeave"
            @dragover.prevent
            @drop.prevent="onTargetDrop('output-material')"
          >
            <span
              class="target-tag-bg absolute inset-y-0 left-0 rounded overflow-hidden transition-all duration-200"
              :class="[
                boundTargetTagIds.has(tag.tagId)
                  ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
                  : 'bg-gray-700/40 border-gray-500/50'
              ]"
            >
              <button
                class="target-tag-add-btn"
                @click.stop="onTargetTagPlusClick(tag.wareId, tag.tagId, 'output-material', undefined, $event)"
              >+</button>
            </span>
            <span class="relative z-10 inline-flex items-center gap-1 px-1.5 py-[3px] text-[11px] rounded border border-transparent select-none"
              :class="boundTargetTagIds.has(tag.tagId) ? 'text-orange-300' : 'text-gray-300'"
            >
              {{ tag.label }}
              <button
                v-if="boundTargetTagIds.has(tag.tagId)"
                class="text-[9px] text-orange-400 hover:text-orange-200 ml-auto"
                @click.stop="onUnbind(computeTargetKey(tag, 'output-material'))"
                :title="t('buildFlow.build_flow_unbind')"
              >&times;</button>
            </span>
          </span>
        </div>
      </div>

      <BuildFlowEdgeLayer
        v-if="presenter.edges.value.length > 0"
        :edges="presenter.edges.value"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="menuSourceTag || menuTargetTag"
        class="build-flow-menu fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[192px]"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      >
        <div class="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-700">
          {{ menuSourceTag ? t('buildFlow.build_flow_source_materials') : t('buildFlow.build_flow_build_materials') }}
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
.build-flow-source-list {
  width: 154px;
}

.build-flow-target-list {
  width: 154px;
}

.build-flow-source-tag {
  width: 154px;
  overflow: visible;
}

.source-tag-bg {
  width: 130px;
  @apply bg-green-700/40 border border-green-600/50 rounded;
  @apply transition-all duration-200;
  overflow: visible;
}

.build-flow-source-tag:hover .source-tag-bg {
  width: 154px;
}

.source-tag-add-btn {
  width: 24px;
  @apply absolute right-0 top-0 bottom-0 flex items-center justify-center;
  @apply text-white text-[10px] font-bold cursor-pointer rounded-r;
  @apply opacity-0 translate-x-full transition-all duration-200;
}

.build-flow-source-tag:hover .source-tag-add-btn {
  @apply opacity-100 translate-x-0;
}

.build-flow-target-tag {
  width: 154px;
  overflow: visible;
}

.target-tag-bg {
  width: 130px;
  @apply border rounded;
  @apply transition-all duration-200;
  overflow: visible;
}

.group:hover .target-tag-bg {
  width: 154px;
}

.target-tag-add-btn {
  width: 24px;
  @apply absolute right-0 top-0 bottom-0 flex items-center justify-center;
  @apply text-white text-[10px] font-bold cursor-pointer rounded-r;
  @apply opacity-0 translate-x-full transition-all duration-200;
}

.group:hover .target-tag-add-btn {
  @apply opacity-100 translate-x-0;
}
</style>
