<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorGroupList from './SectorGroupList.vue'
import AutoSectorGroupPanel from '@/components/map/AutoSectorGroupPanel.vue'

const saveBindingStore = useSaveBindingStore()
const activeViewStore = useActiveViewStore()

const presenter = useAutoSectorGroupPresenter()
const {
  t,
  autoGroupResult,
  gameDataMaps,
  sectorReachability,
  sectorGraphInfo,
  triggerAutoGroup,
  handleUploadComplete,
  handleColorChange,
  tradeStationCaps,
  empireDerivedProductionFlows,
  overviewBuyMultiplier,
  overviewSellMultiplier,
} = presenter

const liveMode = ref<'display' | 'calculate'>('display')

const displayGroups = computed(() => {
  if (autoGroupResult.value) return autoGroupResult.value.groups
  const binding = saveBindingStore.activeBinding
  return (binding?.groups ?? []).map((g) => ({
    id: g.sectorMacro || '',
    name: g.name,
    sectorMacro: g.sectorMacro,
    jumpRange: g.jumpRange,
    originalJumpRange: g.jumpRange,
    coverageSectorMacros: g.coverageSectorMacros.map((c) => c.ref),
    connectedGroupIds: [...(g.connectedGroupIds || [])],
    excludedDefaultAssignmentSectorMacros: [] as string[],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true,
    color: g.color
  }))
})

function onMap() {
  const guid = activeViewStore.activeBinding
  if (guid) {
    activeViewStore.isSavePanelOpen = true
    activeViewStore.mapBindingGameGuid = guid
    activeViewStore.mapSavePanelLayer = 'binding-sector'
    activeViewStore.setActiveView('maps')
  }
}

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
        <SectorGroupList
          :groups="displayGroups"
          :assignments="autoGroupResult?.assignments ?? []"
          :maps="gameDataMaps"
          :sector-graph="sectorGraphInfo.sectorGraph"
          :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
          :sector-reachability="sectorReachability"
          :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
          :editable="false"
          :show-recalc-state-button="false"
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
    <AutoSectorGroupPanel layout="columns" @back="liveMode = 'display'" @map="onMap" @confirmed="liveMode = 'display'" />
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
