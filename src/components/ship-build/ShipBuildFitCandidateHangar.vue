<script setup lang="ts">
import type { FitGroupRow, FitMode, FitPanelProps } from './fitTypes'

defineProps<FitPanelProps>()

const emit = defineEmits<{
  (e: 'update:mode', mode: FitMode): void
  (e: 'assign-connection', payload: { connectionKey: string; equipmentId: string | null }): void
  (e: 'assign-group', payload: { groupKey: string; equipmentId: string | null }): void
}>()

const setMode = (mode: FitMode, canSwitchToGroup: boolean) => {
  if (mode === 'group' && !canSwitchToGroup) return
  emit('update:mode', mode)
}

const assignConnection = (connectionKey: string, value: string) => {
  emit('assign-connection', { connectionKey, equipmentId: value || null })
}

const groupValue = (group: FitGroupRow, selectedByConnection: Record<string, string | null | undefined>) => {
  const selected = group.connectionKeys.map((key) => selectedByConnection[key]).filter((value): value is string => Boolean(value))
  if (selected.length === 0) return ''
  const first = selected[0]
  if (!first) return ''
  return selected.every((item) => item === first) ? first : '__mixed__'
}

const assignGroup = (groupKey: string, value: string) => {
  emit('assign-group', { groupKey, equipmentId: value || null })
}
</script>

<template>
  <div class="hangar-shell">
    <div class="head-row">
      <div class="title">Hangar Layout</div>
      <div class="mode-inline">
        <button class="switch" :class="mode === 'connection' ? 'on' : ''" @click="setMode('connection', canSwitchToGroup)">Connection</button>
        <button class="switch" :class="mode === 'group' ? 'on' : ''" :disabled="!canSwitchToGroup" @click="setMode('group', canSwitchToGroup)">Group</button>
      </div>
    </div>
    <div v-if="!canSwitchToGroup" class="warn">{{ conflictReason }}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Group</th>
            <th>Size</th>
            <th>Count</th>
            <th>Tags</th>
            <th>Equipment</th>
          </tr>
        </thead>
        <tbody v-if="mode === 'connection'">
          <tr v-for="row in connectionRows" :key="row.connectionKey">
            <td>{{ row.slotTypeLabel }}</td>
            <td>{{ row.groupName }}</td>
            <td>{{ row.size }}</td>
            <td>{{ row.count }}</td>
            <td class="tag-col">{{ row.tags.join(', ') || '-' }}</td>
            <td>
              <select :value="selectedByConnection[row.connectionKey] || ''" @change="assignConnection(row.connectionKey, ($event.target as HTMLSelectElement).value)">
                <option value="">--</option>
                <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
              </select>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="row in groupRows" :key="row.groupKey">
            <td>{{ row.slotTypeLabel }}</td>
            <td>{{ row.groupName }}</td>
            <td>{{ row.size }}</td>
            <td>{{ row.totalCount }}</td>
            <td class="tag-col">{{ row.tags.join(', ') || '-' }}</td>
            <td>
              <select :value="groupValue(row, selectedByConnection)" @change="assignGroup(row.groupKey, ($event.target as HTMLSelectElement).value)">
                <option value="">--</option>
                <option value="__mixed__" disabled>mixed</option>
                <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.hangar-shell { @apply rounded-lg border border-sky-700/30 bg-slate-950/70 p-3; }
.head-row { @apply flex items-center justify-between mb-2; }
.title { @apply text-xs uppercase tracking-wide text-sky-300; }
.mode-inline { @apply flex items-center gap-1; }
.switch { @apply px-2 py-1 text-[10px] rounded border border-slate-700 bg-slate-900 text-slate-300; }
.switch.on { @apply border-sky-400 bg-sky-600/70 text-white; }
.switch:disabled { @apply opacity-40 cursor-not-allowed; }
.warn { @apply text-[10px] text-amber-300 mb-2; }
.table-wrap { @apply max-h-[19rem] overflow-auto border border-slate-800 rounded; }
table { @apply w-full text-xs text-slate-200 border-collapse; }
th, td { @apply border-b border-slate-800 px-2 py-1.5 text-left align-middle; }
th { @apply text-[10px] uppercase tracking-wide text-slate-400 bg-slate-900/80 sticky top-0; }
.tag-col { max-width: 12rem; }
select { @apply w-full rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 px-2 py-1; }
</style>
