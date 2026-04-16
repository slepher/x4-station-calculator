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
  titleModel: {
    value: string
    placeholder: string
  }
  stationCode: string
  sectorName: string
  sectorNameId?: string
  stationPosition?: ArchiveStationPosition
  sectorResources: string[]
  sectorSunlight: number
  settings: Partial<StationSettings> | StationSettings | null
  races: Array<{ value: string; label: string }>
  singleBerthThroughput: number
  mode?: 'live' | 'planning'
  visualMode?: 'live' | 'planning'
  canToggle?: boolean
  hasArchiveTradeStation?: boolean
}>()

const emit = defineEmits<{
  updateTitle: [value: string]
  updateRacePreference: [value: string]
  toggleMode: []
}>()

const showSectorPopover = ref(false)
const showResourcesPopover = ref(false)

const titleValue = computed({
  get: () => props.titleModel.value,
  set: (val: string) => emit('updateTitle', val)
})

const racePreference = computed({
  get: () => props.settings?.racePreference ?? 'argon',
  set: (val: string) => emit('updateRacePreference', val)
})

const formatThroughput = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

const handleToggleMode = () => {
  emit('toggleMode')
}

const toggleVisualState = computed(() => {
  if (!props.canToggle) return 'disabled'
  return props.visualMode ?? 'planning'
})

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
</script>

<template>
  <div class="live-toolbar">
    <div class="toolbar-content w-full flex items-center">
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('binding.binding_name') }}</label>
          <input 
            v-model="titleValue"
            class="ghost-input w-32"
            :placeholder="props.titleModel.placeholder"
          />
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
              toggleVisualState === 'planning' ? 'active-planning' : 'active-live',
              { 'no-toggle': !props.canToggle }
            ]"
            :disabled="!props.canToggle"
            @click="handleToggleMode"
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
            data-testid="sector-pill"
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
            data-testid="sector-resources-pill"
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
          <div class="count-pill min-w-[60px] justify-end">
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
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.live-toolbar {
  @apply w-full h-16 bg-slate-950 border-b border-slate-800 flex items-center px-6 select-none relative z-10;
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

.ghost-input {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-sm font-bold text-slate-200 px-1 h-6 outline-none transition-colors;
}

.readonly-pill {
  @apply flex items-center bg-slate-800/50 border border-slate-700 rounded px-2 h-6 text-xs text-slate-400 font-mono min-w-[80px] justify-center;
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
}

.mode-toggle-chip {
  @apply min-w-[80px] justify-center h-7;
}

.mode-toggle-chip.active-planning {
  @apply border-amber-600 text-amber-400 bg-amber-900/30;
}

.mode-toggle-chip.active-live {
  @apply border-sky-600 text-sky-400 bg-sky-900/30;
}

.mode-toggle-chip.no-toggle {
  @apply cursor-default bg-slate-800 text-slate-500 border-slate-700;
}

.mode-icon {
  @apply text-sm;
}

.chip-status {
  @apply text-xs font-bold whitespace-nowrap;
}

.sector-popover,
.resources-popover {
  @apply absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded shadow-lg z-50 min-w-[150px];
}

.popover-header {
  @apply px-3 py-2 text-xs font-bold text-sky-400 border-b border-slate-700;
}

.popover-content {
  @apply px-3 py-2;
}

.position-row {
  @apply flex items-center gap-2 py-1;
}

.position-value {
  @apply min-w-[60px];
}

.resources-list {
  @apply max-h-[200px] overflow-y-auto;
}

.resource-item {
  @apply py-1;
}
</style>