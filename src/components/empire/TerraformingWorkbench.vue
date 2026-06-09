<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useTerraformingPresenter } from '@/components/empire/presenters/useTerraformingPresenter'
import TerraformingSectorPanel from '@/components/empire/terraforming/TerraformingSectorPanel.vue'
import TerraformingTaskList from '@/components/empire/terraforming/TerraformingTaskList.vue'
import TerraformingResourcePanel from '@/components/empire/terraforming/TerraformingResourcePanel.vue'

const terraformingStore = useTerraformingStore()
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
  window.addEventListener('resize', updatePanelMaxHeight)
  requestAnimationFrame(() => updatePanelMaxHeight())
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePanelMaxHeight)
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
})

const isQueueEditing = computed(() => terraformingPresenter.props.resourcePanel.queueEditState.editing.value)
const terraformingFloating = computed(() => ({
  sectorPanel: true,
  taskList: isQueueEditing.value,
  resourcePanel: !isQueueEditing.value,
}))
const statFilter = ref(new Set<string>())

function toggleStatFilter(statId: string) {
  const next = new Set(statFilter.value)
  if (next.has(statId)) next.delete(statId)
  else next.add(statId)
  statFilter.value = next
}
</script>

<template>
  <div class="main-layout pb-2" :style="{ '--panel-max-h': panelMaxHeight }">
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
        @click-stat="toggleStatFilter"
        @select-cluster="terraformingPresenter.emits.selectCluster"
      />
    </div>

    <div class="col-span-12 lg:col-span-5" :class="{ 'sticky top-2 z-10': terraformingFloating.taskList }">
      <TerraformingTaskList
        :task-tree="terraformingPresenter.props.taskList.taskTree.value"
        :group-names="terraformingPresenter.props.taskList.groupNames.value"
        :task-node-displays="terraformingPresenter.props.taskList.taskNodeDisplays.value"
        :completed-project-counts="terraformingPresenter.props.taskList.completedProjectCounts.value"
        :archive-completed-project-counts="terraformingPresenter.props.taskList.archiveCompletedProjectCounts.value"
        :project-map="terraformingPresenter.props.taskList.projectMap.value"
        :project-display-names="terraformingPresenter.props.taskList.projectDisplayNames.value"
        :floating="terraformingFloating.taskList"
        :stat-filter="statFilter"
        :is-editing="isQueueEditing"
        :stat-display-names="terraformingPresenter.props.sectorPanel.statDisplayNames.value"
        :goal-filtered-task-ids="terraformingPresenter.props.taskList.goalFilteredTaskIds.value"
        @click-stat="toggleStatFilter"
        @toggle-project="terraformingPresenter.emits.toggleProject"
        @set-project-count="terraformingPresenter.emits.setProjectCount"
        @start-drag-task="terraformingPresenter.emits.startDraggingTask"
        @end-drag-task="terraformingPresenter.emits.endDraggingTask"
      />
    </div>

    <div class="col-span-12 lg:col-span-4" :class="{ 'sticky top-2 z-10': terraformingFloating.resourcePanel }">
      <TerraformingResourcePanel
        :selected-cluster-id="terraformingPresenter.props.resourcePanel.selectedClusterId.value"
        :is-live-mode="terraformingPresenter.props.resourcePanel.isLiveMode.value"
        :execution-timeline="terraformingPresenter.props.resourcePanel.executionTimeline.value"
        :task-log-mode="terraformingPresenter.props.resourcePanel.taskLogMode.value"
        :current-queue-display-entries="terraformingPresenter.props.resourcePanel.currentQueueDisplayEntries.value"
        :executed-entries="terraformingPresenter.props.resourcePanel.executedEntries.value"
        :archive-sync-notice="terraformingPresenter.props.resourcePanel.archiveSyncNotice.value"
        :archive-active-project-display="terraformingPresenter.props.resourcePanel.archiveActiveProjectDisplay.value"
        :archive-retained-project-displays="terraformingPresenter.props.resourcePanel.archiveRetainedProjectDisplays.value"
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
        @click-stat="toggleStatFilter"
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
        @set-task-log-mode="terraformingPresenter.emits.setTaskLogMode"
        @confirm-archive-sync="terraformingPresenter.emits.confirmArchiveSync"
        @import-blueprint-settings="terraformingPresenter.emits.importBlueprintSettings"
      />
    </div>
  </div>
</template>
