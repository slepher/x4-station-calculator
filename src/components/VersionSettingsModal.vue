<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useBuildPlanStore } from '@/store/useBuildPlanStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { buildExportPayload, buildSaveExportData, triggerJsonDownload, normalizeImportPayload, prepareImportPayload, applyImportPayload } from '@/store/logic/importExport'
import { clearLegacySaveDB, deleteCurrentArchiveDB } from '@/db/saveArchiveDB'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const gameData = useGameDataStore()
const blueprintStore = useBlueprintProductionStore()
const logicFlowStore = useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()
const buildPlanStore = useBuildPlanStore()
const terraformingStore = useTerraformingStore()
const { translateShip } = useX4I18n()

const migrateConfirmOpen = ref(false)
const migrateConfirmCounts = ref<{ beta: Record<string, number>; stable: Record<string, number> }>({ beta: {}, stable: {} })

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
const showAllBeta = ref(gameData.hasStableCounterpart)
const selectedModuleKeys = ref<DirtyModuleKey[]>([])
const moduleNames = ref<Record<DirtyModuleKey, string>>({
  empire: '',
  logic_flow: '',
  ship_blueprints: ''
})

const versionOptions = computed<VersionOption[]>(() => gameData.versionOptions)

const hasStableOption = (option: VersionOption) =>
  option.beta && versionOptions.value.some(o => o.version === option.version && !o.beta)

const filteredVersionOptions = computed<VersionOption[]>(() =>
  showAllBeta.value
    ? versionOptions.value
    : versionOptions.value.filter(o => !o.beta || !hasStableOption(o))
)

const toVersionKey = (option: Pick<VersionOption, 'version' | 'beta'>) =>
  `${option.version}::${option.beta ? 'beta' : 'stable'}`

const selectedOption = computed(() =>
  filteredVersionOptions.value.find(option => toVersionKey(option) === selectedVersionKey.value) || null
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
      label: t('moduleNames.sector'),
      isDirty: blueprintStore.isDirty,
      isNew: blueprintStore.requiresSaveAsOnSave(),
      defaultName: getDefaultName('empire')
    },
    {
      key: 'logic_flow',
      label: t('moduleNames.flow'),
      isDirty: logicFlowStore.isDirty,
      isNew: logicFlowStore.requiresSaveAsOnSave(),
      defaultName: getDefaultName('logic_flow')
    },
    {
      key: 'ship_blueprints',
      label: t('moduleNames.ship'),
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
const switchButtonLabel = computed(() =>
  shouldPersistCurrentVersion.value ? t('settings.gameVersion.save') : t('settings.gameVersion.switch')
)

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

watch(showAllBeta, (show) => {
  if (!show && !selectedOption.value) {
    const firstStable = filteredVersionOptions.value[0]
    if (firstStable) {
      selectedVersionKey.value = toVersionKey(firstStable)
    }
  }
})

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
      if (module.isNew) blueprintStore.saveEmpireAs(inputName)
      else blueprintStore.saveEmpire()
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

const handleDownloadAndClean = async () => {
  terraformingStore.init()
  const basePayload = buildExportPayload(
    blueprintStore.savedEmpires,
    logicFlowStore.savedPlans,
    shipBuildStore.savedBlueprints,
    gameData,
    saveBindingStore.savedBindings,
    buildPlanStore.savedPlans,
    terraformingStore.savedPlans
  )

  let payload: Record<string, unknown>
  if (saveStore.savedArchivesState.list.length > 0) {
    const saveExportData = await buildSaveExportData(saveStore.savedArchivesState, gameData)
    payload = {
      ...basePayload,
      data: { ...basePayload.data, x4_save_archives: saveExportData }
    } as Record<string, unknown>
  } else {
    payload = basePayload as Record<string, unknown>
  }

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const fileName = `x4-export-${gameData.currentVersion}-beta-${yyyy}${mm}${dd}-${hh}${min}.json`
  triggerJsonDownload(fileName, payload)

  for (const module of ['empire', 'logic_flow', 'ship_blueprints', 'setting', 'save_archives', 'build_plan_goals', 'terraforming'] as const) {
    localStorage.removeItem(gameData.getStorageKey(module))
  }
  const saveBindingsKey = gameData.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
  localStorage.removeItem(saveBindingsKey)
  localStorage.removeItem('x4_game_version')
  await deleteCurrentArchiveDB(gameData)
  await clearLegacySaveDB()
  gameData.setVersion(gameData.currentVersion, false)
}

const handleMigrate = async () => {
  terraformingStore.init()

  const stableConfig = gameData.versionsConfig.find(v => v.version === gameData.currentVersion && !v.beta)
  if (!stableConfig) return

  const counts = checkStableCounts(stableConfig)
  if (Object.values(counts.stable).some(c => c > 0)) {
    migrateConfirmCounts.value = counts
    migrateConfirmOpen.value = true
    return
  }

  await doMigrate(stableConfig)
}

const checkStableCounts = (stableConfig: typeof gameData.versionsConfig[number]) => {
  const moduleLabels: Record<string, string> = {
    empire: t('moduleNames.sector'),
    flow: t('moduleNames.flow'),
    ship: t('moduleNames.ship'),
    save_archives: t('moduleNames.save'),
    save_bindings: t('moduleNames.save_binding'),
    build_plan_goals: t('moduleNames.build_plan'),
    terraforming: t('moduleNames.terraforming', 'Terraforming')
  }

  const beta: Record<string, number> = {}
  const stable: Record<string, number> = {}

  const countList = (key: string): number => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return 0
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed?.list) ? parsed.list.length : 0
    } catch { return 0 }
  }

  const stableKeys = stableConfig.storage_keys as Record<string, string>

  for (const m of ['empire', 'logic_flow', 'ship_blueprints', 'save_archives', 'build_plan_goals', 'terraforming'] as const) {
    const label = moduleLabels[m] || m
    beta[label] = countList(gameData.getStorageKey(m))
    stable[label] = countList(stableKeys[m] as string)
  }

  const betaSaveBindingsKey = gameData.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
  const stableSaveBindingsKey = stableConfig.storage_keys.save_archives.replace('save_archives', 'save_bindings')
  const saveBindingsLabel = moduleLabels.save_bindings as string
  beta[saveBindingsLabel] = countList(betaSaveBindingsKey)
  stable[saveBindingsLabel] = countList(stableSaveBindingsKey)

  return { beta, stable }
}

