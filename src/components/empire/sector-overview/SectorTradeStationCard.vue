<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'
import type { TradeStationCandidate, TradeStationSelection } from '@/store/logic/tradeStationSelection'

const props = defineProps<{
  group: GroupDraftInfo
  candidates: TradeStationCandidate[]
  selected: TradeStationSelection | null
  disabled: boolean
  view?: 'map' | 'live'
}>()

const emit = defineEmits<{
  (e: 'select', groupId: string, selection: TradeStationSelection): void
  (e: 'focus-sector', sectorMacro: string): void
}>()

const { t } = useI18n()

function onSelectPlayer(code: string) {
  emit('select', props.group.id, { type: 'player', stationCode: code })
}

function onSelectVirtual() {
  emit('select', props.group.id, { type: 'virtual', stationCode: '__virtual__' })
}

function isSelected(type: 'player' | 'virtual', code?: string): boolean {
  if (!props.selected) return false
  if (type === 'virtual') return props.selected.type === 'virtual'
  return props.selected.type === 'player' && props.selected.stationCode === code
}

function formatCap(cap: number): string {
  if (cap >= 1_000_000) {
    return (cap / 1_000_000).toFixed(1) + 'M'
  }
  return Math.round(cap).toLocaleString()
}
</script>

<template>
  <div class="trade-station-card" :class="{ 'trade-station-card--map': view === 'map' }">
    <div class="card-header">
      <span
        class="card-group-name"
        :class="{ 'cursor-pointer hover:text-sky-300': view === 'map' }"
        @click="view === 'map' && group.sectorMacro && emit('focus-sector', group.sectorMacro)"
      >{{ group.name }}</span>
    </div>
    <ul class="candidate-list">
      <li
        v-for="candidate in candidates"
        :key="candidate.stationCode"
        class="candidate-item"
        :class="{ 'candidate-item--selected': isSelected('player', candidate.stationCode) }"
        @click="!disabled && onSelectPlayer(candidate.stationCode)"
      >
        <span class="option-radio" :class="{ 'radio-checked': isSelected('player', candidate.stationCode) }">
          {{ isSelected('player', candidate.stationCode) ? '●' : '○' }}
        </span>
        <span class="candidate-info">
          <span class="candidate-name">{{ candidate.stationCode }}</span>
          <span class="candidate-meta">
            {{ t('sector.container_cap') }}: {{ formatCap(candidate.containerCap) }}
          </span>
        </span>
      </li>
      <li
        class="candidate-item candidate-item--virtual"
        :class="{ 'candidate-item--selected': isSelected('virtual') }"
        @click="!disabled && onSelectVirtual()"
      >
        <span class="option-radio" :class="{ 'radio-checked': isSelected('virtual') }">
          {{ isSelected('virtual') ? '●' : '○' }}
        </span>
        <span class="candidate-name">{{ t('sector.virtual_trade_station') }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.trade-station-card {
  @apply bg-slate-800/40 rounded border border-slate-700/50 p-3 transition-colors;
}

.trade-station-card--map {
  @apply p-2;
}

.card-header {
  @apply flex items-center gap-2 mb-2;
}

.card-group-name {
  @apply text-sm font-semibold text-slate-200;
}

.candidate-list {
  @apply list-none p-0 m-0 flex flex-col gap-0.5;
}

.candidate-item {
  @apply flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors hover:bg-slate-700/40;
}

.candidate-item--selected {
  @apply bg-sky-500/20 text-sky-200;
}

.candidate-item--virtual {
  @apply border-t border-slate-700/30 mt-0.5 pt-2;
}

.option-radio {
  @apply text-slate-500 text-sm flex-shrink-0;
}

.radio-checked {
  @apply text-sky-400;
}

.candidate-info {
  @apply flex items-center gap-2 flex-1 min-w-0;
}

.candidate-name {
  @apply text-slate-200 truncate;
}

.candidate-item--selected .candidate-name {
  @apply text-sky-200;
}

.candidate-meta {
  @apply text-slate-500 ml-auto flex-shrink-0;
}

/* Map compact */
.trade-station-card--map .card-group-name {
  @apply text-xs;
}

.trade-station-card--map .candidate-item {
  @apply px-1.5 py-1 text-[11px];
}
</style>
