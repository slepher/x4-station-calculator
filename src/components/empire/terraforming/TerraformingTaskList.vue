<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import type { TaskTree, TerraformingProject } from '@/store/logic/terraformingTaskResolver'
import type {
  TerraformingEffectItem,
  TerraformingStatLineModel,
  TerraformingTaskNodeDisplay,
} from '@/components/empire/presenters/useTerraformingPresenter'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import TerraformingStatScale from '@/components/empire/terraforming/TerraformingStatScale.vue'
import TerraformingTaskNode from '@/components/empire/terraforming/TerraformingTaskNode.vue'

const { t } = useI18n()

interface Props {
  taskTree: TaskTree | null
  groupNames: Map<string, string>
  taskNodeDisplays: Map<string, TerraformingTaskNodeDisplay>
  completedProjectCounts: Map<string, number>
  projectMap: Map<string, TerraformingProject>
  projectDisplayNames: Map<string, string>
  floating: boolean
  statFilter: Set<string>
  isEditing: boolean
  statDisplayNames: Map<string, string>
  goalFilteredTaskIds: Set<string> | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggleProject', projectId: string): void
  (e: 'setProjectCount', projectId: string, count: number): void
  (e: 'clickStat', statId: string): void
}>()

const filteredTaskIds = computed(() => {
  const hasStatFilter = props.statFilter.size > 0
  const hasGoalFilter = props.goalFilteredTaskIds !== null && props.goalFilteredTaskIds.size > 0
  if (!hasStatFilter && !hasGoalFilter) return null

  const ids = new Set<string>()

  if (hasGoalFilter && props.goalFilteredTaskIds) {
    for (const id of props.goalFilteredTaskIds) ids.add(id)
  }

  if (hasStatFilter) {
    const parentMap = new Map<string, string>()
    function collectParents(nodes: { id: string; children: { id: string; children: any[] }[] }[]) {
      for (const node of nodes) {
        for (const child of node.children) {
          parentMap.set(child.id, node.id)
          collectParents([child])
        }
      }
    }
    if (props.taskTree) {
      for (const nodes of props.taskTree.groups.values()) {
        collectParents(nodes)
      }
    }

    for (const [projectId, display] of props.taskNodeDisplays) {
      if (display.statLines.some(
        line => props.statFilter.has(line.statId) && line.effectToValue !== null
      )) {
        ids.add(projectId)
        let parentId = parentMap.get(projectId)
        while (parentId) {
          ids.add(parentId)
          parentId = parentMap.get(parentId)
        }
      }
    }
  }

  return ids
})

function isTaskVisible(nodeId: string): boolean {
  if (!filteredTaskIds.value) return true
  return filteredTaskIds.value.has(nodeId)
}

function isGroupVisible(groupId: string): boolean {
  if (!filteredTaskIds.value) return true
  if (!props.taskTree) return false
  const nodes = props.taskTree.groups.get(groupId)
  if (!nodes) return false
  return nodes.some(n => isTaskVisible(n.id) && topLevelNodeIds.value.has(n.id))
}

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

