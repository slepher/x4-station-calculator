<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import StationModuleList from './StationModuleList.vue'
import ResourceList from './ResourceList.vue'
import StationWorkforce from './StationWorkforce.vue'
import StationProfit from './StationProfit.vue'
import StationConstruction from './StationConstruction.vue'
import LanguageSelector from './LanguageSelector.vue'
import StatusMonitor from './StatusMonitor.vue' // <--- 引入状态监控组件
import MissingTranslate from './MissingTranslate.vue'

const store = useStationStore()

// 这里的格式化逻辑可以保留用于简单的局部显示，复杂逻辑已由各子组件从 Store 获取
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
</script>

<template>
  <div class="w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    
    <div class="flex flex-wrap gap-4 justify-between items-center mb-6 bg-slate-800 p-4 rounded border border-slate-700">
      <div class="flex items-center gap-6">
        <h2 class="text-2xl font-bold text-sky-400 uppercase tracking-widest">Station Planner</h2>
        
        <div class="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded border border-slate-700">
           <span class="text-slate-400 text-xs uppercase font-bold">Sun Light</span>
           <input 
             type="number" 
             v-model.number="store.settings.sunlight" 
             class="w-12 bg-transparent text-right text-yellow-400 font-mono focus:outline-none" 
           />
           <span class="text-slate-500">%</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button 
          @click="store.loadDemoData()" 
          class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold transition shadow-lg shadow-emerald-900/20"
        >
          Load Demo Data
        </button>
        <MissingTranslate />
        <LanguageSelector />
      </div>
    </div>

    <div class="grid grid-cols-12 gap-6 items-start">
      
      <div class="col-span-12 lg:col-span-3">
        <StationModuleList />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <ResourceList />
      </div>

      <div class="col-span-12 lg:col-span-4 space-y-4">
         <StationWorkforce />
         <StationProfit />
         <StationConstruction />
      </div>
    </div>

    <StatusMonitor />
  </div>
</template>

<style scoped>
/* 确保输入框在不同浏览器下外观一致 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>