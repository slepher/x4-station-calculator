<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import StationModuleList from './StationModuleList.vue'
import ResourceList from './ResourceList.vue'
import StationWorkforce from './StationWorkforce.vue'
import StationProfit from './StationProfit.vue'
import StationConstruction from './StationConstruction.vue'
import LanguageSelector from './LanguageSelector.vue' // <--- 1. 引入组件
// 只需要引入右侧面板逻辑（如果想把右侧也拆分，也可以继续拆）
import { computed } from 'vue'
const store = useStationStore()

// 复用之前的右侧计算逻辑
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const estimatedProfit = computed(() => { /* ...之前的逻辑... */ return 0; /* 简化占位，请把之前的逻辑拷过来 */ }) 
</script>

<template>
  <div class="w-full max-w-[1600px] mx-auto p-4 text-sm">
    
    <div class="flex flex-wrap gap-4 justify-between items-center mb-6 bg-slate-800 p-4 rounded border border-slate-700">
      <div class="flex items-center gap-6">
        <h2 class="text-2xl font-bold text-sky-400 uppercase tracking-widest">Station Planner</h2>
        <div class="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded border border-slate-700">
           <span class="text-slate-400 text-xs uppercase font-bold">Sun Light</span>
           <input type="number" v-model.number="store.sunlight" class="w-12 bg-transparent text-right text-yellow-400 font-mono focus:outline-none" />
           <span class="text-slate-500">%</span>
        </div>
      </div>
      <button @click="store.loadDemoPreset()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold transition shadow-lg shadow-emerald-900/20">
        Load Demo Data
      </button>

      <LanguageSelector />
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
  </div>
</template>