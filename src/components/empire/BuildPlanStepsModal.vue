<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildScheme, BuildSchemeStep } from '@/types/build-plan'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  scheme: BuildScheme
}>()

const emit = defineEmits<{
  close: []
}>()

const expandedSteps = ref<Set<number>>(new Set())

function toggleStep(order: number) {
  if (expandedSteps.value.has(order)) expandedSteps.value.delete(order)
  else expandedSteps.value.add(order)
}

function formatCredits(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toFixed(0)
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 1) return `${hours.toFixed(2)}h`
  const mins = Math.floor(seconds / 60)
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

function warePrice(wareId: string): number {
  return gameData.waresMap[wareId]?.price || 0
}

interface StepRow {
  step: BuildSchemeStep
  cumCount: number
  cumDur: number
  cumCr: number
  stepDur: number
  stepCr: number
  filteredMaterials: Array<{
    wareId: string
    quantity: number
    stockBefore: number
    currentProdRate: number
    producedDuringBuild: number
    creditsNeeded: number
    price: number
  }>
}

const stepRows = computed(() => {
  const rows: StepRow[] = []
  const moduleCumCount = new Map<string, number>()
  let prevDur = 0
  let prevCr = 0

  for (const step of props.scheme.steps) {
    const cur = (moduleCumCount.get(step.moduleId) || 0) + step.moduleCount
    moduleCumCount.set(step.moduleId, cur)

    const stepDur = step.estimatedDuration - prevDur
    const stepCr = step.estimatedCredits - prevCr
    prevDur = step.estimatedDuration
    prevCr = step.estimatedCredits

    const filteredMaterials = step.materials
      .map(m => ({
        wareId: m.wareId,
        quantity: m.quantity,
        stockBefore: m.stockBefore,
        currentProdRate: m.currentProdRate,
        producedDuringBuild: m.producedDuringBuild,
        creditsNeeded: m.creditsNeeded,
        price: warePrice(m.wareId)
      }))

    rows.push({
      step,
      cumCount: cur,
      cumDur: prevDur,
      cumCr: prevCr,
      stepDur,
      stepCr,
      filteredMaterials
    })
  }
  return rows
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      @click.self="emit('close')"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-slate-200">{{ t('build_plan.' + scheme.label) }}</h2>
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
              <span class="text-slate-500">{{ t('build_plan.total_duration') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ formatDuration(scheme.totalDuration) }}</span>
            </div>
            <div>
              <span class="text-slate-500">{{ t('build_plan.total_cost') }}:</span>
              <span class="text-amber-400 ml-1 font-medium">{{ formatCredits(scheme.totalCredits) }}</span>
            </div>
            <div>
              <span class="text-slate-500">{{ t('build_plan.steps_count') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ scheme.stepsCount }}</span>
            </div>
          </div>
        </div>

        <!-- Steps list -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <div v-if="stepRows.length === 0" class="text-center text-xs text-slate-500 py-8">
            {{ t('build_plan.no_steps') }}
          </div>

          <div
            v-for="row in stepRows"
            :key="row.step.order"
            class="border border-slate-700 rounded overflow-hidden"
          >
            <button
              class="w-full flex items-center gap-3 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 transition text-left"
              @click="toggleStep(row.step.order)"
            >
              <span class="text-xs text-slate-500 font-mono w-8">#{{ row.step.order }}</span>
              <span class="text-sm text-slate-200 flex-1 font-medium truncate">{{ modName(row.step.moduleId) }}</span>
              <span class="text-xs text-slate-400">{{ row.cumCount }}</span>
              <span class="text-xs text-slate-500 font-mono w-16 text-right">{{ formatDuration(row.stepDur) }}</span>
              <span class="text-xs text-amber-400 font-mono w-14 text-right">{{ formatCredits(row.stepCr) }}</span>
              <span class="text-xs text-slate-500 ml-1">{{ expandedSteps.has(row.step.order) ? '▲' : '▼' }}</span>
            </button>

            <div v-if="expandedSteps.has(row.step.order)" class="px-3 py-2 bg-slate-900/30 border-t border-slate-700">
              <div v-if="row.filteredMaterials.length === 0" class="text-xs text-slate-600 italic">
                {{ t('build_plan.no_materials') }}
              </div>
              <template v-else>
                <div class="grid text-[10px] text-slate-600 py-0.5 font-mono whitespace-nowrap"
                  style="grid-template-columns: 1fr 4rem 4rem 5rem 3rem 5rem 4rem; gap: 0.5rem;"
                >
                  <span>{{ t('build_plan.materials') }}</span>
                  <span class="text-right">×{{ t('build_plan.count') }}</span>
                  <span class="text-right">{{ t('build_plan.stock') }}</span>
                  <span class="text-right">{{ t('build_plan.self_prod') }}/h</span>
                  <span class="text-right">+{{ t('build_plan.produced') }}</span>
                  <span class="text-right">{{ t('build_plan.buy') }}</span>
                  <span class="text-right">{{ t('build_plan.unit_price') }}</span>
                </div>
                <div
                  v-for="mat in row.filteredMaterials"
                  :key="mat.wareId"
                  class="grid text-xs py-0.5 font-mono whitespace-nowrap"
                  style="grid-template-columns: 1fr 4rem 4rem 5rem 3rem 5rem 4rem; gap: 0.5rem;"
                >
                  <span class="text-slate-300 truncate" style="font-family: inherit;">{{ wareName(mat.wareId) }}</span>
                  <span class="text-slate-400 text-right">×{{ Math.round(mat.quantity) }}</span>
                  <span class="text-slate-500 text-right">{{ Math.round(mat.stockBefore) }}</span>
                  <span class="text-slate-500 text-right">{{ Math.round(mat.currentProdRate) }}/h</span>
                  <span class="text-slate-500 text-right">+{{ Math.round(mat.producedDuringBuild) }}</span>
                  <span class="text-amber-400 text-right">{{ formatCredits(mat.creditsNeeded) }}</span>
                  <span class="text-slate-600 text-right">{{ formatCredits(mat.price) }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
