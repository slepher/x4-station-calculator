<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { compareModuleGroupsByPickerOrder, compareModulesByPickerOrder } from '@/store/logic/searchModule'
import StationPlanningItem from '@/components/empire/StationPlanningItem.vue'
import type { SavedModule, X4Module } from '@/types/x4'

const props = defineProps<{
  modules: SavedModule[]
  buildingModules?: SavedModule[]
}>()

const { t } = useI18n()
const gameData = useGameDataStore()

interface GroupedArchiveModule {
  moduleId: string
  group: string
  savedModule: SavedModule
  x4Module: X4Module
  isBuilding?: boolean
}

const groupedModules = computed(() => {
  const groups: Record<string, GroupedArchiveModule[]> = {}
  const modulesMap = gameData.modulesMap
  const moduleGroupsMap = gameData.localizedModuleGroupsMap

  props.modules.forEach((module) => {
    const moduleId = module.id
    const x4Module = modulesMap[moduleId]
    if (!x4Module) return

    const group = x4Module.group || ''
    if (!group) return

    const groupKey = group

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey]!.push({
      moduleId,
      group: groupKey,
      savedModule: module,
      x4Module,
      isBuilding: false
    })
  })

  if (props.buildingModules && props.buildingModules.length > 0) {
    props.buildingModules.forEach((buildingMod) => {
      const moduleId = buildingMod.id
      const x4Module = modulesMap[moduleId]
      if (!x4Module) return

      const group = x4Module.group || ''
      if (!group) return

      if (!groups[group]) groups[group] = []
      groups[group]!.push({
        moduleId,
        group,
        savedModule: buildingMod,
        x4Module,
        isBuilding: true
      })
    })
  }

  Object.keys(groups).forEach((groupKey) => {
    const groupModules = groups[groupKey]
    if (!groupModules) return

    const builtModules = groupModules.filter(m => !m.isBuilding)
    const buildingMods = groupModules.filter(m => m.isBuilding)

    builtModules.sort((a, b) =>
      compareModulesByPickerOrder(
        { id: a.moduleId, group: groupKey },
        { id: b.moduleId, group: groupKey },
        moduleGroupsMap
      )
    )

    buildingMods.sort((a, b) =>
      compareModulesByPickerOrder(
        { id: a.moduleId, group: groupKey },
        { id: b.moduleId, group: groupKey },
        moduleGroupsMap
      )
    )

    groups[groupKey] = [...builtModules, ...buildingMods]
  })

  return Object.keys(groups)
    .sort((a, b) => compareModuleGroupsByPickerOrder(a, b, moduleGroupsMap))
    .map((groupKey) => ({
      group: groupKey,
      displayLabel: moduleGroupsMap[groupKey]?.localeName || groupKey,
      modules: groups[groupKey] || [],
      hasBuilding: groups[groupKey]?.some(m => m.isBuilding) || false
    }))
})

const hasModules = computed(() => props.modules.length > 0 || (props.buildingModules?.length ?? 0) > 0)

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
          <div class="modules-container">
            <StationPlanningItem
              v-for="module in group.modules.filter(m => !m.isBuilding)"
              :key="module.moduleId"
              :item="module.savedModule"
              :info="getModuleInfo(module)"
              :readonly="true"
              :no-click="true"
            />
            <template v-if="group.hasBuilding">
              <div class="building-section">
                <StationPlanningItem
                  v-for="module in group.modules.filter(m => m.isBuilding)"
                  :key="module.moduleId + '-building'"
                  :item="module.savedModule"
                  :info="getModuleInfo(module)"
                  :readonly="true"
                  :no-click="true"
                />
              </div>
            </template>
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

.modules-container {
  @apply space-y-2;
}

.building-section {
  @apply border-l-2 border-dashed border-amber-600/40 pl-2 ml-1 space-y-2;
}

.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>