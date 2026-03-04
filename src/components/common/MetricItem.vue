<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  metricKey: string
  label: string
  unit?: string
  currentValue?: number
  targetValue?: number
  max?: number
  roundedKeys?: string[]
}>(), {
  unit: '',
  max: 0,
  roundedKeys: () => []
})

const roundedKeySet = computed(() => new Set(props.roundedKeys))

const normalize = (value: number) => {
  if (roundedKeySet.value.has(props.metricKey)) return Math.round(value)
  return value
}

const hasCurrent = computed(() => props.currentValue !== undefined)
const hasTarget = computed(() => props.targetValue !== undefined)

const displayValue = computed(() => {
  if (hasTarget.value) return props.targetValue
  if (hasCurrent.value) return props.currentValue
  return undefined
})

const diffValue = computed(() => {
  if (!hasCurrent.value || !hasTarget.value) return undefined
  const current = normalize(props.currentValue as number)
  const target = normalize(props.targetValue as number)
  return target - current
})

const formattedValue = (value: number | undefined): string => {
  if (value === undefined) return '--'
  return normalize(value).toLocaleString()
}

const displayText = computed(() => {
  if (displayValue.value === undefined) return '--'
  if (diffValue.value === undefined || diffValue.value === 0) {
    return formattedValue(displayValue.value)
  }
  const sign = diffValue.value > 0 ? '+' : ''
  return `${formattedValue(displayValue.value)}(${sign}${formattedValue(diffValue.value)})`
})

const valueClass = computed(() => {
  if (diffValue.value === undefined || diffValue.value === 0) return 'diff-neutral'
  if (diffValue.value > 0) return 'diff-positive'
  return 'diff-negative'
})

const toPercent = (value: number, max: number | undefined): number => {
  if (!max || max <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

const singlePercent = computed(() => {
  if (displayValue.value === undefined) return 0
  return toPercent(displayValue.value, props.max)
})

const basePercent = computed(() => {
  if (!hasCurrent.value || !hasTarget.value) return singlePercent.value
  return toPercent(Math.min(props.currentValue as number, props.targetValue as number), props.max)
})

const diffPercent = computed(() => {
  if (!hasCurrent.value || !hasTarget.value) return 0
  return toPercent(Math.abs((props.targetValue as number) - (props.currentValue as number)), props.max)
})

const diffStartPercent = computed(() => {
  if (!hasCurrent.value || !hasTarget.value) return 0
  return toPercent(Math.min(props.currentValue as number, props.targetValue as number), props.max)
})
</script>

<template>
  <div class="metric-row" :data-testid="`metric-item-${metricKey}`">
    <span class="metric-label" :data-testid="`metric-label-${metricKey}`">{{ label }}</span>
    <span class="metric-value" :data-testid="`metric-value-${metricKey}`">
      <span :class="valueClass">{{ displayText }}</span>
      <span v-if="unit" class="metric-unit" :data-testid="`metric-unit-${metricKey}`">{{ unit }}</span>
    </span>

    <div class="metric-bar" :data-testid="`metric-bar-${metricKey}`">
      <template v-if="diffValue === undefined || diffValue === 0">
        <div class="metric-bar-fill metric-bar-neutral" :style="{ width: `${singlePercent}%` }"></div>
      </template>
      <template v-else>
        <div class="metric-bar-fill metric-bar-neutral" :style="{ width: `${basePercent}%` }"></div>
        <div
          class="metric-bar-fill"
          :class="diffValue > 0 ? 'metric-bar-positive' : 'metric-bar-negative'"
          :style="{ width: `${diffPercent}%`, left: `${diffStartPercent}%` }"
        ></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.metric-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.5rem;
  row-gap: 0.25rem;
}

.metric-label {
  @apply text-xs text-slate-300 truncate;
}

.metric-value {
  @apply text-xs tabular-nums;
}

.metric-unit {
  @apply text-[10px] text-slate-400 ml-1;
}

.diff-positive {
  @apply text-blue-400;
}

.diff-negative {
  @apply text-pink-400;
}

.diff-neutral {
  @apply text-emerald-300;
}

.metric-bar {
  grid-column: 1 / -1;
  @apply bg-slate-800 rounded-sm overflow-hidden border border-slate-700/70;
  height: 8px;
  position: relative;
}

.metric-bar-fill {
  @apply absolute h-full;
}

.metric-bar-neutral {
  @apply bg-emerald-500/80;
  left: 0;
  z-index: 1;
}

.metric-bar-positive {
  @apply bg-blue-500/80;
  z-index: 2;
}

.metric-bar-negative {
  @apply bg-pink-500/80;
  z-index: 2;
}
</style>
