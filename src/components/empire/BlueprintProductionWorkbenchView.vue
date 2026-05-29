<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useBuildPlanStore } from '@/store/useBuildPlanStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useProductionSidebarPresenter } from '@/components/empire/presenters/useProductionSidebarPresenter'
import { useProductionToolbarPresenter } from '@/components/empire/presenters/useProductionToolbarPresenter'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import { useTerraformingPresenter } from '@/components/empire/presenters/useTerraformingPresenter'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import ProductionSidebar from '@/components/empire/ProductionSidebar.vue'
import BlueprintContextToolbar from '@/components/empire/context_toolbar/BlueprintContextToolbar.vue'
import TerraformingSectorPanel from '@/components/empire/terraforming/TerraformingSectorPanel.vue'
import TerraformingTaskList from '@/components/empire/terraforming/TerraformingTaskList.vue'
import TerraformingResourcePanel from '@/components/empire/terraforming/TerraformingResourcePanel.vue'
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
const gameDataStore = useGameDataStore()

const gameDataMaps = computed(() => gameDataStore.maps)

const panelMaxHeight = ref('calc(100vh - 5rem)')

function updatePanelMaxHeight() {
  const h = window.innerHeight
  const margin = 80
  const maxH = h - margin
  panelMaxHeight.value = `${maxH}px`
}

onMounted(() => {
  terraformingStore.init()
  const empireId = activeViewStore.activeEmpireId
  if (empireId && !blueprintStore.activeEmpire) {
    blueprintStore.loadEmpire(empireId)
  }
  if (empireId) {
    terraformingStore.ensurePlanForContext('blueprint', empireId)
  }
  window.addEventListener('resize', updatePanelMaxHeight)
  requestAnimationFrame(() => updatePanelMaxHeight())
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePanelMaxHeight)
})

