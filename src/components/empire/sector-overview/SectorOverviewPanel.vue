<script setup lang="ts">
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorConfirmBar from './SectorConfirmBar.vue'
import SectorGroupList from './SectorGroupList.vue'
import SectorAllocationList from './SectorAllocationList.vue'
import AllocationConfirmBar from './AllocationConfirmBar.vue'
import SectorHubAddMenu from './SectorHubAddMenu.vue'

const presenter = useAutoSectorGroupPresenter()
const {
  t,
  prefJumpRange,
  bridgeSearchJumpRange,
  prefThreshold,
  nodeEnabled,
  bridgeRetainEnabled,
  coverageRetainEnabled,
  showHubAddMenu,
  autoGroupResult,
  autoGroupConfirmed,
  calculationMode,
  editSnapshot,
  calcBaselinePillState,
  gameDataMaps,
  sectorGraphInfo,
  runCalculationFromEditInput,
  handleEnterEdit,
  handleCancelEdit,
  handleUpdatePrefJumpRange,
  handleUpdateBridgeSearchJumpRange,
  handleSelectOption,
  handleCycleRecalcState,
  handleUpdateJumpRange,
  handleToggleCoverageInput,
  handleToggleConnectedInput,
  handleAddCandidateCoverage,
  handleDeleteGroup,
  handleSelectBridgeCenter,
  handleSelectBridgePlan,
  handleResetAssignments,
  handleAddHubClick,
  handleAddHubDraft,
  getExistingAnchorSectors,
  handleToggleRetainCoverage,
  handleToggleRetainConnection,
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleConfirm,
  triggerAutoGroup,
  handleUploadComplete,
  empireDerivedProductionFlows,
  overviewBuyMultiplier,
  overviewSellMultiplier,
  hasUncertainAssignments,
  hasPendingBridgeDecision,
  hasAutoResult,
  stationCounts,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate
} = presenter

defineExpose({ triggerAutoGroup })
</script>

<template>
  <div class="main-layout">
    <div class="col-span-12 lg:col-span-3">
      <div class="overview-left-panel panel-card">
        <div class="panel-header">{{ t('save_import.title') }}</div>
        <div class="panel-content">
          <SaveUploadPanel @upload-complete="handleUploadComplete" />
          <SaveList @bind-complete="triggerAutoGroup" />
        </div>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-5">
      <SectorConfirmBar
        v-if="hasAutoResult"
        :pref-jump-range="prefJumpRange"
        :bridge-search-jump-range="bridgeSearchJumpRange"
        :pref-threshold="prefThreshold"
        :mode="calculationMode"
        :node-enabled="nodeEnabled"
        :can-disable-node="canDisableNode"
        :bridge-retain-enabled="bridgeRetainEnabled"
        :coverage-retain-enabled="coverageRetainEnabled"
        :bridge-retain-indeterminate="bridgeRetainIndeterminate"
        :coverage-retain-indeterminate="coverageRetainIndeterminate"
        @update:pref-jump-range="handleUpdatePrefJumpRange"
        @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
        @update:pref-threshold="prefThreshold = $event"
        @update:node-enabled="nodeEnabled = $event"
        @update:bridge-retain-enabled="handleMasterBridgeRetain"
        @update:coverage-retain-enabled="handleMasterCoverageRetain"
        @edit="handleEnterEdit"
        @cancel="handleCancelEdit"
        @calculate="runCalculationFromEditInput"
        @add-hub="handleAddHubClick"
      />
      <SectorGroupList
        :groups="autoGroupResult?.groups ?? []"
        :assignments="autoGroupResult?.assignments ?? []"
        :maps="gameDataMaps"
        :sector-graph="sectorGraphInfo.sectorGraph"
        :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
        :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
        :editable="calculationMode === 'edit'"
        :diff-enabled="calculationMode === 'edit' || !autoGroupConfirmed"
        :baseline-coverage-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.coverageByGroupId : calcBaselinePillState?.coverageByGroupId
        "
        :baseline-connected-group-ids-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.connectedGroupIdsByGroupId : calcBaselinePillState?.connectedGroupIdsByGroupId
        "
        @cycle-recalc-state="handleCycleRecalcState"
        @update-jump-range="handleUpdateJumpRange"
        @toggle-coverage-input="handleToggleCoverageInput"
        @toggle-connected-input="handleToggleConnectedInput"
        @add-candidate-coverage="handleAddCandidateCoverage"
        @delete-group="handleDeleteGroup"
        @toggle-retain-coverage="handleToggleRetainCoverage"
        @toggle-retain-connection="handleToggleRetainConnection"
      />
    </div>

    <div class="col-span-12 lg:col-span-4 pb-4">
      <div class="col3-workspace" :class="{ 'col3-workspace--editing': calculationMode === 'edit' }">
        <AllocationConfirmBar
          v-if="hasAutoResult && !autoGroupConfirmed && !hasPendingBridgeDecision"
          :has-uncertain="hasUncertainAssignments"
          :disabled="calculationMode === 'edit'"
          @reset="handleResetAssignments"
          @confirm="handleConfirm"
        />
        <SectorAllocationList
          v-if="hasAutoResult && !autoGroupConfirmed"
          :assignments="autoGroupResult?.assignments ?? []"
          :bridge-plans="autoGroupResult?.bridgePlans ?? []"
          :groups="autoGroupResult?.groups ?? []"
          :maps="gameDataMaps"
          :station-counts="stationCounts"
          :disabled="calculationMode === 'edit'"
          @select-option="handleSelectOption"
          @select-bridge-plan="handleSelectBridgePlan"
          @select-bridge-center="handleSelectBridgeCenter"
        />
        <EmpireWareFlowsDashboard
          v-if="!hasAutoResult || autoGroupConfirmed"
          :production-flows="empireDerivedProductionFlows"
          :buy-multiplier="overviewBuyMultiplier"
          :sell-multiplier="overviewSellMultiplier"
          @update:buy-multiplier="overviewBuyMultiplier = $event"
          @update:sell-multiplier="overviewSellMultiplier = $event"
        />
        <div v-if="calculationMode === 'edit' && !autoGroupConfirmed" class="col3-overlay">
          <div class="col3-overlay-text">{{ t('sector.editing_input_overlay') }}</div>
        </div>
      </div>
    </div>
  </div>
  <SectorHubAddMenu
    v-if="showHubAddMenu"
    :maps="gameDataMaps"
    :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
    :existing-anchor-sector-macros="getExistingAnchorSectors()"
    :station-counts="stationCounts"
    @add-hub="handleAddHubDraft"
    @close="showHubAddMenu = false"
  />
</template>

<style scoped>
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

.col3-workspace {
  @apply relative;
}

.col3-workspace--editing {
  @apply min-h-32;
}

.col3-overlay {
  @apply absolute inset-0 z-10 flex items-start justify-center rounded bg-slate-950/55 backdrop-blur-[1px] pt-14;
}

.col3-overlay-text {
  @apply rounded border border-slate-600/60 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 shadow-lg;
}
</style>
