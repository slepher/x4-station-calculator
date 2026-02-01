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
        <div v-for="group in store.filteredModulesGrouped" :key="group.type" class="type-group">
          <div class="group-header">{{ group.displayLabel }}</div>
          <div v-for="m in group.modules" :key="m.id" class="result-item" @click="handleSelect(m)">
            <div class="color-indicator" :class="m.type === 'habitation' ? 'bg-orange-500' : 'bg-sky-500'"></div>
            <span class="label">{{ m.displayLabel }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

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

// 核心逻辑：backupValue 仅作为“已确认模块”的锚点
const backupValue = ref(props.modelValue || ''); 

watch(() => props.modelValue, (newVal) => {
  if (!isFocused.value) backupValue.value = newVal || '';
});

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
};

const onFocus = () => {
  isFocused.value = true;
};

const onBlur = () => {
  if (isFocused.value) {
    // 只有在存在“已确认备份”时，失焦才回滚
    if (backupValue.value) {
      emit('update:modelValue', backupValue.value);
    }
    isFocused.value = false;
  }
};

const onClearClick = () => {
  // 1. 立即清空外部 v-model，从而触发 Store 的空字符串(全量)搜索
  emit('update:modelValue', '');
  // 2. 物理焦点保持在输入框，不触发 onBlur
  searchInput.value?.focus();
};

const handleSelect = (m: any) => {
  const selectedName = m.localeName;
  backupValue.value = selectedName; // 物理确认：锁定新的回滚目标
  emit('update:modelValue', selectedName);
  emit('select', m);
  
  isFocused.value = false;
  searchInput.value?.blur(); // 选中后彻底退出编辑态
};

const onEsc = () => {
  searchInput.value?.blur();
};
</script>

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