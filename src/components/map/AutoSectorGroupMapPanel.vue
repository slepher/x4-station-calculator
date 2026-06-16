<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import SectorConfirmBar from '@/components/empire/sector-overview/SectorConfirmBar.vue'
import SectorGroupList from '@/components/empire/sector-overview/SectorGroupList.vue'
import SectorAllocationList from '@/components/empire/sector-overview/SectorAllocationList.vue'
import AllocationConfirmBar from '@/components/empire/sector-overview/AllocationConfirmBar.vue'
import HubAddMenu from './HubAddMenu.vue'
import SectorTradeStationList from '@/components/empire/sector-overview/SectorTradeStationList.vue'

const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'fit-sectors', sectorMacros: string[]): void
}>()

const { t } = useI18n()
const activeViewStore = useActiveViewStore()

const presenter = useAutoSectorGroupPresenter()
const {
  prefJumpRange,
  bridgeSearchJumpRange,
  prefThreshold,
  nodeEnabled,
  bridgeRetainEnabled,
  coverageRetainEnabled,
  tradeStationRetainEnabled,
  showHubAddMenu,
  autoGroupResult,
  autoGroupConfirmed,
  canDragGroups,
  calculationMode,
  editSnapshot,
  calcBaselinePillState,
  gameDataMaps,
  sectorGraphInfo,
  tradeStationCandidates,
  selectedTradeStations,
  tradeStationCaps,
  unresolvedAllocationGroups,
  unresolvedTradeStationGroups,
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
  handleResetTradeStations,
  handleAddHubClick,
  handleAddHubDraft,
  getExistingAnchorSectors,
  handleToggleRetainCoverage,
  handleToggleRetainConnection,
  handleToggleTradeStationRetain,
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleMasterTradeStationRetain,
  handleSelectTradeStation,
  handleConfirm,
  handleQuickCalculate,
  hasUncertainAssignments,
  hasPendingBridgeDecision,
  hasGlobalUnresolved,
  hasUnresolvedTradeStations,
  hasAutoResult,
  stationCounts,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate,
  tradeStationRetainIndeterminate
} = presenter

const liveStore = useLiveProductionStore()

watch(() => props.gameGuid, async (guid) => {
  if (guid) {
    activeViewStore.activeBinding = guid
    await liveStore.activateBinding(guid)
  }
}, { immediate: true })

const activeTab = ref<'hub' | 'allocation' | 'tradeStation'>('hub')

const isEditMode = () => calculationMode.value === 'edit'
const canSwitchToAllocation = () => !isEditMode()
const canSwitchToTradeStation = () => !isEditMode()

function onCalculate() {
  runCalculationFromEditInput()
  switchToFirstUnresolvedTab()
}

function onQuickCalc() {
  handleQuickCalculate()
  switchToFirstUnresolvedTab()
}

function switchToFirstUnresolvedTab() {
  if (hasUncertainAssignments.value || hasPendingBridgeDecision.value) {
    activeTab.value = 'allocation'
  } else if (hasUnresolvedTradeStations.value) {
    activeTab.value = 'tradeStation'
  } else {
    activeTab.value = 'hub'
  }
}

let initialAutoSwitchDone = false
watch(autoGroupResult, (result) => {
  if (initialAutoSwitchDone) return
  if (!result || result.groups.length === 0) return
  initialAutoSwitchDone = true
  switchToFirstUnresolvedTab()
})
watch(() => props.gameGuid, () => { initialAutoSwitchDone = false })
</script>

