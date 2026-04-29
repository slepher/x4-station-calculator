<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildScheme } from '@/types/build-plan'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  scheme: BuildScheme
}>()

const emit = defineEmits<{
  close: []
}>()

const expandedSteps = ref<Set<string>>(new Set())

function toggleStep(key: string) {
  if (expandedSteps.value.has(key)) expandedSteps.value.delete(key)
  else expandedSteps.value.add(key)
}

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

function modName(moduleId: string): string {
  const mod = gameData.modulesMap[moduleId]
  return mod ? translateModule(mod) : moduleId
}

function wareName(wareId: string): string {
  const w = gameData.waresMap[wareId]
  return w ? translateWare(w) : wareId
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
  const result: MergedStep[] = []
  const moduleTotals = new Map<string, number>()
  for (const s of props.scheme.steps) {
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
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      @click.self="emit('close')"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-slate-200">{{ scheme.label }}</h2>
            <p class="text-xs text-slate-400 mt-0.5">{{ scheme.description }}</p>
          </div>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition text-lg font-bold"
            @click="emit('close')"
          >&times;</button>
        </div>

        <!-- Summary -->
        <div class="px-6 py-3 bg-slate-800/30 border-b border-slate-700/50 shrink-0">
          <div class="flex gap-6 text-xs">
            <div>
              <span class="text-slate-500">{{ t('sector.build_plan.total_duration') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ formatDuration(scheme.totalDuration) }}</span>
            </div>
            <div>
              <span class="text-slate-500">{{ t('sector.build_plan.total_cost') }}:</span>
              <span class="text-amber-400 ml-1 font-medium">{{ formatCredits(scheme.totalCredits) }}</span>
            </div>
            <div>
              <span class="text-slate-500">{{ t('sector.build_plan.steps_count') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ mergedSteps.length }}</span>
            </div>
          </div>
        </div>

        <!-- Steps list -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <div v-if="mergedSteps.length === 0" class="text-center text-xs text-slate-500 py-8">
            {{ t('sector.build_plan.no_steps') }}
          </div>
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
              <span class="text-sm text-slate-200 flex-1 font-medium truncate">{{ modName(m.moduleId) }}</span>
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
  </Teleport>
</template>
