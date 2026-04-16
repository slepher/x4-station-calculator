<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import type { SaveArchive, SavePoiCategory } from '@/types/saveArchive'

const props = defineProps<{
  archive: SaveArchive | null
}>()

const emit = defineEmits<{
  (e: 'select-category', category: SavePoiCategory): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()

interface CategoryInfo {
  key: SavePoiCategory
  label: string
  count: number
}

const categories = computed<CategoryInfo[]>(() => {
  const data = saveStore.getArchivePoiCategories(props.archive, {})

  return [
    { key: 'playerStation', label: t('map.save_category_player_station'), count: data.playerStation.count },
    { key: 'npcStation', label: t('map.save_category_npc_station'), count: data.npcStation.count },
    { key: 'xenonStation', label: t('map.save_category_xenon_station'), count: data.xenonStation.count },
    { key: 'khaakStation', label: t('map.save_category_khaak_station'), count: data.khaakStation.count },
    { key: 'abandonedShip', label: t('map.save_category_abandoned_ship'), count: data.abandonedShip.count },
    { key: 'datavault', label: t('map.save_category_datavault'), count: data.datavault.count },
    { key: 'erlkingVault', label: t('map.save_category_erlking_vault'), count: data.erlkingVault.count }
  ]
})

function onCategorySelect(category: SavePoiCategory) {
  emit('select-category', category)
}
</script>

<template>
  <div class="save-category-menu">
    <div class="category-header">
      {{ t('map.save_category_header') }}
    </div>

    <div class="category-list">
      <button
        v-for="cat in categories"
        :key="cat.key"
        type="button"
        class="category-item"
        :aria-label="`${cat.label} details`"
        @click="onCategorySelect(cat.key)"
      >
        <span class="category-label">{{ cat.label }}</span>
        <span class="category-count">({{ cat.count }})</span>
        <span class="category-arrow">→</span>
      </button>
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
  @apply flex items-center gap-2 p-3 rounded bg-black/45 border border-amber-300/15 text-left hover:bg-amber-200/5 hover:border-amber-200/45 transition-colors;
}

.category-label {
  @apply flex-1 text-sm text-amber-50;
}

.category-count {
  @apply text-xs text-amber-100/55;
}

.category-arrow {
  @apply text-sm text-amber-200/70;
}
</style>