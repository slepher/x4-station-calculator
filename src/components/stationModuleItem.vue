<script setup lang="ts">
import type { SavedModule, X4Module } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n';
import X4NumberInput from '@/components/common/X4NumberInput.vue';

const { translateModule } = useX4I18n();

const props = defineProps<{
  item: SavedModule
  info: X4Module
}>()

const emit = defineEmits<{
  (e: 'update:count', val: number): void
  (e: 'remove'): void
}>()
</script>

<template>
  <div class="module-row group/row cursor-move">
    <div class="color-bar" 
         :class="info.type === 'habitat' ? 'bg-orange-500' : 'bg-sky-500'">
    </div>
    
    <div class="module-info ignore-drag cursor-text">
       <div class="module-name" :title="info.name">
         {{ translateModule(info) }}
       </div>
    </div>
    
    <div class="controls">
      <div class="ignore-drag">
        <X4NumberInput 
          :modelValue="item.count"
          @update:modelValue="emit('update:count', $event)"
          width-class="w-14"
          :min="1"
        />
      </div>
      <button 
        @click="emit('remove')" 
        class="remove-btn ignore-drag" 
        title="Remove"
      >×</button>
    </div>
  </div>
</template>

<style scoped>
.module-row {
  @apply flex items-center bg-slate-800/80 border border-slate-700/50 px-2 rounded-sm hover:border-sky-500/40 transition-all;
}
.color-bar {
  @apply w-1 h-4 rounded-full mr-2 flex-shrink-0;
}
.module-info {
  @apply flex-1 min-w-0 mr-2;
}
.module-name {
  @apply truncate font-medium text-slate-300 text-[11px] leading-none;
}
.controls {
  @apply flex items-center gap-1;
}

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none cursor-pointer;
}
</style>