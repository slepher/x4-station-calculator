<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TaskTree, TerraformingProject } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingConditionScaleModel,
  TerraformingEffectItem,
  TerraformingStatScaleModel,
  TerraformingTaskNodeDisplay,
} from '@/components/empire/presenters/useTerraformingPresenter'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'

const { t } = useI18n()

interface Props {
  taskTree: TaskTree | null
  groupNames: Map<string, string>
  taskNodeDisplays: Map<string, TerraformingTaskNodeDisplay>
  completedProjectCounts: Map<string, number>
  projectMap: Map<string, TerraformingProject>
  projectDisplayNames: Map<string, string>
  currentStats: Record<string, number>
  statDisplayNames: Map<string, string>
  statScaleModels: Map<string, TerraformingStatScaleModel>
  conditionScaleModels: Map<string, TerraformingConditionScaleModel[]>
  activeRebates: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggleProject', projectId: string): void
  (e: 'setProjectCount', projectId: string, count: number): void
}>()

const topLevelNodeIds = computed(() => {
  const set = new Set<string>()
  if (!props.taskTree) return set
  const collectTopLevel = (nodes: any[]) => {
    for (const node of nodes) {
      set.add(node.id)
    }
  }
  collectTopLevel(props.taskTree.roots)
  collectTopLevel(props.taskTree.blocked)
  return set
})

interface RepeatTagData {
  typeLabel: string
  durationLabel: string
  cooldownLabel: string
}

