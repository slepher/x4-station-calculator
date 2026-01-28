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
 * 格式化利润明细，适配最新的 Map/Object 结构
 */
const data = computed(() => {
  // 增加层层保护
  const raw = store.profitBreakdown || { expenses: {}, production: {}, profit: 0 };
  
  const formatMap = (section: any) => {
    // 兼容多种可能的字段名 (items 或 list)
    const source = section?.items || section?.list || {};
    return Object.entries(source).map(([id, details]: [string, any]) => ({
      id,
      // 这里的 details.amount 如果不存在，就取 details 本身（如果是简单数值）
      amount: typeof details === 'number' ? details : (details?.amount ?? 0),
      value: details?.value ?? 0,
      displayName: store.wares[id] ? translateWare(store.wares[id]) : id
    }));
  };

  return {
    profit: raw.profit ?? 0,
    expenses: { total: raw.expenses?.total ?? 0, list: formatMap(raw.expenses) },
    production: { total: raw.production?.total ?? 0, list: formatMap(raw.production) }
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