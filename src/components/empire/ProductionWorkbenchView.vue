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
import { useTitleDisplayNameModel } from '@/composables/useTitleDisplayNameModel'
import { useStationTabBarModel } from '@/components/empire/composables/useStationTabBarModel'
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

const activeSupplySector = computed(() => {
  if (!activeTransitSectorId.value) return null
  return empireStore.sectors.find((sector) => sector.id === activeTransitSectorId.value) || null
})

const sectorTitleConfig = computed(() => {
  if (isBindingMode.value && isOverview.value) {
    return {
      getName: () => saveBindingStore.activeBindingName,
      setName: (name: string) => { saveBindingStore.activeBindingName = name },
      getDefaultName: () => t('binding.new_binding_name')
    }
  }
  return {
    getName: () => activeTransitSectorId.value
      ? (activeSupplySector.value?.name || '')
      : (empireStore.activeEmpire?.name || ''),
    setName: (name: string) => {
      if (activeTransitSectorId.value && activeSupplySector.value) {
        empireStore.renameBindingSector(activeSupplySector.value.id, name)
        return
      }
      empireStore.updateEmpireName(name)
    },
    getDefaultName: () => t('sector.new_sector_name')
  }
})

const { displayNameModel: titleModelValue } = useTitleDisplayNameModel(sectorTitleConfig)

const toolbarMode = computed<'overview' | 'station' | 'transit'>(() => {
  if (activeTransitSectorId.value) return 'transit'
  if (activeStation.value) return 'station'
  return 'overview'
})

const toolbarTitleModel = computed(() => ({
  value: titleModelValue.value,
  placeholder: sectorTitleConfig.value.getDefaultName()
}))

const toolbarStation = computed(() => {
  if (!activeStation.value) return null
  return {
    id: activeStation.value.id,
    name: activeStation.value.name,
    type: activeStation.value.type || 'industrial',
    count: activeStation.value.count ?? 1,
    minerals: activeStation.value.minerals || []
  }
})

const toolbarSettings = computed(() => {
  if (toolbarMode.value === 'station') {
    return stationStore.settings
  }
  if (toolbarMode.value === 'transit') {
    return {
      racePreference: stationStore.settings.racePreference,
      considerWorkforceForAutoFill: stationStore.settings.considerWorkforceForAutoFill,
      showEmpireGaps: stationStore.settings.showEmpireGaps,
      sunlight: stationStore.settings.sunlight,
      transportMinutes: stationStore.settings.transportMinutes
    }
  }
  return null
})

const toolbarRaces = computed(() => [
  { value: 'argon', label: t('toolbar.races.argon') },
  { value: 'terran', label: t('toolbar.races.terran') },
  { value: 'teladi', label: t('toolbar.races.teladi') },
  { value: 'paranid', label: t('toolbar.races.paranid') },
  { value: 'split', label: t('toolbar.races.split') }
])

const toolbarStationTypes = computed(() => [
    { value: 'industrial' as const, label: t('toolbar.station_types.industrial') },
    { value: 'supply' as const, label: t('toolbar.station_types.supply') },
    { value: 'transit' as const, label: t('toolbar.station_types.transit') },
    { value: 'shipyard' as const, label: t('toolbar.station_types.shipyard') }
  ])

const availableMinerals = ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane']

const singleBerthThroughput = computed(() => {
  const shipCapacity = Math.max(1, stationStore.settings.transportShipCapacity || 1)
  return shipCapacity * 15
})

