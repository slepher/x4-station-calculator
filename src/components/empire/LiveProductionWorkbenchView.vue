<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useSectorStationTabBarModel } from '@/components/empire/composables/useSectorStationTabBarModel'
import { useContextToolbarModel } from '@/components/empire/composables/useContextToolbarModel'
import { useStationWareFlowsModel } from '@/components/empire/composables/useStationWareFlowsModel'
import { useEmpireWareFlowDerived } from '@/components/empire/composables/useEmpireWareFlowDerived'
import { useTransitHubWorkbenchModel } from '@/components/empire/composables/useTransitHubWorkbenchModel'
import type { StationType, SavedModule, EmpireGroupedFlows } from '@/types/x4'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import SectorStationTabBar from '@/components/empire/SectorStationTabBar.vue'
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
const liveStore = useLiveProductionStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()

onMounted(() => {
  const gameGuid = activeViewStore.activeBinding
  if (gameGuid && !liveStore.activeBinding) {
    liveStore.openBinding(gameGuid)
  }
})

watch(() => activeViewStore.activeBinding, (newGuid) => {
  if (newGuid && newGuid !== liveStore.activeBinding?.gameGuid) {
    liveStore.openBinding(newGuid)
  }
})

const wareFlowViewMode = ref<SharedWareFlowViewMode>('quantity')
const isBindingMode = computed(() => true)
const activeStation = computed(() => liveStore.activeStation)

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
  return liveStore.createStation(name, type)
}

const importModalApplyPayload = (stationId: string, payload: any) => {
  liveStore.applyImportedStationPayload(stationId, payload)
}

const importModalUpdateModules = (stationId: string, modules: any[]) => {
  liveStore.updateStationModules(stationId, modules)
}

const importModalGetStationById = (stationId: string) => {
  return liveStore.getStationById(stationId)
}

const tabBarModel = useSectorStationTabBarModel({
  sectors: computed(() => liveStore.sectors),
  orderedStationsBySector: computed(() => liveStore.orderedStationsBySector),
  activeStationId: computed({
    get: () => liveStore.activeStationId,
    set: (val) => liveStore.selectStation(val)
  }),
  isBindingMode,
  getLinkedSectors: (sectorId: string) => liveStore.getLinkedSectors(sectorId)
})

const activeTransitSectorId = computed(() => liveStore.activeTransitSectorId)
const isOverview = computed(() => liveStore.activeStation === null && !activeTransitSectorId.value)

const empireWareFlowDerived = useEmpireWareFlowDerived({
  stations: computed(() => liveStore.orderedStationsBySector),
  modulesMap: computed(() => gameData.modulesMap || {})
})

const activeBindingNameRef = computed({
  get: () => liveStore.activeBindingName,
  set: (val: string) => { liveStore.activeBindingName = val }
})

const singleBerthThroughput = computed(() => {
  const shipCapacity = Math.max(1, liveStore.settings.transportShipCapacity || 1)
  return shipCapacity * 15
})

const contextToolbarModel = useContextToolbarModel({
  isBindingMode,
  activeStation,
  activeTransitSectorId,
  sectors: computed(() => liveStore.sectors),
  settings: computed(() => liveStore.settings),
  activeBindingName: activeBindingNameRef as any,
  activeEmpireName: computed({ get: () => '', set: () => {} }),
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
  return liveStore.sectors.find((sector) => sector.id === activeTransitSectorId.value) || null
})

const handleUpdateTitle = (value: string) => {
  if (isBindingMode.value && isOverview.value) {
    liveStore.activeBindingName = value
  } else if (activeTransitSectorId.value && activeSupplySector.value) {
    liveStore.renameBindingSector(activeSupplySector.value.id, value)
  }
}

const handleUpdateStationName = (value: string) => {
  if (activeStation.value) {
    liveStore.renameStation(activeStation.value.id, value)
  }
}

const handleUpdateStationType = (value: string) => {
  if (activeStation.value) {
    liveStore.updateStationType(activeStation.value.id, value as any)
  }
}

const handleUpdateStationCount = (value: number) => {
  if (activeStation.value) {
    liveStore.updateStationCount(activeStation.value.id, value)
  }
}

const handleToggleMineral = (mineral: string) => {
  if (!activeStation.value) return
  const current = activeStation.value.minerals || []
  const newMinerals = current.includes(mineral)
    ? current.filter((m: string) => m !== mineral)
    : [...current, mineral]
  liveStore.updateStationMinerals(activeStation.value.id, newMinerals)
}

const handleUpdateSunlight = (value: number) => {
  liveStore.updateSetting('sunlight', value)
}

const handleUpdateTransportMinutes = (value: number) => {
  liveStore.updateSetting('transportMinutes', value)
}

