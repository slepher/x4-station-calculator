<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { ModuleGroupResult } from '@/types/x4'

const props = defineProps<{
  searchQuery: string
  filteredModulesGrouped: ModuleGroupResult[]
}>()

const emit = defineEmits<{
  updateSearchQuery: [value: string]
  selectModule: [moduleId: string]
}>()

const gameData = useGameDataStore()
const { t } = useI18n()

const searchInput = ref<HTMLInputElement | null>(null)
const searchBoxEl = ref<HTMLDivElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('')
const popoverPosition = ref({ top: 0, left: 0 })

const onInput = (e: Event) => {
  emit('updateSearchQuery', (e.target as HTMLInputElement).value)
}

const updatePopoverPosition = async () => {
  await nextTick()
  if (!searchBoxEl.value) return
  
  const searchRect = searchBoxEl.value.getBoundingClientRect()
  const panelWrapper = searchBoxEl.value.closest('.list-wrapper')
  
  let baseLeft = searchRect.right
  if (panelWrapper) {
    const panelRect = panelWrapper.getBoundingClientRect()
    baseLeft = panelRect.right + 8
  } else {
    baseLeft = searchRect.right + 8
  }
  
  popoverPosition.value = {
    top: searchRect.top,
    left: baseLeft
  }
}

const onFocus = async () => {
  focusSnapshot.value = props.searchQuery || ''
  await updatePopoverPosition()
  isFocused.value = true
}

const onBlur = () => {
  setTimeout(() => {
    if (isFocused.value) {
      const popover = document.querySelector('.results-popover-teleport')
      const isClickInsidePopover = popover && popover.contains(document.activeElement)

      if (!isClickInsidePopover) {
        const hasResults = props.filteredModulesGrouped.length > 0
        if (!hasResults) {
          emit('updateSearchQuery', focusSnapshot.value)
        }
        isFocused.value = false
      }
    }
  }, 10)
}

const onClearClick = () => {
  emit('updateSearchQuery', '')
  focusSnapshot.value = ''
  searchInput.value?.focus()
}

const handleSelect = (m: any) => {
  emit('selectModule', m.id)
  isFocused.value = false
  searchInput.value?.blur()
}

const onEsc = () => {
  searchInput.value?.blur()
  isFocused.value = false
}

const handlePopoverMouseDown = (e: MouseEvent) => {
  e.preventDefault()
}
</script>

<template>
  <div class="selector-container w-full">
    <div class="flex flex-col gap-1">
      <div ref="searchBoxEl" class="search-box group" :class="{ 'focused': isFocused }">
        <span class="search-icon">🔍</span>
        <input ref="searchInput" :value="props.searchQuery" class="search-input" data-testid="station-module-search-input" :placeholder="t('planning.search_placeholder')"
          @input="onInput" @focus="onFocus" @blur="onBlur" @keydown.esc="onEsc" />
        <button v-show="props.searchQuery"
          class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          @mousedown.prevent="onClearClick">
          ×
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade-slide">
        <div v-if="isFocused" 
          class="results-popover-teleport scrollbar-thin" 
          data-testid="station-module-candidate-popover"
          :style="{ position: 'fixed', top: popoverPosition.top + 'px', left: popoverPosition.left + 'px' }"
          @mousedown="handlePopoverMouseDown">
          <div v-for="group in props.filteredModulesGrouped" :key="group.group" class="type-group" :data-testid="`station-module-candidate-group-${group.group}`">
            <div class="group-header">{{ group.displayLabel }}</div>
            <div v-for="m in group.modules" :key="m.id" class="result-item" :data-testid="`station-module-candidate-${m.id}`" @click="handleSelect(m)">
              <div class="color-indicator" :style="{ backgroundColor: m.color_rgb || (m.moduleGroup?.type === 'habitation' || m.moduleGroup?.type?.includes('habitat') ? '#f97316' : '#0ea5e9') }">
              </div>
              <div class="result-main">
                <span class="label">{{ m.displayLabel }}</span>
                <span v-if="m.dlc_tag !== 'base'" class="dlc-tag" :class="gameData.isDlcActive(m.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'">
                  {{ gameData.getDlcDisplayName(m.dlc_tag) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.selector-container {
  @apply relative;
}

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

.clear-btn {
  @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  @apply transition-all duration-75;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  @apply opacity-0 transform translate-x-2;
}
</style>

<style>
.results-popover-teleport {
  @apply w-80 bg-slate-900 border border-slate-700 rounded shadow-2xl z-[9999] max-h-80 overflow-y-auto;
}

.results-popover-teleport .type-group {
  @apply w-full;
}

.results-popover-teleport .group-header {
  @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800;
}

.results-popover-teleport .result-item {
  @apply flex items-center h-10 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40;
}

.results-popover-teleport .result-main {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.results-popover-teleport .color-indicator {
  @apply w-1 h-4 rounded-full mr-3 flex-shrink-0;
}

.results-popover-teleport .label {
  @apply text-sm text-slate-300 truncate min-w-0 flex-1;
}

.results-popover-teleport .dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}

.results-popover-teleport .dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.results-popover-teleport .dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.results-popover-teleport.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.results-popover-teleport.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>