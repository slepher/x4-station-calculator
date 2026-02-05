<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useStationStore, type SavedModule } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
const { translateModule } = useX4I18n()

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const store = useStationStore()

const formatDate = (ts: number) => new Date(ts).toLocaleString()

const handleLoad = (index: number) => {
  store.loadLayout(index)
  emit('close')
}

const handleMerge = (index: number) => {
  store.mergeLayout(index)
  emit('close')
}

const getLayoutDescription = (modules: SavedModule[]) => {
  return [...modules]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(m => {
      const info = store.modules[m.id];
      return `${m.count} x ${info ? translateModule(info) : m.id}`;
    })
    .join(', ') + (modules.length > 3 ? '...' : '');
}

const handleDelete = (index: number) => {
  if (confirm(t('ui.confirm_delete_layout') || 'Are you sure you want to delete this layout?')) {
    store.deleteLayout(index)
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div
      class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">

      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {{ t('ui.load_layout') || 'Load Layout' }}
        </h3>
        <button @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <div v-if="store.savedLayouts.list.length === 0" class="text-center py-12 text-slate-500 italic">
          {{ t('ui.no_saved_layouts') || 'No saved layouts found.' }}
        </div>

        <div v-for="(layout, index) in store.savedLayouts.list" :key="layout.id"
          class="group bg-slate-700/40 border border-slate-600/50 rounded-md p-4 hover:border-cyan-500/50 hover:bg-slate-700/60 transition-all duration-200">
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="font-bold text-lg text-cyan-100 mb-1 group-hover:text-cyan-400 transition-colors">{{
                layout.name }}</div>
              <div class="text-xs text-slate-500 font-mono">{{ formatDate(layout.lastUpdated) }}</div>
            </div>
          </div>

          <div
            class="text-sm text-slate-300 mb-4 line-clamp-2 leading-relaxed bg-slate-800/50 p-2 rounded border border-slate-700/50">
            {{ getLayoutDescription(layout.modules) }}
          </div>

          <div class="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <button @click="handleLoad(index)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {{ t('ui.action_load') || 'Load' }}
            </button>

            <div class="w-px h-4 bg-slate-600"></div>

            <button @click="handleMerge(index)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {{ t('ui.action_merge') || 'Add Modules' }}
            </button>

            <div class="flex-1"></div>

            <button @click="handleDelete(index)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              {{ t('ui.action_delete') || 'Delete' }}
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