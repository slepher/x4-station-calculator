<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n';

import StationWareFlow from './StationWareFlow.vue'
import PriceSlider from '@/components/PriceSlider.vue'
import VolumeControlSlider from '@/components/VolumeControlSlider.vue'

const store = useStationStore()
const { t } = useI18n();
const { translateWare } = useX4I18n()

// 视图模式状态管理
const viewMode = ref<'quantity' | 'volume' | 'economy'>('quantity')



// 格式化函数
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))



// 资源流向列表计算：使用 wareFlowList 替代 netProduction
const wareFlowList = computed(() => {
  return store.wareFlowList.map(flow => {
    const wareInfo = store.wares[flow.wareId]
    return {
      id: flow.wareId,
      name: wareInfo ? translateWare(wareInfo) : flow.wareId,
      netRate: flow.netRate,
      details: flow.contributions,
      // 新增体积和经济数据
      netVolume: flow.netVolume,
      netValue: flow.netValue,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      // 新增仓储规划数据
       totalOccupiedVolume: flow.totalOccupiedVolume,
       totalOccupiedCount: flow.totalOccupiedCount
    }
  })
})

// 体积数据分组功能
const volumeGroups = computed(() => {
  const groups = {
    solid: [] as any[],
    liquid: [] as any[],
    container: [] as any[]
  }
  
  store.wareFlowList.forEach(flow => {
    const wareInfo = store.wares[flow.wareId]
    const item = {
      id: flow.wareId,
      name: wareInfo ? translateWare(wareInfo) : flow.wareId,
      netVolume: flow.netVolume,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      totalOccupiedVolume: flow.totalOccupiedVolume,
      totalOccupiedCount: flow.totalOccupiedCount,
      // 添加明细数据用于展开显示
      details: flow.contributions || []
    }
    
    if (flow.transportType === 'solid') {
      groups.solid.push(item)
    } else if (flow.transportType === 'liquid') {
      groups.liquid.push(item)
    } else {
      groups.container.push(item)
    }
  })
  
  return groups
})

// 经济视图数据分组功能
const economyGroups = computed(() => {
  const groups = {
    income: [] as any[],      // 产品收入（正净价值）
    operations: [] as any[],  // 运营支出（运输类型为container的负净价值）
    resources: [] as any[]    // 资源支出（非container类型的负净价值）
  }
  
  store.wareFlowList.forEach(flow => {
    const wareInfo = store.wares[flow.wareId]
    const item = {
      id: flow.wareId,
      name: wareInfo ? translateWare(wareInfo) : flow.wareId,
      netValue: flow.netValue,
      transportType: flow.transportType
    }
    
    if (flow.netValue > 0) {
      // 产品收入：正值
      groups.income.push(item)
    } else if (flow.transportType === 'container') {
      // 运营支出：container类型的负值
      groups.operations.push(item)
    } else {
      // 资源支出：非container类型的负值
      groups.resources.push(item)
    }
  })
  
  // 按netValue绝对值降序排序
  groups.income.sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue))
  groups.operations.sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue))
  groups.resources.sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue))
  
  return groups
})

// 总利润计算
const totalProfit = computed(() => {
  return store.wareFlowList.reduce((sum, flow) => sum + flow.netValue, 0)
})

// 获取经济详情的方法
const getEconomyDetails = (wareId: string) => {
  const flow = store.wareFlowList.find(f => f.wareId === wareId);
  return flow?.contributions || [];
}