function handleEventSetCount(event: { id: string; available: boolean }, newCount: number) {
  const current = props.completedProjectCounts.get(event.id) ?? 0
  if (newCount > current && !event.available) return
  emit('setProjectCount', event.id, newCount)
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

function getEffectItems(projectId: string): TerraformingEffectItem[] {
  return getNodeDisplay(projectId)?.effectItems || []
}

const visibleEvents = computed(() => {
  if (!props.taskTree?.groups.has('events')) return []
  const events = props.taskTree.groups.get('events')!
  if (!filteredTaskIds.value) return events
  return events.filter(e => isTaskVisible(e.id))
})

function getStatLines(projectId: string): TerraformingStatLineModel[] {
  return getNodeDisplay(projectId)?.statLines || []
}
</script>

<template>
  <div class="panel-card" :class="{ 'panel-floating': floating }">
    <div class="panel-header">
      <span>{{ t('terraforming.taskPanel') }}</span>
      <div v-if="statFilter.size > 0" class="stat-tag-bar">
        <span
          v-for="statId in [...statFilter]"
          :key="statId"
          class="stat-tag"
        >
          <span class="stat-tag-name">{{ statDisplayNames.get(statId) || statId }}</span>
          <button class="stat-tag-close" @click="emit('clickStat', statId)">×</button>
        </span>
      </div>
    </div>
    <div class="panel-content">
      <div v-if="!taskTree" class="text-slate-500 text-sm text-center py-4">
        {{ t('terraforming.selectCluster') }}
      </div>
      <div v-else-if="taskTree.groupOrder.length === 0" class="text-slate-500 text-sm text-center py-4">
        {{ t('terraforming.noAvailableTasks') }}
      </div>
      <div v-else>
        <div v-if="visibleEvents.length > 0" class="events-section">
          <div class="group-header">{{ groupNames.get('events') || 'Events' }}</div>
          <div
            v-for="e in visibleEvents"
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
                      @update:model-value="handleEventSetCount(e, $event)"
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
                <div v-if="getStatLines(e.id).length > 0" class="stat-impact-list">
                  <TerraformingStatScale
                    v-for="line in getStatLines(e.id)"
                    :key="`${e.id}-${line.statId}-${line.effectLabel || line.numericText || 'impact'}`"
                    :model="line"
                    compact
                    mode="impact"
                    show-effect-label
                    @click-stat="emit('clickStat', $event)"
                  />
                </div>
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
                <div v-if="getDependencyLines(e.id).length > 0" class="condition-list">
                  <div
                    v-for="(line, i) in getDependencyLines(e.id)"
                    :key="`${e.id}-dep-${i}`"
                    class="condition-dependency"
                    :class="line.blocked ? 'blocked' : 'available'"
                  >
                    <span class="dependency-name">{{ line.label }}</span>
                    <span class="dependency-value">{{ line.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="task-tree">
          <template v-for="group in taskTree.groupOrder" :key="group">
            <div v-if="taskTree.groups.has(group) && group !== 'events' && isGroupVisible(group)" class="task-group">
              <div class="group-header">{{ groupNames.get(group) || group }}</div>
              <draggable
                :model-value="taskTree.groups.get(group)?.filter(n => topLevelNodeIds.has(n.id) && isTaskVisible(n.id)) || []"
                :group="{ name: 'terraforming-tasks', pull: 'clone', put: false }"
                :sort="false"
                :clone="(n: any) => ({ projectId: n.id, projectName: n.name, _type: 'drag-clone' })"
                item-key="id"
                :disabled="!isEditing"
                ghost-class="drag-ghost"
                handle=".drag-to-log"
                class="task-node-list"
              >
                <template #item="{ element: node }">
                  <TerraformingTaskNode
                    :key="node.id"
                    :node="node"
                    :is-editing="isEditing"
                    :completed-project-counts="completedProjectCounts"
                    :project-map="projectMap"
                    :project-display-names="projectDisplayNames"
                    :task-node-displays="taskNodeDisplays"
                    @toggle-project="emit('toggleProject', $event)"
                    @set-project-count="(pid: string, cnt: number) => emit('setProjectCount', pid, cnt)"
                    @click-stat="emit('clickStat', $event)"
                  />
                </template>
              </draggable>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card { @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden; }
.panel-card.panel-floating { @apply flex flex-col; max-height: var(--panel-max-h, calc(100vh - 8rem)); }
.panel-card.panel-floating .panel-header { @apply sticky top-0 z-10; }
.panel-header { @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0; }
.panel-content { @apply p-2 flex flex-col gap-1; }
.panel-floating .panel-content { @apply flex-1 min-h-0 overflow-y-auto; }
.panel-floating .panel-content::-webkit-scrollbar { width: 6px; }
.panel-floating .panel-content::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
.panel-floating .panel-content::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 3px; }
.panel-floating .panel-content::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 1); }

.stats-card { @apply bg-slate-950/50 border border-slate-700/30 rounded p-2 mb-1; }
.stats-grid { @apply grid grid-cols-1 gap-1 sm:grid-cols-2; }

.task-tree { @apply flex flex-col gap-1; }
.task-group { @apply mb-2; }
.group-header { @apply text-xs text-slate-400 font-bold uppercase tracking-wider px-2 py-1 bg-slate-800/50 rounded; }

.task-node { @apply rounded transition-colors hover:bg-slate-800/30; }
.task-node.blocked { @apply hover:bg-transparent; }
.task-node.blocked .task-name { @apply text-slate-500; }
.task-node.blocked .task-status-icon { @apply text-slate-600; }
.task-node.completed { @apply bg-emerald-500/5; }
.task-node.child-node { @apply ml-6; }

.task-card { @apply px-2 py-1.5; }
.task-head { @apply flex items-start justify-between gap-3; }
.task-actions { @apply flex items-center gap-1 flex-shrink-0; }
.task-title { @apply flex min-w-0 items-center gap-1.5 flex-wrap; }
.task-body { @apply mt-1 flex flex-col gap-1; }
.stat-impact-list { @apply mt-1.5 flex flex-col gap-1; }

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

.completion-count { @apply text-xs text-emerald-400 font-bold; }

.toggle-btn { @apply text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700 w-14; }
.toggle-btn.toggled { @apply bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30; }

.side-effects { @apply mt-0.5; }
.side-effect-line { @apply text-xs text-amber-400; }

.events-section { @apply mb-2; }
:deep(.x4-input-container) { @apply h-5; }
:deep(.x4-num-input) { font-size: 11px; }

.stat-tag-bar { @apply flex items-center gap-1 ml-auto flex-wrap; }
.stat-tag { @apply flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30; }
.stat-tag-name { @apply truncate max-w-28; }
.stat-tag-close { @apply ml-0.5 text-slate-400 hover:text-slate-200 leading-none; }
</style>
