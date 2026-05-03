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
  buildFlowGroups: computed(() => logicFlow.buildFlowGroups),
  archivedLineCards: computed(() => logicFlow.buildFlowArchivedLineCards),
  assignments: computed(() => logicFlow.buildFlowAssignments),
  isDragging: computed(() => logicFlow.isBuildFlowDragging),
  archivedGroupIds: computed(() => logicFlow.archivedBuildFlowGroupIds),
  bindAssignment: logicFlow.bindBuildFlowAssignment,
  unbindAssignment: logicFlow.unbindBuildFlowAssignment,
  startBuildFlowDrag: logicFlow.startBuildFlowDrag,
  stopBuildFlowDrag: logicFlow.stopBuildFlowDrag,
  archiveGroup: logicFlow.archiveBuildFlowGroup,
  unarchiveGroup: logicFlow.unarchiveBuildFlowGroup
})

const shouldHide = computed(() => {
  return logicFlow.isDragging && !logicFlow.isBuildFlowDragging
})

const hasContent = computed(() => presenter.lineCards.value.length > 0)
const hasArchived = computed(() => presenter.archivedGroupIds.value.length > 0)

const showArchiveModal = ref(false)

const cardIndexByGroupId = computed(() => {
  const map = new Map<string, number>()
  presenter.lineCards.value.forEach((card, idx) => map.set(card.groupId, idx))
  return map
})

