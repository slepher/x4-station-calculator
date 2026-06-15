<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorConfirmBar from './SectorConfirmBar.vue'
import SectorGroupList from './SectorGroupList.vue'
import SectorAllocationList from './SectorAllocationList.vue'
import SectorTradeStationList from './SectorTradeStationList.vue'
import AllocationConfirmBar from './AllocationConfirmBar.vue'
import HubAddMenu from '@/components/map/HubAddMenu.vue'

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
  canDragGroups,
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
  handleToggleTradeStationRetain,
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleMasterTradeStationRetain,
  handleConfirm,
  handleQuickCalculate,
  handleResetTradeStations,
  handleSelectTradeStation,
  triggerAutoGroup,
  handleUploadComplete,
  empireDerivedProductionFlows,
  overviewBuyMultiplier,
  overviewSellMultiplier,
  hasPendingBridgeDecision,
  hasUncertainAssignments,
  hasAutoResult,
  stationCounts,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate,
  tradeStationRetainIndeterminate,
  tradeStationRetainEnabled,
  tradeStationCandidates,
  selectedTradeStations,
  unresolvedAllocationGroups,
  unresolvedTradeStationGroups
} = presenter

const col3ActiveTab = ref<'allocation' | 'tradeStation'>('allocation')

const hasLiveTradeStationCandidates = computed(() => Object.keys(tradeStationCandidates).length > 0)

let initialLiveAutoSwitchDone = false
watch(autoGroupResult, (result) => {
  if (initialLiveAutoSwitchDone) return
  if (!result || result.groups.length === 0) return
  initialLiveAutoSwitchDone = true
  if (hasUncertainAssignments.value || hasPendingBridgeDecision.value) {
    col3ActiveTab.value = 'allocation'
  } else if (hasLiveTradeStationCandidates.value) {
    col3ActiveTab.value = 'tradeStation'
  } else {
    col3ActiveTab.value = 'allocation'
  }
})

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
        :trade-station-retain-enabled="tradeStationRetainEnabled"
        :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
        @update:pref-jump-range="handleUpdatePrefJumpRange"
        @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
        @update:pref-threshold="prefThreshold = $event"
        @update:node-enabled="nodeEnabled = $event"
        @update:bridge-retain-enabled="handleMasterBridgeRetain"
        @update:coverage-retain-enabled="handleMasterCoverageRetain"
        @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
        @edit="handleEnterEdit"
        @cancel="handleCancelEdit"
        @calculate="runCalculationFromEditInput"
        @add-hub="handleAddHubClick"
        @quick-calculate="handleQuickCalculate"
      />
      <SectorGroupList
        :key="canDragGroups ? 'live-draft-draggable-groups' : 'live-static-groups'"
        :groups="autoGroupResult?.groups ?? []"
        :assignments="autoGroupResult?.assignments ?? []"
        :maps="gameDataMaps"
        :sector-graph="sectorGraphInfo.sectorGraph"
        :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
        :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
        :editable="calculationMode === 'edit'"
        :draggable="canDragGroups"
        :diff-enabled="calculationMode === 'edit' || !autoGroupConfirmed"
        :baseline-coverage-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.coverageByGroupId : calcBaselinePillState?.coverageByGroupId
        "
        :baseline-connected-group-ids-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.connectedGroupIdsByGroupId : calcBaselinePillState?.connectedGroupIdsByGroupId
        "
        :selected-trade-stations="selectedTradeStations"
        @cycle-recalc-state="handleCycleRecalcState"
        @update-jump-range="handleUpdateJumpRange"
        @toggle-coverage-input="handleToggleCoverageInput"
        @toggle-connected-input="handleToggleConnectedInput"
        @add-candidate-coverage="handleAddCandidateCoverage"
        @delete-group="handleDeleteGroup"
        @toggle-retain-coverage="handleToggleRetainCoverage"
        @toggle-retain-connection="handleToggleRetainConnection"
        @toggle-retain-trade-station="handleToggleTradeStationRetain"
      />
    </div>

    <div class="col-span-12 lg:col-span-4 pb-4">
      <div class="col3-workspace" :class="{ 'col3-workspace--editing': calculationMode === 'edit' }">
        <template v-if="hasAutoResult && !autoGroupConfirmed">
          <div class="tab-bar">
            <button type="button" class="tab-btn" :class="{ active: col3ActiveTab === 'allocation' }"
              @click="col3ActiveTab = 'allocation'">{{ t('auto_sector.allocation_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: col3ActiveTab === 'tradeStation' }"
              @click="col3ActiveTab = 'tradeStation'">{{ t('auto_sector.trade_station_tab') }}</button>
          </div>
          <div v-show="col3ActiveTab === 'allocation'">
            <AllocationConfirmBar
              v-if="!hasPendingBridgeDecision"
              :unresolved="unresolvedAllocationGroups"
              :disabled="calculationMode === 'edit'"
              @reset="handleResetAssignments"
              @confirm="handleConfirm"
            />
            <SectorAllocationList
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
          </div>
          <div v-show="col3ActiveTab === 'tradeStation'">
            <AllocationConfirmBar
              :unresolved="unresolvedTradeStationGroups"
              :disabled="calculationMode === 'edit'"
              @reset="handleResetTradeStations"
              @confirm="handleConfirm"
            />
            <SectorTradeStationList
              :groups="autoGroupResult?.groups ?? []"
              :candidates="tradeStationCandidates"
              :selected="selectedTradeStations"
              :disabled="calculationMode === 'edit'"
              @select="handleSelectTradeStation"
            />
          </div>
        </template>
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
  <div v-if="showHubAddMenu" class="hub-add-overlay" @click.self="showHubAddMenu = false">
    <HubAddMenu
      mode="overlay"
      :open="showHubAddMenu"
      :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
      :occupied-sector-macros="[...getExistingAnchorSectors()]"
      @close="showHubAddMenu = false"
      @add-hub="(m: string) => { handleAddHubDraft(m); showHubAddMenu = false }"
      @focus-sector="() => {}"
    />
  </div>
</template>

<style scoped>
.hub-add-overlay {
  @apply fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60;
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

/* Tab Bar */
.tab-bar {
  @apply flex border-b border-slate-700/50 mb-3;
}

.tab-btn {
  @apply px-3 py-1.5 text-xs font-medium text-slate-400 border-b-2 border-transparent transition-colors;
}

.tab-btn:hover:not(:disabled) {
  @apply text-slate-200;
}

.tab-btn.active {
  @apply text-sky-400 border-sky-400;
}

.tab-btn:disabled {
  @apply text-slate-600 cursor-not-allowed;
}
</style>
