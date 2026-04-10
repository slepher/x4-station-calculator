<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useStationStore } from '@/store/useStationStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import {
  buildSaveBindingProductionFlows,
  type ProductionSourceKind
} from '@/store/logic/productionSourceAdapter'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import StationTabBar from '@/components/empire/StationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import TransitHubMaterialsPanel from '@/components/empire/transit-hub/TransitHubMaterialsPanel.vue'

type SharedWareFlowViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

const empireStore = useEmpireStore()
const stationStore = useStationStore()
const gameDataStore = useGameDataStore()
const saveBindingStore = useSaveBindingStore()
const activeTransitSectorId = computed(() => empireStore.activeTransitSectorId)
const isOverview = computed(() => empireStore.activeStation === null && !activeTransitSectorId.value)
const wareFlowViewMode = ref<SharedWareFlowViewMode>('quantity')
const productionSource = ref<ProductionSourceKind>('empire')
const transitHubModel = computed(() => empireStore.getTransitHubViewModel({
  sectorId: activeTransitSectorId.value,
  racePreference: stationStore.settings.racePreference,
  transportShipCapacity: stationStore.settings.transportShipCapacity
}))
const activeSaveBinding = computed(() => {
  if (saveBindingStore.activeBinding) return saveBindingStore.activeBinding
  const guid = saveBindingStore.activeGameGuid
  return guid ? saveBindingStore.getBindingByGameGuid(guid) : null
})
const saveBindingGroupedFlows = computed(() => buildSaveBindingProductionFlows(activeSaveBinding.value, {
  modulesMap: gameDataStore.modulesMap,
  waresMap: gameDataStore.waresMap,
  medicalConsumptionMap: gameDataStore.medicalConsumptionMap,
  enforceDlcActivation: gameDataStore.enforceDlcActivation,
  isModuleDlcActive: (moduleId: string) => gameDataStore.isDlcActive(gameDataStore.modulesMap[moduleId]?.dlc_tag)
}))
const overviewGroupedFlows = computed(() =>
  productionSource.value === 'save-binding' ? saveBindingGroupedFlows.value : null
)
</script>

<template>
  <StationTabBar />
  <ContextToolbar />

  <template v-if="isOverview || !!activeTransitSectorId">
    <div v-if="activeTransitSectorId" class="main-layout mt-6">
      <div class="col-span-12 lg:col-span-3">
        <TransitHubBuildPanel :storage-module-plans="transitHubModel.storageModulePlans" />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <TransitHubCenterDashboard
          :grouped-flows="transitHubModel.groupedFlows"
          :storage-flows="transitHubModel.storageFlows"
          :view-mode="wareFlowViewMode"
          @update:view-mode="wareFlowViewMode = $event"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel :planned-modules-override="transitHubModel.supplyBuildModules" />
      </div>
    </div>

    <div v-else-if="isOverview" class="overview-layout mt-6">
      <div class="col-span-1 lg:col-span-2">
        <div class="sector-management-placeholder" aria-hidden="true"></div>
      </div>

      <div class="col-span-1 lg:col-span-3">
        <div class="production-source-toolbar">
          <div class="production-source-tabs">
            <button
              type="button"
              class="source-tab"
              :class="{ active: productionSource === 'empire' }"
              @click="productionSource = 'empire'"
            >
              {{ $t('production.source_empire') }}
            </button>
            <button
              type="button"
              class="source-tab"
              :class="{ active: productionSource === 'save-binding' }"
              @click="productionSource = 'save-binding'"
            >
              {{ $t('production.source_save_binding') }}
            </button>
          </div>
        </div>
        <EmpireWareFlowsDashboard :grouped-flows="overviewGroupedFlows" />
      </div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareFlowViewMode"
        @update:view-mode="wareFlowViewMode = $event"
      />
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

.sector-management-placeholder {
  min-height: 1px;
}

.production-source-toolbar {
  @apply mb-3 flex flex-wrap items-center justify-between gap-2;
}

.production-source-tabs {
  @apply flex items-center gap-2;
}

.source-tab {
  @apply rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 transition;
}

.source-tab:hover {
  @apply border-slate-500 bg-slate-700 text-white;
}

.source-tab.active {
  @apply border-sky-500 bg-sky-600/30 text-sky-100;
}

</style>
