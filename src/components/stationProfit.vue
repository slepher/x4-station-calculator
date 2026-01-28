<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'

const store = useStationStore()
const { translateWare } = useX4I18n()

const showExpenses = ref(true)
const showProduction = ref(true)

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

/**
 * 价格文本显示逻辑：50% 显示 Average
 */
const getPriceText = (val: number) => {
  return Math.abs(val - 0.5) < 0.001 ? 'Average' : `${Math.round(val * 100)}%`;
};

/**
 * 格式化利润明细
 */
const data = computed(() => {
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
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">Economic Analysis</h3>
      <span class="header-subtitle">Credits / Hour</span>
    </div>

    <div class="content">
      <div class="simulation-controls">
        <div class="toggle-group">
          <label class="control-toggle">
            <input type="checkbox" v-model="store.settings.minersEnabled" class="cb-input">
            <span class="cb-label">Miners provide basic resources</span>
          </label>
          <label class="control-toggle">
            <input type="checkbox" v-model="store.settings.internalSupply" class="cb-input">
            <span class="cb-label">Resources are provided by other stations</span>
          </label>
        </div>
        
        <div class="slider-group">
          <div class="slider-item">
            <div class="slider-header">
              <span>Resources Price:</span>
              <span class="val-buy">{{ getPriceText(store.settings.buyMultiplier) }}</span>
            </div>
            <input type="range" v-model.number="store.settings.buyMultiplier" min="0" max="1" step="0.05" class="custom-range range-buy">
          </div>
          
          <div class="slider-item">
            <div class="slider-header">
              <span>Products Price:</span>
              <span class="val-sell">{{ getPriceText(store.settings.sellMultiplier) }}</span>
            </div>
            <input type="range" v-model.number="store.settings.sellMultiplier" min="0" max="1" step="0.05" class="custom-range range-sell">
          </div>
        </div>
      </div>

      <div class="section">
        <div @click="showExpenses = !showExpenses" class="section-header group">
          <div class="section-label text-red-400">
             <span :class="['arrow', { 'arrow-open': showExpenses }]">▶</span>
             Running Expenses
          </div>
          <span class="total-val text-red-400">{{ formatNum(-data.expenses.total) }}</span>
        </div>
        
        <div v-show="showExpenses" class="list-box">
           <div v-for="item in data.expenses.list" :key="item.id" class="list-item">
             <span class="item-name text-red-400/70">
               <span class="item-qty">{{ formatNum(item.amount) }}</span> x {{ item.displayName }}
             </span>
             <span class="item-val text-red-500">{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div class="section">
        <div @click="showProduction = !showProduction" class="section-header group">
          <div class="section-label text-sky-400">
             <span :class="['arrow', { 'arrow-open': showProduction }]">▶</span>
             Gross Production
          </div>
          <span class="total-val text-sky-400">+{{ formatNum(data.production.total) }}</span>
        </div>
        
        <div v-show="showProduction" class="list-box">
           <div v-for="item in data.production.list" :key="item.id" class="list-item">
             <span class="item-name text-sky-400/70">
               <span class="item-qty">{{ formatNum(item.amount) }}</span> x {{ item.displayName }}
             </span>
             <span class="item-val text-sky-500">+{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div class="profit-footer">
         <span class="profit-label">
           <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
           Estimated Hourly Profit
         </span>
         <span class="profit-val">{{ formatNum(data.profit) }} Cr</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container { @apply bg-slate-800 rounded border border-slate-700 overflow-hidden text-sm mt-4 shadow-2xl; }
.panel-header { @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700; }
.header-title { @apply font-bold text-slate-200 uppercase tracking-widest text-xs; }
.header-subtitle { @apply font-mono text-[10px] text-slate-500; }

/* 模拟控件样式 [@apply 优化] */
.simulation-controls { @apply p-3 bg-slate-900/50 border-b border-slate-700 space-y-4; }
.toggle-group { @apply flex flex-col gap-2; }
.control-toggle { @apply flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200 transition-colors; }
.cb-input { @apply rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-0; }
.cb-label { @apply font-medium; }
.slider-group { @apply space-y-3 pt-1; }
.slider-item { @apply space-y-1.5; }
.slider-header { @apply flex justify-between text-[10px] uppercase text-slate-500 font-bold tracking-tighter; }
.val-buy { @apply text-sky-400 font-mono; }
.val-sell { @apply text-emerald-400 font-mono; }
.custom-range { @apply w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none; }
.range-buy { @apply accent-sky-500; }
.range-sell { @apply accent-emerald-500; }

.section-header { @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-all; }
.section-label { @apply flex items-center gap-2 font-bold text-[11px] uppercase; }
.arrow { @apply text-[8px] text-slate-500 transform transition-transform; }
.arrow-open { @apply rotate-90 text-white; }
.total-val { @apply font-mono font-bold; }

.list-box { @apply bg-slate-950/30 border-b border-slate-700/50; }
.list-item { @apply flex justify-between items-center px-4 py-1.5 text-[11px] hover:bg-slate-800/50 transition-colors border-b border-slate-800/30 last:border-0; }
.item-qty { @apply font-mono text-slate-500 mr-1; }
.item-val { @apply font-mono font-medium; }

.profit-footer { @apply flex justify-between px-4 py-4 bg-slate-900 border-t border-slate-600 shadow-inner; }
.profit-label { @apply text-emerald-400 flex items-center gap-2 font-black uppercase text-xs italic; }
.icon { @apply w-4 h-4; }
.profit-val { @apply font-mono text-emerald-400 text-lg font-black; }
</style>