<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StationType, StationSettings } from '@/types/x4'
import X4NumberInput from '@/components/common/X4NumberInput.vue'

const props = defineProps<{
  mode: 'overview' | 'station'
  titleModel: {
    value: string
    placeholder: string
  }
  station: {
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null
  settings: Partial<StationSettings> | StationSettings | null
  races: Array<{ value: string; label: string }>
  stationTypes: Array<{ value: StationType; label: string }>
  availableMinerals: string[]
  singleBerthThroughput: number
}>()

const emit = defineEmits<{
  updateTitle: [value: string]
  updateStationName: [value: string]
  updateStationType: [value: StationType]
  updateStationCount: [value: number]
  toggleMineral: [mineral: string]
  updateSunlight: [value: number]
  updateTransportMinutes: [value: number]
  updateRacePreference: [value: string]
  updateWorkforce: [value: boolean]
  updateShowEmpireGaps: [value: boolean]
  openImport: []
}>()

const { t } = useI18n()

const isOverview = computed(() => props.mode !== 'station')

const titleValue = computed({
  get: () => props.titleModel.value,
  set: (val: string) => emit('updateTitle', val)
})

const stationName = computed({
  get: () => props.station?.name || '',
  set: (name: string) => emit('updateStationName', name)
})

const stationType = computed({
  get: () => props.station?.type || 'industrial',
  set: (type: StationType) => emit('updateStationType', type)
})

const stationCount = computed({
  get: () => props.station?.count ?? 1,
  set: (val: number) => emit('updateStationCount', val)
})

const sunlight = computed({
  get: () => props.settings?.sunlight ?? 100,
  set: (val: number) => emit('updateSunlight', val)
})

const transportMinutes = computed({
  get: () => props.settings?.transportMinutes ?? 10,
  set: (val: number) => emit('updateTransportMinutes', val)
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

const showMineralPopover = ref(false)
const selectedMinerals = computed(() => props.station?.minerals || [])

const toggleMineral = (mineral: string) => {
  emit('toggleMineral', mineral)
}

const handleOpenImport = () => {
  emit('openImport')
}
</script>

<template>
  <div class="context-toolbar">
    
    <div v-if="isOverview" class="toolbar-content w-full flex items-center">
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('empire.empire_name') }}</label>
          <input 
            v-model="titleValue"
            class="ghost-input w-64 text-lg"
            :placeholder="props.titleModel.placeholder"
          />
        </div>
      </div>
    </div>

    <div v-else class="toolbar-content w-full flex items-center">
      
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('toolbar.station_name') }}</label>
          <input v-model="stationName" class="ghost-input w-32" :placeholder="t('toolbar.station_name_placeholder')" />
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.station_type') }}</label>
          <select v-model="stationType" class="ghost-select w-20">
            <option v-for="st in props.stationTypes" :key="st.value" :value="st.value">{{ st.label }}</option>
          </select>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.station_count') }}</label>
          <X4NumberInput v-model="stationCount" :min="0" width-class="w-12" />
        </div>
      </div>

      <div class="separator mx-6"></div>

      <div class="toolbar-section">
        <div class="relative">
          <div 
            class="input-group cursor-pointer hover:text-sky-400 transition-colors"
            @click="showMineralPopover = !showMineralPopover"
          >
            <label class="group-label cursor-pointer">{{ t('toolbar.sector_resources') }}</label>
            <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 min-w-[60px] justify-center h-6">
              <span class="text-xs text-slate-500" v-if="selectedMinerals.length === 0">{{ t('toolbar.no_resources') }}</span>
              <template v-else>
                <span class="text-xs">💎</span>
                <span class="text-xs font-bold font-mono text-sky-400">{{ selectedMinerals.length }}</span>
              </template>
            </div>
          </div>

          <div v-if="showMineralPopover" class="mineral-popover">
            <div class="popover-header">{{ t('toolbar.select_resources') }}</div>
            <div class="popover-content">
              <label 
                v-for="m in props.availableMinerals" 
                :key="m" 
                class="mineral-option"
              >
                <input 
                  type="checkbox" 
                  :checked="selectedMinerals.includes(m)"
                  @change="toggleMineral(m)"
                />
                <span class="text-xs text-slate-300">{{ m }}</span>
              </label>
            </div>
            <div class="fixed inset-0 z-[-1]" @click="showMineralPopover = false"></div>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.sunlight_efficiency') }}</label>
          <div class="x4-composite-input-wrapper">
            <X4NumberInput v-model="sunlight" :min="0" :max="200" width-class="w-14" class="x4-nested-input" />
            <div class="x4-unit-suffix-box">%</div>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.transport_time') }}</label>
          <div class="x4-composite-input-wrapper">
            <X4NumberInput v-model="transportMinutes" :min="0" width-class="w-14" class="x4-nested-input" />
            <div class="x4-unit-suffix-box">{{ t('ui.minute') }}</div>
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

    </div>

    <div class="toolbar-import-slot">
      <button
        class="icon-btn"
        :title="t('logicFlowImport.entry_title')"
        :data-testid="isOverview ? 'logicflow-import-entry-empire' : 'logicflow-import-entry-station'"
        @click="handleOpenImport"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.context-toolbar {
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

.toolbar-import-slot {
  @apply ml-auto flex items-end h-10;
}

.icon-btn {
  @apply flex items-center justify-center w-9 h-9 text-slate-500 hover:text-sky-400 hover:bg-slate-900 rounded transition-colors;
}

.ghost-input {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-sm font-bold text-slate-200 px-1 h-6 outline-none transition-colors;
}

.ghost-select {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-xs text-slate-300 h-6 outline-none cursor-pointer transition-colors appearance-none;
}
.ghost-select option {
  @apply bg-slate-900 text-slate-300;
}

.x4-composite-input-wrapper {
  @apply flex items-center gap-0 h-6;
}

.x4-nested-input {
  @apply flex-shrink-0;
}

.x4-unit-suffix-box {
  @apply text-[10px] text-slate-500 font-bold ml-1 whitespace-nowrap;
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

.count-pill {
  @apply flex items-center bg-slate-900 border border-slate-800 rounded px-2 h-7;
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

.mineral-popover {
  @apply absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl min-w-[140px];
}
.popover-header {
  @apply px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-slate-700 uppercase;
}
.popover-content {
  @apply p-1 max-h-48 overflow-y-auto;
}
.mineral-option {
  @apply flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-700/50 rounded;
}
.mineral-option input {
  @apply w-3 h-3 accent-sky-500 bg-slate-900 border-slate-600 rounded-sm;
}
</style>