const sortedGroupTags = computed(() => {
  return presenter.buildFlowGroups.value.map(group => {
    const sortedBuild = [...group.outputBuildTags].sort((a, b) => a.wareId.localeCompare(b.wareId))
    const sortedMaterial = [...group.outputMaterialTags].sort((a, b) => a.wareId.localeCompare(b.wareId))
    const order = new Map(sortedMaterial.map((t, i) => [t.wareId, i]))
    return { groupKey: group.groupKey, outputBuildTags: sortedBuild, outputMaterialTags: sortedMaterial, order, lineCards: group.lineCards }
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

const boundTargetTagIds = computed(() => {
  const ids = new Set<string>()
  for (const a of logicFlow.buildFlowAssignments) {
    let tagId: string
    if (a.targetType === 'line-build-material') {
      tagId = `build-flow-target:line:${a.targetGroupId}:${a.wareId}`
    } else if (a.targetType === 'output-build-material') {
      tagId = `build-flow-target:output-build:${a.wareId}`
    } else {
      tagId = `build-flow-target:output:${a.wareId}`
    }
    ids.add(tagId)
  }
  return ids
})

const COLORS = ['#f97316','#eab308','#22d3ee','#a78bfa','#fb923c','#facc15','#67e8f9','#c4b5fd']

const sortedWareIds = computed(() => {
  const ids = new Set<string>()
  for (const card of presenter.lineCards.value) {
    for (const tag of card.sourceTags) ids.add(tag.wareId)
  }
  return [...ids].sort()
})

function getWareColor(wareId: string) {
  const i = sortedWareIds.value.indexOf(wareId)
  return COLORS[i >= 0 ? i % COLORS.length : 0]
}

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

function computeTargetKey_raw(a: { targetType: BuildFlowTargetType; targetGroupId?: string; wareId: string }): string {
  if (a.targetType === 'line-build-material') {
    return `line:${a.targetGroupId}:${a.wareId}`
  }
  if (a.targetType === 'output-build-material') {
    return `output-build:${a.wareId}`
  }
  return `output:${a.wareId}`
}

function onPlusClick(groupId: string, wareId: string, tagId: string, event: MouseEvent) {
  const targets = presenter.getTargetsForSource(wareId, groupId)
  if (targets.length === 0) return
  menuTargets.value = targets.map((item) => {
    const assignment = logicFlow.buildFlowAssignments.find((candidate) => {
      return item.targetKey === computeTargetKey_raw(candidate)
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
  const currentTargetKey = computeTargetKey_raw({ targetType, targetGroupId, wareId })
  const currentBoundAssignment = logicFlow.buildFlowAssignments.find((assignment) => {
    return currentTargetKey === computeTargetKey_raw(assignment)
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
  if (targetType === 'output-build-material') {
    return `output-build:${tag.wareId}`
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
    <div class="flex justify-between items-center">
      <div class="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {{ t('buildFlow.build_flow_zone_title') }}
      </div>
      <button
        v-if="hasArchived"
        class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        @click="showArchiveModal = true"
      >
        {{ t('buildFlow.build_flow_archived_count', { count: presenter.archivedGroupIds.value.length }) }}
      </button>
    </div>

    <div class="build-flow-groups grid gap-5" :class="presenter.buildFlowGroups.value.length === 1 ? '' : 'grid-cols-2'">
      <div
        v-for="sg in sortedGroupTags"
        :key="sg.groupKey"
        class="build-flow-group border border-gray-700 rounded p-3 flex flex-col justify-center relative"
      >
        <div class="flex items-start">
          <div class="flex flex-col gap-16 shrink-0 ml-[80px]" style="width: 308px">
            <div
              v-for="card in sg.lineCards"
              :key="card.groupId"
              class="build-flow-line-card bg-gray-800/60 border border-gray-600 rounded p-2 relative"
            >
              <button
                class="archive-btn absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-amber-400 transition-colors"
                :title="t('buildFlow.build_flow_archive_line')"
                @click="presenter.archiveGroup(card.groupId)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-10 4h4" />
                </svg>
              </button>
              <div class="text-xs text-gray-300 font-medium mb-2 truncate pr-4" :title="card.title">{{ card.title }}</div>
              <div class="flex flex-col gap-1">
                <div class="flex justify-between">
                  <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_build_materials') }}</span>
                  <span class="text-[10px] text-gray-500">{{ t('buildFlow.build_flow_source_materials') }}</span>
                </div>
                <div
                  v-for="row in getSortedRows(card.groupId, sg.order)"
                  :key="row.wareId"
                  class="flex justify-between items-center"
                  style="min-height: 24px"
                >
                  <span
                    v-if="row.buildMaterialTag"
                    :data-tag-id="row.buildMaterialTag.tagId"
                    class="build-flow-tag build-flow-target-tag whitespace-nowrap"
                    @dragover.prevent
                    @drop.prevent="onTargetDrop('line-build-material', card.groupId)"
                  >
                    <button
                      class="target-tag-segment target-tag-segment-add"
                      :style="boundTargetTagIds.has(row.buildMaterialTag.tagId) ? { backgroundColor: getWareColor(row.wareId) + '40', borderColor: getWareColor(row.wareId) + '80', color: getWareColor(row.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                      @click.stop="onTargetTagPlusClick(row.buildMaterialTag.wareId, row.buildMaterialTag.tagId, 'line-build-material', card.groupId, sg.groupKey, $event)"
                    >+</button>
                    <span
                      class="target-tag-segment target-tag-segment-main"
                      :style="boundTargetTagIds.has(row.buildMaterialTag.tagId) ? { backgroundColor: getWareColor(row.wareId) + '40', borderColor: getWareColor(row.wareId) + '80', color: getWareColor(row.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                    >
                      <span class="target-tag-text">{{ row.buildMaterialTag.label }}</span>
                      <button v-if="boundTargetTagIds.has(row.buildMaterialTag.tagId)" class="target-tag-unbind" @click.stop="onUnbind(computeTargetKey(row.buildMaterialTag, 'line-build-material'))" :title="t('buildFlow.build_flow_unbind')">&times;</button>
                    </span>
                  </span>
                  <div v-else class="w-[142px] h-[24px] shrink-0"></div>
                  <span
                    v-if="row.sourceTag"
                    :data-tag-id="row.sourceTag.tagId"
                    class="build-flow-tag build-flow-source-tag whitespace-nowrap"
                    draggable="true"
                    @dragstart="onSourceDragStart(card.groupId, row.sourceTag.wareId)"
                    @dragend="onSourceDragEnd"
                  >
                    <span class="source-tag-segment source-tag-segment-main" :style="{ backgroundColor: getWareColor(row.wareId) + '40', borderColor: getWareColor(row.wareId) + '80', color: getWareColor(row.wareId) }"><span class="source-tag-text">{{ row.sourceTag.label }}</span></span>
                    <button class="source-tag-segment source-tag-segment-add" :style="{ backgroundColor: getWareColor(row.wareId) + '40', borderColor: getWareColor(row.wareId) + '80', color: getWareColor(row.wareId) }" @click.stop="onPlusClick(card.groupId, row.sourceTag.wareId, row.sourceTag.tagId, $event)">+</button>
                  </span>
                  <div v-else class="w-[142px] h-[24px] shrink-0"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 shrink-0 self-center ml-auto mr-1" style="width: 160px">
            <div
              v-if="sg.outputBuildTags.length > 0"
              class="build-flow-output-card build-flow-output-build-card bg-gray-800/60 border border-gray-600 rounded p-2"
            >
              <div class="text-xs text-gray-300 font-medium mb-1">{{ t('buildFlow.build_flow_output_build_title') }}</div>
              <div class="build-flow-target-list flex flex-col gap-1 items-start">
                <span
                  v-for="tag in sg.outputBuildTags"
                  :key="tag.tagId"
                  :data-tag-id="tag.tagId"
                  class="build-flow-tag build-flow-target-tag whitespace-nowrap"
                  @dragover.prevent
                  @drop.prevent="onTargetDrop('output-build-material')"
                >
                  <button
                    class="target-tag-segment target-tag-segment-add"
                    :style="boundTargetTagIds.has(tag.tagId) ? { backgroundColor: getWareColor(tag.wareId) + '40', borderColor: getWareColor(tag.wareId) + '80', color: getWareColor(tag.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                    @click.stop="onTargetTagPlusClick(tag.wareId, tag.tagId, 'output-build-material', undefined, sg.groupKey, $event)"
                  >+</button>
                  <span
                    class="target-tag-segment target-tag-segment-main"
                    :style="boundTargetTagIds.has(tag.tagId) ? { backgroundColor: getWareColor(tag.wareId) + '40', borderColor: getWareColor(tag.wareId) + '80', color: getWareColor(tag.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                  >
                    <span class="target-tag-text">{{ tag.label }}</span>
                    <button v-if="boundTargetTagIds.has(tag.tagId)" class="target-tag-unbind" @click.stop="onUnbind(computeTargetKey(tag, 'output-build-material'))" :title="t('buildFlow.build_flow_unbind')">&times;</button>
                  </span>
                </span>
              </div>
            </div>
            <div
              v-if="sg.outputMaterialTags.length > 0"
              class="build-flow-output-card build-flow-output-material-card bg-gray-800/60 border border-gray-600 rounded p-2"
            >
              <div class="text-xs text-gray-300 font-medium mb-1">{{ t('buildFlow.build_flow_output_material_title') }}</div>
              <div class="build-flow-target-list flex flex-col gap-1 items-start">
                <span
                  v-for="tag in sg.outputMaterialTags"
                  :key="tag.tagId"
                  :data-tag-id="tag.tagId"
                  class="build-flow-tag build-flow-target-tag whitespace-nowrap"
                  @dragover.prevent
                  @drop.prevent="onTargetDrop('output-material')"
                >
                  <button
                    class="target-tag-segment target-tag-segment-add"
                    :style="boundTargetTagIds.has(tag.tagId) ? { backgroundColor: getWareColor(tag.wareId) + '40', borderColor: getWareColor(tag.wareId) + '80', color: getWareColor(tag.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                    @click.stop="onTargetTagPlusClick(tag.wareId, tag.tagId, 'output-material', undefined, sg.groupKey, $event)"
                  >+</button>
                  <span
                    class="target-tag-segment target-tag-segment-main"
                    :style="boundTargetTagIds.has(tag.tagId) ? { backgroundColor: getWareColor(tag.wareId) + '40', borderColor: getWareColor(tag.wareId) + '80', color: getWareColor(tag.wareId) } : { backgroundColor: 'transparent', borderColor: '#4b5563', color: '#9ca3af' }"
                  >
                    <span class="target-tag-text">{{ tag.label }}</span>
                    <button v-if="boundTargetTagIds.has(tag.tagId)" class="target-tag-unbind" @click.stop="onUnbind(computeTargetKey(tag, 'output-material'))" :title="t('buildFlow.build_flow_unbind')">&times;</button>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <BuildFlowEdgeLayer
          v-if="presenter.edges.value.some(e => sg.lineCards.some(c => c.groupId === e.sourceGroupId))"
          :edges="presenter.edges.value.filter(e => {
            for (const card of sg.lineCards) if (card.groupId === e.sourceGroupId) return true
            return false
          })"
          :ware-ids="sortedWareIds"
        />
      </div>
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
            <span class="flex-1 truncate">{{ target.targetType === 'line-build-material' ? target.cardTitle : target.targetType === 'output-build-material' ? t('buildFlow.build_flow_output_build_title') : t('buildFlow.build_flow_output_material_title') }}</span>
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showArchiveModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showArchiveModal = false"
      >
        <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-lg w-80 max-h-60 overflow-hidden">
          <div class="flex justify-between items-center px-4 py-3 border-b border-gray-700">
            <div class="text-sm font-medium text-gray-200">{{ t('buildFlow.build_flow_archived_lines') }}</div>
            <button class="text-gray-500 hover:text-gray-300" @click="showArchiveModal = false">&times;</button>
          </div>
          <div class="p-2 overflow-y-auto max-h-40 custom-scrollbar">
            <div
              v-for="card in presenter.archivedLineCards.value"
              :key="card.groupId"
              class="flex justify-between items-center px-3 py-2 rounded hover:bg-gray-700/50"
            >
              <div class="text-xs text-gray-300 truncate">{{ card.title }}</div>
              <button
                class="text-xs text-amber-400 hover:text-amber-200 transition-colors"
                @click="presenter.unarchiveGroup(card.groupId)"
              >
                {{ t('buildFlow.build_flow_unarchive') }}
              </button>
            </div>
            <div v-if="presenter.archivedLineCards.value.length === 0" class="text-xs text-gray-500 text-center py-4">
              {{ t('buildFlow.build_flow_no_archived_lines') }}
            </div>
          </div>
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
