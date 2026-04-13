<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useProductionTabbarPresenter } from '@/components/empire/presenters/useProductionTabbarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import { useEmpireWareFlowDerived } from '@/components/empire/composables/useEmpireWareFlowDerived'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import SectorStationTabBar from '@/components/empire/SectorStationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import TransitHubMaterialsPanel from '@/components/empire/transit-hub/TransitHubMaterialsPanel.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'

const liveStore = useLiveProductionStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()

onMounted(() => {
  const gameGuid = activeViewStore.activeBinding
  if (gameGuid && !liveStore.activeBinding) {
    liveStore.openBinding(gameGuid)
  }
})

watch(() => activeViewStore.activeBinding, (newGuid) => {
  if (newGuid && newGuid !== liveStore.activeBinding?.gameGuid) {
    liveStore.openBinding(newGuid)
  }
})

const tabbarPresenter = useProductionTabbarPresenter(liveStore.workbench)
const toolbarPresenter = useProductionToolbarPresenter(liveStore.workbench)
const planningPresenter = useProductionPlanningPresenter(liveStore.workbench)
const wareflowPresenter = useProductionWareflowPresenter(liveStore.workbench)
const dashboardPresenter = useProductionDashboardPresenter(liveStore.workbench)

const activeStation = computed(() => liveStore.activeStation)
const activeTransitSectorId = computed(() => liveStore.activeTransitSectorId)
const isOverview = computed(() => !activeStation.value && !activeTransitSectorId.value)

const importModalActiveStation = computed(() => {
  if (!activeStation.value) return null
  return { id: activeStation.value.id, modules: activeStation.value.modules }
})

const empireWareFlowDerived = useEmpireWareFlowDerived({
  stations: computed(() => liveStore.orderedStationsBySector),
  modulesMap: computed(() => gameData.modulesMap || {})
})

const transitHubModel = computed(() => liveStore.getTransitHubViewModel({
  sectorId: activeTransitSectorId.value,
  racePreference: liveStore.settings.racePreference,
  transportShipCapacity: liveStore.settings.transportShipCapacity,
  storageBufferHours: liveStore.settings.primaryProductBufferHours
}))
</script>

