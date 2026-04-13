<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useProductionTabbarPresenter } from '@/components/empire/presenters/useProductionTabbarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import StationTabBar from '@/components/empire/StationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'

const blueprintStore = useBlueprintProductionStore()
const activeViewStore = useActiveViewStore()
const workbench = blueprintStore.workbench

onMounted(() => {
  const empireId = activeViewStore.activeEmpireId
  if (empireId && !blueprintStore.activeEmpire) {
    blueprintStore.loadEmpire(empireId)
  }
})

watch(() => activeViewStore.activeEmpireId, (newId) => {
  if (newId && newId !== blueprintStore.activeEmpire?.id) {
    blueprintStore.loadEmpire(newId)
  }
})

const importModalOpen = computed({
  get: () => blueprintStore.importModalOpen,
  set: (value) => { blueprintStore.importModalOpen = value }
})

const tabbarPresenter = useProductionTabbarPresenter(workbench)
const toolbarPresenter = useProductionToolbarPresenter(workbench)
const planningPresenter = useProductionPlanningPresenter(workbench)
const wareflowPresenter = useProductionWareflowPresenter(workbench)
const dashboardPresenter = useProductionDashboardPresenter(workbench)

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

const activeStation = computed(() => blueprintStore.activeStation)
const importModalActiveStation = computed(() => {
  if (!activeStation.value) return null
  return { id: activeStation.value.id, modules: activeStation.value.modules }
})
</script>

<template>
  <StationTabBar
    :tabs="tabbarPresenter.props.tabs.value"
    :active-tab-id="tabbarPresenter.props.activeTabId.value"
    :expanded-sector-id="tabbarPresenter.props.expandedSectorId.value"
    :can-create-station="tabbarPresenter.props.canCreateStation"
    :can-open-context-menu="tabbarPresenter.props.canOpenContextMenu"
    @select-station="tabbarPresenter.emits.selectStation"
    @create-station="tabbarPresenter.emits.createStation"
    @rename-station="tabbarPresenter.emits.renameStation"
    @duplicate-station="tabbarPresenter.emits.duplicateStation"
    @delete-station="tabbarPresenter.emits.deleteStation"
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
    @open-import="importModalOpen = true"
  />

  <ImportPlanModal
    :isOpen="importModalOpen"
    :initialTab="'logic-flow'"
    :isOverview="!activeStation"
    productionSource="empire"
    :activeStationId="blueprintStore.activeStationId"
    :activeStation="importModalActiveStation"
    :createStation="(name, type) => blueprintStore.createStation(name, type)"
    :applyImportedStationPayload="(id, payload) => blueprintStore.applyImportedStationPayload(id, payload)"
    :updateStationModules="(id, modules) => blueprintStore.updateStationModules(id, modules)"
    :getStationById="(id) => blueprintStore.getStationById(id)"
    @close="importModalOpen = false"
  />

  <div v-if="activeStation" class="main-layout mt-6">
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
</style>