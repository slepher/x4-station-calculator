<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import PriceSlider from '@/components/common/PriceSlider.vue'
import StationModuleDetail from './StationModuleDetail.vue'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'
import { analyzeStation } from '@/store/logic/analyzeStation'
import type { SavedModule } from '@/types/x4'

const store = useStationStore()
const gameDataStore = useGameDataStore()
const { translateModule, translateWare, translate } = useX4I18n()
const { t } = useI18n()
const props = withDefaults(defineProps<{
  plannedModulesOverride?: SavedModule[] | null
  hideWorkersView?: boolean
}>(), {
  plannedModulesOverride: null,
  hideWorkersView: false
})

const viewMode = ref<'materials' | 'time' | 'workers' | 'volume'>('materials')
const views = computed(() => [
  { key: 'materials', label: t('station.view_cost') },
  { key: 'volume', label: t('station.view_volume') },
  { key: 'time', label: t('station.view_time') },
  ...(props.hideWorkersView ? [] : [{ key: 'workers', label: t('station.view_workers') }])
])
watch(views, (nextViews) => {
  if (!nextViews.some((item) => item.key === viewMode.value)) {
    viewMode.value = 'materials'
  }
}, { immediate: true })
const transportShipCapacity = computed({
  get: () => store.settings.transportShipCapacity,
  set: (val) => store.updateSetting('transportShipCapacity', val)
})
const buildPriceMultiplier = computed({
  get: () => store.buildPriceMultiplier,
  set: (val) => store.buildPriceMultiplier = val
})

const workforceEfficiencyText = computed(() => {
  return `${Math.round(store.currentEfficiency * 100)}%`
})

const workforceEfficiencyColor = computed(() => {
  const eff = store.currentEfficiency
  if (eff >= 1) return 'text-emerald-400'
  if (eff >= 0.5) return 'text-amber-400'
  return 'text-red-400'
})

const analysis = computed(() => {
  if (!props.plannedModulesOverride) return store.stationAnalysis
  return analyzeStation(
    props.plannedModulesOverride,
    gameDataStore.modulesMap,
    gameDataStore.waresMap,
    buildPriceMultiplier.value,
    useHQ.value
  )
})

const maxAllowedWorkforce = computed(() => {
  const currentAnalysis = analysis.value
  const needed = currentAnalysis.totalNeeded || 0;
  const capacity = currentAnalysis.totalCapacity || 0;
  return Math.min(needed, capacity);
});

const saturationPercent = computed({
  get: () => {
    const currentAnalysis = analysis.value
    const capacity = currentAnalysis.totalCapacity || 0;
    if (capacity === 0) return 0;
    const currentVal = store.settings.workforceAuto ? store.actualWorkforce : store.settings.manualWorkforce;
    return Math.round((currentVal / capacity) * 100);
  },
  set: (val: number) => {
    if (store.settings.workforceAuto) return;
    const currentAnalysis = analysis.value
    const capacity = currentAnalysis.totalCapacity || 0;
    store.updateSetting('manualWorkforce', Math.min(Math.round((val / 100) * capacity), capacity));
  }
})
const manualWorkforce = computed({
  get: () => store.settings.manualWorkforce,
  set: (val: number) => store.updateSetting('manualWorkforce', val)
})
const workforceAuto = computed({
  get: () => store.settings.workforceAuto,
  set: (val: boolean) => store.updateSetting('workforceAuto', val)
})
const useHQ = computed({
  get: () => store.settings.useHQ,
  set: (val: boolean) => store.updateSetting('useHQ', val)
})

