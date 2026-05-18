<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LiveVolumeAllocationDetailRow } from '@/types/production-workbench-contract'

const props = defineProps<{
  name: string
  currentCount: number
  targetCount: number
  recommendedCount: number
  scaleMaxCount: number
  detailRows: LiveVolumeAllocationDetailRow[]
}>()

const { t } = useI18n()

const isOpen = ref(false)

function toPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatMinutes(totalMinutes: number): string {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes))
  const days = Math.floor(roundedMinutes / 1440)
  const hours = Math.floor((roundedMinutes % 1440) / 60)
  const minutes = roundedMinutes % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const targetWidth = computed(() => toPercent(props.targetCount, props.scaleMaxCount))
const currentWidth = computed(() => toPercent(props.currentCount, props.scaleMaxCount))
const recommendedLeft = computed(() => toPercent(props.recommendedCount, props.scaleMaxCount))
const isExpandable = computed(() => props.detailRows.length > 0)
</script>

<template>
  <div class="item-container">
    <div
      :class="[
        'main-row',
        isExpandable ? 'main-row-hover cursor-pointer' : 'cursor-default',
        { 'is-active': isOpen && isExpandable }
      ]"
      @click="isExpandable && (isOpen = !isOpen)"
    >
      <div class="label-group">
        <span class="arrow" :class="{ 'arrow-open': isOpen }" v-if="isExpandable" aria-hidden="true">
          <svg viewBox="0 0 12 12" class="arrow-icon">
            <path d="M3 2.5L9 6L3 9.5V2.5Z" fill="currentColor" />
          </svg>
        </span>
        <span class="header-name" :title="name">{{ name }}</span>
      </div>

      <div class="bar-shell">
        <div class="bar-target" :style="{ width: `${targetWidth}%` }"></div>
        <div class="bar-current" :style="{ width: `${currentWidth}%` }"></div>
        <div class="bar-recommended" :style="{ left: `${recommendedLeft}%` }"></div>
        <div class="bar-text">
          <span class="bar-current-text">{{ formatCount(currentCount) }}</span>
          <span class="bar-separator">/</span>
          <span class="bar-target-text">{{ formatCount(targetCount) }}</span>
        </div>
      </div>

      <div class="recommended-block" :title="t('wareflow.allocation_rec')">
        <span class="recommended-count">{{ formatCount(recommendedCount) }}</span>
        <svg class="recommended-icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/>
          <path d="M12 22V12"/>
        </svg>
      </div>
    </div>

    <Transition name="expand">
      <div v-if="isOpen && isExpandable" class="list-box">
        <div class="detail-head">
          <span class="detail-head-label">{{ t('wareflow.allocation_detail_metric') }}</span>
          <span class="detail-head-col">{{ t('wareflow.allocation_target_column') }}</span>
          <span class="detail-head-col">{{ t('wareflow.allocation_recommended_column') }}</span>
        </div>
        <div
          v-for="row in detailRows"
          :key="row.key"
          class="list-item detail-row"
        >
          <span class="detail-label">{{ row.label }}</span>
          <span class="detail-value">
            <template v-if="row.targetMinutes !== undefined">{{ formatMinutes(row.targetMinutes) }}</template>
          </span>
          <span class="detail-value">
            <template v-if="row.recommendedMinutes !== undefined">{{ formatMinutes(row.recommendedMinutes) }}</template>
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.item-container { @apply mb-1 select-none; }
.main-row {
  @apply grid items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded transition-colors border border-transparent gap-3;
  grid-template-columns: minmax(0, 1fr) minmax(13rem, 22rem) 4.5rem;
}
.main-row-hover { @apply hover:bg-slate-700/50; }
.is-active { @apply border-slate-600/50 bg-slate-700/40; }

.arrow { @apply inline-flex items-center justify-center text-slate-500 transition-transform duration-200; }
.arrow-icon { @apply w-2.5 h-2.5; }
.arrow-open { @apply rotate-90 text-slate-300; }

.label-group { @apply flex items-center gap-2 min-w-0; }
.header-name { @apply text-sm text-slate-200 truncate; }

.bar-shell { @apply relative h-4 rounded bg-slate-950/80 border border-slate-700/40 overflow-hidden; }
.bar-target { @apply absolute left-0 top-0 h-full bg-sky-900/80; }
.bar-current { @apply absolute left-0 top-0 h-full bg-cyan-400/80; }
.bar-recommended { @apply absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-amber-300; }
.bar-text { @apply absolute inset-0 flex items-center justify-center gap-1 text-[11px] font-mono leading-none pointer-events-none; }
.bar-current-text { @apply text-cyan-100; }
.bar-target-text { @apply text-sky-100; }
.bar-separator { @apply text-slate-300; }

.recommended-block { @apply flex items-center justify-end gap-1 text-amber-300 font-mono text-sm; }
.recommended-count { @apply leading-none; }
.recommended-icon { @apply w-3.5 h-3.5 shrink-0; }

.list-box { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }
.detail-head { @apply grid gap-3 items-center pb-1.5 mb-1 border-b border-slate-700/30 text-slate-400 uppercase tracking-wide; grid-template-columns: minmax(0, 1fr) 6.5rem 6.5rem; }
.detail-head-label { @apply text-left; }
.detail-head-col { @apply text-right; }
.list-item { @apply py-1.5 border-b border-slate-700/20 last:border-0; }
.detail-row { @apply grid gap-3 items-center; grid-template-columns: minmax(0, 1fr) 6.5rem 6.5rem; }
.detail-label { @apply text-slate-300 truncate; }
.detail-value { @apply text-right text-slate-200 font-mono; }

.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 1000px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
</style>
