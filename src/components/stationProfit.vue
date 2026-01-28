<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'
import { useI18n } from 'vue-i18n'
import PriceSlider from '@/components/PriceSlider.vue'

const store = useStationStore()
const { translateWare } = useX4I18n()
const { t } = useI18n()

// 折叠状态管理
const isExpensesOpen = ref(true)
const isProductionOpen = ref(true)

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

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
      <h3 class="header-title">{{ t('profit.title') }}</h3>
      <span class="header-subtitle">{{ t('profit.unit') }}</span>
    </div>

    <div class="content">
      <div class="simulation-controls gap-12">
        <PriceSlider v-model="store.settings.buyMultiplier" :label="t('profit.res_price')" type="buy" />
        <PriceSlider v-model="store.settings.sellMultiplier" :label="t('profit.prod_price')" type="sell" />
      </div>

      <div class="section section-expenses">
        <div class="section-header" @click="isExpensesOpen = !isExpensesOpen">
          <div class="section-label">
            <span :class="['arrow', { 'arrow-open': isExpensesOpen }]">▶</span>
            {{ t('profit.expenses') }}
          </div>
          <span class="total-val">{{ formatNum(-data.expenses.total) }}</span>
        </div>
        <div v-show="isExpensesOpen" class="list-box">
           <div v-for="item in data.expenses.list" :key="item.id" class="list-item">
             <span class="item-name">
               <span class="qty">{{ formatNum(item.amount) }}</span>
               <span class="symbol">x</span>
               <span class="name">{{ item.displayName }}</span>
             </span>
             <span class="item-val">{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div class="section section-production">
        <div class="section-header" @click="isProductionOpen = !isProductionOpen">
          <div class="section-label">
            <span :class="['arrow', { 'arrow-open': isProductionOpen }]">▶</span>
            {{ t('profit.production') }}
          </div>
          <span class="total-val">+{{ formatNum(data.production.total) }}</span>
        </div>
        <div v-show="isProductionOpen" class="list-box">
           <div v-for="item in data.production.list" :key="item.id" class="list-item">
             <span class="item-name">
               <span class="qty">{{ formatNum(item.amount) }}</span>
               <span class="symbol">x</span>
               <span class="name">{{ item.displayName }}</span>
             </span>
             <span class="item-val">+{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div class="profit-footer">
         <span class="profit-label">
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
           {{ t('profit.footer') }}
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
.header-subtitle { @apply font-mono text-[10px] text-slate-500 uppercase; }
.simulation-controls { @apply p-4 bg-slate-900/50 border-b border-slate-700 flex flex-row; }

/* 基础结构 */
.section-header { @apply flex justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors select-none; }
.section-label { @apply flex items-center gap-2 font-bold text-[11px] uppercase; }
.arrow { @apply text-[8px] text-slate-500 mr-1 transition-transform duration-200; }
.arrow-open { @apply rotate-90; }
.total-val { @apply font-mono font-bold; }

.list-box { @apply bg-slate-950/30 border-b border-slate-700/50; }
.list-item { @apply flex justify-between items-center px-4 py-1.5 text-[11px] hover:bg-slate-800/50 transition-colors border-b border-slate-800/30 last:border-0; }
.item-name { @apply flex items-center gap-1; }
.item-name .qty { @apply font-mono; }
.item-name .symbol { @apply opacity-30 scale-90; }

/* --- 支出模块色彩封装 --- */
.section-expenses .section-label, 
.section-expenses .total-val { @apply text-red-400; }
.section-expenses .arrow-open { @apply text-red-400; }

.section-expenses .list-item .item-name { @apply text-red-400/70; }
.section-expenses .list-item .qty { @apply text-red-400/80; }
.section-expenses .list-item .item-val { @apply font-mono font-medium text-red-500; }

/* --- 产出模块色彩封装 --- */
.section-production .section-label, 
.section-production .total-val { @apply text-sky-400; }
.section-production .arrow-open { @apply text-sky-400; }

.section-production .list-item .item-name { @apply text-sky-400/70; }
.section-production .list-item .qty { @apply text-sky-400/80; }
.section-production .list-item .item-val { @apply font-mono font-medium text-sky-500; }

/* 底部汇总 */
.profit-footer { @apply flex justify-between px-4 py-4 bg-slate-900 border-t border-slate-600; }
.profit-label { @apply text-emerald-400 flex items-center gap-2 font-black uppercase text-xs italic; }
.profit-val { @apply font-mono text-emerald-400 text-lg font-black; }
</style>