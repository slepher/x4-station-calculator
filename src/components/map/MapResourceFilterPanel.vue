<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import MapResourceFilterSimplePanel from './MapResourceFilterSimplePanel.vue'
import MapResourceFilterAdvancedPanel from './MapResourceFilterAdvancedPanel.vue'
import type { SectorResourceFill } from '@/store/logic/mapResourceFilter'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
  radius: number
  verticalExtent: number
}

type ResourceVisualChangePayload = {
  highlightedSectorIds: string[]
  sectorFills: Record<string, SectorResourceFill>
  sectorGroupBadges?: Record<string, string[]>
}

const props = withDefaults(defineProps<{
  sectorLayouts: SearchSectorLayout[]
  mode?: 'overlay' | 'sidebar'
  showEntryButton?: boolean
}>(), {
  showEntryButton: true
})

const emit = defineEmits<{
  (e: 'highlight-change', sectorIds: string[]): void
  (e: 'select-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'active-change', active: boolean): void
  (e: 'primary-color-change', color: string | null): void
  (e: 'resource-visual-change', payload: ResourceVisualChangePayload): void
  (e: 'panel-open'): void
  (e: 'panel-close'): void
}>()

const { t } = useI18n()

const isSidebarMode = ref(props.mode === 'sidebar')
const currentMode = ref<'simple' | 'advanced'>('simple')

watchEffect(() => {
  isSidebarMode.value = props.mode === 'sidebar'
  if (!isSidebarMode.value) {
    emit('highlight-change', [])
    emit('active-change', false)
    emit('resource-visual-change', { highlightedSectorIds: [], sectorFills: {}, sectorGroupBadges: {} })
    emit('primary-color-change', null)
  }
})

const onPanelOpen = () => emit('panel-open')
const onPanelClose = () => emit('panel-close')
</script>

<template>
  <div class="map-resource-panel" :class="props.mode || 'overlay'" @mousedown.stop>
    <button
      v-show="!isSidebarMode && props.showEntryButton !== false"
      type="button"
      class="resource-entry-btn"
      data-testid="map-resource-entry-button"
      @click="onPanelOpen"
    >
      <span class="resource-entry-label">{{ t('map.resource_filter_button') }}</span>
      <svg class="resource-entry-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
    </button>

    <div v-show="isSidebarMode" class="resource-panel-shell" :class="{ sidebar: props.mode === 'sidebar' }">
      <div class="resource-panel-top" data-testid="map-resource-panel-header">
        <div class="resource-mode-tabs" role="tablist" :aria-label="t('map.resource_filter_mode')">
          <button
            type="button"
            class="resource-mode-tab"
            :class="{ active: currentMode === 'simple' }"
            data-testid="map-resource-tab-simple"
            @click="currentMode = 'simple'"
          >
            {{ t('map.resource_filter_mode_simple') }}
          </button>
          <button
            type="button"
            class="resource-mode-tab"
            :class="{ active: currentMode === 'advanced' }"
            data-testid="map-resource-tab-advanced"
            @click="currentMode = 'advanced'"
          >
            {{ t('map.resource_filter_mode_advanced') }}
          </button>
        </div>

        <button
          type="button"
          class="resource-close-btn"
          data-testid="map-resource-close-panel"
          @click="onPanelClose"
        >
          ×
        </button>
      </div>

      <div class="resource-panel-body custom-scrollbar">
        <MapResourceFilterSimplePanel
          v-show="currentMode === 'simple'"
          :sector-layouts="props.sectorLayouts"
          :active="currentMode === 'simple' && isSidebarMode"
          @highlight-change="emit('highlight-change', $event)"
          @resource-visual-change="emit('resource-visual-change', $event)"
          @select-sector="emit('select-sector', $event)"
          @active-change="emit('active-change', $event)"
          @primary-color-change="emit('primary-color-change', $event)"
        />

        <MapResourceFilterAdvancedPanel
          v-show="currentMode === 'advanced'"
          :sector-layouts="props.sectorLayouts"
          :active="currentMode === 'advanced' && isSidebarMode"
          @highlight-change="emit('highlight-change', $event)"
          @resource-visual-change="emit('resource-visual-change', $event)"
          @select-sector="emit('select-sector', $event)"
          @fit-sectors="emit('fit-sectors', $event)"
          @active-change="emit('active-change', $event)"
          @primary-color-change="emit('primary-color-change', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-resource-panel {
  width: 360px;
  max-width: calc(100% - 3rem);
}

.map-resource-panel.overlay {
  @apply absolute right-6 top-5 z-10;
}

.map-resource-panel.sidebar {
  @apply relative z-0 h-full;
  flex: 0 0 360px;
  max-width: 360px;
}

.resource-entry-btn {
  @apply inline-flex items-center gap-2 rounded-lg border border-amber-300/35 bg-black/75 px-4 py-2 text-sm font-semibold text-amber-50 shadow-2xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(8px);
}

.resource-entry-label {
  @apply leading-none;
}

.resource-entry-icon {
  @apply h-4 w-4 text-amber-200/90;
}

.resource-panel-shell {
  @apply relative rounded-lg border border-amber-300/35 bg-black/75 py-3 px-0 shadow-2xl;
  backdrop-filter: blur(8px);
}

.resource-panel-shell.sidebar {
  @apply flex h-full min-h-0 flex-col rounded-lg bg-black/60 shadow-none;
  backdrop-filter: blur(0px);
}

