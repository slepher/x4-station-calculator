<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import type {
	  TerraformingCancelValidation,
	  TerraformingArchiveProjectDisplay,
	  TerraformingArchiveSyncNotice,
	  TerraformingCurrentQueueDisplayEntry,
	  TerraformingDraftTimelineEntry,
	  TerraformingExecutionTimelineEntry,
	  TerraformingExecutedDisplayEntry,
	  TerraformingGoalPlanDisplayEntry,
	  TerraformingTaskDragState,
	} from '@/components/empire/presenters/useTerraformingPresenter'
import type { DeliveryShip } from '@/store/logic/terraformingTaskResolver'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

interface Props {
	  selectedClusterId: string | null
	  isLiveMode: boolean
	  executionTimeline: TerraformingExecutionTimelineEntry[]
	  taskLogMode: 'queue' | 'executed'
	  currentQueueDisplayEntries: TerraformingCurrentQueueDisplayEntry[]
	  executedEntries: TerraformingExecutedDisplayEntry[]
	  archiveSyncNotice: TerraformingArchiveSyncNotice | null
	  archiveActiveProjectDisplay: TerraformingArchiveProjectDisplay | null
	  archiveRetainedProjectDisplays: TerraformingArchiveProjectDisplay[]
	  queueEditState: {
    editing: boolean
    canComplete: boolean
    unsatisfiedGoalCount: number
    planEntries: TerraformingGoalPlanDisplayEntry[]
  }
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
  deliveryShipMap: Map<string, DeliveryShip>
  hqBuildDocks: { totalSlots: number } | null
  floating: boolean
  taskDrag: TerraformingTaskDragState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancelExecution', entryId: string): void
  (e: 'clearAll'): void
  (e: 'startEdit'): void
  (e: 'cancelEdit'): void
  (e: 'completeEdit'): void
  (e: 'removeDraft', entryId: string): void
  (e: 'removeAllDraft'): void
  (e: 'copyDraft', entryId: string): void
  (e: 'updateDraftEntries', entries: TerraformingDraftTimelineEntry[]): void
  (e: 'clickStat', statId: string): void
	  (e: 'clickGoal', goalId: string): void
	  (e: 'moveTaskBeforeDependency', entryId: string, goalId: string): void
	  (e: 'dropTask', projectId: string, targetIdx: number): void
	  (e: 'setTaskLogMode', mode: 'queue' | 'executed'): void
	  (e: 'confirmArchiveSync'): void
	  (e: 'importBlueprintSettings'): void
	}>()

const { t } = useI18n()
const { translateWare } = useX4I18n()
const gameDataStore = useGameDataStore()
const expandedEntryId = ref<string | null>(null)
const panelContentRef = ref<HTMLElement | null>(null)
const cancelValidationCache = ref<Record<string, TerraformingCancelValidation>>({})

const dragHoverIndex = ref(-1)
const draggableContainerRef = ref<any>(null)

	const displayPlanEntries = computed(() => {
  const entries = [...props.queueEditState.planEntries] as TerraformingGoalPlanDisplayEntry[]
  if (props.taskDrag.isDragging.value && dragHoverIndex.value >= 0 && dragHoverIndex.value <= entries.length) {
    entries.splice(dragHoverIndex.value, 0, {
      projectName: props.taskDrag.projectName.value,
      _type: 'drag-clone',
    } as any)
  }
  return entries
	})

	interface CurrentQueueTimelineEntry extends TerraformingExecutionTimelineEntry {
	  statusLabel?: string
	  progressLabel?: string
	  fixedRuntime?: boolean
	  archiveDetailMode?: 'consumed-only'
	}

	const timelineById = computed(() => new Map(props.executionTimeline.map(entry => [entry.id, entry])))

	const currentQueueTimelineEntries = computed<CurrentQueueTimelineEntry[]>(() => {
	  return props.currentQueueDisplayEntries.map(entry => {
	    if (entry.status === 'pending') {
	      const timelineEntry = timelineById.value.get(entry.replayEntryId ?? entry.id)
	      if (timelineEntry) {
	        return {
	          ...timelineEntry,
	          progressLabel: entry.runtimeStatus === 'active'
	            ? (t('terraforming.activeInArchive') || 'Active')
	            : entry.runtimeStatus === 'has-progress' ? (t('terraforming.hasProgress') || 'Has progress') : undefined,
	          fixedRuntime: entry.fixedFirst,
	        }
	      }
	    }
	    const isActive = entry.runtimeStatus === 'active'
	    return {
	      id: entry.id,
	      order: 0,
	      projectId: entry.projectId,
	      projectName: entry.projectName,
	      projectGroupId: entry.status === 'occurred' ? 'events' : 'archive',
	      projectGroupName: '',
	      showGroupMarker: false,
	      wares: entry.archiveConsumedWares?.map(item => ({ ware: item.ware, amount: item.amount })) ?? [],
	      deliveries: [],
	      deliveryDetails: [],
	      dockModules: [],
	      totalSlots: 0,
	      price: 0,
	      discountAmount: 0,
	      projectRebates: [],
	      cumulativeRebates: [],
	      rebateChanges: [],
	      discountedWares: [],
	      statLines: [],
	      beforeStats: [],
	      afterStats: [],
	      availableBeforeExecution: true,
	      blockedReason: null,
	      projectDuration: 0,
	      statusLabel: isActive
	        ? undefined
	        : entry.runtimeStatus === 'active'
	        ? (t('terraforming.activeInArchive') || 'Active')
	        : queueStatusLabel(entry),
	      progressLabel: isActive
	        ? (t('terraforming.activeInArchive') || 'Active')
	        : entry.runtimeStatus === 'has-progress' ? (t('terraforming.hasProgress') || 'Has progress') : undefined,
	      fixedRuntime: entry.fixedFirst,
	      archiveDetailMode: isActive ? undefined : 'consumed-only',
	    }
	  })
	})

	function queueStatusLabel(entry: TerraformingCurrentQueueDisplayEntry): string {
	  if (entry.status === 'executed') return t('terraforming.executedStatus') || 'Executed'
	  if (entry.status === 'occurred') return t('terraforming.occurredStatus') || 'Occurred'
	  return t('terraforming.pendingStatus') || 'Pending'
	}

	function executedStatusLabel(entry: TerraformingExecutedDisplayEntry): string {
	  if (entry.status === 'archive-only') return t('terraforming.archiveOnly') || 'Archive'
	  if (entry.status === 'occurred') return t('terraforming.occurredStatus') || 'Occurred'
	  return t('terraforming.executedStatus') || 'Executed'
	}

