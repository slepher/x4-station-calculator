<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'

const store = useStationStore()
const showExpenses = ref(true)
const showProduction = ref(true)

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const data = computed(() => store.profitBreakdown)
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">Production Per Hour</h3>
      <span class="header-subtitle">Amount</span>
    </div>

    <div>
      <div>
        <div @click="showExpenses = !showExpenses" class="section-header">
          <div class="section-label text-red-400 font-medium">
             <span class="arrow-icon" :class="showExpenses ? 'rotate-90' : ''">▶</span>
             Expenses
          </div>
          <span class="value-text text-red-400">{{ formatNum(-data.expenses.total) }}</span>
        </div>
        
        <div v-show="showExpenses" class="list-container">
           <div v-for="item in data.expenses.list" :key="item.id" class="list-item">
             <span class="text-red-400/80">{{ formatNum(item.amount) }} x {{ item.name }}</span>
             <span class="font-mono text-red-500">{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div>
        <div @click="showProduction = !showProduction" class="section-header">
          <div class="section-label text-sky-400 font-medium">
             <span class="arrow-icon" :class="showProduction ? 'rotate-90' : ''">▶</span>
             Production
          </div>
          <span class="value-text text-sky-400">+{{ formatNum(data.production.total) }}</span>
        </div>
        
        <div v-show="showProduction" class="list-container">
           <div v-for="item in data.production.list" :key="item.id" class="list-item">
             <span class="text-sky-400/80">{{ formatNum(item.amount) }} x {{ item.name }}</span>
             <span class="font-mono text-sky-500">+{{ formatNum(item.value) }}</span>
           </div>
        </div>
      </div>

      <div class="profit-footer">
         <span class="profit-label">
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
           Profit
         </span>
         <span class="profit-value">{{ formatNum(data.profit) }}</span>
      </div>
      
      <div class="sliders-footer">
         <div class="mb-3">
           <div class="slider-label">
             <span>Resources Price: <span class="text-white">Average</span></span>
           </div>
           <input type="range" class="slider-input accent-red-500">
         </div>
         <div>
           <div class="slider-label">
             <span>Products Price: <span class="text-white">Average</span></span>
           </div>
           <input type="range" class="slider-input accent-sky-500">
         </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container {
  @apply bg-slate-800 rounded border border-slate-700 overflow-hidden text-sm mt-4;
}
.panel-header {
  @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700;
}
.header-title {
  @apply font-bold text-slate-200;
}
.header-subtitle {
  @apply font-mono text-xs;
}
.section-header {
  @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors;
}
.section-label {
  @apply flex items-center gap-2;
}
.arrow-icon {
  @apply text-[10px] text-slate-500 transform transition-transform duration-200;
}
.value-text {
  @apply font-mono;
}
.list-container {
  @apply bg-slate-900/30 border-b border-slate-700/50;
}
.list-item {
  @apply flex justify-between items-center px-3 py-1 text-xs hover:bg-slate-800/50 transition-colors;
}
.profit-footer {
  @apply flex justify-between px-3 py-3 bg-slate-800 border-t border-slate-600 font-bold;
}
.profit-label {
  @apply text-green-500 flex items-center gap-2;
}
.profit-value {
  @apply font-mono text-green-500;
}
.sliders-footer {
  @apply px-3 pb-3 pt-1 bg-slate-800;
}
.slider-label {
  @apply flex justify-between text-xs text-slate-400 mb-1;
}
.slider-input {
  @apply w-full h-1 bg-slate-600 rounded appearance-none;
}
</style>