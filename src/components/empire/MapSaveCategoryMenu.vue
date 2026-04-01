<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaveArchive } from '@/types/saveArchive'
import type { SavePoiCategory, SavePoiVisibility } from './MapSavePanel.vue'

const props = defineProps<{
  archive: SaveArchive | null
  visibility: SavePoiVisibility
}>()

const emit = defineEmits<{
  (e: 'visibility-change', visibility: SavePoiVisibility): void
  (e: 'select-category', category: SavePoiCategory): void
}>()

const { t } = useI18n()

interface CategoryInfo {
  key: SavePoiCategory
  label: string
  count: number
}

const categories = computed<CategoryInfo[]>(() => {
  if (!props.archive) return []

  let playerStations = 0
  let npcStations = 0
  let abandonedShips = 0
  let datavaults = 0
  let erlkingVaults = 0

  for (const sector of Object.values(props.archive.sectors)) {
    for (const station of sector.stations) {
      if (station.owner === 'player') {
        playerStations++
      } else {
        npcStations++
      }
    }
    abandonedShips += sector.abandonedShips.length
    datavaults += sector.datavaults.length
    erlkingVaults += sector.erlkingVaults.length
  }

  return [
    { key: 'playerStation', label: t('map.save_category_player_station'), count: playerStations },
    { key: 'npcStation', label: t('map.save_category_npc_station'), count: npcStations },
    { key: 'abandonedShip', label: t('map.save_category_abandoned_ship'), count: abandonedShips },
    { key: 'datavault', label: t('map.save_category_datavault'), count: datavaults },
    { key: 'erlkingVault', label: t('map.save_category_erlking_vault'), count: erlkingVaults }
  ]
})

function onCheckboxChange(category: SavePoiCategory, checked: boolean) {
  const newVisibility = { ...props.visibility, [category]: checked }
  emit('visibility-change', newVisibility)
}

function onCategoryClick(category: SavePoiCategory) {
  emit('select-category', category)
}
</script>

<template>
  <div class="save-category-menu">
    <div class="category-header">
      {{ t('map.save_category_header') }}
    </div>

    <div class="category-list">
      <div
        v-for="cat in categories"
        :key="cat.key"
        class="category-item"
        @click="onCategoryClick(cat.key)"
      >
        <label class="category-checkbox">
          <input
            type="checkbox"
            :checked="visibility[cat.key]"
            @change="onCheckboxChange(cat.key, ($event.target as HTMLInputElement).checked)"
            @click.stop
          />
          <span class="category-label">{{ cat.label }}</span>
          <span class="category-count">({{ cat.count }})</span>
        </label>
        <span class="category-arrow">→</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-category-menu {
  @apply flex flex-col gap-2;
}

.category-header {
  @apply text-xs text-amber-200/80 uppercase tracking-wider;
}

.category-list {
  @apply flex flex-col gap-2;
}

.category-item {
  @apply flex items-center justify-between p-3 rounded cursor-pointer bg-black/45 border border-amber-300/15 hover:bg-amber-200/5 hover:border-amber-200/45 transition-colors;
}

.category-checkbox {
  @apply flex items-center gap-2 cursor-pointer;
}

.category-checkbox input[type="checkbox"] {
  @apply w-4 h-4 accent-amber-400 rounded border-amber-300/30;
}

.category-label {
  @apply text-sm text-amber-50;
}

.category-count {
  @apply text-xs text-amber-100/55;
}

.category-arrow {
  @apply text-amber-200/55 text-sm;
}
</style>