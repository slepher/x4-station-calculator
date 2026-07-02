<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { StationSettings } from '@/types/x4'
import type { ArchiveStationPosition } from '@/types/saveArchive'

const gameDataStore = useGameDataStore()
const { t, te } = useI18n()
const { translateWare } = useX4I18n()

const props = defineProps<{
  stationName: string
  stationCode: string
  sectorName: string
  sectorNameId?: string
  stationPosition?: ArchiveStationPosition
  sectorResources: string[]
  sectorSunlight: number
  hasBindingStation: boolean
  hasSaveStation: boolean
  mode: 'live' | 'planning'
  canToggle: boolean
  settings: Partial<StationSettings> | StationSettings | null
  races: Array<{ value: string; label: string }>
  singleBerthThroughput: number
  moduleScope: 'built' | 'building' | 'all'
  hasBuildingModules: boolean
}>()

const emit = defineEmits<{
  updateStationName: [value: string]
  toggleMode: []
  updateRacePreference: [value: string]
  updateWorkforce: [value: boolean]
  updateShowEmpireGaps: [value: boolean]
  openImport: []
  cycleModuleScope: []
}>()

const showSectorPopover = ref(false)

const nameValue = computed({
  get: () => props.stationName || '',
  set: (val: string) => emit('updateStationName', val)
})

const workforce = computed({
  get: () => props.settings?.considerWorkforceForAutoFill ?? true,
  set: (val: boolean) => emit('updateWorkforce', val)
})

const showEmpireGaps = computed({
  get: () => props.settings?.showEmpireGaps ?? false,
  set: (val: boolean) => emit('updateShowEmpireGaps', val)
})

const racePreference = computed({
  get: () => props.settings?.racePreference ?? 'argon',
  set: (val: string) => emit('updateRacePreference', val)
})

const formatThroughput = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

const showResourcesPopover = ref(false)

const displaySectorName = computed(() => {
  if (props.sectorNameId && te(props.sectorNameId)) {
    return t(props.sectorNameId)
  }
  return props.sectorName || '-'
})

const formatKm = (value: number): string => {
  const km = value / 1000
  if (Number.isInteger(km)) {
    return String(km)
  }
  return km.toFixed(1)
}

const positionKm = computed(() => {
  if (!props.stationPosition) return null
  const { x, y, z } = props.stationPosition
  return {
    x: formatKm(x),
    y: formatKm(y),
    z: formatKm(z)
  }
})

const getResourceName = (wareId: string): string => {
  const ware = gameDataStore.waresMap[wareId]
  if (ware) {
    return translateWare(ware)
  }
  return wareId
}

const toggleMode = () => {
  if (!props.canToggle) return
  emit('toggleMode')
}

const handleOpenImport = () => {
  emit('openImport')
}

const showModuleScope = computed(() => props.hasBuildingModules)

const scopeIcon = computed(() => {
  if (props.moduleScope === 'building') return '🚧'
  if (props.moduleScope === 'all') return '📦'
  return '🏗️'
})

const scopeLabel = computed(() => {
  if (props.moduleScope === 'building') return t('toolbar.module_scope_building')
  if (props.moduleScope === 'all') return t('toolbar.module_scope_all')
  return t('toolbar.module_scope_built')
})

const scopeClass = computed(() => {
  if (props.moduleScope === 'building') return 'active-amber'
  if (props.moduleScope === 'all') return 'active-sky'
  return 'active-green'
})
</script>

