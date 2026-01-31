<script setup lang="ts">
import StationModuleList from './StationModuleList.vue'
import ResourceList from './ResourceList.vue'
import StationWorkforce from './StationWorkforce.vue'
import StationProfit from './StationProfit.vue'
import StationConstruction from './StationConstruction.vue'
import StationToolbar from './StationToolbar.vue'
import StatusMonitor from './StatusMonitor.vue' // <--- 引入状态监控组件


// 这里的格式化逻辑可以保留用于简单的局部显示，复杂逻辑已由各子组件从 Store 获取
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
</script>

<template>
  <div class="w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    
    <StationToolbar />

    <div class="main-layout">
      
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

.main-layout {
  @apply grid grid-cols-12 gap-8 items-start;
}

/* 确保输入框在不同浏览器下外观一致 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>