watch(() => activeViewStore.activeEmpireId, (newId) => {
  if (newId && newId !== blueprintStore.activeEmpire?.id) {
    blueprintStore.loadEmpire(newId)
    terraformingStore.ensurePlanForContext('blueprint', newId)
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

const terraformingPresenter = useTerraformingPresenter({
  terraformingData: computed(() => terraformingStore.terraformingData),
  terraformingSelectedClusterId: computed(() => terraformingStore.activePlan?.selectedClusterId ?? null),
  terraformingSelectedCluster: computed(() => terraformingStore.selectedCluster),
  terraformingCurrentStats: computed(() => terraformingStore.currentStats),
  terraformingRuntimeProjectIds: computed(() => terraformingStore.runtimeProjectIds),
  terraformingCompletedProjects: computed(() => terraformingStore.completedProjects),
  terraformingExecutionLog: computed(() => terraformingStore.executionLog),
  terraformingHqStationName: computed(() => terraformingStore.hqStationName),
  terraformingHqArchiveStation: computed(() => terraformingStore.hqArchiveStation),
  terraformingHqEffectiveModules: computed(() => terraformingStore.hqEffectiveModules),
  terraformingHqClusterId: computed(() => terraformingStore.hqClusterId),
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
})

const isQueueEditing = computed(() => terraformingPresenter.props.resourcePanel.queueEditState.editing.value)
const terraformingFloating = computed(() => ({
  sectorPanel: true,
  taskList: isQueueEditing.value,
  resourcePanel: !isQueueEditing.value,
}))
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

  <div v-if="toolbarPresenter.props.workbenchMode.value === 'terraforming'" class="main-layout pb-6" :style="{ '--panel-max-h': panelMaxHeight }">
    <div class="col-span-12 lg:col-span-3" :class="{ 'sticky top-2 z-10': terraformingFloating.sectorPanel }">
      <TerraformingSectorPanel
        :clusters="terraformingPresenter.props.sectorPanel.clusters.value"
        :selected-cluster-id="terraformingPresenter.props.sectorPanel.selectedClusterId.value"
        :cluster-display-names="terraformingPresenter.props.sectorPanel.clusterDisplayNames.value"
        :cluster-matches-hq="terraformingPresenter.props.sectorPanel.clusterMatchesHq.value"
        :objectives-progress="terraformingPresenter.props.sectorPanel.objectivesProgress.value"
        :stat-scale-models="terraformingPresenter.props.sectorPanel.statScaleModels.value"
        :current-stats="terraformingPresenter.props.sectorPanel.currentStats.value"
        :stat-display-names="terraformingPresenter.props.sectorPanel.statDisplayNames.value"
        :active-rebates="terraformingPresenter.props.sectorPanel.activeRebates.value"
        :cluster-reward-displays="terraformingPresenter.props.sectorPanel.clusterRewardDisplays.value"
        :floating="terraformingFloating.sectorPanel"
        @click-stat="() => {}"
        @select-cluster="terraformingPresenter.emits.selectCluster"
        @display-mode-change="() => {}"
      />
    </div>

    <div class="col-span-12 lg:col-span-5" :class="{ 'sticky top-2 z-10': terraformingFloating.taskList }">
      <TerraformingTaskList
        :task-tree="terraformingPresenter.props.taskList.taskTree.value"
        :group-names="terraformingPresenter.props.taskList.groupNames.value"
        :task-node-displays="terraformingPresenter.props.taskList.taskNodeDisplays.value"
        :completed-project-counts="terraformingPresenter.props.taskList.completedProjectCounts.value"
        :project-map="terraformingPresenter.props.taskList.projectMap.value"
        :project-display-names="terraformingPresenter.props.taskList.projectDisplayNames.value"
        :floating="terraformingFloating.taskList"
        :stat-filter="new Set()"
        :is-editing="false"
        :stat-display-names="terraformingPresenter.props.sectorPanel.statDisplayNames.value"
        :goal-filtered-task-ids="terraformingPresenter.props.taskList.goalFilteredTaskIds.value"
        @click-stat="() => {}"
        @toggle-project="terraformingPresenter.emits.toggleProject"
        @set-project-count="terraformingPresenter.emits.setProjectCount"
        @start-drag-task="terraformingPresenter.emits.startDraggingTask"
        @end-drag-task="terraformingPresenter.emits.endDraggingTask"
      />
    </div>

    <div class="col-span-12 lg:col-span-4" :class="{ 'sticky top-2 z-10': terraformingFloating.resourcePanel }">
      <TerraformingResourcePanel
        :selected-cluster-id="terraformingPresenter.props.resourcePanel.selectedClusterId.value"
        :execution-timeline="terraformingPresenter.props.resourcePanel.executionTimeline.value"
        :queue-edit-state="{
          editing: terraformingPresenter.props.resourcePanel.queueEditState.editing.value,
          canComplete: terraformingPresenter.props.resourcePanel.queueEditState.canComplete.value,
          unsatisfiedGoalCount: terraformingPresenter.props.resourcePanel.queueEditState.unsatisfiedGoalCount.value,
          planEntries: terraformingPresenter.props.resourcePanel.queueEditState.planEntries.value
        }"
        :get-cancel-validation="terraformingPresenter.props.resourcePanel.getCancelValidation"
        :delivery-ship-map="terraformingPresenter.props.resourcePanel.deliveryShipMap.value"
        :hq-build-docks="terraformingPresenter.props.resourcePanel.hqBuildDocks.value"
        :floating="terraformingFloating.resourcePanel"
        :task-drag="terraformingPresenter.props.taskDrag"
        @click-stat="() => {}"
        @cancel-execution="terraformingPresenter.emits.cancelExecution"
        @clear-all="terraformingPresenter.emits.clearExecutionQueue"
        @start-edit="terraformingPresenter.emits.startQueueEdit"
        @cancel-edit="terraformingPresenter.emits.cancelQueueEdit"
        @complete-edit="terraformingPresenter.emits.completeQueueEdit"
        @remove-draft="terraformingPresenter.emits.removeDraftEntry"
        @remove-all-draft="terraformingPresenter.emits.removeAllDraftEntries"
        @copy-draft="terraformingPresenter.emits.copyDraftEntry"
        @update-draft-entries="terraformingPresenter.emits.reorderDraftEntries"
        @click-goal="terraformingPresenter.emits.clickGoal"
        @move-task-before-dependency="terraformingPresenter.emits.moveTaskBeforeDependency"
        @drop-task="(pid: string, idx?: number) => terraformingPresenter.emits.appendDraftTask(pid, idx)"
      />
    </div>
  </div>

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
