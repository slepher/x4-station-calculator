<script setup lang="tsx">
import { computed, ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n';

import PriceSlider from '@/components/common/PriceSlider.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'
import StationWareFlowGroup from './StationWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const store = useStationStore()
const { t, locale } = useI18n();
const { translateWare } = useX4I18n()

type ViewMode = 'quantity' | 'volume' | 'economy'

// 视图模式状态管理
const viewMode = ref<ViewMode>('quantity')

// 格式化函数
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

// 从store获取已排序和分组好的数据
const groupedFlows = computed(() => store.groupedFlows)

// 辅助函数：为UI提供名称翻译后的包装对象
const wrapFlow = (flow: any) => {
  const wareInfo = store.wares[flow.wareId]
  return {
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId,
    ...flow
  }
}

// 总利润计算
const totalProfit = computed(() => {
  return groupedFlows.value.flows.reduce((sum, flow) => sum + flow.netValue, 0)
})

const getGroupVolume = (group: any[]) => 
  formatNum(group.reduce((sum, item) => sum + Math.abs(item.totalOccupiedVolume || 0), 0))

const getGroupSymboledValue = (group: any[]) => {
  const value = group.reduce((sum, item) => sum + Math.abs(item.netValue || 0), 0)
  const symbol = value >= 0 ? '+' : '-'
  return symbol + formatNum(Math.abs(value))
  }

const title = () => {
  if (viewMode.value === 'quantity') {
    return t('wareflow.resource_overview')
  } else if (viewMode.value === 'economy') {
    return t('wareflow.profit_title')
  } else {
    return t('station.header_volume')
  }
}

const modes = computed<{"key": ViewMode; title: string}[]>(() => {
  locale.value
  return [
  {key: 'quantity', title: t('wareflow.quantity_view')},
  {key: 'economy', title: t('wareflow.economy_view')},
  {key: 'volume', title: t('wareflow.volume_view')}
]})

const volumeGroups = computed(() => [
  {key: 'container', title: t('wareflow.container_group'),
   items: groupedFlows.value.volumeGroups.container.map(wrapFlow)},
  {key: 'solid', title: t('wareflow.solid_group'),
   items: groupedFlows.value.volumeGroups.solid.map(wrapFlow)},
  {key: 'liquid', title: t('wareflow.liquid_group'),
   items: groupedFlows.value.volumeGroups.liquid.map(wrapFlow)}
])

const rateGroups = computed(() => ([
  {key: 'positive',
   symbolClass: "positive",
   title: viewMode.value === 'economy' ? t('wareflow.income_group') : t('wareflow.products_group'),
   items: groupedFlows.value.rateGroups.positive.map(wrapFlow)},
  {key: 'operations',
   symbolClass: "negative",
   title: viewMode.value === 'economy' ? t('wareflow.expenses_operations_group') : t('wareflow.operations_group'),
   items: groupedFlows.value.rateGroups.operations.map(wrapFlow)},
  {key: 'resources', 
   symbolClass: "negative",
   title: viewMode.value === 'economy' ? t('wareflow.expenses_resources_group') : t('wareflow.resources_group'),
   items: groupedFlows.value.rateGroups.resources.map(wrapFlow)}
]))
</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ title() }}
      </h3>

      <div class="header-right-group">
        <!-- 视图模式切换按钮 -->
        <div class="view-mode-switcher">
          <button v-for="(item, index) in modes" :key="index"
            :class="['view-mode-btn', viewMode === item.key ? 'active' : '']"
            @click="viewMode = item.key">
            {{ item.title }}
          </button>
        </div>

        <span class="header-badge">
          {{ t('wareflow.hourly_rate') }}
        </span>
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <!-- 体积视图：显示分组数据 -->
      <div v-if="viewMode === 'volume'" class="volume-groups-container">
        <StationWareFlowGroup v-for="(group, index) in volumeGroups" :key="index"
            :title="group.title"
            :items="group.items"
            :viewMode="viewMode"
        >
          <span class="volume-group-planning">
            {{ getGroupVolume(group.items) }}m³
          </span>
          <svg class="w-3.5 h-3.5 text-blue-300/60" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        </StationWareFlowGroup>
      </div>
      
      <!-- 通用分组视图：根据当前视图模式显示对应的数据 -->
      <div v-if="viewMode === 'economy' || viewMode === 'quantity'" class="volume-groups-container">
          <!-- 产品/收入组 -->
          <StationWareFlowGroup v-for="group in rateGroups" :key="group.key"
            :title="group.title" 
            :items="group.items" 
            :viewMode="viewMode" 
          > 
            <span v-if="viewMode === 'economy'" :class="['economy-group-sum', group.symbolClass]"> 
              {{ getGroupSymboledValue(group.items) }} Cr 
            </span> 
          </StationWareFlowGroup>
        <!-- 经济视图空状态 -->
        <EmptyState v-if="viewMode === 'economy' && groupedFlows.flows.length === 0" />
      </div>

      <EmptyState v-if="groupedFlows.flows.length === 0 && viewMode !== 'economy'" />
    </div>

    <!-- 体积控件部分 -->
    <div class="volume-controls-section" v-if="viewMode === 'volume'">
      <div class="simulation-controls flex flex-row gap-4">
        <VolumeControlSlider
          v-model="store.settings.resourceBufferHours"
          :label="t('wareflow.resource_buffer_hours')"
          type="resource"
          :max="24"
          :step="1" />
        <VolumeControlSlider
          v-model="store.settings.primaryProductBufferHours"
          :label="t('wareflow.primary_product_buffer_hours')"
          type="product"
          :max="24"
          :step="1" />
        <VolumeControlSlider
          v-model="store.settings.secondaryProductBufferHours"
          :label="t('wareflow.secondary_product_buffer_hours')"
          type="product"
          :max="24"
          :step="1" />
      </div>
    </div>

    <!-- 利润分析部分 -->
    <div class="profit-section" v-if="viewMode === 'economy'">
      <div class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="store.settings.buyMultiplier" :label="t('wareflow.res_price')" type="buy" />
        <PriceSlider v-model="store.settings.sellMultiplier" :label="t('wareflow.prod_price')" type="sell" />
      </div>

      <!-- 总利润 -->
      <div class="profit-footer">
        <span class="profit-label">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
          {{ t('wareflow.profit_footer') }}
        </span>
        <span class="profit-val" :class="totalProfit >= 0 ? 'positive' : 'negative'">
          {{ formatNum(totalProfit) }} Cr
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-wrapper {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.list-header {
  @apply flex justify-between items-center p-4 bg-slate-800/30 border-b border-slate-700/50;
}

.header-title {
  @apply text-base font-bold text-slate-100 tracking-wider uppercase;
}

.header-right-group {
  @apply flex items-center gap-3;
}

.view-mode-switcher {
  @apply flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-md border border-slate-700/30;
}

.view-mode-btn {
  @apply px-3 py-1 text-[10px] font-bold uppercase tracking-tighter rounded transition-all duration-200 text-slate-500 hover:text-slate-300;
}

.view-mode-btn.active {
  @apply bg-sky-500/20 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)];
}

