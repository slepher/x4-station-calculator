<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { SavePoiOverlayItem } from '@/types/saveArchive'

const props = defineProps<{
  poi: SavePoiOverlayItem
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t, te } = useI18n()
const gameDataStore = useGameDataStore()

const categoryLabels: Record<string, string> = {
  playerStation: 'map.save_category_player_station',
  npcStation: 'map.save_category_npc_station',
  xenonStation: 'map.save_category_xenon_station',
  khaakStation: 'map.save_category_khaak_station',
  abandonedShip: 'map.save_category_abandoned_ship',
  datavault: 'map.save_category_datavault',
  erlkingVault: 'map.save_category_erlking_vault'
}

const categoryLabel = computed(() => {
  const key = categoryLabels[props.poi.category]
  return key ? t(key) : props.poi.category
})

function formatCoordKm(value: number | undefined): string {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return `${(safeValue / 1000).toFixed(1)}km`
}

const ownerLabel = computed(() => {
  const owner = props.poi.owner
  if (!owner) return ''
  if (owner === 'ownerless') return t('map.owner_ownerless')
  const faction = gameDataStore.factions?.find(f => f.id === owner)
  if (faction?.nameId && te(faction.nameId)) {
    return t(faction.nameId)
  }
  return faction?.name || owner
})
</script>

<template>
  <div class="save-poi-tooltip">
    <div class="tooltip-header">
      <div class="tooltip-title-block">
        <div class="tooltip-title">{{ poi.code }}</div>
        <div class="tooltip-subtitle">{{ categoryLabel }}</div>
      </div>
      <button class="tooltip-close" type="button" @click="emit('close')">×</button>
    </div>
    <div v-if="poi.owner" class="tooltip-row">
      <span class="tooltip-label">{{ t('map.save_poi_tooltip_owner') }}:</span>
      <span class="tooltip-value">{{ ownerLabel }}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">星区:</span>
      <span class="tooltip-value">{{ poi.sectorName }}</span>
    </div>
    <div class="tooltip-divider" />
    <div class="tooltip-row">
      <span class="tooltip-label">x:</span>
      <span class="tooltip-value">{{ formatCoordKm(poi.position.x) }}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">y:</span>
      <span class="tooltip-value">{{ formatCoordKm(poi.position.y) }}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">z:</span>
      <span class="tooltip-value">{{ formatCoordKm(poi.position.z) }}</span>
    </div>
  </div>
</template>

<style scoped>
.save-poi-tooltip {
  @apply flex min-w-[220px] flex-col gap-2 rounded-lg border border-amber-300/35 bg-black/85 p-3 text-sm text-amber-50;
  backdrop-filter: blur(8px);
}

.tooltip-header {
  @apply flex items-start justify-between gap-3;
}

.tooltip-title-block {
  @apply min-w-0;
}

.tooltip-title {
  @apply truncate text-base font-semibold text-amber-50;
}

.tooltip-subtitle {
  @apply text-xs text-amber-100/70;
}

.tooltip-row {
  @apply flex justify-between gap-2;
}

.tooltip-label {
  @apply text-amber-200/80;
}

.tooltip-value {
  @apply text-amber-50 font-medium;
}

.tooltip-divider {
  @apply border-t border-amber-300/15;
}

.tooltip-close {
  @apply inline-flex h-7 w-7 items-center justify-center rounded border border-amber-300/25 text-base text-amber-100/75 transition-colors duration-150 hover:border-amber-200/55 hover:text-amber-50;
}
</style>
