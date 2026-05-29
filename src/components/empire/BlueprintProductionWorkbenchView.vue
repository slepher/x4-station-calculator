<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useBuildPlanStore } from '@/store/useBuildPlanStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useProductionSidebarPresenter } from '@/components/empire/presenters/useProductionSidebarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import ProductionSidebar from '@/components/empire/ProductionSidebar.vue'
import BlueprintContextToolbar from '@/components/empire/context_toolbar/BlueprintContextToolbar.vue'
import TerraformingWorkbench from '@/components/empire/TerraformingWorkbench.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import { useBuildPlanPresenter } from '@/components/empire/presenters/useBuildPlanPresenter'
import BuildPlanConstraintsPanel from '@/components/empire/BuildPlanConstraintsPanel.vue'
import BuildPlanPanel from '@/components/empire/BuildPlanPanel.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'

const blueprintStore = useBlueprintProductionStore()
const terraformingStore = useTerraformingStore()
const buildPlanStore = useBuildPlanStore()
const activeViewStore = useActiveViewStore()

onMounted(() => {
  terraformingStore.init()
  const empireId = activeViewStore.activeEmpireId
  if (empireId && !blueprintStore.activeEmpire) {
    blueprintStore.loadEmpire(empireId)
  }
  if (empireId) {
    terraformingStore.ensurePlanForContext('blueprint', '__default__')
  }
})

watch(() => activeViewStore.activeEmpireId, (newId) => {
  if (newId && newId !== blueprintStore.activeEmpire?.id) {
    blueprintStore.loadEmpire(newId)
    terraformingStore.ensurePlanForContext('blueprint', '__default__')
  }
})

