<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { SectorAssignment, GroupDraftInfo } from '@/store/logic/autoGroup'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import type { X4MapSector } from '@/types/x4'

const props = defineProps<{
  assignments: SectorAssignment[]
  groups: GroupDraftInfo[]
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined
  stationCounts: Record<string, number>
}>()

const emit = defineEmits<{
  (e: 'select-option', sectorMacro: string, optionIndex: number): void
}>()

const { t, te } = useI18n()

function getGroupName(groupId: string): string {
  return props.groups.find((g) => g.id === groupId)?.name || groupId.slice(0, 8)
}

function getSectorDisplayName(sectorMacro: string): string {
  if (props.maps) {
    const resolved = resolveMapSectorByMacro(props.maps, sectorMacro)
    if (resolved) {
      const nameId = (resolved.sector as any).nameId
      if (nameId && te(nameId)) {
        return t(nameId)
      }
      const name = (resolved.sector as any).name
      if (name) return name
    }
  }
  return sectorMacro
}

function getOptionLabel(opt: SectorAssignment['options'][number]): string {
  if (opt.type === 'standalone') return t('sector.independent_group')
  const groupName = opt.targetGroupId ? getGroupName(opt.targetGroupId) : '-'
  const parts = [groupName]
  if (opt.extendsRange) parts.push(`(${t('sector.extends_range', { dist: opt.distance })})`)
  else parts.push(`(${t('sector.distance_n', { n: opt.distance })})`)
  return parts.join(' ')
}

function getStationCount(macro: string): number {
  return props.stationCounts[macro] || 0
}

const sortedAssignments = computed(() => {
  const order: Record<string, number> = {
    'uncertain_tie': 0,
    'uncertain_extend': 0,
    'auto': 1,
    'standalone': 2,
    'exception': 3
  }
  // Filter out pure hub anchors (they ARE the group, nothing to assign)
  const groupAnchors = new Set(props.groups.map((g) => g.sectorMacro).filter(Boolean))
  return [...props.assignments]
    .filter((a) => {
      if (a.status !== 'auto') return true
      const isAnchor = a.defaultGroupId
        ? groupAnchors.has(a.sectorMacro) && props.groups.find((g) => g.id === a.defaultGroupId)?.sectorMacro === a.sectorMacro
        : false
      return !isAnchor
    })
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
})

</script>

<template>
  <div class="allocation-list">
    <div v-if="assignments.length === 0" class="empty-hint">
      {{ t('sector.no_assignments') }}
    </div>

    <div
      v-for="assignment in sortedAssignments"
      :key="assignment.sectorMacro"
      class="allocation-card"
      :class="{
        'card-uncertain': assignment.status === 'uncertain_tie' || assignment.status === 'uncertain_extend',
        'card-auto': assignment.status === 'auto',
        'card-standalone': assignment.status === 'standalone'
      }"
    >
      <div class="card-header">
        <span class="card-sector-name">{{ getSectorDisplayName(assignment.sectorMacro) }}</span>
        <span class="card-station-count">{{ getStationCount(assignment.sectorMacro) }} {{ t('sector.stations_count') }}</span>
        <span v-if="assignment.status === 'auto'" class="card-badge badge-auto">{{ t('sector.auto_assigned') }}</span>
        <span v-else-if="assignment.status === 'uncertain_tie'" class="card-badge badge-uncertain">{{ t('sector.uncertain_tie') }}</span>
        <span v-else-if="assignment.status === 'uncertain_extend'" class="card-badge badge-uncertain">{{ t('sector.uncertain_extend') }}</span>
        <span v-else-if="assignment.status === 'standalone'" class="card-badge badge-standalone">{{ t('sector.standalone') }}</span>
        <span v-else class="card-badge badge-bad">{{ t('sector.exception') }}</span>
      </div>

      <div class="card-options">
        <div
          v-for="(opt, idx) in assignment.options"
          :key="idx"
          class="option-row"
          :class="{
            'option-selected': assignment.selectedOptionIndex === idx,
            'option-hoverable': assignment.status !== 'auto' || assignment.options.length > 1
          }"
          @click="assignment.options.length > 1 && (assignment.status !== 'auto' || true) && emit('select-option', assignment.sectorMacro, idx)"
        >
          <span class="option-radio" :class="{ 'radio-checked': assignment.selectedOptionIndex === idx }">
            {{ assignment.selectedOptionIndex === idx ? '●' : '○' }}
          </span>
          <span class="option-label">{{ getOptionLabel(opt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.allocation-list {
  @apply flex flex-col gap-2;
}

.empty-hint {
  @apply text-sm text-slate-500 text-center py-4;
}

.allocation-card {
  @apply bg-slate-800/40 rounded border border-slate-700/50 p-3 transition-colors;
}

.card-uncertain {
  @apply border-amber-500/30 bg-amber-500/5;
}

.card-auto {
  @apply border-green-500/20 bg-green-500/5;
}

.card-standalone {
  @apply border-purple-500/20 bg-purple-500/5;
}

.card-header {
  @apply flex items-center gap-2 mb-2 flex-wrap;
}

.card-sector-name {
  @apply text-sm font-semibold text-slate-200;
}

.card-station-count {
  @apply text-xs text-slate-500 ml-auto;
}

.card-badge {
  @apply text-xs px-1.5 py-0.5 rounded;
}

.badge-auto {
  @apply bg-green-500/20 text-green-400;
}

.badge-uncertain {
  @apply bg-amber-500/20 text-amber-400;
}

.badge-standalone {
  @apply bg-purple-500/20 text-purple-400;
}

.badge-bad {
  @apply bg-red-500/20 text-red-400;
}

.card-options {
  @apply flex flex-col gap-0.5;
}

.option-row {
  @apply flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors;
  @apply hover:bg-slate-700/40;
}

.option-selected {
  @apply bg-sky-500/20 text-sky-300;
}

.option-radio {
  @apply text-slate-500 text-sm;
}

.radio-checked {
  @apply text-sky-400;
}

.option-label {
  @apply text-slate-300;
}

.option-selected .option-label {
  @apply text-sky-200;
}
</style>
