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

/* --- 输入框统一样式 --- */
.count-input {
  /* 基础：缩小文字、实体边框、暗色背景 */
  @apply w-14 bg-slate-950/50 border border-slate-700 text-center text-sky-400/90 font-mono rounded transition-all;
  @apply focus:border-slate-500 focus:bg-slate-950 focus:ring-0 outline-none text-sm py-0.5 h-6;
  appearance: auto;
}

/* 调节箭头重塑：初始隐藏，匹配页面低饱和度风格 */
.count-input::-webkit-inner-spin-button {
  @apply opacity-0 cursor-pointer ml-0.5 transition-opacity duration-200;
  background-color: transparent;
  /* 翻转并降低亮度，呈现深灰色 */
  filter: invert(1) brightness(0.4) contrast(0.8);
  height: 14px;
}

/* 鼠标指向时显示箭头 */
.count-input:hover::-webkit-inner-spin-button {
  @apply opacity-70;
}

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none;
}
</style>