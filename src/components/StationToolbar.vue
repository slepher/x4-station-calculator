<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import LanguageSelector from './LanguageSelector.vue'
import MissingTranslate from './MissingTranslate.vue'
import LoadBlueprintPlanModal from './empire/LoadBlueprintPlanModal.vue'
import LoadLivePlanModal from './empire/LoadLivePlanModal.vue'
import LoadFlowPlanModal from './logic-flow/LoadFlowPlanModal.vue'
import SmartSaveDialog from './common/SmartSaveDialog.vue'
import LoadShipBlueprintModal from './ship-build/LoadShipBlueprintModal.vue'
import StorageImportWizard from './StorageImportWizard.vue'
import StorageExportWizard from './StorageExportWizard.vue'
import TopViewSwitch from './common/TopViewSwitch.vue'
import VersionSettingsModal from './VersionSettingsModal.vue'
import SettingsButton from './SettingsButton.vue'
import DlcSettingsModal from './DlcSettingsModal.vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useToolbarWorkflowController } from '@/composables/useToolbarWorkflowController'
import type { SmartSaveStep } from '@/utils/smartSavePolicy'
import type { ToolbarStoreType } from '@/composables/useToolbarWorkflowController'

void useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const gameData = useGameDataStore()
const { t } = useI18n()
const { translateShip } = useX4I18n()
const toolbarWorkflow = useToolbarWorkflowController({ t, translateShip })

const showLoadBlueprintModal = ref(false)
const showLoadLiveModal = ref(false)
const showLoadFlowModal = ref(false)
const showLoadShipBlueprintModal = ref(false)
const showImportWizard = ref(false)
const showVersionSettingsModal = ref(false)
const showDlcSettingsModal = ref(false)
const showExportWizard = ref(false)
const smartDialog = reactive({
  isOpen: false,
  intent: 'NEW' as 'NEW' | 'SAVE_AS'
})

const activeView = computed(() => shipBuildStore.activeView)
const isFlowView = computed(() => activeView.value === 'flow')
const isShipBuildView = computed(() => activeView.value === 'ship-build')
const isLiveView = computed(() => activeView.value === 'live-production' || activeView.value === 'maps')
const isShipActionDisabled = computed(() => isShipBuildView.value && !shipBuildStore.selectedShipId)

const activeToolbarStoreType = computed<ToolbarStoreType>(() => {
  if (isShipBuildView.value) return 'ship-build'
  if (isFlowView.value) return 'logicFlow'
  if (isLiveView.value) return 'live-production'
  return 'blueprint-production'
})

const isLiveNewDisabled = computed(() => !toolbarWorkflow.isActionSupportedFor('live-production', 'NEW'))
const isLiveSaveAsDisabled = computed(() => !toolbarWorkflow.isActionSupportedFor('live-production', 'SAVE_AS'))

const isToolbarActionDisabled = computed(() => {
  if (isShipActionDisabled.value) return true
  return false
})
const showVersionIndicator = computed(() => gameData.needsVersionSetup)

const themeColors = computed(() => {
  if (isFlowView.value) {
    return {
      primary: 'btn-purple',
      secondary: 'btn-fuchsia'
    }
  }
  if (isShipBuildView.value) {
    return {
      primary: 'btn-green',
      secondary: 'btn-emerald'
    }
  }
  if (isLiveView.value) {
    return {
      primary: 'btn-cyan',
      secondary: 'btn-teal'
    }
  }
  return {
    primary: 'btn-blue',
    secondary: 'btn-cyan'
  }
})

const handleNew = () => {
  const result = toolbarWorkflow.runAction({
    storeType: activeToolbarStoreType.value,
    action: 'NEW',
    defaultEmpireName: t('menu.default_sector_name')
  })
  if (result.kind === 'open-smart-save') {
    smartDialog.intent = result.intent
    smartDialog.isOpen = true
  }
}

