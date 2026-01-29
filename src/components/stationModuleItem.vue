<script setup lang="ts">
import type { PlannedModule, ModuleData } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n';
import X4NumberInput from '@/components/common/X4NumberInput.vue'; // 引入通用组件

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
  <div class="module-row group/row">
    <div class="color-bar" 
         :class="info.type === 'habitat' ? 'bg-orange-500' : 'bg-sky-500'">
    </div>
    
    <div class="module-info">
       <div class="module-name" :title="info.name">
         {{ translateModule(info) }}
       </div>
    </div>
    
    <div class="controls">
      <X4NumberInput 
        :modelValue="item.count"
        @update:modelValue="emit('update:count', $event)"
        width-class="w-14"
        :min="1"
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

/* 移除原本冗余的 .count-input 样式，现在由 X4NumberInput 内部管理 */

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none;
}
</style>