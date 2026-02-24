<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import StationPlanningPanel from './StationPlanningPanel.vue'
import StationDashboard from './StationDashboard.vue'
import StationToolbar from './StationToolbar.vue'
import StationTabBar from './StationTabBar.vue'
import ContextToolbar from './ContextToolbar.vue'
import StationWareFlowsDashboard from './StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from './EmpireWareFlowsDashboard.vue'
import LogicFlowCandidateZone from './LogicFlowCandidateZone.vue'
import LogicFlowPlanningZone from './LogicFlowPlanningZone.vue'
import StatusMonitor from './StatusMonitor.vue'
import ShipBuildView from './ShipBuildView.vue'

const store = useStationStore()
const empireStore = useEmpireStore()

import { watchEffect, computed } from 'vue'
watchEffect(() => {
  console.log('[StationWorkbench] isReady:', store.isReady, 'activeView:', store.activeView)
})

const isProductionView = computed(() => store.activeView === 'production')
const isShipBuildView = computed(() => store.activeView === 'ship-build')
</script>

<template>
  <div class="station-workbench w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    <div id="debug-ready-marker" v-if="store.isReady" class="hidden">READY</div>

    <StationToolbar />
    
    <template v-if="isProductionView">
      <StationTabBar />
      <ContextToolbar />
      
      <div v-if="empireStore.activeStationId === null" class="main-layout mt-6">
        <div class="col-span-12 lg:col-span-3">
          <div class="coming-soon-panel">
            <p class="text-slate-500">{{ $t('empire.coming_soon') }}</p>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-5">
          <EmpireWareFlowsDashboard />
        </div>

        <div class="col-span-12 lg:col-span-4">
          <div class="coming-soon-panel">
            <p class="text-slate-500">{{ $t('empire.coming_soon') }}</p>
          </div>
        </div>
      </div>
      
      <div v-else class="main-layout mt-6">
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
    </template>

    <template v-else-if="isShipBuildView">
      <ShipBuildView />
    </template>

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

.coming-soon-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl p-8 text-center min-h-[400px] flex items-center justify-center;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
