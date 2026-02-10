<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import PriceSlider from '@/components/PriceSlider.vue'
import StationModuleDetail from './StationModuleDetail.vue'

const store = useStationStore()
const { translateModule, translateWare } = useX4I18n()
const { t } = useI18n()

const viewMode = ref<'materials' | 'time' | 'workers'>('materials')
const buildPriceMultiplier = computed({
  get: () => store.buildPriceMultiplier,
  set: (val) => store.buildPriceMultiplier = val
})

const data = computed(() => {
  const analysis = store.stationAnalysis
  
  return {
    totalCost: analysis.totalCost,
    summaryItems: analysis.summaryItems.map(item => {
      const ware = store.wares[item.id]
      return {
        ...item,
        displayName: ware ? translateWare(ware) : item.id
      }
    }),
    moduleGroups: analysis.moduleGroups.map(group => {
      const moduleData = store.modules[group.id]
      return {
        ...group,
        displayName: moduleData ? translateModule(moduleData) : group.id,
        items: group.items.map(item => {
          const ware = store.wares[item.id]
          return {
            ...item,
            displayName: ware ? translateWare(ware) : item.id
          }
        })
      }
    })
  }
})
</script>

<template>
  <div class="dashboard-container">
    <!-- Header with View Mode Switcher -->
    <div class="dashboard-header">
      <h3 class="header-title">{{ t('ui.station_costs') }}</h3>
      
      <div class="header-right-group">
        <div class="view-mode-switcher">
          <button 
            class="view-mode-btn" 
            :class="{ active: viewMode === 'materials' }"
            @click="viewMode = 'materials'"
          >
            {{ t('ui.materials_view') }}
          </button>
          <button 
            class="view-mode-btn disabled" 
            :class="{ active: viewMode === 'time' }"
            @click="viewMode = 'time'"
            title="Coming soon..."
          >
            {{ t('ui.time_view') }}
          </button>
          <button 
            class="view-mode-btn disabled" 
            :class="{ active: viewMode === 'workers' }"
            @click="viewMode = 'workers'"
            title="Coming soon..."
          >
            {{ t('ui.workers_view') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content Area -->
    <div class="dashboard-content custom-scrollbar">
      <div v-if="data.summaryItems.length > 0">
        <!-- Summary Group -->
        <StationModuleDetail 
          variant="summary"
          :title="t('ui.total_build_cost')" 
          :value="data.totalCost" 
          :items="data.summaryItems"
        />

        <!-- Individual Module Groups -->
        <StationModuleDetail 
          v-for="group in data.moduleGroups" 
          :key="group.id"
          variant="module"
          :count="group.count"
          :title="group.displayName" 
          :value="group.value" 
          :items="group.items"
        />
      </div>
      
      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <span class="empty-icon-text">!</span>
        </div>
        <p class="empty-main-text">{{ t('ui.no_active_production') }}</p>
        <p class="empty-sub-text">{{ t('ui.add_modules_hint') }}</p>
      </div>
    </div>

    <!-- Footer with Price Slider -->
    <div class="dashboard-footer">
      <div class="simulation-controls">
        <PriceSlider 
          v-model="buildPriceMultiplier" 
          :label="t('ui.build_res_price')" 
          type="buy" 
        />
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

.view-mode-switcher {
  @apply flex bg-slate-900/60 p-0.5 rounded-md border border-slate-700/30;
}

.view-mode-btn {
  @apply px-3 py-1 text-[10px] font-bold uppercase tracking-tighter rounded transition-all duration-200 text-slate-500 hover:text-slate-300;
}

.view-mode-btn.active {
  @apply bg-sky-500/20 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)];
}

.view-mode-btn.disabled {
  @apply opacity-30 cursor-not-allowed grayscale;
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

.empty-state {
  @apply flex flex-col items-center justify-center h-full py-12 opacity-40;
}

.empty-icon {
  @apply w-12 h-12 rounded-full border-2 border-slate-600 flex items-center justify-center mb-4;
}

.empty-icon-text {
  @apply text-2xl font-black text-slate-500;
}

.empty-main-text {
  @apply text-sm font-bold text-slate-300 mb-1;
}

.empty-sub-text {
  @apply text-xs text-slate-500;
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
