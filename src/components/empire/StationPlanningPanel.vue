<script setup lang="ts">
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { ref, watch, nextTick, computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { generateFilteredModulesGrouped } from '@/store/logic/searchModule'
import StationPlanningItem from './StationPlanningItem.vue'
import StationModulePicker from './StationModulePicker.vue'
import type { SavedModule, ModuleGroupResult } from '@/types/x4'

const props = defineProps<{
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  enforceDlcActivation: boolean
}>()

const emit = defineEmits<{
  updatePlannedModules: [modules: SavedModule[]]
}>()

const { t } = useI18n()
const gameDataStore = useGameDataStore()
const flashTime = 300

const searchQuery = ref('')
const highlightedModuleIds = ref<Set<string>>(new Set())
const flashingNumberModuleIds = ref<Set<string>>(new Set())
const lastModuleCounts = ref<Record<string, number>>({})

const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
  return generateFilteredModulesGrouped(
    searchQuery.value,
    gameDataStore.currentLocale,
    gameDataStore.localizedModulesMap,
    gameDataStore.localizedModuleGroupsMap,
    (module) => !props.enforceDlcActivation || gameDataStore.isDlcActive(module.dlc_tag)
  )
})

const internalPlannedModules = computed({
  get: () => props.plannedModules,
  set: (val) => emit('updatePlannedModules', val)
})

const triggerHighlight = (id: string) => {
  highlightedModuleIds.value.add(id)
  setTimeout(() => {
    highlightedModuleIds.value.delete(id)
  }, flashTime)
}

const triggerNumberFlash = async (id: string) => {
  flashingNumberModuleIds.value.delete(id)
  await nextTick()
  setTimeout(() => {
    flashingNumberModuleIds.value.add(id)
    setTimeout(() => {
      flashingNumberModuleIds.value.delete(id)
    }, flashTime)
  }, 10)
}

watch(() => props.plannedModules, (newVal) => {
  const currentCounts: Record<string, number> = {}

  newVal.forEach((m) => {
    currentCounts[m.id] = m.count
    const prevCount = lastModuleCounts.value[m.id]

    if (prevCount !== undefined && prevCount !== m.count) {
      triggerNumberFlash(m.id)
    }
  })

  lastModuleCounts.value = currentCounts
}, { deep: true, immediate: true })

watch(() => props.plannedModules.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    const newModules = props.plannedModules.slice(oldLength)

    newModules.forEach((module) => {
      if (module) {
        triggerHighlight(module.id)
      }
    })
  }
})

const applyScale = (scale: number) => {
  const nextModules = props.plannedModules.map(module => ({
    ...module,
    count: Math.ceil(module.count * scale)
  }))
  emit('updatePlannedModules', nextModules)
}

const getModuleInfo = (moduleId: string) => {
  return gameDataStore.modulesMap[moduleId]
}

const isModuleDlcActive = (moduleId: string) => {
  const module = gameDataStore.modulesMap[moduleId]
  return module ? gameDataStore.isDlcActive(module.dlc_tag) : false
}

const isModuleCountEditable = (moduleId: string) => {
  const module = gameDataStore.modulesMap[moduleId]
  if (!module) return true
  const moduleGroupType = (module as any).moduleGroup?.type
  return moduleGroupType !== 'habitation'
}

const handleAddModule = (moduleId: string) => {
  const existingIndex = props.plannedModules.findIndex(m => m.id === moduleId)
  let nextModules: SavedModule[]
  if (existingIndex >= 0) {
    nextModules = props.plannedModules.map((m, i) =>
      i === existingIndex ? { ...m, count: m.count + 1 } : m
    )
  } else {
    nextModules = [...props.plannedModules, { id: moduleId, count: 1 }]
  }
  emit('updatePlannedModules', nextModules)
}

const handleUpdateModuleCount = (index: number, count: number) => {
  const nextModules = props.plannedModules.map((m, i) =>
    i === index ? { ...m, count } : m
  )
  emit('updatePlannedModules', nextModules)
}

const handleRemoveModule = (index: number) => {
  const nextModules = props.plannedModules.filter((_, i) => i !== index)
  emit('updatePlannedModules', nextModules)
}

const handleReorderModules = (modules: SavedModule[]) => {
  emit('updatePlannedModules', modules)
}

const handleTransferAutoModule = (module: SavedModule) => {
  const existingIndex = props.plannedModules.findIndex(m => m.id === module.id)
  let nextModules: SavedModule[]
  if (existingIndex >= 0) {
    nextModules = props.plannedModules.map((m, i) =>
      i === existingIndex ? { ...m, count: m.count + module.count } : m
    )
  } else {
    nextModules = [...props.plannedModules, { id: module.id, count: module.count }]
  }
  emit('updatePlannedModules', nextModules)
}

