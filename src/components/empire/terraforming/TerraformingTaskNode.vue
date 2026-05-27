<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TerraformingProject, TaskNode } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingStatLineModel,
  TerraformingTaskNodeDisplay,
} from '@/components/empire/presenters/useTerraformingPresenter'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

const { t } = useI18n()

interface Props {
  node: TaskNode
  isChild?: boolean
  isEditing?: boolean
  completedProjectCounts: Map<string, number>
  projectMap: Map<string, TerraformingProject>
  projectDisplayNames: Map<string, string>
  taskNodeDisplays: Map<string, TerraformingTaskNodeDisplay>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggleProject', projectId: string): void
  (e: 'setProjectCount', projectId: string, count: number): void
  (e: 'clickStat', statId: string): void
}>()

interface RepeatTagData {
  typeLabel: string
  durationLabel: string
  cooldownLabel: string
}

function getRepeatTagData(projectId: string): RepeatTagData {
  const proj = props.projectMap.get(projectId)
  if (!proj) return { typeLabel: '', durationLabel: '', cooldownLabel: '' }

  const isOneTime = proj.repeatCooldown === null
  const typeLabel = isOneTime
    ? (t('terraforming.oneTime') || 'One-time')
    : (t('terraforming.repeatable') || 'Repeatable')

  const durationSecs = proj.duration
  const durationLabel = durationSecs && durationSecs > 0
    ? `${t('terraforming.duration') || 'Duration'} ${formatDuration(durationSecs)}`
    : ''

  const cooldownSecs = proj.repeatCooldown
  const cooldownLabel = cooldownSecs && cooldownSecs > 0
    ? `${t('terraforming.cooldown') || 'Cooldown'} ${formatDuration(cooldownSecs)}`
    : ''

  return { typeLabel, durationLabel, cooldownLabel }
}

function isRepeatableProject(projectId: string): boolean {
  const proj = props.projectMap.get(projectId)
  return (proj?.repeatCooldown ?? null) !== null
}

function formatDuration(duration: number | null): string {
  if (!duration || duration <= 0) return ''
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60
  return [hours, minutes, seconds].map(part => String(part).padStart(2, '0')).join(':')
}

function getNodeDisplay(projectId: string): TerraformingTaskNodeDisplay | null {
  return props.taskNodeDisplays.get(projectId) || null
}

function getNodeName(projectId: string, fallback: string): string {
  return getNodeDisplay(projectId)?.name || fallback
}

function getDependencyLines(projectId: string) {
  return getNodeDisplay(projectId)?.dependencyLines || []
}

function getEffectItems(projectId: string): any[] {
  return getNodeDisplay(projectId)?.effectItems || []
}

function getStatLines(projectId: string): TerraformingStatLineModel[] {
  return getNodeDisplay(projectId)?.statLines || []
}

function getPrice(projectId: string): number {
  return props.projectMap.get(projectId)?.resources?.price ?? 0
}

function getStatusIcon(projectId: string, available: boolean): string {
  const count = props.completedProjectCounts.get(projectId) ?? 0
  if (count > 0) return '✅'
  if (!available) return '🚫'
  return '⬜'
}

function handleSetCount(node: { id: string; available: boolean }, newCount: number) {
  const current = props.completedProjectCounts.get(node.id) ?? 0
  if (newCount > current && !node.available && !props.isEditing) return
  emit('setProjectCount', node.id, newCount)
}
</script>

