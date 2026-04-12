<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useStationTabBarModel } from '@/components/empire/composables/useStationTabBarModel'
import { useContextToolbarModel } from '@/components/empire/composables/useContextToolbarModel'
import { useStationPlanningPanelModel } from '@/components/empire/composables/useStationPlanningPanelModel'
import { useStationWareFlowsModel } from '@/components/empire/composables/useStationWareFlowsModel'
import { useStationDashboardModel } from '@/components/empire/composables/useStationDashboardModel'
import type { StationType, SavedModule, GroupedFlows } from '@/types/x4'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import StationDashboard from '@/components/empire/StationDashboard.vue'
import StationTabBar from '@/components/empire/StationTabBar.vue'
import ContextToolbar from '@/components/empire/ContextToolbar.vue'
import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'
import ImportPlanModal from '@/components/empire/ImportPlanModal.vue'

type SharedWareFlowViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

const { t } = useI18n()
const { translateWare } = useX4I18n()
const blueprintStore = useBlueprintProductionStore()
const activeViewStore = useActiveViewStore()
const gameData = useGameDataStore()

onMounted(() => {
  const empireId = activeViewStore.activeEmpireId
  if (empireId && !blueprintStore.activeEmpire) {
    blueprintStore.loadEmpire(empireId)
  }
})

watch(() => activeViewStore.activeEmpireId, (newId) => {
  if (newId && newId !== blueprintStore.activeEmpire?.id) {
    blueprintStore.loadEmpire(newId)
  }
})

const wareFlowViewMode = ref<SharedWareFlowViewMode>('quantity')
const isBindingMode = computed(() => false)
const activeStation = computed(() => blueprintStore.activeStation)

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
  return blueprintStore.createStation(name, type)
}

const importModalApplyPayload = (stationId: string, payload: any) => {
  blueprintStore.applyImportedStationPayload(stationId, payload)
}

const importModalUpdateModules = (stationId: string, modules: any[]) => {
  blueprintStore.updateStationModules(stationId, modules)
}

const importModalGetStationById = (stationId: string) => {
  return blueprintStore.getStationById(stationId)
}

const tabBarModel = useStationTabBarModel({
    orderedStations: computed(() => blueprintStore.orderedStations),
    activeStationId: computed({
      get: () => blueprintStore.activeStationId,
      set: (val) => blueprintStore.selectStation(val)
    })
  })

const activeEmpireNameRef = computed({
  get: () => blueprintStore.activeEmpire?.name || '',
  set: (val: string) => { blueprintStore.updateEmpireName(val) }
})

const singleBerthThroughput = computed(() => {
  const shipCapacity = Math.max(1, blueprintStore.settings.transportShipCapacity || 1)
  return shipCapacity * 15
})