watch(() => props.taskDrag.isDragging.value, (dragging) => {
  document.body.classList.toggle('terraforming-task-dragging', dragging)
  if (!dragging) dragHoverIndex.value = -1
})

onUnmounted(() => {
  document.body.classList.remove('terraforming-task-dragging')
})

function getDraggedProjectId(event: any): string {
  if (props.taskDrag.projectId.value) return props.taskDrag.projectId.value
  const draggedModel = event.item?._underlying_vm_
  if (draggedModel?.projectId) return draggedModel.projectId
  if (draggedModel?.id) return draggedModel.id
  if (event.item?.dataset?.projectId) return event.item.dataset.projectId
  return ''
}

function onExternalDrop(e: any) {
  const targetIdx = dragHoverIndex.value >= 0 ? dragHoverIndex.value : (e.newIndex ?? e.added?.newIndex)
  const projectId = getDraggedProjectId(e)
  if (!projectId) return
  dragHoverIndex.value = -1
  emit('dropTask', projectId, targetIdx)
}

function onDragChange(e: any) {
  if (!e.from || !e.to || e.from === e.to) return
  const added = e.added
  if (added?.newIndex !== undefined) {
    dragHoverIndex.value = added.newIndex
  } else if (e.newIndex !== undefined) {
    dragHoverIndex.value = e.newIndex
  }
}

function updateHoverIndexFromPointer(event: DragEvent | MouseEvent) {
  if (!props.taskDrag.isDragging.value) return
  event.preventDefault()
  const rawContainer = draggableContainerRef.value
  let container: HTMLElement | null = null
  if (rawContainer instanceof HTMLElement) {
    container = rawContainer
  } else if (rawContainer?.$el instanceof HTMLElement) {
    container = rawContainer.$el
  }
  if (!container) return

  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-plan-entry-row="true"]'))
  let nextIndex = rows.length
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i]!.getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) {
      nextIndex = i
      break
    }
  }
  dragHoverIndex.value = nextIndex
}

function clearHoverIndex() {
  dragHoverIndex.value = -1
}

function onModelValueUpdate(entries: TerraformingGoalPlanDisplayEntry[]) {
  if (props.taskDrag.isDragging.value) return
  const tasks = entries
    .filter((pe): pe is { type: 'task'; entry: TerraformingDraftTimelineEntry } => pe.type === 'task' && !pe.entry.fixedRuntime)
    .map(pe => pe.entry)
  emit('updateDraftEntries', tasks)
}

function handleMove(evt: any) {
  const el = evt.dragged
  if (el.classList.contains('auto-event-entry') || el.classList.contains('goal-entry')) {
    return false
  }
  const related = evt.related
  if (related && (related.classList.contains('auto-event-entry') || related.classList.contains('goal-entry'))) {
    return false
  }
}

function planEntryKey(pe: any): string {
  if (pe._type === 'drag-clone') return `drag-preview-${dragHoverIndex.value}`
  if (pe.type === 'goal') return `goal-${pe.entry.id}`
  if (pe.type === 'auto-event') return `auto-event-${pe.entry.id || pe.entry.projectId}`
  return pe.entry?.id || ''
}

let prevTimelineLength = 0

watch(() => props.executionTimeline, (timeline) => {
  cancelValidationCache.value = {}
  if (!props.queueEditState.editing && timeline.length > prevTimelineLength) {
    const lastEntry = timeline[timeline.length - 1]
    if (lastEntry) {
      nextTick(() => {
        expandedEntryId.value = lastEntry.id
        cancelValidationCache.value = {
          [lastEntry.id]: props.getCancelValidation(lastEntry.id),
        }
        nextTick(() => {
          if (panelContentRef.value) {
            panelContentRef.value.scrollTop = panelContentRef.value.scrollHeight
          }
        })
      })
    }
  }
  prevTimelineLength = timeline.length
}, { deep: true })

function toggleEntry(entryId: string) {
  expandedEntryId.value = expandedEntryId.value === entryId ? null : entryId
  if (expandedEntryId.value === entryId && !cancelValidationCache.value[entryId]) {
    cancelValidationCache.value = {
      ...cancelValidationCache.value,
      [entryId]: props.getCancelValidation(entryId),
    }
  }
}

function getValidation(entryId: string): TerraformingCancelValidation {
  const cached = cancelValidationCache.value[entryId]
  if (cached) return cached
  const next = props.getCancelValidation(entryId)
  cancelValidationCache.value = {
    ...cancelValidationCache.value,
    [entryId]: next,
  }
  return next
}

function onCancel(entry: TerraformingExecutionTimelineEntry) {
  const validation = getValidation(entry.id)
  if (!validation.canCancel) return
  emit('cancelExecution', entry.id)
}

function getWareName(wareId: string): string {
  const gameDataStore = useGameDataStore()
  const ware = gameDataStore.waresMap[wareId] as any
  if (!ware) return wareId
  return translateWare(ware)
}

function getDiscountedWaresMap(entry: TerraformingExecutionTimelineEntry): Map<string, { original: number; discount: number; final: number }> {
  const map = new Map<string, { original: number; discount: number; final: number }>()
  for (const dw of entry.discountedWares) {
    map.set(dw.wareId, dw)
  }
  return map
}

function getWareDiscount(entry: TerraformingExecutionTimelineEntry, wareId: string): string {
  const dw = getDiscountedWaresMap(entry).get(wareId)
  if (!dw || dw.discount <= 0) return ''
  return '\u2212' + dw.discount.toLocaleString()
}

