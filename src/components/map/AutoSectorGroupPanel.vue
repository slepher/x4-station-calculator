<script setup lang="ts">
import { ref, watch, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import AutoSectorBar from '@/components/empire/sector-overview/AutoSectorBar.vue'
import SectorGroupStatBar from '@/components/empire/sector-overview/SectorGroupStatBar.vue'
import SectorGroupList from '@/components/empire/sector-overview/SectorGroupList.vue'
import SectorAllocationList from '@/components/empire/sector-overview/SectorAllocationList.vue'
import HubAddMenu from './HubAddMenu.vue'
import SectorTradeStationList from '@/components/empire/sector-overview/SectorTradeStationList.vue'

const props = withDefaults(defineProps<{
  gameGuid?: string
  layout?: 'tabs' | 'columns'
}>(), {
  layout: 'tabs'
})

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'fit-sectors', sectorMacros: string[]): void
}>()

const { t } = useI18n()
const activeViewStore = useActiveViewStore()

const presenter = useAutoSectorGroupPresenter()
const {
  prefJumpRange, bridgeSearchJumpRange, prefThreshold, nodeEnabled,
  bridgeRetainEnabled, coverageRetainEnabled, tradeStationRetainEnabled,
  showHubAddMenu, autoGroupResult, canDragGroups,
  calculationMode, calcBaselinePillState,
  gameDataMaps, sectorGraphInfo,
  tradeStationCandidates, selectedTradeStations, tradeStationCaps,
  unresolvedAllocationGroups, unresolvedTradeStationGroups,
  runCalculationFromEditInput, handleEnterEdit, handleExitEdit,
  handleUpdatePrefJumpRange, handleUpdateBridgeSearchJumpRange,
  handleSelectOption, handleCycleRecalcState, handleUpdateJumpRange,
  handleToggleCoverageInput, handleToggleConnectedInput,
  handleAddCandidateCoverage, handleDeleteGroup,
  handleSelectBridgeCenter, handleSelectBridgePlan,
  handleResetAssignments,
  handleAddHubClick, handleAddHubDraft, getExistingAnchorSectors,
  handleToggleRetainCoverage, handleToggleRetainConnection,
  handleToggleTradeStationRetain, handleMasterBridgeRetain,
  handleMasterCoverageRetain, handleMasterTradeStationRetain,
  handleSelectTradeStation, handleConfirm, handleQuickCalculate,
  hasUncertainAssignments, hasPendingBridgeDecision,
   hasUnresolvedTradeStations, showConfirmPopup, hasChanges,
  hasAutoResult, stationCounts, canDisableNode,
  bridgeRetainIndeterminate, coverageRetainIndeterminate,
  tradeStationRetainIndeterminate,
  handleColorChange, sectorGroupColorMap, triggerAutoGroup, handleReorderGroups,
} = presenter

provide('sectorGroupColorMap', sectorGroupColorMap)

const liveStore = useLiveProductionStore()

watch(() => props.gameGuid, async (guid) => {
  if (guid) {
    activeViewStore.activeBinding = guid
    await liveStore.activateBinding(guid)
    if (!autoGroupResult.value) {
      triggerAutoGroup()
    }
  }
}, { immediate: true })

const activeTab = ref<'hub' | 'allocation' | 'tradeStation'>('hub')
const canSwitchToAllocation = () => true
const canSwitchToTradeStation = () => true

function onCalculate() { runCalculationFromEditInput(); switchToFirstUnresolvedTab() }
function onQuickCalc() { handleQuickCalculate(); switchToFirstUnresolvedTab() }

