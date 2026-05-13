<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const saveBindingStore = useSaveBindingStore()
const saveStore = useSaveStore()
const activeViewStore = useActiveViewStore()
const liveStore = useLiveProductionStore()

const formatDate = (ts: number) => new Date(ts).toLocaleString()

function bindingHasValidArchive(gameGuid: string): boolean {
  const group = saveStore.archives.get(gameGuid)
  return group?.saves.some(s => s.isValid) ?? false
}

const handleLoadBinding = async (gameGuid: string) => {
  if (!bindingHasValidArchive(gameGuid)) return
  await liveStore.activateBinding(gameGuid)
  emit('close')
}

const handleDeleteBinding = (gameGuid: string) => {
  if (confirm(t('planning.confirm_delete_binding'))) {
    const idx = saveBindingStore.savedBindings.list.findIndex(b => b.gameGuid === gameGuid)
    if (idx >= 0) {
      saveBindingStore.savedBindings.list.splice(idx, 1)
      saveBindingStore.writeState()
      if (saveBindingStore.activeGameGuid === gameGuid) {
        activeViewStore.activeBinding = null
        activeViewStore.activeBindingStation = null
        saveBindingStore.clearDraft()
      }
    }
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="dialog-backdrop">
    <div
      class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">

      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {{ t('planning.load_live') }}
        </h3>
        <button @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <div v-if="saveBindingStore.savedBindings.list.length === 0" class="text-center py-12 text-slate-500 italic">
          {{ t('planning.no_saved_bindings') }}
        </div>

        <div v-for="binding in saveBindingStore.savedBindings.list" :key="binding.gameGuid"
          class="group bg-slate-700/40 border border-slate-600/50 rounded-md p-4 hover:border-cyan-500/50 hover:bg-slate-700/60 transition-all duration-200">
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">🎮</span>
              <div>
                <div class="font-bold text-lg text-cyan-100 mb-1 group-hover:text-cyan-400 transition-colors">
                  {{ binding.bindingName || binding.gameGuid.slice(0, 8) }}
                  <span v-if="!bindingHasValidArchive(binding.gameGuid)"
                    class="text-red-400 text-sm font-normal ml-1">[{{ t('planning.archive_invalid') }}]</span>
                </div>
                <div class="text-xs text-slate-500 font-mono">{{ formatDate(binding.updatedAt) }}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <div class="text-xs text-slate-400 bg-slate-600/50 px-2 py-1 rounded">
                {{ binding.groups.length }} {{ t('planning.groups_count') }}
              </div>
              <div class="text-xs text-slate-400 bg-slate-600/50 px-2 py-1 rounded">
                {{ binding.stationPlans.length }} {{ t('sector.stations_count') }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <button @click="handleLoadBinding(binding.gameGuid)"
              :disabled="!bindingHasValidArchive(binding.gameGuid)"
              :class="[
                'flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded transition px-3 py-1.5',
                bindingHasValidArchive(binding.gameGuid)
                  ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30'
                  : 'text-slate-600 cursor-not-allowed'
              ]">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {{ t('planning.action_load_binding') }}
            </button>

            <div class="flex-1"></div>

            <button @click="handleDeleteBinding(binding.gameGuid)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              {{ t('planning.action_delete') }}
            </button>
          </div>
        </div>
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

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