function getWareConsumed(entry: TerraformingExecutionTimelineEntry, wareId: string): number {
  const qty = entry.wares.find(w => w.ware === wareId)?.actualAmount
    ?? entry.wares.find(w => w.ware === wareId)?.amount
    ?? 0
  const dw = getDiscountedWaresMap(entry).get(wareId)
  return dw ? dw.final : qty
}

function getTotalVolume(entry: TerraformingExecutionTimelineEntry): number {
  let total = 0
  for (const w of entry.wares) {
    const ware = gameDataStore.waresMap[w.ware] as any
    const volume = ware?.volume ?? 0
    total += (w.actualAmount ?? w.amount) * volume
  }
  return Math.ceil(total)
}

interface VolumeByTransport {
  solid: number
  liquid: number
  container: number
}

function getVolumeByTransport(entry: TerraformingExecutionTimelineEntry): VolumeByTransport {
  const result: VolumeByTransport = { solid: 0, liquid: 0, container: 0 }
  for (const w of entry.wares) {
    const ware = gameDataStore.waresMap[w.ware] as any
    const transport = ware?.transport as string | undefined
    if (!transport || !(transport in result)) continue
    const volume = ware?.volume ?? 0
    result[transport as keyof VolumeByTransport] += (w.actualAmount ?? w.amount) * volume
  }
  result.solid = Math.ceil(result.solid)
  result.liquid = Math.ceil(result.liquid)
  result.container = Math.ceil(result.container)
  return result
}

const showNoDockWarning = computed(() => {
  const docks = props.hqBuildDocks
  if (!docks) return false
  return docks.totalSlots === 0
})