const confirmMigrate = async () => {
  migrateConfirmOpen.value = false
  const stableConfig = gameData.versionsConfig.find(v => v.version === gameData.currentVersion && !v.beta)
  if (!stableConfig) return
  try {
    await doMigrate(stableConfig)
  } catch (e) {
    console.error('[VersionSettingsModal] migrate failed:', e)
  }
}

const cancelMigrate = () => {
  migrateConfirmOpen.value = false
}

const doMigrate = async (stableConfig: typeof gameData.versionsConfig[number]) => {
  const basePayload = buildExportPayload(
    blueprintStore.savedEmpires,
    logicFlowStore.savedPlans,
    shipBuildStore.savedBlueprints,
    gameData,
    saveBindingStore.savedBindings,
    buildPlanStore.savedPlans,
    terraformingStore.savedPlans
  )

  const saveExportData = await buildSaveExportData(saveStore.savedArchivesState, gameData)
  const fullPayload = {
    ...basePayload,
    data: { ...basePayload.data, x4_save_archives: saveExportData }
  }

  const stableGameDataStore = {
    modulesMap: gameData.modulesMap,
    modulesByMacroId: gameData.modulesByMacroId,
    maps: gameData.maps,
    ships: gameData.ships,
    equipments: gameData.equipments,
    currentVersion: stableConfig.version,
    isBeta: false,
    getStorageKey: (module: string) => (stableConfig.storage_keys as Record<string, string>)[module] ?? `x4_${module}`,
    getIndexedDBName: () => stableConfig.indexeddb_name ?? 'x4_save_archive_db'
  }

  const normalized = normalizeImportPayload(fullPayload)
  const prepared = prepareImportPayload(normalized, stableGameDataStore, shipBuildStore)

  await applyImportPayload({
    mode: 'overwrite',
    selectedModules: Object.fromEntries(prepared.moduleStats.map(s => [s.key, true])),
    currentView: shipBuildStore.activeView,
    payload: normalized,
    preparedPayload: prepared,
    gameDataStore: stableGameDataStore,
    blueprintStore,
    logicFlowStore,
    shipBuildStore,
    saveStore,
    saveBindingStore,
    buildPlanStore,
    terraformingStore
  })

  for (const module of ['empire', 'logic_flow', 'ship_blueprints', 'setting', 'save_archives', 'build_plan_goals', 'terraforming'] as const) {
    localStorage.removeItem(gameData.getStorageKey(module))
  }
  const betaSaveBindingsKey = gameData.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
  localStorage.removeItem(betaSaveBindingsKey)
  localStorage.removeItem('x4_game_version')
  await deleteCurrentArchiveDB(gameData)
  await clearLegacySaveDB()
  gameData.setVersion(gameData.currentVersion, false)
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
              v-for="option in filteredVersionOptions"
              :key="`${option.version}-${option.beta}`"
              :value="toVersionKey(option)"
            >
              {{ option.label }}
            </option>
          </select>
          <label class="hide-beta-check">
            <input
              v-model="showAllBeta"
              type="checkbox"
              data-testid="hide-beta-checkbox"
            >
            <span>{{ t('settings.gameVersion.showAllBeta') }}</span>
          </label>
          <p class="data-isolation-hint">{{ t('settings.gameVersion.dataIsolationHint') }}</p>
          <p
            v-if="gameData.hasStableCounterpart"
            class="beta-migration-hint"
          >
            {{ t('settings.gameVersion.betaMigrationHint') }}
          </p>

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
            v-if="gameData.hasStableCounterpart"
            v-tippy="{ content: t('settings.gameVersion.downloadAndCleanTooltip'), allowHTML: false, placement: 'top', theme: 'material' }"
            type="button"
            class="btn btn-amber"
            data-testid="version-download-clean"
            @click="handleDownloadAndClean"
          >
            {{ t('settings.gameVersion.downloadAndClean') }}
          </button>
          <button
            v-if="gameData.hasStableCounterpart"
            v-tippy="{ content: t('settings.gameVersion.migrateTooltip'), allowHTML: false, placement: 'top', theme: 'material' }"
            type="button"
            class="btn btn-amber"
            data-testid="version-migrate"
            @click="handleMigrate"
          >
            {{ t('settings.gameVersion.migrate') }}
          </button>
          <button
            v-if="!hasSelectedModules"
            type="button"
            class="btn btn-primary"
            data-testid="version-switch"
            :disabled="isSwitchDisabled"
            @click="handleSwitch"
          >
            {{ switchButtonLabel }}
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

    <div v-if="migrateConfirmOpen" class="modal-backdrop" @click="cancelMigrate">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">{{ t('settings.gameVersion.migrateConfirmTitle') }}</h3>
        </div>
        <div class="modal-body">
          <p class="mb-3 text-sm text-slate-300">{{ t('settings.gameVersion.migrateConfirmHint') }}</p>
          <table class="migrate-counts-table">
            <thead>
              <tr>
                <th></th>
                <th>{{ t('settings.gameVersion.migrateBetaColumn') }}</th>
                <th>{{ t('settings.gameVersion.migrateStableColumn') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(stableCount, label) in migrateConfirmCounts.stable" :key="label">
                <td class="text-slate-300">{{ label }}</td>
                <td>{{ migrateConfirmCounts.beta[label] || 0 }}</td>
                <td>{{ stableCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="cancelMigrate">{{ t('ui.cancel') }}</button>
          <button class="btn btn-primary" @click="confirmMigrate">{{ t('settings.gameVersion.migrateConfirm') }}</button>
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

.data-isolation-hint {
  @apply mt-2 text-xs text-slate-400;
}

.beta-migration-hint {
  @apply mt-2 text-xs text-amber-300;
}

.hide-beta-check {
  @apply mt-2 flex items-center gap-2 text-xs text-slate-400 cursor-pointer;
}

.hide-beta-check input[type="checkbox"] {
  @apply accent-sky-500 w-4 h-4;
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

.btn-amber {
  @apply bg-amber-600 text-white hover:bg-amber-500;
}

.migrate-counts-table {
  @apply w-full text-sm border-collapse;
}

.migrate-counts-table th,
.migrate-counts-table td {
  @apply px-3 py-1.5 text-left border-b border-slate-700;
}

.migrate-counts-table th {
  @apply text-slate-400 font-medium text-xs uppercase;
}

.migrate-counts-table td {
  @apply text-slate-200;
}
</style>
