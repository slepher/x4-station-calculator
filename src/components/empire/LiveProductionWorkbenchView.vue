<script setup lang="ts">
import { computed, watch } from 'vue'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { storeToRefs } from 'pinia'
import type { PlayerBindingData } from '@/components/empire/presenters/useBlueprintRecipePresenter'
import { useProductionSidebarPresenter } from '@/components/empire/presenters/useProductionSidebarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import { useTerraformingPresenter } from '@/components/empire/presenters/useTerraformingPresenter'
import { useTransitTransportPresenter } from '@/components/empire/presenters/useTransitTransportPresenter'
import { useX4I18n } from '@/utils/UseX4I18n'
import StationPlanningPanelWrapper from '@/components/empire/StationPlanningPanelWrapper.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import ProductionSidebar from '@/components/empire/ProductionSidebar.vue'
import LiveTransitToolbar from '@/components/empire/context_toolbar/LiveTransitToolbar.vue'
import LiveStationToolbar from '@/components/empire/context_toolbar/LiveStationToolbar.vue'
import TerraformingToolbar from '@/components/empire/context_toolbar/TerraformingToolbar.vue'
import TerraformingWorkbench from '@/components/empire/TerraformingWorkbench.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import TransitTransportPanel from '@/components/empire/transit-hub/TransitTransportPanel.vue'
import TransitTransportShipSelector from '@/components/empire/transit-hub/TransitTransportShipSelector.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import TechTreePlaceholder from '@/components/empire/TechTreePlaceholder.vue'
import ResearchWorkbench from '@/components/empire/ResearchWorkbench.vue'
import BlueprintRecipeWorkbench from '@/components/empire/BlueprintRecipeWorkbench.vue'
import SectorOverviewPanel from '@/components/empire/sector-overview/SectorOverviewPanel.vue'
import AutoSectorGroupPanel from '@/components/map/AutoSectorGroupPanel.vue'

const liveStore = useLiveProductionStore()
const terraformingStore = useTerraformingStore()
const activeViewStore = useActiveViewStore()
const gameDataStore = useGameDataStore()
const saveStore = useSaveStore()
const shipBuildStore = useShipBuildStore()

const gameDataMaps = computed(() => gameDataStore.maps)

const { selectedArchive } = storeToRefs(saveStore)

const playerBindingData = computed<PlayerBindingData | null>(() => {
  const archive = selectedArchive.value
  if (!archive) return null
  return {
    blueprints: archive.playerBlueprints ?? [],
    relations: archive.playerRelations ?? {},
    licences: archive.playerLicences ?? {},
  }
})

terraformingStore.init()

watch(() => activeViewStore.activeBinding, (newGuid) => {
  if (newGuid) {
    liveStore.activateBinding(newGuid)
    terraformingStore.ensurePlanForContext('live', newGuid)
  }
})

const sidebarPresenter = useProductionSidebarPresenter(liveStore)
const toolbarPresenter = useProductionToolbarPresenter(liveStore)

watch(() => toolbarPresenter.props.workbenchMode.value, (mode) => {
  if (mode === 'terraforming' && activeViewStore.activeBinding) {
    terraformingStore.ensurePlanForContext('live', activeViewStore.activeBinding)
  }
}, { immediate: true })

const planningPresenter = useProductionPlanningPresenter(liveStore)
const wareflowPresenter = useProductionWareflowPresenter(liveStore)
const dashboardPresenter = useProductionDashboardPresenter(liveStore)
const { translateShip, translateWare, translateEquipment } = useX4I18n()