const sidebarPresenter = useProductionSidebarPresenter(blueprintStore)
const toolbarPresenter = useProductionToolbarPresenter(blueprintStore)
const planningPresenter = useProductionPlanningPresenter(blueprintStore)
const wareflowPresenter = useProductionWareflowPresenter(blueprintStore)
const dashboardPresenter = useProductionDashboardPresenter(blueprintStore)
const buildPlanPresenter = useBuildPlanPresenter({
  buildPlanStore,
  blueprintStore,
})
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
      :can-create-station="sidebarPresenter.props.canCreateStation"
      :can-open-context-menu="sidebarPresenter.props.canOpenContextMenu"
      :context-menu-mode="sidebarPresenter.props.contextMenuMode"
      :can-delete-station="sidebarPresenter.props.canDeleteStation"
      @select-overview="sidebarPresenter.emits.selectOverview"
      @select-station="sidebarPresenter.emits.selectStation"
      @create-station="sidebarPresenter.emits.createStation"
      @rename-station="sidebarPresenter.emits.renameStation"
      @duplicate-station="sidebarPresenter.emits.duplicateStation"
      @delete-station="sidebarPresenter.emits.deleteStation"
      @select-terraforming="sidebarPresenter.emits.selectTerraforming"
      @select-tech-tree="() => {}"
      @select-transit="() => {}"
      @expand-sector="() => {}"
      @jump-to-binding="() => {}"
    />
    <div class="production-content custom-scrollbar">
      <BlueprintContextToolbar
        v-if="toolbarPresenter.props.workbenchMode.value !== 'terraforming'"
    :station="toolbarPresenter.props.station.value"
    :workbench-mode="toolbarPresenter.props.workbenchMode.value"
    :title-model="toolbarPresenter.props.titleModel.value"
    :settings="toolbarPresenter.props.settings.value"
    :races="toolbarPresenter.props.races"
    :station-types="toolbarPresenter.props.stationTypes"
    :available-minerals="toolbarPresenter.props.availableMinerals"
    :single-berth-throughput="toolbarPresenter.props.singleBerthThroughput.value"
    @update-station-name="toolbarPresenter.emits.updateStationName"
    @update-station-type="toolbarPresenter.emits.updateStationType"
    @update-station-count="toolbarPresenter.emits.updateStationCount"
    @toggle-mineral="toolbarPresenter.emits.toggleMineral"
    @update-sunlight="toolbarPresenter.emits.updateSunlight"
    @update-transport-minutes="toolbarPresenter.emits.updateTransportMinutes"
    @update-race-preference="toolbarPresenter.emits.updateRacePreference"
    @update-title="toolbarPresenter.emits.updateTitle"
    @update-workforce="toolbarPresenter.emits.updateWorkforce"
    @update-show-empire-gaps="toolbarPresenter.emits.updateShowEmpireGaps"
    @open-import="toolbarPresenter.emits.openImport"
  />

  <ImportPlanModal
    :isOpen="toolbarPresenter.props.showImportModal.value"
    :initialTab="'logic-flow'"
    :isOverview="toolbarPresenter.props.isImportOverview.value"
    productionSource="empire"
    :activeStationId="toolbarPresenter.props.importStationId.value"
    :activeStation="toolbarPresenter.props.importStation.value"
    :createStation="toolbarPresenter.props.createImportStation"
    :applyImportedStationPayload="toolbarPresenter.props.applyImportedStationPayload"
    :updateStationModules="toolbarPresenter.props.updateImportStationModules"
    :getStationById="toolbarPresenter.props.getImportStationById"
    @close="toolbarPresenter.emits.closeImport"
  />

  <TerraformingWorkbench v-if="toolbarPresenter.props.workbenchMode.value === 'terraforming'" />

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'station'" class="main-layout">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel
        :planned-modules="planningPresenter.props.plannedModules.value"
        :recommended-modules="planningPresenter.props.recommendedModules.value"
        :auto-industry-modules="planningPresenter.props.autoIndustryModules.value"
        :auto-habitation-modules="planningPresenter.props.autoHabitationModules.value"
        :auto-infrastructure-modules="planningPresenter.props.autoInfrastructureModules.value"
        :enforce-dlc-activation="planningPresenter.props.enforceDlcActivation.value"
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

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'overview'" class="main-layout">
    <div class="col-span-12 lg:col-span-3">
      <BuildPlanConstraintsPanel
        :goals="buildPlanPresenter.props.goals.value"
        :buildMaterialPlanningEnabled="buildPlanPresenter.props.buildMaterialPlanningEnabled.value"
        :racePreference="buildPlanPresenter.props.racePreference.value"
        :build-plan="buildPlanPresenter.props.buildPlan.value"
        :loading="buildPlanPresenter.props.loading.value"
        :warnings="buildPlanPresenter.props.warnings.value"
        :planName="buildPlanPresenter.props.planName.value"
        :activePlanId="buildPlanPresenter.props.activePlanId.value"
        :loadablePlanItems="buildPlanPresenter.props.loadablePlanItems.value"
        :flowPlanName="buildPlanPresenter.props.flowPlanName.value"
        :selectedFlowPlanId="buildPlanPresenter.props.selectedFlowPlanId.value"
        :loadableFlowPlans="buildPlanPresenter.props.loadableFlowPlans.value"
        :allocations="buildPlanPresenter.props.allocations.value"
        :buildMaterialPreviewLines="buildPlanPresenter.props.buildMaterialPreviewLines.value"
        :productionPreviewLines="buildPlanPresenter.props.productionPreviewLines.value"
        :buildFlowPlanLoading="buildPlanPresenter.props.buildFlowPlanLoading.value"
        :fleetGoalView="buildPlanPresenter.props.fleetGoalView.value"
        @add-goal="buildPlanPresenter.emits.addGoal"
        @remove-goal="buildPlanPresenter.emits.removeGoal"
        @update-goal="buildPlanPresenter.emits.updateGoal"
        @set-build-material-planning-enabled="buildPlanPresenter.emits.setBuildMaterialPlanningEnabled"
        @compute-plan="buildPlanPresenter.emits.computePlan"
        @create-new-plan="buildPlanPresenter.emits.createNewPlan"
        @switch-plan="buildPlanPresenter.emits.switchPlan"
        @delete-plan="buildPlanPresenter.emits.deletePlan"
        @set-plan-name="buildPlanPresenter.emits.setPlanName"
        @load-flow-plan="buildPlanPresenter.emits.loadFlowPlan"
        @add-fleet-entry="buildPlanPresenter.emits.addFleetEntry"
        @remove-fleet-entry="buildPlanPresenter.emits.removeFleetEntry"
        @update-fleet-build-time="buildPlanPresenter.emits.updateFleetBuildTime"
        @update-fleet-build-time-mode="buildPlanPresenter.emits.updateFleetBuildTimeMode"
        @update-fleet-entry-quantity="buildPlanPresenter.emits.updateFleetEntryQuantity"
        @clear-fleet-group="buildPlanPresenter.emits.clearFleetGroup"
        @update-fleet-shipyard-count="buildPlanPresenter.emits.updateFleetShipyardCount"
      />
    </div>
    <div class="col-span-12 lg:col-span-4">
      <BuildPlanPanel
        :schemes="buildPlanPresenter.props.schemes.value"
        :loading="buildPlanPresenter.props.loading.value"
        :schemeGroups="buildPlanPresenter.props.schemeGroups.value"
        @export-to-station="buildPlanPresenter.emits.exportToStations($event)"
      />
    </div>
    <div class="col-span-12 lg:col-span-5">
      <EmpireWareFlowsDashboard
        :production-flows="blueprintStore.empireDerivedProductionFlows"
        :buy-multiplier="blueprintStore.overviewBuyMultiplier"
        :sell-multiplier="blueprintStore.overviewSellMultiplier"
        @update:buy-multiplier="blueprintStore.overviewBuyMultiplier = $event"
        @update:sell-multiplier="blueprintStore.overviewSellMultiplier = $event"
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
</style>
