<script setup lang="ts">
import { computed, ref } from 'vue'
import { reactive } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useStationStore } from '@/store/useStationStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import { useStationTabBarModel } from '@/components/empire/composables/useStationTabBarModel'
import { useContextToolbarModel } from '@/components/empire/composables/useContextToolbarModel'
import { useStationPlanningPanelModel } from '@/components/empire/composables/useStationPlanningPanelModel'
import { useStationWareFlowsModel } from '@/components/empire/composables/useStationWareFlowsModel'
import { useStationDashboardModel } from '@/components/empire/composables/useStationDashboardModel'
import { useTransitHubWorkbenchModel } from '@/components/empire/composables/useTransitHubWorkbenchModel'
import type { StationType, SavedModule, GroupedFlows, EmpireGroupedFlows } from '@/types/x4'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import StationTabBar from '@/components/empire/StationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import TransitHubBuildPanel from '@/components/empire/transit-hub/TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from '@/components/empire/transit-hub/TransitHubCenterDashboard.vue'
import TransitHubMaterialsPanel from '@/components/empire/transit-hub/TransitHubMaterialsPanel.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'

type SharedWareFlowViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

const { t } = useI18n()
const { translateWare } = useX4I18n()
const empireStore = useEmpireStore()
const stationStore = useStationStore()
const saveBindingStore = useSaveBindingStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()

const activeTransitSectorId = computed(() => empireStore.activeTransitSectorId)
const isOverview = computed(() => empireStore.activeStation === null && !activeTransitSectorId.value)
const wareFlowViewMode = ref<SharedWareFlowViewMode>('quantity')
const isBindingMode = computed(() => activeViewStore.productionSource === 'save-binding')
const activeStation = computed(() => empireStore.activeStation)

const importModalState = reactive<{
  isOpen: boolean
  initialTab: 'logic-flow' | 'game-blueprint' | 'x4-station'
}>({
  isOpen: false,
  initialTab: 'game-blueprint'
})

const handleOpenImport = () => {
  importModalState.initialTab = 'logic-flow'
  importModalState.isOpen = true
}

const handleCloseImport = () => {
  importModalState.isOpen = false
}

const importModalCreateStation = (name: string, type?: StationType) => {
  return empireStore.createStation(name, type)
}

const importModalApplyPayload = (stationId: string, payload: any) => {
  empireStore.applyImportedStationPayload(stationId, payload)
}

const importModalUpdateModules = (stationId: string, modules: any[]) => {
  empireStore.updateStationModules(stationId, modules)
}

const importModalGetStationById = (stationId: string) => {
  return empireStore.getStationById(stationId)
}

const tabBarModel = useStationTabBarModel({
  sectors: computed(() => empireStore.sectors),
  orderedStationsBySector: computed(() => empireStore.orderedStationsBySector),
  activeStationId: computed({
    get: () => empireStore.activeStationId,
    set: (val) => empireStore.selectStation(val)
  }),
  isBindingMode,
  getLinkedSectors: (sectorId: string) => empireStore.getLinkedSectors(sectorId)
})

const activeBindingNameRef = computed({
  get: () => saveBindingStore.activeBindingName,
  set: (val: string) => { saveBindingStore.activeBindingName = val }
})

const activeEmpireNameRef = computed({
  get: () => empireStore.activeEmpire?.name || '',
  set: (val: string) => { empireStore.updateEmpireName(val) }
})

const singleBerthThroughput = computed(() => {
  const shipCapacity = Math.max(1, stationStore.settings.transportShipCapacity || 1)
  return shipCapacity * 15
})

const contextToolbarModel = useContextToolbarModel({
  isBindingMode,
  activeStation,
  activeTransitSectorId,
  sectors: computed(() => empireStore.sectors),
  settings: computed(() => stationStore.settings),
  activeBindingName: activeBindingNameRef as any,
  activeEmpireName: activeEmpireNameRef as any,
  singleBerthThroughput
})

const importModalActiveStation = computed(() => {
  if (!activeStation.value) return null
  return {
    id: activeStation.value.id,
    modules: activeStation.value.modules
  }
})

