<script setup lang="ts">
import { onMounted, watch } from 'vue'
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
import BlueprintContextToolbar from '@/components/empire/context_toolbar/BlueprintContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'

const blueprintStore = useBlueprintProductionStore()
const activeViewStore = useActiveViewStore()

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

const tabbarPresenter = useProductionTabbarPresenter(blueprintStore)
const toolbarPresenter = useProductionToolbarPresenter(blueprintStore)
const planningPresenter = useProductionPlanningPresenter(blueprintStore)
const wareflowPresenter = useProductionWareflowPresenter(blueprintStore)
const dashboardPresenter = useProductionDashboardPresenter(blueprintStore)
</script>

<template>
  <StationTabBar
    :tabs="tabbarPresenter.props.tabs.value"
    :active-tab-id="tabbarPresenter.props.activeTabId.value"
    :expanded-sector-id="tabbarPresenter.props.expandedSectorId.value"
    :can-create-station="tabbarPresenter.props.canCreateStation"
    :can-open-context-menu="tabbarPresenter.props.canOpenContextMenu"
    @select-overview="tabbarPresenter.emits.selectOverview"
    @select-station="tabbarPresenter.emits.selectStation"
    @create-station="tabbarPresenter.emits.createStation"
    @rename-station="tabbarPresenter.emits.renameStation"
    @duplicate-station="tabbarPresenter.emits.duplicateStation"
    @delete-station="tabbarPresenter.emits.deleteStation"
  />
  <BlueprintContextToolbar
    v-if="toolbarPresenter.props.workbenchMode.value === 'station'"
    :station="toolbarPresenter.props.station.value!"
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

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'station'" class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel
        :planned-modules="planningPresenter.props.plannedModules.value"
        :auto-industry-modules="planningPresenter.props.autoIndustryModules.value"
        :auto-habitation-modules="planningPresenter.props.autoHabitationModules.value"
        :auto-infrastructure-modules="planningPresenter.props.autoInfrastructureModules.value"
        :enforce-dlc-activation="planningPresenter.props.enforceDlcActivation.value"
        @update-planned-modules="planningPresenter.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareflowPresenter.props.viewMode.value"
        :production-flows="wareflowPresenter.props.derivedProductionFlows.value"
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
        :modules="dashboardPresenter.props.modules.value"
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

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'overview'" class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3"><!-- BuildPlanConstraintsPanel placeholder --></div>
    <div class="col-span-12 lg:col-span-4"><!-- BuildPlanPanel placeholder --></div>
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
</template>

<style scoped>
.main-layout {
  @apply grid grid-cols-12 gap-8 items-start;
}
</style>
