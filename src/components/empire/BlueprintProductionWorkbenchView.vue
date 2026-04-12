<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useStationStore } from '@/store/useStationStore'
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
const stationStore = useStationStore()
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
  const shipCapacity = Math.max(1, stationStore.settings.transportShipCapacity || 1)
  return shipCapacity * 15
})

const contextToolbarModel = useContextToolbarModel({
    isBindingMode,
    activeStation,
    activeTransitSectorId: computed(() => null),
    sectors: computed(() => []),
    settings: computed(() => stationStore.settings),
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
    blueprintStore.updateStationModules(activeStation.value.id, modules)
  }
}

const stationPlanningPanelModel = useStationPlanningPanelModel({
  plannedModules: computed(() => stationStore.plannedModules as SavedModule[]),
  autoIndustryModules: computed(() => stationStore.autoIndustryModules as SavedModule[]),
  enforceDlcActivation: computed(() => stationStore.enforceDlcActivation),
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