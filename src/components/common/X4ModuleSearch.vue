
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useStationStore } from '@/store/useStationStore';

const props = defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits(['update:modelValue', 'select']);
const store = useStationStore();
const popoverDirectionClass = computed(() => {
  return store.plannedModules.length <= 4 ? 'pop-down' : 'pop-up';
});


const searchInput = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);
const isHovered = ref(false);
const focusSnapshot = ref(''); // 聚焦快照

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
};

const onFocus = () => {
  focusSnapshot.value = props.modelValue || '';
  isFocused.value = true;
};

const onBlur = () => {
  if (isFocused.value) {
    // 无效搜索回滚逻辑
    const hasResults = store.filteredModulesGrouped.length > 0;
    if (!hasResults) {
      emit('update:modelValue', focusSnapshot.value);
    }
    isFocused.value = false;
  }
};

const onClearClick = () => {
  emit('update:modelValue', '');
  focusSnapshot.value = ''; // 毁灭快照
  searchInput.value?.focus();
};

const handleSelect = (m: any) => {
  emit('select', m);
  isFocused.value = false; // 关闭列表
  searchInput.value?.blur(); // 保持文本不变
};

const onEsc = () => {
  searchInput.value?.blur();
};
</script>

<template>
  <div class="x4-search-container" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div class="search-box" :class="{ 'focused': isFocused }">
      <span class="search-icon">🔍</span>
      <input
        ref="searchInput"
        :value="modelValue" 
        class="search-input"
        :placeholder="placeholder || 'search...'"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.esc="onEsc"
      />
      <button 
        v-show="modelValue && isHovered" 
        class="clear-btn" 
        @mousedown.prevent="onClearClick"
      >
        ×
      </button>
    </div>

    <Transition name="fade-slide">
      <div v-if="isFocused" :class="popoverDirectionClass" class="results-popover scrollbar-thin" @mousedown.prevent>
        <div v-for="group in store.filteredModulesGrouped" :key="group.group" class="type-group">
          <div class="group-header">{{ group.displayLabel }}</div>
          <div v-for="m in group.modules" :key="m.id" class="result-item" @click="handleSelect(m)">
            <div class="color-indicator" :class="m.moduleGroup?.type === 'habitation' ? 'bg-orange-500' : 'bg-sky-500'"></div>
            <span class="label">{{ m.displayLabel }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.x4-search-container { @apply relative w-full h-10; }
.search-box { @apply flex items-center h-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all; }
.search-box.focused { @apply border-sky-500/50 bg-slate-900/80 ring-1 ring-sky-500/20; }
.search-input { @apply flex-1 bg-transparent border-none outline-none text-slate-200 text-sm; }
.results-popover { @apply absolute w-full bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 max-h-80 overflow-y-auto; }
.pop-up { @apply bottom-full mb-2; }
.pop-down { @apply top-full mt-2; }
.group-header { @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800; }
.result-item { @apply flex items-center h-10 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40; }
.color-indicator { @apply w-1 h-4 rounded-full mr-3 flex-shrink-0; }
.label { @apply text-sm text-slate-300 truncate; }
.no-results { @apply p-6 text-center text-slate-600 text-[10px] italic; }
.clear-btn { @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer; }
</style>