<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { generateFilteredWaresGrouped } from '@/store/logic/searchWare'
import { generateFilteredModulesGrouped } from '@/store/logic/searchModule'
import FleetGoalSearchBox from './FleetGoalSearchBox.vue'
import type { BuildGoal } from '@/types/build-plan'
import type { WareGroupResult, ModuleGroupResult } from '@/types/x4'

const props = defineProps<{
  racePreference: string
}>()

const emit = defineEmits<{
  addGoal: [goal: BuildGoal]
  addFleetEntry: [shipId: string, blueprintId: string]
}>()

const gameData = useGameDataStore()
const { t } = useI18n()

const searchInput = ref<HTMLInputElement | null>(null)
const searchBoxEl = ref<HTMLDivElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('')
const popoverPosition = ref({ top: 0, left: 0 })
const searchQuery = ref('')
const selectedCategory = ref<'product' | 'module' | 'fleet'>('product')

watch(selectedCategory, () => {
  searchQuery.value = ''
})

const filteredWaresGrouped = computed<WareGroupResult[]>(() => {
  return generateFilteredWaresGrouped(
    searchQuery.value,
    gameData.currentLocale,
    gameData.localizedWaresMap,
    gameData.localizedModuleGroupsMap,
    (w) => {
      const producers = gameData.modulesByOutputMap[w.id]
      return !!producers && producers.length > 0 && producers.some(m => m.type === 'production')
    }
  )
})

const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
  return generateFilteredModulesGrouped(
    searchQuery.value,
    gameData.currentLocale,
    gameData.localizedModulesMap,
    gameData.localizedModuleGroupsMap,
    (m) => m.isPlayerBlueprint && m.type === 'production'
  )
})

const filteredResults = computed(() => {
  return selectedCategory.value === 'product'
    ? filteredWaresGrouped.value
    : filteredModulesGrouped.value
})

