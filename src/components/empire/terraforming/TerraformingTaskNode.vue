<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TerraformingProject, TaskNode } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingConditionScaleModel,
  TerraformingTaskNodeDisplay,
} from '@/components/empire/presenters/useTerraformingPresenter'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

const { t } = useI18n()

interface Props {
  node: TaskNode
  isChild?: boolean
  completedProjectCounts: Map<string, number>
  projectMap: Map<string, TerraformingProject>
  projectDisplayNames: Map<string, string>
  conditionScaleModels: Map<string, TerraformingConditionScaleModel[]>
  taskNodeDisplays: Map<string, TerraformingTaskNodeDisplay>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggleProject', projectId: string): void
  (e: 'setProjectCount', projectId: string, count: number): void
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

function getDependencyLabel(node: TaskNode, displayNames: Map<string, string>): string {
  if (!node.predecessors || node.predecessors.length === 0) return ''
  const projectPreds = node.predecessors.filter((p: any) => p.type === 'project')
  if (projectPreds.length === 0) return ''
  const labels = projectPreds.map((p: any) => displayNames.get(p.ref) || p.ref)
  const prefix = projectPreds[0]!.any ? t('terraforming.anyOf') || 'Any ' : ''
  return `${t('terraforming.depends') || 'Needs'}: ${prefix}${labels.join(' | ')}`
}

function getConditionModels(projectId: string): TerraformingConditionScaleModel[] {
  return props.conditionScaleModels.get(projectId) || []
}

function getNodeDisplay(projectId: string): TerraformingTaskNodeDisplay | null {
  return props.taskNodeDisplays.get(projectId) || null
}

function getNodeName(projectId: string, fallback: string): string {
  return getNodeDisplay(projectId)?.name || fallback
}

function getBlockedReasonLines(projectId: string, fallback: string | undefined): string[] {
  const displayLines = getNodeDisplay(projectId)?.blockedReasonLines
  if (displayLines?.length) return displayLines
  if (!fallback) return []
  return fallback.split('; ')
}

function getDependencyReasonLines(projectId: string, fallback: string | undefined): string[] {
  return getBlockedReasonLines(projectId, fallback).filter(line => line.startsWith(`${t('terraforming.depends') || 'Needs'}:`))
}

function getDependencyValueFromLine(line: string): string {
  const prefix = `${t('terraforming.depends') || 'Needs'}: `
  return line.startsWith(prefix) ? line.slice(prefix.length) : line
}

function getEffectItems(projectId: string): any[] {
  return getNodeDisplay(projectId)?.effectItems || []
}

function getStatusIcon(projectId: string, available: boolean): string {
  const count = props.completedProjectCounts.get(projectId) ?? 0
  if (count > 0) return '✅'
  if (!available) return '🚫'
  return '⬜'
}
</script>

<template>
  <div
    class="task-node"
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
          <template v-if="isRepeatableProject(node.id)">
            <X4NumberInput
              :model-value="completedProjectCounts.get(node.id) ?? 0"
              :min="0"
              :max="99"
              :disabled="!node.available && (completedProjectCounts.get(node.id) ?? 0) === 0"
              width-class="w-14"
              @update:model-value="emit('setProjectCount', node.id, $event)"
            />
          </template>
          <button
            v-else
            class="toggle-btn"
            :class="{ toggled: (completedProjectCounts.get(node.id) ?? 0) > 0 }"
            :disabled="!node.available && (completedProjectCounts.get(node.id) ?? 0) === 0"
            @click="emit('toggleProject', node.id)"
          >
            {{ (completedProjectCounts.get(node.id) ?? 0) > 0 ? t('terraforming.undo') : t('terraforming.complete') }}
          </button>
        </div>
      </div>
      <div class="task-body">
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
        <div v-if="getConditionModels(node.id).length > 0" class="condition-list">
          <TerraformingStatScale
            v-for="condition in getConditionModels(node.id)"
            :key="`${node.id}-${condition.statId}-${condition.requirementLabel}`"
            :model="condition"
            compact
            mode="condition"
          />
        </div>
        <div
          v-if="node.available && node.predecessors.some((p: any) => p.type === 'project')"
          class="condition-list"
        >
          <div class="condition-dependency available">
            <span class="dependency-name">{{ t('terraforming.depends') }}</span>
            <span class="dependency-value">{{ getDependencyLabel(node, projectDisplayNames).replace(`${t('terraforming.depends') || 'Needs'}: `, '') }}</span>
          </div>
        </div>
        <div
          v-if="!node.available && getDependencyReasonLines(node.id, node.blockedReason).length > 0"
          class="condition-list"
        >
          <div
            v-for="(line, i) in getDependencyReasonLines(node.id, node.blockedReason)"
            :key="`${node.id}-dep-${i}`"
            class="condition-dependency blocked"
          >
            <span class="dependency-name">{{ t('terraforming.depends') }}</span>
            <span class="dependency-value">{{ getDependencyValueFromLine(line) }}</span>
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
        :completed-project-counts="completedProjectCounts"
        :project-map="projectMap"
        :project-display-names="projectDisplayNames"
        :condition-scale-models="conditionScaleModels"
        :task-node-displays="taskNodeDisplays"
        @toggle-project="emit('toggleProject', $event)"
        @set-project-count="(pid: string, cnt: number) => emit('setProjectCount', pid, cnt)"
      />
    </div>
  </div>
</template>

<style scoped>
.task-node {
  @apply rounded transition-colors hover:bg-slate-800/30;
}

.task-node.blocked {
  @apply hover:bg-transparent;
}

.task-node.child-node {
  @apply ml-6;
}

.task-node.blocked {
  @apply hover:bg-transparent;
}

.task-node.blocked .task-name {
  @apply text-slate-500;
}

.task-node.blocked .task-status-icon {
  @apply text-slate-600;
}

.task-node.completed {
  @apply bg-emerald-500/5;
}

.task-card {
  @apply px-2 py-1.5;
}

.task-head {
  @apply flex items-start justify-between gap-3;
}

.task-actions {
  @apply opacity-0 transition-all duration-300;
}

.task-node:hover .task-actions {
  @apply opacity-100;
}

.task-title {
  @apply flex min-w-0 items-center gap-1.5 flex-wrap;
}

.task-body {
  @apply mt-1 flex flex-col gap-1;
}

.task-status-icon {
  @apply flex-shrink-0 text-sm;
}

.task-name {
  @apply text-xs text-slate-300;
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

.task-children {
  @apply mt-0.5;
}
</style>
