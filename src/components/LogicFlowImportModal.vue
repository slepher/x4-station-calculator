<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LogicFlowImportBody from './LogicFlowImportBody.vue'

defineProps<{
  isOpen: boolean
  mode: 'station' | 'empire'
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { planId: string; groupId?: string }): void
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="logicflow-import-modal">
    <div class="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-lg font-bold text-white tracking-wide">
          {{ mode === 'station' ? t('logicFlowImport.select_title_station') : t('logicFlowImport.select_title_empire') }}
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <LogicFlowImportBody :mode="mode" @confirm="$emit('confirm', $event)" />

      <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
        <button class="px-4 py-2 rounded text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition" @click="$emit('close')">
          {{ t('ui.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
