<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import SectorConfirmBar from '@/components/empire/sector-overview/SectorConfirmBar.vue'
import SectorGroupList from '@/components/empire/sector-overview/SectorGroupList.vue'
import SectorAllocationList from '@/components/empire/sector-overview/SectorAllocationList.vue'
import AllocationConfirmBar from '@/components/empire/sector-overview/AllocationConfirmBar.vue'
import MapBindSectorMenu from './MapBindSectorMenu.vue'

const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'fit-sectors', sectorMacros: string[]): void
}>()

const { t } = useI18n()

const presenter = useAutoSectorGroupPresenter()
const {
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
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleReorderGroups,
  handleConfirm,
  hasUncertainAssignments,
  hasPendingBridgeDecision,
  hasAutoResult,
  stationCounts,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate
} = presenter

const activeTab = ref<'hub' | 'allocation'>('hub')
const addHubBtnRef = ref<HTMLElement | null>(null)

const isEditMode = () => calculationMode.value === 'edit'
const canSwitchToAllocation = () => !isEditMode()
</script>

<template>
  <div class="auto-sector-group-map-panel">
    <!-- Not yet auto-grouped: empty placeholder -->
    <div v-if="!hasAutoResult" class="map-panel-empty">
      {{ t('sector.no_groups') }}
    </div>

    <template v-else>
      <!-- Confirmed state: no tabs, no allocation, show groups with station binding button -->
      <template v-if="autoGroupConfirmed">
        <SectorConfirmBar
          :pref-jump-range="prefJumpRange"
          :bridge-search-jump-range="bridgeSearchJumpRange"
          :pref-threshold="prefThreshold"
          mode="result"
          view="map"
          :node-enabled="nodeEnabled"
          :can-disable-node="canDisableNode"
          :bridge-retain-enabled="bridgeRetainEnabled"
          :coverage-retain-enabled="coverageRetainEnabled"
          :bridge-retain-indeterminate="bridgeRetainIndeterminate"
          :coverage-retain-indeterminate="coverageRetainIndeterminate"
        />
        <SectorGroupList
          key="map-completed-static-groups"
          :groups="autoGroupResult?.groups ?? []"
          :assignments="autoGroupResult?.assignments ?? []"
          :maps="gameDataMaps"
          :sector-graph="sectorGraphInfo.sectorGraph"
          :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
          :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
          :editable="false"
          :diff-enabled="false"
          :show-select-group-button="true"
          :draggable="false"
          view="map"
          @focus-sector="emit('focus-sector', $event)"
          @select-group="emit('select-group', $event)"
        />
      </template>

      <!-- Unconfirmed state: tabs -->
      <template v-else>
        <div class="tab-bar">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'hub' }"
            @click="activeTab = 'hub'"
          >
            {{ t('auto_sector.hub_tab') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'allocation' }"
            :disabled="!canSwitchToAllocation()"
            :title="canSwitchToAllocation() ? '' : t('auto_sector.edit_overlay_hint')"
            @click="activeTab = 'allocation'"
          >
            {{ t('auto_sector.allocation_tab') }}
          </button>
        </div>

        <!-- Hub Tab -->
        <div v-show="activeTab === 'hub'">
          <SectorConfirmBar
            :pref-jump-range="prefJumpRange"
            :bridge-search-jump-range="bridgeSearchJumpRange"
            :pref-threshold="prefThreshold"
            :mode="calculationMode"
            view="map"
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
            :key="canDragGroups ? 'map-draft-draggable-groups' : 'map-static-groups'"
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
            view="map"
            :draggable="canDragGroups"
            @cycle-recalc-state="handleCycleRecalcState"
            @update-jump-range="handleUpdateJumpRange"
            @toggle-coverage-input="handleToggleCoverageInput"
            @toggle-connected-input="handleToggleConnectedInput"
            @add-candidate-coverage="handleAddCandidateCoverage"
            @delete-group="handleDeleteGroup"
            @toggle-retain-coverage="handleToggleRetainCoverage"
            @toggle-retain-connection="handleToggleRetainConnection"
            @focus-sector="emit('focus-sector', $event)"
            @reorder-groups="handleReorderGroups"
          />
        </div>

        <!-- Allocation Tab -->
        <div v-show="activeTab === 'allocation'">
          <AllocationConfirmBar
            v-if="!hasPendingBridgeDecision"
            :has-uncertain="hasUncertainAssignments"
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
            view="map"
            @select-option="handleSelectOption"
            @select-bridge-plan="handleSelectBridgePlan"
            @select-bridge-center="handleSelectBridgeCenter"
            @focus-sector="emit('focus-sector', $event)"
          />
        </div>
      </template>
    </template>

    <!-- Hub Add Menu (Map context: MapBindSectorMenu) -->
    <div v-if="showHubAddMenu" ref="addHubBtnRef" class="hub-add-menu-wrapper">
      <MapBindSectorMenu
        :open="showHubAddMenu"
        :target-sector-id="null"
        :trigger-el="addHubBtnRef"
        :filtered-save-sectors="[]"
        :draft-anchor-sector-macro="null"
        :current-bound-sector-macro="null"
        :occupied-sector-macros="getExistingAnchorSectors()"
        @close="showHubAddMenu = false"
        @select-sector="(sectorMacro: string) => { handleAddHubDraft(sectorMacro); showHubAddMenu = false }"
        @focus-sector="emit('focus-sector', $event)"
      />
    </div>
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

.hub-add-menu-wrapper {
  @apply relative;
}
</style>
