<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useStationStore } from '@/store/useStationStore'
import { useI18n } from 'vue-i18n'
import type { StationType } from '@/types/x4'
import X4NumberInput from '@/components/common/X4NumberInput.vue'

const { t } = useI18n()
const empireStore = useEmpireStore()
const stationStore = useStationStore()

// --- 状态判断 ---
const isOverview = computed(() => empireStore.activeStationId === null)
const activeStation = computed(() => empireStore.activeStation)

// --- 数据绑定 (保持您原有的逻辑) ---
const empireName = computed({
  get: () => empireStore.activeEmpire?.name || '',
  set: (name: string) => {
    empireStore.updateEmpireName(name)
  }
})

const stationName = computed({
  get: () => activeStation.value?.name || '',
  set: (name: string) => {
    if (activeStation.value) {
      empireStore.renameStation(activeStation.value.id, name)
    }
  }
})

const stationType = computed({
  get: () => activeStation.value?.type || 'industrial',
  set: (type: StationType) => {
    if (activeStation.value) {
      activeStation.value.type = type
    }
  }
})

const stationCount = computed({
  get: () => activeStation.value?.count ?? 1,
  set: (val: number) => { 
    if (activeStation.value) {
      activeStation.value.count = val
      activeStation.value.lastUpdated = Date.now()
    }
  }
})

const sunlight = computed({
  get: () => stationStore.settings.sunlight,
  set: (val: number) => { stationStore.updateSetting('sunlight', val) }
})

const workforce = computed({
  get: () => stationStore.settings.considerWorkforceForAutoFill,
  set: (val: boolean) => { stationStore.updateSetting('considerWorkforceForAutoFill', val) }
})

const showEmpireGaps = computed({
  get: () => stationStore.settings.showEmpireGaps ?? false,
  set: (val: boolean) => { stationStore.updateSetting('showEmpireGaps', val) }
})

const racePreference = computed({
  get: () => stationStore.settings.racePreference,
  set: (val: string) => { stationStore.updateSetting('racePreference', val) }
})

// --- 矿物选择逻辑 ---
const showMineralPopover = ref(false)
const availableMinerals = computed(() => ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane']) 
const selectedMinerals = computed(() => activeStation.value?.minerals || [])

const toggleMineral = (mineral: string) => {
  if (!activeStation.value) return
  const current = activeStation.value.minerals || []
  if (current.includes(mineral)) {
    activeStation.value.minerals = current.filter((m: string) => m !== mineral)
  } else {
    activeStation.value.minerals = [...current, mineral]
  }
}

// --- 静态选项 ---
const stationTypes = computed(() => [
  { value: 'industrial', label: t('toolbar.station_types.industrial') },
  { value: 'supply', label: t('toolbar.station_types.supply') },
  { value: 'transit', label: t('toolbar.station_types.transit') },
  { value: 'shipyard', label: t('toolbar.station_types.shipyard') }
])

const races = computed(() => [
  { value: 'argon', label: t('toolbar.races.argon') },
  { value: 'terran', label: t('toolbar.races.terran') },
  { value: 'teladi', label: t('toolbar.races.teladi') },
  { value: 'paranid', label: t('toolbar.races.paranid') },
  { value: 'split', label: t('toolbar.races.split') }
])
</script>

<template>
  <div class="context-toolbar">
    
    <div v-if="isOverview" class="toolbar-section w-full">
      <div class="input-group">
        <label class="group-label">{{ t('empire.empire_name') }}</label>
        <input 
          v-model="empireName"
          class="ghost-input w-64 text-lg"
          :placeholder="t('empire.unnamed_empire')"
        />
      </div>
      
      <div class="separator"></div>
      
      <div class="text-slate-600 text-xs italic ml-auto mr-4">
        {{ t('empire.global_stats') }}
      </div>
    </div>

    <div v-else class="toolbar-content w-full flex items-center">
      
      <div class="toolbar-section">
        <button class="icon-btn" :title="t('toolbar.import_config')">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        </button>

        <div class="input-group ml-4">
          <label class="group-label">{{ t('toolbar.station_name') }}</label>
          <input v-model="stationName" class="ghost-input w-32" :placeholder="t('toolbar.station_name_placeholder')" />
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.station_type') }}</label>
          <select v-model="stationType" class="ghost-select w-20">
            <option v-for="t in stationTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
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
                v-for="m in availableMinerals" 
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
      </div>

      <div class="separator mx-6"></div>

      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('toolbar.race_preference') }}</label>
          <select v-model="racePreference" class="race-select">
            <option v-for="r in races" :key="r.value" :value="r.value">{{ r.label }}</option>
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
          <label class="group-label">{{ t('ui.show_empire_gaps') }}</label>
          <button 
            class="toggle-chip"
            :class="showEmpireGaps ? 'active-green' : 'inactive'"
            @click="showEmpireGaps = !showEmpireGaps"
            data-testid="toggle-show-empire-gaps"
          >
            <span class="sr-only">{{ t('ui.show_empire_gaps') }}</span>
            <span class="text-sm">📊</span>
            <span class="chip-status">{{ showEmpireGaps ? 'ON' : 'OFF' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 主容器 */
.context-toolbar {
  @apply w-full h-16 bg-slate-950 border-b border-slate-800 flex items-center px-6 select-none relative z-10;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.toolbar-section {
  @apply flex items-center h-full;
}

/* 分割线 */
.separator {
  @apply h-8 w-px bg-slate-800 mx-3;
}

/* 标签 */
.group-label {
  @apply text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 whitespace-nowrap block leading-none;
}

.input-group {
  @apply flex flex-col justify-end h-10;
}

/* 导入按钮 */
.icon-btn {
  @apply flex items-center justify-center w-9 h-9 text-slate-500 hover:text-sky-400 hover:bg-slate-900 rounded transition-colors self-end mb-0.5;
}

/* 无边框输入框 */
.ghost-input {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-sm font-bold text-slate-200 px-1 h-6 outline-none transition-colors;
}

/* 无边框下拉框 */
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

/* 数量胶囊 */
.count-pill {
  @apply flex items-center bg-slate-900 border border-slate-800 rounded px-2 h-7;
}
.count-pill .prefix {
  @apply text-slate-500 text-xs font-bold mr-1;
}
.count-input {
  @apply w-8 bg-transparent text-center text-sm font-bold text-slate-200 outline-none;
  -moz-appearance: textfield;
}
.count-input::-webkit-outer-spin-button, 
.count-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

/* 日光输入 */
.sunlight-wrapper {
  @apply flex items-center border-b border-slate-800 hover:border-amber-500/50 focus-within:border-amber-500 transition-colors px-1 h-7;
}
.sunlight-input {
  @apply w-8 bg-transparent text-right text-xs font-bold text-slate-200 outline-none;
  -moz-appearance: textfield;
}
.sunlight-wrapper .suffix {
  @apply text-[10px] text-slate-500 ml-0.5 font-bold;
}

/* 开关芯片 (Toggle Chips) */
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

/* 状态色 */
.toggle-chip.active-green {
  @apply bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)];
}
.toggle-chip.active-green .chip-status { @apply text-emerald-300; }
.toggle-chip.active-green .chip-label { @apply text-emerald-600; }

/* 矿物弹出层 */
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