const contextToolbarModel = useContextToolbarModel({
    isBindingMode,
    activeStation,
    activeTransitSectorId: computed(() => null),
    sectors: computed(() => []),
    settings: computed(() => blueprintStore.settings),
    activeBindingName: computed({ get: () => '', set: () => {} }),
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

  const handleUpdateTitle = (value: string) => {
    blueprintStore.updateEmpireName(value)
  }

const handleUpdateStationName = (value: string) => {
  if (activeStation.value) {
    blueprintStore.renameStation(activeStation.value.id, value)
  }
}

const handleUpdateStationType = (value: string) => {
  if (activeStation.value) {
    blueprintStore.updateStationType(activeStation.value.id, value as any)
  }
}

const handleUpdateStationCount = (value: number) => {
  if (activeStation.value) {
    blueprintStore.updateStationCount(activeStation.value.id, value)
  }
}

const handleToggleMineral = (mineral: string) => {
  if (!activeStation.value) return
  const current = activeStation.value.minerals || []
  const newMinerals = current.includes(mineral)
    ? current.filter((m: string) => m !== mineral)
    : [...current, mineral]
  blueprintStore.updateStationMinerals(activeStation.value.id, newMinerals)
}

const handleUpdateSunlight = (value: number) => {
  blueprintStore.updateSetting('sunlight', value)
}

const handleUpdateTransportMinutes = (value: number) => {
  blueprintStore.updateSetting('transportMinutes', value)
}

const handleUpdateRacePreference = (value: string) => {
  blueprintStore.updateSetting('racePreference', value)
}

const handleUpdateWorkforce = (value: boolean) => {
  blueprintStore.updateSetting('considerWorkforceForAutoFill', value)
}

const handleUpdateShowEmpireGaps = (value: boolean) => {
  blueprintStore.updateSetting('showEmpireGaps', value)
}

const handleUpdatePlannedModules = (modules: SavedModule[]) => {
  if (activeStation.value) {
    blueprintStore.updateStationModules(activeStation.value.id, modules)
  }
}

const stationPlanningPanelModel = useStationPlanningPanelModel({
  plannedModules: computed(() => blueprintStore.plannedModules as SavedModule[]),
  autoIndustryModules: computed(() => blueprintStore.autoIndustryModules as SavedModule[]),
  enforceDlcActivation: computed(() => blueprintStore.enforceDlcActivation),
  onUpdatePlannedModules: handleUpdatePlannedModules
})

const empireGapsForModel = computed(() => {
  const flows = blueprintStore.getStationComponentGapFlows(activeStation.value?.id || null)

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
    .filter((flow: any) => flow.netRate < 0 || blueprintStore.getResolvedLevel(flow.wareId) > 0)
    .map((flow: any) => {
      const module = gameData.findModuleForWare(flow.wareId, blueprintStore.settings.racePreference)
      const plannedIndex = module ? blueprintStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = blueprintStore.wares[flow.wareId]
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
      const module = gameData.findModuleForWare(flow.wareId, blueprintStore.settings.racePreference)
      const plannedIndex = module ? blueprintStore.plannedModules.findIndex(m => m.id === module.id) : -1
      const wareInfo = blueprintStore.wares[flow.wareId]
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
  groupedFlows: computed(() => blueprintStore.groupedFlows as GroupedFlows),
  settings: computed(() => ({
    resourceBufferHours: blueprintStore.settings.resourceBufferHours,
    primaryProductBufferHours: blueprintStore.settings.primaryProductBufferHours,
    secondaryProductBufferHours: blueprintStore.settings.secondaryProductBufferHours,
    buyMultiplier: blueprintStore.settings.buyMultiplier,
    sellMultiplier: blueprintStore.settings.sellMultiplier,
    racePreference: blueprintStore.settings.racePreference,
    showEmpireGaps: blueprintStore.settings.showEmpireGaps ?? false,
    transportMinutes: blueprintStore.settings.transportMinutes
  })),
  empireGaps: empireGapsForModel,
  plannedModules: computed(() => blueprintStore.plannedModules as SavedModule[]),
  wares: computed(() => blueprintStore.wares),
  modulesMap: computed(() => gameData.localizedModulesMap),
  isWareLocked: (wareId: string) => blueprintStore.isWareLocked(wareId),
  getResolvedLevel: (wareId: string) => blueprintStore.getResolvedLevel(wareId),
  isWareOperable: (wareId: string) => blueprintStore.isWareOperable(wareId),
  isPlannedWare: (wareId: string) => blueprintStore.isPlannedWare(wareId),
  onToggleWareLock: (wareId: string) => blueprintStore.toggleWareLock(wareId),
  onToggleWarePriority: (wareId: string) => blueprintStore.toggleWarePriority(wareId)
})

const stationDashboardModel = useStationDashboardModel({
  plannedModules: computed(() => blueprintStore.plannedModules as SavedModule[]),
  stationAnalysis: computed(() => blueprintStore.stationAnalysis) as any,
  settings: computed(() => ({
    transportShipCapacity: blueprintStore.settings.transportShipCapacity,
    workforceAuto: blueprintStore.settings.workforceAuto,
    manualWorkforce: blueprintStore.settings.manualWorkforce,
    useHQ: blueprintStore.settings.useHQ
  })),
  currentEfficiency: computed(() => blueprintStore.currentEfficiency),
  actualWorkforce: computed(() => blueprintStore.actualWorkforce),
buildPriceMultiplier: computed({
      get: () => blueprintStore.buildPriceMultiplier,
      set: (val: number) => { blueprintStore.buildPriceMultiplier = val }
    }) as any
  })

  const handleSelectStation = (stationId: string) => {
  blueprintStore.selectStation(stationId)
}

const handleCreateStation = () => {
  blueprintStore.createStation(t('sector.new_station_name'), 'industrial')
}

const handleRenameStation = (stationId: string) => {
  blueprintStore.selectStation(stationId)
}

const handleDuplicateStation = (stationId: string) => {
  blueprintStore.duplicateStation(stationId)
}

const handleDeleteStation = (stationId: string) => {
    blueprintStore.deleteStation(stationId)
  }

  const handleUpdateWareFlowResourceBufferHours = (value: number) => {
  blueprintStore.updateSetting('resourceBufferHours', value)
}

const handleUpdateWareFlowPrimaryBufferHours = (value: number) => {
  blueprintStore.updateSetting('primaryProductBufferHours', value)
}

const handleUpdateWareFlowSecondaryBufferHours = (value: number) => {
  blueprintStore.updateSetting('secondaryProductBufferHours', value)
}

const handleUpdateWareFlowBuyMultiplier = (value: number) => {
  blueprintStore.updateSetting('buyMultiplier', value)
}

const handleUpdateWareFlowSellMultiplier = (value: number) => {
  blueprintStore.updateSetting('sellMultiplier', value)
}

const handleWareFlowAddGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, blueprintStore.settings.racePreference)
  if (!module) return
  blueprintStore.addModule(module.id, 1)
}

const handleWareFlowRemoveGapModule = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, blueprintStore.settings.racePreference)
  if (!module) return
  const plannedIndex = blueprintStore.plannedModules.findIndex(m => m.id === module.id)
  if (plannedIndex === -1) return
  const current = blueprintStore.plannedModules[plannedIndex]?.count ?? 0
  if (current <= 1) {
    blueprintStore.removeModule(plannedIndex)
  } else {
    blueprintStore.updateModuleCount(plannedIndex, current - 1)
  }
}