<template>
  <div class="live-toolbar">
    <div class="toolbar-content w-full flex items-center h-full">
      
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('toolbar.station_name') }}</label>
          <input v-model="nameValue" class="ghost-input w-32" :placeholder="t('toolbar.station_name_placeholder')" />
        </div>

        <div class="input-group ml-4">
          <label class="group-label">{{ t('toolbar.station_code') }}</label>
          <div class="readonly-pill">{{ props.stationCode || '-' }}</div>
        </div>

        <div class="input-group ml-4">
          <label class="group-label">{{ t('toolbar.mode') }}</label>
          <button 
            class="toggle-chip mode-toggle-chip"
            :class="[
              props.mode === 'planning' ? 'active-planning' : 'active-live',
              { 'no-toggle': !canToggle }
            ]"
            :disabled="!canToggle"
            @click="toggleMode"
          >
            <span class="mode-icon">{{ props.mode === 'live' ? '📡' : '📝' }}</span>
            <span class="chip-status">{{ props.mode === 'live' ? t('toolbar.mode_live') : t('toolbar.mode_planning') }}</span>
          </button>
        </div>
      </div>

      <div class="separator mx-6"></div>

      <div class="toolbar-section">
        <div class="relative">
          <div 
            class="input-group cursor-pointer hover:text-sky-400 transition-colors"
            @click="showSectorPopover = !showSectorPopover"
          >
            <label class="group-label cursor-pointer">{{ t('toolbar.sector') }}</label>
            <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 min-w-[80px] justify-center h-6">
              <span class="text-xs font-bold text-sky-400 truncate">{{ displaySectorName }}</span>
            </div>
          </div>

          <div v-if="showSectorPopover" class="sector-popover">
            <div class="popover-header">{{ displaySectorName }}</div>
            <div class="popover-content">
              <template v-if="positionKm">
                <div class="position-row">
                  <span class="text-xs text-slate-400">X</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.x }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
                <div class="position-row">
                  <span class="text-xs text-slate-400">Y</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.y }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
                <div class="position-row">
                  <span class="text-xs text-slate-400">Z</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.z }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
              </template>
              <div v-else class="text-xs text-slate-500 text-center py-2">
                {{ t('toolbar.no_position') }}
              </div>
            </div>
            <div class="fixed inset-0 z-[-1]" @click="showSectorPopover = false"></div>
          </div>
        </div>

        <div class="relative ml-6">
          <div 
            class="input-group cursor-pointer hover:text-sky-400 transition-colors"
            @click="showResourcesPopover = !showResourcesPopover"
          >
            <label class="group-label cursor-pointer">{{ t('toolbar.sector_resources') }}</label>
            <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 min-w-[60px] justify-center h-6">
              <span class="text-xs text-slate-500" v-if="props.sectorResources.length === 0">{{ t('toolbar.no_resources') }}</span>
              <template v-else>
                <span class="text-xs">💎</span>
                <span class="text-xs font-bold font-mono text-sky-400">{{ props.sectorResources.length }}</span>
              </template>
            </div>
          </div>

          <div v-if="showResourcesPopover" class="resources-popover">
            <div class="popover-header">{{ t('toolbar.sector_resources') }}</div>
            <div class="popover-content resources-list">
              <div class="resource-item" v-for="r in props.sectorResources" :key="r">
                <span class="text-xs text-slate-300">{{ getResourceName(r) }}</span>
              </div>
              <div v-if="props.sectorResources.length === 0" class="text-xs text-slate-500 text-center py-2">
                {{ t('toolbar.no_resources') }}
              </div>
            </div>
            <div class="fixed inset-0 z-[-1]" @click="showResourcesPopover = false"></div>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.sunlight_efficiency') }}</label>
          <div class="count-pill min-w-[70px] justify-end">
            <span class="text-xs font-mono font-bold text-sky-400">{{ props.sectorSunlight }}</span>
            <span class="text-[10px] text-slate-500 ml-1">%</span>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.single_berth_throughput') }}</label>
          <div class="count-pill min-w-[120px] justify-end">
            <span class="text-xs font-mono font-bold text-sky-400">{{ formatThroughput(props.singleBerthThroughput) }}</span>
            <span class="text-[10px] text-slate-500 ml-1">m³/h</span>
          </div>
        </div>
      </div>

      <template v-if="props.mode === 'planning'">
        <div class="separator mx-6"></div>

        <div class="toolbar-section">
          <div class="input-group">
            <label class="group-label">{{ t('toolbar.race_preference') }}</label>
            <select v-model="racePreference" class="race-select">
              <option v-for="r in props.races" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>

          <div class="input-group ml-6">
            <label class="group-label">{{ t('toolbar.workforce_calc') }}</label>
            <button 
              class="toggle-chip"
              :class="workforce ? 'active-green' : 'inactive'"
              @click="workforce = !workforce"
              :title="t('toolbar.workforce_calc_title')"
            >
              <span class="text-sm">👥</span>
              <span class="chip-status">{{ workforce ? 'ON' : 'OFF' }}</span>
            </button>
          </div>

          <div class="input-group ml-6">
            <label class="group-label">{{ t('ui.show_sector_gaps') }}</label>
            <button 
              class="toggle-chip"
              :class="showEmpireGaps ? 'active-green' : 'inactive'"
              @click="showEmpireGaps = !showEmpireGaps"
              data-testid="toggle-show-empire-gaps"
            >
              <span class="sr-only">{{ t('ui.show_sector_gaps') }}</span>
              <span class="text-sm">📊</span>
              <span class="chip-status">{{ showEmpireGaps ? 'ON' : 'OFF' }}</span>
            </button>
          </div>
        </div>
      </template>

      <template v-if="showModuleScope">
        <div class="separator mx-6"></div>

        <div class="toolbar-section">
          <div class="input-group">
            <label class="group-label">{{ t('toolbar.module_scope') }}</label>
            <button
              class="toggle-chip"
              :class="scopeClass"
              @click="emit('cycleModuleScope')"
            >
              <span class="text-sm">{{ scopeIcon }}</span>
              <span class="chip-status">{{ scopeLabel }}</span>
            </button>
          </div>
        </div>
      </template>

    </div>

    <div class="toolbar-import-slot">
      <button
        class="icon-btn"
        :title="t('logicFlowImport.entry_title')"
        data-testid="logicflow-import-entry-station"
        @click="handleOpenImport"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.live-toolbar {
  @apply w-full h-16 shrink-0 bg-slate-950 border-b border-slate-800 flex px-6 select-none relative z-10;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.toolbar-section {
  @apply flex items-center h-full;
}

.separator {
  @apply h-8 w-px bg-slate-800 mx-3;
}

.group-label {
  @apply text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 whitespace-nowrap block leading-none;
}

.input-group {
  @apply flex flex-col justify-end h-10;
}

.toolbar-import-slot {
  @apply ml-auto flex items-center;
}

.icon-btn {
  @apply flex items-center justify-center w-9 h-9 text-slate-500 hover:text-sky-400 hover:bg-slate-900 rounded transition-colors;
}

.ghost-input {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-sm font-bold text-slate-200 px-1 h-6 outline-none transition-colors;
}

.readonly-pill {
  @apply flex items-center bg-slate-800/50 border border-slate-700 rounded px-2 h-6 text-xs text-slate-400 font-mono min-w-[80px] justify-center;
}

.mode-toggle-btn {
  @apply flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 h-6 text-xs cursor-pointer transition-colors;
}
.mode-toggle-btn:hover:not(.disabled) {
  @apply border-sky-500;
}
.mode-toggle-btn.disabled {
  @apply opacity-50 cursor-not-allowed border-slate-600;
}

.mode-label {
  @apply text-slate-400 transition-colors;
}
.mode-label.active {
  @apply text-sky-400 font-bold;
}
.mode-separator {
  @apply text-slate-600 mx-1;
}

.count-pill {
  @apply flex items-center bg-slate-900 border border-slate-800 rounded px-2 h-7;
}

.race-select {
  @apply bg-slate-900 border border-slate-700 rounded px-2 h-6 text-xs text-slate-300 outline-none cursor-pointer transition-colors appearance-none min-w-[90px];
}
.race-select:hover {
  @apply border-slate-500;
}
.race-select:focus {
  @apply border-sky-500;
}
.race-select option {
  @apply bg-slate-900 text-slate-300;
}

.toggle-chip {
  @apply flex items-center gap-1.5 px-2 rounded border transition-all duration-200 cursor-pointer select-none;
  @apply h-6 min-w-[50px] bg-slate-900 border-slate-700 text-slate-500;
}
.toggle-chip:hover {
  @apply bg-slate-800 text-slate-400;
}

.chip-status {
  @apply text-[10px] font-bold;
}

.toggle-chip.active-green {
  @apply bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)];
}
.toggle-chip.active-green .chip-status { @apply text-emerald-300; }

