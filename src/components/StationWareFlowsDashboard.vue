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
  // 创建一个映射表，记录wareId与其在allIndustryModules中的首次出现顺序
  const wareOrderMap = new Map<string, number>();
  store.allIndustryModules.forEach((module, index) => {
    const moduleInfo = store.modules[module.id];
    if (moduleInfo) {
      // 记录该模块产出的所有ware的顺序
      Object.keys(moduleInfo.outputs || {}).forEach(wareId => {
        if (!wareOrderMap.has(wareId)) {
          wareOrderMap.set(wareId, index); // 以第一次出现的模块为准
        }
      });
    }
  });
  
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
      orderIndex: wareOrderMap.get(flow.wareId) ?? Number.MAX_SAFE_INTEGER, // 如果没在allIndustryModules中找到，则放在最后
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
  
  // 按allIndustryModules中的顺序排序，如果orderIndex相同则按绝对值降序排序
  groups.solid.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.netVolume) - Math.abs(a.netVolume);
  });
  groups.liquid.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.netVolume) - Math.abs(a.netVolume);
  });
  groups.container.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.netVolume) - Math.abs(a.netVolume);
  });
  
  return groups
})

// 通用分组函数：根据数值正负性和运输类型进行分组
const groupByTypeAndSign = (getValueFn: (flow: any) => number) => {
  const groups = {
    positive: [] as any[],    // 正值项目
    operations: [] as any[],  // 运营项目（运输类型为container的负值）
    resources: [] as any[]    // 资源项目（非container类型的负值）
  }
  
  // 创建一个映射表，记录wareId与其在allIndustryModules中的首次出现顺序
  const wareOrderMap = new Map<string, number>();
  store.allIndustryModules.forEach((module, index) => {
    const moduleInfo = store.modules[module.id];
    if (moduleInfo) {
      // 记录该模块产出的所有ware的顺序
      Object.keys(moduleInfo.outputs || {}).forEach(wareId => {
        if (!wareOrderMap.has(wareId)) {
          wareOrderMap.set(wareId, index); // 以第一次出现的模块为准
        }
      });
    }
  });
  
  store.wareFlowList.forEach(flow => {
    const wareInfo = store.wares[flow.wareId]
    const value = getValueFn(flow)
    const item = {
      id: flow.wareId,
      name: wareInfo ? translateWare(wareInfo) : flow.wareId,
      value: value,
      transportType: flow.transportType,
      orderIndex: wareOrderMap.get(flow.wareId) ?? Number.MAX_SAFE_INTEGER, // 如果没在allIndustryModules中找到，则放在最后
      // 为两种视图保留详细信息
      netRate: flow.netRate,
      netVolume: flow.netVolume,
      netValue: flow.netValue,
      unitVolume: flow.unitVolume,
      totalOccupiedVolume: flow.totalOccupiedVolume,
      totalOccupiedCount: flow.totalOccupiedCount,
      details: flow.contributions
    }
    
    if (value > 0) {
      // 正值：产品/收入
      groups.positive.push(item)
    } else if (flow.transportType === 'container') {
      // 运营：container类型的负值
      groups.operations.push(item)
    } else {
      // 资源：非container类型的负值
      groups.resources.push(item)
    }
  })
  
  // 按allIndustryModules中的顺序排序，如果orderIndex相同则按绝对值降序排序
  groups.positive.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.value) - Math.abs(a.value);
  });
  groups.operations.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.value) - Math.abs(a.value);
  });
  groups.resources.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return Math.abs(b.value) - Math.abs(a.value);
  });
  
  return groups
}

// 计算分组（基于netRate，但netValue的分组逻辑相同）
const rateGroups = computed(() => groupByTypeAndSign(flow => flow.netRate))

// 总利润计算
const totalProfit = computed(() => {
  return store.wareFlowList.reduce((sum, flow) => sum + flow.netValue, 0)
})



