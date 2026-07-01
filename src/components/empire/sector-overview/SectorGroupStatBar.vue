<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  mode: 'result' | 'edit'
  panelMode?: 'preview' | 'edit' | 'generate'
  view?: 'live' | 'map'
  showAddHub?: boolean
  editDisabled?: boolean
  addDisabled?: boolean
}>(), {
  panelMode: 'preview',
  view: 'live',
  showAddHub: false,
  editDisabled: true,
  addDisabled: false
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'update:panelMode', value: 'preview' | 'edit' | 'generate'): void
  (e: 'add-hub'): void
}>()

const { t } = useI18n()

const modeSummaryKey = computed(() => {
  if (props.panelMode === 'edit') return 'sector.mode_edit_summary'
  if (props.panelMode === 'generate') return 'sector.mode_recalculate_summary'
  return 'sector.mode_preview_summary'
})

const modeDetailKey = computed(() => {
  if (props.panelMode === 'edit') return 'sector.mode_edit_detail'
  if (props.panelMode === 'generate') return 'sector.mode_recalculate_detail'
  if (props.view === 'map') return 'sector.mode_preview_map_detail'
  return 'sector.mode_preview_detail'
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const modeDetailHtml = computed(() => escapeHtml(t(modeDetailKey.value)).replace(/\n/g, '<br>'))
</script>

<template>
  <div class="stat-bar" :class="{ 'stat-bar--map': view === 'map' }">
    <div class="stat-bar-row">
      <div class="stat-bar-left">
        <div
          class="mode-help"
          v-tippy="{ content: modeDetailHtml, allowHTML: true, placement: 'top', theme: 'material' }"
        >
          <span class="mode-help-icon">i</span>
          <span class="mode-help-text">{{ t(modeSummaryKey) }}</span>
        </div>
      </div>
      <div class="stat-bar-right">
        <template v-if="panelMode === 'edit'">
          <button class="bar-btn add-btn" :disabled="addDisabled" @click="emit('add-hub')">{{ showAddHub ? t('sector.cancel_add_hub') : t('sector.add_hub') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-bar {
  @apply flex flex-col gap-1 p-1.5 bg-slate-800/50 rounded border border-slate-700/50 mb-2;
}

.stat-bar--map {
  @apply gap-0.5 p-1;
}

.stat-bar-row {
  @apply flex items-center justify-between;
}

.stat-bar-left {
  @apply flex flex-wrap items-center gap-1.5;
}

.mode-help {
  @apply inline-flex items-center gap-1.5 min-w-0 text-xs text-slate-300 cursor-help;
}

.mode-help-icon {
  @apply inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 text-[10px] font-semibold text-sky-300;
}

.mode-help-text {
  @apply truncate;
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

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.add-btn {
  @apply bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30;
}

.add-btn:disabled {
  @apply opacity-40 cursor-not-allowed hover:bg-emerald-600/20;
}

.stat-bar-right {
  @apply flex items-center gap-1.5;
}

.stat-bar--map .param-field {
  @apply px-1 py-0.5 gap-0.5;
}

.stat-bar--map .bar-label {
  @apply text-[10px];
}

.stat-bar--map .bar-btn {
  @apply px-1.5 py-0.5 text-[11px];
}

.stat-bar--map .mode-help {
  @apply text-[11px];
}
</style>