const handleUpdateRacePreference = (value: string) => {
  liveStore.updateSetting('racePreference', value)
}

const handleUpdateWorkforce = (value: boolean) => {
  liveStore.updateSetting('considerWorkforceForAutoFill', value)
}

const handleUpdateShowEmpireGaps = (value: boolean) => {
  liveStore.updateSetting('showEmpireGaps', value)
}

const handleUpdatePlannedModules = (modules: SavedModule[]) => {
  if (activeStation.value) {
    liveStore.updateStationModules(activeStation.value.id, modules)
  }
}

const empireGapsForModel = computed(() => {
  const flows = liveStore.getStationComponentGapFlows(activeStation.value?.id || null)

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
    .filter((flow: any) => flow.netRate < 0 || liveStore.getResolvedLevel(flow.wareId) > 0)
    .map((flow: any) => {
      const module = gameData.findModuleForWare(flow.wareId, liveStore.settings.racePreference)
      const plannedIndex = module ? liveStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = liveStore.wares[flow.wareId]
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
      const module = gameData.findModuleForWare(flow.wareId, liveStore.settings.racePreference)
      const plannedIndex = module ? liveStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = liveStore.wares[flow.wareId]
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
  groupedFlows: computed(() => liveStore.groupedFlows),
  autoModules: computed(() => liveStore.autoIndustryModules as SavedModule[]),
  settings: computed(() => ({
    resourceBufferHours: liveStore.settings.resourceBufferHours,
    primaryProductBufferHours: liveStore.settings.primaryProductBufferHours,
    secondaryProductBufferHours: liveStore.settings.secondaryProductBufferHours,
    buyMultiplier: liveStore.settings.buyMultiplier,
    sellMultiplier: liveStore.settings.sellMultiplier,
    racePreference: liveStore.settings.racePreference,
    showEmpireGaps: liveStore.settings.showEmpireGaps ?? false,
    transportMinutes: liveStore.settings.transportMinutes
  })),
  empireGaps: empireGapsForModel,
  plannedModules: computed(() => liveStore.plannedModules as SavedModule[]),
  wares: computed(() => liveStore.wares),
  modulesMap: computed(() => gameData.localizedModulesMap),
  isWareLocked: (wareId: string) => liveStore.isWareLocked(wareId),
  getResolvedLevel: (wareId: string) => liveStore.getResolvedLevel(wareId),
  isWareOperable: (wareId: string) => liveStore.isWareOperable(wareId),
  isPlannedWare: (wareId: string) => liveStore.isPlannedWare(wareId),
  onToggleWareLock: (wareId: string) => liveStore.toggleWareLock(wareId),
  onToggleWarePriority: (wareId: string) => liveStore.toggleWarePriority(wareId)
})

const transitHubModelRaw = computed(() => liveStore.getTransitHubViewModel({
  sectorId: activeTransitSectorId.value,
  racePreference: liveStore.settings.racePreference,
  transportShipCapacity: liveStore.settings.transportShipCapacity
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
  liveStore.selectStation(null)
}

const handleSelectTransit = (sectorId: string) => {
  liveStore.selectTransitSector(sectorId)
}

const handleSelectStation = (stationId: string) => {
  liveStore.selectStation(stationId)
}

const handleCreateStation = () => {
  liveStore.createStation(t('sector.new_station_name'), 'industrial')
}

const handleRenameStation = (stationId: string) => {
  liveStore.selectStation(stationId)
}

const handleDeleteStation = (stationId: string) => {
  liveStore.deleteStation(stationId)
}

const handleExpandSector = (sectorId: string | null) => {
  tabBarModel.expandedSectorId.value = sectorId
}

const handleUpdateWareFlowResourceBufferHours = (value: number) => {
  liveStore.updateSetting('resourceBufferHours', value)
}

const handleUpdateWareFlowPrimaryBufferHours = (value: number) => {
  liveStore.updateSetting('primaryProductBufferHours', value)
}

const handleUpdateWareFlowSecondaryBufferHours = (value: number) => {
  liveStore.updateSetting('secondaryProductBufferHours', value)
}

const handleUpdateWareFlowBuyMultiplier = (value: number) => {
  liveStore.updateSetting('buyMultiplier', value)
}

const handleUpdateWareFlowSellMultiplier = (value: number) => {
  liveStore.updateSetting('sellMultiplier', value)
}

const handleWareFlowAddGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, liveStore.settings.racePreference)
  if (!module) return
  liveStore.addModule(module.id, 1)
}

const handleWareFlowRemoveGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, liveStore.settings.racePreference)
  if (!module) return
  const plannedIndex = liveStore.plannedModules.findIndex(m => m.id === module.id)
  if (plannedIndex === -1) return
  const current = liveStore.plannedModules[plannedIndex]?.count ?? 0
  if (current <= 1) {
    liveStore.removeModule(plannedIndex)
  } else {
    liveStore.updateModuleCount(plannedIndex, current - 1)
  }
}

