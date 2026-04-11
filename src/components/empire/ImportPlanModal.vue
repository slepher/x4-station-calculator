<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useStatusStore } from '@/store/useStatusStore'
import { useToolbarWorkflowController } from '@/composables/useToolbarWorkflowController'
import { buildEmpireImportTargets, buildStationImportPayload, type LogicFlowImportWarning, type StationImportPayload } from '@/store/logic/logicFlowImport'
import { getLogicFlowGroupDisplayName } from '@/store/logic/logicFlowGroupName'
import { parseGameComLink, parseXmlBlueprintMeta, resolveModuleId } from '@/store/logic/blueprintParser'
import TopViewSwitch from '@/components/common/TopViewSwitch.vue'
import LogicFlowImportBody from '../logic-flow/LogicFlowImportBody.vue'
import LogicFlowImportWarningModal from './LogicFlowImportWarningModal.vue'
import StationImportConfirmDialog from './StationImportConfirmDialog.vue'
import SmartSaveDialog from '../common/SmartSaveDialog.vue'

type ImportTabKey = 'logic-flow' | 'game-blueprint' | 'x4-station'
type BlueprintModule = { id: string; count: number }

const props = withDefaults(defineProps<{
  isOpen: boolean
  initialTab?: ImportTabKey
}>(), {
  initialTab: 'game-blueprint'
})

const emit = defineEmits(['close'])
const { t } = useI18n()
const empireStore = useEmpireStore()
const gameDataStore = useGameDataStore()
const logicFlowStore = useLogicFlowStore()
const statusStore = useStatusStore()
const toolbarWorkflow = useToolbarWorkflowController({
  t,
  translateShip: (ship) => ship.name || ship.id
})

const activeTab = ref<ImportTabKey>('game-blueprint')
const selfClosed = ref(false)
const x4StationContent = ref('')
const x4StationHasError = ref(false)

const showStationImportConfirm = ref(false)
const showEmpireImportConfirm = ref(false)
const empireImportSubmitted = ref(false)
const showWarningModal = ref(false)
const pendingImportSelection = ref<{ planId: string; groupId?: string } | null>(null)
const pendingStationGroupName = ref('')
const warningSummary = ref<LogicFlowImportWarning[]>([])
const pendingLogicFlowModules = ref<StationImportPayload | null>(null)
const pendingX4StationModules = ref<BlueprintModule[]>([])

const blueprintUploadError = ref('')
const blueprintFileName = ref('')
const blueprintStationName = ref('')
const blueprintModules = ref<BlueprintModule[]>([])
const blueprintModuleTotal = ref(0)
const x4StationPlaceholder = 'https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_water_01,count:1;...'
const blueprintInputRef = ref<HTMLInputElement | null>(null)
const showBlueprintStrategyDialog = ref(false)

const importTabs = computed(() => [
  { key: 'logic-flow', label: t('importView.tab_logic_flow'), activeClass: 'bg-blue-600 text-white shadow-lg' },
  { key: 'game-blueprint', label: t('importView.tab_game_blueprint'), activeClass: 'bg-purple-600 text-white shadow-lg' },
  { key: 'x4-station', label: 'x4-game.com', activeClass: 'bg-emerald-600 text-white shadow-lg' }
])

const isOverview = computed(() => empireStore.activeStationId === null)
const logicFlowImportMode = computed<'station' | 'empire'>(() => (isOverview.value ? 'empire' : 'station'))
const hasBlueprintReady = computed(() => blueprintModules.value.length > 0 && blueprintModuleTotal.value > 0)

const resetBlueprintState = () => {
  blueprintUploadError.value = ''
  blueprintFileName.value = ''
  blueprintStationName.value = ''
  blueprintModules.value = []
  blueprintModuleTotal.value = 0
  showBlueprintStrategyDialog.value = false
  if (blueprintInputRef.value) blueprintInputRef.value.value = ''
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return
    selfClosed.value = false
    activeTab.value = props.initialTab
    x4StationHasError.value = false
    pendingImportSelection.value = null
    resetBlueprintState()
  }
)

