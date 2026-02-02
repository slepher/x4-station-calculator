<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStationStore } from '@/store/useStationStore'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const store = useStationStore()

const importContent = ref('')
const hasError = ref(false)

const handleImport = () => {
  if (!importContent.value.trim()) return
  
  try {
    store.importPlan(importContent.value)
    importContent.value = ''
    hasError.value = false
    emit('close')
  } catch (e) {
    console.error(e)
    hasError.value = true
  }
}

const handleClose = () => {
  importContent.value = ''
  hasError.value = false
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col animate-fade-in">
      
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 18h8"/><path d="M8 14h8"/></svg>
          {{ t('ui.import_plans') }}
        </h3>
        <button 
          @click="handleClose"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded"
        >
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="p-6 space-y-4">
        <p class="text-slate-300 text-sm leading-relaxed">
          {{ t('ui.import_description') }}
        </p>
        
        <textarea 
          v-model="importContent"
          class="w-full h-64 bg-slate-900/50 border border-slate-600 rounded p-4 text-xs font-mono text-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none custom-scrollbar"
          :placeholder="`<plan>...</plan> ${t('ui.import_placeholder_suffix')}`"
        ></textarea>
        
        <div v-if="hasError" class="text-red-400 text-sm flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ t('ui.import_failed') }}
        </div>
      </div>

      <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/30">
        <button 
          @click="handleClose"
          class="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded font-bold transition text-sm"
        >
          {{ t('ui.action_cancel') }}
        </button>
        <button 
          @click="handleImport"
          class="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition shadow-lg shadow-amber-900/20 flex items-center gap-2 text-sm"
        >
          {{ t('ui.action_import') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 1); }
</style>