.view-mode-btn:disabled {
  @apply opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-500;
}

.header-badge {
  @apply px-2 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400 font-bold uppercase tracking-tighter;
}

.list-body {
  @apply p-2 overflow-y-auto;
}

/* Custom Scrollbar Style */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.3);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}

/* 体积控件和利润分析样式 */
.volume-controls-section, .profit-section {
  @apply border-t border-slate-700/50;
}

.simulation-controls {
  @apply p-4 bg-slate-900/50 border-b border-slate-700/50;
}

.profit-details {
  @apply p-4;
}

.profit-item, .profit-total {
  @apply flex justify-between items-center py-2 border-b border-slate-700/30 last:border-0;
}

.profit-economy-label {
  @apply text-sm font-medium text-slate-400;
}

.profit-economy-value {
  @apply font-mono font-bold;
}

.profit-economy-value.positive {
  @apply text-emerald-400;
}

.profit-economy-value.negative {
  @apply text-red-400;
}

.profit-footer {
  @apply flex justify-between px-4 py-4 bg-slate-900 border-t border-slate-600;
}

.profit-label {
  @apply text-emerald-400 flex items-center gap-2 font-black uppercase text-xs italic;
}

.profit-val {
  @apply font-mono text-emerald-400 text-lg font-black;
}

.profit-val.positive {
  @apply text-emerald-400;
}

.profit-val.negative {
  @apply text-red-400;
}

/* 体积视图样式 */
.volume-groups-container {
  @apply space-y-1;
}

.volume-group {
  @apply bg-transparent rounded-lg;
}

.volume-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.volume-group-title {
  @apply text-sm font-bold text-slate-300;
}

.volume-group-planning {
  @apply text-sm font-mono text-blue-400;
}

.volume-item {
  @apply flex justify-between items-center py-2 border-b border-slate-700/20 last:border-0;
}

.volume-item-name {
  @apply text-sm text-slate-400;
}

.volume-item-value {
  @apply font-mono font-bold text-slate-300;
}

/* 经济视图样式 */
.economy-group {
  @apply mb-1;
}

.economy-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.economy-group-title {
  @apply text-sm font-bold text-slate-300;
}

.economy-group-sum {
  @apply text-sm font-mono font-bold;
}

.economy-group-sum.positive {
  @apply text-emerald-400;
}

.economy-group-sum.negative {
  @apply text-red-400;
}

.economy-items {
  @apply pl-3 pr-1 py-1 bg-slate-800/20 rounded mb-1;
}

.economy-item {
  @apply flex justify-between items-center py-1 border-b border-slate-700/20 last:border-0;
}

.economy-item-name {
  @apply text-sm text-slate-400;
}

.economy-item-value {
  @apply text-sm font-mono font-bold;
}

.economy-item-value.positive {
  @apply text-green-400;
}

.economy-item-value.negative {
  @apply text-red-400;
}

/* 资源视图样式 */
.resource-groups-container {
  @apply space-y-1;
}

.resource-group {
  @apply mb-1;
}

.resource-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.resource-group-title {
  @apply text-sm font-bold text-slate-300;
}
</style>