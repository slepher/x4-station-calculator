<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'
import type { TradeStationCandidate, TradeStationSelection } from '@/store/logic/tradeStationSelection'
import { SAVE_POI_ICON_MAP, getSavePoiIconUrl } from '@/components/map/utils/style'
import factoryIconUrl from '@/components/icons/factory.svg'
import type { SavePoiOverlayItem } from '@/types/saveArchive'

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

function formatCoordKm(value: number): string {
  return `${(value / 1000).toFixed(1)}km`
}

function getCandidateIconUrl(candidate: TradeStationCandidate): string {
  const poiLike: SavePoiOverlayItem = {
    key: `trade-station-candidate:${candidate.stationCode}`,
    code: candidate.stationCode,
    category: 'playerStation',
    owner: 'player',
    sectorMacro: props.group.sectorMacro || '',
    sectorName: props.group.name,
    position: { x: 0, y: 0, z: 0 },
    tag: candidate.tag,
    factoryGroup: candidate.factoryGroup,
    is_headquarter: candidate.isHeadquarter
  }
  return getSavePoiIconUrl(poiLike) || factoryIconUrl
}

function getVirtualIconUrl(): string {
  return SAVE_POI_ICON_MAP.tradestation || factoryIconUrl
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
        <span
          class="candidate-icon-wrap"
          :class="{ 'candidate-icon-wrap--selected': isSelected('player', candidate.stationCode) }"
        >
          <img class="candidate-icon" :src="getCandidateIconUrl(candidate)" alt="" />
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
        <span
          class="candidate-icon-wrap"
          :class="{ 'candidate-icon-wrap--selected': isSelected('virtual') }"
        >
          <img class="candidate-icon" :src="getVirtualIconUrl()" alt="" />
        </span>
        <span class="candidate-info">
          <span class="candidate-name">{{ t('sector.virtual_trade_station') }}</span>
          <span v-if="group.virtualTradeStationPosition" class="candidate-meta">
            x: {{ formatCoordKm(group.virtualTradeStationPosition.x) }} / z: {{ formatCoordKm(group.virtualTradeStationPosition.z) }}
          </span>
        </span>
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
  @apply bg-emerald-500/10 text-emerald-200;
}

.candidate-item--virtual {
  @apply border-t border-slate-700/30 mt-0.5 pt-2;
}

.candidate-icon-wrap {
  @apply relative flex h-6 w-6 flex-shrink-0 items-center justify-center;
}

.candidate-icon-wrap--selected {
  filter: drop-shadow(0 0 7px rgba(52, 211, 153, 0.95)) drop-shadow(0 0 14px rgba(16, 185, 129, 0.55));
}

.candidate-icon {
  @apply h-6 w-6 object-contain;
  filter: brightness(0) saturate(100%) invert(64%) sepia(60%) saturate(450%) hue-rotate(84deg) brightness(92%) contrast(91%);
}

.candidate-info {
  @apply flex items-center gap-2 flex-1 min-w-0;
}

.candidate-name {
  @apply text-slate-200 truncate;
}

.candidate-item--selected .candidate-name {
  @apply text-emerald-200;
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

.trade-station-card--map .candidate-icon-wrap {
  @apply h-5 w-5;
}

.trade-station-card--map .candidate-icon {
  @apply h-5 w-5;
}
</style>
