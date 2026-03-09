<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LogicFlowImportWarning } from '@/store/logic/logicFlowImport'

const props = defineProps<{
  isOpen: boolean
  warnings: LogicFlowImportWarning[]
}>()

defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const warningMessages = computed(() => {
  return props.warnings.map((warning) => {
    if (warning.type === 'empty_group_skipped') {
      return t('logicFlowImport.warning_empty_group_skipped', { group: warning.groupName })
    }

    return t('logicFlowImport.warning_non_container_ignored', {
      ware: warning.wareName || warning.wareId,
      group: warning.groupName
    })
  })
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="logicflow-import-warning-modal">
    <div class="w-full max-w-xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-lg font-bold text-amber-300 tracking-wide">
          {{ t('logicFlowImport.warning_title') }}
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-3 text-sm text-slate-200">
        <p class="text-slate-300">
          {{ t('logicFlowImport.warning_count', { count: warnings.length }) }}
        </p>
        <ul class="space-y-2 list-disc pl-5">
          <li v-for="(message, index) in warningMessages" :key="index" class="leading-relaxed">
            {{ message }}
          </li>
        </ul>
      </div>

      <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end">
        <button class="px-4 py-2 rounded text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition" @click="$emit('close')">
          {{ t('logicFlowImport.action_acknowledge') }}
        </button>
      </div>
    </div>
  </div>
</template>
