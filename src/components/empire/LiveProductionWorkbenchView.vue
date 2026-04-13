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
import type { SavedModule } from '@/types/x4'
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

const tabbarProps = computed(() => ({
  tabs: tabbarPresenter.props.tabs.value,
  activeTabId: tabbarPresenter.props.activeTabId.value,
  expandedSectorId: tabbarPresenter.props.expandedSectorId.value,
  canCreateStation: tabbarPresenter.props.canCreateStation,
  canOpenContextMenu: tabbarPresenter.props.canOpenContextMenu
}))

const toolbarProps = computed(() => ({
  mode: toolbarPresenter.props.mode.value,
  isBindingMode: toolbarPresenter.props.isBindingMode,
  titleModel: toolbarPresenter.props.titleModel.value,
  station: toolbarPresenter.props.station.value,
  settings: toolbarPresenter.props.settings.value,
  races: toolbarPresenter.props.races,
  stationTypes: toolbarPresenter.props.stationTypes,
  availableMinerals: toolbarPresenter.props.availableMinerals,
  singleBerthThroughput: toolbarPresenter.props.singleBerthThroughput.value
}))

const planningProps = computed(() => ({
  plannedModules: planningPresenter.props.plannedModules.value,
  autoIndustryModules: planningPresenter.props.autoIndustryModules.value,
  enforceDlcActivation: planningPresenter.props.enforceDlcActivation.value
}))

const wareflowProps = computed(() => ({
  viewMode: wareflowPresenter.props.viewMode.value,
  groupedFlows: wareflowPresenter.props.groupedFlows.value,
  autoModules: wareflowPresenter.props.autoModules.value,
  settings: wareflowPresenter.props.settings.value,
  empireGaps: wareflowPresenter.props.empireGaps.value,
  plannedModules: wareflowPresenter.props.plannedModules,
  wares: wareflowPresenter.props.wares.value,
  modulesMap: wareflowPresenter.props.modulesMap.value,
  isWareLocked: wareflowPresenter.props.isWareLocked,
  getResolvedLevel: wareflowPresenter.props.getResolvedLevel,
  isWareOperable: wareflowPresenter.props.isWareOperable,
  isPlannedWare: wareflowPresenter.props.isPlannedWare,
  onToggleWareLock: wareflowPresenter.props.onToggleWareLock,
  onToggleWarePriority: wareflowPresenter.props.onToggleWarePriority
}))

const dashboardProps = computed(() => ({
  plannedModules: dashboardPresenter.props.plannedModules,
  stationAnalysis: dashboardPresenter.props.stationAnalysis.value,
  settings: dashboardPresenter.props.settings.value,
  currentEfficiency: dashboardPresenter.props.currentEfficiency.value,
  actualWorkforce: dashboardPresenter.props.actualWorkforce.value,
  buildPriceMultiplier: dashboardPresenter.props.buildPriceMultiplier.value
}))

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
  transportShipCapacity: liveStore.settings.transportShipCapacity
}))
</script>

<template>
  <SectorStationTabBar
    :tabs="tabbarProps.tabs"
    :active-tab-id="tabbarProps.activeTabId"
    :expanded-sector-id="tabbarProps.expandedSectorId"
    :can-create-station="tabbarProps.canCreateStation"
    :can-open-context-menu="tabbarProps.canOpenContextMenu"
    @select-overview="tabbarPresenter.emits.selectOverview"
    @select-transit="tabbarPresenter.emits.selectTransit"
    @select-station="tabbarPresenter.emits.selectStation"
    @create-station="tabbarPresenter.emits.createStation"
    @rename-station="tabbarPresenter.emits.renameStation"
    @delete-station="tabbarPresenter.emits.deleteStation"
    @expand-sector="tabbarPresenter.emits.expandSector"
  />
  <ContextToolbar
    :mode="toolbarProps.mode"
    :is-binding-mode="toolbarProps.isBindingMode"
    :title-model="toolbarProps.titleModel"
    :station="toolbarProps.station"
    :settings="toolbarProps.settings"
    :races="toolbarProps.races"
    :station-types="toolbarProps.stationTypes"
    :available-minerals="toolbarProps.availableMinerals"
    :single-berth-throughput="toolbarProps.singleBerthThroughput"
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
          :view-mode="wareflowProps.viewMode"
          :price-multiplier="liveStore.settings.buyMultiplier"
          :resource-buffer-hours="liveStore.settings.resourceBufferHours"
          :primary-product-buffer-hours="liveStore.settings.primaryProductBufferHours"
          :secondary-product-buffer-hours="liveStore.settings.secondaryProductBufferHours"
          @update:view-mode="wareflowPresenter.emits.updateViewMode"
          @update:price-multiplier="wareflowPresenter.emits.updateBuyMultiplier"
          @update:resource-buffer-hours="wareflowPresenter.emits.updateResourceBufferHours"
          @update:primary-product-buffer-hours="wareflowPresenter.emits.updatePrimaryProductBufferHours"
          @update:secondary-product-buffer-hours="wareflowPresenter.emits.updateSecondaryProductBufferHours"
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
        :planned-modules="planningProps.plannedModules"
        :auto-industry-modules="planningProps.autoIndustryModules"
        :enforce-dlc-activation="planningProps.enforceDlcActivation"
        @update-planned-modules="planningPresenter.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareflowProps.viewMode"
        :grouped-flows="wareflowProps.groupedFlows"
        :auto-modules="wareflowProps.autoModules"
        :settings="wareflowProps.settings"
        :empire-gaps="wareflowProps.empireGaps"
        :planned-modules="wareflowProps.plannedModules"
        :wares="wareflowProps.wares"
        :modules-map="wareflowProps.modulesMap"
        :is-ware-locked="wareflowProps.isWareLocked"
        :get-resolved-level="wareflowProps.getResolvedLevel"
        :is-ware-operable="wareflowProps.isWareOperable"
        :is-planned-ware="wareflowProps.isPlannedWare"
        :on-toggle-ware-lock="wareflowProps.onToggleWareLock"
        :on-toggle-ware-priority="wareflowProps.onToggleWarePriority"
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
        :planned-modules="dashboardProps.plannedModules"
        :station-analysis="dashboardProps.stationAnalysis"
        :settings="dashboardProps.settings"
        :current-efficiency="dashboardProps.currentEfficiency"
        :actual-workforce="dashboardProps.actualWorkforce"
        :build-price-multiplier="dashboardProps.buildPriceMultiplier"
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