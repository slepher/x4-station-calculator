<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import BuildGoalSearchBox from './BuildGoalSearchBox.vue'
import WarePlanningItem from './WarePlanningItem.vue'
import { BootstrapMode, type BuildGoal } from '@/types/build-plan'
import type { LocalizedX4Ware, LocalizedX4Module, LocalizedX4ModuleGroup } from '@/types/x4'

const { t } = useI18n()
const gameData = useGameDataStore()

const props = defineProps<{
  goals: BuildGoal[]
  bootstrapMode: BootstrapMode
  racePreference: string
  buildPlan: { schemes: unknown[]; halted: boolean; haltReason: string; goalsAchieved: unknown[]; goalsRemaining: unknown[] } | null
  loading: boolean
  warnings: string[]
}>()

const emit = defineEmits<{
  addGoal: [goal: BuildGoal]
  removeGoal: [index: number]
  updateGoal: [index: number, value: number]
  setBootstrapMode: [mode: BootstrapMode]
  computePlan: []
}>()

function getGoalDisplayInfo(goal: BuildGoal): {
  displayName: string
  wareInfo?: LocalizedX4Ware
  moduleInfo?: LocalizedX4Module
  moduleGroup?: LocalizedX4ModuleGroup
} {
  if (goal.type === 'production-rate') {
    const ware = gameData.localizedWaresMap[goal.wareId]
    const module = gameData.findModuleForWare(goal.wareId, props.racePreference)
    const group = module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
    return {
      displayName: ware?.localeName || goal.wareId,
      wareInfo: ware,
      moduleGroup: group
    }
  }
  if (goal.type === 'build-module') {
    const module = gameData.localizedModulesMap[goal.moduleId]
    const group = module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
    return {
      displayName: module?.localeName || goal.moduleId,
      moduleInfo: module,
      moduleGroup: group
    }
  }
  return { displayName: '' }
}

const visibleGoals = computed(() => props.goals.filter(g => g.type === 'production-rate' || g.type === 'build-module'))

const schemeCount = computed(() => props.buildPlan?.schemes?.length || 0)

function onCompute() {
  emit('computePlan')
}

function onUpdateGoal(index: number, value: number) {
  emit('updateGoal', index, value)
}

function onRemoveGoal(index: number) {
  emit('removeGoal', index)
}

function onBootstrapModeChange(e: Event) {
  emit('setBootstrapMode', (e.target as HTMLSelectElement).value as BootstrapMode)
}

const bootstrapOptions = [
  { value: BootstrapMode.None, label: 'build_plan.bootstrap_none' },
  { value: BootstrapMode.Joint, label: 'build_plan.bootstrap_joint' },
  { value: BootstrapMode.CoupledIterative, label: 'build_plan.bootstrap_coupled' },
  { value: BootstrapMode.IsolatedSpecialized, label: 'build_plan.bootstrap_isolated' },
  { value: BootstrapMode.NestedJoint, label: 'build_plan.bootstrap_nested' },
]
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('build_plan.title') }}</div>
    <div class="panel-content space-y-3">

      <BuildGoalSearchBox :racePreference="racePreference" @addGoal="emit('addGoal', $event)" />

      <div v-if="visibleGoals.length === 0" class="text-xs text-slate-500 italic text-center py-2">
        {{ t('build_plan.no_goals') }}
      </div>
      <div v-else class="goal-list space-y-1">
        <WarePlanningItem
          v-for="(goal, idx) in visibleGoals"
          :key="idx"
          :goal="goal"
          :displayName="getGoalDisplayInfo(goal).displayName"
          :wareInfo="getGoalDisplayInfo(goal).wareInfo"
          :moduleInfo="getGoalDisplayInfo(goal).moduleInfo"
          :moduleGroup="getGoalDisplayInfo(goal).moduleGroup"
          @update:value="onUpdateGoal(props.goals.indexOf(goal), $event)"
          @remove="onRemoveGoal(props.goals.indexOf(goal))"
        />
      </div>

      <button
        class="w-full px-4 py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading"
        @click="onCompute"
      >
        <span v-if="loading">{{ t('build_plan.computing') }}</span>
        <span v-else>{{ t('build_plan.compute') }}</span>
      </button>

      <div class="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded border border-slate-700/50">
        <label class="flex items-center gap-2">
          <span class="text-xs text-slate-300 whitespace-nowrap">{{ t('build_plan.bootstrap_mode') }}</span>
          <select
            :value="bootstrapMode"
            @change="onBootstrapModeChange"
            class="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200 focus:ring-amber-500/50 focus:border-amber-500/50"
          >
            <option
              v-for="opt in bootstrapOptions"
              :key="opt.value"
              :value="opt.value"
            >{{ t(opt.label) }}</option>
          </select>
        </label>
        <div v-if="schemeCount > 0" class="text-xs text-slate-400 ml-auto">
          {{ schemeCount }} {{ t('build_plan.schemes_generated') }}
        </div>
      </div>

      <div
        v-for="(w, idx) in warnings"
        :key="idx"
        class="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300"
      >{{ w }}</div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/60 border border-slate-700 rounded-lg overflow-hidden;
}

.panel-header {
  @apply px-4 py-3 bg-slate-800/80 border-b border-slate-700 text-sm font-semibold text-slate-300 uppercase tracking-wider;
}

.panel-content {
  @apply p-4;
}

.goal-list {
  @apply max-h-48 overflow-y-auto;
}
</style>