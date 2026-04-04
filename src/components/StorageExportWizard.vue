<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useSaveStore } from '@/store/useSaveStore'
import {
  buildExportPayload,
  buildSaveExportData,
  getModuleImportStats,
  normalizeImportPayload,
  triggerJsonDownload,
  type ImportModuleKey
} from '@/store/logic/importExport'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const empireStore = useEmpireStore()
const gameDataStore = useGameDataStore()
const logicFlowStore = useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const saveStore = useSaveStore()

const currentVersionLabel = computed(() =>
  gameDataStore.displayFullVersion()
)

const buildDefaultFileName = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const betaSuffix = gameDataStore.isBeta ? '-beta' : ''
  return `x4-export-${gameDataStore.currentVersion}${betaSuffix}-${yyyy}${mm}${dd}-${hh}${min}.json`
}

const exportFileName = ref(buildDefaultFileName())
const moduleStats = ref<{ key: ImportModuleKey; count: number }[]>([])
const includeSaveArchives = ref(false)

watch(
  () => props.isOpen,
  async (open) => {
    if (!open) return
    exportFileName.value = buildDefaultFileName()
    includeSaveArchives.value = false
    
    const basePayload = buildExportPayload(
      empireStore.savedEmpires,
      logicFlowStore.savedPlans,
      shipBuildStore.savedBlueprints,
      gameDataStore
    )
    
    const saveExportData = await buildSaveExportData(saveStore.savedArchivesState, gameDataStore)
    
    const statsPayload = {
      ...basePayload,
      data: {
        ...basePayload.data,
        x4_save_archives: saveExportData
      } as Record<string, unknown>
    }
    moduleStats.value = getModuleImportStats(normalizeImportPayload(statsPayload))
  }
)

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
    default:
      return key
  }
}

const moduleDescription = (key: ImportModuleKey) => {
  if (key === 'x4_save_archives') {
    return t('importExport.save_module_description')
  }
  return ''
}

const handleDownload = async () => {
  const raw = exportFileName.value.trim()
  const withExt = raw ? (raw.endsWith('.json') ? raw : `${raw}.json`) : buildDefaultFileName()
  
  const basePayload = buildExportPayload(
    empireStore.savedEmpires,
    logicFlowStore.savedPlans,
    shipBuildStore.savedBlueprints,
    gameDataStore
  )

  if (includeSaveArchives.value && saveStore.savedArchivesState.list.length > 0) {
    const saveExportData = await buildSaveExportData(saveStore.savedArchivesState, gameDataStore)
    const payload = {
      ...basePayload,
      data: {
        ...basePayload.data,
        x4_save_archives: saveExportData
      }
    }
    triggerJsonDownload(withExt, payload)
  } else {
    triggerJsonDownload(withExt, basePayload)
  }

  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="storage-export-wizard">
    <div class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-lg font-bold text-white tracking-wide">{{ t('importExport.export_title') }}</h3>
        <button class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded" @click="emit('close')">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto custom-scrollbar">
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">{{ t('importExport.export_filename') }}</div>
          <input
            v-model="exportFileName"
            type="text"
            class="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900/40 text-slate-100 text-sm outline-none focus:border-slate-500"
            data-testid="storage-export-filename-input"
          />
        </div>
        <div class="rounded border border-slate-700 bg-slate-900/40 px-3 py-2">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">{{ t('importExport.current_game_version') }}</div>
          <div class="text-sm text-slate-100" data-testid="storage-export-current-version">{{ currentVersionLabel }}</div>
        </div>
        <div class="text-xs uppercase tracking-wider text-slate-400">{{ t('importExport.modules') }}</div>
        <div class="space-y-2" data-testid="storage-export-config">
          <div
            v-for="entry in moduleStats"
            :key="entry.key"
            class="flex items-center justify-between px-3 py-2 rounded border border-slate-700 bg-slate-900/40"
            :data-testid="`storage-export-module-${entry.key}`"
          >
            <div class="flex items-center gap-2">
              <input
                v-if="entry.key === 'x4_save_archives'"
                type="checkbox"
                v-model="includeSaveArchives"
                class="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <div class="flex flex-col">
                <span class="text-sm text-slate-100">{{ moduleTitle(entry.key) }}</span>
                <span v-if="moduleDescription(entry.key)" class="text-xs text-slate-500">{{ moduleDescription(entry.key) }}</span>
              </div>
            </div>
            <span class="text-xs text-slate-400">{{ t('importExport.module_count', { count: entry.count }) }}</span>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-700 bg-slate-900/30 flex justify-end gap-3">
        <button class="px-4 py-2 rounded text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition" @click="emit('close')">
          {{ t('ui.cancel') }}
        </button>
        <button
          class="px-5 py-2 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition inline-flex items-center gap-2"
          data-testid="storage-export-download-btn"
          @click="handleDownload"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M4 19h16" />
          </svg>
          <span>{{ t('importExport.action_download') }}</span>
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
  background: rgba(100, 116, 139, 0.7);
  border-radius: 3px;
}
</style>
