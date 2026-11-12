<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
defineProps<{ title: string; message: string; name: string; confirmLabel: string; error?: string }>()
defineEmits<{ close: []; confirm: [] }>()
const { t } = useI18n()
const cancelButton = ref<HTMLButtonElement | null>(null)
onMounted(() => cancelButton.value?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      data-testid="confirm-dialog" @keydown.esc="$emit('close')">
      <section role="dialog" aria-modal="true" :aria-label="title"
        class="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden">
        <header class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
          <h3 class="text-lg font-bold text-white">{{ title }}</h3>
          <button class="text-slate-400 hover:text-white p-1 rounded" :aria-label="t('ui.cancel')" @click="$emit('close')">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div class="p-6 text-slate-300">
          <p>{{ message }}</p>
          <p class="mt-3 font-semibold text-white break-words">{{ name }}</p>
          <p v-if="error" role="alert" class="mt-3 text-red-400">{{ error }}</p>
        </div>
        <footer class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
          <button ref="cancelButton" class="px-4 py-2 rounded text-sm font-bold text-white bg-slate-600 hover:bg-slate-500"
            data-testid="confirm-dialog-cancel" @click="$emit('close')">{{ t('ui.cancel') }}</button>
          <button class="px-4 py-2 rounded text-sm font-bold text-white bg-red-600 hover:bg-red-500"
            data-testid="confirm-dialog-confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
