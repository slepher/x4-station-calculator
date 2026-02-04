<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'

const store = useStationStore()
const { translateModule } = useX4I18n()

const currentSelectedId = ref<string | null>(null)

// --- Search Logic & State ---
const searchInput = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('') // 聚焦快照

const popoverDirectionClass = computed(() => {
  return store.allModules.length <= 4 ? 'pop-down' : 'pop-up'
})

const onInput = (e: Event) => {
  store.searchQuery = (e.target as HTMLInputElement).value
}

const onFocus = () => {
  focusSnapshot.value = store.searchQuery || ''
  isFocused.value = true
}

const onBlur = () => {
  if (isFocused.value) {
    // 无效搜索回滚逻辑
    const hasResults = store.filteredModulesGrouped.length > 0
    if (!hasResults) {
      store.searchQuery = focusSnapshot.value
    }
    isFocused.value = false
  }
}

const onClearClick = () => {
  store.searchQuery = ''
  focusSnapshot.value = '' // 毁灭快照
  searchInput.value?.focus()
}

const handleSelect = (m: any) => {
  currentSelectedId.value = m.id
  isFocused.value = false // 关闭列表
  searchInput.value?.blur() // 保持文本不变
}

const onEsc = () => {
  searchInput.value?.blur()
}
// ----------------------------

// 联动清除：当搜索框被清空时，也清空选中预览
watch(() => store.searchQuery, (val) => {
  if (!val) currentSelectedId.value = null
})

const handleConfirmAdd = () => {
  if (currentSelectedId.value) {
    store.addModule(currentSelectedId.value)
    // 保持选中状态，允许连续添加
  }
}
</script>

<template>
  <div class="selector-container relative w-full">
    <div class="flex flex-col gap-1">
      <Transition name="fade">
        <div v-if="currentSelectedId && store.getModuleInfo(currentSelectedId)" class="preview-row">
          <div class="preview-info">
            <div class="preview-color" :class="store.getModuleInfo(currentSelectedId)!.type === 'habitat' ? 'bg-orange-500' : 'bg-sky-500'"></div>
            <span class="preview-name">{{ translateModule(store.getModuleInfo(currentSelectedId)!) }}</span>
          </div>
          
          <button class="action-add-btn-mini" @click="handleConfirmAdd" title="Add to plan">
            +
          </button>
        </div>
      </Transition>

      <div class="search-box group" :class="{ 'focused': isFocused }">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          :value="store.searchQuery" 
          class="search-input"
          placeholder="Search modules..."
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @keydown.esc="onEsc"
        />
        <button 
          v-show="store.searchQuery" 
          class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
          @mousedown.prevent="onClearClick"
        >
          ×
        </button>
      </div>
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
.selector-container { 
  /* Base container is now relative to anchor the popover */
}

/* Preview Styles */
.preview-row { 
  @apply flex items-center justify-between h-8 bg-slate-800/90 border border-sky-500/30 rounded pl-2 pr-1;
}
.preview-info { @apply flex items-center flex-1 min-w-0 mr-2; }
.preview-color { @apply w-1 h-3.5 rounded-full mr-2 flex-shrink-0; }
.preview-name { @apply text-xs font-medium text-slate-200 truncate; }

/* Mini Add Button */
.action-add-btn-mini { 
  @apply w-6 h-6 flex items-center justify-center rounded bg-emerald-600 text-white font-bold text-sm transition-all shadow-sm cursor-pointer; 
}
.action-add-btn-mini:hover { @apply bg-emerald-500 scale-105; }
.action-add-btn-mini:active { @apply scale-95; }

/* Search Styles (Merged) */
.search-box { @apply flex items-center h-10 w-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all; }
.search-box.focused { @apply border-sky-500/50 bg-slate-900/80 ring-1 ring-sky-500/20; }
.search-input { @apply flex-1 bg-transparent border-none outline-none text-slate-200 text-sm; }
.search-icon { @apply mr-2 text-slate-500; }

.results-popover { @apply absolute w-full bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 max-h-80 overflow-y-auto; }
.pop-up { @apply bottom-full mb-2; } /* Sits above the entire container */
.pop-down { @apply top-full mt-2; }

.group-header { @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800; }
.result-item { @apply flex items-center h-10 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40; }
.color-indicator { @apply w-1 h-4 rounded-full mr-3 flex-shrink-0; }
.label { @apply text-sm text-slate-300 truncate; }
.no-results { @apply p-6 text-center text-slate-600 text-[10px] italic; }
.clear-btn { @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer; }

/* Animations */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-200; }
.fade-enter-from, .fade-leave-to { @apply opacity-0; }

.fade-slide-enter-active, .fade-slide-leave-active { @apply transition-all duration-200; }
.fade-slide-enter-from, .fade-slide-leave-to { @apply opacity-0 transform translate-y-1; }
</style>