const handleDashboardUpdateTransportShipCapacity = (value: number) => {
  blueprintStore.updateSetting('transportShipCapacity', value)
}

const handleDashboardUpdateBuildPriceMultiplier = (value: number) => {
  blueprintStore.buildPriceMultiplier = value
}

const handleDashboardUpdateManualWorkforce = (value: number) => {
  blueprintStore.updateSetting('manualWorkforce', value)
}

const handleDashboardUpdateWorkforceAuto = (value: boolean) => {
  blueprintStore.updateSetting('workforceAuto', value)
}

const handleDashboardUpdateUseHQ = (value: boolean) => {
  blueprintStore.updateSetting('useHQ', value)
}
</script>

<template>
  <StationTabBar
    :tabs="tabBarModel.props.value.tabs"
    :active-tab-id="tabBarModel.props.value.activeTabId"
    :can-create-station="tabBarModel.props.value.canCreateStation"
    :can-open-context-menu="tabBarModel.props.value.canOpenContextMenu"
    @select-station="handleSelectStation"
    @create-station="handleCreateStation"
    @rename-station="handleRenameStation"
    @duplicate-station="handleDuplicateStation"
    @delete-station="handleDeleteStation"
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
    :isOverview="!activeStation"
    productionSource="empire"
    :activeStationId="blueprintStore.activeStationId"
    :activeStation="importModalActiveStation"
    :createStation="importModalCreateStation"
    :applyImportedStationPayload="importModalApplyPayload"
    :updateStationModules="importModalUpdateModules"
    :getStationById="importModalGetStationById"
    @close="handleCloseImport"
  />

  <div v-if="activeStation" class="main-layout mt-6">
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
</style>