function getRepeatTagData(projectId: string, projectMap: Map<string, TerraformingProject>): RepeatTagData {
  const proj = projectMap.get(projectId)
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

function isRepeatableProject(projectId: string, projectMap: Map<string, TerraformingProject>): boolean {
  const proj = projectMap.get(projectId)
  return (proj?.repeatCooldown ?? null) !== null
}

function formatDuration(duration: number | null): string {
  if (!duration || duration <= 0) return ''
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60
  return [hours, minutes, seconds].map(part => String(part).padStart(2, '0')).join(':')
}

function getDependencyLabel(node: any, displayNames: Map<string, string>): string {
  if (!node.predecessors || node.predecessors.length === 0) return ''
  const projectPreds = node.predecessors.filter((p: any) => p.type === 'project')
  if (projectPreds.length === 0) return ''
  const labels = projectPreds.map((p: any) => displayNames.get(p.ref) || p.ref)
  const prefix = projectPreds[0].any ? t('terraforming.anyOf') || 'Any ' : ''
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

function getEffectItems(projectId: string): TerraformingEffectItem[] {
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
  <div class="panel-card">
    <div class="panel-header">{{ t('terraforming.taskPanel') }}</div>
    <div class="panel-content">
      <div v-if="taskTree && Object.keys(currentStats).length > 0" class="stats-card">
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
        <div v-if="activeRebates.length > 0" class="effect-list">
          <div
            v-for="(text, i) in activeRebates"
            :key="`active-rebate-${i}`"
            class="effect-list-item effect-rebate"
          >
            {{ text }}
          </div>
        </div>
      </div>
      <div v-if="!taskTree" class="text-slate-500 text-sm text-center py-4">
        {{ t('terraforming.selectCluster') }}
      </div>
      <div v-else-if="taskTree.groupOrder.length === 0" class="text-slate-500 text-sm text-center py-4">
        {{ t('terraforming.noAvailableTasks') }}
      </div>
      <div v-else>
        <div v-if="taskTree.groups.has('events')" class="events-section">
          <div class="group-header">{{ groupNames.get('events') || 'Events' }}</div>
          <div
            v-for="e in taskTree.groups.get('events')!"
            :key="e.id"
            class="task-node"
            :class="{ blocked: !e.available && (completedProjectCounts.get(e.id) ?? 0) === 0 }"
          >
            <div class="task-card">
              <div class="task-head">
                <div class="task-title">
                  <span class="task-status-icon">⚠️</span>
                  <span class="task-name">{{ getNodeName(e.id, e.name) }}</span>
                  <span v-if="getRepeatTagData(e.id, projectMap).typeLabel" class="task-repeat">{{ getRepeatTagData(e.id, projectMap).typeLabel }}</span>
                  <span v-if="getRepeatTagData(e.id, projectMap).durationLabel" class="task-repeat">{{ getRepeatTagData(e.id, projectMap).durationLabel }}</span>
                  <span v-if="getRepeatTagData(e.id, projectMap).cooldownLabel" class="task-repeat">{{ getRepeatTagData(e.id, projectMap).cooldownLabel }}</span>
                </div>
                <div class="task-actions">
                  <template v-if="isRepeatableProject(e.id, projectMap)">
                    <X4NumberInput
                      :model-value="completedProjectCounts.get(e.id) ?? 0"
                      :min="0"
                      :max="99"
                      :disabled="!e.available && (completedProjectCounts.get(e.id) ?? 0) === 0"
                      width-class="w-14"
                      @update:model-value="emit('setProjectCount', e.id, $event)"
                    />
                  </template>
                  <button
                    v-else
                    class="toggle-btn"
                    :class="{ toggled: (completedProjectCounts.get(e.id) ?? 0) > 0 }"
                    :disabled="!e.available && (completedProjectCounts.get(e.id) ?? 0) === 0"
                    @click="emit('toggleProject', e.id)"
                  >
                    {{ (completedProjectCounts.get(e.id) ?? 0) > 0 ? t('terraforming.undo') : t('terraforming.complete') }}
                  </button>
                </div>
              </div>
              <div class="task-body">
                  <div v-if="getEffectItems(e.id).length > 0" class="effect-list">
                  <div
                    v-for="(item, i) in getEffectItems(e.id)"
                    :key="`${e.id}-effect-${i}`"
                    class="effect-list-item"
                    :class="`effect-${item.type}`"
                  >
                    {{ item.text }}
                  </div>
                </div>
                <div v-if="getConditionModels(e.id).length > 0" class="condition-list">
                  <TerraformingStatScale
                    v-for="condition in getConditionModels(e.id)"
                    :key="`${e.id}-${condition.statId}-${condition.requirementLabel}`"
                    :model="condition"
                    compact
                    mode="condition"
                  />
                </div>
                <div v-if="!e.available && getDependencyReasonLines(e.id, e.blockedReason).length > 0" class="condition-list">
                  <div
                    v-for="(line, i) in getDependencyReasonLines(e.id, e.blockedReason)"
                    :key="`${e.id}-dep-${i}`"
                    class="condition-dependency blocked"
                  >
                    <span class="dependency-name">{{ t('terraforming.depends') }}</span>
                    <span class="dependency-value">{{ getDependencyValueFromLine(line) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="task-tree">
          <template v-for="group in taskTree.groupOrder" :key="group">
            <div v-if="taskTree.groups.has(group) && group !== 'events'" class="task-group">
              <div class="group-header">{{ groupNames.get(group) || group }}</div>
              <div
                v-for="node in taskTree.groups.get(group)?.filter(n => topLevelNodeIds.has(n.id))"
                :key="node.id"
                class="task-node"
                :class="{ blocked: !node.available && (completedProjectCounts.get(node.id) ?? 0) === 0, completed: (completedProjectCounts.get(node.id) ?? 0) > 0 }"
              >
                <div class="task-card">
                  <div class="task-head">
                    <div class="task-title">
                      <span class="task-status-icon">{{ getStatusIcon(node.id, node.available) }}</span>
                      <span class="task-name">{{ getNodeName(node.id, node.name) }}</span>
                      <span v-if="getRepeatTagData(node.id, projectMap).typeLabel" class="task-repeat">{{ getRepeatTagData(node.id, projectMap).typeLabel }}</span>
                      <span v-if="getRepeatTagData(node.id, projectMap).durationLabel" class="task-repeat">{{ getRepeatTagData(node.id, projectMap).durationLabel }}</span>
                      <span v-if="getRepeatTagData(node.id, projectMap).cooldownLabel" class="task-repeat">{{ getRepeatTagData(node.id, projectMap).cooldownLabel }}</span>
                    </div>
                    <div class="task-actions">
                      <template v-if="isRepeatableProject(node.id, projectMap)">
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
                  <div
                    v-for="child in node.children"
                    :key="child.id"
                    class="task-node child-node"
                    :class="{ blocked: !child.available && (completedProjectCounts.get(child.id) ?? 0) === 0, completed: (completedProjectCounts.get(child.id) ?? 0) > 0 }"
                  >
                    <div class="task-card">
                      <div class="task-head">
                        <div class="task-title">
                          <span class="task-status-icon">{{ getStatusIcon(child.id, child.available) }}</span>
                          <span class="task-name">{{ getNodeName(child.id, child.name) }}</span>
                          <span v-if="getRepeatTagData(child.id, projectMap).typeLabel" class="task-repeat">{{ getRepeatTagData(child.id, projectMap).typeLabel }}</span>
                          <span v-if="getRepeatTagData(child.id, projectMap).durationLabel" class="task-repeat">{{ getRepeatTagData(child.id, projectMap).durationLabel }}</span>
                          <span v-if="getRepeatTagData(child.id, projectMap).cooldownLabel" class="task-repeat">{{ getRepeatTagData(child.id, projectMap).cooldownLabel }}</span>
                        </div>
                        <div class="task-actions">
                          <template v-if="isRepeatableProject(child.id, projectMap)">
                          <X4NumberInput
                            :model-value="completedProjectCounts.get(child.id) ?? 0"
                            :min="0"
                            :max="99"
                            :disabled="!child.available && (completedProjectCounts.get(child.id) ?? 0) === 0"
                            width-class="w-14"
                            @update:model-value="emit('setProjectCount', child.id, $event)"
                          />
                          </template>
                          <button
                            v-else
                            class="toggle-btn"
                            :class="{ toggled: (completedProjectCounts.get(child.id) ?? 0) > 0 }"
                            :disabled="!child.available && (completedProjectCounts.get(child.id) ?? 0) === 0"
                            @click="emit('toggleProject', child.id)"
                          >
                            {{ (completedProjectCounts.get(child.id) ?? 0) > 0 ? t('terraforming.undo') : t('terraforming.complete') }}
                          </button>
                        </div>
                      </div>
                      <div class="task-body">
                        <div v-if="getEffectItems(child.id).length > 0" class="effect-list">
                          <div
                            v-for="(item, i) in getEffectItems(child.id)"
                            :key="`${child.id}-effect-${i}`"
                            class="effect-list-item"
                            :class="`effect-${item.type}`"
                          >
                            {{ item.text }}
                          </div>
                        </div>
                        <div v-if="getConditionModels(child.id).length > 0" class="condition-list">
                          <TerraformingStatScale
                            v-for="condition in getConditionModels(child.id)"
                            :key="`${child.id}-${condition.statId}-${condition.requirementLabel}`"
                            :model="condition"
                            compact
                            mode="condition"
                          />
                        </div>
                        <div
                          v-if="child.available && child.predecessors.some((p: any) => p.type === 'project')"
                          class="condition-list"
                        >
                          <div class="condition-dependency available">
                            <span class="dependency-name">{{ t('terraforming.depends') }}</span>
                            <span class="dependency-value">{{ getDependencyLabel(child, projectDisplayNames).replace(`${t('terraforming.depends') || 'Needs'}: `, '') }}</span>
                          </div>
                        </div>
                        <div
                          v-if="!child.available && getDependencyReasonLines(child.id, child.blockedReason).length > 0"
                          class="condition-list"
                        >
                          <div
                            v-for="(line, i) in getDependencyReasonLines(child.id, child.blockedReason)"
                            :key="`${child.id}-dep-${i}`"
                            class="condition-dependency blocked"
                          >
                            <span class="dependency-name">{{ t('terraforming.depends') }}</span>
                            <span class="dependency-value">{{ getDependencyValueFromLine(line) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card { @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden; }
.panel-header { @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30; }
.panel-content { @apply p-2 flex flex-col gap-1; }

.stats-card { @apply bg-slate-950/50 border border-slate-700/30 rounded p-2 mb-1; }
.stats-grid { @apply grid grid-cols-1 gap-1 sm:grid-cols-2; }

.task-tree { @apply flex flex-col gap-1; }
.task-group { @apply mb-2; }
.group-header { @apply text-xs text-slate-400 font-bold uppercase tracking-wider px-2 py-1 bg-slate-800/50 rounded; }

.task-node { @apply rounded transition-colors hover:bg-slate-800/30; }
.task-node.blocked { @apply opacity-50; }
.task-node.completed { @apply bg-emerald-500/5; }
.task-node.child-node { @apply ml-6; }

.task-card { @apply px-2 py-1.5; }
.task-head { @apply flex items-start justify-between gap-3; }
.task-actions { @apply opacity-0 transition-all duration-300; }
.task-node:hover .task-actions { @apply opacity-100; }
.task-title { @apply flex min-w-0 items-center gap-1.5 flex-wrap; }
.task-body { @apply mt-1 flex flex-col gap-1; }

.task-status-icon { @apply flex-shrink-0 text-sm; }
.task-state-label { @apply text-sm leading-none; }
.task-name { @apply text-xs text-slate-300; }
.effect-list { @apply mt-1.5 flex flex-col gap-1.5; }
.effect-list-item { @apply rounded border px-2 py-1.5 text-xs; }
.effect-list-item.effect-effect { @apply border-sky-700/40 bg-sky-950/20 text-sky-400; }
.effect-list-item.effect-rebate { @apply border-emerald-700/40 bg-emerald-950/20 text-emerald-400; }
.effect-list-item.effect-sideEffect { @apply border-amber-700/40 bg-amber-950/20 text-amber-400; }
.effect-list-item.effect-description { @apply border-violet-700/40 bg-violet-950/20 text-violet-400; }
.task-effects { @apply text-xs text-sky-400; }
.condition-list { @apply mt-1.5 flex flex-col gap-1.5; }
.task-repeat { @apply text-xs text-slate-500 bg-slate-800/50 px-1 rounded; }
.condition-dependency { @apply rounded border border-slate-700/40 bg-slate-950/40 px-2 py-1.5 flex items-center gap-1.5 flex-wrap text-xs; }
.condition-dependency.available { @apply text-amber-400; }
.condition-dependency.blocked { @apply text-red-400; }
.dependency-name { @apply text-slate-300 font-medium; }
.dependency-value { @apply break-all; }

.task-actions { @apply flex items-center gap-1 flex-shrink-0; }
.completion-count { @apply text-xs text-emerald-400 font-bold; }

.toggle-btn { @apply text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700 w-14; }
.toggle-btn.toggled { @apply bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30; }

.side-effects { @apply mt-0.5; }
.side-effect-line { @apply text-xs text-amber-400; }

.events-section { @apply mb-2; }
:deep(.x4-input-container) { @apply h-5; }
:deep(.x4-num-input) { font-size: 11px; }
</style>