function formatTime(seconds: number): string {
  if (seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = [h, m, s].map(p => String(p).padStart(2, '0'))
  return parts.join(':')
}

function getTotalBuildTime(entry: TerraformingExecutionTimelineEntry): number {
  return entry.deliveryDetails[0]?.totalTime ?? 0
}

function buildDraftWaresTooltip(entry: { wares: Array<{ name: string; amount: number }>; discountedWares: Array<{ name: string; discount: number; final: number }> }): string {
  const dwMap = new Map(entry.discountedWares.map(d => [d.name, d]))
  const lines = entry.wares.map(w => {
    const d = dwMap.get(w.name)
    return `<div class='tooltip-ware-row'><span class='tooltip-ware-name'>${w.name}</span><span class='tooltip-ware-amount'>${(d ? d.final : w.amount).toLocaleString()}</span></div>`
  })
  return `<div class='tooltip-wares'>${lines.join('')}</div>`
}
</script>

<template>
  <div class="panel-card" :class="{ 'panel-floating': floating }">
    <div class="panel-header">
      {{ t('terraforming.taskQueue') }}
      <span v-if="showNoDockWarning" class="text-amber-400 text-[11px] ml-2">⚠ {{ t('terraforming.noBuildDock') }}</span>
      <span v-if="queueEditState.editing && queueEditState.unsatisfiedGoalCount > 0" class="text-red-400 text-[11px] ml-2">
        {{ queueEditState.unsatisfiedGoalCount }} {{ t('terraforming.unmetDependencies') || 'unmet dependencies' }}
      </span>
	      <button
	        v-if="isLiveMode && !queueEditState.editing"
	        class="import-btn"
	        v-tippy="{ content: t('terraforming.importBlueprintSettingsTooltip'), allowHTML: false, placement: 'bottom', theme: 'material', maxWidth: 320 }"
	        @click="emit('importBlueprintSettings')"
	      >
	        {{ t('terraforming.importBlueprintSettings') || 'Import' }}
	      </button>
	      <button
	        v-if="!queueEditState.editing"
	        class="clear-all-btn"
	        @click="emit('startEdit')"
	      >
        {{ t('terraforming.editQueue') || 'Edit' }}
      </button>
      <template v-else>
        <div class="edit-actions-group">
          <button class="edit-action-btn" @click="emit('cancelEdit')">
            {{ t('ui.cancel') }}
          </button>
          <button
            class="edit-action-btn complete"
            :disabled="!queueEditState.canComplete"
            @click="emit('completeEdit')"
          >
            {{ t('ui.save') }}
          </button>
        </div>
      </template>
    </div>
    <div ref="panelContentRef" class="panel-content">
	      <div v-if="!selectedClusterId" class="empty-state">
	        {{ t('terraforming.selectClusterForResources') }}
	      </div>
	
	      <div
	        v-if="selectedClusterId && archiveSyncNotice && !queueEditState.editing"
	        class="archive-sync-notice"
	        :class="{ warning: archiveSyncNotice.hasArchiveRollbackRisk }"
	      >
	        <div class="notice-main">
	          <span>{{ archiveSyncNotice.message }}</span>
	          <span v-if="archiveSyncNotice.deductedCount > 0">
	            {{ archiveSyncNotice.deductedCount }} {{ t('terraforming.deductedEntries') || 'deducted' }}
	          </span>
	          <span v-if="archiveSyncNotice.archiveOnlyCount > 0">
	            {{ archiveSyncNotice.archiveOnlyCount }} {{ t('terraforming.archiveOnly') || 'archive only' }}
	          </span>
	        </div>
	        <button
	          class="notice-confirm-btn"
	          :disabled="archiveSyncNotice.hasArchiveRollbackRisk"
	          @click="emit('confirmArchiveSync')"
	        >
	          {{ t('terraforming.confirmArchiveSync') || 'Confirm' }}
	        </button>
	      </div>

	      <div v-if="selectedClusterId && queueEditState.editing" class="timeline-list">
        <div v-if="showNoDockWarning" class="text-amber-400 text-[11px]">⚠ {{ t('terraforming.noBuildDock') }}</div>
        <div class="bulk-edit-card">
          <button class="draft-btn danger" @click="emit('removeAllDraft')">{{ t('terraforming.removeAll') || 'Remove all' }}</button>
        </div>

        <div v-if="queueEditState.planEntries.length === 0" class="empty-state">
          {{ t('terraforming.noExecutionTimeline') }}
        </div>

        <draggable
          v-else
          ref="draggableContainerRef"
          :model-value="displayPlanEntries"
          :item-key="planEntryKey"
          :group="{ name: 'terraforming-tasks', pull: false, put: () => true }"
          ghost-class="drag-ghost"
          handle=".drag-handle"
          filter=".goal-entry,.auto-event-entry"
          class="draggable-container"
          @add="onExternalDrop"
          @change="onDragChange"
          @dragover.prevent="updateHoverIndexFromPointer"
          @mousemove="updateHoverIndexFromPointer"
          @mouseleave="clearHoverIndex"
          @move="handleMove"
          @update:model-value="onModelValueUpdate"
        >
          <template #item="{ element: planEntry }">
            <div>
              <!-- Drag clone preview -->
              <div
                v-if="planEntry._type === 'drag-clone'"
                class="timeline-item draft-item drag-preview-entry"
              >
                <div class="timeline-head">
                  <span class="drag-handle preview-drag-handle">↕</span>
                  <span class="entry-name">{{ planEntry.projectName || planEntry.projectId }}</span>
                </div>
              </div>

              <div
                v-else
                data-plan-entry-row="true"
                :class="planEntry.type === 'goal'
                ? ['goal-entry', {
                    'goal-filter-active': planEntry.entry.isFilterActive,
                    'goal-satisfied': planEntry.entry.satisfied,
                    'goal-unsatisfied': !planEntry.entry.satisfied,
                    'goal-has-risk': planEntry.entry.hasRisk,
                    'goal-has-task': planEntry.entry.hasExistingTask,
                    'goal-preventive': planEntry.entry.kind === 'preventive',
                  }]
                : planEntry.type === 'auto-event'
                ? ['timeline-item', 'draft-item', 'auto-event-entry']
                : ['timeline-item', 'draft-item', {
                    'system-disabled': planEntry.entry.systemDisabled,
                  }]"
              @click="planEntry.type === 'goal' && !planEntry.entry.hasExistingTask ? emit('clickGoal', planEntry.entry.id) : undefined"
            >
              <template v-if="planEntry.type === 'goal'">
                <div class="goal-head">
                  <span class="goal-icon">{{ planEntry.entry.kind === 'cluster' ? '🎯' : planEntry.entry.kind === 'preventive' ? '⚠️' : planEntry.entry.kind === 'stat' ? '📊' : '📋' }}</span>
                  <span class="goal-label">{{ planEntry.entry.label }}</span>
                  <span v-if="planEntry.entry.kind === 'cluster'" class="goal-kind-tag">{{ t('terraforming.goal.clusterGoal') || 'Cluster Goal' }}</span>
                  <span v-else-if="planEntry.entry.kind === 'preventive'" class="goal-kind-tag goal-kind-tag-preventive">{{ t('terraforming.goal.preventiveGoal') || 'Preventive' }}</span>
                  <span v-else-if="planEntry.entry.kind === 'stat'" class="goal-kind-tag">{{ t('terraforming.goal.statGoal') || 'Stat Goal' }}</span>
                  <span v-else class="goal-kind-tag">{{ t('terraforming.goal.projectGoal') || 'Goal' }}</span>
                  <span v-if="planEntry.entry.satisfied" class="goal-status done">✓</span>
                  <span v-else-if="!planEntry.entry.hasExistingTask" class="goal-status pending">○</span>
                  <button
                    v-if="planEntry.entry.hasExistingTask"
                    class="goal-move-btn"
                    @click.stop="emit('moveTaskBeforeDependency', planEntry.entry.existingDraftEntryId!, planEntry.entry.id)"
                  >
                    {{ t('terraforming.goal.moveBefore') || '↑' }}
                  </button>
                </div>
                <div v-if="planEntry.entry.hasExistingTask" class="goal-hint-text">
                  {{ t('terraforming.goal.reorderHint') || 'Task exists after dependencies — click to reorder' }}
                </div>
                <div v-if="planEntry.entry.statGoalModel" class="goal-stat-display">
                  <TerraformingStatScale
                    v-if="planEntry.entry.statGoalModel.hasRanges"
                    :model="planEntry.entry.statGoalModel"
                    compact
                    mode="impact"
                    @click-stat="emit('clickStat', $event)"
                  />
                  <div v-else class="goal-stat-text">{{ planEntry.entry.statGoalModel.numericText }}</div>
                </div>
                <div v-if="planEntry.entry.riskReason" class="goal-risk-text">{{ planEntry.entry.riskReason }}</div>
              </template>

              <template v-else-if="planEntry.type === 'auto-event'">
                <div class="timeline-head">
                  <button class="timeline-main" disabled style="cursor:default">
                    <span class="drag-placeholder">◇</span>
                    <span class="entry-order">#{{ planEntry.entry.order }}</span>
                    <span class="entry-name">{{ planEntry.entry.projectName }}</span>
                    <span class="event-tag">{{ t('terraforming.event.tag') || 'EVENT' }}</span>
                  </button>
                </div>
                <div v-if="planEntry.entry.statLines.length > 0" class="timeline-body draft-body">
                  <div class="detail-section">
                    <div class="section-title">{{ t('terraforming.statChanges') }}</div>
                    <TerraformingStatScale
                      v-for="line in planEntry.entry.statLines"
                      :key="`${planEntry.entry.id}-auto-stat-${line.statId}`"
                      :model="line"
                      compact
                      mode="impact"
                      @click-stat="emit('clickStat', $event)"
                    />
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="timeline-head">
                  <button class="timeline-main" @click.stop="toggleEntry(planEntry.entry.id)">
                    <span v-if="!planEntry.entry.fixedRuntime" class="drag-handle">↕</span>
                    <span v-else class="drag-placeholder">◇</span>
                    <span class="entry-order">#{{ planEntry.entry.order }}</span>
                    <span class="entry-name">{{ planEntry.entry.projectName }}</span>
                    <span v-if="planEntry.entry.fixedRuntime" class="progress-tag">{{ t('terraforming.activeInArchive') || 'Active' }}</span>
                    <span v-if="planEntry.entry.systemDisabled" class="draft-state disabled">
                      {{ t('terraforming.queueState.disabled') || 'Disabled' }}
                    </span>
                  </button>
                  <div class="draft-actions">
                    <span v-if="planEntry.entry.price > 0" class="entry-price">{{ (planEntry.entry.discountAmount > 0 ? planEntry.entry.price - planEntry.entry.discountAmount : planEntry.entry.price).toLocaleString() }} Cr</span>
                    <span
                      v-if="planEntry.entry.price > 0 && planEntry.entry.wares.length > 0"
                      class="entry-info-icon"
                      v-tippy="{ content: buildDraftWaresTooltip(planEntry.entry), allowHTML: true, placement: 'top', theme: 'material' }"
                    >ⓘ</span>
                    <button
                      v-if="!planEntry.entry.fixedRuntime"
                      class="draft-btn danger"
                      @click.stop="emit('removeDraft', planEntry.entry.id)"
                    >
                      {{ t('terraforming.remove') || 'Remove' }}
                    </button>
                    <button
                      v-if="!planEntry.entry.fixedRuntime && planEntry.entry.repeatRole !== 'single'"
                      class="draft-btn"
                      @click.stop="emit('copyDraft', planEntry.entry.id)"
                    >
                      {{ t('terraforming.copy') || 'Copy' }}
                    </button>
                  </div>
                </div>
                <div
                  v-if="planEntry.entry.statLines.length > 0 || planEntry.entry.reasons.length > 0"
                  class="timeline-body draft-body"
                >
                  <div v-if="planEntry.entry.statLines.length > 0" class="detail-section">
                    <TerraformingStatScale
                      v-for="line in planEntry.entry.statLines"
                      :key="`${planEntry.entry.id}-draft-stat-${line.statId}`"
                      :model="line"
                      compact
                      mode="impact"
                      @click-stat="emit('clickStat', $event)"
                    />
                  </div>
                  <div v-if="planEntry.entry.reasons.length > 0" class="detail-section">
                    <div class="section-title">{{ t('terraforming.invalidReason') || 'Invalid reason' }}</div>
                    <div v-for="reason in planEntry.entry.reasons" :key="`${planEntry.entry.id}-${reason}`" class="detail-text text-red-300">{{ reason }}</div>
	            </div>
	          </div>
		        </template>
		      </div>
            </div>
          </template>
        </draggable>
      </div>

	      <div v-if="selectedClusterId && !queueEditState.editing && isLiveMode" class="task-log-tabs">
	        <button
	          class="task-log-tab"
	          :class="{ active: taskLogMode === 'queue' }"
	          @click="emit('setTaskLogMode', 'queue')"
	        >
	          {{ t('terraforming.currentQueue') || 'Current Queue' }}
	        </button>
	        <button
	          class="task-log-tab"
	          :class="{ active: taskLogMode === 'executed' }"
	          @click="emit('setTaskLogMode', 'executed')"
	        >
	          {{ t('terraforming.executed') || 'Executed' }}
	        </button>
	      </div>

	      <div v-if="selectedClusterId && !queueEditState.editing && taskLogMode === 'executed'" class="timeline-list">
	        <div v-if="executedEntries.length === 0" class="empty-state">
	          {{ t('terraforming.noExecutedEntries') || t('terraforming.noExecutionTimeline') }}
	        </div>
	        <div v-for="entry in executedEntries" :key="entry.id" class="timeline-item executed-item">
	          <div class="timeline-head">
	            <button class="timeline-main" @click="toggleEntry(entry.id)">
	              <span class="expand-icon">{{ expandedEntryId === entry.id ? '▼' : '▶' }}</span>
	              <span class="entry-order">×{{ entry.count }}</span>
	              <span class="entry-name">{{ entry.projectName }}</span>
	              <span class="executed-tag" :class="{ archive: entry.status === 'archive-only' }">{{ executedStatusLabel(entry) }}</span>
	            </button>
	          </div>
	          <div v-if="expandedEntryId === entry.id && (entry.archiveConsumedWares.length > 0 || entry.deliveryDetails.length > 0)" class="timeline-body">
	            <div v-if="entry.archiveConsumedWares.length > 0" class="detail-section">
	              <div class="section-title">{{ t('terraforming.materialPrice') }}</div>
	              <div class="archive-consumed-row detail-header">
	                <span>{{ t('terraforming.wareName') || 'Name' }}</span>
	                <span>{{ t('terraforming.consumed') || 'Consumed' }}</span>
	              </div>
	              <div v-for="ware in entry.archiveConsumedWares" :key="`${entry.id}-ware-${ware.ware}`" class="archive-consumed-row">
	                <span>{{ getWareName(ware.ware) }}</span>
	                <span>{{ ware.amount.toLocaleString() }}</span>
	              </div>
	            </div>
	            <div v-if="entry.deliveryDetails.length > 0" class="detail-section">
	              <div class="section-title">{{ t('terraforming.deliveryList') }}</div>
	              <div
	                v-for="dd in entry.deliveryDetails"
	                :key="`${entry.id}-delivery-${dd.macro}`"
	                class="detail-row"
	              >
	                <span>{{ dd.shipName }}</span>
	                <span>×{{ dd.amount }}  {{ dd.buildDuration }}s</span>
	              </div>
	            </div>
	          </div>
	        </div>
	      </div>

	      <div v-if="selectedClusterId && !queueEditState.editing && taskLogMode === 'queue' && currentQueueTimelineEntries.length === 0" class="empty-state">
	        {{ t('terraforming.noExecutionTimeline') }}
	      </div>
	
	      <div v-if="selectedClusterId && !queueEditState.editing && taskLogMode === 'queue' && currentQueueTimelineEntries.length > 0" class="timeline-list">
	        <div v-for="entry in currentQueueTimelineEntries" :key="entry.id">
	          <div v-if="entry.statusLabel" class="timeline-item executed-item">
	            <div class="timeline-head">
	              <button class="timeline-main" @click="toggleEntry(entry.id)">
	                <span class="expand-icon">{{ expandedEntryId === entry.id ? '▼' : '▶' }}</span>
	                <span class="entry-name">{{ entry.projectName }}</span>
	                <span class="executed-tag" :class="{ archive: entry.fixedRuntime }">{{ entry.statusLabel }}</span>
	              </button>
	            </div>
	            <div v-if="expandedEntryId === entry.id && entry.archiveDetailMode === 'consumed-only' && entry.wares.length > 0" class="timeline-body">
	              <div class="detail-section">
	                <div class="section-title">{{ t('terraforming.materialPrice') }}</div>
	                <div class="archive-consumed-row detail-header">
	                  <span>{{ t('terraforming.wareName') || 'Name' }}</span>
	                  <span>{{ t('terraforming.consumed') || 'Consumed' }}</span>
	                </div>
	                <div v-for="ware in entry.wares" :key="`${entry.id}-archive-ware-${ware.ware}`" class="archive-consumed-row">
	                  <span>{{ getWareName(ware.ware) }}</span>
	                  <span>{{ (ware.actualAmount ?? ware.amount).toLocaleString() }}</span>
	                </div>
	              </div>
	            </div>
	          </div>
	          <template v-else>
	          <div v-if="entry.showGroupMarker" class="group-marker">
	            {{ entry.projectGroupName }}
	          </div>

          <div class="timeline-item">
            <div class="timeline-head">
              <button class="timeline-main" @click="toggleEntry(entry.id)">
                <span class="expand-icon">{{ expandedEntryId === entry.id ? '▼' : '▶' }}</span>
	                <span v-if="!entry.fixedRuntime" class="entry-order">#{{ entry.order }}</span>
	                <span class="entry-name">{{ entry.projectName }}</span>
	                <span v-if="entry.projectGroupId === 'events'" class="event-tag">{{ t('terraforming.event.tag') || 'EVENT' }}</span>
	                <span v-if="entry.progressLabel" class="progress-tag">{{ entry.progressLabel }}</span>
	              </button>
              <button
                v-if="entry.projectGroupId !== 'events' && !entry.fixedRuntime"
                class="cancel-btn"
                :class="{ disabled: !getValidation(entry.id).canCancel }"
                :disabled="!getValidation(entry.id).canCancel"
                @click="onCancel(entry)"
              >
                {{ t('terraforming.undo') }}
              </button>
            </div>

            <div v-if="expandedEntryId === entry.id" class="timeline-body">
              <div v-if="entry.wares.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.materialPrice') }}</div>
                <div class="detail-row detail-header">
                  <span class="col-name">{{ t('terraforming.wareName') || 'Name' }}</span>
                  <span class="col-qty">{{ t('terraforming.wareQty') || 'Qty' }}</span>
                  <span class="col-discount">{{ t('terraforming.discount') || 'Discount' }}</span>
                  <span class="col-consumed">{{ t('terraforming.consumed') || 'Consumed' }}</span>
                </div>
                <div v-for="ware in entry.wares" :key="`${entry.id}-ware-${ware.ware}`" class="detail-row">
                  <span class="col-name">{{ getWareName(ware.ware) }}</span>
                  <span class="col-qty">{{ (ware.actualAmount ?? ware.amount).toLocaleString() }}</span>
                  <span class="col-discount">{{ getWareDiscount(entry, ware.ware) }}</span>
                  <span class="col-consumed">{{ getWareConsumed(entry, ware.ware).toLocaleString() }}</span>
                </div>
                <div class="detail-row detail-separator"></div>
                <template v-if="entry.discountAmount > 0">
                  <div class="detail-row">
                    <span>{{ t('terraforming.projectPrice') || 'Project Price' }}</span>
                    <span>{{ entry.price.toLocaleString() }} Cr</span>
                  </div>
                  <div class="detail-row text-amber-400">
                    <span>{{ t('terraforming.discount') || 'Discount' }}</span>
                    <span>-{{ entry.discountAmount.toLocaleString() }} Cr</span>
                  </div>
                </template>
                <div class="detail-row detail-total-sep">
                  <span>{{ t('terraforming.credits') }}</span>
                  <span>{{ (entry.discountAmount > 0 ? entry.price - entry.discountAmount : entry.price).toLocaleString() }} Cr</span>
                </div>
	                <template v-if="getTotalVolume(entry) > 0">
	                  <div v-for="[type, vol] in Object.entries(getVolumeByTransport(entry)).filter(([,v]) => v > 0)" :key="type" class="detail-row volume-row">
	                    <span>{{ t(`terraforming.transport.${type}`) }}</span>
	                    <span>{{ vol.toLocaleString() }} m³</span>
	                  </div>
	                </template>
	              </div>

	              <div v-if="entry.cumulativeRebates.length > 0 && entry.projectGroupId !== 'events'" class="detail-section">
                <div class="section-title">{{ t('terraforming.cumulativeRebates') }}</div>
                <div
                  v-for="(rb, i) in entry.cumulativeRebates"
                  :key="`${entry.id}-crbt-${i}`"
                  class="detail-row text-sky-400"
                >
                  <span>{{ rb.name }}</span>
                  <span>-{{ rb.value }}%</span>
                </div>
              </div>

              <div v-if="entry.deliveryDetails.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.deliveryList') }}</div>
                <div
                  v-for="dd in entry.deliveryDetails"
                  :key="`${entry.id}-delivery-${dd.macro}`"
                  class="detail-row"
                >
                  <span>{{ dd.shipName }}</span>
                  <span>×{{ dd.amount }}  {{ dd.buildDuration }}s</span>
                </div>
              </div>

              <div v-if="entry.deliveryDetails.length > 0 && entry.dockModules.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.build') || 'Build' }}</div>
                <div v-for="dm in entry.dockModules" :key="`${entry.id}-dock-${dm.name}`" class="detail-row">
                  <span>{{ dm.name }}</span>
                  <span>×{{ dm.count }}</span>
                </div>
                <div class="detail-row">
                  <span>{{ t('terraforming.buildSlots') || 'Build Slots' }}</span>
                  <span>×{{ entry.totalSlots }}</span>
                </div>
                <div v-if="getTotalBuildTime(entry) > 0 || entry.projectDuration > 0" class="detail-row">
                  <span>{{ t('terraforming.buildTime') }}</span>
                  <span>{{ formatTime(getTotalBuildTime(entry)) }}</span>
                </div>
                <div v-if="entry.projectDuration > 0" class="detail-row">
                  <span>{{ t('terraforming.executionTime') }}</span>
                  <span>{{ formatTime(entry.projectDuration) }}</span>
                </div>
                <div v-if="entry.projectDuration > 0 && getTotalBuildTime(entry) > 0" class="detail-row">
                  <span>{{ t('terraforming.totalDuration') }}</span>
                  <span>{{ formatTime(getTotalBuildTime(entry) + entry.projectDuration) }}</span>
                </div>
              </div>

              <div v-if="entry.statLines.length > 0 || entry.rebateChanges.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.statChanges') }}</div>
                <TerraformingStatScale
                  v-for="line in entry.statLines"
                  :key="`${entry.id}-stat-${line.statId}`"
                  :model="line"
                  compact
                  mode="impact"
                  @click-stat="emit('clickStat', $event)"
                />
                <div
                  v-for="(rc, i) in entry.rebateChanges"
                  :key="`${entry.id}-rc-${i}`"
                  class="detail-row text-emerald-400"
                >
                  <span>{{ t('terraforming.discount') || '折扣' }}: {{ rc.name }}</span>
                  <span>{{ rc.before }}% → {{ rc.after }}%</span>
                </div>
              </div>

              <div v-if="entry.blockedReason" class="detail-section">
                <div class="section-title">{{ t('terraforming.executionStatus') }}</div>
                <div class="detail-text">{{ entry.blockedReason }}</div>
              </div>

            </div>
          </div>
        </template>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-card.panel-floating {
  @apply flex flex-col;
  max-height: var(--panel-max-h, calc(100vh - 8rem));
}

.panel-card.panel-floating .panel-header {
  @apply sticky top-0 z-10;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0;
}

.panel-content {
  @apply p-3 flex flex-col gap-2;
}

.panel-floating .panel-content {
  @apply flex-1 min-h-0 overflow-y-auto;
}

.panel-floating .panel-content::-webkit-scrollbar { width: 6px; }
.panel-floating .panel-content::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
.panel-floating .panel-content::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 3px; }
.panel-floating .panel-content::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 1); }

	.clear-all-btn {
	  @apply ml-auto text-[11px] px-2 py-1 rounded border border-red-800 text-red-300 bg-red-900/20 transition-colors;
	  @apply hover:bg-red-800/40 hover:border-red-700;
	}

	.import-btn {
	  @apply ml-auto text-[11px] px-2 py-1 rounded border border-amber-800 text-amber-300 bg-amber-950/20 transition-colors;
	  @apply hover:bg-amber-900/40 hover:border-amber-700;
	}

	.import-btn + .clear-all-btn {
	  @apply ml-2;
	}