const activeSupplySector = computed(() => {
  if (!activeTransitSectorId.value) return null
  return empireStore.sectors.find((sector) => sector.id === activeTransitSectorId.value) || null
})

const handleUpdateTitle = (value: string) => {
  if (isBindingMode.value && isOverview.value) {
    saveBindingStore.activeBindingName = value
  } else if (activeTransitSectorId.value && activeSupplySector.value) {
    empireStore.renameBindingSector(activeSupplySector.value.id, value)
  } else {
    empireStore.updateEmpireName(value)
  }
}

const handleUpdateStationName = (value: string) => {
  if (activeStation.value) {
    empireStore.renameStation(activeStation.value.id, value)
  }
}

const handleUpdateStationType = (value: string) => {
  if (activeStation.value) {
    empireStore.updateStationType(activeStation.value.id, value as any)
  }
}

const handleUpdateStationCount = (value: number) => {
  if (activeStation.value) {
    empireStore.updateStationCount(activeStation.value.id, value)
  }
}

const handleToggleMineral = (mineral: string) => {
  if (!activeStation.value) return
  const current = activeStation.value.minerals || []
  const newMinerals = current.includes(mineral)
    ? current.filter((m: string) => m !== mineral)
    : [...current, mineral]
  empireStore.updateStationMinerals(activeStation.value.id, newMinerals)
}

const handleUpdateSunlight = (value: number) => {
  stationStore.updateSetting('sunlight', value)
}

const handleUpdateTransportMinutes = (value: number) => {
  stationStore.updateSetting('transportMinutes', value)
}

const handleUpdateRacePreference = (value: string) => {
  stationStore.updateSetting('racePreference', value)
}

const handleUpdateWorkforce = (value: boolean) => {
  stationStore.updateSetting('considerWorkforceForAutoFill', value)
}

const handleUpdateShowEmpireGaps = (value: boolean) => {
  stationStore.updateSetting('showEmpireGaps', value)
}

const handleUpdatePlannedModules = (modules: SavedModule[]) => {
  if (activeStation.value) {
    empireStore.updateStationModules(activeStation.value.id, modules)
  }
}

const stationPlanningPanelModel = useStationPlanningPanelModel({
  plannedModules: computed(() => stationStore.plannedModules as SavedModule[]),
  autoIndustryModules: computed(() => stationStore.autoIndustryModules as SavedModule[]),
  enforceDlcActivation: computed(() => stationStore.enforceDlcActivation),
  onUpdatePlannedModules: handleUpdatePlannedModules
})

const empireGapsForModel = computed(() => {
  const flows = empireStore.getStationComponentGapFlows(activeStation.value?.id || null)

  const byTierThenName = (a: any, b: any) => {
    const tierA = Number(a.tier ?? 0)
    const tierB = Number(b.tier ?? 0)
    if (tierA !== tierB) return tierB - tierA
    const nameA = String(a.name || '')
    const nameB = String(b.name || '')
    const nameCmp = nameA.localeCompare(nameB, 'en')
    if (nameCmp !== 0) return nameCmp
    return String(a.id || '').localeCompare(String(b.id || ''), 'en')
  }
  
  const operations = flows.operations
    .filter((flow: any) => flow.netRate < 0 || stationStore.getResolvedLevel(flow.wareId) > 0)
    .map((flow: any) => {
      const module = gameData.findModuleForWare(flow.wareId, stationStore.settings.racePreference)
      const plannedIndex = module ? stationStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = stationStore.wares[flow.wareId]
      return {
        id: flow.wareId,
        name: wareInfo ? translateWare(wareInfo) : (flow.name || flow.wareId),
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: !module || flow.netRate > 0,
        disableRemove: !module || plannedIndex === -1
      }
    })
    .sort(byTierThenName)
    
  const supply = flows.supply
    .map((flow: any) => {
      const module = gameData.findModuleForWare(flow.wareId, stationStore.settings.racePreference)
      const plannedIndex = module ? stationStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = stationStore.wares[flow.wareId]
      return {
        id: flow.wareId,
        name: wareInfo ? translateWare(wareInfo) : (flow.name || flow.wareId),
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: !module || flow.netRate > 0,
        disableRemove: !module || plannedIndex === -1
      }
    })
    .filter((flow: any) => flow.netRate <= 0 || !flow.disableRemove)
    .sort(byTierThenName)
    
  return { operations, supply }
})