const updatePopoverPosition = async () => {
  await nextTick()
  if (!searchBoxEl.value) return
  
  const searchRect = searchBoxEl.value.getBoundingClientRect()
  const panelCard = searchBoxEl.value.closest('.panel-card')
  
  let baseLeft = searchRect.right
  if (panelCard) {
    const panelRect = panelCard.getBoundingClientRect()
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
  focusSnapshot.value = searchQuery.value || ''
  await updatePopoverPosition()
  isFocused.value = true
}

const onBlur = () => {
  setTimeout(() => {
    if (isFocused.value) {
      const popover = document.querySelector('.goal-search-popover')
      const isClickInsidePopover = popover && popover.contains(document.activeElement)

      if (!isClickInsidePopover) {
        const hasResults = filteredResults.value.length > 0
        if (!hasResults) {
          searchQuery.value = focusSnapshot.value
        }
        isFocused.value = false
      }
    }
  }, 10)
}

const onClearClick = () => {
  searchQuery.value = ''
  focusSnapshot.value = ''
  searchInput.value?.focus()
}

const handleSelectWare = (wareId: string) => {
  const module = gameData.findModuleForWare(wareId, props.racePreference)
  const defaultRate = module?.outputs?.[wareId] ? Math.ceil(module.outputs[wareId]) : 1
  emit('addGoal', { type: 'production-rate', wareId, ratePerHour: defaultRate })
  isFocused.value = false
  searchInput.value?.blur()
  searchQuery.value = ''
}

const handleSelectModule = (moduleId: string) => {
  emit('addGoal', { type: 'build-module', moduleId, count: 1 })
  isFocused.value = false
  searchInput.value?.blur()
  searchQuery.value = ''
}

const handleSelect = (item: any) => {
  if (selectedCategory.value === 'product') {
    handleSelectWare(item.id)
  } else {
    handleSelectModule(item.id)
  }
}

const onEsc = () => {
  searchInput.value?.blur()
  isFocused.value = false
}

const handlePopoverMouseDown = (e: MouseEvent) => {
  e.preventDefault()
}

const categoryOptions = computed(() => [
  { value: 'product' as const, label: t('build_plan.category_product') },
  { value: 'module' as const, label: t('build_plan.category_module') },
  { value: 'fleet' as const, label: t('build_plan.category_fleet') },
])
</script>

<template>
  <div class="goal-search-box-container">
    <FleetGoalSearchBox
      v-if="selectedCategory === 'fleet'"
      @addFleetEntry="(shipId, blueprintId) => emit('addFleetEntry', shipId, blueprintId)"
    />
    <template v-else>
      <div ref="searchBoxEl" class="search-box-wrapper group" :class="{ 'focused': isFocused }">
      <input
        ref="searchInput"
        :value="searchQuery"
        class="search-input"
        data-testid="goal-search-input"
        :placeholder="t('build_plan.search_placeholder')"
        @input="searchQuery = ($event.target as HTMLInputElement).value"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.esc="onEsc"
      />
      <select
        v-model="selectedCategory"
        class="category-select"
        data-testid="goal-category-select"
      >
        <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <button
        v-show="searchQuery"
        class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        @mousedown.prevent="onClearClick"
      >
        ×
      </button>
    </div>

    <Teleport to="body">
      <Transition name="fade-slide">
        <div
          v-if="isFocused && filteredResults.length > 0"
          class="goal-search-popover scrollbar-thin"
          data-testid="goal-search-popover"
          :style="{ position: 'fixed', top: popoverPosition.top + 'px', left: popoverPosition.left + 'px' }"
          @mousedown="handlePopoverMouseDown"
        >
          <div
            v-for="group in filteredResults"
            :key="group.group"
            class="type-group"
          >
            <div class="group-header">{{ group.displayLabel }}</div>
            <template v-if="selectedCategory === 'product'">
              <div
                v-for="item in (group as WareGroupResult).wares"
                :key="item.id"
                class="result-item"
                :data-testid="`goal-result-${item.id}`"
                @click="handleSelect(item)"
              >
                <div
                  class="color-indicator"
                  :style="{ backgroundColor: item.moduleGroup?.color_rgb || '#0ea5e9' }"
                ></div>
                <div class="result-main">
                  <span class="label">{{ item.displayLabel }}</span>
                  <span
                    v-if="item.dlc_tag !== 'base'"
                    class="dlc-tag"
                    :class="gameData.isDlcActive(item.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
                  >
                    {{ gameData.getDlcDisplayName(item.dlc_tag) }}
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <div
                v-for="item in (group as ModuleGroupResult).modules"
                :key="item.id"
                class="result-item"
                :data-testid="`goal-result-${item.id}`"
                @click="handleSelect(item)"
              >
                <div
                  class="color-indicator"
                  :style="{ backgroundColor: item.moduleGroup?.color_rgb || '#0ea5e9' }"
                ></div>
                <div class="result-main">
                  <span class="label">{{ item.displayLabel }}</span>
                  <span
                    v-if="item.dlc_tag !== 'base'"
                    class="dlc-tag"
                    :class="gameData.isDlcActive(item.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
                  >
                    {{ gameData.getDlcDisplayName(item.dlc_tag) }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
    </template>
  </div>
</template>

<style scoped>
.goal-search-box-container {
  @apply relative w-full;
}

.search-box-wrapper {
  @apply flex items-center h-10 w-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all;
}

.search-box-wrapper.focused {
  @apply border-sky-500/50 bg-slate-900/80 ring-1 ring-sky-500/20;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none text-slate-200 text-sm min-w-0;
}

.category-select {
  @apply bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-300 outline-none cursor-pointer ml-2;
}

.clear-btn {
  @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer ml-1;
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
.goal-search-popover {
  @apply w-72 bg-slate-900 border border-slate-700 rounded shadow-2xl z-[9999] max-h-64 overflow-y-auto;
}

.goal-search-popover .type-group {
  @apply w-full;
}

.goal-search-popover .group-header {
  @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800;
}

.goal-search-popover .result-item {
  @apply flex items-center h-9 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40;
}

.goal-search-popover .result-main {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.goal-search-popover .color-indicator {
  @apply w-1 h-4 rounded-full mr-3 flex-shrink-0;
}

.goal-search-popover .label {
  @apply text-sm text-slate-300 truncate min-w-0 flex-1;
}

.goal-search-popover .dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}

.goal-search-popover .dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.goal-search-popover .dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.goal-search-popover.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.goal-search-popover.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>