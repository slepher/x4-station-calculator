<script setup lang="ts">
import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'

const emit = defineEmits<{
  (e: 'click'): void
}>()

const gameData = useGameDataStore()
const showIndicator = computed(() => gameData.needsVersionSetup)

const handleClick = () => {
  emit('click')
}
</script>

<template>
  <button
    type="button"
    class="settings-button"
    data-testid="settings-button"
    @click="handleClick"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
    <span
      v-if="showIndicator"
      class="indicator"
      data-testid="settings-indicator"
    />
  </button>
</template>

<style scoped>
.settings-button {
  @apply relative p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200;
}

.indicator {
  @apply absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full;
}
</style>