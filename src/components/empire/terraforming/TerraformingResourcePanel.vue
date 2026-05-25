<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  TerraformingCancelValidation,
  TerraformingExecutionTimelineEntry,
} from '@/components/empire/presenters/useTerraformingPresenter'

interface Props {
  selectedClusterId: string | null
  executionTimeline: TerraformingExecutionTimelineEntry[]
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancelExecution', entryId: string): void
}>()

const { t } = useI18n()
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
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('terraforming.taskQueue') }}</div>
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
              <div v-if="entry.beforeStats.length > 0 || entry.projectRebates.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.statChanges') }}</div>
                <div
                  v-for="snapshot in entry.beforeStats"
                  :key="`${entry.id}-stat-${snapshot.statId}`"
                  class="detail-row"
                >
                  <span>{{ snapshot.statName }}</span>
                  <span>{{ snapshot.beforeValue }} → {{ snapshot.afterValue }}</span>
                </div>
                <div
                  v-for="(rb, i) in entry.projectRebates"
                  :key="`${entry.id}-rebate-${i}`"
                  class="detail-row text-emerald-400"
                >
                  <span>{{ rb }}</span>
                </div>
              </div>

              <div v-if="entry.cumulativeRebates.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.cumulativeRebates') }}</div>
                <div
                  v-for="(rb, i) in entry.cumulativeRebates"
                  :key="`${entry.id}-cumulative-${i}`"
                  class="detail-row text-emerald-400"
                >
                  <span class="rebate-dot">•</span>
                  <span>{{ rb }}</span>
                </div>
              </div>

              <div v-if="entry.wares.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.resourceRequirements') }}</div>
                <div v-for="ware in entry.wares" :key="`${entry.id}-ware-${ware.ware}`" class="detail-row">
                  <span>{{ ware.ware }}</span>
                  <span>{{ ware.amount.toLocaleString() }}</span>
                </div>
              </div>

              <div class="detail-section">
                <div class="section-title">{{ t('terraforming.price') }}</div>
                <div class="detail-row">
                  <span>Credits</span>
                  <span v-if="entry.discountedPrice < entry.price">
                    <span class="original-price">{{ entry.price.toLocaleString() }}</span>
                    <span class="discounted-price"> → {{ entry.discountedPrice.toLocaleString() }}</span>
                  </span>
                  <span v-else>{{ entry.price.toLocaleString() }}</span>
                </div>
              </div>

              <div v-if="entry.deliveries.length > 0" class="detail-section">
                <div class="section-title">{{ t('terraforming.deliveryList') }}</div>
                <div
                  v-for="delivery in entry.deliveries"
                  :key="`${entry.id}-delivery-${delivery.macro}`"
                  class="detail-row"
                >
                  <span>{{ delivery.macro }}</span>
                  <span>x{{ delivery.amount }} / {{ delivery.buildDuration }}s</span>
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

.detail-text {
  @apply text-xs text-slate-300;
}

.rebate-dot {
  @apply text-emerald-400 mr-1 shrink-0;
}

.original-price {
  @apply text-slate-500 line-through;
}

.discounted-price {
  @apply text-emerald-400;
}
</style>
