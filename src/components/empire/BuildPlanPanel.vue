<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildScheme, BuildSchemeGroup } from '@/types/build-plan'
import BuildPlanStepsModal from './BuildPlanStepsModal.vue'

const { t } = useI18n()
const { translateModule, translateWare } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  schemes: BuildScheme[]
  loading: boolean
  schemeGroups?: BuildSchemeGroup[]
}>()

const selectedScheme = ref<BuildScheme | null>(null)
const modalOpen = ref(false)

function getSchemeLabel(label: string): string {
  if (!label.startsWith('scheme_')) return label
  return t('build_plan.' + label)
}

function openScheme(scheme: BuildScheme) {
  selectedScheme.value = scheme
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selectedScheme.value = null
}

function formatCredits(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toFixed(0)
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 1) return `${hours.toFixed(2)}h`
  const mins = Math.floor(seconds / 60)
  return `${mins}m`
}

function formatRate(rate: number): string {
  return rate.toFixed(1)
}

function moduleName(moduleId: string): string {
  const mod = gameData.modulesMap[moduleId]
  return mod ? translateModule(mod) : moduleId
}

function wareName(wareId: string): string {
  const w = gameData.waresMap[wareId]
  return w ? translateWare(w) : wareId
}

const schemeIcons: Record<string, string> = {
  'scheme_self_sufficient': '1',
  'scheme_joint': '1',
  'scheme_materials': '1',
  'scheme_specialized': '2',
  'scheme_basic_materials': '2',
  'scheme_isolated': '1',
}

const schemeColors: Record<string, string> = {
  'scheme_self_sufficient': 'border-emerald-600 hover:bg-emerald-900/20',
  'scheme_joint': 'border-emerald-600 hover:bg-emerald-900/20',
  'scheme_materials': 'border-emerald-600 hover:bg-emerald-900/20',
  'scheme_specialized': 'border-amber-600 hover:bg-amber-900/20',
  'scheme_basic_materials': 'border-emerald-600 hover:bg-emerald-900/20',
  'scheme_isolated': 'border-amber-600 hover:bg-amber-900/20',
  'scheme_production_line': 'border-blue-600 hover:bg-blue-900/20',
}

interface SchemeCardData {
  scheme: BuildScheme
  primaryModuleLines: string[]
  derivedModuleLines: string[]
  materialLines: Array<{ name: string; qty: number }>
  productionLines: Array<{ name: string; rate: number }>
}

function toCardData(scheme: BuildScheme): SchemeCardData {
  const primarySet = new Set(scheme.primaryModuleIds)
  const primaryModules = scheme.modules.filter(m => primarySet.has(m.id))
  const derivedModules = scheme.modules.filter(m => !primarySet.has(m.id))

  const primaryModuleLines = primaryModules.map(m => `${moduleName(m.id)} ×${m.count}`)
  const derivedModuleLines = derivedModules.map(m => `${moduleName(m.id)} ×${m.count}`)

  const materialLines = Object.entries(scheme.buildMaterialTotals)
    .filter(([wareId]) => wareId !== 'energycells')
    .sort((a, b) => b[1] - a[1])
    .map(([wareId, qty]) => ({ name: wareName(wareId), qty }))

  const purposeWareSet = new Set(scheme.purposeModules)
  const productionLines = Object.entries(scheme.netProduction)
    .filter(([wareId, rate]) => rate > 0 && purposeWareSet.has(wareId))
    .sort((a, b) => b[1] - a[1])
    .map(([wareId, rate]) => ({ name: wareName(wareId), rate }))

  return { scheme, primaryModuleLines, derivedModuleLines, materialLines, productionLines }
}

function computeCards(schemes: BuildScheme[]): SchemeCardData[] {
  return schemes.map(toCardData)
}

