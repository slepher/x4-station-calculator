<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorConfirmBar from './SectorConfirmBar.vue'
import SectorGroupList from './SectorGroupList.vue'
import AutoSectorGroupPanel from '@/components/map/AutoSectorGroupPanel.vue'

const saveBindingStore = useSaveBindingStore()

const presenter = useAutoSectorGroupPresenter()
const {
  t,
  prefJumpRange,
  bridgeSearchJumpRange,
  prefThreshold,
  nodeEnabled,
  bridgeRetainEnabled,
  coverageRetainEnabled,
  autoGroupResult,
  autoGroupConfirmed,
  gameDataMaps,
  sectorGraphInfo,
  runAutoGroup,
  triggerAutoGroup,
  handleUploadComplete,
  needsAutoGroupRecalc,
  handleColorChange,
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleMasterTradeStationRetain,
  handleUpdatePrefJumpRange,
  handleUpdateBridgeSearchJumpRange,
  tradeStationRetainEnabled,
  tradeStationRetainIndeterminate,
  tradeStationCaps,
  empireDerivedProductionFlows,
  overviewBuyMultiplier,
  overviewSellMultiplier,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate,
} = presenter

const liveMode = ref<'display' | 'calculate'>('display')

const canEdit = computed(() => autoGroupResult.value !== null)

const displayGroups = computed(() => {
  if (autoGroupResult.value) return autoGroupResult.value.groups
  const binding = saveBindingStore.activeBinding
  return binding?.groups ?? []
})

function onEdit() {
  liveMode.value = 'calculate'
}

function onCalculate() {
  runAutoGroup()
  liveMode.value = 'calculate'
}

watch(autoGroupConfirmed, (confirmed) => {
  if (confirmed) liveMode.value = 'display'
})

defineExpose({ triggerAutoGroup })
</script>

<template>
  <template v-if="liveMode === 'display'">
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

      <div class="col-span-12 lg:col-span-4">
        <SectorConfirmBar
          :pref-jump-range="prefJumpRange"
          :bridge-search-jump-range="bridgeSearchJumpRange"
          :pref-threshold="prefThreshold"
          mode="result"
          view="live"
          :node-enabled="nodeEnabled"
          :can-disable-node="canDisableNode"
          :bridge-retain-enabled="bridgeRetainEnabled"
          :coverage-retain-enabled="coverageRetainEnabled"
          :bridge-retain-indeterminate="bridgeRetainIndeterminate"
          :coverage-retain-indeterminate="coverageRetainIndeterminate"
          :trade-station-retain-enabled="tradeStationRetainEnabled"
          :trade-station-retain-indeterminate="tradeStationRetainIndeterminate"
          :needs-recalc="needsAutoGroupRecalc"
          :edit-disabled="!canEdit"
          @update:pref-jump-range="handleUpdatePrefJumpRange"
          @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
          @update:pref-threshold="prefThreshold = $event"
          @update:node-enabled="nodeEnabled = $event"
          @update:bridge-retain-enabled="handleMasterBridgeRetain"
          @update:coverage-retain-enabled="handleMasterCoverageRetain"
          @update:trade-station-retain-enabled="handleMasterTradeStationRetain"
          @edit="onEdit"
          @quick-calculate="onCalculate"
        />
        <SectorGroupList
          :groups="(displayGroups as any[])"
          :assignments="autoGroupResult?.assignments ?? []"
          :maps="gameDataMaps"
          :sector-graph="sectorGraphInfo.sectorGraph"
          :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
          :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
          :editable="false"
          :draggable="false"
          :diff-enabled="false"
          :trade-station-caps="tradeStationCaps"
          @color-change="handleColorChange"
        />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <EmpireWareFlowsDashboard
          :production-flows="empireDerivedProductionFlows"
          :buy-multiplier="overviewBuyMultiplier"
          :sell-multiplier="overviewSellMultiplier"
          @update:buy-multiplier="overviewBuyMultiplier = $event"
          @update:sell-multiplier="overviewSellMultiplier = $event"
        />
      </div>
    </div>
  </template>

  <template v-else>
    <AutoSectorGroupPanel layout="columns" />
  </template>
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
</style>
