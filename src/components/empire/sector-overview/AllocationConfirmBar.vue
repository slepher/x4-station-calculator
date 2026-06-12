<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  hasUncertain: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="confirm-bar">
    <span class="bar-status">
      {{ hasUncertain ? t('sector.resolve_all_uncertain') : t('sector.all_resolved') }}
    </span>
    <button
      class="bar-btn confirm-btn"
      :disabled="hasUncertain"
      @click="emit('confirm')"
    >
      {{ t('sector.confirm') }}
    </button>
  </div>
</template>

<style scoped>
.confirm-bar {
  @apply flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700/50 mb-3;
}

.bar-status {
  @apply text-xs;
}

.bar-btn {
  @apply px-4 py-1 text-xs font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}

.confirm-btn {
  @apply bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:hover:bg-green-600/20;
}
</style>