const schemeCards = computed<SchemeCardData[]>(() => {
  return props.schemes.map(toCardData)
})
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('build_plan.schemes') }}</div>
    <div class="panel-content">
      <div v-if="!loading && schemes.length === 0" class="py-8 text-center text-xs text-slate-500">
        {{ t('build_plan.no_plan') }}
      </div>

      <div v-if="loading" class="py-8 text-center text-xs text-slate-400">
        {{ t('build_plan.computing') }}
      </div>

      <div v-if="schemeGroups && schemeGroups.length > 0" class="space-y-4">
        <div v-for="group in schemeGroups" :key="group.groupType" class="space-y-2">
          <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">{{ group.groupLabel }}</div>
          <div
            v-for="card in computeCards(group.schemes)"
            :key="card.scheme.label"
            class="border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 bg-slate-800/50"
            :class="schemeColors[card.scheme.label] || 'border-slate-600 hover:bg-slate-700/50'"
            @click="openScheme(card.scheme)"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span
                  class="w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
                >{{ schemeIcons[card.scheme.label] || group.schemes.indexOf(card.scheme) + 1 }}</span>
                 <span class="text-sm font-bold text-slate-200">{{ getSchemeLabel(card.scheme.label) }}</span>
              </div>
              <div class="text-xs text-slate-400 font-mono">
                {{ formatDuration(card.scheme.totalDuration) }} │ {{ formatCredits(card.scheme.totalCredits) }} │ {{ card.scheme.stepsCount }} {{ t('build_plan.steps_count').toLowerCase() }}
              </div>
            </div>

            <p v-if="card.scheme.description" class="text-xs text-slate-400 mb-2">{{ card.scheme.description }}</p>

            <div v-if="card.primaryModuleLines.length > 0" class="mb-2">
              <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.primary_modules') }}</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(line, i) in card.primaryModuleLines"
                  :key="i"
                  class="px-2 py-0.5 text-[10px] rounded bg-slate-700/50 text-emerald-300 border border-emerald-700/50"
                >{{ line }}</span>
              </div>
            </div>

            <div v-if="card.derivedModuleLines.length > 0" class="mb-2">
              <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.derived_modules') }}</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(line, i) in card.derivedModuleLines"
                  :key="i"
                  class="px-2 py-0.5 text-[10px] rounded bg-slate-700/50 text-slate-300 border border-slate-600"
                >{{ line }}</span>
              </div>
            </div>

            <div v-if="card.productionLines.length > 0" class="mb-2">
              <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.main_production') }}</div>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5">
                <span
                  v-for="p in card.productionLines"
                  :key="p.name"
                  class="text-[10px] text-emerald-400"
                >{{ p.name }} {{ formatRate(p.rate) }}/h</span>
              </div>
            </div>

            <div v-if="card.materialLines.length > 0">
              <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.build_materials') }}</div>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5">
                <span
                  v-for="m in card.materialLines"
                  :key="m.name"
                  class="text-[10px] text-slate-400"
                >{{ m.name }} ×{{ Math.round(m.qty) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="schemes.length > 0" class="space-y-3">
        <div
          v-for="card in schemeCards"
          :key="card.scheme.label"
          class="border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 bg-slate-800/50"
          :class="schemeColors[card.scheme.label] || 'border-slate-600 hover:bg-slate-700/50'"
          @click="openScheme(card.scheme)"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
              >{{ schemeIcons[card.scheme.label] || schemes.indexOf(card.scheme) + 1 }}</span>
               <span class="text-sm font-bold text-slate-200">{{ getSchemeLabel(card.scheme.label) }}</span>
            </div>
            <div class="text-xs text-slate-400 font-mono">
              {{ formatDuration(card.scheme.totalDuration) }} │ {{ formatCredits(card.scheme.totalCredits) }} │ {{ card.scheme.stepsCount }} {{ t('build_plan.steps_count').toLowerCase() }}
            </div>
          </div>

          <p v-if="card.scheme.description" class="text-xs text-slate-400 mb-2">{{ card.scheme.description }}</p>

          <div v-if="card.primaryModuleLines.length > 0" class="mb-2">
            <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.primary_modules') }}</div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(line, i) in card.primaryModuleLines"
                :key="i"
                class="px-2 py-0.5 text-[10px] rounded bg-slate-700/50 text-emerald-300 border border-emerald-700/50"
              >{{ line }}</span>
            </div>
          </div>

          <div v-if="card.derivedModuleLines.length > 0" class="mb-2">
            <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.derived_modules') }}</div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(line, i) in card.derivedModuleLines"
                :key="i"
                class="px-2 py-0.5 text-[10px] rounded bg-slate-700/50 text-slate-300 border border-slate-600"
              >{{ line }}</span>
            </div>
          </div>

          <div v-if="card.productionLines.length > 0" class="mb-2">
            <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.main_production') }}</div>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5">
              <span
                v-for="p in card.productionLines"
                :key="p.name"
                class="text-[10px] text-emerald-400"
              >{{ p.name }} {{ formatRate(p.rate) }}/h</span>
            </div>
          </div>

          <div v-if="card.materialLines.length > 0">
            <div class="text-[10px] text-slate-500 mb-0.5">{{ t('build_plan.build_materials') }}</div>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5">
              <span
                v-for="m in card.materialLines"
                :key="m.name"
                class="text-[10px] text-slate-400"
              >{{ m.name }} ×{{ Math.round(m.qty) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <BuildPlanStepsModal
    v-if="modalOpen && selectedScheme"
    :scheme="selectedScheme"
    @close="closeModal"
  />
</template>
