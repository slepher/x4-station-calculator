<script setup lang="ts">
import StationModuleList from './StationModuleList.vue'
import ResourceList from './ResourceList.vue'
import StationWorkforce from './StationWorkforce.vue'
import StationProfit from './StationProfit.vue'
import StationConstruction from './StationConstruction.vue'
import StationToolbar from './StationToolbar.vue'
import StatusMonitor from './StatusMonitor.vue' // <--- 引入状态监控组件

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