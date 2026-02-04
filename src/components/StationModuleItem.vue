<script setup lang="ts">
import type { X4Module } from '@/types/x4'
import type { SavedModule } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n';
import X4NumberInput from '@/components/common/X4NumberInput.vue';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { translateModule } = useX4I18n();
const { t } = useI18n();

const props = defineProps<{
  item: SavedModule
  info: X4Module
  readonly?: boolean
  noClick?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:count', val: number): void
  (e: 'transfer', item: SavedModule): void
  (e: 'remove'): void
}>()

// 计算属性
const colorBarClass = computed(() => {
  return props.info.type === 'habitat' ? 'color-bar--habitat' : 'color-bar--default'
})

const moduleInfoClass = computed(() => {
  return !props.readonly ? 'module-info--editable ignore-drag' : 'module-info--readonly'
})
</script>

<template>
  <div class="module-row group/row" :class="{ 'module-row--draggable': !readonly, 'module-row--readonly': readonly }">
    <div class="color-bar" :class="colorBarClass">
    </div>
    
    <div class="module-info" :class="moduleInfoClass">
       <div class="module-name" :title="info.name">
         {{ translateModule(info) }}
       </div>
    </div>
    
    <div class="controls" v-if="!readonly">
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
        :title="t('ui.remove')"
      >×</button>
    </div>
    <div class="controls" v-else>
      <div v-if="!props.noClick" class="count-display ignore-drag" @click="emit('transfer', item)">
        <span 
          class="count-text count-text--clickable"
          :title="t('ui.transfer_to_planning')"
        >{{ item.count }}</span>
      </div>
      <div v-else class="count-display">
        <span class="count-text count-text--static">{{ item.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-row {
  @apply flex items-center bg-slate-800/80 border border-slate-700 p-1 rounded hover:border-sky-500/50 transition-all h-9;
}

.module-row--draggable {
  @apply cursor-move;
}

.module-row--readonly {
  @apply cursor-default;
}

.color-bar {
  @apply w-1.5 h-6 rounded-sm mr-2 flex-shrink-0;
}

.color-bar--habitat {
  @apply bg-orange-500;
}

.color-bar--default {
  @apply bg-sky-500;
}

.module-info {
  @apply flex-1 min-w-0 mr-2;
}

.module-info--editable {
  @apply cursor-text;
}

.module-info--readonly {
  @apply cursor-default;
}

.module-name {
  @apply truncate font-medium text-slate-300 group-hover/row:text-white transition-colors text-xs sm:text-sm;
}

.controls {
  @apply flex items-center gap-1;
}

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none cursor-pointer;
}

.count-display {
  @apply flex items-center justify-center w-14;
}

.count-text {
  @apply text-sm font-medium;
}

.count-text--clickable {
  @apply cursor-pointer hover:text-sky-300 hover:bg-sky-400/20 transition-all duration-200 text-sky-400 px-2 py-0.5 rounded;
}

.count-text--static {
  @apply text-slate-500;
}
</style>