<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import type {
  TerraformingCancelValidation,
  TerraformingDraftTimelineEntry,
  TerraformingExecutionTimelineEntry,
  TerraformingGoalPlanDisplayEntry,
} from '@/components/empire/presenters/useTerraformingPresenter'
import type { DeliveryShip } from '@/store/logic/terraformingTaskResolver'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

interface Props {
  selectedClusterId: string | null
  executionTimeline: TerraformingExecutionTimelineEntry[]
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
  (e: 'dropTask', projectId: string, targetIndex?: number): void
}>()

const { t } = useI18n()
const { translateWare } = useX4I18n()
const gameDataStore = useGameDataStore()
const expandedEntryId = ref<string | null>(null)
const panelContentRef = ref<HTMLElement | null>(null)
const cancelValidationCache = ref<Record<string, TerraformingCancelValidation>>({})
const isDragOver = ref(false)
const dropTargetIndex = ref(-1)
let dragCounter = 0

function onPanelDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
  if (e.currentTarget instanceof HTMLElement) {
    const entries = e.currentTarget.querySelectorAll('.draggable-insert-target')
    let closestIdx = -1
    let closestDist = Infinity
    entries.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const dist = Math.abs(e.clientY - midY)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    })
    dropTargetIndex.value = closestIdx
  }
}

function onPanelDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  isDragOver.value = true
}

function onPanelDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragOver.value = false
  }
}

function onPanelDrop(e: DragEvent) {
  dragCounter = 0
  isDragOver.value = false
  const projectId = e.dataTransfer?.getData('terraforming-project-id')
  if (projectId) {
    const targetIdx = dropTargetIndex.value >= 0 ? dropTargetIndex.value : undefined
    emit('dropTask', projectId, targetIdx)
  }
  dropTargetIndex.value = -1
}

const internalPlanEntries = computed({
  get: () => props.queueEditState.planEntries,
  set: (val: TerraformingGoalPlanDisplayEntry[]) => {
    const tasks = val
      .filter((pe): pe is { type: 'task'; entry: TerraformingDraftTimelineEntry } => pe.type === 'task')
      .map(pe => pe.entry)
    emit('updateDraftEntries', tasks)
  },
})