const transitTransportPresenter = useTransitTransportPresenter(liveStore, {
  modulesMap: gameDataStore.modulesMap,
  waresMap: gameDataStore.waresMap,
  shipBlueprints: computed(() => shipBuildStore.savedBlueprints.ships.flatMap((bucket) => bucket.blueprints)),
  findShip: (shipId) => shipBuildStore.findShip(shipId),
  findEquipment: (equipmentId) => shipBuildStore.findEquipment(equipmentId),
  findDrone: (droneId) => shipBuildStore.dronesMap.get(droneId) ?? null,
  includeShip: (ship) => shipBuildStore.isShipDlcUsable(ship),
  includeEquipment: (equipment) => shipBuildStore.isEquipmentDlcUsable(equipment),
  translateShip: (ship) => translateShip(ship),
  translateWare: (ware) => translateWare(ware),
  translateEquipment: (equipment) => translateEquipment(equipment)
})
const terraformingPresenter = useTerraformingPresenter({
  terraformingData: computed(() => terraformingStore.terraformingData),
  terraformingIsLiveMode: computed(() => terraformingStore.isLiveMode),
  terraformingSelectedClusterId: computed(() => terraformingStore.activePlan?.selectedClusterId ?? null),
  terraformingSelectedCluster: computed(() => terraformingStore.selectedCluster),
  terraformingRuntimeProjectIds: computed(() => terraformingStore.runtimeProjectIds),
  terraformingExecutionLog: computed(() => terraformingStore.executionLog),
  terraformingArchiveRuntimeBaseState: computed(() => terraformingStore.archiveRuntimeBaseState),
  terraformingSyncedExecutedBaseline: computed(() => terraformingStore.syncedExecutedBaseline),
  terraformingExecutedDelta: computed(() => terraformingStore.archiveExecutedDelta),
  terraformingDeductedExecution: computed(() => terraformingStore.deductedExecution),
  terraformingHqStationName: computed(() => terraformingStore.hqStationName),
  terraformingHqArchiveStation: computed(() => terraformingStore.hqArchiveStation),
  terraformingHqEffectiveModules: computed(() => terraformingStore.hqEffectiveModules),
  terraformingHqClusterId: computed(() => terraformingStore.hqClusterId),
  terraformingCurrentCumulativeRebates: computed(() => terraformingStore.currentCumulativeRebates),
  selectTerraformingCluster: (id: string) => terraformingStore.selectCluster(id),
  setTerraformingCompletedProjects: (projects: Map<string, number>) => {
    for (const [projectId, count] of projects) {
      terraformingStore.setProjectCount(projectId, count)
    }
  },
  appendTerraformingProjectExecution: (projectId: string, count?: number) => terraformingStore.appendExecution(projectId, count ?? 1),
  setTerraformingProjectCount: (projectId: string, count: number) => terraformingStore.setProjectCount(projectId, count),
  removeTerraformingExecutionEntry: (entryId: string) => terraformingStore.removeExecution(entryId),
  replaceTerraformingExecutionLog: (entries) => terraformingStore.replaceExecutionLog(entries as any),
  replaceTerraformingExecutionLogAndSyncBaseline: (entries) => terraformingStore.replaceExecutionLogAndSyncBaseline(entries as any),
  syncTerraformingExecutedBaseline: () => terraformingStore.syncExecutedBaselineForSelectedCluster(),
  clearTerraformingExecutedBaseline: () => terraformingStore.clearExecutedBaselineForSelectedCluster(),
  importTerraformingBlueprintSettings: () => terraformingStore.importBlueprintSettingsToActivePlan(),
  clearTerraformingExecutionQueue: () => terraformingStore.clearExecutionQueue(),
  mapsClusters: gameDataMaps.value?.clusters ?? {},
  mapsSectors: gameDataMaps.value?.sectors ?? {},
  wareNames: computed(() => {
    const map = new Map<string, string>()
    const lwm = gameDataStore.localizedWaresMap
    for (const [id, ware] of Object.entries(lwm)) {
      map.set(id, ware.localeName || ware.name || id)
    }
    return map
  }),
  moduleGroupNames: computed(() => {
    const map = new Map<string, string>()
    const mg = gameDataStore.localizedModuleGroupsMap
    for (const [id, group] of Object.entries(mg)) {
      map.set(id, group.localeName || group.name || id)
    }
    return map
  }),
  wareGroupMap: computed(() => {
    const map = new Map<string, string>()
    const wm = gameDataStore.waresMap
    for (const [id, ware] of Object.entries(wm)) {
      if (ware.group) map.set(id, ware.group)
    }
    return map
  }),
  terraformingPlayerRelations: computed(() => playerBindingData.value?.relations ?? {}),
})

const showArchiveModuleList = computed(() => {
  return planningPresenter.props.visualMode.value === 'live' && planningPresenter.props.hasArchive.value
})

function closeAutoSectorGroupPanel() {
  activeViewStore.activeBindingWorkbench = 'overview'
}

function openAutoSectorGroupMap() {
  const guid = activeViewStore.activeBinding
  if (!guid) return
  activeViewStore.isSavePanelOpen = true
  activeViewStore.mapBindingGameGuid = guid
  activeViewStore.mapSavePanelLayer = 'binding-sector'
  activeViewStore.setActiveView('maps')
}

watch(
  () => transitTransportPresenter.props.panel.value.shipSelector.selectedBlueprintValid,
  (valid) => {
    if (!valid) liveStore.setSelectedTransitTransportBlueprintId(null)
  },
  { immediate: true }
)

function openShipBuildForTransportSelection() {
  activeViewStore.setActiveView('ship-build')
}

</script>

