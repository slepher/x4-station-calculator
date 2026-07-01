<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  mode: 'result' | 'edit'
  panelMode?: 'preview' | 'edit' | 'generate'
  view?: 'live' | 'map'
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
  nodeEnabled: boolean
  canDisableNode: boolean
  editDisabled?: boolean
  unresolvedAllocationCount?: number
  unresolvedTradeStationCount?: number
  unresolvedTitle?: string
  showConfirm?: boolean
  confirmDisabled?: boolean
}>(), {
  panelMode: 'preview',
  view: 'live',
  editDisabled: false,
  unresolvedAllocationCount: 0,
  unresolvedTradeStationCount: 0,
  unresolvedTitle: '',
  showConfirm: true,
  confirmDisabled: false
})

const emit = defineEmits<{
  (e: 'update:prefJumpRange', value: number): void
  (e: 'update:bridgeSearchJumpRange', value: number): void
  (e: 'update:prefThreshold', value: number): void
  (e: 'update:nodeEnabled', value: boolean): void
  (e: 'calculate'): void
  (e: 'quick-calculate'): void
  (e: 'reset'): void
  (e: 'confirm'): void
  (e: 'map'): void
  (e: 'update:panelMode', value: 'preview' | 'edit' | 'generate'): void
}>()

const { t } = useI18n()

const hasUnresolved = computed(() => (props.unresolvedAllocationCount ?? 0) + (props.unresolvedTradeStationCount ?? 0) > 0)

function updatePanelMode(mode: 'preview' | 'edit' | 'generate') {
  if (mode === 'edit' && props.editDisabled) return
  emit('update:panelMode', mode)
}
</script>

<template>
  <div class="auto-sector-bar" :class="{ 'auto-sector-bar--map': view === 'map' }">
    <div class="bar-row" :class="view === 'map' ? 'bar-row--map' : 'bar-row--live'">
      <div class="bar-left">
        <div class="mode-switch" :aria-label="t('sector.mode')">
          <button type="button" class="mode-btn" :class="{ active: panelMode === 'preview' }" @click="updatePanelMode('preview')">{{ t('sector.preview') }}</button>
          <button type="button" class="mode-btn" :class="{ active: panelMode === 'edit' }" :disabled="editDisabled" @click="updatePanelMode('edit')">{{ t('sector.edit') }}</button>
          <button type="button" class="mode-btn" :class="{ active: panelMode === 'generate' }" @click="updatePanelMode('generate')">{{ t('sector.generate') }}</button>
        </div>
      </div>
      <div class="bar-right">
        <span v-if="hasUnresolved" class="bar-unresolved" v-tippy="{ content: unresolvedTitle, allowHTML: true, placement: 'top', theme: 'material' }">
          {{ t('sector.unresolved') }}<template v-if="unresolvedAllocationCount">&nbsp;◈{{ unresolvedAllocationCount }}</template><template v-if="unresolvedTradeStationCount">&nbsp;◉{{ unresolvedTradeStationCount }}</template>
        </span>
        <button v-if="view !== 'map'" class="bar-btn map-btn" @click="emit('map')">{{ t('sector.map') }}</button>
        <button class="bar-btn reset-btn" @click="emit('reset')">{{ t('sector.reset') }}</button>
        <button v-if="showConfirm" class="bar-btn confirm-btn" :disabled="confirmDisabled" @click="emit('confirm')">{{ t('sector.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auto-sector-bar {
  @apply flex flex-col gap-2 p-1.5 bg-slate-800/50 rounded border border-slate-700/50;
}

.auto-sector-bar--map {
  @apply gap-1 p-1;
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

.bar-label-inline {
  @apply inline-flex items-center gap-0.5 cursor-pointer;
}

.bar-checkbox {
  @apply h-3.5 w-3.5 accent-sky-500;
}

.mode-switch {
  @apply inline-flex rounded border border-slate-700/60 bg-slate-900/30 p-0.5;
}

.mode-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded text-slate-400 transition-colors;
}

.mode-btn:hover {
  @apply text-slate-200 bg-slate-700/30;
}

.mode-btn.active {
  @apply text-sky-300 bg-sky-600/20;
}

.mode-btn:disabled {
  @apply opacity-40 cursor-not-allowed hover:bg-transparent hover:text-slate-400;
}

.bar-select {
  @apply h-6 text-xs bg-slate-900 border border-slate-600 rounded px-1.5 text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-40 disabled:cursor-not-allowed;
}

.bar-select--narrow {
  @apply w-12;
}

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.recalc-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30;
}

.reset-btn {
  @apply bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30;
}

.confirm-btn {
  @apply bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed;
}

.calc-btn {
  @apply bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 relative;
}

.calc-btn--needs-recalc {
  @apply border-red-500/50;
}

.map-btn {
  @apply bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30;
}

.recalc-dot {
  @apply absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full;
}

.bar-unresolved {
  @apply text-xs text-amber-400;
  cursor: help;
}

.bar-right {
  @apply flex items-center gap-1.5;
}

/* Map compact */
.auto-sector-bar--map .param-field {
  @apply px-1 py-0.5 gap-0.5;
}
.auto-sector-bar--map .bar-label {
  @apply text-[10px];
}
.auto-sector-bar--map .bar-select {
  @apply h-5 text-[11px] px-1;
}
.auto-sector-bar--map .bar-select--narrow {
  @apply w-10;
}
.auto-sector-bar--map .bar-btn {
  @apply px-1.5 py-0.5 text-[11px];
}
.auto-sector-bar--map .mode-btn {
  @apply px-1.5 py-0.5 text-[11px];
}
</style>
