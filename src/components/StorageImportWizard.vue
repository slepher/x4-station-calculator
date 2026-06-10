<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useStatusStore } from '@/store/useStatusStore'
import { useBuildPlanStore } from '@/store/useBuildPlanStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import {
  applyImportPayload,
  normalizeImportPayload,
  prepareImportPayload,
  type ImportModuleKey,
  type ImportSanitizeSummary,
  type ModuleImportStats,
  type NormalizedImportPayload,
  type PreparedImportPayload
} from '@/store/logic/importExport'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const blueprintStore = useBlueprintProductionStore()
const gameDataStore = useGameDataStore()
const logicFlowStore = useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()
const statusStore = useStatusStore()
const buildPlanStore = useBuildPlanStore()
const terraformingStore = useTerraformingStore()

const fileName = ref('')
const parseError = ref('')
const parsedPayload = ref<NormalizedImportPayload | null>(null)
const preparedPayload = ref<PreparedImportPayload | null>(null)
const moduleStats = ref<ModuleImportStats[]>([])
const mode = ref<'overwrite' | 'incremental'>('overwrite')
const selectedModules = ref<Record<ImportModuleKey, boolean>>({
  x4_empire_data: false,
  x4_logic_flow_plans: false,
  x4_ship_blueprints: false,
  x4_save_archives: false,
  x4_save_bindings: false,
  x4_build_plan_goals: false,
  x4_terraforming_data: false
})

const hasParsedPayload = computed(() => parsedPayload.value !== null)
const allModuleKeys: ImportModuleKey[] = ['x4_empire_data', 'x4_logic_flow_plans', 'x4_ship_blueprints', 'x4_save_archives', 'x4_save_bindings', 'x4_build_plan_goals', 'x4_terraforming_data']

const displayModules = computed(() => {
  const countMap = new Map(moduleStats.value.map(s => [s.key, s.count]))
  return allModuleKeys.map(key => ({
    key,
    count: countMap.get(key) ?? 0,
    inPayload: countMap.has(key)
  }))
})

const versionState = computed(() => preparedPayload.value?.versionState || null)
const sanitizeSummaries = computed(() => preparedPayload.value?.sanitizeSummaries || [])

const setDefaultSelections = (selectAll: boolean) => {
  allModuleKeys.forEach((key) => {
    selectedModules.value[key] = selectAll
  })
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    fileName.value = ''
    parseError.value = ''
    parsedPayload.value = null
    preparedPayload.value = null
    moduleStats.value = []
    mode.value = 'overwrite'
    selectedModules.value = {
      x4_empire_data: false,
      x4_logic_flow_plans: false,
      x4_ship_blueprints: false,
      x4_save_archives: false,
      x4_save_bindings: false,
      x4_build_plan_goals: false,
      x4_terraforming_data: false
    }
  }
)

watch(mode, (nextMode) => {
  if (!parsedPayload.value) return
  if (nextMode === 'overwrite') {
    setDefaultSelections(true)
  }
})

const moduleTitle = (key: ImportModuleKey) => {
  switch (key) {
    case 'x4_empire_data':
      return t('moduleNames.sector')
    case 'x4_logic_flow_plans':
      return t('moduleNames.flow')
    case 'x4_ship_blueprints':
      return t('moduleNames.ship')
    case 'x4_save_archives':
      return t('moduleNames.save')
    case 'x4_save_bindings':
      return t('moduleNames.save_binding')
    case 'x4_build_plan_goals':
      return t('moduleNames.build_plan')
    case 'x4_terraforming_data':
      return t('moduleNames.terraforming', 'Terraforming')
    default:
      return key
  }
}

const summaryText = (summary: ImportSanitizeSummary) => {
  const detailText = summary.details
    .map((detail) => t(`importExport.sanitize_kind_${detail.kind}`, { count: detail.count }))
    .join(t('importExport.sanitize_joiner'))

  return t('importExport.sanitize_summary_line', {
    module: moduleTitle(summary.key),
    details: detailText
  })
}

const onPickFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  parseError.value = ''

  try {
    const rawText = await file.text()
    const raw = JSON.parse(rawText)
    const normalized = normalizeImportPayload(raw)
    const prepared = prepareImportPayload(normalized, gameDataStore, shipBuildStore)
    const stats = prepared.moduleStats

    if (stats.length === 0) {
      parseError.value = t('importExport.error_no_module')
      parsedPayload.value = null
      preparedPayload.value = null
      moduleStats.value = []
      return
    }

    parsedPayload.value = normalized
    preparedPayload.value = prepared
    moduleStats.value = stats
    setDefaultSelections(true)
  } catch (error) {
    parseError.value = t('importExport.error_parse_failed')
    parsedPayload.value = null
    preparedPayload.value = null
    moduleStats.value = []
  }
}