const handleSave = () => {
  const result = toolbarWorkflow.runAction({
    storeType: activeToolbarStoreType.value,
    action: 'SAVE',
    defaultEmpireName: t('menu.default_sector_name')
  })
  if (result.kind === 'open-smart-save') {
    smartDialog.intent = result.intent
    smartDialog.isOpen = true
  }
}

const handleSaveAs = () => {
  const result = toolbarWorkflow.runAction({
    storeType: activeToolbarStoreType.value,
    action: 'SAVE_AS',
    defaultEmpireName: t('menu.default_sector_name')
  })
  if (result.kind === 'open-smart-save') {
    smartDialog.intent = result.intent
    smartDialog.isOpen = true
  }
}

const handleLoad = () => {
  if (isShipBuildView.value) {
    if (!shipBuildStore.selectedShipId) return
    showLoadShipBlueprintModal.value = true
    return
  }
  if (isFlowView.value) {
    showLoadFlowModal.value = true
    return
  }
  if (isLiveView.value) {
    showLoadLiveModal.value = true
    return
  }
  showLoadBlueprintModal.value = true
}

// Handle SmartSaveDialog events for ship-build
const handleSmartDialogClose = () => {
  smartDialog.isOpen = false
}

const handleSmartDialogSubmitDefault = ({ steps }: { steps: SmartSaveStep[] }) => {
  toolbarWorkflow.runSmartSaveSteps({
    storeType: activeToolbarStoreType.value,
    steps,
    defaultEmpireName: t('menu.default_sector_name')
  })
  smartDialog.isOpen = false
}

const handleSmartDialogInvalid = (payload: { reason: 'EMPTY_NAME' }) => {
  if (payload.reason === 'EMPTY_NAME') {
    toolbarWorkflow.pushEmptyNameBlocked()
  }
}

const handleExport = () => {
  showExportWizard.value = true
}
</script>

