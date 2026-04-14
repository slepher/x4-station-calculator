<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { compareModuleGroupsByPickerOrder, compareModulesByPickerOrder } from '@/store/logic/searchModule'
import StationPlanningItem from '@/components/empire/StationPlanningItem.vue'
import type { AggregatedStationModule } from '@/types/saveArchive'
import type { SavedModule, X4Module } from '@/types/x4'

const props = defineProps<{
  modules: AggregatedStationModule[]
}>()

const { t } = useI18n()
const gameData = useGameDataStore()

interface GroupedArchiveModule {
  moduleId: string
  group: string
  savedModule: SavedModule
  x4Module: X4Module
}

const groupedModules = computed(() => {
  const groups: Record<string, GroupedArchiveModule[]> = {}
  const modulesMap = gameData.modulesMap
  const moduleGroupsMap = gameData.localizedModuleGroupsMap
  const modulesByMacroId = gameData.modulesByMacroId

  props.modules.forEach((module) => {
    let moduleId = module.module_id
    let group = module.group || ''

    if (!moduleId || !group) {
      const matchedModule = modulesByMacroId[module.ref]
      if (matchedModule) {
        moduleId = moduleId || matchedModule.id
        group = group || matchedModule.group || ''
      }
    }

    if (!moduleId || !group) return

    const x4Module = modulesMap[moduleId]
    if (!x4Module) return

    const savedModule: SavedModule = { id: moduleId, count: module.amount }
    const groupKey = group

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey]!.push({
      moduleId,
      group: groupKey,
      savedModule,
      x4Module
    })
  })

  Object.keys(groups).forEach((groupKey) => {
    const groupModules = groups[groupKey]
    if (!groupModules) return
    groupModules.sort((a, b) =>
      compareModulesByPickerOrder(
        { id: a.moduleId, group: groupKey },
        { id: b.moduleId, group: groupKey },
        moduleGroupsMap
      )
    )
  })

  return Object.keys(groups)
    .sort((a, b) => compareModuleGroupsByPickerOrder(a, b, moduleGroupsMap))
    .map((groupKey) => ({
      group: groupKey,
      displayLabel: moduleGroupsMap[groupKey]?.localeName || groupKey,
      modules: groups[groupKey] || []
    }))
})

const hasModules = computed(() => props.modules.length > 0)

function getModuleInfo(item: GroupedArchiveModule): X4Module {
  return item.x4Module
}
</script>

<template>
  <div class="archive-module-list">
    <div v-if="!hasModules" class="empty-state">
      {{ t('planning.archive_empty') }}
    </div>

    <div v-else class="module-groups">
      <div v-for="group in groupedModules" :key="group.group" class="tier-section">
        <div class="tier-header">
          <span class="tier-label">{{ group.displayLabel }}</span>
        </div>
        <div class="module-list-scroll scrollbar-thin">
          <div class="auto-modules-container">
            <StationPlanningItem
              v-for="module in group.modules"
              :key="module.moduleId"
              :item="module.savedModule"
              :info="getModuleInfo(module)"
              :readonly="true"
              :no-click="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.archive-module-list {
  @apply w-full;
}

.empty-state {
  @apply px-4 py-8 text-center text-slate-500 text-sm;
}

.module-groups {
  @apply w-full space-y-2;
}

.tier-section {
  @apply space-y-2;
}

.tier-header {
  @apply flex items-center justify-between px-3 h-8 bg-slate-800/40 rounded cursor-default border border-transparent w-full;
}

.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none;
}

.module-list-scroll {
  @apply overflow-y-auto pr-1;
}

.auto-modules-container {
  @apply space-y-2;
}

.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>