</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ viewMode === 'quantity' ? t('ui.resource_overview') : 
           viewMode === 'economy' ? t('profit.title') : 
           t('ui.volume_overview') }}
      </h3>

      <div class="header-right-group">
        <!-- 视图模式切换按钮 -->
        <div class="view-mode-switcher">
          <button 
            :class="['view-mode-btn', viewMode === 'quantity' ? 'active' : '']"
            @click="viewMode = 'quantity'">
            {{ t('ui.quantity_view') }}
          </button>
          <button 
            :class="['view-mode-btn', viewMode === 'volume' ? 'active' : '']"
            @click="viewMode = 'volume'">
            {{ t('ui.volume_view') }}
          </button>
          <button 
            :class="['view-mode-btn', viewMode === 'economy' ? 'active' : '']"
            @click="viewMode = 'economy'">
            {{ t('ui.economy_view') }}
          </button>
        </div>

        <span class="header-badge">
          {{ t('ui.hourly_rate') }}
        </span>
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <!-- 体积视图：显示分组数据 -->
      <div v-if="viewMode === 'volume'" class="volume-groups-container">
        <div v-if="volumeGroups.container.length > 0" class="volume-group">
          <div class="volume-group-header">
            <h4 class="volume-group-title">{{ t('ui.container_group') }}</h4>
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
            <h4 class="volume-group-title">{{ t('ui.solid_group') }}</h4>
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
            <h4 class="volume-group-title">{{ t('ui.liquid_group') }}</h4>
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
      
      <!-- 通用分组视图：根据当前视图模式显示对应的数据 -->
      <div v-if="viewMode === 'economy' || viewMode === 'quantity'" 
           :class="viewMode === 'economy' ? 'economy-groups-container space-y-1' : 'resource-groups-container space-y-1'">
        <!-- 产品/收入组 -->
        <div v-if="rateGroups.positive.length > 0" 
             :class="viewMode === 'economy' ? 'economy-group' : 'resource-group'">
          <div :class="viewMode === 'economy' ? 'economy-group-header' : 'resource-group-header'">
            <h4 :class="viewMode === 'economy' ? 'economy-group-title' : 'resource-group-title'">
              {{ viewMode === 'economy' ? t('ui.income_group') : t('ui.products_group') }}
            </h4>
            <span v-if="viewMode === 'economy'" class="economy-group-sum positive">
              +{{ formatNum(rateGroups.positive.reduce((sum, item) => sum + item.netValue, 0)) }} Cr
            </span>
          </div>
          <StationWareFlow v-for="item in rateGroups.positive" 
            :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="item.netRate" 
            :netVolume="item.netVolume" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>

        <!-- 运营组 -->
        <div v-if="rateGroups.operations.length > 0" 
             :class="viewMode === 'economy' ? 'economy-group' : 'resource-group'">
          <div :class="viewMode === 'economy' ? 'economy-group-header' : 'resource-group-header'">
            <h4 :class="viewMode === 'economy' ? 'economy-group-title' : 'resource-group-title'">
               {{ viewMode === 'economy' ? t('ui.expenses_operations_group') : t('ui.operations_group') }}
             </h4>
            <span v-if="viewMode === 'economy'" class="economy-group-sum negative">
              -{{ formatNum(Math.abs(rateGroups.operations.reduce((sum, item) => sum + item.netValue, 0))) }} Cr
            </span>
          </div>
          <StationWareFlow v-for="item in rateGroups.operations" 
            :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="item.netRate" 
            :netVolume="item.netVolume" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>

        <!-- 资源组 -->
        <div v-if="rateGroups.resources.length > 0" 
             :class="viewMode === 'economy' ? 'economy-group' : 'resource-group'">
          <div :class="viewMode === 'economy' ? 'economy-group-header' : 'resource-group-header'">
            <h4 :class="viewMode === 'economy' ? 'economy-group-title' : 'resource-group-title'">
              {{ viewMode === 'economy' ? t('ui.expenses_resources_group') : t('ui.resources_group') }}
            </h4>
            <span v-if="viewMode === 'economy'" class="economy-group-sum negative">
              -{{ formatNum(Math.abs(rateGroups.resources.reduce((sum, item) => sum + item.netValue, 0))) }} Cr
            </span>
          </div>
          <StationWareFlow v-for="item in rateGroups.resources" 
            :key="item.id" 
            :resourceId="item.id" 
            :name="item.name" 
            :netRate="item.netRate" 
            :netVolume="item.netVolume" 
            :netValue="item.netValue" 
            :transportType="item.transportType" 
            :unitVolume="item.unitVolume" 
            :totalOccupiedVolume="item.totalOccupiedVolume"
            :totalOccupiedCount="item.totalOccupiedCount"
            :details="item.details" 
            :locked="store.isWareLocked(item.id)"
            :viewMode="viewMode"
            @update:locked="store.toggleWareLock(item.id)" />
        </div>
        
        <!-- 经济视图空状态 -->
        <div v-if="viewMode === 'economy' && wareFlowList.length === 0" class="empty-container">
          <div class="empty-icon-wrapper">
            <span class="empty-icon-text">!</span>
          </div>
          <p class="empty-main-text">{{ t('ui.no_active_production') }}</p>
          <p class="empty-sub-text">{{ t('ui.add_modules_hint') }}</p>
        </div>
      </div>

      <div v-if="wareFlowList.length === 0 && viewMode !== 'economy'" class="empty-container">
        <div class="empty-icon-wrapper">
          <span class="empty-icon-text">!</span>
        </div>
        <p class="empty-main-text">{{ t('ui.no_active_production') }}</p>
        <p class="empty-sub-text">{{ t('ui.add_modules_hint') }}</p>
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