.edit-actions-group {
  @apply ml-auto flex gap-2;
}

.edit-action-btn {
  @apply ml-2 text-[11px] px-2 py-1 rounded border border-slate-600 text-slate-200 bg-slate-800/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}

.edit-action-btn.complete {
  @apply border-emerald-700 text-emerald-300 bg-emerald-950/30;
}

.panel-content {
  @apply p-3 flex flex-col gap-2;
}

.empty-state {
  @apply text-slate-500 text-sm text-center py-6;
}

	.timeline-list {
	  @apply flex flex-col gap-2;
	}

	.task-log-tabs {
	  @apply flex gap-1 rounded border border-slate-700/60 bg-slate-950/40 p-1;
	}

	.task-log-tab {
	  @apply flex-1 rounded px-2 py-1 text-xs text-slate-400 transition-colors;
	  @apply hover:bg-slate-800/60 hover:text-slate-200;
	}

	.task-log-tab.active {
	  @apply bg-sky-900/40 text-sky-200 border border-sky-700/50;
	}

	.archive-sync-notice {
	  @apply flex items-center gap-2 rounded border border-sky-800/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-200;
	}

	.archive-sync-notice.warning {
	  @apply border-amber-700/70 bg-amber-950/30 text-amber-200;
	}

	.notice-main {
	  @apply flex flex-col gap-0.5 flex-1 min-w-0;
	}

	.notice-confirm-btn {
	  @apply shrink-0 rounded border border-sky-700 bg-sky-900/50 px-2 py-1 text-[11px] text-sky-100 disabled:opacity-40 disabled:cursor-not-allowed;
	}

	.executed-item {
	  @apply border-emerald-800/40 bg-emerald-950/10;
	}

	.executed-tag {
	  @apply shrink-0 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300;
	}

