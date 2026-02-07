<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n';

import StationWareFlow from './StationWareFlow.vue'
import PriceSlider from '@/components/PriceSlider.vue'

const store = useStationStore()
const { t } = useI18n();
const { translateWare } = useX4I18n()

// 视图模式状态管理
const viewMode = ref<'quantity' | 'volume' | 'economy'>('quantity')

// 折叠状态管理
const isProfitOpen = ref(true)

// 格式化函数
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

// 利润数据计算
const profitData = computed(() => {
  const raw = store.profitBreakdown;
  const formatMap = (section: any) => {
    const source = section?.items || {};
    return Object.entries(source).map(([id, details]: [string, any]) => ({
      id,
      amount: details?.amount ?? 0,
      value: details?.value ?? 0,
      displayName: store.wares[id] ? translateWare(store.wares[id]) : id
    })).sort((a, b) => b.value - a.value);
  };

  return {
    profit: raw.profit ?? 0,
    expenses: { total: raw.totalExpense ?? 0, list: formatMap(raw.expenses) },
    production: { total: raw.totalRevenue ?? 0, list: formatMap(raw.production) }
  };
});

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
      unitVolume: flow.unitVolume
    }
  })
})

</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ viewMode === 'quantity' ? t('ui.resource_overview') || 'Resource Production Overview' : 
           viewMode === 'economy' ? t('profit.title') || 'Economic Overview' : 
           'Volume Overview' }}
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
            @click="viewMode = 'volume'"
            disabled>
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
      <StationWareFlow v-for="flow in wareFlowList" :key="flow.id" 
        :resourceId="flow.id" 
        :name="flow.name" 
        :netRate="flow.netRate" 
        :netVolume="flow.netVolume" 
        :netValue="flow.netValue" 
        :transportType="flow.transportType" 
        :unitVolume="flow.unitVolume" 
        :details="flow.details" 
        :locked="store.isWareLocked(flow.id)"
        :viewMode="viewMode"
        @update:locked="store.toggleWareLock(flow.id)" />

      <div v-if="wareFlowList.length === 0" class="empty-container">
        <div class="empty-icon-wrapper">
          <span class="empty-icon-text">!</span>
        </div>
        <p class="empty-main-text">{{ t('ui.no_active_production') || '暂无活跃生产周期' }}</p>
        <p class="empty-sub-text">{{ t('ui.add_modules_hint') || '请添加模块以查看数据' }}</p>
      </div>
    </div>

    <!-- 利润分析部分 -->
    <div class="profit-section" v-if="viewMode === 'economy'">
      <div class="simulation-controls">
        <PriceSlider v-model="store.settings.buyMultiplier" :label="t('profit.res_price')" type="buy" />
        <PriceSlider v-model="store.settings.sellMultiplier" :label="t('profit.prod_price')" type="sell" />
      </div>

      <div class="profit-details">
        <div class="profit-item">
          <span class="profit-label">{{ t('profit.production') }}</span>
          <span class="profit-value positive">+{{ formatNum(profitData.production.total) }}</span>
        </div>
        <div class="profit-item">
          <span class="profit-label">{{ t('profit.expenses') }}</span>
          <span class="profit-value negative">-{{ formatNum(profitData.expenses.total) }}</span>
        </div>
        <div class="profit-total">
          <span class="profit-label">{{ t('profit.footer') }}</span>
          <span class="profit-value" :class="profitData.profit >= 0 ? 'positive' : 'negative'">
            {{ formatNum(profitData.profit) }} Cr
          </span>
        </div>
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

/* 利润分析样式 */
.profit-section {
  @apply border-t border-slate-700/50;
}

.simulation-controls {
  @apply p-4 bg-slate-900/50 border-b border-slate-700/50 flex flex-col gap-3;
}

.profit-details {
  @apply p-4;
}

.profit-item, .profit-total {
  @apply flex justify-between items-center py-2 border-b border-slate-700/30 last:border-0;
}

.profit-label {
  @apply text-sm font-medium text-slate-400;
}

.profit-value {
  @apply font-mono font-bold;
}

.profit-value.positive {
  @apply text-emerald-400;
}

.profit-value.negative {
  @apply text-red-400;
}

.profit-total {
  @apply border-t border-slate-600/50 mt-2 pt-3;
}

.profit-total .profit-label {
  @apply font-bold text-slate-300;
}

.profit-total .profit-value {
  @apply text-lg;
}
</style>