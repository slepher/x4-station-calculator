<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  currentCount: number
  targetCount: number
}>()

function toPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

const scaleMaxCount = computed(() => Math.max(props.currentCount, props.targetCount))
const targetWidth = computed(() => toPercent(props.targetCount, scaleMaxCount.value))
const currentWidth = computed(() => toPercent(props.currentCount, scaleMaxCount.value))
</script>

<template>
  <div class="item-container">
    <div class="main-row">
      <div class="label-group">
        <span class="header-name" :title="name">{{ name }}</span>
      </div>
      <div class="bar-shell">
        <div class="bar-target" :style="{ width: `${targetWidth}%` }"></div>
        <div class="bar-current" :style="{ width: `${currentWidth}%` }"></div>
        <div class="bar-text">
          <span class="bar-current-text">{{ formatCount(currentCount) }}</span>
          <span class="bar-separator">/</span>
          <span class="bar-target-text">{{ formatCount(targetCount) }}</span>
        </div>
      </div>
      <div class="recommended-block"></div>
    </div>
  </div>
</template>

<style scoped>
.item-container { @apply mb-1 select-none; }
.main-row {
  @apply grid items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded transition-colors border border-transparent gap-3;
  grid-template-columns: minmax(0, 1fr) minmax(13rem, 22rem) 4.5rem;
}
.label-group { @apply flex items-center gap-2 min-w-0; }
.header-name { @apply text-sm text-slate-300 truncate; }
.bar-shell { @apply relative h-4 rounded bg-slate-950/60 border border-slate-700/40 overflow-hidden; }
.bar-target { @apply absolute left-0 top-0 h-full bg-sky-900/80; }
.bar-current { @apply absolute left-0 top-0 h-full bg-cyan-400/80; }
.bar-text { @apply absolute inset-0 flex items-center justify-center gap-1 text-[11px] font-mono leading-none; }
.bar-current-text { @apply text-cyan-100; }
.bar-target-text { @apply text-sky-100; }
.bar-separator { @apply text-slate-300; }
.recommended-block { @apply w-[4.5rem]; }
</style>
