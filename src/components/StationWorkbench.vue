<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { reactive } from 'vue'
import StationPlanningPanel from './empire/StationPlanningPanel.vue'
import StationDashboard from './empire/StationDashboard.vue'
import StationToolbar from './StationToolbar.vue'
import StationTabBar from './empire/StationTabBar.vue'
import ContextToolbar from './empire/ContextToolbar.vue'
import StationWareFlowsDashboard from './empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from './empire/EmpireWareFlowsDashboard.vue'
import SectorManagementPanel from './empire/SectorManagementPanel.vue'
import TransitHubWorkbench from './empire/transit-hub/TransitHubWorkbench.vue'
import LogicFlowCandidateZone from './logic-flow/LogicFlowCandidateZone.vue'
import LogicFlowPlanningZone from './logic-flow/LogicFlowPlanningZone.vue'
import StatusMonitor from './StatusMonitor.vue'
import ShipBuildView from './ship-build/ShipBuildView.vue'

const store = useStationStore()
const empireStore = useEmpireStore()
const shipBuildStore = useShipBuildStore()

import { watchEffect, computed } from 'vue'
watchEffect(() => {
  console.log('[StationWorkbench] isReady:', store.isReady, 'activeView:', shipBuildStore.activeView)
})

const isProductionView = computed(() => shipBuildStore.activeView === 'production')
const isShipBuildView = computed(() => shipBuildStore.activeView === 'ship-build')

const overviewState = reactive<{
  supplySectorId: string | null
}>({
  supplySectorId: null
})

watchEffect(() => {
  if (empireStore.activeStationId !== null) {
    overviewState.supplySectorId = null
  }
})

</script>

<template>
  <div class="station-workbench w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    <div id="debug-ready-marker" v-if="store.isReady" class="hidden">READY</div>

    <StationToolbar />
    
    <template v-if="isProductionView">
      <StationTabBar :active-supply-sector-id="overviewState.supplySectorId" @open-supply="overviewState.supplySectorId = $event" />
      <ContextToolbar
        :active-supply-sector-id="overviewState.supplySectorId"
      />
      
      <template v-if="empireStore.activeStationId === null">
        <div v-if="overviewState.supplySectorId" class="mt-6">
          <TransitHubWorkbench :sector-id="overviewState.supplySectorId" />
        </div>

        <div v-else class="main-layout mt-6">
          <div class="col-span-12 lg:col-span-3">
            <SectorManagementPanel />
          </div>

          <div class="col-span-12 lg:col-span-5">
            <EmpireWareFlowsDashboard />
          </div>

          <div class="col-span-12 lg:col-span-4">
            <TransitHubWorkbench :sector-id="overviewState.supplySectorId" />
          </div>
        </div>
      </template>
      
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
