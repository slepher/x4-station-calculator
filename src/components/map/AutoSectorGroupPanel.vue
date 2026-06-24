<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, provide, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { buildAggregatedModulesFromStationPlan, classifyPlayerStationPoi } from '@/store/logic/stationPoiSemantics'
import AutoSectorBar from '@/components/empire/sector-overview/AutoSectorBar.vue'
import SectorGroupStatBar from '@/components/empire/sector-overview/SectorGroupStatBar.vue'
import SectorGroupList from '@/components/empire/sector-overview/SectorGroupList.vue'
import SectorAllocationList from '@/components/empire/sector-overview/SectorAllocationList.vue'
import HubAddMenu from './HubAddMenu.vue'
import SectorTradeStationList from '@/components/empire/sector-overview/SectorTradeStationList.vue'
import type { StationPlan, SavedModule } from '@/types/x4'
import { getPoiIconTag } from '@/store/logic/stationPoiSemantics'
import { SAVE_POI_ICON_MAP } from '@/components/map/utils/style'
import factoryIconUrl from '@/components/icons/factory.svg'

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
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard'; coverageSectorMacros: { ref: string; jump: number }[]; blueprintStation?: StationPlan; virtualStationDraftId?: string; blankVirtualStation?: boolean }): void
  (e: 'drag-station-end'): void
  (e: 'back'): void
  (e: 'map'): void
  (e: 'confirmed'): void
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
  blueprintEmpires, selectedBlueprintEmpireId, blueprintStationSources,
  virtualStationGroups, activeVirtualStationDragKey,
  formatCoordKm, startVirtualStationDrag, updateVirtualStationDrag, finishVirtualStationDrag,
  handleDeleteVirtualStationDraft,
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
  handleColorChange, sectorGroupColorMap, handleReorderGroups,
} = presenter

provide('sectorGroupColorMap', sectorGroupColorMap)

const isConfirmed = computed(() => hasAutoResult.value && !hasChanges.value)

const liveStore = useLiveProductionStore()
const gameDataStore = useGameDataStore()

watch(() => props.gameGuid, async (guid) => {
  if (guid) {
    activeViewStore.activeBinding = guid
    await liveStore.activateBinding(guid)
  }
}, { immediate: true })

const activeTab = ref<'hub' | 'allocation' | 'tradeStation' | 'virtualStation'>('hub')
const blueprintEmpireMenuOpen = ref(false)
const blueprintEmpireMenuRef = ref<HTMLElement | null>(null)
const blueprintEmpireMenuTriggerEl = ref<HTMLElement | null>(null)
const blueprintEmpireMenuStyle = ref<Record<string, string>>({})

function onCalculate() { runCalculationFromEditInput(); switchToFirstUnresolvedTab() }
function onQuickCalc() { handleQuickCalculate(); switchToFirstUnresolvedTab() }
function onConfirm() {
  if (handleConfirm()) emit('confirmed')
}

function switchToFirstUnresolvedTab() {
  if (hasUncertainAssignments.value || hasPendingBridgeDecision.value) activeTab.value = 'allocation'
  else if (hasUnresolvedTradeStations.value) activeTab.value = 'tradeStation'
  else activeTab.value = 'hub'
}

function onVirtualStationMouseDown(event: MouseEvent, input: Parameters<typeof startVirtualStationDrag>[1]) {
  startVirtualStationDrag(event, input)
}

function onVirtualStationMouseMove(event: MouseEvent) {
  const payload = updateVirtualStationDrag(event)
  if (payload) emit('drag-station-start', payload)
}

function onVirtualStationMouseUp() {
  if (finishVirtualStationDrag()) emit('drag-station-end')
}

const selectedBlueprintEmpireName = computed(() => {
  const empire = blueprintEmpires.value.find((item) => item.id === selectedBlueprintEmpireId.value)
  return empire?.name || t('map.binding_select_blueprint_empire')
})

function getStationIcon(station: { modules: SavedModule[] } | null | undefined): { url: string; tag: 'factory' | 'shipyard' } {
  if (!station) return { url: factoryIconUrl, tag: 'factory' }
  const aggregatedModules = buildAggregatedModulesFromStationPlan(station, gameDataStore.modulesMap)
  const classification = classifyPlayerStationPoi({ modules: aggregatedModules })
  const iconTag = getPoiIconTag({ tag: classification.tag, factoryGroup: classification.factoryGroup })
  const url = iconTag ? SAVE_POI_ICON_MAP[iconTag] || factoryIconUrl : factoryIconUrl
  const isShipyard = iconTag ? ['shipyard', 'wharf', 'equipmentdock'].includes(iconTag) : false
  return { url, tag: isShipyard ? 'shipyard' : 'factory' }
}

