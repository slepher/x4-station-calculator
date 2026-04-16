<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
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
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import type { TransitHubStorageModulePlan, SupplyStorageFlow } from '@/types/x4'

const liveStore = useLiveProductionStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()
const { t } = useI18n()

const transitHubDashboardRef = ref<{ storageModulePlans: TransitHubStorageModulePlan[], storageFlows: SupplyStorageFlow[] } | null>(null)

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

const bindingStation = computed(() => liveStore.bindingStation)
const archiveStation = computed(() => liveStore.archiveStation)

const hasBindingStation = computed(() => bindingStation.value !== null)
const hasSaveStation = computed(() => archiveStation.value !== null)
const mode = computed(() => liveStore.mode)
const canToggle = computed(() => liveStore.canToggle)
const stationCode = computed(() => archiveStation.value?.code || '')
const sectorResources = computed(() => {
  if (archiveStation.value?.sector?.resources?.length) {
    return archiveStation.value.sector.resources
  }
  return bindingSectorData.value?.resources || []
})

const bindingSectorData = computed(() => {
  const sectorMacro = bindingStation.value?.sectorMacro
  if (!sectorMacro) return null
  const sector = gameData.maps.sectors[sectorMacro]
  if (!sector) return null
  return {
    name: sector.name,
    nameId: sector.nameId,
    sunlight: sector.area?.sunlight ?? 1,
    resources: (sector.resources || []).map(r => r.ware)
  }
})

const sectorSunlight = computed(() => {
  if (archiveStation.value?.sector?.sunlight !== undefined) {
    return Math.round(archiveStation.value.sector.sunlight * 100)
  }
  if (bindingSectorData.value?.sunlight !== undefined) {
    return Math.round(bindingSectorData.value.sunlight * 100)
  }
  return 100
})

const sectorName = computed(() => {
  if (archiveStation.value?.sector?.name) {
    return archiveStation.value.sector.name
  }
  return bindingSectorData.value?.name || ''
})

const sectorNameId = computed(() => {
  if (archiveStation.value?.sector?.nameId) {
    return archiveStation.value.sector.nameId
  }
  return bindingSectorData.value?.nameId
})

const stationPosition = computed(() => {
  if (archiveStation.value?.position) {
    return archiveStation.value.position
  }
  return bindingStation.value?.position
})

const importModalActiveStation = computed(() => {
  if (!activeStation.value) return null
  return { id: activeStation.value.id, modules: activeStation.value.modules }
})

const empireWareFlowDerived = useEmpireWareFlowDerived({
  stations: computed(() => liveStore.orderedStationsBySector),
  modulesMap: computed(() => gameData.modulesMap || {}),
  waresMap: computed(() => gameData.waresMap || {})
})

const transitHubInput = computed(() => {
  const sectorId = activeTransitSectorId.value
  if (!sectorId) {
    return {
      sectorId: null,
      sectors: [],
      stations: [],
      localGroupedFlows: { flows: [], empireGroups: { operations: [], supply: [] } },
      solverOutput: null
    }
  }

  const sectorInternalData = liveStore.getSectorInternalData(sectorId)
  const sectorLinkCalc = liveStore.getSectorLinkCalc(sectorId)

  return {
    sectorId,
    sectors: liveStore.sectors,
    stations: liveStore.orderedStationsBySector,
    localGroupedFlows: sectorInternalData.localGroupedFlows,
    solverOutput: sectorLinkCalc?.solverOutput || null
  }
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
    v-if="isOverview"
    :title-model="toolbarPresenter.props.titleModel.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @open-import="liveStore.importModalOpen = true"
  />
  
  <LiveTransitToolbar
    v-if="activeTransitSectorId"
    :title-model="toolbarPresenter.props.titleModel.value"
    :settings="liveStore.transitHubSettings"
    :races="toolbarPresenter.props.races"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-race-preference="(v) => liveStore.updateTransitHubSettings({ racePreference: v })"
    @open-import="liveStore.importModalOpen = true"
  />
  
  <LiveStationToolbar
    v-if="activeStation"
    :station-name="toolbarPresenter.props.station.value?.name || ''"
    :station-code="stationCode"
    :sector-name="sectorName"
    :sector-name-id="sectorNameId"
    :station-position="stationPosition"
    :sector-resources="sectorResources"
    :sector-sunlight="sectorSunlight"
    :has-binding-station="hasBindingStation"
    :has-save-station="hasSaveStation"
    :mode="mode"
    :can-toggle="canToggle"
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
        <TransitHubBuildPanel :storage-module-plans="transitHubDashboardRef?.storageModulePlans || []" />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <TransitHubCenterDashboard
          ref="transitHubDashboardRef"
          :sector-id="transitHubInput.sectorId"
          :sectors="transitHubInput.sectors"
          :stations="transitHubInput.stations"
          :local-grouped-flows="transitHubInput.localGroupedFlows"
          :solver-output="transitHubInput.solverOutput"
          :view-mode="wareflowPresenter.props.viewMode.value"
          :race-preference="liveStore.transitHubSettings.racePreference ?? liveStore.settings.racePreference"
          :transport-ship-capacity="liveStore.settings.transportShipCapacity"
          :buy-multiplier="liveStore.transitHubSettings.buyMultiplier ?? liveStore.settings.buyMultiplier"
          :sell-multiplier="liveStore.transitHubSettings.sellMultiplier ?? liveStore.settings.sellMultiplier"
          :product-buffer-hours="liveStore.transitHubSettings.primaryProductBufferHours ?? liveStore.settings.primaryProductBufferHours"
          @update:view-mode="wareflowPresenter.emits.updateViewMode"
          @update:buy-multiplier="(v) => liveStore.updateTransitHubSettings({ buyMultiplier: v })"
          @update:sell-multiplier="(v) => liveStore.updateTransitHubSettings({ sellMultiplier: v })"
          @update:product-buffer-hours="(v) => liveStore.updateTransitHubSettings({ primaryProductBufferHours: v })"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel
          :planned-modules-override="(transitHubDashboardRef?.storageModulePlans || []).map(p => p.item)"
          :build-price-multiplier="liveStore.buildPriceMultiplier"
          :useHQ="liveStore.settings.useHQ"
          @update-build-price-multiplier="dashboardPresenter.emits.updateBuildPriceMultiplier"
          @update-use-hq="dashboardPresenter.emits.updateUseHQ"
        />
      </div>
    </div>

    <div v-else-if="isOverview" class="overview-layout mt-6">
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
        :mode="mode"
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