watch(
  () => props.initialTab,
  (tab) => {
    if (!props.isOpen) return
    activeTab.value = tab
  }
)

const handleClose = () => {
  selfClosed.value = true
  x4StationHasError.value = false
  showStationImportConfirm.value = false
  showEmpireImportConfirm.value = false
  showWarningModal.value = false
  resetBlueprintState()
  emit('close')
}

const handleImportX4StationString = () => {
  if (!x4StationContent.value.trim()) return

  try {
    const raw = x4StationContent.value.trim()
    const counts = parseGameComLink(raw)
    if (Object.keys(counts).length === 0) {
      throw new Error('No valid x4-game link content')
    }

    const modules = toBlueprintModules(counts)
    if (modules.length === 0) {
      throw new Error('No valid modules in x4-game link content')
    }

    if (isOverview.value) {
      const station = createStationWithDefaultName()
      if (!station) {
        throw new Error('Failed to create station for import')
      }
      applyBlueprintOverwrite(station.id, modules)
    } else {
      const stationId = empireStore.activeStation?.id
      if (!stationId) {
        throw new Error('No active station for import')
      }
      // Unified strategy dialog for non-empty station
      if (isStationEmpty()) {
        applyBlueprintOverwrite(stationId, modules)
      } else {
        pendingX4StationModules.value = modules
        showBlueprintStrategyDialog.value = true
        return
      }
    }

    x4StationContent.value = ''
    x4StationHasError.value = false
    emit('close')
  } catch {
    x4StationHasError.value = true
  }
}

const getSelectedPlan = () => {
  const selection = pendingImportSelection.value
  if (!selection) return null
  return logicFlowStore.savedPlans.list.find((plan) => plan.id === selection.planId) || null
}

const applyImportPayloadToStation = (stationId: string, payload: StationImportPayload) => {
    const modules = payload.plannedModules.map((module) => ({ ...module }))
    empireStore.applyImportedStationPayload(stationId, {
      modules,
      lockedWares: [...payload.lockedWares],
      warePriority: {}
    })
  }

const executeStationImport = (mode: 'new' | 'overwrite', payload?: StationImportPayload) => {
  const selection = pendingImportSelection.value
  let importPayload = payload

  // If no payload provided, build from selection
  if (!importPayload && selection?.groupId) {
    const plan = getSelectedPlan()
    const group = plan?.groups.find((item) => item.id === selection.groupId)
    if (!group) return

    importPayload = buildStationImportPayload(group, gameDataStore.waresMap, gameDataStore.getWareDisplayName)
    if (importPayload.manualModuleCount === 0) {
      statusStore.pushMessage('warning', 'system', t('logicFlowImport.error_empty_group'))
      showStationImportConfirm.value = false
      return
    }
  }

  if (!importPayload) return

  if (mode === 'overwrite') {
    const stationId = empireStore.activeStation?.id
    if (!stationId) {
      statusStore.pushMessage('warning', 'system', t('logicFlowImport.error_no_active_station'))
      showStationImportConfirm.value = false
      showBlueprintStrategyDialog.value = false
      return
    }
    applyImportPayloadToStation(stationId, importPayload)
  } else {
    const newStation = empireStore.createStation(importPayload.groupName || t('sector.new_station_name'))
    if (!newStation) {
      showStationImportConfirm.value = false
      showBlueprintStrategyDialog.value = false
      return
    }
    applyImportPayloadToStation(newStation.id, importPayload)
  }

  warningSummary.value = importPayload.warnings
  showWarningModal.value = importPayload.warnings.length > 0
  showStationImportConfirm.value = false
  showBlueprintStrategyDialog.value = false
  pendingImportSelection.value = null
  pendingLogicFlowModules.value = null
  handleClose()
}