<template>
  <div class="auto-sector-group-map-panel">
    <div v-if="!hasAutoResult" class="map-panel-empty">
      {{ t('sector.no_groups') }}
    </div>

    <template v-else>
      <!-- Confirmed state -->
      <template v-if="autoGroupConfirmed">
        <SectorConfirmBar
          :pref-jump-range="prefJumpRange" :bridge-search-jump-range="bridgeSearchJumpRange"
          :pref-threshold="prefThreshold" :mode="calculationMode" view="map"
          :node-enabled="nodeEnabled" :can-disable-node="canDisableNode"
          :bridge-retain-enabled="bridgeRetainEnabled" :coverage-retain-enabled="coverageRetainEnabled"
          :trade-station-retain-enabled="tradeStationRetainEnabled"
          :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
          :bridge-retain-indeterminate="bridgeRetainIndeterminate" :coverage-retain-indeterminate="coverageRetainIndeterminate"
          @update:pref-jump-range="handleUpdatePrefJumpRange" @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
          @update:pref-threshold="prefThreshold = $event" @update:node-enabled="nodeEnabled = $event"
          @update:bridge-retain-enabled="handleMasterBridgeRetain" @update:coverage-retain-enabled="handleMasterCoverageRetain"
          @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
          @edit="handleEnterEdit" @cancel="handleCancelEdit" @calculate="onCalculate" @quick-calculate="onQuickCalc"
          @add-hub="handleAddHubClick" :show-confirm="false" :confirm-disabled="false" :add-menu-open="showHubAddMenu" @confirm="handleConfirm"
        />
        <HubAddMenu
          :open="showHubAddMenu"
          :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
          :occupied-sector-macros="[...getExistingAnchorSectors()]"
          @close="showHubAddMenu = false"
          @add-hub="(m: string) => { handleAddHubDraft(m); showHubAddMenu = false }"
          @focus-sector="emit('focus-sector', $event)"
        />
        <SectorGroupList
          :groups="autoGroupResult?.groups ?? []" :assignments="autoGroupResult?.assignments ?? []"
          :maps="gameDataMaps" :sector-graph="sectorGraphInfo.sectorGraph" :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
          :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
          :editable="calculationMode === 'edit'" :diff-enabled="false" :show-select-group-button="calculationMode !== 'edit'"
          :draggable="false" view="map"
          :trade-station-caps="tradeStationCaps"
          @cycle-recalc-state="handleCycleRecalcState"
          @update-jump-range="handleUpdateJumpRange"
          @toggle-coverage-input="handleToggleCoverageInput"
          @toggle-connected-input="handleToggleConnectedInput"
          @add-candidate-coverage="handleAddCandidateCoverage"
          @delete-group="handleDeleteGroup"
          @toggle-retain-coverage="handleToggleRetainCoverage"
          @toggle-retain-connection="handleToggleRetainConnection"
          @toggle-retain-trade-station="handleToggleTradeStationRetain"
          @focus-sector="emit('focus-sector', $event)" @select-group="emit('select-group', $event)"
        />
      </template>

      <!-- Unconfirmed state: tabs -->
      <template v-else>
        <div class="tab-bar">
          <button type="button" class="tab-btn" :class="{ active: activeTab === 'hub' }" @click="activeTab = 'hub'">{{ t('auto_sector.hub_tab') }}</button>
          <button type="button" class="tab-btn" :class="{ active: activeTab === 'allocation' }"
            :disabled="!canSwitchToAllocation()" :title="canSwitchToAllocation() ? '' : t('auto_sector.edit_overlay_hint')"
            @click="activeTab = 'allocation'">{{ t('auto_sector.allocation_tab') }}</button>
          <button type="button" class="tab-btn" :class="{ active: activeTab === 'tradeStation' }"
            :disabled="!canSwitchToTradeStation()" :title="canSwitchToTradeStation() ? '' : t('auto_sector.edit_overlay_hint')"
            @click="activeTab = 'tradeStation'">{{ t('auto_sector.trade_station_tab') }}</button>
        </div>

        <!-- Hub Tab -->
        <div v-show="activeTab === 'hub'">
          <SectorConfirmBar
            :pref-jump-range="prefJumpRange" :bridge-search-jump-range="bridgeSearchJumpRange"
            :pref-threshold="prefThreshold" :mode="calculationMode" view="map"
            :node-enabled="nodeEnabled" :can-disable-node="canDisableNode"
            :bridge-retain-enabled="bridgeRetainEnabled" :coverage-retain-enabled="coverageRetainEnabled"
            :trade-station-retain-enabled="tradeStationRetainEnabled"
          :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
            :bridge-retain-indeterminate="bridgeRetainIndeterminate" :coverage-retain-indeterminate="coverageRetainIndeterminate"
            @update:pref-jump-range="handleUpdatePrefJumpRange" @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
            @update:pref-threshold="prefThreshold = $event" @update:node-enabled="nodeEnabled = $event"
            @update:bridge-retain-enabled="handleMasterBridgeRetain" @update:coverage-retain-enabled="handleMasterCoverageRetain"
            @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
            @edit="handleEnterEdit" @cancel="handleCancelEdit" @calculate="onCalculate" @quick-calculate="onQuickCalc" @add-hub="handleAddHubClick"
            :show-confirm="calculationMode === 'result'" :confirm-disabled="hasGlobalUnresolved" :add-menu-open="showHubAddMenu"
            @confirm="handleConfirm"
          />
          <HubAddMenu
            :open="showHubAddMenu"
            :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
            :occupied-sector-macros="[...getExistingAnchorSectors()]"
            @close="showHubAddMenu = false"
            @add-hub="(m: string) => { handleAddHubDraft(m); showHubAddMenu = false }"
            @focus-sector="emit('focus-sector', $event)"
          />
          <SectorGroupList
            :groups="autoGroupResult?.groups ?? []" :assignments="autoGroupResult?.assignments ?? []"
            :maps="gameDataMaps" :sector-graph="sectorGraphInfo.sectorGraph" :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
            :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
            :editable="calculationMode === 'edit'"
            :diff-enabled="calculationMode === 'edit' || !autoGroupConfirmed"
            :baseline-coverage-by-group-id="calculationMode === 'edit' ? editSnapshot?.coverageByGroupId : calcBaselinePillState?.coverageByGroupId"
            :baseline-connected-group-ids-by-group-id="calculationMode === 'edit' ? editSnapshot?.connectedGroupIdsByGroupId : calcBaselinePillState?.connectedGroupIdsByGroupId"
            view="map" :draggable="canDragGroups"
            :trade-station-caps="tradeStationCaps"
            @cycle-recalc-state="handleCycleRecalcState" @update-jump-range="handleUpdateJumpRange"
            @toggle-coverage-input="handleToggleCoverageInput" @toggle-connected-input="handleToggleConnectedInput"
            @add-candidate-coverage="handleAddCandidateCoverage" @delete-group="handleDeleteGroup"
            @toggle-retain-coverage="handleToggleRetainCoverage" @toggle-retain-connection="handleToggleRetainConnection"
            @toggle-retain-trade-station="handleToggleTradeStationRetain"
            @focus-sector="emit('focus-sector', $event)"
          />
        </div>

        <!-- Allocation Tab -->
        <div v-show="activeTab === 'allocation'">
          <AllocationConfirmBar v-if="!hasPendingBridgeDecision"
            :unresolved="unresolvedAllocationGroups" :global-unresolved="hasGlobalUnresolved" :disabled="calculationMode === 'edit'"
            @reset="handleResetAssignments" @confirm="handleConfirm"
          />
          <SectorAllocationList
            :assignments="autoGroupResult?.assignments ?? []" :bridge-plans="autoGroupResult?.bridgePlans ?? []"
            :groups="autoGroupResult?.groups ?? []" :maps="gameDataMaps" :station-counts="stationCounts"
            :disabled="calculationMode === 'edit'" view="map"
            @select-option="handleSelectOption" @select-bridge-plan="handleSelectBridgePlan"
            @select-bridge-center="handleSelectBridgeCenter" @focus-sector="emit('focus-sector', $event)"
          />
        </div>

        <!-- TradeStation Tab -->
        <div v-show="activeTab === 'tradeStation'">
          <AllocationConfirmBar
            :unresolved="unresolvedTradeStationGroups" :global-unresolved="hasGlobalUnresolved" :disabled="calculationMode === 'edit'"
            @reset="handleResetTradeStations" @confirm="handleConfirm"
          />
          <SectorTradeStationList
            :groups="autoGroupResult?.groups ?? []"
            :candidates="tradeStationCandidates"
            :selected="selectedTradeStations"
            :disabled="calculationMode === 'edit'"
            view="map"
            @select="handleSelectTradeStation"
            @focus-sector="emit('focus-sector', $event)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.auto-sector-group-map-panel {
  --confirm-bar-gap: 4px;
}

.map-panel-empty {
  @apply text-sm text-slate-500 text-center py-6;
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
