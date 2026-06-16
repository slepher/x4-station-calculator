<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'
import type { TradeStationCandidate, TradeStationSelection } from '@/store/logic/tradeStationSelection'
import SectorTradeStationCard from './SectorTradeStationCard.vue'

const props = withDefaults(defineProps<{
  groups: GroupDraftInfo[]
  candidates: Record<string, TradeStationCandidate[]>
  selected: Record<string, TradeStationSelection>
  disabled?: boolean
  view?: 'map' | 'live'
}>(), {
  view: 'live'
})

const emit = defineEmits<{
  (e: 'select', groupId: string, selection: TradeStationSelection): void
  (e: 'focus-sector', sectorMacro: string): void
}>()

const { t } = useI18n()

const hubGroups = computed(() =>
  props.groups.filter((g) => g.sectorMacro)
)

const hasEntries = computed(() => hubGroups.value.length > 0)
</script>

<template>
  <div class="trade-station-list" :class="{ 'trade-station-list--map': view === 'map' }">
    <div v-if="!hasEntries" class="empty-hint">
      {{ t('sector.no_trade_station_candidates') }}
    </div>

    <SectorTradeStationCard
      v-for="group in hubGroups"
      v-else
      :key="group.id"
      :group="group"
      :candidates="candidates[group.id] ?? []"
      :selected="selected[group.id] ?? null"
      :disabled="disabled ?? false"
      :view="view"
      @select="(groupId: string, selection: TradeStationSelection) => emit('select', groupId, selection)"
      @focus-sector="emit('focus-sector', $event)"
    />
  </div>
</template>

<style scoped>
.trade-station-list {
  @apply flex flex-col gap-2 pb-2;
}

.empty-hint {
  @apply text-sm text-slate-500 text-center py-4;
}

/* Map compact */
.trade-station-list--map {
  @apply gap-1.5;
}
</style>
