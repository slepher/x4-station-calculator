<script setup lang="ts">
import { computed } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import StationTabBar from '@/components/empire/StationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorManagementPanel from '@/components/empire/SectorManagementPanel.vue'
import TransitHubWorkbench from '@/components/empire/transit-hub/TransitHubWorkbench.vue'

const empireStore = useEmpireStore()
const activeTransitSectorId = computed(() => empireStore.activeTransitSectorId)
const isOverview = computed(() => empireStore.activeStation === null && !activeTransitSectorId.value)
</script>

<template>
  <StationTabBar />
  <ContextToolbar />

  <template v-if="isOverview || !!activeTransitSectorId">
    <div v-if="activeTransitSectorId" class="mt-6">
      <TransitHubWorkbench :sector-id="activeTransitSectorId" />
    </div>

    <div v-else-if="isOverview" class="overview-layout mt-6">
      <div class="col-span-1 lg:col-span-2">
        <SectorManagementPanel />
      </div>

      <div class="col-span-1 lg:col-span-3">
        <EmpireWareFlowsDashboard />
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

<style scoped>
.main-layout {
  @apply grid grid-cols-12 gap-8 items-start;
}

.overview-layout {
  @apply grid grid-cols-1 lg:grid-cols-5 gap-8 items-start;
}
</style>