function updateBlueprintEmpireMenuPosition() {
  const panel = document.querySelector('.map-save-panel, .map-binding-panel')
  const trigger = blueprintEmpireMenuTriggerEl.value
  if (!panel || !trigger) {
    blueprintEmpireMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  const menuHeight = blueprintEmpireMenuRef.value?.offsetHeight || 260
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const rawTop = Math.min(triggerRect.top, Math.max(8, viewportHeight - menuHeight - 8))
  const top = Math.max(8, rawTop)

  blueprintEmpireMenuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function toggleBlueprintEmpireMenu(event: MouseEvent) {
  blueprintEmpireMenuTriggerEl.value = event.currentTarget as HTMLElement
  blueprintEmpireMenuOpen.value = !blueprintEmpireMenuOpen.value
  if (blueprintEmpireMenuOpen.value) {
    nextTick(() => updateBlueprintEmpireMenuPosition())
  }
}

function closeBlueprintEmpireMenu() {
  blueprintEmpireMenuOpen.value = false
  blueprintEmpireMenuTriggerEl.value = null
}

function selectBlueprintEmpire(empireId: string) {
  selectedBlueprintEmpireId.value = empireId
  closeBlueprintEmpireMenu()
}

function onGlobalPointerDown(event: MouseEvent) {
  if (!blueprintEmpireMenuOpen.value) return
  if (!(event.target instanceof Node)) return
  const menuRoot = blueprintEmpireMenuRef.value
  const trigger = blueprintEmpireMenuTriggerEl.value
  if (menuRoot?.contains(event.target) || trigger?.contains(event.target)) return
  closeBlueprintEmpireMenu()
}

function onBlueprintEmpireViewportChange() {
  if (blueprintEmpireMenuOpen.value) updateBlueprintEmpireMenuPosition()
}

watch(() => props.gameGuid, () => { onVirtualStationMouseUp() })

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('resize', onBlueprintEmpireViewportChange)
  window.addEventListener('scroll', onBlueprintEmpireViewportChange, true)
  window.addEventListener('mousemove', onVirtualStationMouseMove)
  window.addEventListener('mouseup', onVirtualStationMouseUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('resize', onBlueprintEmpireViewportChange)
  window.removeEventListener('scroll', onBlueprintEmpireViewportChange, true)
  window.removeEventListener('mousemove', onVirtualStationMouseMove)
  window.removeEventListener('mouseup', onVirtualStationMouseUp)
})

let initialAutoSwitchDone = false
watch(autoGroupResult, (result, previousResult) => {
  if (initialAutoSwitchDone) return
  if (!result || result.groups.length === 0) return
  if (previousResult && previousResult.groups.length > 0) {
    initialAutoSwitchDone = true
    return
  }
  initialAutoSwitchDone = true
  switchToFirstUnresolvedTab()
})
watch(() => props.gameGuid, () => { initialAutoSwitchDone = false })
</script>

<template>
  <div class="auto-sector-group-map-panel" :class="`auto-sector-group-map-panel--${layout}`">
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
          :show-back="false"
          @update:pref-jump-range="handleUpdatePrefJumpRange"
          @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
          @update:pref-threshold="prefThreshold = $event"
          @update:node-enabled="nodeEnabled = $event"
          @calculate="onCalculate"
          @quick-calculate="onQuickCalc"
          @reset="handleResetAssignments"
          @confirm="onConfirm"
          @back="emit('back')"
          @map="emit('map')"
        />
        </div>
        <div class="columns-scroll-area">
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
        </div>
      </template>
      <template v-else>
        <div class="map-tab-header">
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
            @confirm="onConfirm"
            @back="emit('back')"
            @map="emit('map')"
          />
        </div>
        <div class="tab-bar">
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'hub' }" @click="activeTab = 'hub'">{{ t('auto_sector.hub_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'allocation' }"
              @click="activeTab = 'allocation'">{{ t('auto_sector.allocation_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'tradeStation' }"
              @click="activeTab = 'tradeStation'">{{ t('auto_sector.trade_station_tab') }}</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'virtualStation' }"
              @click="activeTab = 'virtualStation'">{{ t('auto_sector.virtual_station_tab') }}</button>
          </div>
          <div class="tab-content scrollbar-thin">
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
              :show-select-group-button="isConfirmed"
              @cycle-recalc-state="handleCycleRecalcState" @update-jump-range="handleUpdateJumpRange"
              @toggle-coverage-input="handleToggleCoverageInput" @toggle-connected-input="handleToggleConnectedInput"
              @add-candidate-coverage="handleAddCandidateCoverage" @delete-group="handleDeleteGroup"
              @toggle-retain-coverage="handleToggleRetainCoverage" @toggle-retain-connection="handleToggleRetainConnection"
              @toggle-retain-trade-station="handleToggleTradeStationRetain"
              @color-change="handleColorChange" @focus-sector="emit('focus-sector', $event)"
              @select-group="emit('select-group', $event)"
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
          <div v-show="activeTab === 'virtualStation'" class="virtual-station-tab">
            <div class="virtual-section">
              <div class="section-title-row">
                <div class="section-header">{{ t('map.binding_station_blueprints') }}</div>
                <button
                  type="button"
                  class="station-action blueprint-empire-button"
                  ref="blueprintEmpireMenuTriggerEl"
                  @click="toggleBlueprintEmpireMenu"
                >
                  {{ selectedBlueprintEmpireName }}
                  <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              <div class="free-stations">
                <div
                  class="free-station-item free-station-item--virtual"
                  :class="{ 'free-station-item--dragging': activeVirtualStationDragKey === '__blank_virtual_station__' }"
                  @mousedown="onVirtualStationMouseDown($event, {
                    key: '__blank_virtual_station__',
                    name: t('auto_sector.blank_virtual_station'),
                    icon: 'factory',
                    blankVirtualStation: true
                  })"
                >
                  <img class="entry-icon" :src="SAVE_POI_ICON_MAP.constructionsite || factoryIconUrl" alt="" />
                  <div class="station-info">
                    <div class="station-name">{{ t('auto_sector.blank_virtual_station') }}</div>
                    <div class="station-type">{{ t('auto_sector.empty_modules') }}</div>
                  </div>
                  <div class="station-handle">
                    <span></span><span></span><span></span>
                  </div>
                </div>
                <div v-if="blueprintStationSources.length === 0" class="empty-hint">
                  {{ t('map.binding_no_blueprint_stations') }}
                </div>
                <div
                  v-for="station in blueprintStationSources"
                  :key="station.id"
                  class="free-station-item"
                  :class="{ 'free-station-item--dragging': activeVirtualStationDragKey === station.id }"
                  @mousedown="onVirtualStationMouseDown($event, {
                    key: station.id,
                    name: station.name,
                    icon: getStationIcon(station).tag,
                    blueprintStation: station
                  })"
                >
                  <img class="entry-icon" :src="getStationIcon(station).url" alt="" />
                  <div class="station-info">
                    <div class="station-name">{{ station.name }}</div>
                    <div class="station-type">{{ station.modules.length }} {{ t('auto_sector.modules') }}</div>
                  </div>
                  <div class="station-handle">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="virtual-section">
              <div class="virtual-section-title">{{ t('auto_sector.virtual_station_tab') }}</div>
              <div v-for="groupEntry in virtualStationGroups.groups" :key="groupEntry.group.id" class="virtual-group">
                <button type="button" class="virtual-group-title" @click="groupEntry.group.sectorMacro && emit('focus-sector', groupEntry.group.sectorMacro)">
                  {{ groupEntry.group.name }}
                </button>
                <div v-if="groupEntry.stations.length === 0" class="virtual-empty">{{ t('auto_sector.no_virtual_stations') }}</div>
                <div
                  v-for="station in groupEntry.stations"
                  :key="station.id"
                  class="virtual-row"
                  :class="{ 'virtual-row--dragging': activeVirtualStationDragKey === station.id }"
                  @mousedown="onVirtualStationMouseDown($event, {
                    key: station.id,
                    name: station.name,
                    icon: getStationIcon(station).tag,
                    virtualStationDraftId: station.id,
                    groupId: station.groupId
                  })"
                >
                  <div class="virtual-row-main">
                    <span class="virtual-name">{{ station.name }}</span>
                    <span class="virtual-sub">
                      {{ station.sectorMacro ? presenter.getSectorDisplayName(station.sectorMacro) : t('auto_sector.ungrouped_virtual_stations') }}
                      <template v-if="station.position">
                        · x: {{ formatCoordKm(station.position.x) }} / z: {{ formatCoordKm(station.position.z) }}
                      </template>
                    </span>
                  </div>
                  <button class="virtual-delete" type="button" @click.stop="handleDeleteVirtualStationDraft(station.id)">×</button>
                </div>
              </div>
              <div v-if="virtualStationGroups.ungrouped.length > 0" class="virtual-group virtual-group--ungrouped">
                <div class="virtual-group-title">{{ t('auto_sector.ungrouped_virtual_stations') }}</div>
                <div
                  v-for="station in virtualStationGroups.ungrouped"
                  :key="station.id"
                  class="virtual-row"
                  :class="{ 'virtual-row--dragging': activeVirtualStationDragKey === station.id }"
                  @mousedown="onVirtualStationMouseDown($event, {
                    key: station.id,
                    name: station.name,
                    icon: getStationIcon(station).tag,
                    virtualStationDraftId: station.id,
                    groupId: station.groupId
                  })"
                >
                  <div class="virtual-row-main">
                    <span class="virtual-name">{{ station.name }}</span>
                    <span class="virtual-sub">
                      {{ station.sectorMacro ? presenter.getSectorDisplayName(station.sectorMacro) : t('auto_sector.ungrouped_virtual_stations') }}
                      <template v-if="station.position">
                        · x: {{ formatCoordKm(station.position.x) }} / z: {{ formatCoordKm(station.position.z) }}
                      </template>
                    </span>
                  </div>
                  <button class="virtual-delete" type="button" @click.stop="handleDeleteVirtualStationDraft(station.id)">×</button>
                </div>
                <div class="virtual-warning">{{ t('auto_sector.ungrouped_virtual_station_hint') }}</div>
              </div>
            </div>
          </div>
          </div>
          <Teleport to="body">
            <div
              v-if="blueprintEmpireMenuOpen"
              class="bind-menu"
              ref="blueprintEmpireMenuRef"
              :style="blueprintEmpireMenuStyle"
            >
              <div class="bind-menu-group">
                <div class="bind-menu-group-title">{{ t('map.binding_blueprint_empire') }}</div>
                <button
                  v-for="empire in blueprintEmpires"
                  :key="empire.id"
                  type="button"
                  class="bind-menu-item"
                  :class="{ active: empire.id === selectedBlueprintEmpireId }"
                  @click="selectBlueprintEmpire(empire.id)"
                >
                  <span class="bind-menu-item-name">{{ empire.name }}</span>
                  <span class="bind-menu-item-side">{{ empire.stations?.length || 0 }}</span>
                </button>
                <div v-if="blueprintEmpires.length === 0" class="bind-menu-empty">
                  {{ t('map.binding_no_blueprint_empires') }}
                </div>
              </div>
            </div>
          </Teleport>
    </template>
  </template>
    <div v-if="showConfirmPopup" class="confirm-popup-backdrop" @click.self="showConfirmPopup = false">
      <div class="confirm-popup">
        <div class="confirm-popup-text">{{ t('sector.confirm_unresolved_hint') }}</div>
        <div class="confirm-popup-actions">
          <button class="bar-btn reset-btn" @click="showConfirmPopup = false">{{ t('sector.cancel') }}</button>
          <button class="bar-btn confirm-btn" @click="onConfirm">{{ t('sector.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auto-sector-group-map-panel { --confirm-bar-gap: 4px; }
.auto-sector-group-map-panel--tabs { @apply flex h-full min-h-0 flex-col overflow-hidden; }
.map-panel-empty { @apply text-sm text-slate-500 text-center py-6; }
.map-tab-header { @apply shrink-0 px-3; }
.tab-bar { @apply mx-3 flex shrink-0 border-b border-slate-700/50 mb-3; }
.tab-btn { @apply px-3 py-1.5 text-xs font-medium text-slate-400 border-b-2 border-transparent transition-colors; }
.tab-btn:hover:not(:disabled) { @apply text-slate-200; }
.tab-btn.active { @apply text-sky-400 border-sky-400; }
.tab-btn:disabled { @apply text-slate-600 cursor-not-allowed; }
.tab-content {
  @apply min-h-0 flex-1 overflow-y-auto px-3;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.55) transparent;
}
.tab-content::-webkit-scrollbar { width: 6px; }
.tab-content::-webkit-scrollbar-track { @apply rounded-full bg-slate-900/35; }
.tab-content::-webkit-scrollbar-thumb { @apply rounded-full bg-slate-500/60; }
.tab-content::-webkit-scrollbar-thumb:hover { @apply bg-slate-400/70; }
.virtual-station-tab { @apply space-y-4; }
.virtual-section { @apply space-y-2; }
.section-title-row { @apply flex items-center justify-between gap-2; }
.section-header { @apply text-xs font-semibold uppercase tracking-wider text-slate-400; }
.blueprint-empire-button { @apply max-w-[12rem] overflow-hidden text-ellipsis; }
.empty-hint { @apply text-center text-sm text-slate-500; }
.free-stations { @apply flex flex-col gap-1; }
.free-station-item {
  @apply flex items-center gap-2 rounded border border-slate-700/60 bg-slate-800/60 p-2 cursor-grab transition-colors hover:border-slate-500/70;
  user-select: none;
}
.free-station-item--dragging { @apply opacity-50 cursor-grabbing; }
.free-station-item--virtual { @apply border-sky-500/30 bg-sky-950/20; }
.entry-icon { @apply h-8 w-8 shrink-0; }
.station-info { @apply flex-1 min-w-0; }
.station-name { @apply truncate text-sm text-slate-100; }
.station-type { @apply mt-0.5 truncate text-xs text-slate-400; }
.station-handle { @apply flex flex-col gap-0.5 opacity-40; }
.station-handle span { @apply block h-0.5 w-4 rounded-full bg-slate-400; }
.station-action {
  @apply inline-flex items-center whitespace-nowrap rounded border border-slate-600/70 bg-slate-800 px-2 py-1 text-xs text-slate-200;
}
.action-chevron { @apply ml-1 h-3 w-3; }
.bind-menu {
  @apply fixed z-[100] min-w-[40px] overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/95 py-2 shadow-2xl;
  backdrop-filter: blur(12px);
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.55) transparent;
}
.bind-menu::-webkit-scrollbar { width: 6px; }
.bind-menu::-webkit-scrollbar-track { @apply rounded-full bg-slate-900/35; }
.bind-menu::-webkit-scrollbar-thumb { @apply rounded-full bg-slate-500/60; }
.bind-menu::-webkit-scrollbar-thumb:hover { @apply bg-slate-400/70; }
.bind-menu-group { @apply px-1; }
.bind-menu-group-title { @apply px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400; }
.bind-menu-item {
  @apply flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-700/60;
}
.bind-menu-item.active { @apply bg-sky-900/35 text-sky-100; }
.bind-menu-item-name { @apply flex-1; }
.bind-menu-empty { @apply px-3 py-2 text-xs text-slate-500; }
.bind-menu-item-side { @apply ml-2 flex items-center gap-2; }
.virtual-section-row { @apply flex items-center justify-between gap-2; }
.virtual-section-title { @apply text-xs font-semibold uppercase tracking-wide text-slate-400; }
.virtual-select { @apply max-w-[12rem] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200; }
.virtual-source-list, .virtual-group { @apply space-y-1; }
.virtual-group { @apply pt-2 border-t border-slate-700/50; }
.virtual-group--ungrouped { @apply border-amber-500/30; }
.virtual-group-title { @apply text-xs text-slate-300 font-medium text-left; }
button.virtual-group-title { @apply hover:text-sky-300; }
.virtual-row { @apply flex items-center gap-2 rounded bg-slate-800/60 border border-slate-700/60 px-2 py-2 text-left; }
.virtual-row--source { @apply cursor-grab; }
.virtual-row--dragging { @apply opacity-50; }
.virtual-row-main { @apply min-w-0 flex-1; }
.virtual-name { @apply block text-xs text-slate-100 truncate; }
.virtual-sub { @apply block text-[11px] text-slate-400 truncate; }
.virtual-handle { @apply text-slate-500 text-xs select-none; }
.virtual-delete { @apply text-slate-500 hover:text-red-300 text-sm px-1; }
.virtual-empty { @apply text-xs text-slate-500 py-1; }
.virtual-warning { @apply text-[11px] text-amber-300/90 leading-snug pt-1; }
.columns-scroll-area {
  @apply min-h-0 flex-1 overflow-y-auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.55) transparent;
}
.columns-scroll-area::-webkit-scrollbar { width: 6px; }
.columns-scroll-area::-webkit-scrollbar-track { @apply rounded-full bg-slate-900/35; }
.columns-scroll-area::-webkit-scrollbar-thumb { @apply rounded-full bg-slate-500/60; }
.columns-scroll-area::-webkit-scrollbar-thumb:hover { @apply bg-slate-400/70; }
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
