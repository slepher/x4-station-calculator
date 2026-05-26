<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import type {
  TerraformingCancelValidation,
  TerraformingDraftTimelineEntry,
  TerraformingExecutionTimelineEntry,
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
    invalidCount: number
    draftEntries: TerraformingDraftTimelineEntry[]
  }
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
  deliveryShipMap: Map<string, DeliveryShip>
  hqBuildDocks: { totalSlots: number } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancelExecution', entryId: string): void
  (e: 'clearAll'): void
  (e: 'startEdit'): void
  (e: 'cancelEdit'): void
  (e: 'completeEdit'): void
  (e: 'setDraftEnabled', entryId: string, enabled: boolean): void
  (e: 'deleteDraft', entryId: string): void
  (e: 'copyDraft', entryId: string): void
  (e: 'updateDraftEntries', entries: TerraformingDraftTimelineEntry[]): void
  (e: 'disableAllDraft'): void
  (e: 'enableAllDraft'): void
}>()

const { t } = useI18n()
const { translateWare } = useX4I18n()
const gameDataStore = useGameDataStore()
const expandedEntryId = ref<string | null>(null)
const cancelValidationCache = ref<Record<string, TerraformingCancelValidation>>({})
const internalDraftEntries = computed({
  get: () => props.queueEditState.draftEntries,
  set: (val: TerraformingDraftTimelineEntry[]) => emit('updateDraftEntries', val),
})

watch(() => props.executionTimeline, () => {
  cancelValidationCache.value = {}
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
  <div class="panel-card">
    <div class="panel-header">
      {{ t('terraforming.taskQueue') }}
      <span v-if="showNoDockWarning" class="text-amber-400 text-[11px] ml-2">⚠ {{ t('terraforming.noBuildDock') }}</span>
      <span v-if="queueEditState.editing && queueEditState.invalidCount > 0" class="text-red-400 text-[11px] ml-2">
        {{ queueEditState.invalidCount }} {{ t('terraforming.invalidTasks') || 'invalid' }}
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
    <div class="panel-content">
      <div v-if="!selectedClusterId" class="empty-state">
        {{ t('terraforming.selectClusterForResources') }}
      </div>

      <div v-else-if="queueEditState.editing" class="timeline-list">
        <div class="bulk-edit-card">
          <button class="draft-btn" @click="emit('disableAllDraft')">{{ t('terraforming.disableAll') || 'Disable all' }}</button>
          <button class="draft-btn" @click="emit('enableAllDraft')">{{ t('terraforming.enableAll') || 'Enable all' }}</button>
        </div>

        <div v-if="queueEditState.draftEntries.length === 0" class="empty-state">
          {{ t('terraforming.noExecutionTimeline') }}
        </div>

        <draggable
          v-else
          v-model="internalDraftEntries"
          item-key="id"
          ghost-class="drag-ghost"
          handle=".drag-handle"
          class="draggable-container"
        >
          <template #item="{ element }">
            <div class="timeline-item draft-item" :class="[element.state]">
              <div class="timeline-head">
                <button class="timeline-main" @click="toggleEntry(element.id)">
                  <span class="drag-handle">↕</span>
                  <span class="entry-order">#{{ element.order }}</span>
                  <span class="entry-name">{{ element.projectName }}</span>
                  <span class="draft-state">{{ t(`terraforming.queueState.${element.state}`) || element.state }}</span>
                </button>
                <div class="draft-actions">
                  <button
                    v-if="element.repeatRole === 'duplicate'"
                    class="draft-btn danger"
                    @click="emit('deleteDraft', element.id)"
                  >
                    {{ t('terraforming.undo') }}
                  </button>
                  <button
                    v-else
                    class="draft-btn"
                    @click="emit('setDraftEnabled', element.id, !element.enabled)"
                  >
                    {{ element.enabled ? (t('terraforming.disable') || 'Disable') : (t('terraforming.enable') || 'Enable') }}
                  </button>
                  <button
                    v-if="element.repeatRole !== 'single'"
                    class="draft-btn"
                    @click="emit('copyDraft', element.id)"
                  >
                    {{ t('terraforming.copy') || 'Copy' }}
                  </button>
                </div>
              </div>
              <div
                v-if="element.dependencies.length > 0 || element.statLines.length > 0 || element.reasons.length > 0"
                class="timeline-body draft-body"
              >
                <div v-if="element.dependencies.length > 0" class="detail-section">
                  <div class="section-title">{{ t('terraforming.depends') }}</div>
                  <div v-for="dep in element.dependencies" :key="`${element.id}-${dep}`" class="detail-text">{{ dep }}</div>
                </div>
                <div v-if="element.statLines.length > 0" class="detail-section">
                  <div class="section-title">{{ t('terraforming.statChanges') }}</div>
                  <TerraformingStatScale
                    v-for="line in element.statLines"
                    :key="`${element.id}-draft-stat-${line.statId}`"
                    :model="line"
                    compact
                    mode="impact"
                  />
                </div>
                <div v-if="element.reasons.length > 0" class="detail-section">
                  <div class="section-title">{{ t('terraforming.invalidReason') || 'Invalid reason' }}</div>
                  <div v-for="reason in element.reasons" :key="`${element.id}-${reason}`" class="detail-text text-red-300">{{ reason }}</div>
                </div>
              </div>
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
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

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

.draft-item.enabled-valid {
  @apply border-emerald-700/50;
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