const handleApplyImport = async () => {
  if (!parsedPayload.value || !preparedPayload.value) return

  try {
    const result = await applyImportPayload({
      mode: mode.value,
      selectedModules: selectedModules.value,
      currentView: shipBuildStore.activeView,
      payload: parsedPayload.value,
      preparedPayload: preparedPayload.value,
      gameDataStore,
      blueprintStore,
      logicFlowStore,
      shipBuildStore,
      saveStore,
      saveBindingStore,
      buildPlanStore,
      terraformingStore
    })

    if (result.applied.length === 0) {
      statusStore.pushMessage('warning', 'system', t('importExport.error_no_selection'))
      return
    }

    const warningLines = [...result.warnings]
    if (result.sanitizeSummaries.length > 0) {
      warningLines.push(...result.sanitizeSummaries.map(summaryText))
    }

    if (warningLines.length > 0) {
      statusStore.pushMessage('warning', 'system', warningLines.join(' '))
    }

    statusStore.pushMessage('success', 'system', t('importExport.import_success', { count: result.applied.length }))
    window.location.reload()
  } catch (error) {
    statusStore.pushMessage('error', 'system', t('importExport.error_apply_failed'))
    console.error('[StorageImportWizard] apply failed:', error)
  }
}

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="storage-import-wizard">
    <div class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-lg font-bold text-white tracking-wide">{{ t('importExport.title') }}</h3>
        <button class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded" @click="emit('close')">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto custom-scrollbar">
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">{{ t('importExport.upload') }}</div>
          <label class="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-slate-700 rounded cursor-pointer hover:border-slate-500 transition">
            <input
              type="file"
              class="hidden"
              accept="application/json,.json"
              data-testid="storage-import-file-input"
              @change="onPickFile"
            />
            <span class="text-sm font-bold text-slate-100">{{ t('importExport.select_file') }}</span>
            <span class="text-xs text-slate-400 truncate">{{ fileName || t('importExport.no_file') }}</span>
          </label>
          <p v-if="parseError" class="text-red-300 text-sm mt-2" data-testid="storage-import-parse-error">{{ parseError }}</p>
        </div>

        <div v-if="hasParsedPayload" class="space-y-4" data-testid="storage-import-config">
          <div class="space-y-2 rounded border border-slate-700 bg-slate-900/40 px-3 py-3">
            <div class="flex items-center justify-between gap-4 text-sm">
              <span class="text-slate-400">{{ t('importExport.file_game_version') }}</span>
              <span class="text-slate-100" data-testid="storage-import-file-version">
                {{ versionState ? gameDataStore.displayFullVersion(versionState.file.game_vsn, versionState.file.beta, false) : '' }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-4 text-sm">
              <span class="text-slate-400">{{ t('importExport.current_game_version') }}</span>
              <span class="text-slate-100" data-testid="storage-import-current-version">
                {{ versionState ? gameDataStore.displayFullVersion(versionState.current.game_vsn, versionState.current.beta, false) : '' }}
              </span>
            </div>
            <p
              v-if="versionState?.mismatch"
              class="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
              data-testid="storage-import-version-warning"
            >
              {{ t('importExport.version_mismatch') }}
            </p>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">{{ t('importExport.mode') }}</div>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded text-xs font-bold transition"
                :class="mode === 'overwrite' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
                data-testid="storage-import-mode-overwrite"
                @click="mode = 'overwrite'"
              >
                {{ t('importExport.mode_overwrite') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded text-xs font-bold transition"
                :class="mode === 'incremental' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
                data-testid="storage-import-mode-incremental"
                @click="mode = 'incremental'"
              >
                {{ t('importExport.mode_incremental') }}
              </button>
            </div>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">{{ t('importExport.modules') }}</div>
            <div class="space-y-2">
              <label
                v-for="entry in displayModules"
                :key="entry.key"
                class="flex items-center justify-between px-3 py-2 rounded border border-slate-700 bg-slate-900/40"
                :data-testid="`storage-import-module-${entry.key}`"
              >
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="selectedModules[entry.key]"
                    @change="selectedModules[entry.key] = !selectedModules[entry.key]"
                  />
                  <span class="text-sm text-slate-100">{{ moduleTitle(entry.key) }}</span>
                </div>
                <span class="text-xs text-slate-400">{{ t('importExport.module_count', { count: entry.count }) }}</span>
              </label>
            </div>
          </div>

          <div v-if="sanitizeSummaries.length > 0" class="space-y-2">
            <div class="text-xs uppercase tracking-wider text-slate-400">{{ t('importExport.sanitize_summary_title') }}</div>
            <div class="space-y-2">
              <div
                v-for="summary in sanitizeSummaries"
                :key="summary.key"
                class="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                :data-testid="`storage-import-sanitize-${summary.key}`"
              >
                {{ summaryText(summary) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-700 bg-slate-900/30 flex justify-end gap-3">
        <button class="px-4 py-2 rounded text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition" @click="emit('close')">
          {{ t('ui.cancel') }}
        </button>
        <button
          class="px-5 py-2 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!hasParsedPayload"
          data-testid="storage-import-apply-btn"
          @click="handleApplyImport"
        >
          {{ t('importExport.action_apply') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
