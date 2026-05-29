<script setup lang="ts">
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import StationToolbar from './StationToolbar.vue'
import StatusMonitor from './StatusMonitor.vue'
import BlueprintProductionWorkbenchView from './empire/BlueprintProductionWorkbenchView.vue'
import LiveProductionWorkbenchView from './empire/LiveProductionWorkbenchView.vue'
import LogicFlowWorkbenchView from './logic-flow/LogicFlowWorkbenchView.vue'
import ShipBuildView from './ship-build/ShipBuildView.vue'
import MapWorkbenchView from './map/MapWorkbenchView.vue'

import { computed } from 'vue'

const blueprintStore = useBlueprintProductionStore()
const shipBuildStore = useShipBuildStore()

const isBlueprintProduction = computed(() => shipBuildStore.activeView === 'blueprint-production')
const isLiveProduction = computed(() => shipBuildStore.activeView === 'live-production')
const isShipBuildView = computed(() => shipBuildStore.activeView === 'ship-build')
const isMapsView = computed(() => shipBuildStore.activeView === 'maps')
</script>

<template>
  <div
    class="main-workbench w-full max-w-[1600px] mx-auto text-sm flex flex-col gap-4 h-screen overflow-hidden"
    :class="{ 'maps-mode': isMapsView }"
  >
    <div id="debug-ready-marker" v-if="blueprintStore.isReady" class="hidden">READY</div>

    <StationToolbar />

    <template v-if="isBlueprintProduction">
      <BlueprintProductionWorkbenchView />
    </template>

    <template v-else-if="isLiveProduction">
      <LiveProductionWorkbenchView />
    </template>

    <template v-else-if="isShipBuildView">
      <div class="flex-1 min-h-0 overflow-y-auto px-4">
        <ShipBuildView />
      </div>
    </template>

    <div v-else-if="isMapsView" class="maps-slot overflow-y-auto px-4">
      <MapWorkbenchView />
    </div>

    <div v-else class="flow-layout flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto px-4">
      <LogicFlowWorkbenchView />
    </div>

    <StatusMonitor />
  </div>
</template>

<style scoped>
.main-workbench.maps-mode {
  height: 100vh;
  overflow: hidden;
}

.maps-slot {
  @apply flex-1 min-h-0;
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