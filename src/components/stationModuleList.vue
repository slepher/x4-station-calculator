<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import StationModuleItem from './StationModuleItem.vue'

const store = useStationStore()
</script>

<template>
  <div class="space-y-2">
    <div class="flex justify-between items-end mb-2 border-b border-slate-700 pb-2">
      <h3 class="text-lg font-semibold text-slate-200">Station Modules</h3>
      <span class="text-xs text-slate-500">{{ store.plannedModules.length }} types</span>
    </div>

    <div class="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
      <StationModuleItem 
        v-for="item in store.plannedModules" 
        :key="item.moduleId"
        :item="item"
        :info="store.getModuleInfo(item.moduleId)!"
        @update:count="(val) => store.updateCount(item.moduleId, val)"
        @remove="store.removeModule(item.moduleId)"
      />
    </div>

    <button class="w-full py-2 mt-2 border-2 border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 rounded transition text-sm">
      + Add Module
    </button>
  </div>
</template>