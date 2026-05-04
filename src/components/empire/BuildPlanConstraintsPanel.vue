<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import BuildGoalSearchBox from './BuildGoalSearchBox.vue'
import ProductionLineAllocationSection from './ProductionLineAllocationSection.vue'
import { type BuildGoal, type ProductionLineAllocation } from '@/types/build-plan'
import type { FlowPlanItem } from '@/components/empire/presenters/useBuildPlanPresenter'

const { t } = useI18n()

const props = defineProps<{
  goals: BuildGoal[]
  buildFlowMode: boolean
  racePreference: string
  buildPlan: { schemes: unknown[]; halted: boolean; haltReason: string; goalsAchieved: unknown[]; goalsRemaining: unknown[] } | null
  loading: boolean
  warnings: string[]
  flowPlanName: string
  activeFlowPlanId: string | null
  loadableFlowPlans: FlowPlanItem[]
  allocations: ProductionLineAllocation[]
  buildFlowPlanAllocations?: ProductionLineAllocation[]
  buildFlowPlanLoading?: boolean
}>()

const emit = defineEmits<{
  addGoal: [goal: BuildGoal]
  removeGoal: [index: number]
  updateGoal: [index: number, value: number]
  setBuildFlowMode: [mode: boolean]
  computePlan: []
  loadFlowPlan: [planId: string]
}>()

const schemeCount = computed(() => props.buildPlan?.schemes?.length || 0)

const buildMaterialAllocations = computed(() => {
  if (!props.buildFlowMode || !props.buildFlowPlanAllocations) return []
  return props.buildFlowPlanAllocations.map(bma => {
    const prodAlloc = props.allocations.find(a => a.groupId === bma.groupId)
    if (!prodAlloc) return bma
    const existingWares = new Set(bma.goals.map(g => (g as any).wareId))
    const merged = prodAlloc.goals.filter(g => !existingWares.has((g as any).wareId))
    return merged.length > 0
      ? { ...bma, goals: [...bma.goals, ...merged] }
      : bma
  })
})

const productionLineAllocations = computed(() => {
  if (!props.buildFlowMode || !props.buildFlowPlanAllocations || props.buildFlowPlanAllocations.length === 0) {
    return props.allocations
  }
  const buildMatGroupIds = new Set(props.buildFlowPlanAllocations.map(a => a.groupId))
  return props.allocations.filter(a => !a.groupId || !buildMatGroupIds.has(a.groupId))
})

function onCompute() {
  emit('computePlan')
}

function onUpdateGoal(index: number, value: number) {
  emit('updateGoal', index, value)
}

function onRemoveGoal(index: number) {
  emit('removeGoal', index)
}

const flowMenuOpen = ref(false)
const flowMenuRef = ref<HTMLElement | null>(null)
const flowTriggerRef = ref<HTMLElement | null>(null)
const panelCardRef = ref<HTMLElement | null>(null)
const flowMenuStyle = ref<Record<string, string>>({})

const flowButtonLabel = computed(() => {
  return props.flowPlanName || t('build_plan.import_flow_placeholder')
})

function closeFlowMenu() {
  flowMenuOpen.value = false
}

function updateFlowMenuPosition() {
  const panel = panelCardRef.value
  const trigger = flowTriggerRef.value
  if (!panel || !trigger) return
  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  flowMenuStyle.value = {
    top: `${triggerRect.top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '320px'
  }
}

function toggleFlowMenu() {
  flowMenuOpen.value = !flowMenuOpen.value
  if (flowMenuOpen.value) {
    nextTick(() => updateFlowMenuPosition())
  }
}

function handleFlowSelect(planId: string) {
  emit('loadFlowPlan', planId)
  closeFlowMenu()
}

function onGlobalPointerDown(event: MouseEvent) {
  if (!flowMenuOpen.value) return
  const menuRoot = flowMenuRef.value
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  closeFlowMenu()
}

function onViewportChange() {
  if (!flowMenuOpen.value) return
  updateFlowMenuPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <div class="panel-card" ref="panelCardRef">
    <div class="panel-header flex items-center justify-between">
      <span>{{ t('build_plan.title') }}</span>
      <div class="flow-plan-picker" ref="flowMenuRef">
        <button
          class="flow-plan-trigger"
          data-testid="build-plan-flow-menu-trigger"
          :title="t('build_plan.import_flow_tooltip')"
          @click="toggleFlowMenu"
          ref="flowTriggerRef"
        >
          <span class="flow-plan-label">{{ flowButtonLabel }}</span>
          <svg class="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <div
          v-if="flowMenuOpen"
          class="flow-plan-menu"
          :style="flowMenuStyle"
          data-testid="build-plan-flow-menu"
        >
          <template v-if="loadableFlowPlans.length === 0">
            <div class="flow-plan-menu-empty">{{ t('build_plan.import_flow_empty') }}</div>
          </template>
          <template v-else>
            <button
              v-for="item in loadableFlowPlans"
              :key="item.id"
              class="flow-plan-menu-item"
              :class="item.id === activeFlowPlanId ? 'flow-plan-menu-item-active' : ''"
              @click="handleFlowSelect(item.id)"
            >
              {{ item.name }}
            </button>
          </template>
        </div>
      </div>
    </div>
    <div class="panel-content space-y-3">

      <BuildGoalSearchBox :racePreference="racePreference" @addGoal="emit('addGoal', $event)" />

      <template v-if="buildFlowMode && buildMaterialAllocations.length > 0">
        <ProductionLineAllocationSection
          :allocations="buildMaterialAllocations"
          :goals="[]"
          :racePreference="racePreference"
          :title="t('build_plan.group_build_material')"
          :readonly="true"
        />
        <ProductionLineAllocationSection
          :allocations="productionLineAllocations"
          :goals="goals"
          :racePreference="racePreference"
          :title="t('build_plan.group_production')"
          @update-goal="onUpdateGoal"
          @remove-goal="onRemoveGoal"
        />
      </template>
      <ProductionLineAllocationSection
        v-else
        :allocations="allocations"
        :goals="goals"
        :racePreference="racePreference"
        @update-goal="onUpdateGoal"
        @remove-goal="onRemoveGoal"
      />

      <div v-if="allocations.length === 0 && goals.length === 0" class="text-xs text-slate-500 italic text-center py-2">
        {{ t('build_plan.no_goals') }}
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
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="buildFlowMode"
            @change="emit('setBuildFlowMode', ($event.target as HTMLInputElement).checked)"
            class="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500/50"
          />
          <span class="text-xs text-slate-300 whitespace-nowrap">{{ t('build_plan.build_flow_mode') }}</span>
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

.flow-plan-trigger {
  @apply flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 transition-colors;
}

.flow-plan-label {
  @apply max-w-[120px] truncate;
}

.flow-plan-menu {
  @apply fixed z-[120] w-52 max-h-80 overflow-y-auto rounded-md border border-slate-600/60 bg-slate-900/95 p-1 shadow-2xl;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.5) rgba(15, 23, 42, 0.7);
}

.flow-plan-menu-empty {
  @apply px-2 py-3 text-xs text-slate-500 text-center;
}

.flow-plan-menu-item {
  @apply block w-full text-left px-2.5 py-2 rounded text-xs text-slate-200 hover:bg-slate-700/50 transition-colors;
}

.flow-plan-menu-item-active {
  @apply text-slate-100 bg-slate-700/50 border border-slate-500/50;
}

.flow-plan-menu::-webkit-scrollbar {
  width: 6px;
}

.flow-plan-menu::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 9999px;
}

.flow-plan-menu::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.5);
  border-radius: 9999px;
}

.flow-plan-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.75);
}
</style>