const handleUpdateSearchQuery = (value: string) => {
  searchQuery.value = value
}
</script>

<template>
  <div class="module-list-container">
    <div class="search-panel" data-testid="search-panel-input">
      <StationModulePicker
        :search-query="searchQuery"
        :filtered-modules-grouped="filteredModulesGrouped"
        @update-search-query="handleUpdateSearchQuery"
        @select-module="handleAddModule"
      />
    </div>

    <div class="tier-section">
      <div class="tier-header">
        <span class="tier-label">{{ t('planning.tier_planned') }}</span>
        <div class="scale-buttons">
          <button 
            v-for="scale in [0.2, 0.333, 0.5, 2, 3, 5]" 
            :key="scale"
            class="scale-button"
            @click="applyScale(scale)"
          >
            {{ scale === 0.2 ? '1/5' : scale === 0.333 ? '1/3' : scale === 0.5 ? '1/2' : scale + 'x' }}
          </button>
        </div>
      </div>
      <div class="module-list-scroll">
        <draggable v-model="internalPlannedModules" item-key="id" ghost-class="drag-ghost" filter=".ignore-drag"
          :prevent-on-filter="false" class="draggable-container" @update:model-value="handleReorderModules">
          <template #item="{ element, index }">
            <StationPlanningItem :item="element" :info="getModuleInfo(element.id)!"
              :inactive-by-dlc="props.enforceDlcActivation && !isModuleDlcActive(element.id)"
              :count-disabled="!isModuleCountEditable(element.id)"
              :class="{ 'module-row--highlight': highlightedModuleIds.has(element.id) }"
              :is-number-flashing="flashingNumberModuleIds.has(element.id)"
              @update:count="(val: number) => handleUpdateModuleCount(index, val)" @remove="handleRemoveModule(index)" />
          </template>
        </draggable>
      </div>
    </div>

    <div v-if="props.autoIndustryModules.length > 0" class="tier-section tier-auto">
      <div class="tier-header">
        <span class="tier-label">{{ t('planning.tier_industry') }}</span>
      </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationPlanningItem v-for="(element, index) in props.autoIndustryModules" :key="'industry-' + element.id + '-' + index"
            :item="element" :info="getModuleInfo(element.id)!" :readonly="true"
            @transfer="handleTransferAutoModule(element)" />
        </div>
      </div>
    </div>

    <div v-if="props.autoHabitationModules.length > 0" class="tier-section tier-auto">
      <div class="tier-header">
        <span class="tier-label">{{ t('planning.tier_habitation') }}</span>
      </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationPlanningItem v-for="(element, index) in props.autoHabitationModules" :key="'habitation-' + element.id + '-' + index"
            :item="element" :info="getModuleInfo(element.id)!" :readonly="true"
            @transfer="handleTransferAutoModule(element)" />
        </div>
      </div>
    </div>

    <div v-if="props.autoInfrastructureModules.length > 0" class="tier-section tier-auto">
      <div class="tier-header">
        <span class="tier-label">{{ t('planning.tier_infrastructure') }}</span>
      </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationPlanningItem v-for="(element, index) in props.autoInfrastructureModules" :key="'infrastructure-' + element.id + '-' + index"
            :item="element" :info="getModuleInfo(element.id)!" :readonly="true"
            @transfer="handleTransferAutoModule(element)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-list-scroll {
  @apply overflow-y-auto pr-1 scrollbar-thin;
}

.drag-ghost {
  @apply opacity-30 bg-slate-700 border-sky-500 border-dashed border-2;
}

.module-list-container {
  @apply space-y-2;
}

.draggable-container {
  @apply space-y-2;
}

.auto-modules-container {
  @apply space-y-2;
}

.search-panel {
  @apply mb-4;
}

.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}

.tier-section {
  @apply space-y-2;
}

.tier-section.tier-auto {
  @apply opacity-90;
}

.tier-section.tier-auto .module-list-scroll {
  @apply border-l-2 border-dashed border-slate-600 pl-2;
}

.scale-buttons {
  @apply flex gap-1 ml-auto;
}

.scale-button {
  @apply px-1 h-[18px] rounded text-[8px] font-bold uppercase tracking-tighter transition-all duration-200;
  @apply bg-slate-700 text-slate-400 border border-transparent flex items-center justify-center;
}

.scale-button:hover {
  @apply bg-amber-600 text-amber-50 border-amber-500;
}

.tier-header {
  @apply flex items-center justify-between px-3 h-8 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent w-full;
}

.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none;
}

.module-row--highlight {
  animation: highlight-flash 0.3s ease-out;
}

@keyframes highlight-flash {
  0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); }
  50% { box-shadow: 0 0 8px 4px rgba(14, 165, 233, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
}
</style>
