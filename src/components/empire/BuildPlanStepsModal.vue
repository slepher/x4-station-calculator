<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildScheme, BuildSchemeStep } from '@/types/build-plan'
import type { StationSettings } from '@/types/x4'
import { buildStepsScheme, type BuildStepsScheme } from './presenters/buildPlanStepsLogic'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const DEFAULT_BUILD_PLAN_SETTINGS: StationSettings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false,
}

const props = defineProps<{
  scheme: BuildScheme
}>()

const KNOWN_SCHEME_KEYS = [
  'scheme_joint',
  'scheme_materials',
  'scheme_specialized',
  'scheme_basic_materials',
  'scheme_isolated',
  'scheme_production_line',
  'scheme_self_sufficient',
]

function getSchemeLabel(label: string): string {
  if (KNOWN_SCHEME_KEYS.includes(label)) {
    const key = 'build_plan.' + label
    return t(key)
  }
  return label
}

const emit = defineEmits<{
  close: []
}>()

const showStepsMode = ref(false)
const expandedModules = ref<Set<string>>(new Set())
const expandedSteps = ref<Set<number>>(new Set())
const stepsLoading = ref(false)
const cachedStepsScheme = ref<BuildStepsScheme | null>(null)

watch(() => props.scheme, () => {
  showStepsMode.value = false
  expandedModules.value = new Set()
  expandedSteps.value = new Set()
  cachedStepsScheme.value = null
}, { deep: true })

watch(() => props.scheme.modules, () => {
  cachedStepsScheme.value = null
}, { deep: true })

watch(showStepsMode, (newVal) => {
  if (newVal && !cachedStepsScheme.value) {
    stepsLoading.value = true
    setTimeout(() => {
      cachedStepsScheme.value = buildStepsScheme(
        props.scheme,
        gameData.modulesMap,
        gameData.waresMap,
        DEFAULT_BUILD_PLAN_SETTINGS
      )
      stepsLoading.value = false
    }, 0)
  }
})

