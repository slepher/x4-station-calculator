<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  currentCount: number
  targetCount: number
  recommendedCount: number
  scaleMaxCount: number
}>()

function toPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

const currentWidth = computed(() => toPercent(props.currentCount, props.scaleMaxCount))
const targetWidth = computed(() => toPercent(props.targetCount, props.scaleMaxCount))
const recommendedLeft = computed(() => toPercent(props.recommendedCount, props.scaleMaxCount))
</script>

<template>
  <div class="allocation-row">
    <div class="allocation-name" :title="name">{{ name }}</div>
    <div class="allocation-bar-shell">
      <div class="allocation-bar-target" :style="{ width: `${targetWidth}%` }"></div>
      <div class="allocation-bar-current" :style="{ width: `${currentWidth}%` }"></div>
      <div class="allocation-bar-recommended" :style="{ left: `${recommendedLeft}%` }"></div>
    </div>
    <div class="allocation-values">
      <span class="allocation-current">{{ currentCount }}</span>
      <span class="allocation-separator">/</span>
      <span class="allocation-target">{{ targetCount }}</span>
      <span class="allocation-separator">/</span>
      <span class="allocation-recommended">{{ recommendedCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.allocation-row {
  @apply grid items-center gap-3 py-2;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
}

.allocation-name {
  @apply text-sm text-slate-200 truncate;
}

.allocation-bar-shell {
  @apply relative h-3 rounded-full bg-slate-800 overflow-hidden border border-slate-700/70;
}

.allocation-bar-target {
  @apply absolute left-0 top-0 h-full rounded-full bg-sky-900/80;
}

.allocation-bar-current {
  @apply absolute left-0 top-0 h-full rounded-full bg-cyan-400/85;
}

.allocation-bar-recommended {
  @apply absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-amber-300;
}

.allocation-values {
  @apply text-xs font-mono text-slate-300 whitespace-nowrap;
}

.allocation-current {
  @apply text-cyan-300;
}

.allocation-target {
  @apply text-sky-300;
}

.allocation-recommended {
  @apply text-amber-300;
}

.allocation-separator {
  @apply mx-1 text-slate-500;
}
</style>