<template>
  <SectorStationTabBar
    :tabs="tabbarPresenter.props.tabs.value"
    :active-tab-id="tabbarPresenter.props.activeTabId.value"
    :expanded-sector-id="tabbarPresenter.props.expandedSectorId.value"
    :can-create-station="tabbarPresenter.props.canCreateStation"
    :can-open-context-menu="tabbarPresenter.props.canOpenContextMenu"
    @select-overview="tabbarPresenter.emits.selectOverview"
    @select-transit="tabbarPresenter.emits.selectTransit"
    @select-station="tabbarPresenter.emits.selectStation"
    @create-station="tabbarPresenter.emits.createStation"
    @rename-station="tabbarPresenter.emits.renameStation"
    @delete-station="tabbarPresenter.emits.deleteStation"
    @expand-sector="tabbarPresenter.emits.expandSector"
  />
  <ContextToolbar
    :mode="toolbarPresenter.props.mode.value"
    :is-binding-mode="toolbarPresenter.props.isBindingMode"
    :title-model="toolbarPresenter.props.titleModel.value"
    :station="toolbarPresenter.props.station.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    :station-types="toolbarPresenter.props.stationTypes"
    :available-minerals="toolbarPresenter.props.availableMinerals"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-station-name="toolbarPresenter.emits.updateStationName"
    @update-station-type="toolbarPresenter.emits.updateStationType"
    @update-station-count="toolbarPresenter.emits.updateStationCount"
    @toggle-mineral="toolbarPresenter.emits.toggleMineral"
    @update-sunlight="toolbarPresenter.emits.updateSunlight"
    @update-transport-minutes="toolbarPresenter.emits.updateTransportMinutes"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @update-workforce="toolbarPresenter.emits.updateWorkforce"
    @update-show-empire-gaps="toolbarPresenter.emits.updateShowEmpireGaps"
    @open-import="liveStore.importModalOpen = true"
  />

  <ImportPlanModal
    :isOpen="liveStore.importModalOpen"
    :initialTab="'logic-flow'"
    :isOverview="isOverview"
    productionSource="save-binding"
    :activeStationId="liveStore.activeStationId"
    :activeStation="importModalActiveStation"
    :createStation="(name, type) => liveStore.createStation(name, type)"
    :applyImportedStationPayload="(id, payload) => liveStore.applyImportedStationPayload(id, payload)"
    :updateStationModules="(id, modules) => liveStore.updateStationModules(id, modules)"
    :getStationById="(id) => liveStore.getStationById(id)"
    @close="liveStore.importModalOpen = false"
  />

  <template v-if="isOverview || activeTransitSectorId">
    <div v-if="activeTransitSectorId" class="main-layout mt-6">
      <div class="col-span-12 lg:col-span-3">
        <TransitHubBuildPanel :storage-module-plans="transitHubModel.storageModulePlans" />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <TransitHubCenterDashboard
          :grouped-flows="transitHubModel.groupedFlows"
          :storage-flows="transitHubModel.storageFlows"
          :view-mode="wareflowPresenter.props.viewMode.value"
          :price-multiplier="liveStore.settings.buyMultiplier"
          :product-buffer-hours="liveStore.settings.primaryProductBufferHours"
          @update:view-mode="wareflowPresenter.emits.updateViewMode"
          @update:price-multiplier="wareflowPresenter.emits.updateBuyMultiplier"
          @update:product-buffer-hours="wareflowPresenter.emits.updatePrimaryProductBufferHours"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel
          :plannedModulesOverride="transitHubModel.storageModulePlans"
          :buildPriceMultiplier="liveStore.buildPriceMultiplier"
          :useHQ="liveStore.settings.useHQ"
          @updateBuildPriceMultiplier="dashboardPresenter.emits.updateBuildPriceMultiplier"
          @updateUseHQ="dashboardPresenter.emits.updateUseHQ"
        />
      </div>
    </div>

    <div v-else-if="isOverview" class="overview-layout mt-6">
      <div class="col-span-1 lg:col-span-2">
        <div class="sector-management-placeholder" aria-hidden="true"></div>
      </div>

      <div class="col-span-1 lg:col-span-3">
        <EmpireWareFlowsDashboard
          :grouped-flows="empireWareFlowDerived.empireGroupedFlows.value"
          :price-multiplier="empireWareFlowDerived.priceMultiplier.value"
          @update:price-multiplier="empireWareFlowDerived.priceMultiplier.value = $event"
        />
      </div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel
        :planned-modules="planningPresenter.props.plannedModules.value"
        :auto-industry-modules="planningPresenter.props.autoIndustryModules.value"
        :enforce-dlc-activation="planningPresenter.props.enforceDlcActivation.value"
        @update-planned-modules="planningPresenter.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareflowPresenter.props.viewMode.value"
        :grouped-flows="wareflowPresenter.props.groupedFlows.value"
        :auto-modules="wareflowPresenter.props.autoModules.value"
        :settings="wareflowPresenter.props.settings.value"
        :empire-gaps="wareflowPresenter.props.empireGaps.value"
        :planned-modules="wareflowPresenter.props.plannedModules.value"
        :wares="wareflowPresenter.props.wares.value"
        :modules-map="wareflowPresenter.props.modulesMap.value"
        :is-ware-locked="wareflowPresenter.props.isWareLocked"
        :get-resolved-level="wareflowPresenter.props.getResolvedLevel"
        :is-ware-operable="wareflowPresenter.props.isWareOperable"
        :is-planned-ware="wareflowPresenter.props.isPlannedWare"
        :on-toggle-ware-lock="wareflowPresenter.props.onToggleWareLock"
        :on-toggle-ware-priority="wareflowPresenter.props.onToggleWarePriority"
        @update-view-mode="wareflowPresenter.emits.updateViewMode"
        @update-resource-buffer-hours="wareflowPresenter.emits.updateResourceBufferHours"
        @update-primary-product-buffer-hours="wareflowPresenter.emits.updatePrimaryProductBufferHours"
        @update-secondary-product-buffer-hours="wareflowPresenter.emits.updateSecondaryProductBufferHours"
        @update-buy-multiplier="wareflowPresenter.emits.updateBuyMultiplier"
        @update-sell-multiplier="wareflowPresenter.emits.updateSellMultiplier"
        @add-gap-module="wareflowPresenter.emits.addGapModule"
        @remove-gap-module="wareflowPresenter.emits.removeGapModule"
      />
    </div>

    <div class="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <StationDashboard
        :planned-modules="dashboardPresenter.props.plannedModules.value"
        :station-analysis="dashboardPresenter.props.stationAnalysis.value"
        :settings="dashboardPresenter.props.settings.value"
        :current-efficiency="dashboardPresenter.props.currentEfficiency.value"
        :actual-workforce="dashboardPresenter.props.actualWorkforce.value"
        :build-price-multiplier="dashboardPresenter.props.buildPriceMultiplier.value"
        @update-transport-ship-capacity="dashboardPresenter.emits.updateTransportShipCapacity"
        @update-build-price-multiplier="dashboardPresenter.emits.updateBuildPriceMultiplier"
        @update-manual-workforce="dashboardPresenter.emits.updateManualWorkforce"
        @update-workforce-auto="dashboardPresenter.emits.updateWorkforceAuto"
        @update-use-hq="dashboardPresenter.emits.updateUseHQ"
      />
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
</style>