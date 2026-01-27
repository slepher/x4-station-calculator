<script setup lang="ts">
import { computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import ResourceItem from './ResourceItem.vue'

const store = useStationStore()

// 准备数据列表
const resourcesList = computed(() => {
  const prod = store.netProduction
  return Object.entries(prod)
    .sort(([, a], [, b]) => b - a) // 产出在前
    .map(([key, amount]) => ({
      id: key,
      name: store.wares[key]?.name || key,
      amount
    }))
})
</script>

<template>
  <div class="bg-slate-800/50 rounded p-0 border border-slate-700 overflow-hidden">
    <div class="p-4 border-b border-slate-700 bg-slate-800">
      <h3 class="text-lg font-semibold text-slate-200">Station Resources (per hour)</h3>
    </div>
    
    <div class="divide-y divide-slate-700/50">
      <ResourceItem 
        v-for="res in resourcesList" 
        :key="res.id"
        :resourceId="res.id"
        :name="res.name"
        :amount="res.amount"
      />
      
      <div v-if="resourcesList.length === 0" class="text-center text-slate-500 py-12">
        Add modules to see resource flow
      </div>
    </div>
  </div>
</template>