.executed-tag.archive {
  @apply bg-slate-800 text-slate-300;
}

.archive-consumed-row {
  @apply grid grid-cols-[1fr_auto] gap-3 text-xs text-slate-300 py-1;
}

.group-marker {
  @apply text-[11px] font-semibold text-sky-300 px-1 pt-1;
}

.timeline-item {
  @apply border border-slate-700/40 rounded bg-slate-950/40 overflow-hidden;
}

.bulk-edit-card {
  @apply bg-slate-950/40 border border-slate-700 rounded-lg p-2 flex gap-2 justify-end;
}

.draft-item.system-disabled {
  @apply opacity-60 border-red-700/50;
}

/* Goal entry styles */
.goal-entry {
  @apply border border-amber-700/50 rounded-lg bg-amber-950/20 px-3 py-2 cursor-pointer transition-colors;
  @apply hover:bg-amber-950/40 hover:border-amber-600/60;
}

.goal-entry.goal-filter-active {
  @apply border-sky-500/80 bg-sky-950/30 ring-1 ring-sky-400/30;
}

.goal-entry.goal-satisfied {
  @apply border-emerald-700/50 bg-emerald-950/20;
}

.goal-entry.goal-has-risk {
  @apply border-red-700/60;
}

.goal-entry.goal-has-task {
  @apply border-sky-600/60 bg-sky-950/30 cursor-default;
}

