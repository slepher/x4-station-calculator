<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useX4I18n } from '@/utils/UseX4I18n'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const gameData = useGameDataStore()
const empireStore = useEmpireStore()
const logicFlowStore = useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const { translateShip } = useX4I18n()

type VersionOption = {
  version: string
  codename: string
  beta: boolean
  label: string
}

type DirtyModuleKey = 'empire' | 'logic_flow' | 'ship_blueprints'

type DirtyModuleOption = {
  key: DirtyModuleKey
  label: string
  isDirty: boolean
  isNew: boolean
  defaultName: string
}

const selectedVersionKey = ref('')
const selectedModuleKeys = ref<DirtyModuleKey[]>([])
const moduleNames = ref<Record<DirtyModuleKey, string>>({
  empire: '',
  logic_flow: '',
  ship_blueprints: ''
})

const versionOptions = computed<VersionOption[]>(() => gameData.versionOptions)

const toVersionKey = (option: Pick<VersionOption, 'version' | 'beta'>) =>
  `${option.version}::${option.beta ? 'beta' : 'stable'}`

const selectedOption = computed(() =>
  versionOptions.value.find(option => toVersionKey(option) === selectedVersionKey.value) || null
)

const getDefaultName = (key: DirtyModuleKey): string => {
  if (key === 'logic_flow') return t('menu.default_flow_name')
  if (key === 'ship_blueprints') {
    const ship = shipBuildStore.selectedShip
    const shipName = ship ? translateShip(ship) : ''
    return shipName ? `${shipName} ${t('menu.blueprint')}` : t('menu.default_blueprint_name')
  }
  return t('sector.new_sector_name')
}

const dirtyModules = computed<DirtyModuleOption[]>(() => {
  const modules: DirtyModuleOption[] = [
    {
      key: 'empire',
      label: t('settings.gameVersion.moduleEmpire'),
      isDirty: empireStore.isDirty,
      isNew: empireStore.requiresSaveAsOnSave(),
      defaultName: getDefaultName('empire')
    },
    {
      key: 'logic_flow',
      label: t('settings.gameVersion.moduleLogicFlow'),
      isDirty: logicFlowStore.isDirty,
      isNew: logicFlowStore.requiresSaveAsOnSave(),
      defaultName: getDefaultName('logic_flow')
    },
    {
      key: 'ship_blueprints',
      label: t('settings.gameVersion.moduleShipBlueprints'),
      isDirty: shipBuildStore.isDirty,
      isNew: shipBuildStore.requiresSaveAsOnSave(),
      defaultName: getDefaultName('ship_blueprints')
    }
  ]
  return modules.filter(module => module.isDirty)
})

const selectedModules = computed(() =>
  dirtyModules.value.filter(module => selectedModuleKeys.value.includes(module.key))
)

const selectedNewModules = computed(() =>
  selectedModules.value.filter(module => module.isNew)
)

const hasSelectedModules = computed(() => selectedModules.value.length > 0)
const isSameVersionSelection = computed(() => {
  if (!selectedOption.value) return false
  return selectedOption.value.version === gameData.currentVersion && selectedOption.value.beta === gameData.isBeta
})
const shouldPersistCurrentVersion = computed(() => isSameVersionSelection.value && !gameData.hasStoredVersion)
const isSwitchDisabled = computed(() => isSameVersionSelection.value && gameData.hasStoredVersion)
const shouldShowDirtyModules = computed(() => !isSameVersionSelection.value && dirtyModules.value.length > 0)

const isAllSelected = computed({
  get: () => dirtyModules.value.length > 0 && selectedModuleKeys.value.length === dirtyModules.value.length,
  set: (checked: boolean) => {
    selectedModuleKeys.value = checked ? dirtyModules.value.map(module => module.key) : []
  }
})

const canSaveAndSwitch = computed(() =>
  selectedNewModules.value.every(module => moduleNames.value[module.key].trim().length > 0)
)

// Initialize from current state
watch(() => props.visible, (visible) => {
  if (visible) {
    selectedVersionKey.value = toVersionKey({
      version: gameData.currentVersion,
      beta: gameData.isBeta
    })
    selectedModuleKeys.value = []
    moduleNames.value = {
      empire: getDefaultName('empire'),
      logic_flow: getDefaultName('logic_flow'),
      ship_blueprints: getDefaultName('ship_blueprints')
    }
  }
}, { immediate: true })

watch(isSameVersionSelection, (isSame) => {
  if (isSame) {
    selectedModuleKeys.value = []
  }
})

const handleClose = () => {
  emit('close')
}

const handleSwitch = async () => {
  if (!selectedOption.value) return
  if (isSwitchDisabled.value) return
  if (shouldPersistCurrentVersion.value) {
    gameData.persistVersionSelection(selectedOption.value.version, selectedOption.value.beta)
    emit('close')
    return
  }
  await gameData.setVersion(selectedOption.value.version, selectedOption.value.beta)
  emit('close')
}

