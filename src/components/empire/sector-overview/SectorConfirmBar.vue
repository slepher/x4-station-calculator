<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  prefJumpRange: number
  prefThreshold: number
}>()

const emit = defineEmits<{
  (e: 'update:prefJumpRange', value: number): void
  (e: 'update:prefThreshold', value: number): void
  (e: 'recalculate'): void
}>()

const { t } = useI18n()

const jumpOptions = [1, 2, 3, 4, 5]
const thresholdOptions = [
  { label: '1M', value: 1_000_000 },
  { label: '3M', value: 3_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '20M', value: 20_000_000 }
]
</script>

<template>
  <div class="confirm-bar">
    <div class="bar-left">
      <label class="bar-label">{{ t('sector.default_jump') }}</label>
      <select
        class="bar-select"
        :value="prefJumpRange"
        @change="emit('update:prefJumpRange', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="j in jumpOptions" :key="j" :value="j">{{ j }}</option>
      </select>

      <label class="bar-label ml-3">{{ t('sector.default_threshold') }}</label>
      <select
        class="bar-select"
        :value="prefThreshold"
        @change="emit('update:prefThreshold', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="opt in thresholdOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
    <button class="bar-btn recalc-btn" @click="emit('recalculate')">
      {{ t('sector.recalculate') }}
    </button>
  </div>
</template>

<style scoped>
.confirm-bar {
  @apply flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700/50 mb-2;
}

.bar-left {
  @apply flex items-center gap-1;
}

.bar-label {
  @apply text-xs text-slate-400;
}

.bar-select {
  @apply text-xs bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-sky-500;
}

.bar-btn {
  @apply px-3 py-1 text-xs font-medium rounded transition-colors;
}

.recalc-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30;
}
</style>