const executeEmpireImport = () => {
  const plan = getSelectedPlan()
  if (!plan) return

  const result = buildEmpireImportTargets(plan.groups, gameDataStore.waresMap, gameDataStore.getWareDisplayName)
  if (result.targets.length === 0) {
    statusStore.pushMessage('warning', 'system', t('logicFlowImport.error_empty_plan'))
    return
  }

  result.targets.forEach((target) => {
    const station = empireStore.createStation(target.groupName || t('sector.new_station_name'))
    if (!station) return
    applyImportPayloadToStation(station.id, target)
  })

  warningSummary.value = result.warnings
  showWarningModal.value = result.warnings.length > 0
  pendingImportSelection.value = null
}

const handleImportSelected = (selection: { planId: string; groupId?: string }) => {
  pendingImportSelection.value = selection

  if (logicFlowImportMode.value === 'station') {
    const plan = getSelectedPlan()
    const group = plan?.groups.find((item) => item.id === selection.groupId)
    if (!group) return

    const payload = buildStationImportPayload(group, gameDataStore.waresMap, gameDataStore.getWareDisplayName)
    if (payload.manualModuleCount === 0) {
      statusStore.pushMessage('warning', 'system', t('logicFlowImport.error_empty_group'))
      return
    }

    pendingStationGroupName.value = getLogicFlowGroupDisplayName(group, gameDataStore.getWareDisplayName)

    // Unified strategy dialog for non-empty station
    if (isStationEmpty()) {
      pendingLogicFlowModules.value = payload
      showStationImportConfirm.value = true
    } else {
      pendingLogicFlowModules.value = payload
      showBlueprintStrategyDialog.value = true
    }
    return
  }

  if (toolbarWorkflow.shouldConfirmBeforeImport('station')) {
    showEmpireImportConfirm.value = true
    return
  }

  toolbarWorkflow.runImportAction({
    storeType: 'station',
    choice: 'DISCARD_AND_IMPORT',
    defaultEmpireName: t('menu.default_sector_name'),
    importData: () => executeEmpireImport()
  })
}

const handleEmpireImportSubmit = (payload: { choice: 'SAVE_AND_IMPORT' | 'DISCARD_AND_IMPORT' }) => {
  empireImportSubmitted.value = true
  showEmpireImportConfirm.value = false
  const result = toolbarWorkflow.runImportAction({
    storeType: 'station',
    choice: payload.choice,
    defaultEmpireName: t('menu.default_sector_name'),
    importData: () => executeEmpireImport()
  })
  if (!result.ok) {
    empireImportSubmitted.value = false
  }
}

const handleEmpireImportDialogClose = () => {
  if (empireImportSubmitted.value) {
    empireImportSubmitted.value = false
    handleClose()
    return
  }
  showEmpireImportConfirm.value = false
}

const getFileStationName = (xmlName: string, fileName: string) => {
  const fromXml = xmlName.trim()
  if (fromXml) return fromXml

  const base = fileName.replace(/\.[^.]+$/, '').trim()
  if (!base) return t('sector.new_station_name')
  return base.slice(0, 20)
}

const toBlueprintModules = (counts: Record<string, number>) => {
  const resolvedMap = new Map<string, number>()

  Object.entries(counts).forEach(([id, count]) => {
    const resolved = resolveModuleId(id, gameDataStore.modulesMap, gameDataStore.modulesByMacroId)
    if (!resolved) return
    resolvedMap.set(resolved, (resolvedMap.get(resolved) || 0) + count)
  })

  return Array.from(resolvedMap.entries())
    .map(([id, count]) => ({ id, count }))
    .filter((item) => item.count > 0)
}

const handleBlueprintFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  resetBlueprintState()
  if (!file) return

  try {
    const text = await file.text()
    const parsed = parseXmlBlueprintMeta(text)
    const modules = toBlueprintModules(parsed.counts)
    const moduleTotal = modules.reduce((sum, item) => sum + item.count, 0)

    if (moduleTotal === 0) {
      blueprintUploadError.value = t('importView.blueprint_upload_no_modules')
      return
    }

    blueprintFileName.value = file.name
    blueprintStationName.value = getFileStationName(parsed.name, file.name)
    blueprintModules.value = modules
    blueprintModuleTotal.value = moduleTotal
  } catch (e) {
    console.error(e)
    blueprintUploadError.value = t('importView.blueprint_upload_failed')
  }
}

const isStationEmpty = () => {
  const station = empireStore.activeStation
  if (!station) return true
  return !station.modules.some((module) => module.count > 0)
}

const applyBlueprintOverwrite = (stationId: string, modules: BlueprintModule[]) => {
  const station = empireStore.getStationById(stationId)
  if (!station) return
  empireStore.updateStationModules(station.id, modules.map((item) => ({ ...item })))
}

const applyBlueprintAdd = (stationId: string, modules: BlueprintModule[]) => {
  const station = empireStore.getStationById(stationId)
  if (!station) return

  const merged = new Map<string, number>()
  station.modules.forEach((module) => {
    merged.set(module.id, (merged.get(module.id) || 0) + module.count)
  })
  modules.forEach((module) => {
    merged.set(module.id, (merged.get(module.id) || 0) + module.count)
  })

  empireStore.updateStationModules(
    station.id,
    Array.from(merged.entries()).map(([id, count]) => ({ id, count }))
  )
}

const createStationWithDefaultName = () => {
  return empireStore.createStation(t('sector.new_station_name'), 'industrial')
}

const createStationAndImportBlueprint = (modules: BlueprintModule[]) => {
  const station = empireStore.createStation(blueprintStationName.value || t('sector.new_station_name'), 'industrial')
  if (!station) return
  applyBlueprintOverwrite(station.id, modules)
}

const finalizeBlueprintImport = () => {
  resetBlueprintState()
  emit('close')
}

const handleImportBlueprint = () => {
  if (!hasBlueprintReady.value) return

  if (isOverview.value) {
    createStationAndImportBlueprint(blueprintModules.value)
    finalizeBlueprintImport()
    return
  }

  const stationId = empireStore.activeStation?.id
  if (!stationId) {
    statusStore.pushMessage('warning', 'system', t('logicFlowImport.error_no_active_station'))
    return
  }

  if (isStationEmpty()) {
    applyBlueprintOverwrite(stationId, blueprintModules.value)
    finalizeBlueprintImport()
    return
  }

  showBlueprintStrategyDialog.value = true
}

const handleBlueprintActionOverwrite = () => {
  const stationId = empireStore.activeStation?.id
  if (!stationId) return

  // Handle logic-flow import
  if (pendingLogicFlowModules.value) {
    applyImportPayloadToStation(stationId, pendingLogicFlowModules.value)
    warningSummary.value = pendingLogicFlowModules.value.warnings
    showWarningModal.value = pendingLogicFlowModules.value.warnings?.length > 0
    pendingLogicFlowModules.value = null
    pendingImportSelection.value = null
    showBlueprintStrategyDialog.value = false
    handleClose()
    return
  }

  // Handle x4-station import
  if (pendingX4StationModules.value.length > 0) {
    applyBlueprintOverwrite(stationId, pendingX4StationModules.value)
    pendingX4StationModules.value = []
    showBlueprintStrategyDialog.value = false
    x4StationContent.value = ''
    x4StationHasError.value = false
    emit('close')
    return
  }

  // Handle game-blueprint import
  applyBlueprintOverwrite(stationId, blueprintModules.value)
  showBlueprintStrategyDialog.value = false
  finalizeBlueprintImport()
}