function toggleModule(moduleId: string) {
  if (expandedModules.value.has(moduleId)) expandedModules.value.delete(moduleId)
  else expandedModules.value.add(moduleId)
}

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
  if (!cachedStepsScheme.value) return []
  const rows: StepRow[] = []
  const moduleCumCount = new Map<string, number>()
  let prevDur = 0
  let prevCr = 0

  for (const step of cachedStepsScheme.value.steps) {
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

const hasEmptyModules = computed(() => props.scheme.modules.length === 0)
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
            <h2 class="text-lg font-bold text-slate-200">{{ getSchemeLabel(scheme.label) }}</h2>
            <p class="text-xs text-slate-400 mt-0.5">{{ scheme.description }}</p>
          </div>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition text-lg font-bold"
            @click="emit('close')"
          >&times;</button>
        </div>

        <!-- Summary with toggle -->
        <div class="px-6 py-3 bg-slate-800/30 border-b border-slate-700/50 shrink-0">
          <div class="flex items-center gap-6 text-xs">
            <div>
              <span class="text-slate-500">{{ t('build_plan.total_duration') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ formatDuration(scheme.totalDuration) }}</span>
            </div>
            <div>
              <span class="text-slate-500">{{ t('build_plan.total_cost') }}:</span>
              <span v-if="!showStepsMode" class="text-amber-400 ml-1 font-medium">{{ formatCredits(scheme.totalCredits) }}</span>
              <span v-else-if="cachedStepsScheme" class="text-amber-400 ml-1 font-medium">{{ formatCredits(cachedStepsScheme.stepsTotalCredits) }}</span>
              <span v-else class="text-amber-400 ml-1 font-medium">{{ formatCredits(scheme.totalCredits) }}</span>
            </div>
            <div v-if="showStepsMode && cachedStepsScheme">
              <span class="text-slate-500">{{ t('build_plan.steps_count') }}:</span>
              <span class="text-slate-200 ml-1 font-medium">{{ cachedStepsScheme.stepsCount }}</span>
            </div>
            
            <!-- Steps toggle -->
            <div v-if="!hasEmptyModules" class="ml-auto flex items-center gap-2">
              <span class="text-xs text-slate-400">{{ t('build_plan.show_steps') }}</span>
              <button
                type="button"
                role="switch"
                :aria-checked="showStepsMode"
                @click="showStepsMode = !showStepsMode"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                :class="showStepsMode ? 'bg-amber-500' : 'bg-slate-600'"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200"
                  :class="showStepsMode ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="stepsLoading" class="flex-1 flex items-center justify-center">
          <div class="text-xs text-slate-400">{{ t('build_plan.loading_steps') }}</div>
        </div>

        <!-- Empty modules fallback -->
        <div v-else-if="hasEmptyModules" class="flex-1 flex items-center justify-center py-8">
          <div class="text-xs text-slate-500 italic">{{ t('build_plan.no_modules') }}</div>
        </div>

        <!-- Default mode: Module summaries -->
        <div v-else-if="!showStepsMode" class="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <div v-if="scheme.moduleSummaries.length === 0" class="text-center text-xs text-slate-500 py-8">
            {{ t('build_plan.no_modules') }}
          </div>

          <div
            v-for="summary in scheme.moduleSummaries"
            :key="summary.moduleId"
            class="border border-slate-700 rounded overflow-hidden"
          >
            <button
              class="w-full flex items-center gap-3 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 transition text-left"
              @click="toggleModule(summary.moduleId)"
            >
              <span class="text-sm text-slate-200 flex-1 font-medium truncate">{{ modName(summary.moduleId) }}</span>
              <span class="text-xs text-slate-400">×{{ summary.moduleCount }}</span>
              <span class="text-xs text-slate-500 font-mono w-16 text-right">{{ formatDuration(summary.totalDuration) }}</span>
              <span class="text-xs text-amber-400 font-mono w-14 text-right">{{ formatCredits(summary.totalCredits) }}</span>
              <span class="text-xs text-slate-500 ml-1">{{ expandedModules.has(summary.moduleId) ? '▲' : '▼' }}</span>
            </button>

            <div v-if="expandedModules.has(summary.moduleId)" class="px-3 py-2 bg-slate-900/30 border-t border-slate-700">
              <div v-if="summary.materials.length === 0" class="text-xs text-slate-600 italic">
                {{ t('build_plan.no_materials') }}
              </div>
              <template v-else>
                <div class="grid text-[10px] text-slate-600 py-0.5 font-mono whitespace-nowrap"
                  style="grid-template-columns: 1fr 5rem 6rem 5rem; gap: 0.5rem;"
                >
                  <span>{{ t('build_plan.materials') }}</span>
                  <span class="text-right">{{ t('build_plan.quantity') }}</span>
                  <span class="text-right">{{ t('build_plan.total_cost') }}</span>
                  <span class="text-right">{{ t('build_plan.unit_price') }}</span>
                </div>
                <div
                  v-for="mat in summary.materials"
                  :key="mat.wareId"
                  class="grid text-xs py-0.5 font-mono whitespace-nowrap"
                  style="grid-template-columns: 1fr 5rem 6rem 5rem; gap: 0.5rem;"
                >
                  <span class="text-slate-300 truncate" style="font-family: inherit;">{{ wareName(mat.wareId) }}</span>
                  <span class="text-slate-400 text-right">×{{ Math.round(mat.quantity) }}</span>
                  <span class="text-amber-400 text-right">{{ formatCredits(mat.totalCredits) }}</span>
                  <span class="text-slate-600 text-right">{{ formatCredits(mat.unitPrice) }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Steps mode: Step list -->
        <div v-else-if="cachedStepsScheme" class="flex-1 overflow-y-auto px-6 py-4 space-y-2">
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