<template>
  <div
    class="task-node"
    :data-project-name="getNodeName(node.id, node.name)"
    :data-project-id="node.id"
    :class="{
      'child-node': isChild,
      blocked: !node.available && (completedProjectCounts.get(node.id) ?? 0) === 0,
      completed: (completedProjectCounts.get(node.id) ?? 0) > 0,
    }"
  >
    <div class="task-card">
      <div class="task-head">
        <div class="task-title">
          <span class="task-status-icon">{{ getStatusIcon(node.id, node.available) }}</span>
          <span class="task-name">{{ getNodeName(node.id, node.name) }}</span>
          <span v-if="getRepeatTagData(node.id).typeLabel" class="task-repeat">{{ getRepeatTagData(node.id).typeLabel }}</span>
          <span v-if="getRepeatTagData(node.id).durationLabel" class="task-repeat">{{ getRepeatTagData(node.id).durationLabel }}</span>
          <span v-if="getRepeatTagData(node.id).cooldownLabel" class="task-repeat">{{ getRepeatTagData(node.id).cooldownLabel }}</span>
        </div>
        <div class="task-actions">
          <span v-if="getPrice(node.id) > 0" class="task-price">{{ getPrice(node.id).toLocaleString() }} Cr</span>
          <template v-if="isRepeatableProject(node.id)">
            <X4NumberInput
              :model-value="completedProjectCounts.get(node.id) ?? 0"
              :min="0"
              :max="99"
              :disabled="!node.available && (completedProjectCounts.get(node.id) ?? 0) === 0 && !isEditing"
              width-class="w-14"
              @update:model-value="handleSetCount(node, $event)"
            />
          </template>
          <button
            v-else
            class="toggle-btn"
            :class="{ toggled: (completedProjectCounts.get(node.id) ?? 0) > 0 }"
            :disabled="!node.available && (completedProjectCounts.get(node.id) ?? 0) === 0 && !isEditing"
            @click="emit('toggleProject', node.id)"
          >
            {{ (completedProjectCounts.get(node.id) ?? 0) > 0 ? t('terraforming.undo') : t('terraforming.complete') }}
          </button>
          <span v-if="isEditing" class="drag-to-log">↔</span>
        </div>
      </div>
      <div class="task-body">
        <div v-if="getStatLines(node.id).length > 0" class="stat-impact-list">
          <TerraformingStatScale
            v-for="line in getStatLines(node.id)"
            :key="`${node.id}-${line.statId}-${line.effectLabel || line.numericText || 'impact'}`"
            :model="line"
            compact
            mode="impact"
            show-effect-label
            @click-stat="emit('clickStat', $event)"
          />
        </div>
        <div v-if="getEffectItems(node.id).length > 0" class="effect-list">
          <div
            v-for="(item, i) in getEffectItems(node.id)"
            :key="`${node.id}-effect-${i}`"
            class="effect-list-item"
            :class="`effect-${item.type}`"
          >
            {{ item.text }}
          </div>
        </div>
        <div v-if="getDependencyLines(node.id).length > 0" class="condition-list">
          <div
            v-for="(line, i) in getDependencyLines(node.id)"
            :key="`${node.id}-dependency-${i}`"
            class="condition-dependency"
            :class="line.blocked ? 'blocked' : 'available'"
          >
            <span class="dependency-name">{{ line.label }}</span>
            <span class="dependency-value">{{ line.value }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="node.children.length > 0" class="task-children">
      <TerraformingTaskNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :is-child="true"
        :is-editing="isEditing"
        :completed-project-counts="completedProjectCounts"
        :project-map="projectMap"
        :project-display-names="projectDisplayNames"
        :task-node-displays="taskNodeDisplays"
        @toggle-project="emit('toggleProject', $event)"
        @set-project-count="(pid: string, cnt: number) => emit('setProjectCount', pid, cnt)"
      />
    </div>
  </div>
</template>

<style scoped>
.task-node {
  @apply rounded;
}

.task-node.child-node {
  @apply ml-6;
}

.task-node.blocked .task-name {
  @apply text-slate-500;
}

.task-node.blocked .task-status-icon {
  @apply text-slate-600;
}

.task-node.completed .task-status-icon {
  @apply text-emerald-300;
}

.task-node.completed .task-name {
  @apply text-emerald-200;
}

.task-card {
  @apply px-2 py-1.5 rounded transition-colors hover:bg-slate-800/30;
}

.task-node.blocked > .task-card {
  @apply hover:bg-transparent;
}

.task-head {
  @apply flex items-start justify-between gap-3;
}

.task-actions {
  @apply flex items-center gap-1 flex-shrink-0;
}

.task-title {
  @apply flex min-w-0 items-center gap-1.5 flex-wrap;
}

.task-body {
  @apply mt-1 flex flex-col gap-1;
}

.stat-impact-list {
  @apply mt-1.5 flex flex-col gap-1;
}

.task-status-icon {
  @apply flex-shrink-0 text-sm;
}

.task-name {
  @apply text-xs text-slate-300;
}

.task-price {
  @apply text-[11px] text-slate-500 shrink-0 mr-1;
}

.task-repeat {
  @apply text-xs text-slate-500 bg-slate-800/50 px-1 rounded;
}

.effect-list {
  @apply mt-1.5 flex flex-col gap-1.5;
}

.effect-list-item {
  @apply rounded border px-2 py-1.5 text-xs;
}

.effect-list-item.effect-effect {
  @apply border-sky-700/40 bg-sky-950/20 text-sky-400;
}

.effect-list-item.effect-rebate {
  @apply border-emerald-700/40 bg-emerald-950/20 text-emerald-400;
}

.effect-list-item.effect-sideEffect {
  @apply border-amber-700/40 bg-amber-950/20 text-amber-400;
}

.effect-list-item.effect-description {
  @apply border-violet-700/40 bg-violet-950/20 text-violet-400;
}

.condition-list {
  @apply mt-1.5 flex flex-col gap-1.5;
}

.condition-dependency {
  @apply rounded border border-slate-700/40 bg-slate-950/40 px-2 py-1.5 flex items-center gap-1.5 flex-wrap text-xs;
}

.condition-dependency.available {
  @apply text-amber-400;
}

.condition-dependency.blocked {
  @apply text-red-400;
}

.dependency-name {
  @apply text-slate-300 font-medium;
}

.dependency-value {
  @apply break-all;
}

.toggle-btn {
  @apply text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700 w-14;
}

.toggle-btn.toggled {
  @apply bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30;
}

.drag-to-log {
  @apply text-slate-500 cursor-grab text-sm px-1 select-none;
  @apply hover:text-slate-300 active:cursor-grabbing;
}

.task-children {
  @apply mt-0.5;
}
</style>
