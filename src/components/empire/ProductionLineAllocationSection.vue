<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import { type BuildGoal, type ProductionLineAllocation } from '@/types/build-plan'
import type { LocalizedX4Ware, LocalizedX4Module, LocalizedX4ModuleGroup } from '@/types/x4'

const { t } = useI18n()
const gameData = useGameDataStore()

const props = defineProps<{
  allocations: ProductionLineAllocation[]
  goals: BuildGoal[]
  racePreference: string
  readonly?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'update-goal': [index: number, value: number]
  'remove-goal': [index: number]
}>()

function getStoreIndex(goal: BuildGoal): number | undefined {
  const idx = props.goals.indexOf(goal)
  return idx >= 0 ? idx : undefined
}

function isSameGoal(left: BuildGoal, right: BuildGoal): boolean {
  if (left.type !== right.type) return false
  if (left.type === 'production-rate' && right.type === 'production-rate') {
    return left.wareId === right.wareId && left.ratePerHour === right.ratePerHour
  }
  if (left.type === 'build-module' && right.type === 'build-module') {
    return left.moduleId === right.moduleId && left.count === right.count
  }
  if ('wareId' in left && 'wareId' in right) {
    return left.wareId === right.wareId && ('ratePerHour' in left ? left.ratePerHour : 0) === ('ratePerHour' in right ? right.ratePerHour : 0)
  }
  return false
}

function getGoalStoreIndex(goal: BuildGoal): number | undefined {
  const direct = getStoreIndex(goal)
  if (direct !== undefined) return direct
  const fallbackIndex = props.goals.findIndex(storeGoal => isSameGoal(storeGoal, goal))
  return fallbackIndex >= 0 ? fallbackIndex : undefined
}

function isDerived(goal: BuildGoal): boolean {
  return goal.type === 'target-production' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production'
}

function derivedTag(goal: BuildGoal): string | null {
  if (goal.type === 'target-production') return t('build_plan.target_short')
  if (goal.type === 'derived-build-material') return t('build_plan.build_material_short')
  if (goal.type === 'derived-production') return t('build_plan.production_short')
  if (goal.type === 'required-production') return t('build_plan.required_short')
  return null
}

function getGoalDisplayInfo(goal: BuildGoal): {
  displayName: string
  wareInfo?: LocalizedX4Ware
  moduleInfo?: LocalizedX4Module
  moduleGroup?: LocalizedX4ModuleGroup
} {
  if (goal.type === 'target-production' && goal.moduleId) {
    const module = gameData.localizedModulesMap[goal.moduleId]
    const group = module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
    return {
      displayName: module?.localeName || goal.moduleId,
      moduleInfo: module,
      moduleGroup: group,
    }
  }
  if (goal.type === 'production-rate' || goal.type === 'target-production' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') {
    if (!goal.wareId) return { displayName: '' }
    const ware = gameData.localizedWaresMap[goal.wareId]
    const module = gameData.findModuleForWare(goal.wareId, props.racePreference)
    const group = module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
    return {
      displayName: ware?.localeName || goal.wareId,
      wareInfo: ware,
      moduleGroup: group,
    }
  }
  if (goal.type === 'build-module') {
    const module = gameData.localizedModulesMap[goal.moduleId]
    const group = module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
    return {
      displayName: module?.localeName || goal.moduleId,
      moduleInfo: module,
      moduleGroup: group,
    }
  }
  return { displayName: '' }
}

function getColorBarStyle(goal: BuildGoal): Record<string, string> {
  const info = getGoalDisplayInfo(goal)
  const colorRgb = info.moduleGroup?.color_rgb
  if (colorRgb) {
    return { backgroundColor: colorRgb }
  }
  return { backgroundColor: '#0ea5e9' }
}

function getDlcTag(goal: BuildGoal): { label: string; isActive: boolean } | null {
  if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') {
    const ware = gameData.localizedWaresMap[goal.wareId]
    if (ware && ware.dlc_tag !== 'base') {
      return {
        label: gameData.getDlcDisplayName(ware.dlc_tag),
        isActive: gameData.isDlcActive(ware.dlc_tag),
      }
    }
  }
  if (goal.type === 'build-module') {
    const module = gameData.localizedModulesMap[goal.moduleId]
    if (module && module.dlc_tag !== 'base') {
      return {
        label: gameData.getDlcDisplayName(module.dlc_tag),
        isActive: gameData.isDlcActive(module.dlc_tag),
      }
    }
  }
  if (goal.type === 'target-production') {
    if (goal.wareId) {
      const ware = gameData.localizedWaresMap[goal.wareId]
      if (ware && ware.dlc_tag !== 'base') {
        return {
          label: gameData.getDlcDisplayName(ware.dlc_tag),
          isActive: gameData.isDlcActive(ware.dlc_tag),
        }
      }
    }
    if (goal.moduleId) {
      const module = gameData.localizedModulesMap[goal.moduleId]
      if (module && module.dlc_tag !== 'base') {
        return {
          label: gameData.getDlcDisplayName(module.dlc_tag),
          isActive: gameData.isDlcActive(module.dlc_tag),
        }
      }
    }
  }
  return null
}
</script>

