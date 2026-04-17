<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useProductionTabbarPresenter } from '@/components/empire/presenters/useProductionTabbarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import { useEmpireWareFlowDerived } from '@/components/empire/composables/useEmpireWareFlowDerived'
import StationPlanningPanelWrapper from '@/components/empire/StationPlanningPanelWrapper.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import SectorStationTabBar from '@/components/empire/SectorStationTabBar.vue'
import LiveOverviewToolbar from '@/components/empire/context_toolbar/LiveOverviewToolbar.vue'
import LiveTransitToolbar from '@/components/empire/context_toolbar/LiveTransitToolbar.vue'
import LiveStationToolbar from '@/components/empire/context_toolbar/LiveStationToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import TransitHubMaterialsPanel from '@/components/empire/transit-hub/TransitHubMaterialsPanel.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'

const liveStore = useLiveProductionStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()
const { t } = useI18n()

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

const tabbarPresenter = useProductionTabbarPresenter(liveStore)
const toolbarPresenter = useProductionToolbarPresenter(liveStore)
const planningPresenter = useProductionPlanningPresenter(liveStore)
const wareflowPresenter = useProductionWareflowPresenter(liveStore)
const dashboardPresenter = useProductionDashboardPresenter(liveStore)

const importModalActiveStation = computed(() => {
  const station = liveStore.stationState
  if (!station || station.entityType !== 'station') return null
  return { id: station.id, modules: station.plannedModules }
})

const empireWareFlowDerived = useEmpireWareFlowDerived({
  stations: computed(() => liveStore.orderedStationsBySector),
  modulesMap: computed(() => gameData.modulesMap || {}),
  waresMap: computed(() => gameData.waresMap || {})
})

const showArchiveModuleList = computed(() => {
  return planningPresenter.props.visualMode.value === 'live' && planningPresenter.props.hasArchive.value
})
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
  
  <LiveOverviewToolbar
    v-if="liveStore.session.workbenchMode === 'overview'"
    :title-model="toolbarPresenter.props.titleModel.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @open-import="liveStore.importModalOpen = true"
  />
  
  <LiveTransitToolbar
    v-if="liveStore.session.workbenchMode === 'transit'"
    :title-model="toolbarPresenter.props.titleModel.value"
    :station-code="toolbarPresenter.props.stationCode.value"
    :sector-name="toolbarPresenter.props.sectorName.value"
    :sector-name-id="toolbarPresenter.props.sectorNameId.value"
    :station-position="toolbarPresenter.props.position.value"
    :sector-resources="toolbarPresenter.props.sectorResources.value"
    :sector-sunlight="toolbarPresenter.props.sectorSunlight.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    :mode="liveStore.session.mode"
    :visual-mode="planningPresenter.props.visualMode.value"
    :can-toggle="true"
    :has-archive-trade-station="planningPresenter.props.hasArchive.value"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @toggle-mode="liveStore.toggleMode"
  />
  
  <LiveStationToolbar
    v-if="liveStore.session.workbenchMode === 'station'"
    :station-name="toolbarPresenter.props.station.value?.name || ''"
    :station-code="toolbarPresenter.props.stationCode.value"
    :sector-name="toolbarPresenter.props.sectorName.value"
    :sector-name-id="toolbarPresenter.props.sectorNameId.value"
    :station-position="toolbarPresenter.props.position.value"
    :sector-resources="toolbarPresenter.props.sectorResources.value"
    :sector-sunlight="toolbarPresenter.props.sectorSunlight.value"
    :has-binding-station="liveStore.context.hasBinding"
    :has-save-station="liveStore.context.hasArchive"
    :mode="liveStore.session.mode"
    :can-toggle="liveStore.session.canToggle"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    @update-station-name="toolbarPresenter.emits.updateStationName"
    @toggle-mode="liveStore.toggleMode"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @update-workforce="toolbarPresenter.emits.updateWorkforce"
    @update-show-empire-gaps="toolbarPresenter.emits.updateShowEmpireGaps"
    @open-import="liveStore.importModalOpen = true"
  />

  <ImportPlanModal
    :isOpen="liveStore.importModalOpen"
    :initialTab="'logic-flow'"
    :isOverview="liveStore.session.workbenchMode === 'overview'"
    productionSource="save-binding"
    :activeStationId="liveStore.activeStationId"
    :activeStation="importModalActiveStation"
    :createStation="(name, type) => liveStore.createStation(name, type)"
    :applyImportedStationPayload="(id, payload) => liveStore.applyImportedStationPayload(id, payload)"
    :updateStationModules="(id, modules) => liveStore.updateStationModules(id, modules)"
    :getStationById="(id) => liveStore.getStationById(id)"
    @close="liveStore.importModalOpen = false"
  />