const handleDashboardUpdateTransportShipCapacity = (value: number) => {
  liveStore.updateSetting('transportShipCapacity', value)
}

const handleDashboardUpdateBuildPriceMultiplier = (value: number) => {
  liveStore.buildPriceMultiplier = value
}

const handleDashboardUpdateManualWorkforce = (value: number) => {
  liveStore.updateSetting('manualWorkforce', value)
}

const handleDashboardUpdateWorkforceAuto = (value: boolean) => {
  liveStore.updateSetting('workforceAuto', value)
}

const handleDashboardUpdateUseHQ = (value: boolean) => {
  liveStore.updateSetting('useHQ', value)
}
</script>

<template>
  <SectorStationTabBar
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
    productionSource="save-binding"
    :activeStationId="liveStore.activeStationId"
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
          :price-multiplier="liveStore.settings.buyMultiplier"
          :resource-buffer-hours="liveStore.settings.resourceBufferHours"
          :primary-product-buffer-hours="liveStore.settings.primaryProductBufferHours"
          :secondary-product-buffer-hours="liveStore.settings.secondaryProductBufferHours"
          @update:view-mode="wareFlowViewMode = $event"
          @update:price-multiplier="handleUpdateWareFlowBuyMultiplier"
          @update:resource-buffer-hours="handleUpdateWareFlowResourceBufferHours"
          @update:primary-product-buffer-hours="handleUpdateWareFlowPrimaryBufferHours"
          @update:secondary-product-buffer-hours="handleUpdateWareFlowSecondaryBufferHours"
        />
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel
          :plannedModulesOverride="transitHubModel.storageModulePlans"
          :buildPriceMultiplier="liveStore.buildPriceMultiplier"
          :useHQ="liveStore.settings.useHQ"
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
        <EmpireWareFlowsDashboard
          :grouped-flows="empireWareFlowDerived.empireGroupedFlows.value"
          :price-multiplier="empireWareFlowDerived.priceMultiplier.value"
          @update:price-multiplier="empireWareFlowDerived.priceMultiplier.value = $event"
        />
      </div>
    </div>
  </template>

  <div v-else class="main-layout mt-6">
    <div class="col-span-12 lg:col-span-3">
      <StationPlanningPanel
        :planned-modules="liveStore.plannedModules"
        :auto-industry-modules="liveStore.autoIndustryModules"
        :auto-infrastructure-modules="liveStore.autoInfrastructureModules"
        :enforce-dlc-activation="liveStore.enforceDlcActivation"
        @update-planned-modules="handleUpdatePlannedModules"
      />
    </div>

    <div class="col-span-12 lg:col-span-5">
      <StationWareFlowsDashboard
        :view-mode="stationWareFlowsModel.props.value.viewMode"
        :grouped-flows="stationWareFlowsModel.props.value.groupedFlows"
        :auto-modules="stationWareFlowsModel.props.value.autoModules"
        :settings="stationWareFlowsModel.props.value.settings"
        :empire-gaps="stationWareFlowsModel.props.value.empireGaps"
        :planned-modules="stationWareFlowsModel.props.value.plannedModules"
        :wares="stationWareFlowsModel.props.value.wares"
        :modules-map="stationWareFlowsModel.props.value.modulesMap"
        :is-ware-locked="stationWareFlowsModel.props.value.isWareLocked"
        :get-resolved-level="stationWareFlowsModel.props.value.getResolvedLevel"
        :is-ware-operable="stationWareFlowsModel.props.value.isWareOperable"
        :is-planned-ware="stationWareFlowsModel.props.value.isPlannedWare"
        :on-toggle-ware-lock="stationWareFlowsModel.props.value.onToggleWareLock"
        :on-toggle-ware-priority="stationWareFlowsModel.props.value.onToggleWarePriority"
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
        :planned-modules="liveStore.plannedModules"
        :station-analysis="liveStore.stationAnalysis"
        :settings="{
          transportShipCapacity: liveStore.settings.transportShipCapacity,
          workforceAuto: liveStore.settings.workforceAuto,
          manualWorkforce: liveStore.settings.manualWorkforce,
          useHQ: liveStore.settings.useHQ
        }"
        :current-efficiency="liveStore.currentEfficiency"
        :actual-workforce="liveStore.actualWorkforce"
        :build-price-multiplier="liveStore.buildPriceMultiplier"
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