<template>
  <div class="production-layout">
    <ProductionSidebar
      :tabs="sidebarPresenter.props.tabs.value"
      :active-tab-id="sidebarPresenter.props.activeTabId.value"
      :expanded-sector-id="sidebarPresenter.props.expandedSectorId.value"
      :has-sectors="sidebarPresenter.props.hasSectors"
      :show-terraforming="sidebarPresenter.props.showTerraforming"
      :show-tech-tree="sidebarPresenter.props.showTechTree"
      :show-research="sidebarPresenter.props.showResearch"
      :show-blueprint-recipe="sidebarPresenter.props.showBlueprintRecipe"
      :show-auto-sector-group="sidebarPresenter.props.showAutoSectorGroup"
      :auto-sector-group-disabled="sidebarPresenter.props.autoSectorGroupDisabled.value"
      :auto-sector-group-needs-recalc="sidebarPresenter.props.autoSectorGroupNeedsRecalc.value"
      :terraforming-clusters="terraformingStore.sidebarClusters"
      :active-terraforming-cluster-id="toolbarPresenter.props.workbenchMode.value === 'terraforming' ? (terraformingStore.activePlan?.selectedClusterId ?? null) : null"
      :can-create-station="sidebarPresenter.props.canCreateStation"
      :can-open-context-menu="sidebarPresenter.props.canOpenContextMenu"
      :context-menu-mode="sidebarPresenter.props.contextMenuMode"
      :can-delete-station="sidebarPresenter.props.canDeleteStation"
      @select-overview="sidebarPresenter.emits.selectOverview"
      @select-terraforming="sidebarPresenter.emits.selectTerraforming"
      @select-tech-tree="sidebarPresenter.emits.selectTechTree"
      @select-research="sidebarPresenter.emits.selectResearch"
      @select-blueprint-recipe="sidebarPresenter.emits.selectBlueprintRecipe"
      @select-auto-sector-group="sidebarPresenter.emits.selectAutoSectorGroup"
      @select-terraforming-cluster="(clusterId: string) => {
        activeViewStore.activeBindingWorkbench = 'terraforming'
        terraformingStore.selectCluster(clusterId)
      }"
      @select-transit="sidebarPresenter.emits.selectTransit"
      @select-station="sidebarPresenter.emits.selectStation"
      @create-station="sidebarPresenter.emits.createStation"
      @rename-station="sidebarPresenter.emits.renameStation"
      @duplicate-station="sidebarPresenter.emits.duplicateStation"
      @delete-station="sidebarPresenter.emits.deleteStation"
      @expand-sector="sidebarPresenter.emits.expandSector"
      @jump-to-binding="(tabId, tabType) => sidebarPresenter.emits.jumpToBinding(tabId, tabType)"
    />
    <div class="production-content custom-scrollbar">

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

  <TerraformingWorkbench v-if="toolbarPresenter.props.workbenchMode.value === 'terraforming'" :player-relations="playerBindingData?.relations ?? {}" />

  <div v-else-if="toolbarPresenter.props.workbenchMode.value === 'tech-tree'" class="">
    <TechTreePlaceholder />
  </div>

  <ResearchWorkbench v-else-if="toolbarPresenter.props.workbenchMode.value === 'research'" />

  <BlueprintRecipeWorkbench v-else-if="toolbarPresenter.props.workbenchMode.value === 'blueprint-recipe'" :playerData="playerBindingData" />

  <AutoSectorGroupPanel
    v-else-if="toolbarPresenter.props.workbenchMode.value === 'auto-sector-group'"
    layout="columns"
    @back="closeAutoSectorGroupPanel"
    @map="openAutoSectorGroupMap"
    @confirmed="closeAutoSectorGroupPanel"
  />

  <template v-else-if="toolbarPresenter.props.workbenchMode.value === 'overview' || toolbarPresenter.props.workbenchMode.value === 'transit'">
    <div v-if="toolbarPresenter.props.workbenchMode.value === 'transit'" class="main-layout">
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
        <TransitTransportShipSelector
          :selector="transitTransportPresenter.props.panel.value.shipSelector"
          @select="liveStore.setSelectedTransitTransportBlueprintId"
          @go-ship-build="openShipBuildForTransportSelection"
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
        <TransitTransportPanel :panel="transitTransportPresenter.props.panel.value" />
      </div>
    </div>

    <div v-else-if="toolbarPresenter.props.workbenchMode.value === 'overview'">
      <SectorOverviewPanel />
    </div>
  </template>

  <div v-else class="main-layout">
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
    </div>
  </div>
</template>

<style scoped>
.production-layout {
  @apply flex flex-1 min-h-0;
}

.production-content {
  @apply flex-1 flex flex-col min-w-0 overflow-y-auto;
}

.main-layout {
  @apply grid grid-cols-12 gap-8 items-start px-4 pt-4;
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
  @apply p-4 flex flex-col gap-4 max-h-none overflow-visible;
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