const stationWareFlowsModel = useStationWareFlowsModel({
  viewMode: wareFlowViewMode as any,
  groupedFlows: computed(() => stationStore.groupedFlows as GroupedFlows),
  settings: computed(() => ({
    resourceBufferHours: stationStore.settings.resourceBufferHours,
    primaryProductBufferHours: stationStore.settings.primaryProductBufferHours,
    secondaryProductBufferHours: stationStore.settings.secondaryProductBufferHours,
    buyMultiplier: stationStore.settings.buyMultiplier,
    sellMultiplier: stationStore.settings.sellMultiplier,
    racePreference: stationStore.settings.racePreference,
    showEmpireGaps: stationStore.settings.showEmpireGaps ?? false
  })),
  empireGaps: empireGapsForModel,
  plannedModules: computed(() => stationStore.plannedModules as SavedModule[]),
  wares: computed(() => stationStore.wares)
})

const stationDashboardModel = useStationDashboardModel({
  plannedModules: computed(() => stationStore.plannedModules as SavedModule[]),
  stationAnalysis: computed(() => ({
    totalCost: stationStore.stationAnalysis.totalCost,
    totalVolume: stationStore.stationAnalysis.totalVolume,
    totalNeeded: stationStore.stationAnalysis.totalNeeded,
    totalCapacity: stationStore.stationAnalysis.totalCapacity,
    totalTime: stationStore.stationAnalysis.totalTime,
    playerHQNeeded: stationStore.stationAnalysis.playerHQNeeded,
    totalWorkerDiff: stationStore.stationAnalysis.totalWorkerDiff || 0,
    moduleGroups: stationStore.stationAnalysis.moduleGroups,
    summaryItems: stationStore.stationAnalysis.summaryItems
  })),
  settings: computed(() => ({
    transportShipCapacity: stationStore.settings.transportShipCapacity,
    workforceAuto: stationStore.settings.workforceAuto,
    manualWorkforce: stationStore.settings.manualWorkforce,
    useHQ: stationStore.settings.useHQ
  })),
  currentEfficiency: computed(() => stationStore.currentEfficiency),
  actualWorkforce: computed(() => stationStore.actualWorkforce),
  buildPriceMultiplier: computed({
    get: () => stationStore.buildPriceMultiplier,
    set: (val: number) => { stationStore.buildPriceMultiplier = val }
  }) as any
})

const transitHubModelRaw = computed(() => empireStore.getTransitHubViewModel({
  sectorId: activeTransitSectorId.value,
  racePreference: stationStore.settings.racePreference,
  transportShipCapacity: stationStore.settings.transportShipCapacity
}))

const transitHubWorkbenchModel = useTransitHubWorkbenchModel({
  sectorId: computed(() => activeTransitSectorId.value) as any,
  groupedFlows: computed(() => transitHubModelRaw.value.groupedFlows as EmpireGroupedFlows),
  storageFlows: computed(() => transitHubModelRaw.value.storageFlows),
  storageModulePlans: computed(() => transitHubModelRaw.value.storageModulePlans),
  supplyBuildModules: computed(() => transitHubModelRaw.value.supplyBuildModules as SavedModule[]),
  viewMode: wareFlowViewMode as any
})

const transitHubModel = computed(() => transitHubWorkbenchModel.props.value || transitHubModelRaw.value)

const handleSelectOverview = () => {
  empireStore.selectStation(null)
}

const handleSelectTransit = (sectorId: string) => {
  empireStore.selectTransitSector(sectorId)
}

const handleSelectStation = (stationId: string) => {
  empireStore.selectStation(stationId)
}

const handleCreateStation = () => {
  empireStore.createStation(t('sector.new_station_name'), 'industrial')
}

const handleRenameStation = (stationId: string) => {
  empireStore.selectStation(stationId)
}

const handleDuplicateStation = (stationId: string) => {
  empireStore.duplicateStation(stationId)
}

const handleDeleteStation = (stationId: string) => {
  empireStore.deleteStation(stationId)
}

const handleExpandSector = (sectorId: string | null) => {
  tabBarModel.expandedSectorId.value = sectorId
}