const handleUpdateTitle = (value: string) => {
  sectorTitleConfig.value.setName(value)
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

const transitHubModel = computed(() => empireStore.getTransitHubViewModel({
  sectorId: activeTransitSectorId.value,
  racePreference: stationStore.settings.racePreference,
  transportShipCapacity: stationStore.settings.transportShipCapacity
}))

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

const handleUpdateSearchQuery = (value: string) => {
  stationStore.searchQuery = value
}

const handleAddModule = (moduleId: string) => {
  stationStore.addModule(moduleId)
}

const handleRemoveModule = (index: number) => {
  stationStore.removeModule(index)
}

const handleUpdateModuleCount = (index: number, count: number) => {
  stationStore.updateModuleCount(index, count)
}

const handleReorderModules = (modules: any[]) => {
  if (activeStation.value) {
    empireStore.updateStationModules(activeStation.value.id, modules)
  }
}

const handleApplyScale = (scale: number) => {
  stationStore.plannedModules.forEach((module: any, index: number) => {
    const newCount = Math.ceil(module.count * scale)
    stationStore.updateModuleCount(index, newCount)
  })
}

const handleTransferAutoModule = (module: any) => {
  stationStore.transferModuleFromAutoIndustry(module)
}

const wareFlowSettings = computed(() => ({
  resourceBufferHours: stationStore.settings.resourceBufferHours,
  primaryProductBufferHours: stationStore.settings.primaryProductBufferHours,
  secondaryProductBufferHours: stationStore.settings.secondaryProductBufferHours,
  buyMultiplier: stationStore.settings.buyMultiplier,
  sellMultiplier: stationStore.settings.sellMultiplier,
  racePreference: stationStore.settings.racePreference,
  showEmpireGaps: stationStore.settings.showEmpireGaps ?? false
}))

const empireGaps = computed(() => {
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

const dashboardStationAnalysis = computed(() => ({
  totalCost: stationStore.stationAnalysis.totalCost,
  totalVolume: stationStore.stationAnalysis.totalVolume,
  totalNeeded: stationStore.stationAnalysis.totalNeeded,
  totalCapacity: stationStore.stationAnalysis.totalCapacity,
  totalTime: stationStore.stationAnalysis.totalTime,
  playerHQNeeded: stationStore.stationAnalysis.playerHQNeeded,
  totalWorkerDiff: stationStore.stationAnalysis.totalWorkerDiff || 0,
  moduleGroups: stationStore.stationAnalysis.moduleGroups,
  summaryItems: stationStore.stationAnalysis.summaryItems
}))

const dashboardSettings = computed(() => ({
  transportShipCapacity: stationStore.settings.transportShipCapacity,
  workforceAuto: stationStore.settings.workforceAuto,
  manualWorkforce: stationStore.settings.manualWorkforce,
  useHQ: stationStore.settings.useHQ
}))

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
    :mode="toolbarMode"
    :is-binding-mode="isBindingMode"
    :title-model="toolbarTitleModel"
    :station="toolbarStation"
    :settings="toolbarSettings"
    :races="toolbarRaces"
    :station-types="toolbarStationTypes"
    :available-minerals="availableMinerals"
    :single-berth-throughput="singleBerthThroughput"
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
        :planned-modules="stationStore.plannedModules"
        :auto-industry-modules="stationStore.autoIndustryModules"
        :filtered-modules-grouped="stationStore.filteredModulesGrouped"
        :search-query="stationStore.searchQuery"
        :enforce-dlc-activation="stationStore.enforceDlcActivation"
        @update-search-query="handleUpdateSearchQuery"
        @add-module="handleAddModule"
        @remove-module="handleRemoveModule"
        @update-module-count="handleUpdateModuleCount"
        @reorder-modules="handleReorderModules"
        @apply-scale="handleApplyScale"
        @transfer-auto-module="handleTransferAutoModule"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="wareFlowViewMode"
        :grouped-flows="stationStore.groupedFlows"
        :settings="wareFlowSettings"
        :empire-gaps="empireGaps"
        :planned-modules="stationStore.plannedModules"
        :wares="stationStore.wares"
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
        :planned-modules="stationStore.plannedModules"
        :station-analysis="dashboardStationAnalysis"
        :settings="dashboardSettings"
        :current-efficiency="stationStore.currentEfficiency"
        :actual-workforce="stationStore.actualWorkforce"
        :build-price-multiplier="stationStore.buildPriceMultiplier"
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
