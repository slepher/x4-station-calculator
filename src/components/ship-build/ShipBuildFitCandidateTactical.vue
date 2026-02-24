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
  <div class="tactical-shell">
    <div class="topline">
      <div>
        <div class="badge">Tactical Board</div>
        <div class="subtitle">two-lane command view</div>
      </div>
      <div class="segmented">
        <button :class="mode === 'connection' ? 'seg-on' : 'seg-off'" @click="setMode('connection', canSwitchToGroup)">Connection Lane</button>
        <button :class="mode === 'group' ? 'seg-on' : 'seg-off'" :disabled="!canSwitchToGroup" @click="setMode('group', canSwitchToGroup)">Group Lane</button>
      </div>
    </div>

    <div v-if="!canSwitchToGroup" class="lock-banner">{{ conflictReason }}</div>

    <div v-if="mode === 'connection'" class="lane-grid">
      <section v-for="row in connectionRows" :key="row.connectionKey" class="lane-item">
        <div class="lane-head">
          <strong>{{ row.slotTypeLabel }}</strong>
          <span>{{ row.groupName }}</span>
        </div>
        <div class="lane-capsules">
          <span class="capsule">{{ row.size }}</span>
          <span class="capsule">x{{ row.count }}</span>
          <span class="capsule tags">{{ row.tags.join('/') || 'no-tags' }}</span>
        </div>
        <select :value="selectedByConnection[row.connectionKey] || ''" @change="assignConnection(row.connectionKey, ($event.target as HTMLSelectElement).value)">
          <option value="">-- select loadout --</option>
          <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
      </section>
    </div>

    <div v-else class="lane-grid">
      <section v-for="row in groupRows" :key="row.groupKey" class="lane-item">
        <div class="lane-head">
          <strong>{{ row.slotTypeLabel }}</strong>
          <span>{{ row.groupName }}</span>
        </div>
        <div class="lane-capsules">
          <span class="capsule">{{ row.size }}</span>
          <span class="capsule">x{{ row.totalCount }}</span>
          <span class="capsule tags">{{ row.tags.join('/') || 'no-tags' }}</span>
        </div>
        <select :value="groupValue(row, selectedByConnection)" @change="assignGroup(row.groupKey, ($event.target as HTMLSelectElement).value)">
          <option value="">-- select group loadout --</option>
          <option value="__mixed__" disabled>mixed</option>
          <option v-for="option in row.options" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tactical-shell { @apply rounded-lg border border-amber-700/40 bg-amber-950/10 p-3; }
.topline { @apply flex items-start justify-between gap-2 mb-2; }
.badge { @apply text-xs uppercase tracking-wider text-amber-300; }
.subtitle { @apply text-[10px] text-slate-400; }
.segmented { @apply inline-flex rounded border border-slate-700 overflow-hidden; }
.segmented button { @apply px-2.5 py-1 text-[10px] font-semibold; }
.seg-off { @apply bg-slate-900 text-slate-300; }
.seg-on { @apply bg-amber-600/80 text-white; }
.segmented button:disabled { @apply opacity-40 cursor-not-allowed; }
.lock-banner { @apply text-[10px] text-amber-200 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 mb-2; }
.lane-grid { @apply grid grid-cols-1 gap-2 max-h-[19rem] overflow-y-auto pr-1; }
.lane-item { @apply rounded border border-amber-700/30 bg-slate-950/60 p-2; }
.lane-head { @apply flex items-center justify-between text-xs text-slate-100; }
.lane-capsules { @apply flex items-center gap-1 mt-1 mb-1.5; }
.capsule { @apply text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300; }
.capsule.tags { @apply text-amber-200/80; }
select { @apply w-full rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 px-2 py-1; }
</style>
