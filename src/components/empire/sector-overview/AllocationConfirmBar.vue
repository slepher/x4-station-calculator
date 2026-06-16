<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  unresolved: string[]
  globalUnresolved?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()

const statusText = computed(() => {
  if (props.unresolved.length > 0) return props.unresolved.map((k) => t(k)).join(', ')
  return t('sector.all_resolved')
})
</script>

<template>
  <div class="confirm-bar">
    <span class="bar-status" :class="{ 'bar-status--unresolved': unresolved.length > 0 }">
      {{ statusText }}
    </span>
    <div class="bar-actions">
      <button class="bar-btn reset-btn" :disabled="disabled" @click="emit('reset')">
        {{ t('sector.reset') }}
      </button>
      <button
        class="bar-btn confirm-btn"
        :disabled="unresolved.length > 0 || (globalUnresolved ?? false) || disabled"
        @click="emit('confirm')"
      >
        {{ t('sector.confirm') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.confirm-bar {
  @apply flex items-center justify-between p-1.5 bg-slate-800/50 rounded border border-slate-700/50 mb-3;
}

.bar-status {
  @apply text-xs;
}

.bar-status--unresolved {
  @apply text-amber-400;
}

.bar-btn {
  @apply px-4 py-1 text-xs font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}

.bar-actions {
  @apply flex items-center gap-2;
}

.reset-btn {
  @apply bg-slate-700/30 text-slate-300 border border-slate-500/30 hover:bg-slate-700/50;
}

.confirm-btn {
  @apply bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:hover:bg-green-600/20;
}
</style>
