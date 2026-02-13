<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import StationPlanningPanel from './StationPlanningPanel.vue'
import StationDashboard from './StationDashboard.vue'
import StationToolbar from './StationToolbar.vue'
import StatusMonitor from './StatusMonitor.vue' // <--- 引入状态监控组件
import StationWareFlowsDashboard from './StationWareFlowsDashboard.vue'
import LogicFlowCandidateZone from './LogicFlowCandidateZone.vue'
import LogicFlowPlanningZone from './LogicFlowPlanningZone.vue'

const store = useStationStore()

import { watchEffect } from 'vue'
watchEffect(() => {
  console.log('[StationWorkbench] isReady:', store.isReady, 'activeView:', store.activeView)
})
</script>

<template>
  <div class="station-workbench w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    <div id="debug-ready-marker" v-if="store.isReady" class="hidden">READY</div>

    <StationToolbar />
    
    <div v-if="store.activeView === 'production'" class="main-layout">
      <div class="col-span-12 lg:col-span-3">
        <StationPlanningPanel />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <StationWareFlowsDashboard />
      </div>

      <div class="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <StationDashboard />
      </div>
    </div>

    <div v-else class="flow-layout flex flex-col gap-6">
      <LogicFlowCandidateZone class="shrink-0" />
      <LogicFlowPlanningZone class="flex-1" />
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