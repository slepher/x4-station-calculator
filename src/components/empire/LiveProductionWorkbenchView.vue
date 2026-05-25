<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useProductionTabbarPresenter } from '@/components/empire/presenters/useProductionTabbarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import { useTerraformingPresenter } from '@/components/empire/presenters/useTerraformingPresenter'
import StationPlanningPanelWrapper from '@/components/empire/StationPlanningPanelWrapper.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import SectorStationTabBar from '@/components/empire/SectorStationTabBar.vue'
import LiveOverviewToolbar from '@/components/empire/context_toolbar/LiveOverviewToolbar.vue'
import LiveTransitToolbar from '@/components/empire/context_toolbar/LiveTransitToolbar.vue'
import LiveStationToolbar from '@/components/empire/context_toolbar/LiveStationToolbar.vue'
import TerraformingToolbar from '@/components/empire/context_toolbar/TerraformingToolbar.vue'
import TerraformingSectorPanel from '@/components/empire/terraforming/TerraformingSectorPanel.vue'
import TerraformingTaskList from '@/components/empire/terraforming/TerraformingTaskList.vue'
import TerraformingResourcePanel from '@/components/empire/terraforming/TerraformingResourcePanel.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'

const liveStore = useLiveProductionStore()
const activeViewStore = useActiveViewStore()
const { t } = useI18n()

onMounted(() => {
  const gameGuid = activeViewStore.activeBinding
  if (gameGuid) {
    liveStore.activateBinding(gameGuid)
  }
})

watch(() => activeViewStore.activeBinding, (newGuid) => {
  if (newGuid) {
    liveStore.activateBinding(newGuid)
  }
})