const handleBlueprintActionAdd = () => {
  const stationId = empireStore.activeStation?.id
  if (!stationId) return

  // Handle logic-flow import
  if (pendingLogicFlowModules.value) {
    applyImportPayloadToStation(stationId, pendingLogicFlowModules.value)
    warningSummary.value = pendingLogicFlowModules.value.warnings
    showWarningModal.value = pendingLogicFlowModules.value.warnings?.length > 0
    pendingLogicFlowModules.value = null
    pendingImportSelection.value = null
    showBlueprintStrategyDialog.value = false
    handleClose()
    return
  }

  // Handle x4-station import
  if (pendingX4StationModules.value.length > 0) {
    applyBlueprintAdd(stationId, pendingX4StationModules.value)
    pendingX4StationModules.value = []
    showBlueprintStrategyDialog.value = false
    x4StationContent.value = ''
    x4StationHasError.value = false
    emit('close')
    return
  }

  // Handle game-blueprint import
  applyBlueprintAdd(stationId, blueprintModules.value)
  showBlueprintStrategyDialog.value = false
  finalizeBlueprintImport()
}

const handleBlueprintActionNew = () => {
  // Handle logic-flow import
  if (pendingLogicFlowModules.value) {
    const newStation = empireStore.createStation(pendingStationGroupName.value || t('sector.new_station_name'))
    if (newStation) {
      applyImportPayloadToStation(newStation.id, pendingLogicFlowModules.value)
      warningSummary.value = pendingLogicFlowModules.value.warnings
      showWarningModal.value = pendingLogicFlowModules.value.warnings?.length > 0
    }
    pendingLogicFlowModules.value = null
    pendingImportSelection.value = null
    showBlueprintStrategyDialog.value = false
    handleClose()
    return
  }

  // Handle x4-station import
  if (pendingX4StationModules.value.length > 0) {
    const station = createStationWithDefaultName()
    if (station) {
      applyBlueprintOverwrite(station.id, pendingX4StationModules.value)
    }
    pendingX4StationModules.value = []
    showBlueprintStrategyDialog.value = false
    x4StationContent.value = ''
    x4StationHasError.value = false
    emit('close')
    return
  }

  // Handle game-blueprint import
  createStationAndImportBlueprint(blueprintModules.value)
  showBlueprintStrategyDialog.value = false
  finalizeBlueprintImport()
}
</script>