.goal-move-btn {
  @apply ml-auto text-xs px-2 py-0.5 rounded bg-sky-800 text-sky-200 border border-sky-700 hover:bg-sky-700 transition-colors;
}

.goal-hint-text {
  @apply text-[10px] text-sky-400 mt-1;
}

.goal-head {
  @apply flex items-center gap-2;
}

.goal-icon {
  @apply text-xs;
}

.goal-label {
  @apply text-xs text-amber-200 font-medium;
}

.goal-goal-entry.goal-satisfied .goal-label {
  @apply text-emerald-300;
}

.goal-kind-tag {
  @apply text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300;
}

.goal-status {
  @apply ml-auto text-xs;
}

.goal-status.done {
  @apply text-emerald-400;
}

.goal-status.pending {
  @apply text-amber-400;
}

.goal-stat-display {
  @apply mt-1;
}

.goal-stat-text {
  @apply text-xs text-slate-300;
}

.goal-risk-text {
  @apply text-[11px] text-red-300 mt-1;
}

.draft-actions {
  @apply flex items-center gap-1;
}

.draft-btn {
  @apply text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700;
}

.draft-btn.danger {
  @apply border-red-800 text-red-300 bg-red-950/30;
}

.draft-item.enabled-invalid {
  @apply border-red-700/70 bg-red-950/20;
}

