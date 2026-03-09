<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isOpen: boolean
  groupName: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm-new-station'): void
  (e: 'confirm-overwrite'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="station-import-confirm-modal">
    <div class="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-lg font-bold text-white tracking-wide">
          {{ t('logicFlowImport.station_confirm_title') }}
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 text-sm text-slate-300 leading-relaxed">
        {{ t('logicFlowImport.station_confirm_message', { group: groupName }) }}
      </div>

      <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
        <button class="px-4 py-2 rounded text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition" @click="$emit('close')">
          {{ t('ui.cancel') }}
        </button>
        <button
          class="px-4 py-2 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
          @click="$emit('confirm-new-station')"
          data-testid="station-import-confirm-new"
        >
          {{ t('logicFlowImport.station_action_new') }}
        </button>
        <button
          class="px-4 py-2 rounded text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition"
          @click="$emit('confirm-overwrite')"
          data-testid="station-import-confirm-overwrite"
        >
          {{ t('logicFlowImport.station_action_overwrite') }}
        </button>
      </div>
    </div>
  </div>
</template>
