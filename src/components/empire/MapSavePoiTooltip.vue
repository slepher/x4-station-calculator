<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SavePoiOverlayItem } from '@/types/saveArchive'

const props = defineProps<{
  poi: SavePoiOverlayItem
}>()

const { t } = useI18n()

const categoryLabels: Record<string, string> = {
  playerStation: 'map.save_category_player_station',
  npcStation: 'map.save_category_npc_station',
  abandonedShip: 'map.save_category_abandoned_ship',
  datavault: 'map.save_category_datavault',
  erlkingVault: 'map.save_category_erlking_vault'
}

const categoryLabel = computed(() => {
  const key = categoryLabels[props.poi.category]
  return key ? t(key) : props.poi.category
})

function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}
</script>

<template>
  <div class="save-poi-tooltip">
    <div class="tooltip-row">
      <span class="tooltip-label">{{ t('map.save_poi_tooltip_category') }}:</span>
      <span class="tooltip-value">{{ categoryLabel }}</span>
    </div>
    <div v-if="poi.owner" class="tooltip-row">
      <span class="tooltip-label">{{ t('map.save_poi_tooltip_owner') }}:</span>
      <span class="tooltip-value">{{ poi.owner }}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">{{ t('map.save_poi_tooltip_code') }}:</span>
      <span class="tooltip-value">{{ poi.code }}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">{{ t('map.save_poi_tooltip_coords') }}:</span>
      <span class="tooltip-value">({{ formatCoord(poi.pos.x) }}, {{ formatCoord(poi.pos.z) }})</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">星区:</span>
      <span class="tooltip-value">{{ poi.sectorName }}</span>
    </div>
  </div>
</template>

<style scoped>
.save-poi-tooltip {
  @apply flex flex-col gap-1 p-3 rounded-lg border border-amber-300/35 bg-black/85 text-amber-50 text-sm min-w-[180px];
  backdrop-filter: blur(8px);
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
</style>
