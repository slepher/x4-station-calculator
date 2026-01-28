<script setup lang="ts">
import type { PlannedModule, ModuleData } from '@/store/useStationStore'

import { useX4I18n } from '@/utils/useX4I18n';
const { translateModule } = useX4I18n();

const props = defineProps<{
  item: PlannedModule
  info: ModuleData
}>()

const emit = defineEmits<{
  (e: 'update:count', val: number): void
  (e: 'remove'): void
}>()
</script>

<template>
  <div class="module-row group">
    <div class="color-bar" 
         :class="info.type === 'habitat' ? 'bg-orange-500' : 'bg-sky-500'">
    </div>
    
    <div class="module-info">
       <div class="module-name" :title="info.name">
         {{ translateModule(info) }}
       </div>
    </div>
    
    <div class="controls">
      <input 
        type="number" 
        :value="item.count"
        @input="emit('update:count', Number(($event.target as HTMLInputElement).value))"
        class="count-input" 
      />
      <button @click="emit('remove')" class="remove-btn" title="Remove">×</button>
    </div>
  </div>
</template>

<style scoped>
.module-row {
  @apply flex items-center bg-slate-800 border border-slate-700 p-2 rounded hover:border-sky-500/50 transition-all;
}
.color-bar {
  @apply w-1 h-8 rounded mr-2 flex-shrink-0;
}
.module-info {
  @apply flex-1 min-w-0 mr-2;
}
.module-name {
  @apply truncate font-medium text-slate-300 text-xs sm:text-sm;
}
.controls {
  @apply flex items-center gap-1;
}
.count-input {
  @apply w-12 bg-slate-900 border border-slate-600 text-center text-white font-mono rounded focus:border-sky-500 outline-none text-sm py-1;
}
.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none;
}
</style>