const handleUpdateWareFlowResourceBufferHours = (value: number) => {
  stationStore.updateSetting('resourceBufferHours', value)
}

const handleUpdateWareFlowPrimaryBufferHours = (value: number) => {
  stationStore.updateSetting('primaryProductBufferHours', value)
}

const handleUpdateWareFlowSecondaryBufferHours = (value: number) => {
  stationStore.updateSetting('secondaryProductBufferHours', value)
}

const handleUpdateWareFlowBuyMultiplier = (value: number) => {
  stationStore.updateSetting('buyMultiplier', value)
}

const handleUpdateWareFlowSellMultiplier = (value: number) => {
  stationStore.updateSetting('sellMultiplier', value)
}

const handleWareFlowAddGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, stationStore.settings.racePreference)
  if (!module) return
  stationStore.addModule(module.id, 1)
}

const handleWareFlowRemoveGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, stationStore.settings.racePreference)
  if (!module) return
  const plannedIndex = stationStore.plannedModules.findIndex(m => m.id === module.id)
  if (plannedIndex === -1) return
  const current = stationStore.plannedModules[plannedIndex]?.count ?? 0
  if (current <= 1) {
    stationStore.removeModule(plannedIndex)
  } else {
    stationStore.updateModuleCount(plannedIndex, current - 1)
  }
}

const handleDashboardUpdateTransportShipCapacity = (value: number) => {
  stationStore.updateSetting('transportShipCapacity', value)
}

const handleDashboardUpdateBuildPriceMultiplier = (value: number) => {
  stationStore.buildPriceMultiplier = value
}

const handleDashboardUpdateManualWorkforce = (value: number) => {
  stationStore.updateSetting('manualWorkforce', value)
}

const handleDashboardUpdateWorkforceAuto = (value: boolean) => {
  stationStore.updateSetting('workforceAuto', value)
}

const handleDashboardUpdateUseHQ = (value: boolean) => {
  stationStore.updateSetting('useHQ', value)
}
</script>

