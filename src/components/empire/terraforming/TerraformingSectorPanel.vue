<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TerraformingCluster } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingConditionScaleModel,
  TerraformingStatScaleModel,
  TerraformingRewardDisplayItem,
} from '@/components/empire/presenters/useTerraformingPresenter'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

const { t } = useI18n()

interface Props {
  clusters: TerraformingCluster[]
  selectedClusterId: string | null
  clusterDisplayNames: Map<string, string>
  clusterMatchesHq: Record<string, boolean>
  objectivesProgress: Array<{
    step: number
    action: string
    text: string
    completed: boolean
    neutralizeScale?: TerraformingConditionScaleModel
  }>
  statScaleModels: Map<string, TerraformingStatScaleModel>
  currentStats: Record<string, number>
  statDisplayNames: Map<string, string>
  activeRebates: string[]
  clusterRewardDisplays: TerraformingRewardDisplayItem[]
  floating: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'selectCluster', clusterId: string): void
  (e: 'clickStat', statId: string): void
}>()

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'objective.relocate': t('terraforming.objective_relocate'),
    'objective.neutralize': t('terraforming.objective_neutralize'),
    'objective.build_project': t('terraforming.objective_buildProject'),
    'objective.build_housing': t('terraforming.objective_buildHousing'),
  }
  return labels[action] || action
}

</script>

<template>
  <div class="panel-card" :class="{ 'panel-floating': floating }">
    <div class="panel-header item-header">
      <span class="header-title">{{ selectedClusterId ? (clusterDisplayNames.get(selectedClusterId) || selectedClusterId) : '' }}</span>
    </div>

    <div class="panel-content">
      <!-- Objectives -->
      <div class="section-block">
        <div class="section-title">{{ t('terraforming.objectivesTitle') }}</div>
        <div
          v-for="obj in objectivesProgress"
          :key="obj.step"
          class="objective-row"
        >
          <div class="objective-main">
            <span class="objective-step">{{ obj.step }}.</span>
            <span class="objective-action">[{{ getActionLabel(obj.action) }}]</span>
            <span class="objective-text">{{ obj.text }}</span>
            <span class="objective-status" :class="{ completed: obj.completed }">
              {{ obj.completed ? '✅' : '⬜' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Rewards -->
      <div v-if="clusterRewardDisplays.length > 0" class="section-block">
        <div class="section-title">{{ t('terraforming.rewardsTitle') }}</div>
        <div
          v-for="(rw, i) in clusterRewardDisplays"
          :key="`reward-${i}`"
          class="reward-row"
        >
          <span class="reward-milestone">{{ rw.milestone }}</span>
          <span class="reward-text">{{ rw.text }}</span>
        </div>
      </div>

      <!-- Stats -->
      <div v-if="selectedClusterId && Object.keys(currentStats).length > 0" class="section-block">
        <div class="section-title">{{ t('terraforming.statsTitle') }}</div>
        <div class="stats-grid">
          <TerraformingStatScale
            v-for="[statId, model] in statScaleModels"
            :key="statId"
            :model="model"
            compact
            centered
            mode="status"
            @click-stat="emit('clickStat', $event)"
          />
        </div>
      </div>

      <!-- Rebates -->
      <div v-if="selectedClusterId && activeRebates.length > 0" class="section-block">
        <div class="section-title">{{ t('terraforming.rebatesTitle') }}</div>
        <div class="effect-list">
          <div
            v-for="(text, i) in activeRebates"
            :key="`active-rebate-${i}`"
            class="effect-list-item effect-rebate"
          >
            {{ text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-card.panel-floating {
  @apply flex flex-col;
  max-height: var(--panel-max-h, calc(100vh - 8rem));
}

.panel-card.panel-floating .panel-header {
  @apply sticky top-0 z-10;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0;
}

.item-header {
  @apply gap-2;
}

.header-title {
  @apply truncate;
}

.panel-content {
  @apply px-3 py-2 border-b border-slate-700/20;
}

.section-title {
  @apply text-xs text-slate-500 font-semibold mb-2;
}

.objective-row {
  @apply flex flex-col gap-1 py-1 text-xs;
}

.objective-main {
  @apply flex items-center gap-1.5;
}

.objective-step {
  @apply text-slate-500 w-5 text-right flex-shrink-0;
}

.objective-action {
  @apply text-sky-400 flex-shrink-0;
}

.objective-text {
  @apply text-slate-300 flex-1 truncate;
}

.objective-status {
  @apply flex w-6 flex-shrink-0 justify-center text-base text-center;
}

.panel-content {
  @apply flex flex-col gap-0;
}

.panel-floating .panel-content {
  @apply flex-1 min-h-0 overflow-y-auto;
}

.panel-floating .panel-content::-webkit-scrollbar { width: 6px; }

.objective-status.completed {
  @apply text-emerald-400;
}

.stats-grid {
  @apply grid grid-cols-1 gap-1;
}

.effect-list {
  @apply grid grid-cols-2 gap-1.5;
}

.effect-list-item {
  @apply rounded border px-2 py-1.5 text-xs border-emerald-700/40 bg-emerald-950/20 text-emerald-400;
}

.reward-row {
  @apply flex items-center gap-2 py-0.5 text-xs;
}

.reward-milestone {
  @apply text-amber-400 font-mono flex-shrink-0;
  min-width: 5rem;
}

.reward-text {
  @apply text-slate-300;
}
</style>