const tabbarPresenter = useProductionTabbarPresenter(liveStore)
const toolbarPresenter = useProductionToolbarPresenter(liveStore)
const planningPresenter = useProductionPlanningPresenter(liveStore)
const wareflowPresenter = useProductionWareflowPresenter(liveStore)
const dashboardPresenter = useProductionDashboardPresenter(liveStore)
const terraformingPresenter = useTerraformingPresenter({
  terraformingData: computed(() => liveStore.terraformingData),
  terraformingSelectedClusterId: computed(() => liveStore.terraformingSelectedClusterId),
  terraformingSelectedCluster: computed(() => liveStore.terraformingSelectedCluster),
  terraformingCurrentStats: computed(() => liveStore.terraformingCurrentStats),
  terraformingRuntimeProjectIds: computed(() => liveStore.terraformingRuntimeProjectIds),
  terraformingCompletedProjects: computed(() => liveStore.terraformingCompletedProjects),
  terraformingExecutionLog: computed(() => liveStore.terraformingExecutionLog),
  terraformingHousingBuilt: computed(() => liveStore.terraformingHousingBuilt),
  terraformingHqStationName: computed(() => liveStore.terraformingHqStationName),
  terraformingHqArchiveStation: computed(() => liveStore.terraformingHqArchiveStation),
  terraformingHqClusterId: computed(() => liveStore.terraformingHqClusterId),
  selectTerraformingCluster: (id: string) => liveStore.selectTerraformingCluster(id),
  setTerraformingCompletedProjects: (projects: Map<string, number>) => liveStore.setTerraformingCompletedProjects(projects),
  appendTerraformingProjectExecution: (projectId: string, count?: number) => liveStore.appendTerraformingProjectExecution(projectId, count),
  setTerraformingProjectCount: (projectId: string, count: number) => liveStore.setTerraformingProjectCount(projectId, count),
  removeTerraformingExecutionEntry: (entryId: string) => liveStore.removeTerraformingExecutionEntry(entryId),
  setTerraformingHousingBuilt: (count: number) => liveStore.setTerraformingHousingBuilt(count),
  mapsClusters: liveStore.gameDataMaps.clusters,
  mapsSectors: liveStore.gameDataMaps.sectors
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
    :context-menu-mode="tabbarPresenter.props.contextMenuMode"
    @select-overview="tabbarPresenter.emits.selectOverview"
    @select-terraforming="tabbarPresenter.emits.selectTerraforming"
    @select-transit="tabbarPresenter.emits.selectTransit"
    @select-station="tabbarPresenter.emits.selectStation"
    @create-station="tabbarPresenter.emits.createStation"
    @rename-station="tabbarPresenter.emits.renameStation"
    @delete-station="tabbarPresenter.emits.deleteStation"
    @expand-sector="tabbarPresenter.emits.expandSector"
  />
  
  <LiveOverviewToolbar
    v-if="toolbarPresenter.props.workbenchMode.value === 'overview' && toolbarPresenter.props.hasActiveBinding.value"
    :title-model="toolbarPresenter.props.titleModel.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @open-import="toolbarPresenter.emits.openImport"
  />
  
  <LiveTransitToolbar
    v-if="toolbarPresenter.props.workbenchMode.value === 'transit' && toolbarPresenter.props.hasActiveBinding.value"
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
    :mode="toolbarPresenter.props.mode.value"
    :visual-mode="planningPresenter.props.visualMode.value"
    :can-toggle="true"
    :has-archive-trade-station="planningPresenter.props.hasArchive.value"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @toggle-mode="toolbarPresenter.emits.toggleMode"
  />
  
  <LiveStationToolbar
    v-if="toolbarPresenter.props.workbenchMode.value === 'station' && toolbarPresenter.props.hasActiveBinding.value"
    :station-name="toolbarPresenter.props.station.value?.name || ''"
    :station-code="toolbarPresenter.props.stationCode.value"
    :sector-name="toolbarPresenter.props.sectorName.value"
    :sector-name-id="toolbarPresenter.props.sectorNameId.value"
    :station-position="toolbarPresenter.props.position.value"
    :sector-resources="toolbarPresenter.props.sectorResources.value"
    :sector-sunlight="toolbarPresenter.props.sectorSunlight.value"
    :has-binding-station="toolbarPresenter.props.hasBinding.value"
    :has-save-station="toolbarPresenter.props.hasArchive.value"
    :mode="toolbarPresenter.props.mode.value"
    :can-toggle="toolbarPresenter.props.canToggle.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    :module-scope="toolbarPresenter.props.moduleScope.value"
    :has-building-modules="toolbarPresenter.props.hasBuildingModules.value"
    @update-station-name="toolbarPresenter.emits.updateStationName"
    @toggle-mode="toolbarPresenter.emits.toggleMode"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @update-workforce="toolbarPresenter.emits.updateWorkforce"
    @update-show-empire-gaps="toolbarPresenter.emits.updateShowEmpireGaps"
    @open-import="toolbarPresenter.emits.openImport"
    @cycle-module-scope="toolbarPresenter.emits.cycleModuleScope"
  />

  <TerraformingToolbar
    v-if="toolbarPresenter.props.workbenchMode.value === 'terraforming' && toolbarPresenter.props.hasActiveBinding.value"
    :hq-station-name="terraformingPresenter.props.toolbar.hqStationName.value"
    :station-code="terraformingPresenter.props.toolbar.stationCode.value"
    :sector-name="terraformingPresenter.props.toolbar.sectorName.value"
    :sector-name-id="terraformingPresenter.props.toolbar.sectorNameId.value"
    :position="terraformingPresenter.props.toolbar.position.value"
    :sector-resources="terraformingPresenter.props.toolbar.sectorResources.value"
    :sector-sunlight="terraformingPresenter.props.toolbar.sectorSunlight.value"
    :single-berth-throughput="terraformingPresenter.props.toolbar.singleBerthThroughput.value"
    :has-hq-station="terraformingPresenter.props.toolbar.hasHqStation.value"
  />

  <ImportPlanModal
    :isOpen="toolbarPresenter.props.showImportModal.value"
    :initialTab="'logic-flow'"
    :isOverview="toolbarPresenter.props.isImportOverview.value"
    productionSource="save-binding"
    :activeStationId="toolbarPresenter.props.importStationId.value"
    :activeStation="toolbarPresenter.props.importStation.value"
    :createStation="toolbarPresenter.props.createImportStation"
    :applyImportedStationPayload="toolbarPresenter.props.applyImportedStationPayload"
    :updateStationModules="toolbarPresenter.props.updateImportStationModules"
    :getStationById="toolbarPresenter.props.getImportStationById"
    @close="toolbarPresenter.emits.closeImport"
  />

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'terraforming'" class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <TerraformingSectorPanel
        :clusters="terraformingPresenter.props.sectorPanel.clusters.value"
        :selected-cluster-id="terraformingPresenter.props.sectorPanel.selectedClusterId.value"
        :cluster-display-names="terraformingPresenter.props.sectorPanel.clusterDisplayNames.value"
        :cluster-matches-hq="terraformingPresenter.props.sectorPanel.clusterMatchesHq.value"
        :objectives-progress="terraformingPresenter.props.sectorPanel.objectivesProgress.value"
        @select-cluster="terraformingPresenter.emits.selectCluster"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <TerraformingTaskList
        :task-tree="terraformingPresenter.props.taskList.taskTree.value"
        :group-names="terraformingPresenter.props.taskList.groupNames.value"
        :task-node-displays="terraformingPresenter.props.taskList.taskNodeDisplays.value"
        :completed-project-counts="terraformingPresenter.props.taskList.completedProjectCounts.value"
        :project-map="terraformingPresenter.props.taskList.projectMap.value"
        :project-display-names="terraformingPresenter.props.taskList.projectDisplayNames.value"
        :current-stats="terraformingPresenter.props.taskList.currentStats.value"
        :stat-display-names="terraformingPresenter.props.taskList.statDisplayNames.value"
        :stat-scale-models="terraformingPresenter.props.taskList.statScaleModels.value"
        :condition-scale-models="terraformingPresenter.props.taskList.conditionScaleModels.value"
        @toggle-project="terraformingPresenter.emits.toggleProject"
        @set-project-count="terraformingPresenter.emits.setProjectCount"
      />
    </div>

    <div class="col-span-12 lg:col-span-4">
      <TerraformingResourcePanel
        :selected-cluster-id="terraformingPresenter.props.resourcePanel.selectedClusterId.value"
        :execution-timeline="terraformingPresenter.props.resourcePanel.executionTimeline.value"
        :get-cancel-validation="terraformingPresenter.props.resourcePanel.getCancelValidation"
        @cancel-execution="terraformingPresenter.emits.cancelExecution"
      />
    </div>
  </div>

  <template v-else-if="toolbarPresenter.props.workbenchMode.value === 'overview' || toolbarPresenter.props.workbenchMode.value === 'transit'">
    <div v-if="toolbarPresenter.props.workbenchMode.value === 'transit'" class="main-layout mt-6">
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
          :production-flows="wareflowPresenter.props.derivedProductionFlows.value"
          :view-mode="wareflowPresenter.props.viewMode.value"
          :buy-multiplier="wareflowPresenter.props.settings.value.buyMultiplier"
          :sell-multiplier="wareflowPresenter.props.settings.value.sellMultiplier"
          :product-buffer-hours="wareflowPresenter.props.settings.value.primaryProductBufferHours"
          :use-allocation-volume-view="wareflowPresenter.props.useAllocationVolumeView.value"
          :allocation-volume-groups="wareflowPresenter.props.allocationVolumeGroups.value"
          :allocation-cargo-only-items="wareflowPresenter.props.allocationCargoOnlyItems.value"
          @update:view-mode="wareflowPresenter.emits.updateViewMode"
          @update:buy-multiplier="wareflowPresenter.emits.updateBuyMultiplier"
          @update:sell-multiplier="wareflowPresenter.emits.updateSellMultiplier"
          @update:product-buffer-hours="wareflowPresenter.emits.updatePrimaryProductBufferHours"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <StationDashboard
          :display-modules="[...dashboardPresenter.props.activeModules.value, ...dashboardPresenter.props.activeBuildingModules.value]"
          :hide-workers-view="true"
          :settings="dashboardPresenter.props.settings.value"
          :current-efficiency="1"
          :actual-workforce="0"
          :build-price-multiplier="dashboardPresenter.props.buildPriceMultiplier.value"
          @update-transport-ship-capacity="dashboardPresenter.emits.updateTransportShipCapacity"
          @update-build-price-multiplier="dashboardPresenter.emits.updateBuildPriceMultiplier"
          @update-use-hq="dashboardPresenter.emits.updateUseHQ"
        />
      </div>
    </div>

    <div v-else-if="toolbarPresenter.props.workbenchMode.value === 'overview'" class="main-layout mt-6">
      <div class="col-span-12 lg:col-span-3">
        <div class="overview-left-panel panel-card">
          <div class="panel-header">{{ t('save_import.title') }}</div>
          <div class="panel-content">
            <SaveUploadPanel @upload-complete="() => {}" />
            <SaveList />
          </div>
        </div>
      </div>

      <div class="col-span-12 lg:col-span-5">
        <EmpireWareFlowsDashboard
          :production-flows="liveStore.empireDerivedProductionFlows"
          :buy-multiplier="liveStore.overviewBuyMultiplier"
          :sell-multiplier="liveStore.overviewSellMultiplier"
          @update:buy-multiplier="liveStore.overviewBuyMultiplier = $event"
          @update:sell-multiplier="liveStore.overviewSellMultiplier = $event"
        />
      </div>

      <div class="col-span-12 lg:col-span-4"></div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanelWrapper
        :planned-modules="planningPresenter.props.plannedModules.value"
        :recommended-modules="planningPresenter.props.recommendedModules.value"
        :auto-industry-modules="planningPresenter.props.autoIndustryModules.value"
        :auto-habitation-modules="planningPresenter.props.autoHabitationModules.value"
        :auto-infrastructure-modules="planningPresenter.props.autoInfrastructureModules.value"
        :effective-auto-industry-modules="planningPresenter.props.effectiveAutoIndustryModules.value"
        :effective-auto-habitation-modules="planningPresenter.props.effectiveAutoHabitationModules.value"
        :effective-auto-infrastructure-modules="planningPresenter.props.effectiveAutoInfrastructureModules.value"
        :archive-total-map="planningPresenter.props.archiveTotalMap.value"
        :enforce-dlc-activation="planningPresenter.props.enforceDlcActivation.value"
        :show-archive="planningPresenter.props.visualMode.value === 'live'"
        :archive-modules="planningPresenter.props.liveModules.value"
        :building-modules="planningPresenter.props.liveBuildingModules.value"
        @update-planned-modules="planningPresenter.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :visual-mode="wareflowPresenter.props.visualMode.value"
        :view-mode="wareflowPresenter.props.viewMode.value"
        :use-allocation-volume-view="wareflowPresenter.props.useAllocationVolumeView.value"
        :production-flows="wareflowPresenter.props.derivedProductionFlows.value"
        :allocation-volume-groups="wareflowPresenter.props.allocationVolumeGroups.value"
        :allocation-cargo-only-items="wareflowPresenter.props.allocationCargoOnlyItems.value"
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
        :display-modules="dashboardPresenter.props.displayModules.value"
        :worker-modules="dashboardPresenter.props.workerModules.value"
        :building-cargo="dashboardPresenter.props.buildingCargo.value"
        :building-reservation="dashboardPresenter.props.buildingReservation.value"
        :building-scope-modules="dashboardPresenter.props.buildingScopeModules.value"
        :is-building-scope="dashboardPresenter.props.isBuildingScope.value"
        :building-in-progress="dashboardPresenter.props.buildingInProgress.value"
        :settings="dashboardPresenter.props.settings.value"
        :current-efficiency="dashboardPresenter.props.currentEfficiency.value"
        :actual-workforce="dashboardPresenter.props.actualWorkforce.value"
        :build-price-multiplier="dashboardPresenter.props.buildPriceMultiplier.value"
        :force-workforce-auto="dashboardPresenter.props.forceWorkforceAuto.value"
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

.overview-left-panel {
  @apply flex flex-col;
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

.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.panel-content {
  @apply p-2 flex flex-col gap-1 max-h-[calc(100vh-12rem)] overflow-y-auto;
}

.cluster-item {
  @apply flex flex-col px-3 py-2 rounded cursor-pointer transition-colors;
  @apply hover:bg-sky-500/10 text-slate-400 hover:text-slate-200;
}

.cluster-item.active {
  @apply bg-sky-500/20 text-sky-400 border border-sky-500/30;
}
</style>
