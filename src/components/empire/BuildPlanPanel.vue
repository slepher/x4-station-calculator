<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { BuildScheme } from '@/types/build-plan'
import BuildPlanStepsModal from './BuildPlanStepsModal.vue'

const { t } = useI18n()
const { translateModule } = useX4I18n()
const gameData = useGameDataStore()

const props = defineProps<{
  schemes: BuildScheme[]
  loading: boolean
}>()

const selectedScheme = ref<BuildScheme | null>(null)
const modalOpen = ref(false)

function openScheme(scheme: BuildScheme) {
  selectedScheme.value = scheme
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selectedScheme.value = null
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

function moduleName(moduleId: string): string {
  const mod = gameData.modulesMap[moduleId]
  return mod ? translateModule(mod) : moduleId
}

const schemeIcons: Record<string, string> = {
  '自给自足': '1',
  '目标输入': '2',
  '目标目标': '3'
}

const schemeColors: Record<string, string> = {
  '自给自足': 'border-emerald-600 hover:bg-emerald-900/20',
  '目标输入': 'border-amber-600 hover:bg-amber-900/20',
  '目标建筑': 'border-blue-600 hover:bg-blue-900/20',
  '目标目标': 'border-blue-600 hover:bg-blue-900/20'
}
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">{{ t('sector.build_plan.schemes') }}</div>
    <div class="panel-content">
      <!-- Empty state -->
      <div v-if="!loading && schemes.length === 0" class="py-8 text-center text-xs text-slate-500">
        {{ t('sector.build_plan.no_plan') }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="py-8 text-center text-xs text-slate-400">
        {{ t('sector.build_plan.computing') }}
      </div>

      <!-- Scheme cards -->
      <div v-if="schemes.length > 0" class="space-y-3">
        <div
          v-for="(scheme, idx) in schemes"
          :key="idx"
          class="border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 bg-slate-800/50"
          :class="schemeColors[scheme.label] || 'border-slate-600 hover:bg-slate-700/50'"
          @click="openScheme(scheme)"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
              >{{ schemeIcons[scheme.label] || idx + 1 }}</span>
              <span class="text-sm font-bold text-slate-200">{{ scheme.label }}</span>
            </div>
            <div class="text-right text-xs text-slate-500">
              <div>{{ formatDuration(scheme.totalDuration) }}</div>
              <div class="text-amber-400">{{ formatCredits(scheme.totalCredits) }}</div>
            </div>
          </div>

          <p class="text-xs text-slate-400 mb-2">{{ scheme.description }}</p>

          <div class="flex flex-wrap gap-1">
            <span
              v-for="pid in scheme.purposeModules"
              :key="pid"
              class="px-2 py-0.5 text-[10px] rounded bg-slate-700/50 text-slate-300 border border-slate-600"
            >{{ moduleName(pid) }}</span>
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
