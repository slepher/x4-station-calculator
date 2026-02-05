<script setup lang="ts">
import { ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'

const store = useStationStore()

// --- Search Logic & State ---
const searchInput = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('') // 聚焦快照



const onInput = (e: Event) => {
  store.searchQuery = (e.target as HTMLInputElement).value
}

const onFocus = () => {
  focusSnapshot.value = store.searchQuery || ''
  isFocused.value = true
}

const onBlur = () => {
  // 延迟处理，避免与点击事件冲突
  setTimeout(() => {
    if (isFocused.value) {
      // 检查是否点击了弹出菜单内部
      const popover = document.querySelector('.results-popover')
      const isClickInsidePopover = popover && popover.contains(document.activeElement)

      // 只有当点击在弹出菜单外部时才关闭
      if (!isClickInsidePopover) {
        // 无效搜索回滚逻辑
        const hasResults = store.filteredModulesGrouped.length > 0
        if (!hasResults) {
          store.searchQuery = focusSnapshot.value
        }
        isFocused.value = false
      }
    }
  }, 10)
}

const onClearClick = () => {
  store.searchQuery = ''
  focusSnapshot.value = '' // 毁灭快照
  searchInput.value?.focus()
}

const handleSelect = (m: any) => {
  // 直接添加模块到规划区，取消预览
  store.addModule(m.id)
  // 保持弹出菜单打开，允许连续添加
  // isFocused.value = false // 不再关闭列表
  // searchInput.value?.blur() // 不再失去焦点
}

const onEsc = () => {
  searchInput.value?.blur()
}
// ----------------------------


</script>

<template>
  <div class="selector-container relative w-full">
    <div class="flex flex-col gap-1">
      <div class="search-box group" :class="{ 'focused': isFocused }">
        <span class="search-icon">🔍</span>
        <input ref="searchInput" :value="store.searchQuery" class="search-input" placeholder="Search modules..."
          @input="onInput" @focus="onFocus" @blur="onBlur" @keydown.esc="onEsc" />
        <button v-show="store.searchQuery"
          class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          @mousedown.prevent="onClearClick">
          ×
        </button>
      </div>
    </div>

    <Transition name="fade-slide">
      <div v-if="isFocused" class="results-popover pop-right scrollbar-thin" @mousedown.prevent>
        <div v-for="group in store.filteredModulesGrouped" :key="group.group" class="type-group">
          <div class="group-header">{{ group.displayLabel }}</div>
          <div v-for="m in group.modules" :key="m.id" class="result-item" @click="handleSelect(m)">
            <div class="color-indicator" :class="m.moduleGroup?.type === 'habitation' ? 'bg-orange-500' : 'bg-sky-500'">
            </div>
            <span class="label">{{ m.displayLabel }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.selector-container {
  @apply relative;
  /* Base container is now relative to anchor the popover */
}



/* Search Styles (Merged) */
.search-box {
  @apply flex items-center h-10 w-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all;
}

.search-box.focused {
  @apply border-sky-500/50 bg-slate-900/80 ring-1 ring-sky-500/20;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none text-slate-200 text-sm;
}

.search-icon {
  @apply mr-2 text-slate-500;
}

.results-popover {
  @apply absolute w-80 bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 max-h-80 overflow-y-auto;
}

.pop-right {
  @apply top-0 left-full ml-2;
  /* 从搜索框右上方向右下弹出 */
}

.group-header {
  @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800;
}

.result-item {
  @apply flex items-center h-10 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40;
}

.color-indicator {
  @apply w-1 h-4 rounded-full mr-3 flex-shrink-0;
}

.label {
  @apply text-sm text-slate-300 truncate;
}

.no-results {
  @apply p-6 text-center text-slate-600 text-[10px] italic;
}

.clear-btn {
  @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  @apply transition-opacity duration-200;
}

.fade-enter-from,
.fade-leave-to {
  @apply opacity-0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  @apply transition-all duration-200;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  @apply opacity-0 transform translate-x-2;
}
</style>