</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ viewMode === 'quantity' ? t('ui.resource_overview') || 'Resource Production Overview' : 
           viewMode === 'economy' ? t('profit.title') || 'Economic Overview' : 
           t('ui.volume_overview') || 'Volume Overview' }}
      </h3>

      <div class="header-right-group">
        <!-- 视图模式切换按钮 -->
        <div class="view-mode-switcher">
          <button 
            :class="['view-mode-btn', viewMode === 'quantity' ? 'active' : '']"
            @click="viewMode = 'quantity'">
            {{ t('ui.quantity_view') || 'Q' }}
          </button>
          <button 
            :class="['view-mode-btn', viewMode === 'volume' ? 'active' : '']"
            @click="viewMode = 'volume'">
            {{ t('ui.volume_view') || 'V' }}
          </button>
          <button 
            :class="['view-mode-btn', viewMode === 'economy' ? 'active' : '']"
            @click="viewMode = 'economy'">
            {{ t('ui.economy_view') || 'E' }}
          </button>
        </div>

        <span class="header-badge">
          {{ t('ui.hourly_rate') || 'Hourly Rate' }}
        </span>
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <!-- 体积视图：显示分组数据 -->
      <div v-if="viewMode === 'volume'" class="volume-groups-container">
        <div v-if="volumeGroups.container.length > 0" class="volume-group">
          <div class="volume-group-header">
            <h4 class="volume-group-title">{{ t('ui.container_group') || '集装箱' }}</h4>
            <span class="volume-group-planning">{{ formatNum(volumeGroups.container.reduce((sum, item) => sum + Math.abs(item.totalOccupiedVolume || 0), 0)) }}m³</span>
          </div>
          <StationWareFlow v-for="item in volumeGroups.container" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="item.netVolume" 
            :netValue="0" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>
        
        <div v-if="volumeGroups.solid.length > 0" class="volume-group">
          <div class="volume-group-header">
            <h4 class="volume-group-title">{{ t('ui.solid_group') || '固体' }}</h4>
            <span class="volume-group-planning">{{ formatNum(volumeGroups.solid.reduce((sum, item) => sum + Math.abs(item.totalOccupiedVolume || 0), 0)) }}m³</span>
          </div>
          <StationWareFlow v-for="item in volumeGroups.solid" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="item.netVolume" 
            :netValue="0" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>
        
        <div v-if="volumeGroups.liquid.length > 0" class="volume-group">
          <div class="volume-group-header">
            <h4 class="volume-group-title">{{ t('ui.liquid_group') || '液体' }}</h4>
            <span class="volume-group-planning">{{ formatNum(volumeGroups.liquid.reduce((sum, item) => sum + Math.abs(item.totalOccupiedVolume || 0), 0)) }}m³</span>
          </div>
          <StationWareFlow v-for="item in volumeGroups.liquid" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="item.netVolume" 
            :netValue="0" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>
      </div>
      
      <!-- 经济视图：显示分组数据 -->
      <div v-if="viewMode === 'economy'" class="economy-groups-container space-y-1">
        <!-- 产品收入组 -->
        <div v-if="economyGroups.income.length > 0" class="economy-group">
          <div class="economy-group-header">
            <h4 class="economy-group-title">{{ t('ui.income_group') || '产品收入' }}</h4>
            <span class="economy-group-sum positive">+{{ formatNum(economyGroups.income.reduce((sum, item) => sum + item.netValue, 0)) }} Cr</span>
          </div>
          <StationWareFlow v-for="item in economyGroups.income" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="0" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="0" 
            :totalOccupiedVolume="0"
            :totalOccupiedCount="0"
            :details="getEconomyDetails(item.id)" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>

        <!-- 运营支出组 -->
        <div v-if="economyGroups.operations.length > 0" class="economy-group">
          <div class="economy-group-header">
            <h4 class="economy-group-title">{{ t('ui.operations_group') || '运营支出' }}</h4>
            <span class="economy-group-sum negative">-{{ formatNum(Math.abs(economyGroups.operations.reduce((sum, item) => sum + item.netValue, 0))) }} Cr</span>
          </div>
          <StationWareFlow v-for="item in economyGroups.operations" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="0" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="0" 
            :totalOccupiedVolume="0"
            :totalOccupiedCount="0"
            :details="getEconomyDetails(item.id)" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>

        <!-- 资源支出组 -->
        <div v-if="economyGroups.resources.length > 0" class="economy-group">
          <div class="economy-group-header">
            <h4 class="economy-group-title">{{ t('ui.resources_group') || '资源支出' }}</h4>
            <span class="economy-group-sum negative">-{{ formatNum(Math.abs(economyGroups.resources.reduce((sum, item) => sum + item.netValue, 0))) }} Cr</span>
          </div>
          <StationWareFlow v-for="item in economyGroups.resources" :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="0" 
            :netVolume="0" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="0" 
            :totalOccupiedVolume="0"
            :totalOccupiedCount="0"
            :details="getEconomyDetails(item.id)" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>
        
        <div v-if="wareFlowList.length === 0" class="empty-container">
          <div class="empty-icon-wrapper">
            <span class="empty-icon-text">!</span>
          </div>
          <p class="empty-main-text">{{ t('ui.no_active_production') || '暂无活跃生产周期' }}</p>
          <p class="empty-sub-text">{{ t('ui.add_modules_hint') || '请添加模块以查看数据' }}</p>
        </div>
      </div>
      
      <!-- 数量视图：显示资源列表 -->
      <StationWareFlow v-if="viewMode === 'quantity'" v-for="flow in wareFlowList" :key="flow.id" 
        :resourceId="flow.id" 
        :name="flow.name" 
        :netRate="flow.netRate" 
        :netVolume="flow.netVolume" 
        :netValue="0" 
        :transportType="flow.transportType" 
        :unitVolume="flow.unitVolume" 
        :totalOccupiedVolume="flow.totalOccupiedVolume"
        :totalOccupiedCount="flow.totalOccupiedCount"
        :details="flow.details" 
        :locked="store.isWareLocked(flow.id)"
        :viewMode="viewMode"
        @update:locked="store.toggleWareLock(flow.id)" />

      <div v-if="wareFlowList.length === 0 && viewMode !== 'economy'" class="empty-container">
        <div class="empty-icon-wrapper">
          <span class="empty-icon-text">!</span>
        </div>
        <p class="empty-main-text">{{ t('ui.no_active_production') || '暂无活跃生产周期' }}</p>
        <p class="empty-sub-text">{{ t('ui.add_modules_hint') || '请添加模块以查看数据' }}</p>
      </div>
    </div>

    <!-- 体积控件部分 -->
    <div class="volume-controls-section" v-if="viewMode === 'volume'">
      <div class="simulation-controls flex flex-row gap-4">
        <VolumeControlSlider 
          v-model="store.settings.resourceBufferHours" 
          :label="t('ui.resource_buffer_hours')" 
          type="resource" 
          :max="24" 
          :step="1" />
        <VolumeControlSlider 
          v-model="store.settings.productBufferHours" 
          :label="t('ui.product_buffer_hours')" 
          type="product" 
          :max="24" 
          :step="1" />
      </div>
    </div>

    <!-- 利润分析部分 -->
    <div class="profit-section" v-if="viewMode === 'economy'">
      <div class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="store.settings.buyMultiplier" :label="t('profit.res_price')" type="buy" />
        <PriceSlider v-model="store.settings.sellMultiplier" :label="t('profit.prod_price')" type="sell" />
      </div>

      <!-- 总利润 -->
      <div class="profit-footer">
        <span class="profit-label">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
          {{ t('profit.footer') }}
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
  @apply text-sm font-bold text-slate-300 tracking-wide uppercase;
}

.header-right-group {
  @apply flex items-center gap-3;
}

.view-mode-switcher {
  @apply flex items-center gap-1 bg-slate-800/50 rounded-md p-1;
}

.view-mode-btn {
  @apply px-2 h-6 rounded text-xs font-medium transition-all duration-200;
  @apply bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-700/50;
}

.view-mode-btn.active {
  @apply bg-amber-500 text-slate-900 shadow-md;
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

.empty-container {
  @apply py-12 flex flex-col items-center justify-center opacity-30;
}

.empty-icon-wrapper {
  @apply w-12 h-12 border-2 border-dashed border-slate-500 rounded-full mb-3 flex items-center justify-center;
}

.empty-icon-text {
  @apply text-xl;
}

.empty-main-text {
  @apply text-xs font-medium;
}

.empty-sub-text {
  @apply text-[10px];
}

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
  @apply text-sm font-mono text-slate-400;
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
  @apply text-green-400;
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
</style>