<template>
  <StationTabBar
    :tabs="tabBarModel.props.value.tabs"
    :active-tab-id="tabBarModel.props.value.activeTabId"
    :expanded-sector-id="tabBarModel.props.value.expandedSectorId"
    :can-create-station="tabBarModel.props.value.canCreateStation"
    :can-open-context-menu="tabBarModel.props.value.canOpenContextMenu"
    @select-overview="handleSelectOverview"
    @select-transit="handleSelectTransit"
    @select-station="handleSelectStation"
    @create-station="handleCreateStation"
    @rename-station="handleRenameStation"
    @duplicate-station="handleDuplicateStation"
    @delete-station="handleDeleteStation"
    @expand-sector="handleExpandSector"
  />
  <ContextToolbar
    :mode="contextToolbarModel.props.value.mode"
    :is-binding-mode="contextToolbarModel.props.value.isBindingMode"
    :title-model="contextToolbarModel.props.value.titleModel"
    :station="contextToolbarModel.props.value.station"
    :settings="contextToolbarModel.props.value.settings"
    :races="contextToolbarModel.props.value.races"
    :station-types="contextToolbarModel.props.value.stationTypes"
    :available-minerals="contextToolbarModel.props.value.availableMinerals"
    :single-berth-throughput="contextToolbarModel.props.value.singleBerthThroughput"
    @update-title="handleUpdateTitle"
    @update-station-name="handleUpdateStationName"
    @update-station-type="handleUpdateStationType"
    @update-station-count="handleUpdateStationCount"
    @toggle-mineral="handleToggleMineral"
    @update-sunlight="handleUpdateSunlight"
    @update-transport-minutes="handleUpdateTransportMinutes"
    @update-race-preference="handleUpdateRacePreference"
    @update-workforce="handleUpdateWorkforce"
    @update-show-empire-gaps="handleUpdateShowEmpireGaps"
    @open-import="handleOpenImport"
  />

  <ImportPlanModal
    :isOpen="importModalState.isOpen"
    :initialTab="importModalState.initialTab"
    :isOverview="isOverview"
    :activeStationId="empireStore.activeStationId"
    :activeStation="importModalActiveStation"
    :createStation="importModalCreateStation"
    :applyImportedStationPayload="importModalApplyPayload"
    :updateStationModules="importModalUpdateModules"
    :getStationById="importModalGetStationById"
    @close="handleCloseImport"
  />

  <template v-if="isOverview || !!activeTransitSectorId">
    <div v-if="activeTransitSectorId" class="main-layout mt-6">
      <div class="col-span-12 lg:col-span-3">
        <TransitHubBuildPanel :storage-module-plans="transitHubModel.storageModulePlans" />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <TransitHubCenterDashboard
          :grouped-flows="transitHubModel.groupedFlows"
          :storage-flows="transitHubModel.storageFlows"
          :view-mode="wareFlowViewMode"
          @update:view-mode="wareFlowViewMode = $event"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel
          :plannedModulesOverride="transitHubModel.supplyBuildModules"
          :buildPriceMultiplier="stationStore.buildPriceMultiplier"
          :useHQ="stationStore.settings.useHQ"
          @updateBuildPriceMultiplier="handleDashboardUpdateBuildPriceMultiplier"
          @updateUseHQ="handleDashboardUpdateUseHQ"
        />
      </div>
    </div>

    <div v-else-if="isOverview" class="overview-layout mt-6">
      <div class="col-span-1 lg:col-span-2">
        <div class="sector-management-placeholder" aria-hidden="true"></div>
      </div>

      <div class="col-span-1 lg:col-span-3">
        <EmpireWareFlowsDashboard :grouped-flows="empireStore.empireGroupedFlows" />
      </div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel
        :planned-modules="stationPlanningPanelModel.props.value.plannedModules"
        :auto-industry-modules="stationPlanningPanelModel.props.value.autoIndustryModules"
        :enforce-dlc-activation="stationPlanningPanelModel.props.value.enforceDlcActivation"
        @update-planned-modules="stationPlanningPanelModel.emits.updatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="stationWareFlowsModel.props.value.viewMode"
        :grouped-flows="stationWareFlowsModel.props.value.groupedFlows"
        :settings="stationWareFlowsModel.props.value.settings"
        :empire-gaps="stationWareFlowsModel.props.value.empireGaps"
        :planned-modules="stationWareFlowsModel.props.value.plannedModules"
        :wares="stationWareFlowsModel.props.value.wares"
        @update-view-mode="wareFlowViewMode = $event"
        @update-resource-buffer-hours="handleUpdateWareFlowResourceBufferHours"
        @update-primary-product-buffer-hours="handleUpdateWareFlowPrimaryBufferHours"
        @update-secondary-product-buffer-hours="handleUpdateWareFlowSecondaryBufferHours"
        @update-buy-multiplier="handleUpdateWareFlowBuyMultiplier"
        @update-sell-multiplier="handleUpdateWareFlowSellMultiplier"
        @add-gap-module="handleWareFlowAddGapModule"
        @remove-gap-module="handleWareFlowRemoveGapModule"
      />
    </div>

    <div class="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <StationDashboard
        :planned-modules="stationDashboardModel.props.value.plannedModules"
        :station-analysis="stationDashboardModel.props.value.stationAnalysis"
        :settings="stationDashboardModel.props.value.settings"
        :current-efficiency="stationDashboardModel.props.value.currentEfficiency"
        :actual-workforce="stationDashboardModel.props.value.actualWorkforce"
        :build-price-multiplier="stationDashboardModel.props.value.buildPriceMultiplier"
        :hide-workers-view="stationDashboardModel.props.value.hideWorkersView"
        @update-transport-ship-capacity="handleDashboardUpdateTransportShipCapacity"
        @update-build-price-multiplier="handleDashboardUpdateBuildPriceMultiplier"
        @update-manual-workforce="handleDashboardUpdateManualWorkforce"
        @update-workforce-auto="handleDashboardUpdateWorkforceAuto"
        @update-use-hq="handleDashboardUpdateUseHQ"
      />
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  @apply grid grid-cols-12 gap-8 items-start;
}

.overview-layout {
  @apply grid grid-cols-1 lg:grid-cols-5 gap-8 items-start;
}

.sector-management-placeholder {
  min-height: 1px;
}
</style>
