<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import StationToolbar from './StationToolbar.vue'
import StatusMonitor from './StatusMonitor.vue'
import ProductionWorkbenchView from './empire/ProductionWorkbenchView.vue'
import LogicFlowWorkbenchView from './logic-flow/LogicFlowWorkbenchView.vue'
import ShipBuildView from './ship-build/ShipBuildView.vue'
import MapWorkbenchView from './empire/MapWorkbenchView.vue'

const store = useStationStore()
const shipBuildStore = useShipBuildStore()

import { watchEffect, computed } from 'vue'
watchEffect(() => {
  console.log('[MainWorkbench] isReady:', store.isReady, 'activeView:', shipBuildStore.activeView)
})

const isProductionView = computed(() => shipBuildStore.activeView === 'production')
const isShipBuildView = computed(() => shipBuildStore.activeView === 'ship-build')
const isMapsView = computed(() => shipBuildStore.activeView === 'maps')

</script>

<template>
  <div class="main-workbench w-full max-w-[1600px] mx-auto p-4 text-sm relative min-h-screen">
    <div id="debug-ready-marker" v-if="store.isReady" class="hidden">READY</div>

    <StationToolbar />
    
    <template v-if="isProductionView">
      <ProductionWorkbenchView />
    </template>

    <template v-else-if="isShipBuildView">
      <ShipBuildView />
    </template>

    <template v-else-if="isMapsView">
      <MapWorkbenchView />
    </template>

    <div v-else class="flow-layout flex flex-col gap-6">
      <LogicFlowWorkbenchView />
    </div>

    <StatusMonitor />

  </div>
</template>

<style scoped>
.coming-soon-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl p-8 text-center min-h-[400px] flex items-center justify-center;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
