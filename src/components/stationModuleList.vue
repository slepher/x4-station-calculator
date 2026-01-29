<script setup lang="ts">
import { ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import StationModuleItem from './StationModuleItem.vue'
import X4ModuleSearch from './common/X4ModuleSearch.vue'
import X4NumberInput from './common/X4NumberInput.vue'

const store = useStationStore()
const currentSelectedId = ref<string | null>(null)

const handleConfirmAdd = () => {
  if (currentSelectedId.value) {
    store.addModule(currentSelectedId.value)
    currentSelectedId.value = null
    store.searchQuery = ''
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="header-row flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
      <h3 class="text-lg font-semibold text-slate-200 uppercase tracking-tight">
        {{ $t('ui.module_list') }}
      </h3>
      
      <div class="flex items-center gap-2">
        <span class="text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none">
          {{ $t('ui.sun_light') }}
        </span>
        
        <div class="x4-composite-input-wrapper">
          <X4NumberInput 
            v-model="store.settings.sunlight"
            :min="0"
            :max="10000"
            width-class="w-16" 
            class="x4-nested-input"
          />
          <div class="x4-unit-suffix-box">%</div>
        </div>
      </div>
    </div>

    <div class="module-list-scroll">
      <StationModuleItem 
        v-for="(item, index) in store.plannedModules" 
        :key="index"
        :item="item"
        :info="store.getModuleInfo(item.id)!"
        @update:count="(val) => store.updateModuleCount(index, val)"
        @remove="store.removeModule(index)"
      />
    </div>

    <div class="add-module-container">
      <X4ModuleSearch 
        v-model="store.searchQuery" 
        @select="(m) => currentSelectedId = m.id" 
        class="flex-1"
        :placeholder="$t('ui.search_placeholder')"
      />
      <button 
        class="action-add-btn"
        :disabled="!currentSelectedId"
        @click="handleConfirmAdd"
      >
        <span class="leading-none">+</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.header-row {
  @apply h-9;
}

.x4-composite-input-wrapper {
  @apply flex items-center h-6 overflow-hidden rounded border border-slate-700 bg-slate-950/60 transition-colors duration-200;
}

.x4-composite-input-wrapper:focus-within {
  @apply border-slate-500;
}

/* 穿透重置嵌套组件样式 */
:deep(.x4-nested-input .x4-input-container) {
  @apply border-none bg-transparent rounded-none h-full;
}

.x4-unit-suffix-box {
  @apply flex items-center justify-center px-1.5 h-full text-[10px] font-bold;
  @apply text-slate-500 border-l border-slate-700/50 bg-slate-900/40;
  min-width: 20px;
}

.module-list-scroll {
  @apply space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin;
}

.add-module-container {
  @apply flex items-stretch gap-2 mt-4 pt-4 border-t border-slate-700 pb-1;
}

.action-add-btn {
  @apply w-8 flex items-center justify-center rounded font-bold text-lg transition-all duration-200;
  @apply bg-emerald-600 text-white shadow-lg shadow-emerald-900/20;
}

.action-add-btn:hover:not(:disabled) {
  @apply bg-emerald-500;
}

.action-add-btn:disabled {
  @apply opacity-20 bg-slate-700 text-slate-500 cursor-not-allowed shadow-none;
}

/* 滚动条 Apply 化 */
.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>