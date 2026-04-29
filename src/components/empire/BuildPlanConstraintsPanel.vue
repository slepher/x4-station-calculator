<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { generateFilteredModulesGrouped } from '@/store/logic/searchModule'
import type { BuildGoal } from '@/types/build-plan'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  goals: BuildGoal[]
  buildPlan: { schemes: unknown[]; halted: boolean; haltReason: string; goalsAchieved: unknown[]; goalsRemaining: unknown[] } | null
  loading: boolean
  warnings: string[]
}>()

const emit = defineEmits<{
  addGoal: [goal: BuildGoal]
  removeGoal: [index: number]
  computePlan: []
}>()

const newGoalType = ref<'self-sufficient' | 'production-rate' | 'build-module'>('self-sufficient')
const selectedWareId = ref('')
const selectedModuleId = ref('')
const newGoalRate = ref(1000)
const newGoalCount = ref(1)
const wareSearch = ref('')
const moduleSearch = ref('')
const warePickerOpen = ref(false)
const modulePickerOpen = ref(false)

const filteredWares = computed(() => {
  const q = wareSearch.value.toLowerCase()
  return Object.values(gameData.waresMap)
    .filter(w => {
      const hasProducer = Object.values(gameData.modulesMap).some(m => m.outputs[w.id] && m.type === 'production')
      return hasProducer && (w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q))
    })
    .slice(0, 50)
})

const filteredModules = computed(() => {
  return generateFilteredModulesGrouped(
    moduleSearch.value,
    gameData.currentLocale,
    gameData.localizedModulesMap,
    gameData.localizedModuleGroupsMap
  ).flatMap(g => g.modules).slice(0, 50)
})

function selectWare(wareId: string) {
  selectedWareId.value = wareId
  const w = gameData.waresMap[wareId]
  wareSearch.value = w ? translateWare(w) : wareId
  warePickerOpen.value = false
}

function selectModule(moduleId: string) {
  selectedModuleId.value = moduleId
  const m = gameData.modulesMap[moduleId]
  moduleSearch.value = m ? translateModule(m) : moduleId
  modulePickerOpen.value = false
}

function addGoal() {
  let goal: BuildGoal
  switch (newGoalType.value) {
    case 'self-sufficient':
      goal = { type: 'self-sufficient' }
      break
    case 'production-rate':
      if (!selectedWareId.value) return
      goal = { type: 'production-rate', wareId: selectedWareId.value, ratePerHour: newGoalRate.value }
      break
    case 'build-module':
      if (!selectedModuleId.value) return
      goal = { type: 'build-module', moduleId: selectedModuleId.value, count: newGoalCount.value }
      break
  }
  emit('addGoal', goal)
  selectedWareId.value = ''
  selectedModuleId.value = ''
  wareSearch.value = ''
  moduleSearch.value = ''
}

function onCompute() {
  emit('computePlan')
}

function wareDisplayName(wareId: string): string {
  const w = gameData.waresMap[wareId]
  return w ? translateWare(w) : wareId
}

function moduleDisplayName(moduleId: string): string {
  const m = gameData.modulesMap[moduleId]
  return m ? translateModule(m) : moduleId
}

function goalLabel(goal: BuildGoal): string {
  switch (goal.type) {
    case 'self-sufficient': return t('sector.build_plan.self_sufficient')
    case 'production-rate': return `${wareDisplayName(goal.wareId)} @ ${goal.ratePerHour}/h`
    case 'build-module': return `${moduleDisplayName(goal.moduleId)} x${goal.count}`
    default: return goal.type
  }
}

const schemeCount = computed(() => props.buildPlan?.schemes?.length || 0)
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('sector.build_plan.title') }}</div>
    <div class="panel-content space-y-4">

      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {{ t('sector.build_plan.goals') }}
        </div>
        <div v-if="goals.length === 0" class="text-xs text-slate-500 italic">
          {{ t('sector.build_plan.no_goals') }}
        </div>
        <div
          v-for="(goal, idx) in goals"
          :key="idx"
          class="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded border border-slate-700 mb-1"
        >
          <span class="text-xs text-slate-300 flex-1 truncate">{{ goalLabel(goal) }}</span>
          <button
            class="text-xs text-red-400 hover:text-red-300 font-bold px-1 shrink-0"
            @click="emit('removeGoal', idx)"
          >&times;</button>
        </div>
      </div>

      <div class="space-y-2 p-3 bg-slate-800/30 rounded border border-slate-700/50">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {{ t('sector.build_plan.add_goal') }}
        </div>

        <select
          v-model="newGoalType"
          class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
        >
          <option value="self-sufficient">{{ t('sector.build_plan.self_sufficient') }}</option>
          <option value="production-rate">{{ t('sector.build_plan.production_rate') }}</option>
          <option value="build-module">{{ t('sector.build_plan.build_module') }}</option>
        </select>

        <template v-if="newGoalType === 'production-rate'">
          <div class="relative">
            <input
              v-model="wareSearch"
              :placeholder="t('sector.build_plan.select_ware')"
              class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              @focus="warePickerOpen = true"
            />
            <div
              v-if="warePickerOpen && filteredWares.length > 0"
              class="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded shadow-lg"
              @mouseleave="warePickerOpen = false"
            >
              <button
                v-for="w in filteredWares"
                :key="w.id"
                class="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 truncate"
                @mousedown.prevent="selectWare(w.id)"
              >{{ translateWare(w) }}</button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">{{ t('sector.build_plan.rate') }}:</span>
            <input
              v-model.number="newGoalRate"
              type="number"
              min="1"
              class="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
            />
          </div>
        </template>

        <template v-if="newGoalType === 'build-module'">
          <div class="relative">
            <input
              v-model="moduleSearch"
              :placeholder="t('sector.build_plan.select_module')"
              class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              @focus="modulePickerOpen = true"
            />
            <div
              v-if="modulePickerOpen && filteredModules.length > 0"
              class="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded shadow-lg"
              @mouseleave="modulePickerOpen = false"
            >
              <button
                v-for="m in filteredModules"
                :key="m.id"
                class="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 truncate"
                @mousedown.prevent="selectModule(m.id)"
              >{{ gameData.modulesMap[m.id] ? translateModule(gameData.modulesMap[m.id]!) : m.displayLabel || m.id }}</button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">{{ t('sector.build_plan.count') }}:</span>
            <input
              v-model.number="newGoalCount"
              type="number"
              min="1"
              class="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
            />
          </div>
        </template>

        <button
          class="w-full px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition"
          @click="addGoal"
        >+ {{ t('sector.build_plan.add') }}</button>
      </div>

      <button
        class="w-full px-4 py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading || goals.length === 0"
        @click="onCompute"
      >
        <span v-if="loading">{{ t('sector.build_plan.computing') }}</span>
        <span v-else>{{ t('sector.build_plan.compute') }}</span>
      </button>

      <div v-if="schemeCount > 0" class="px-3 py-2 bg-slate-800 rounded border border-slate-700 text-xs text-slate-400">
        {{ schemeCount }} {{ t('sector.build_plan.schemes_generated') }}
      </div>

      <div
        v-for="(w, idx) in warnings"
        :key="idx"
        class="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300"
      >{{ w }}</div>
    </div>
  </div>
</template>
