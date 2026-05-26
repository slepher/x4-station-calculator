<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  TerraformingCancelValidation,
  TerraformingExecutionTimelineEntry,
} from '@/components/empire/presenters/useTerraformingPresenter'
import type { DeliveryShip } from '@/store/logic/terraformingTaskResolver'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

interface Props {
  selectedClusterId: string | null
  executionTimeline: TerraformingExecutionTimelineEntry[]
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
  deliveryShipMap: Map<string, DeliveryShip>
  hqBuildDocks: { totalSlots: number } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancelExecution', entryId: string): void
  (e: 'clearAll'): void
}>()

const { t } = useI18n()
const { translateWare } = useX4I18n()
const gameDataStore = useGameDataStore()
const expandedEntryId = ref<string | null>(null)
const cancelValidationCache = ref<Record<string, TerraformingCancelValidation>>({})

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

function onClearAll() {
  if (props.executionTimeline.length === 0) return
  emit('clearAll')
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
      <button
        v-if="executionTimeline.length > 0"
        class="clear-all-btn"
        @click="onClearAll"
      >
        {{ t('terraforming.clearQueue') }}
      </button>
    </div>
    <div class="panel-content">
      <div v-if="!selectedClusterId" class="empty-state">
        {{ t('terraforming.selectClusterForResources') }}
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
                @click="onCancel(entry)"
              >
                {{ t('terraforming.undo') }}
              </button>
            </div>

            <div
              v-if="expandedEntryId === entry.id && !getValidation(entry.id).canCancel"
              class="entry-warning"
            >
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

              <div v-if="getValidation(entry.id).reasons.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.cancelImpact') }}</div>
                <div
                  v-for="reason in getValidation(entry.id).reasons"
                  :key="`${entry.id}-${reason}`"
                  class="detail-text"
                >
                  {{ reason }}
                </div>
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