.toggle-chip.active-amber {
  @apply bg-amber-900/30 border-amber-600 text-amber-400 shadow-[0_0_8px_rgba(217,119,6,0.2)];
}
.toggle-chip.active-amber .chip-status { @apply text-amber-300; }

.toggle-chip.active-sky {
  @apply bg-sky-900/30 border-sky-600 text-sky-400 shadow-[0_0_8px_rgba(2,132,199,0.2)];
}
.toggle-chip.active-sky .chip-status { @apply text-sky-300; }

.mode-toggle-chip {
  @apply min-w-[80px] justify-center;
}
.mode-toggle-chip.active-live {
  @apply border-sky-600 text-sky-400 bg-sky-900/30;
}
.mode-toggle-chip.active-planning {
  @apply border-amber-600 text-amber-400 bg-amber-900/30;
}
.mode-toggle-chip.no-toggle {
  @apply cursor-default;
}

.mode-icon {
  @apply text-sm;
}

.sector-popover,
.resources-popover {
  @apply absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl min-w-[140px];
}
.popover-header {
  @apply px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-slate-700 uppercase;
}
.popover-content {
  @apply p-1 max-h-48 overflow-y-auto;
}
.popover-content.resources-list {
  @apply max-h-none overflow-visible;
}
.position-row {
  @apply flex items-center justify-between px-2 py-1.5 gap-2;
}
.position-value {
  @apply ml-2;
}
.resource-item {
  @apply px-2 py-1.5 text-xs text-slate-300;
}
</style>