function planEntryKey(pe: TerraformingGoalPlanDisplayEntry): string {
  return pe.type === 'goal' ? `goal-${pe.entry.id}` : pe.entry.id
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
  const ware = gameDataStore.waresMap[wareId] as any
  if (!ware) return wareId
  return translateWare(ware)
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
</script>

<template>
  <div class="panel-card" :class="{ 'panel-floating': floating, 'drag-target': isDragOver }">
    <div
      class="panel-header"
      :class="{ 'drag-over': isDragOver }"
    >
      <span v-if="isDragOver" class="drop-hint">↧ {{ t('terraforming.dropToEnd') || 'Drop here' }}</span>
      <span v-else>{{ t('terraforming.taskQueue') }}</span>
      <span v-if="showNoDockWarning" class="text-amber-400 text-[11px] ml-2">⚠ {{ t('terraforming.noBuildDock') }}</span>
      <span v-if="queueEditState.editing && queueEditState.unsatisfiedGoalCount > 0" class="text-red-400 text-[11px] ml-2">
        {{ queueEditState.unsatisfiedGoalCount }} {{ t('terraforming.unmetDependencies') || 'unmet dependencies' }}
      </span>
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
    <div
      ref="panelContentRef"
      class="panel-content"
      @dragover="onPanelDragOver"
      @dragenter="onPanelDragEnter"
      @dragleave="onPanelDragLeave"
      @drop="onPanelDrop"
    >
      <div v-if="isDragOver" class="drop-placeholder">
        {{ t('terraforming.dropToEnd') || 'Drop to insert task' }}
      </div>
      <div v-if="!selectedClusterId" class="empty-state">
        {{ t('terraforming.selectClusterForResources') }}
      </div>

      <div v-else-if="queueEditState.editing" class="timeline-list">
        <div v-if="showNoDockWarning" class="text-amber-400 text-[11px]">⚠ {{ t('terraforming.noBuildDock') }}</div>
        <div class="bulk-edit-card">
          <button class="draft-btn danger" @click="emit('removeAllDraft')">{{ t('terraforming.removeAll') || 'Remove all' }}</button>
        </div>

        <div v-if="queueEditState.planEntries.length === 0" class="empty-state">
          {{ t('terraforming.noExecutionTimeline') }}
        </div>

        <draggable
          v-else
          v-model="internalPlanEntries"
          :item-key="planEntryKey"
          ghost-class="drag-ghost"
          handle=".drag-handle"
          filter=".goal-entry"
          class="draggable-container"
        >
          <template #item="{ element: planEntry }">
            <div
              :class="planEntry.type === 'goal'
                ? ['goal-entry', 'draggable-insert-target', {
                    'goal-filter-active': planEntry.entry.isFilterActive,
                    'goal-satisfied': planEntry.entry.satisfied,
                    'goal-unsatisfied': !planEntry.entry.satisfied,
                    'goal-has-risk': planEntry.entry.hasRisk,
                  }]
                : ['timeline-item', 'draft-item', 'draggable-insert-target', {
                    'system-disabled': planEntry.entry.systemDisabled,
                  }]"
              @click="planEntry.type === 'goal' ? emit('clickGoal', planEntry.entry.id) : undefined"
            >
              <template v-if="planEntry.type === 'goal'">
                <div class="goal-head">
                  <span class="goal-icon">{{ planEntry.entry.kind === 'cluster' ? '🎯' : planEntry.entry.kind === 'stat' ? '📊' : '📋' }}</span>
                  <span class="goal-label">{{ planEntry.entry.label }}</span>
                  <span v-if="planEntry.entry.kind === 'cluster'" class="goal-kind-tag">{{ t('terraforming.goal.clusterGoal') || 'Cluster Goal' }}</span>
                  <span v-else-if="planEntry.entry.kind === 'stat'" class="goal-kind-tag">{{ t('terraforming.goal.statGoal') || 'Stat Goal' }}</span>
                  <span v-else class="goal-kind-tag">{{ t('terraforming.goal.projectGoal') || 'Goal' }}</span>
                  <span v-if="planEntry.entry.satisfied" class="goal-status done">✓</span>
                  <span v-else class="goal-status pending">○</span>
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

              <template v-else>
                <div class="timeline-head">
                  <button class="timeline-main" @click.stop="toggleEntry(planEntry.entry.id)">
                    <span class="drag-handle">↕</span>
                    <span class="entry-order">#{{ planEntry.entry.order }}</span>
                    <span class="entry-name">{{ planEntry.entry.projectName }}</span>
                    <span v-if="planEntry.entry.systemDisabled" class="draft-state disabled">
                      {{ t('terraforming.queueState.disabled') || 'Disabled' }}
                    </span>
                  </button>
                  <div class="draft-actions">
                    <button
                      class="draft-btn danger"
                      @click.stop="emit('removeDraft', planEntry.entry.id)"
                    >
                      {{ t('terraforming.remove') || 'Remove' }}
                    </button>
                    <button
                      v-if="planEntry.entry.repeatRole === 'duplicate'"
                      class="draft-btn"
                      @click.stop="emit('copyDraft', planEntry.entry.id)"
                    >
                      {{ t('terraforming.copy') || 'Copy' }}
                    </button>
                  </div>
                </div>
                <div
                  v-if="planEntry.entry.dependencies.length > 0 || planEntry.entry.statLines.length > 0 || planEntry.entry.reasons.length > 0"
                  class="timeline-body draft-body"
                >
                  <div v-if="planEntry.entry.dependencies.length > 0" class="detail-section">
                    <div class="section-title">{{ t('terraforming.depends') }}</div>
                    <div v-for="dep in planEntry.entry.dependencies" :key="`${planEntry.entry.id}-${dep}`" class="detail-text">{{ dep }}</div>
                  </div>
                  <div v-if="planEntry.entry.statLines.length > 0" class="detail-section">
                    <div class="section-title">{{ t('terraforming.statChanges') }}</div>
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
          </template>
        </draggable>
      </div>

      <div v-else-if="executionTimeline.length === 0" class="empty-state">
        {{ t('terraforming.noExecutionTimeline') }}
      </div>

      <div v-else class="timeline-list">
        <template v-for="entry in executionTimeline" :key="entry.id">
          <div v-if="entry.showGroupMarker" class="group-marker">
            {{ entry.projectGroupName }}
          </div>

          <div class="timeline-item">
            <div class="timeline-head">
              <button class="timeline-main" @click="toggleEntry(entry.id)">
                <span class="expand-icon">{{ expandedEntryId === entry.id ? '▼' : '▶' }}</span>
                <span class="entry-order">#{{ entry.order }}</span>
                <span class="entry-name">{{ entry.projectName }}</span>
              </button>
              <button
                class="cancel-btn"
                :class="{ disabled: !getValidation(entry.id).canCancel }"
                :disabled="!getValidation(entry.id).canCancel"
                @click="onCancel(entry)"
              >
                {{ t('terraforming.undo') }}
              </button>
            </div>

            <div v-if="!getValidation(entry.id).canCancel" class="entry-warning">
              {{ t('terraforming.cancelBlocked') }}
            </div>

            <div v-if="expandedEntryId === entry.id" class="timeline-body">
              <div v-if="entry.wares.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.materialPrice') }}</div>
                <div v-for="ware in entry.wares" :key="`${entry.id}-ware-${ware.ware}`" class="detail-row">
                  <span>{{ getWareName(ware.ware) }}</span>
                  <span>{{ (ware.actualAmount ?? ware.amount).toLocaleString() }}</span>
                </div>
                <div class="detail-row detail-total">
                  <span>{{ t('terraforming.credits') }}</span>
                  <span>{{ entry.price.toLocaleString() }} Cr</span>
                </div>
                <template v-if="getTotalVolume(entry) > 0">
                  <div v-for="[type, vol] in Object.entries(getVolumeByTransport(entry)).filter(([,v]) => v > 0)" :key="type" class="detail-row volume-row">
                    <span>{{ t(`terraforming.transport.${type}`) }}</span>
                    <span>{{ vol.toLocaleString() }} m³</span>
                  </div>
                </template>
              </div>

              <div v-if="entry.returnedWares.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.return') || 'Return' }}</div>
                <div
                  v-for="rw in entry.returnedWares"
                  :key="`${entry.id}-rtw-${rw.name}`"
                  class="detail-row text-emerald-400"
                >
                  <span>{{ rw.name }}</span>
                  <span>×{{ rw.amount.toLocaleString() }}</span>
                </div>
              </div>

              <div v-if="entry.cumulativeRebates.length > 0" class="detail-section">
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
                <div v-if="getTotalBuildTime(entry) > 0" class="detail-row">
                  <span>{{ t('terraforming.buildTime') }}</span>
                  <span>{{ formatTime(getTotalBuildTime(entry)) }}</span>
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
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden transition-colors;
}

