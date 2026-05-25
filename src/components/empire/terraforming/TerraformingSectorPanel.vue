<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TerraformingCluster } from '@/store/logic/terraformingTaskResolver'
import type { TerraformingConditionScaleModel } from '@/components/empire/presenters/useTerraformingPresenter'

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
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'selectCluster', clusterId: string): void
}>()

function handleClusterClick(clusterId: string, currentSelected: string | null) {
  if (currentSelected === clusterId) {
    emit('selectCluster', '')
  } else {
    emit('selectCluster', clusterId)
  }
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
  <div class="panel-card">
    <div class="panel-header">{{ t('terraforming.sectorPanel') }}</div>
    <div class="panel-content">
      <div v-if="clusters.length === 0" class="text-slate-500 text-sm text-center py-4">
        {{ t('terraforming.noSectors') }}
      </div>
      <div v-for="cluster in clusters" :key="cluster.id">
        <div
          class="cluster-item"
          :class="{ 'active': selectedClusterId === cluster.id }"
          @click="handleClusterClick(cluster.id, selectedClusterId)"
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

        <div v-if="selectedClusterId === cluster.id" class="objectives-panel">
          <div class="objectives-title">{{ t('terraforming.objectivesTitle') }}</div>
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.panel-content {
  @apply flex flex-col gap-0;
}

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

.objectives-panel {
  @apply bg-slate-950/50 border-t border-slate-700/30 px-3 py-2;
}

.objectives-title {
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
</style>