<template>
  <div v-if="isOpen && !selfClosed" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="import-view-modal">
    <div class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col animate-fade-in overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 18h8" />
            <path d="M8 14h8" />
          </svg>
          {{ t('importView.title') }}
        </h3>
        <div class="ml-auto flex items-center gap-3">
          <TopViewSwitch
            v-model="activeTab"
            :tabs="importTabs"
            ui-key="import-view"
          />
          <button @click="handleClose" class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded" data-testid="import-view-close">
            <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6 space-y-4">
        <template v-if="activeTab === 'logic-flow'">
          <LogicFlowImportBody :mode="logicFlowImportMode" @confirm="handleImportSelected" />
        </template>

        <template v-else-if="activeTab === 'game-blueprint'">
          <p class="text-slate-300 text-sm leading-relaxed">{{ t('importView.blueprint_upload_description') }}</p>

          <label
            class="block w-full border border-slate-600 rounded-lg bg-slate-900/40 hover:border-purple-500/60 transition p-4 cursor-pointer"
            data-testid="import-blueprint-file-upload"
          >
            <input
              ref="blueprintInputRef"
              type="file"
              accept=".xml,text/xml,application/xml"
              class="hidden"
              @change="handleBlueprintFileChange"
            />
            <div class="text-sm text-slate-300">
              {{ blueprintFileName || t('importView.blueprint_select_file') }}
            </div>
            <div class="text-xs text-slate-500 mt-1">
              {{ t('importView.blueprint_select_hint') }}
            </div>
          </label>

          <div v-if="hasBlueprintReady" class="rounded border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-200 space-y-1" data-testid="import-blueprint-summary">
            <div>
              <span class="text-slate-400">{{ t('importView.blueprint_station_name') }}: </span>
              <span class="font-bold text-purple-200">{{ blueprintStationName }}</span>
            </div>
            <div>
              <span class="text-slate-400">{{ t('importView.blueprint_module_total') }}: </span>
              <span class="font-bold text-cyan-300" data-testid="import-blueprint-module-count">{{ blueprintModuleTotal }}</span>
            </div>
          </div>

          <div v-if="blueprintUploadError" class="text-red-400 text-sm flex items-center gap-2" data-testid="import-blueprint-error">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {{ blueprintUploadError }}
          </div>
        </template>

        <template v-else>
          <p class="text-slate-300 text-sm leading-relaxed">{{ t('importView.x4_station_description') }}</p>

          <textarea
            v-model="x4StationContent"
            class="w-full h-64 bg-slate-900/50 border border-slate-600 rounded p-4 text-xs font-mono text-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none custom-scrollbar"
            data-testid="import-x4-station-input"
            :placeholder="x4StationPlaceholder"
          ></textarea>

          <div v-if="x4StationHasError" class="text-red-400 text-sm flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {{ t('importView.x4_station_failed') }}
          </div>
        </template>
      </div>

      <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/30">
        <button @click="handleClose"
          class="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded font-bold transition text-sm" data-testid="import-view-action-cancel">
          {{ t('menu.action_cancel') }}
        </button>
        <button
          v-if="activeTab !== 'logic-flow'"
          :disabled="activeTab === 'game-blueprint' && !hasBlueprintReady"
          @click="activeTab === 'game-blueprint' ? handleImportBlueprint() : handleImportX4StationString()"
          class="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition shadow-lg shadow-amber-900/20 flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="import-view-action-import"
        >
          {{ t('menu.action_import') }}
        </button>
      </div>
    </div>

    <StationImportConfirmDialog
      :isOpen="showStationImportConfirm"
      :groupName="pendingStationGroupName"
      @close="showStationImportConfirm = false"
      @confirm-new-station="executeStationImport('new')"
      @confirm-overwrite="executeStationImport('overwrite')"
    />

    <SmartSaveDialog
      :isOpen="showEmpireImportConfirm"
      intent="NEW"
      storeType="station"
      mode="import"
      @submit-import="handleEmpireImportSubmit"
      @close="handleEmpireImportDialogClose"
    />

    <LogicFlowImportWarningModal
      :isOpen="showWarningModal"
      :warnings="warningSummary"
      @close="showWarningModal = false"
    />

    <div v-if="showBlueprintStrategyDialog" class="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="blueprint-import-strategy-modal">
      <div class="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
          <h3 class="text-lg font-bold text-white tracking-wide">{{ t('importView.blueprint_strategy_title') }}</h3>
          <button @click="showBlueprintStrategyDialog = false" class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
            <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-6 text-sm text-slate-300 leading-relaxed">
          {{ t('importView.blueprint_strategy_message') }}
        </div>

        <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
          <button class="px-4 py-2 rounded text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition" data-testid="blueprint-strategy-cancel" @click="showBlueprintStrategyDialog = false">
            {{ t('ui.cancel') }}
          </button>
          <button class="px-4 py-2 rounded text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition" data-testid="blueprint-strategy-overwrite" @click="handleBlueprintActionOverwrite">
            {{ t('importView.blueprint_action_overwrite') }}
          </button>
          <button class="px-4 py-2 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition" data-testid="blueprint-strategy-add" @click="handleBlueprintActionAdd">
            {{ t('importView.blueprint_action_add') }}
          </button>
          <button class="px-4 py-2 rounded text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition" data-testid="blueprint-strategy-new" @click="handleBlueprintActionNew">
            {{ t('importView.blueprint_action_new_station') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.8);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 1);
}
</style>
