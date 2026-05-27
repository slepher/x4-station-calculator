<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TerraformingCluster } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingConditionScaleModel,
  TerraformingStatScaleModel,
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
  floating: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'selectCluster', clusterId: string): void
  (e: 'displayModeChange', mode: 'list' | 'item'): void
}>()

const displayMode = ref<'list' | 'item'>('list')

onMounted(() => {
  if (props.selectedClusterId) {
    displayMode.value = 'item'
  }
})

watch(() => props.selectedClusterId, (newId) => {
  if (newId) {
    displayMode.value = 'item'
  } else {
    displayMode.value = 'list'
  }
})

function handleClusterClick(clusterId: string) {
  if (displayMode.value === 'list') {
    emit('selectCluster', clusterId)
    displayMode.value = 'item'
    emit('displayModeChange', 'item')
  }
}

function handleBackClick() {
  displayMode.value = 'list'
  emit('displayModeChange', 'list')
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'objective.relocate': t('terraforming.objective_relocate'),
    'objective.neutralize': t('terraforming.objective_neutralize'),
    'objective.build_project': t('terraforming.objective_buildProject'),
    'objective.build_housing': t('terraforming.objective_buildHousing'),
  }
  return labels[action] || action
}

function formatPartName(partName: string): string {
  return partName.replace(/^'(.*)'$/, '$1')
}
</script>

<template>
  <div class="panel-card" :class="{ 'panel-floating': floating }">
    <!-- Item Mode Header -->
    <div v-if="displayMode === 'item'" class="panel-header item-header">
      <button
        class="back-btn"
        :title="t('terraforming.backToList')"
        :aria-label="t('terraforming.backToList')"
        @click="handleBackClick"
      >
        <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 14L21 3" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      </button>
      <span class="header-title">{{ selectedClusterId ? (clusterDisplayNames.get(selectedClusterId) || selectedClusterId) : '' }}</span>
    </div>

    <!-- List Mode Header -->
    <div v-else class="panel-header">{{ t('terraforming.sectorPanel') }}</div>

    <div class="panel-content">
      <!-- ============ List Mode ============ -->
      <template v-if="displayMode === 'list'">
        <div v-if="clusters.length === 0" class="text-slate-500 text-sm text-center py-4">
          {{ t('terraforming.noSectors') }}
        </div>
        <div v-for="cluster in clusters" :key="cluster.id">
          <div
            class="cluster-item"
            :class="{ 'active': selectedClusterId === cluster.id }"
            @click="handleClusterClick(cluster.id)"
          >
            <div class="flex items-center gap-2">
              <span class="cluster-name">{{ clusterDisplayNames.get(cluster.id) || cluster.id }}</span>
              <span
                v-if="clusterMatchesHq[cluster.id]"
                class="hq-pill"
              >{{ t('terraforming.currentSector') }}</span>
            </div>
            <span class="cluster-part">{{ formatPartName(cluster.partName) }}</span>
          </div>
        </div>
      </template>

      <!-- ============ Item Mode ============ -->
      <template v-else>
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
      </template>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden flex flex-col;
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

.back-btn {
  @apply flex items-center justify-center w-7 h-7 rounded transition-colors text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 flex-shrink-0;
}

.back-icon {
  @apply h-3.5 w-3.5;
}

.panel-content {
  @apply flex flex-col gap-0 overflow-y-auto flex-1 min-h-0;
}

.panel-content::-webkit-scrollbar { width: 6px; }
.panel-content::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
.panel-content::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 3px; }
.panel-content::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 1); }

.cluster-item {
  @apply flex flex-col px-3 py-2 cursor-pointer transition-colors border-b border-slate-700/20;
  @apply hover:bg-sky-500/10 text-slate-400 hover:text-slate-200;
}

.cluster-item.active {
  @apply bg-sky-500/20 text-sky-400 border-sky-500/30;
}

.cluster-name {
  @apply text-sm font-bold;
}

.cluster-part {
  @apply text-xs text-slate-500 mt-0.5;
}

.hq-pill {
  @apply text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0;
}

.section-block {
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

.objective-status.completed {
  @apply text-emerald-400;
}

.stats-grid {
  @apply grid grid-cols-1 gap-1;
}

.effect-list {
  @apply flex flex-col gap-1.5;
}

.effect-list-item {
  @apply rounded border px-2 py-1.5 text-xs border-emerald-700/40 bg-emerald-950/20 text-emerald-400;
}
</style>