.panel-card.drag-target {
  @apply border-sky-500/60;
}

.panel-card.panel-floating {
  @apply flex flex-col;
  max-height: var(--panel-max-h, calc(100vh - 8rem));
}

.panel-card.panel-floating .panel-header {
  @apply sticky top-0 z-10;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0 transition-colors;
}

.panel-header.drag-over {
  @apply bg-sky-900/40 border-sky-500/60;
}

.drop-hint {
  @apply text-sky-300;
}

.panel-content {
  @apply p-3 flex flex-col gap-2;
}

.drop-placeholder {
  @apply border-2 border-dashed border-sky-500/60 rounded-lg py-6 text-center;
  @apply text-sky-300 text-sm bg-sky-950/20;
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

.group-marker {
  @apply text-[11px] font-semibold text-sky-300 px-1 pt-1;
}

.timeline-item {
  @apply border border-slate-700/40 rounded bg-slate-950/40 overflow-hidden;
}

.bulk-edit-card {
  @apply bg-slate-950/40 border border-slate-700 rounded-lg p-2 flex gap-2;
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
  @apply flex gap-1;
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

.draggable-container {
  @apply space-y-2;
}

.drag-handle {
  @apply text-slate-500 cursor-grab;
}

.draft-state {
  @apply text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300;
}

.draft-actions {
  @apply flex gap-1;
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

.cancel-btn {
  @apply text-[11px] px-2 py-1 rounded border border-slate-600 text-slate-200 transition-colors;
  @apply hover:bg-slate-800/60;
}

.cancel-btn.disabled {
  @apply opacity-40 cursor-not-allowed hover:bg-transparent;
}

.entry-warning {
  @apply px-3 pb-2 text-[11px] text-amber-300;
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

.detail-row.detail-total {
  @apply border-t border-slate-700/40 pt-1 mt-0.5 text-slate-200;
}

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
</style>
