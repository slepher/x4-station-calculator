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
  <div class="nebula-shell">
    <div class="mode-bar">
      <button class="mode-btn" :class="mode === 'connection' ? 'active' : ''" @click="setMode('connection', canSwitchToGroup)">Connection</button>
      <button class="mode-btn" :class="mode === 'group' ? 'active' : ''" :disabled="!canSwitchToGroup" @click="setMode('group', canSwitchToGroup)">Group</button>
      <span v-if="!canSwitchToGroup" class="mode-tip">{{ conflictReason }}</span>
    </div>

    <div v-if="mode === 'connection'" class="card-grid">
      <article v-for="row in connectionRows" :key="row.connectionKey" class="fit-card">
        <header>
          <h4>{{ row.slotTypeLabel }}</h4>
          <span>{{ row.groupName }}</span>
        </header>
        <div class="meta">{{ row.size }} · x{{ row.count }}</div>
        <div class="tags">{{ row.tags.join(' · ') || 'no-tags' }}</div>
        <select :value="selectedByConnection[row.connectionKey] || ''" @change="assignConnection(row.connectionKey, ($event.target as HTMLSelectElement).value)">
          <option value="">--</option>
          <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
      </article>
    </div>

    <div v-else class="card-grid">
      <article v-for="row in groupRows" :key="row.groupKey" class="fit-card">
        <header>
          <h4>{{ row.slotTypeLabel }}</h4>
          <span>{{ row.groupName }}</span>
        </header>
        <div class="meta">{{ row.size }} · x{{ row.totalCount }}</div>
        <div class="tags">{{ row.tags.join(' · ') || 'no-tags' }}</div>
        <select :value="groupValue(row, selectedByConnection)" @change="assignGroup(row.groupKey, ($event.target as HTMLSelectElement).value)">
          <option value="">--</option>
          <option value="__mixed__" disabled>mixed</option>
          <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
      </article>
    </div>
  </div>
</template>

<style scoped>
.nebula-shell { @apply rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-3; }
.mode-bar { @apply flex items-center gap-2 mb-3; }
.mode-btn { @apply px-2.5 py-1 text-xs rounded border border-slate-700 bg-slate-900/60 text-slate-300; }
.mode-btn.active { @apply border-emerald-400 bg-emerald-600/70 text-white; }
.mode-btn:disabled { @apply opacity-40 cursor-not-allowed; }
.mode-tip { @apply text-[10px] text-amber-300/80 ml-auto; }
.card-grid { @apply grid grid-cols-1 gap-2 max-h-[19rem] overflow-y-auto pr-1; }
.fit-card { @apply rounded-md border border-emerald-700/40 bg-slate-950/60 p-2; }
.fit-card header { @apply flex items-center justify-between text-xs font-semibold text-slate-100; }
.meta { @apply text-[10px] text-emerald-200/80 mt-1; }
.tags { @apply text-[10px] text-slate-400 mt-0.5 mb-1.5; }
select { @apply w-full rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 px-2 py-1; }
</style>