.draft-item.disabled {
  @apply opacity-60;
}

.drag-ghost {
  @apply opacity-30 bg-slate-700 border-sky-500 border-dashed border-2;
}

/* Hide default SortableJS ghost; Vue renders preview via computed displayPlanEntries */
:deep(.sortable-ghost) {
  display: none !important;
}
:deep(.sortable-fallback) {
  display: none !important;
}

.drag-preview-entry {
  @apply border-2 border-dashed border-sky-500/80 bg-sky-950/20 rounded overflow-hidden;
}

.drag-preview-entry .timeline-head {
  @apply px-2 py-2 gap-2;
}

.preview-drag-handle {
  @apply w-3 shrink-0 text-center;
}

.drag-preview-entry .entry-name {
  @apply text-slate-100;
}

.draggable-container {
  @apply space-y-2;
}

.drag-handle {
  @apply text-slate-500 cursor-grab;
}

.drag-placeholder {
  @apply inline-block w-3.5 text-center cursor-default;
}

.draft-state {
  @apply text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300;
}

.draft-actions {
  @apply flex items-center gap-1;
}

.draft-btn {
  @apply text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700;
}

.draft-btn.danger {
  @apply border-red-800 text-red-300 bg-red-950/30;
}

.timeline-head {
  @apply flex items-center gap-2 px-2 py-2;
}

.timeline-main {
  @apply flex items-center gap-2 flex-1 text-left min-w-0;
}

.expand-icon {
  @apply text-[10px] text-slate-500 w-3 shrink-0;
}

.entry-order {
  @apply text-[11px] text-slate-400 font-mono shrink-0;
}

.entry-name {
  @apply text-xs text-slate-200 truncate;
}

.entry-price {
  @apply text-[11px] text-slate-500 shrink-0 mr-1;
}

.entry-info-icon {
  @apply text-[11px] text-slate-600 shrink-0 cursor-help hover:text-slate-400 mr-1;
}

.cancel-btn {
  @apply text-[11px] px-2 py-1 rounded border border-slate-600 text-slate-200 transition-colors;
  @apply hover:bg-slate-800/60;
}

.cancel-btn.disabled {
  @apply opacity-40 cursor-not-allowed hover:bg-transparent;
}

.timeline-body {
  @apply border-t border-slate-700/40 px-3 py-3 bg-slate-950/60 flex flex-col gap-3;
}

.detail-section {
  @apply flex flex-col gap-1;
}

.section-title {
  @apply text-[11px] font-semibold text-slate-400;
}

.detail-row {
  @apply flex items-center justify-between gap-3 text-xs text-slate-300;
}

.detail-row .col-name { @apply flex-1 min-w-0; }
.detail-row .col-qty { @apply w-16 text-right; }
.detail-row .col-discount { @apply w-16 text-right text-amber-400; }
.detail-row .col-consumed { @apply w-16 text-right; }
.detail-row.detail-header { @apply text-slate-500 text-[11px]; }
.detail-row.detail-separator {
  @apply border-t border-slate-700/40 my-1;
  height: 0;
  padding: 0;
}

.detail-row.detail-total-sep {}

.detail-row.volume-row {
  @apply mt-0;
}

.detail-section .volume-row + .volume-row {
  @apply -mt-0.5;
}

.detail-text {
  @apply text-xs text-slate-300;
}

.rebate-dot {
  @apply text-emerald-400 mr-1 shrink-0;
}

.auto-event-entry {
  @apply opacity-80;
}

.auto-event-entry .event-head {
  @apply flex items-center gap-2;
}

	.event-tag {
	  @apply text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium;
	}

	.progress-tag {
	  @apply text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium;
	}

.auto-event-entry .event-drag-placeholder {
  @apply inline-block w-3.5 text-center opacity-30 cursor-default;
}

.goal-preventive {
  @apply border-l-4 border-amber-500/60;
}

.goal-kind-tag-preventive {
  @apply bg-amber-500/20 text-amber-400;
}
</style>

<style>
.tooltip-ware-disc {
  @apply text-amber-400 ml-1;
}

.tooltip-ware-amount {
  @apply ml-auto;
}
</style>

<style>
body.terraforming-task-dragging .sortable-ghost,
body.terraforming-task-dragging .sortable-fallback,
body.terraforming-task-dragging .sortable-drag,
body.terraforming-task-dragging .drag-ghost:not(.drag-preview-entry) {
  display: none !important;
}
</style>