const formatLargeNum = (n: number) => {
  if (n >= 1_000_000) {
    const val = n / 1_000_000
    // 如果是整数或者小数位为0，则不显示小数
    return `${parseFloat(val.toFixed(2))}M`
  }
  if (n >= 1_000) {
    const val = n / 1_000
    return `${parseFloat(val.toFixed(2))}K`
  }
  return n.toLocaleString()
}

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const formatTime = (seconds: number) => {
  if (!seconds) return '00:00:00'
  const d = Math.floor(seconds / (24 * 3600))
  const h = Math.floor((seconds % (24 * 3600)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  
  if (d >= 2) {
    return `${d}D ${timeStr}`
  }
  
  // 如果超过24小时但不到2天，HH会显示为 24-47
  const totalHours = Math.floor(seconds / 3600)
  const totalTimeStr = `${String(totalHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return totalTimeStr
}

const data = computed(() => {
  const currentAnalysis = analysis.value
  
  if (viewMode.value === 'time') {
    return {
      totalValue: currentAnalysis.totalTime,
      unit: '',
      isTime: true,
      summaryItems: [], // 时间视图不需要汇总行明细
      moduleGroups: currentAnalysis.moduleGroups.map((group: any) => {
        const moduleData = gameDataStore.modulesMap[group.id]
        return {
          ...group,
          displayName: moduleData ? translateModule(moduleData) : group.id,
          displayValue: group.totalTime,
          items: [
            { 
              id: 'build_time', 
              displayName: t('station.item_build_time'), 
              count: 1, 
              price: group.unitTime // 传递给 displayValue 渲染
            }
          ]
        }
      })
    }
  }

  if (viewMode.value === 'workers') {
    const summaryItems = [
      { id: 'cap', displayName: t('station.total_capacity'), count: currentAnalysis.totalCapacity, price: 0 }
    ]

    // 如果有 PHQ，拆分总需求
    if (currentAnalysis.playerHQNeeded > 0) {
      summaryItems.push({ 
        id: 'need', 
        displayName: t('station.total_needed'), 
        count: currentAnalysis.totalNeeded - currentAnalysis.playerHQNeeded, 
        price: 0 
      })
      summaryItems.push({ 
        id: 'need', 
        displayName: translate('player_hq', '{20102,2011}', 'module'), 
        count: currentAnalysis.playerHQNeeded, 
        price: 0 
      })
    } else {
      summaryItems.push({ 
        id: 'need', 
        displayName: t('station.total_needed'), 
        count: currentAnalysis.totalNeeded, 
        price: 0 
      })
    }

    const moduleGroups = currentAnalysis.moduleGroups
      .filter((group: any) => group.unitCapacity || group.unitNeeded)
      .map((group: any) => {
        const moduleData = gameDataStore.modulesMap[group.id]
        const items = []
        if (group.unitCapacity) {
          items.push({ 
            id: 'cap', 
            displayName: t('station.capacity'), 
            count: group.unitCapacity, 
            price: 0 
          })
        }
        if (group.unitNeeded) {
          items.push({ 
            id: 'need', 
            displayName: t('station.needed'), 
            count: group.unitNeeded, 
            price: 0 
          })
        }
        return {
          ...group,
          displayName: moduleData ? translateModule(moduleData) : group.id,
          displayValue: group.totalWorkerDiff,
          items
        }
      })

    return {
      totalValue: currentAnalysis.totalWorkerDiff,
      unit: '',
      isWorkers: true,
      summaryItems,
      moduleGroups
    }
  }

  if (viewMode.value === 'volume') {
    return {
      totalValue: currentAnalysis.totalVolume,
      unit: 'm³',
      isVolume: true,
      summaryItems: currentAnalysis.summaryItems.map((item: any) => {
        const ware = gameDataStore.waresMap[item.id]
        return {
          ...item,
          displayName: ware ? translateWare(ware) : item.id
        }
      }),
      moduleGroups: currentAnalysis.moduleGroups.map((group: any) => {
        const moduleData = gameDataStore.modulesMap[group.id]
        return {
          ...group,
          displayName: moduleData ? translateModule(moduleData) : group.id,
          displayValue: group.volume,
          items: group.items.map((item: any) => {
            const ware = gameDataStore.waresMap[item.id]
            return {
              ...item,
              displayName: ware ? translateWare(ware) : item.id
            }
          })
        }
      })
    }
  }

  // Default: materials
  return {
    totalValue: currentAnalysis.totalCost,
    unit: 'Cr',
    summaryItems: currentAnalysis.summaryItems.map((item: any) => {
      const ware = gameDataStore.waresMap[item.id]
      return {
        ...item,
        displayName: ware ? translateWare(ware) : item.id
      }
    }),
    moduleGroups: currentAnalysis.moduleGroups.map((group: any) => {
      const moduleData = gameDataStore.modulesMap[group.id]
      return {
        ...group,
        displayName: moduleData ? translateModule(moduleData) : group.id,
        displayValue: group.value,
        items: group.items.map((item: any) => {
          const ware = gameDataStore.waresMap[item.id]
          return {
            ...item,
            displayName: ware ? translateWare(ware) : item.id
          }
        })
      }
    })
  }
})
const getSummaryTitle = () => {
  if (viewMode.value === 'workers') return t('station.summary_workforce')
  if (viewMode.value === 'volume') return t('station.summary_volume')
  return t('station.summary_cost')
}

const headerTitle = computed(() => {
  if (viewMode.value === 'workers') return t('station.header_workforce')
  if (viewMode.value === 'volume') return t('station.header_volume')
  if (viewMode.value === 'time') return t('station.header_time')
  return t('station.header_costs')
})

const hasDashboardData = computed(() => {
  return data.value.moduleGroups.length > 0 || (viewMode.value === 'workers' && store.settings.useHQ)
})
</script>

<template>
  <div class="dashboard-container">
    <!-- Header with View Mode Switcher -->
    <div class="dashboard-header">
      <h3 class="header-title">{{ headerTitle }}</h3>
      
      <div class="header-right-group">
        <ViewTabUi v-model="viewMode" :views="views" color-style="sky" ui-key="station-dashboard" />
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar" v-if="analysis.moduleGroups.length > 0">
      <!-- Row 1: Cost, Volume, Workers Needed -->
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_cost') }}</span>
        <span class="stat-value text-red-400">{{ formatLargeNum(analysis.totalCost) }} <small>Cr</small></span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_volume') }}</span>
        <span class="stat-value text-blue-400">{{ formatLargeNum(analysis.totalVolume) }} <small>m³</small></span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_workers_needed') }}</span>
        <span class="stat-value text-emerald-400">{{ formatNum(analysis.totalNeeded) }}</span>
      </div>

      <!-- Row 2: Time, Ships, Efficiency -->
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_time') }}</span>
        <span class="stat-value text-red-400">{{ formatTime(analysis.totalTime) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_transport_trips') }}</span>
        <span class="stat-value text-blue-400">
          {{ Math.ceil(analysis.totalVolume / transportShipCapacity) }}
          <small class="text-xs text-slate-500 font-normal">({{ formatLargeNum(transportShipCapacity) }})</small>
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ t('station.summary_efficiency') }}</span>
        <span class="stat-value" :class="workforceEfficiencyColor">
          {{ workforceEfficiencyText }}
        </span>
      </div>
    </div>

    <!-- Scrollable Content Area -->
    <div class="dashboard-content custom-scrollbar">
      <div v-if="hasDashboardData">
        <!-- Summary Group -->
        <StationModuleDetail 
          v-if="viewMode !== 'time'"
          variant="summary"
          :title="getSummaryTitle()" 
          :value="data.totalValue" 
          :items="data.summaryItems"
          :unit="data.unit"
          :is-workers="data.isWorkers"
          :is-volume="data.isVolume"
        />

        <!-- Individual Module Groups -->
        <StationModuleDetail 
          v-for="group in data.moduleGroups" 
          :key="group.id"
          variant="module"
          :count="group.count"
          :title="group.displayName" 
          :value="group.displayValue" 
          :items="group.items"
          :unit="data.unit"
          :is-time="viewMode === 'time'"
          :is-workers="viewMode === 'workers'"
          :is-volume="viewMode === 'volume'"
        />
      </div>
      
      <!-- Empty State -->
      <EmptyState v-else class="empty-state" />
    </div>

    <!-- Footer with Controls -->
    <div class="dashboard-footer" v-if="hasDashboardData && (viewMode === 'materials' || (!props.hideWorkersView && viewMode === 'workers') || viewMode === 'volume')">
      <div v-if="viewMode === 'materials'" class="simulation-controls">
        <PriceSlider 
          v-model="buildPriceMultiplier" 
          :label="t('station.control_price_multiplier')" 
          type="buy" 
        />
      </div>

      <div v-if="viewMode === 'volume'" class="simulation-controls">
        <VolumeControlSlider
          v-model="transportShipCapacity"
          :label="t('station.control_transport_capacity')"
          type="transport"
          :min="5000"
          :max="62000"
          :step="1000"
          unit="m³"
        />
      </div>

      <div v-if="!props.hideWorkersView && viewMode === 'workers'" class="workforce-control-panel">
        <div class="control-header">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-500 font-bold uppercase">{{ t('station.control_actual_workforce') }}</span>

            <X4NumberInput v-if="!store.settings.workforceAuto" v-model="manualWorkforce"
              :max="analysis.totalCapacity" width-class="w-24" />
            <span v-else class="val-text-display">
              {{ store.actualWorkforce }}
            </span>
          </div>
          <span class="percent-display">{{ Math.round((store.actualWorkforce / (analysis.totalCapacity || 1)) * 100)
            }}%</span>
        </div>

        <div class="slider-container">
          <input type="range" v-model.number="saturationPercent" min="0" max="100"
            :disabled="store.settings.workforceAuto" class="range-slider">
          <div class="slider-track-bg">
            <div class="slider-fill" :style="{ width: `${saturationPercent}%` }"></div>
          </div>
        </div>

        <div class="flex items-center justify-between mt-2">
          <label class="auto-toggle group">
            <input type="checkbox" v-model="workforceAuto" class="hidden">
            <div class="cb" :class="{ 'cb-active': store.settings.workforceAuto }">
              <div v-if="store.settings.workforceAuto" class="cb-inner"></div>
            </div>
            <span class="text-[11px] font-bold italic uppercase"
              :class="store.settings.workforceAuto ? 'text-sky-400' : 'text-slate-500'">
              {{ t('station.auto_calc') }} ({{ t('station.limit') }}: {{ formatNum(maxAllowedWorkforce) }})
            </span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="useHQ" class="cb-sm">
            <span class="text-[9px] text-slate-500 uppercase font-bold">{{ t('station.inc_phq') }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  @apply flex flex-col h-full bg-slate-900/40 rounded-lg border border-slate-800/60 overflow-hidden backdrop-blur-sm;
}

.dashboard-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-800/20;
}

.header-title {
  @apply text-base font-bold text-slate-100 tracking-wider uppercase;
}

.header-right-group {
  @apply flex items-center gap-4;
}

.stats-bar {
  @apply grid grid-cols-3 gap-y-2 gap-x-1 bg-slate-800/60 p-2 mx-2 mt-2 rounded border border-slate-700/50 backdrop-blur-md;
}

.stat-item {
  @apply flex flex-col items-center;
}

.stat-label {
  @apply text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-0.5;
}

.stat-value {
  @apply text-sm font-mono font-bold;
}

.dashboard-content {
  @apply flex-1 overflow-y-auto p-2 space-y-1;
}

.dashboard-footer {
  @apply p-4 border-t border-slate-800/60 bg-slate-800/20;
}

.simulation-controls {
  @apply flex items-center justify-center;
}

.workforce-control-panel {
  @apply bg-slate-900/50 p-3 rounded border border-slate-700/50;
}

.control-header {
  @apply flex justify-between items-center mb-2;
}

.val-text-display {
  @apply text-sm font-mono font-bold text-sky-400/90 h-6 flex items-center px-1.5;
}

.percent-display {
  @apply text-sm font-mono text-slate-500 font-bold;
}

.slider-container {
  @apply relative w-full h-6 flex items-center;
}

.range-slider {
  @apply absolute z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed;
}

.slider-track-bg {
  @apply w-full h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden;
}

.slider-fill {
  @apply h-full bg-slate-500 transition-all duration-200;
}

.auto-toggle {
  @apply flex items-center gap-2 cursor-pointer select-none;
}

.cb {
  @apply w-4 h-4 rounded bg-slate-950 border border-slate-700 flex items-center justify-center transition-all;
}

.cb-active {
  @apply border-sky-500/50 bg-sky-500/10;
}

.cb-inner {
  @apply w-2 h-2 bg-sky-500 rounded-sm;
}

.cb-sm {
  @apply w-3 h-3 rounded bg-slate-900 border-slate-700 accent-sky-500;
}

.total-time-summary {
  @apply flex justify-between items-center px-4 py-3 mb-2 bg-slate-800/40 rounded-lg border border-slate-700/30;
}

.total-time-summary .label {
  @apply text-sm font-bold text-slate-300;
}

.total-time-summary .value {
  @apply text-sm font-bold text-sky-400 font-mono;
}

/* Custom Scrollbar Style */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-slate-700/50 rounded-full hover:bg-slate-600;
}
</style>