<template>
  <div class="toolbar-panel">
    <div class="flex items-center gap-1.5 ml-4">
      <button :class="['btn-tool', themeColors.secondary]" data-testid="toolbar-new-btn" :disabled="isToolbarActionDisabled || (isLiveView && isLiveNewDisabled)" @click="handleNew">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{{ t('menu.new') }}</span>
      </button>
      <button :class="['btn-tool', themeColors.primary]" data-testid="toolbar-save-btn" :disabled="isToolbarActionDisabled" @click="handleSave">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{{ t('menu.save') }}</span>
      </button>
      <button :class="['btn-tool', themeColors.primary]" data-testid="toolbar-save-as-btn" :disabled="isToolbarActionDisabled || (isLiveView && isLiveSaveAsDisabled)" @click="handleSaveAs">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 21h10" />
          <path d="M7 3h10" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
          <rect width="20" height="20" x="2" y="2" rx="2" />
        </svg>
        <span>{{ t('menu.save_as') }}</span>
      </button>
      <button
        v-if="!isShipBuildView"
        :class="['btn-tool', themeColors.secondary]"
        data-testid="toolbar-load-btn"
        :disabled="isShipActionDisabled"
        @click="handleLoad"
      >
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('menu.load') }}</span>
      </button>
      <div v-else class="btn-tool-placeholder" aria-hidden="true">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('menu.load') }}</span>
      </div>
    </div>

    <div class="flex-1 flex justify-center">
      <TopViewSwitch v-model="shipBuildStore.activeView" />
    </div>

    <div class="flex items-center gap-2 ml-2 mr-4">
      <button class="btn-tool btn-toolbar-import" data-testid="toolbar-import-btn" @click="showImportWizard = true">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 18h8" />
          <path d="M8 14h8" />
        </svg>
        <span>{{ t('menu.import') }}</span>
      </button>
      <button class="btn-tool btn-toolbar-export" data-testid="toolbar-export-btn" @click="handleExport">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" x2="12" y1="2" y2="15" />
        </svg>
        <span>{{ t('menu.export') }}</span>
      </button>
      <button class="btn-tool btn-toolbar-version btn-version" data-testid="toolbar-version-btn" @click="showVersionSettingsModal = true">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 3h5v5" />
          <path d="M8 21H3v-5" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
          <path d="M14 21h7v-7" />
          <path d="M3 10V3h7" />
          <path d="M21 14l-7-7" />
          <path d="M10 10L3 3" />
        </svg>
        <span>{{ gameData.displayFullVersion() }}</span>
        <span
          v-if="showVersionIndicator"
          class="version-indicator"
          data-testid="toolbar-version-indicator"
        />
      </button>
      <MissingTranslate />
      <LanguageSelector />
      <SettingsButton
        :show-indicator="gameData.needsDlcSetup"
        @click="showDlcSettingsModal = true"
      />
    </div>

    <LoadBlueprintPlanModal :isOpen="showLoadBlueprintModal" @close="showLoadBlueprintModal = false" />
    <LoadLivePlanModal :isOpen="showLoadLiveModal" @close="showLoadLiveModal = false" />
    <LoadFlowPlanModal :isOpen="showLoadFlowModal" @close="showLoadFlowModal = false" />
    <LoadShipBlueprintModal :isOpen="showLoadShipBlueprintModal" @close="showLoadShipBlueprintModal = false" />
    <StorageImportWizard :isOpen="showImportWizard" @close="showImportWizard = false" />
    <StorageExportWizard :isOpen="showExportWizard" @close="showExportWizard = false" />
    <VersionSettingsModal :visible="showVersionSettingsModal" @close="showVersionSettingsModal = false" />
    <DlcSettingsModal :visible="showDlcSettingsModal" @close="showDlcSettingsModal = false" />

    <SmartSaveDialog
      :isOpen="smartDialog.isOpen"
      :intent="smartDialog.intent"
      :initialName="toolbarWorkflow.getDefaultName(activeToolbarStoreType, { selectedShip: shipBuildStore.selectedShip })"
      :storeType="activeToolbarStoreType"
      @close="handleSmartDialogClose"
      @submit-default="handleSmartDialogSubmitDefault"
      @invalid="handleSmartDialogInvalid"
    />
  </div>
</template>

<style scoped>
.btn-tool {
  @apply flex items-center gap-2 px-3 py-1.5 rounded text-white font-bold transition-all duration-200 border border-transparent select-none;
  height: 32px;
}

.btn-cyan {
  @apply bg-cyan-500 hover:bg-cyan-400 text-slate-900;
}

.btn-teal {
  @apply bg-teal-500 hover:bg-teal-400 text-slate-900;
}

.btn-fuchsia {
  @apply bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-900;
}

.btn-emerald {
  @apply bg-emerald-500 hover:bg-emerald-400 text-slate-900;
}

.btn-blue {
  @apply bg-blue-600 hover:bg-blue-500;
}

.btn-green {
  @apply bg-emerald-600 hover:bg-emerald-500;
}

.btn-purple {
  @apply bg-purple-600 hover:bg-purple-500;
}

.btn-toolbar-import {
  @apply bg-slate-700 hover:bg-slate-600 border-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)];
}

.btn-toolbar-export {
  @apply bg-slate-600 hover:bg-slate-500 border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)];
}

.btn-toolbar-version {
  @apply bg-slate-800 hover:bg-slate-700 border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)];
}

.btn-version {
  @apply relative;
}

.version-indicator {
  @apply absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full;
}

.toolbar-panel {
  @apply flex flex-wrap gap-4 justify-between items-center bg-slate-800 py-3 px-4 border-y border-slate-700 shadow-2xl rounded-none;
}

.btn-tool-placeholder {
  @apply flex items-center gap-2 px-3 py-1.5;
  height: 32px;
  visibility: hidden;
}
</style>