<template v-if="liveStore.session.workbenchMode === 'overview' || liveStore.session.workbenchMode === 'transit'">
    <div v-if="liveStore.session.workbenchMode === 'transit'" class="main-layout mt-6">
      <div class="col-span-12 lg:col-span-3">
        <ArchiveModuleList
          v-if="showArchiveModuleList"
          :modules="planningPresenter.props.liveModules.value"
          :building-modules="planningPresenter.props.liveBuildingModules.value"
        />
        <TransitHubBuildPanel
          v-else
          :modules="planningPresenter.props.autoInfrastructureModules.value"
        />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <TransitHubCenterDashboard
          :production-flows="wareflowPresenter.props.productionFlows.value"
          :view-mode="wareflowPresenter.props.viewMode.value"
          :buy-multiplier="wareflowPresenter.props.settings.value.buyMultiplier"
          :sell-multiplier="wareflowPresenter.props.settings.value.sellMultiplier"
          :product-buffer-hours="wareflowPresenter.props.settings.value.primaryProductBufferHours"
          @update:view-mode="wareflowPresenter.emits.updateViewMode"
          @update:buy-multiplier="wareflowPresenter.emits.updateBuyMultiplier"
          @update:sell-multiplier="wareflowPresenter.emits.updateSellMultiplier"
          @update:product-buffer-hours="wareflowPresenter.emits.updatePrimaryProductBufferHours"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel
          :modules="dashboardPresenter.props.activeModules.value"
          :building-modules="dashboardPresenter.props.activeBuildingModules.value"
          :build-price-multiplier="dashboardPresenter.props.buildPriceMultiplier.value"
          :useHQ="dashboardPresenter.props.settings.value.useHQ"
          @update-build-price-multiplier="dashboardPresenter.emits.updateBuildPriceMultiplier"
          @update-use-hq="dashboardPresenter.emits.updateUseHQ"
        />
      </div>
    </div>

    <div v-else-if="liveStore.session.workbenchMode === 'overview'" class="overview-layout mt-6">
      <div class="overview-left-panel panel-card">
        <div class="panel-header">{{ t('save_import.title') }}</div>
        <div class="panel-content">
          <SaveUploadPanel @upload-complete="() => {}" />
          <SaveList />
        </div>
      </div>

      <div class="col-span-1 lg:col-span-3">
        <EmpireWareFlowsDashboard
          :grouped-flows="empireWareFlowDerived.empireGroupedFlows.value"
          :buy-multiplier="empireWareFlowDerived.buyMultiplier.value"
          :sell-multiplier="empireWareFlowDerived.sellMultiplier.value"
          @update:buy-multiplier="empireWareFlowDerived.buyMultiplier.value = $event"
          @update:sell-multiplier="empireWareFlowDerived.sellMultiplier.value = $event"
        />
      </div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanelWrapper
        :planned-modules="planningPresenter.props.plannedModules.value"
        :auto-industry-modules="planningPresenter.props.autoIndustryModules.value"
        :auto-habitation-modules="planningPresenter.props.autoHabitationModules.value"
        :auto-infrastructure-modules="planningPresenter.props.autoInfrastructureModules.value"
        :enforce-dlc-activation="planningPresenter.props.enforceDlcActivation.value"
        :mode="liveStore.session.mode"
        :archive-modules="liveStore.context.archiveModules"
        :building-modules="liveStore.context.buildingModules"
        :has-archive="liveStore.context.hasArchive"
        @update-planned-modules="planningPresenter.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareflowPresenter.props.viewMode.value"
        :production-flows="wareflowPresenter.props.productionFlows.value"
        :ware-priority-levels="wareflowPresenter.props.warePriorityLevels.value"
        :settings="wareflowPresenter.props.settings.value"
        :empire-gaps="wareflowPresenter.props.empireGaps.value"
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

.overview-left-panel {
  @apply lg:col-span-2 flex flex-col;
}

.overview-left-panel.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.overview-left-panel .panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.overview-left-panel .panel-content {
  @apply p-4 flex flex-col gap-4;
}
</style>