const saveSelectedModules = () => {
  selectedModules.value.forEach((module) => {
    const inputName = moduleNames.value[module.key].trim()
    if (module.key === 'empire') {
      if (module.isNew) empireStore.saveEmpireAs(inputName)
      else empireStore.saveEmpire()
      return
    }
    if (module.key === 'logic_flow') {
      if (module.isNew) logicFlowStore.saveCurrentPlanAs(inputName)
      else logicFlowStore.saveCurrentPlan()
      return
    }
    if (module.isNew) shipBuildStore.saveAsBlueprint(inputName)
    else shipBuildStore.saveBlueprint()
  })
}

const handleSaveAndSwitch = async () => {
  if (!hasSelectedModules.value || !canSaveAndSwitch.value) return
  saveSelectedModules()
  await handleSwitch()
}

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-backdrop"
      data-testid="version-settings-modal-backdrop"
      @click="handleBackdropClick"
    >
      <div class="modal-content" data-testid="version-settings-modal">
        <div class="modal-header">
          <h3 class="modal-title">{{ t('settings.gameVersion.title') }}</h3>
          <button
            type="button"
            class="modal-close"
            data-testid="version-settings-close"
            @click="handleClose"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <label class="form-label">
            {{ t('settings.gameVersion.select') }}
          </label>
          <select
            v-model="selectedVersionKey"
            class="version-select"
            data-testid="version-select"
          >
            <option
              v-for="option in versionOptions"
              :key="`${option.version}-${option.beta}`"
              :value="toVersionKey(option)"
            >
              {{ option.label }}
            </option>
          </select>

          <div
            v-if="shouldShowDirtyModules"
            class="unsaved-module-panel"
            data-testid="unsaved-modules-panel"
          >
            <div class="unsaved-module-header">
              <span class="unsaved-module-title">{{ t('settings.gameVersion.unsavedModules') }}</span>
              <label class="unsaved-module-check">
                <input
                  v-model="isAllSelected"
                  type="checkbox"
                  data-testid="unsaved-select-all"
                >
                <span>{{ t('settings.gameVersion.selectAll') }}</span>
              </label>
            </div>

            <p class="unsaved-module-warning">{{ t('settings.gameVersion.saveScopeWarning') }}</p>

            <label
              v-for="module in dirtyModules"
              :key="module.key"
              class="unsaved-module-check"
            >
              <input
                v-model="selectedModuleKeys"
                :value="module.key"
                type="checkbox"
                :data-testid="`unsaved-module-${module.key}`"
              >
              <span>{{ module.label }}</span>
            </label>

            <div
              v-for="module in selectedNewModules"
              :key="`${module.key}-name`"
              class="module-name-block"
            >
              <label
                class="form-label"
                :for="`module-name-${module.key}`"
              >
                {{ module.label }} {{ t('settings.gameVersion.moduleNameLabel') }}
              </label>
              <input
                :id="`module-name-${module.key}`"
                v-model="moduleNames[module.key]"
                type="text"
                class="module-name-input"
                :placeholder="t('menu.placeholder_enter_name')"
                :data-testid="`module-name-${module.key}`"
              >
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-testid="version-settings-cancel"
            @click="handleClose"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            v-if="!hasSelectedModules"
            type="button"
            class="btn btn-primary"
            data-testid="version-switch"
            :disabled="isSwitchDisabled"
            @click="handleSwitch"
          >
            {{ t('settings.gameVersion.switch') }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            data-testid="version-save-switch"
            :disabled="!canSaveAndSwitch"
            @click="handleSaveAndSwitch"
          >
            {{ t('settings.gameVersion.saveAndSwitch') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 border border-slate-700;
}

.modal-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.modal-title {
  @apply text-lg font-medium text-slate-100;
}

.modal-close {
  @apply text-slate-400 hover:text-slate-200 transition-colors;
}

.modal-body {
  @apply p-4;
}

.form-label {
  @apply block text-sm text-slate-300 mb-2;
}

.version-select {
  @apply w-full bg-slate-900 border border-slate-600 text-slate-200 rounded px-3 py-2 focus:border-sky-500 outline-none;
}

.modal-footer {
  @apply flex justify-end gap-2 p-4 border-t border-slate-700;
}

.unsaved-module-panel {
  @apply mt-4 rounded border border-red-500/50 bg-red-950/20 p-3;
}

.unsaved-module-header {
  @apply flex items-center justify-between gap-3;
}

.unsaved-module-title {
  @apply text-sm font-medium text-red-100;
}

.unsaved-module-warning {
  @apply mt-2 text-xs text-red-200;
}

.unsaved-module-check {
  @apply mt-3 flex items-center gap-2 text-sm text-slate-200;
}

.module-name-block {
  @apply mt-3;
}

.module-name-input {
  @apply w-full bg-slate-900 border border-slate-600 text-slate-200 rounded px-3 py-2 focus:border-sky-500 outline-none;
}

.btn {
  @apply px-4 py-2 rounded text-sm font-medium transition-colors;
}

.btn-secondary {
  @apply bg-slate-700 text-slate-200 hover:bg-slate-600;
}

.btn-primary {
  @apply bg-sky-600 text-white hover:bg-sky-500;
}

.btn-primary:disabled {
  @apply cursor-not-allowed bg-slate-600 text-slate-300 hover:bg-slate-600;
}
</style>