<template>
  <div v-if="allocations.length > 0" class="allocation-section space-y-2" data-testid="allocation-section">
    <div v-if="title" class="allocation-section-title">{{ title }}</div>
    <div
      v-for="alloc in allocations"
      :key="alloc.groupId || '__unmatched__'"
      class="allocation-group"
      :class="alloc.isUnmatched ? 'allocation-group--unmatched' : ''"
    >
      <div class="allocation-group-header">
        <span class="allocation-group-name">
          {{ alloc.isUnmatched ? t('build_plan.unmatched') : alloc.groupName || alloc.groupId }}
        </span>
        <span class="allocation-group-count">{{ alloc.goals.length }}</span>
      </div>

      <div class="allocation-goal-list">
        <div
          v-for="(goal, idx) in alloc.goals"
          :key="`${alloc.groupId || 'un'}-${idx}`"
          class="goal-row"
          :class="isDerived(goal) ? 'goal-row--derived' : ''"
        >
          <div class="color-bar" :style="getColorBarStyle(goal)"></div>

          <div class="goal-info">
            <div class="goal-title-row">
              <span class="goal-name">{{ getGoalDisplayInfo(goal).displayName }}</span>
              <span
                v-if="getDlcTag(goal)"
                class="dlc-tag"
                :class="getDlcTag(goal)!.isActive ? 'dlc-tag--active' : 'dlc-tag--inactive'"
              >
                {{ getDlcTag(goal)!.label }}
              </span>
            </div>
          </div>

          <div class="goal-controls">
            <template v-if="readonly || isDerived(goal)">
              <span v-if="derivedTag(goal)" class="derived-tag">{{ derivedTag(goal) }}</span>
              <span class="derived-badge" :title="t('build_plan.derived_locked')">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
            </template>
            <template v-else>
              <X4NumberInput
                :modelValue="goal.type === 'production-rate' ? goal.ratePerHour : (goal.type === 'build-module' ? goal.count : 0)"
                @update:modelValue="(v: number) => {
                  const si = getStoreIndex(goal)
                  const resolvedIndex = si ?? getGoalStoreIndex(goal)
                  if (resolvedIndex !== undefined) emit('update-goal', resolvedIndex, v)
                }"
                width-class="w-14"
                :min="1"
                :step="1"
                class="goal-number-input"
              />
              <button
                class="remove-btn"
                :title="t('planning.remove')"
                @click="() => {
                  const si = getGoalStoreIndex(goal)
                  if (si !== undefined) emit('remove-goal', si)
                }"
              >×</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .allocation-section {
  }

  .allocation-section-title {
    @apply text-xs font-semibold text-slate-400 uppercase tracking-wider;
  }

.allocation-group {
  @apply bg-slate-800/40 border border-slate-700/60 rounded overflow-hidden;
}

.allocation-group--unmatched {
  @apply border-slate-600/30 border-dashed;
}

.allocation-group-header {
  @apply flex items-center justify-between px-2 py-1 bg-slate-700/40 border-b border-slate-700/60;
}

.allocation-group-name {
  @apply text-xs font-medium text-slate-300 truncate;
}

.allocation-group-count {
  @apply text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded;
}

.allocation-goal-list {
  @apply divide-y divide-slate-700/30;
}

.goal-row {
  @apply flex items-center px-2 py-1.5 hover:bg-slate-700/20 transition-colors;
}

.goal-row--derived {
  @apply bg-slate-800/40;
}

.color-bar {
  @apply w-1 h-5 rounded-sm mr-1.5 flex-shrink-0;
}

.goal-info {
  @apply flex-1 min-w-0 mr-1.5;
}

.goal-title-row {
  @apply flex items-center gap-1 min-w-0;
}

.goal-name {
  @apply truncate text-xs text-slate-300;
}

.dlc-tag {
  @apply inline-flex max-w-[80px] flex-shrink-0 items-center rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wide;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.goal-controls {
  @apply flex items-center gap-1 flex-shrink-0;
}

.derived-badge {
  @apply text-slate-500;
}

.derived-tag {
  @apply text-[10px] px-1 py-0.5 rounded font-medium;
}

.derived-tag:has(+ .derived-badge) {
  @apply mr-1;
}

.goal-row--derived .derived-tag {
  @apply bg-amber-800/40 text-amber-300;
}

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1 transition-colors text-base leading-none cursor-pointer;
}
</style>