.resource-panel-top {
  @apply flex items-center justify-between gap-3 border-b border-amber-300/15 pb-3 px-3;
}

.resource-mode-tabs {
  @apply flex items-center gap-2;
}

.resource-mode-tab {
  @apply rounded-md border border-amber-300/20 px-3 py-1.5 text-sm font-semibold text-amber-100/75 transition-colors duration-150 hover:border-amber-200/55 hover:text-amber-50;
}

.resource-mode-tab.active {
  @apply border-amber-200/70 bg-amber-200/15 text-amber-50;
}

.resource-close-btn {
  @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/35 bg-black/55 text-lg leading-none text-amber-100/75 transition-colors duration-150 mr-1.5 hover:text-amber-50 hover:border-amber-200/70;
}

.resource-panel-body {
  @apply mt-3 min-h-0 flex-1 overflow-y-auto;
  scrollbar-gutter: stable both-edges;
}

:deep(.custom-scrollbar) {
  scrollbar-width: thin;
  scrollbar-color: rgba(251, 191, 36, 0.55) rgba(15, 23, 42, 0.25);
}

:deep(.custom-scrollbar::-webkit-scrollbar) {
  @apply w-1.5;
}

:deep(.custom-scrollbar::-webkit-scrollbar-track) {
  @apply rounded-full bg-slate-900/35;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb) {
  @apply rounded-full bg-amber-300/45;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
  @apply bg-amber-200/60;
}

:deep(.resource-tag-grid) {
  @apply flex flex-wrap gap-2;
}

:deep(.resource-tag) {
  @apply rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors duration-150;
}

:deep(.resource-config-list) {
  @apply mt-3 space-y-2 border-t border-amber-300/15 pt-3;
}

:deep(.resource-config-row) {
  @apply grid items-center gap-3;
  grid-template-columns: minmax(0, 72px) minmax(155px, 1fr) minmax(0, 1fr);
  min-width: 0;
}

:deep(.config-label) {
  @apply truncate text-sm text-amber-50;
}

:deep(.config-warning) {
  @apply min-w-0 truncate text-[11px] text-rose-300;
}

:deep(.yield-select),
:deep(.advanced-number-input) {
  @apply rounded-md border border-amber-300/30 bg-black/70 px-3 py-1 text-sm text-amber-50 outline-none;
  width: 155px;
  min-width: 142px;
}

:deep(.sunlight-input) {
  @apply w-full rounded-md border border-amber-300/30 bg-black/70 px-3 py-1 text-sm text-amber-50 outline-none;
  min-width: 142px;
  text-indent: 0.18rem;
  padding-right: 3.25rem;
  appearance: textfield;
}

:deep(.sunlight-input-wrap) {
  @apply relative;
  width: 142px;
}

:deep(.jump-input-wrap) {
  width: 78px;
}

:deep(.jump-input-wrap .sunlight-input) {
  min-width: 0;
  padding-right: 2.55rem;
  text-indent: 0;
  text-align: center;
}

:deep(.jump-input-wrap .sunlight-suffix) {
  right: 1.3rem;
  font-size: 0.75rem;
}

:deep(.jump-input-wrap .sunlight-stepper) {
  width: 0.95rem;
}

:deep(.jump-input-wrap .sunlight-step-btn) {
  width: 0.95rem;
}

:deep(.sunlight-suffix) {
  @apply pointer-events-none absolute right-[1.35rem] top-1/2 -translate-y-1/2 text-sm font-semibold text-amber-100/90;
}

:deep(.sunlight-input::-webkit-outer-spin-button),
:deep(.sunlight-input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

:deep(.sunlight-stepper) {
  @apply absolute right-0 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-md rounded-l-sm border border-amber-300/25 bg-black/80;
}

:deep(.sunlight-step-btn) {
  @apply flex h-3.5 w-4 items-center justify-center bg-amber-200/10 text-[9px] leading-none text-amber-100/85 transition-colors duration-150 hover:bg-amber-200/20 hover:text-amber-50;
}

:deep(.sunlight-step-btn + .sunlight-step-btn) {
  @apply border-t border-amber-300/20;
}

:deep(.resource-candidate-box) {
  @apply mt-3 border-t border-amber-300/15 pt-3;
}

:deep(.candidate-header) {
  @apply mb-2 flex items-center justify-between text-sm font-semibold text-amber-200/80;
  letter-spacing: 0;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif;
}

:deep(.candidate-count) {
  @apply rounded border border-amber-300/20 px-1.5 py-0.5 text-[11px] text-amber-100;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  font-family: inherit;
}

:deep(.candidate-list) {
  @apply max-h-none min-h-0 overflow-y-auto rounded-md border border-amber-300/20 bg-black/40;
}

:deep(.candidate-item) {
  @apply flex w-full items-center justify-between gap-3 border-b border-amber-300/10 px-3 py-2 text-left hover:bg-amber-300/10;
}

:deep(.candidate-name) {
  @apply truncate text-sm text-amber-50;
}

:deep(.candidate-score) {
  @apply shrink-0 text-xs font-semibold text-amber-200;
  font-variant-numeric: tabular-nums;
}

:deep(.resource-empty) {
  @apply rounded-md border border-amber-300/20 bg-black/40 px-3 py-4 text-center text-xs text-amber-100/55;
}
</style>
