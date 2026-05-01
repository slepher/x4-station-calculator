<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useBuildFlowPresenter, type MenuTargetItem } from './presenters/useBuildFlowPresenter'
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
const menuTargets = ref<MenuTargetItem[]>([])
const menuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

function onPlusClick(groupId: string, wareId: string, tagId: string, event: MouseEvent) {
  const targets = presenter.getTargetsForSource(wareId)
  if (targets.length === 0) return
  menuSourceTag.value = { groupId, wareId, tagId }
  menuTargets.value = targets
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const menuWidth = 192
  const windowWidth = window.innerWidth
  let x = rect.right + 8
  if (x + menuWidth > windowWidth) {
    x = rect.left - menuWidth - 8
  }
  menuPosition.value = { x, y: rect.top }
}

function onMenuSelect(target: MenuTargetItem) {
  if (!menuSourceTag.value) return
  presenter.bindFromMenu(menuSourceTag.value.groupId, menuSourceTag.value.wareId, target)
  closeMenu()
}

function closeMenu() {
  menuSourceTag.value = null
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
  if (!menuSourceTag.value) return
  const target = e.target as HTMLElement
  if (target.closest('.build-flow-menu, .build-flow-source-tag')) return
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
            <span
              v-for="tag in card.buildMaterialTags"
              :key="tag.tagId"
              :data-tag-id="tag.tagId"
              class="build-flow-tag build-flow-target-tag inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border select-none transition-colors whitespace-nowrap"
              :class="[
                hoverTargetTagId === tag.tagId
                  ? 'bg-blue-700/60 border-blue-500'
                  : presenter.isTagBoundAsTarget(tag.tagId).value
                    ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
                    : 'bg-gray-700/40 border-gray-500/50 text-gray-300'
              ]"
              @dragenter.prevent="onTargetDragEnter(tag.tagId)"
              @dragleave="onTargetDragLeave"
              @dragover.prevent
              @drop.prevent="onTargetDrop('line-build-material', card.groupId)"
            >
              {{ tag.label }}
              <button
                v-if="presenter.isTagBoundAsTarget(tag.tagId).value"
                class="text-[9px] text-orange-400 hover:text-orange-200 ml-0.5"
                @click.stop="onUnbind(computeTargetKey(tag, 'line-build-material'))"
                :title="t('buildFlow.build_flow_unbind')"
              >&times;</button>
            </span>
          </div>

          <div class="flex flex-col gap-1 shrink-0">
            <div class="text-[10px] text-gray-500 mb-0.5 text-right">{{ t('buildFlow.build_flow_source_materials') }}</div>
            <div class="flex justify-end">
              <div class="flex flex-col gap-1 items-start w-40 box-border mr-[-26px] pr-[26px]">
                <span
                  v-for="tag in card.sourceTags"
                  :key="tag.tagId"
                  :data-tag-id="tag.tagId"
                  class="build-flow-tag build-flow-source-tag relative overflow-hidden inline-flex items-center gap-1 py-0.5 text-[11px] rounded bg-green-700/40 text-green-300 border border-green-600/50 cursor-grab select-none hover:bg-green-700/60 transition-colors whitespace-nowrap"
                  draggable="true"
                  @dragstart="onSourceDragStart(card.groupId, tag.wareId)"
                  @dragend="onSourceDragEnd"
                >
                  {{ tag.label }}
                  <button
                    class="source-tag-add-btn"
                    @click.stop="onPlusClick(card.groupId, tag.wareId, tag.tagId, $event)"
                  >+</button>
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
        <div class="flex flex-col gap-1">
          <span
            v-for="tag in presenter.outputCard.value.outputTags"
            :key="tag.tagId"
            :data-tag-id="tag.tagId"
            class="build-flow-tag build-flow-target-tag inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border select-none transition-colors whitespace-nowrap"
            :class="[
              hoverTargetTagId === tag.tagId
                ? 'bg-blue-700/60 border-blue-500'
                : presenter.isTagBoundAsTarget(tag.tagId).value
                  ? 'bg-orange-700/40 border-orange-500/50 text-orange-300'
                  : 'bg-gray-700/40 border-gray-500/50 text-gray-300'
            ]"
            @dragenter.prevent="onTargetDragEnter(tag.tagId)"
            @dragleave="onTargetDragLeave"
            @dragover.prevent
            @drop.prevent="onTargetDrop('output-material')"
          >
            {{ tag.label }}
            <button
              v-if="presenter.isTagBoundAsTarget(tag.tagId).value"
              class="text-[9px] text-orange-400 hover:text-orange-200 ml-0.5"
              @click.stop="onUnbind(computeTargetKey(tag, 'output-material'))"
              :title="t('buildFlow.build_flow_unbind')"
            >&times;</button>
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
        v-if="menuSourceTag"
        class="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[192px]"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      >
        <div class="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-700">
          {{ t('buildFlow.build_flow_source_materials') }}
        </div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button
            v-for="target in menuTargets"
            :key="target.targetKey"
            class="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
            @click="onMenuSelect(target)"
          >
            <span class="flex-1 truncate">{{ target.targetType === 'line-build-material' ? target.cardTitle : t('buildFlow.build_flow_output_card_title') }}</span>
            <span class="text-[10px] text-gray-500 ml-1">{{ target.wareLabel }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.build-flow-source-tag {
  @apply px-1.5 transition-all duration-200;
}

.build-flow-source-tag:hover {
  @apply pr-[26px];
}

.source-tag-add-btn {
  @apply absolute right-0 top-0 bottom-0 w-5 flex items-center justify-center;
  @apply text-green-400 text-[10px] font-bold;
  @apply translate-x-full transition-transform duration-200;
}

.build-flow-source-tag:hover .source-tag-add-btn {
  @apply translate-x-0;
}
</style>