function switchToFirstUnresolvedTab() {
  if (hasUncertainAssignments.value || hasPendingBridgeDecision.value) activeTab.value = 'allocation'
  else if (hasUnresolvedTradeStations.value) activeTab.value = 'tradeStation'
  else activeTab.value = 'hub'
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
    <div v-if="!hasAutoResult" class="map-panel-empty">{{ t('sector.no_groups') }}</div>
    <template v-else>
      <template v-if="layout === 'columns'">
        <div class="px-4 pt-3 mb-2">
        <AutoSectorBar
          :mode="calculationMode === 'edit' ? 'edit' : 'result'"
          view="live"
          :pref-jump-range="prefJumpRange"
          :bridge-search-jump-range="bridgeSearchJumpRange"
          :pref-threshold="prefThreshold"
          :node-enabled="nodeEnabled"
          :can-disable-node="canDisableNode"
          :unresolved-allocation-count="unresolvedAllocationGroups.length"
          :unresolved-trade-station-count="unresolvedTradeStationGroups.length"
          :show-confirm="true"
          :confirm-disabled="hasUnresolvedTradeStations || !hasChanges"
          @update:pref-jump-range="handleUpdatePrefJumpRange"
          @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
          @update:pref-threshold="prefThreshold = $event"
          @update:node-enabled="nodeEnabled = $event"
          @calculate="onCalculate"
          @quick-calculate="onQuickCalc"
          @reset="handleResetAssignments"
          @confirm="handleConfirm"
        />
        </div>
        <div class="columns-layout">
          <div class="column column-hub">
            <SectorGroupStatBar
              :mode="calculationMode === 'edit' ? 'edit' : 'result'"
              view="live"
              :bridge-retain-enabled="bridgeRetainEnabled"
              :coverage-retain-enabled="coverageRetainEnabled"
              :trade-station-retain-enabled="tradeStationRetainEnabled"
              :bridge-retain-indeterminate="bridgeRetainIndeterminate"
              :coverage-retain-indeterminate="coverageRetainIndeterminate"
              :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
              :show-add-hub="showHubAddMenu"
              :edit-disabled="!autoGroupResult"
              @update:bridge-retain-enabled="handleMasterBridgeRetain"
              @update:coverage-retain-enabled="handleMasterCoverageRetain"
              @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
              @edit="handleEnterEdit"
              @exit="handleExitEdit"
              @add-hub="handleAddHubClick"
            />
            <HubAddMenu mode="overlay" :open="showHubAddMenu" :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []" :occupied-sector-macros="[...getExistingAnchorSectors()]"
              @close="showHubAddMenu = false" @add-hub="(m: string) => { handleAddHubDraft(m); showHubAddMenu = false }" @focus-sector="emit('focus-sector', $event)"
            />
            <SectorGroupList :groups="autoGroupResult?.groups ?? []" :assignments="autoGroupResult?.assignments ?? []"
              :maps="gameDataMaps" :sector-graph="sectorGraphInfo.sectorGraph" :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
              :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
              :editable="calculationMode === 'edit'"               :diff-enabled="true"
              :baseline-coverage-by-group-id="calcBaselinePillState?.coverageByGroupId"
              :baseline-connected-group-ids-by-group-id="calcBaselinePillState?.connectedGroupIdsByGroupId"
              :draggable="canDragGroups" view="live" :trade-station-caps="tradeStationCaps"
              @cycle-recalc-state="handleCycleRecalcState" @update-jump-range="handleUpdateJumpRange"
              @toggle-coverage-input="handleToggleCoverageInput" @toggle-connected-input="handleToggleConnectedInput"
              @add-candidate-coverage="handleAddCandidateCoverage" @delete-group="handleDeleteGroup"
              @toggle-retain-coverage="handleToggleRetainCoverage" @toggle-retain-connection="handleToggleRetainConnection"
              @toggle-retain-trade-station="handleToggleTradeStationRetain"
              @color-change="handleColorChange" @focus-sector="emit('focus-sector', $event)"
              @reorder="handleReorderGroups"/>
          </div>
          <div class="column column-allocation">
            <SectorAllocationList :assignments="autoGroupResult?.assignments ?? []" :bridge-plans="autoGroupResult?.bridgePlans ?? []"
              :groups="autoGroupResult?.groups ?? []" :maps="gameDataMaps" :station-counts="stationCounts"
              @select-option="handleSelectOption" @select-bridge-plan="handleSelectBridgePlan" @select-bridge-center="handleSelectBridgeCenter" @focus-sector="emit('focus-sector', $event)"
            />
          </div>
          <div class="column column-tradestation">
            <SectorTradeStationList :groups="autoGroupResult?.groups ?? []" :candidates="tradeStationCandidates" :selected="selectedTradeStations"
              @select="handleSelectTradeStation" @focus-sector="emit('focus-sector', $event)"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <AutoSectorBar
          :mode="calculationMode === 'edit' ? 'edit' : 'result'"
          view="map"
          :pref-jump-range="prefJumpRange"
          :bridge-search-jump-range="bridgeSearchJumpRange"
          :pref-threshold="prefThreshold"
          :node-enabled="nodeEnabled"
          :can-disable-node="canDisableNode"
          :unresolved-allocation-count="unresolvedAllocationGroups.length"
          :unresolved-trade-station-count="unresolvedTradeStationGroups.length"
          :show-confirm="calculationMode === 'result'"
          :confirm-disabled="hasUnresolvedTradeStations || !hasChanges"
          @update:pref-jump-range="handleUpdatePrefJumpRange"
          @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
          @update:pref-threshold="prefThreshold = $event"
          @update:node-enabled="nodeEnabled = $event"
          @calculate="onCalculate"
          @quick-calculate="onQuickCalc"
          @reset="handleResetAssignments"
          @confirm="handleConfirm"
        />
        <div class="tab-bar">
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'hub' }" @click="activeTab = 'hub'">{{ t('auto_sector.hub_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'allocation' }"
              :disabled="!canSwitchToAllocation()" :title="canSwitchToAllocation() ? '' : t('auto_sector.edit_overlay_hint')"
              @click="activeTab = 'allocation'">{{ t('auto_sector.allocation_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'tradeStation' }"
              :disabled="!canSwitchToTradeStation()" :title="canSwitchToTradeStation() ? '' : t('auto_sector.edit_overlay_hint')"
              @click="activeTab = 'tradeStation'">{{ t('auto_sector.trade_station_tab') }}</button>
          </div>
          <div v-show="activeTab === 'hub'">
            <SectorGroupStatBar
              :mode="calculationMode === 'edit' ? 'edit' : 'result'"
              view="map"
              :bridge-retain-enabled="bridgeRetainEnabled"
              :coverage-retain-enabled="coverageRetainEnabled"
              :trade-station-retain-enabled="tradeStationRetainEnabled"
              :bridge-retain-indeterminate="bridgeRetainIndeterminate"
              :coverage-retain-indeterminate="coverageRetainIndeterminate"
              :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
              :show-add-hub="showHubAddMenu"
              :edit-disabled="!autoGroupResult"
              @update:bridge-retain-enabled="handleMasterBridgeRetain"
              @update:coverage-retain-enabled="handleMasterCoverageRetain"
              @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
              @edit="handleEnterEdit"
              @exit="handleExitEdit"
              @add-hub="handleAddHubClick"
            />
            <HubAddMenu :open="showHubAddMenu" :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []" :occupied-sector-macros="[...getExistingAnchorSectors()]"
              @close="showHubAddMenu = false" @add-hub="(m: string) => { handleAddHubDraft(m); showHubAddMenu = false }" @focus-sector="emit('focus-sector', $event)"
            />
            <SectorGroupList :groups="autoGroupResult?.groups ?? []" :assignments="autoGroupResult?.assignments ?? []"
              :maps="gameDataMaps" :sector-graph="sectorGraphInfo.sectorGraph" :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
              :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
              :editable="calculationMode === 'edit'"               :diff-enabled="true"
              :baseline-coverage-by-group-id="calcBaselinePillState?.coverageByGroupId"
              :baseline-connected-group-ids-by-group-id="calcBaselinePillState?.connectedGroupIdsByGroupId"
              view="map" :draggable="canDragGroups" :trade-station-caps="tradeStationCaps"
              @cycle-recalc-state="handleCycleRecalcState" @update-jump-range="handleUpdateJumpRange"
              @toggle-coverage-input="handleToggleCoverageInput" @toggle-connected-input="handleToggleConnectedInput"
              @add-candidate-coverage="handleAddCandidateCoverage" @delete-group="handleDeleteGroup"
              @toggle-retain-coverage="handleToggleRetainCoverage" @toggle-retain-connection="handleToggleRetainConnection"
              @toggle-retain-trade-station="handleToggleTradeStationRetain"
              @color-change="handleColorChange" @focus-sector="emit('focus-sector', $event)"
              @reorder="handleReorderGroups"/>
          </div>
          <div v-show="activeTab === 'allocation'">
            <SectorAllocationList :assignments="autoGroupResult?.assignments ?? []" :bridge-plans="autoGroupResult?.bridgePlans ?? []"
              :groups="autoGroupResult?.groups ?? []" :maps="gameDataMaps" :station-counts="stationCounts" view="map"
              @select-option="handleSelectOption" @select-bridge-plan="handleSelectBridgePlan" @select-bridge-center="handleSelectBridgeCenter" @focus-sector="emit('focus-sector', $event)"
            />
          </div>
          <div v-show="activeTab === 'tradeStation'">
            <SectorTradeStationList :groups="autoGroupResult?.groups ?? []" :candidates="tradeStationCandidates" :selected="selectedTradeStations" view="map"
              @select="handleSelectTradeStation" @focus-sector="emit('focus-sector', $event)"
            />
          </div>
      </template>
    </template>
    <div v-if="showConfirmPopup" class="confirm-popup-backdrop" @click.self="showConfirmPopup = false">
      <div class="confirm-popup">
        <div class="confirm-popup-text">{{ t('sector.confirm_unresolved_hint') }}</div>
        <div class="confirm-popup-actions">
          <button class="bar-btn reset-btn" @click="showConfirmPopup = false">{{ t('sector.cancel') }}</button>
          <button class="bar-btn confirm-btn" @click="handleConfirm()">{{ t('sector.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auto-sector-group-map-panel { --confirm-bar-gap: 4px; }
.map-panel-empty { @apply text-sm text-slate-500 text-center py-6; }
.tab-bar { @apply flex border-b border-slate-700/50 mb-3; }
.tab-btn { @apply px-3 py-1.5 text-xs font-medium text-slate-400 border-b-2 border-transparent transition-colors; }
.tab-btn:hover:not(:disabled) { @apply text-slate-200; }
.tab-btn.active { @apply text-sky-400 border-sky-400; }
.tab-btn:disabled { @apply text-slate-600 cursor-not-allowed; }
.columns-layout { @apply grid grid-cols-12 gap-4 px-4 pb-4 pt-2; }
.column-hub, .column-allocation, .column-tradestation { @apply overflow-hidden; }
.column-hub { @apply col-span-5; }
.column-allocation { @apply col-span-4; }
.column-tradestation { @apply col-span-3; }
.edit-overlay-wrapper { @apply relative; }
.edit-overlay {
  @apply absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg;
}
.edit-overlay::after {
  content: '';
  @apply text-slate-300 text-sm font-medium;
}
.confirm-popup-backdrop {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm;
}
.confirm-popup {
  @apply bg-slate-800 border border-slate-600/60 rounded-lg p-6 shadow-2xl max-w-sm;
}
.confirm-popup-text {
  @apply text-sm text-slate-300 mb-4;
}
.confirm-popup-actions {
  @apply flex justify-end gap-2;
}
</style>
