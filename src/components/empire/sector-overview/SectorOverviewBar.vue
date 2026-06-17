<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
  needsRecalc?: boolean
  editDisabled?: boolean
}>(), {
  needsRecalc: false,
  editDisabled: true
})

const emit = defineEmits<{
  (e: 'detail'): void
  (e: 'map'): void
}>()

const { t } = useI18n()

const thresholdOptions = [
  { label: '1M', value: 1_000_000 },
  { label: '3M', value: 3_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '20M', value: 20_000_000 }
]

function getThresholdLabel(value: number): string {
  return thresholdOptions.find((opt) => opt.value === value)?.label || String(value)
}
</script>

<template>
  <div class="overview-bar">
    <div class="bar-row">
      <div class="bar-left">
        <div class="param-field" :title="t('sector.bridge_search_jump')">
          <span class="bar-label">{{ t('sector.bridge_search_jump_short') }}</span>
          <span class="bar-value">{{ bridgeSearchJumpRange }}{{ t('sector.jump_unit') }}</span>
        </div>

        <div class="param-field" :title="t('sector.group_coverage_jump')">
          <span class="bar-label">{{ t('sector.group_coverage_jump_short') }}</span>
          <span class="bar-value">{{ prefJumpRange }}{{ t('sector.jump_unit') }}</span>
        </div>

        <div class="param-field" :title="t('sector.default_threshold')">
          <span class="bar-label">{{ t('sector.trade_station_short') }}</span>
          <span class="bar-value">{{ getThresholdLabel(prefThreshold) }}{{ t('sector.volume_unit_m3') }}</span>
        </div>
      </div>

      <div class="bar-right">
        <button class="bar-btn detail-btn" :disabled="editDisabled" @click="emit('detail')">
          {{ t('sector.detail') }}
        </button>
        <button class="bar-btn calc-hint-btn" :class="{ 'calc-hint-btn--needs-recalc': needsRecalc }" @click="emit('map')">
          <span v-if="needsRecalc" class="recalc-dot" />
          {{ t('sector.map') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-bar {
  @apply flex flex-col gap-2 p-1.5 bg-slate-800/50 rounded border border-slate-700/50 mb-3;
}

.bar-row {
  @apply flex items-center justify-between;
}

.bar-left {
  @apply flex flex-wrap items-center gap-1.5;
}

.param-field {
  @apply inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-900/30 px-1.5 py-1;
}

.bar-label {
  @apply text-xs text-slate-400;
}

.bar-value {
  @apply min-w-5 text-center text-xs font-medium text-slate-200;
}

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.detail-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30 disabled:opacity-40 disabled:cursor-not-allowed;
}

.calc-hint-btn {
  @apply bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 relative;
}

.calc-hint-btn--needs-recalc {
  @apply border-red-500/50;
}

.recalc-dot {
  @apply absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full;
}

.bar-right {
  @apply flex items-center gap-1.5;
}
</style>
