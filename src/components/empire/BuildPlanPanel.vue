<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildPlan } from '@/types/build-plan'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  buildPlan: BuildPlan | null
  loading: boolean
}>()

const moduleName = (moduleId: string): string => {
  const mod = gameData.modulesMap[moduleId]
  return mod ? translateModule(mod) : moduleId
}

const wareName = (wareId: string): string => {
  const w = gameData.waresMap[wareId]
  return w ? translateWare(w) : wareId
}

const expandedSteps = ref<Set<string>>(new Set())

function toggleStep(key: string) {
  if (expandedSteps.value.has(key)) expandedSteps.value.delete(key)
  else expandedSteps.value.add(key)
}

interface MergedStep {
  key: string
  moduleId: string
  count: number
  totalBuild: number
  totalTime: number
  totalCredits: number
  firstOrder: number
  materials: Array<{ wareId: string; quantity: number; creditsNeeded: number }>
}

const mergedSteps = computed(() => {
  if (!props.buildPlan) return []
  const result: MergedStep[] = []
  const moduleTotals = new Map<string, number>()
  for (const s of props.buildPlan.steps) {
    const cur = (moduleTotals.get(s.moduleId) || 0) + s.moduleCount
    moduleTotals.set(s.moduleId, cur)
    const last = result[result.length - 1]
    if (last && last.moduleId === s.moduleId) {
      last.count += s.moduleCount
      last.totalBuild = cur
      last.totalTime += s.moduleBuildTime
      for (const m of s.materials) {
        const existing = last.materials.find(x => x.wareId === m.wareId)
        if (existing) existing.quantity += m.quantity
        else last.materials.push({ ...m })
      }
      last.totalCredits = s.estimatedCredits
    } else {
      result.push({
        key: s.moduleId + '_' + s.order,
        moduleId: s.moduleId,
        count: s.moduleCount,
        totalBuild: cur,
        totalTime: s.moduleBuildTime,
        totalCredits: s.estimatedCredits,
        firstOrder: s.order,
        materials: s.materials.map(m => ({ ...m }))
      })
    }
  }
  return result
})

function formatCredits(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' M'
  if (n >= 1000) return (n / 1000).toFixed(0) + ' K'
  return n.toFixed(0)
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('sector.build_plan.steps') }}</div>
    <div class="panel-content">
      <!-- Empty state -->
      <div v-if="!buildPlan && !loading" class="py-8 text-center text-xs text-slate-500">
        {{ t('sector.build_plan.no_plan') }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="py-8 text-center text-xs text-slate-400">
        {{ t('sector.build_plan.computing') }}
      </div>

      <!-- Summary -->
      <div v-if="buildPlan && buildPlan.steps.length > 0" class="mb-4 p-3 bg-slate-800 rounded border border-slate-700 space-y-1 text-xs">
        <div class="flex justify-between">
          <span class="text-slate-400">{{ t('sector.build_plan.total_duration') }}:</span>
          <span class="text-slate-200 font-medium">{{ formatDuration(buildPlan.totalDuration) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">{{ t('sector.build_plan.total_cost') }}:</span>
          <span class="text-slate-200 font-medium">{{ formatCredits(buildPlan.totalCredits) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">{{ t('sector.build_plan.steps_count') }}:</span>
          <span class="text-slate-200 font-medium">{{ buildPlan.steps.length }}</span>
        </div>
        <div v-if="buildPlan.halted" class="text-red-400 font-medium pt-1 border-t border-slate-700">
          {{ buildPlan.haltReason }}
        </div>
        <div v-if="buildPlan.goalsRemaining.length > 0" class="text-amber-400 pt-1">
          {{ buildPlan.goalsRemaining.length }} {{ t('sector.build_plan.goals_remaining') }}
        </div>
      </div>

      <!-- Steps list (merged) -->
      <div v-if="mergedSteps.length > 0" class="space-y-2">
        <div
          v-for="m in mergedSteps"
          :key="m.key"
          class="border border-slate-700 rounded overflow-hidden"
        >
          <button
            class="w-full flex items-center gap-3 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 transition text-left"
            @click="toggleStep(m.key)"
          >
            <span class="text-xs text-slate-500 font-mono w-12">#{{ m.firstOrder }}</span>
            <span class="text-sm text-slate-200 flex-1 font-medium truncate">{{ moduleName(m.moduleId) }}</span>
            <span class="text-xs text-slate-400">+{{ m.count }} = {{ m.totalBuild }}</span>
            <span class="text-xs text-slate-500 font-mono">{{ formatDuration(m.totalTime) }}</span>
            <span class="text-xs text-amber-400 font-mono">{{ formatCredits(m.totalCredits) }}</span>
            <span class="text-xs text-slate-500 ml-1">{{ expandedSteps.has(m.key) ? '▲' : '▼' }}</span>
          </button>

          <div v-if="expandedSteps.has(m.key)" class="px-3 py-2 bg-slate-900/30 border-t border-slate-700 space-y-1">
            <div class="text-xs text-slate-500 mb-1">{{ t('sector.build_plan.materials') }} (×{{ m.count }}):</div>
            <div v-if="m.materials.length === 0" class="text-xs text-slate-600 italic">
              {{ t('sector.build_plan.no_materials') }}
            </div>
            <div
              v-for="mat in m.materials"
              :key="mat.wareId"
              class="flex items-center gap-2 text-xs py-1"
            >
              <span class="text-slate-300 flex-1 truncate">{{ wareName(mat.wareId) }}</span>
              <span class="text-slate-400 shrink-0">x{{ Math.round(mat.quantity) }}</span>
              <span class="text-amber-400 shrink-0 font-mono">{{ formatCredits(mat.creditsNeeded) }}</span>
              <span class="text-slate-500 text-[10px] shrink-0">(buy)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
