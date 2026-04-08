<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MapSaveBreadcrumb from './MapSaveBreadcrumb.vue'
import MapSaveArchiveList from './MapSaveArchiveList.vue'
import MapSaveCategoryMenu from './MapSaveCategoryMenu.vue'
import MapSaveCoordList from './MapSaveCoordList.vue'
import type { SaveArchive, SavePoiCategory, SavePoiOverlayItem } from '@/types/saveArchive'

const props = defineProps<{
  open: boolean
  archive: SaveArchive | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-archive', payload: { guid: string; time: number } | null): void
  (e: 'select-archive-and-navigate', payload: { guid: string; time: number }): void
  (e: 'active-category-change', category: SavePoiCategory | null): void
  (e: 'focus-poi', poi: SavePoiOverlayItem): void
}>()

const { t } = useI18n()

type PanelLayer = 'list' | 'category' | 'coord'

const layer = ref<PanelLayer>('list')
const selectedCategory = ref<SavePoiCategory | null>(null)

interface BreadcrumbItem {
  key: string
  label: string
  clickable?: boolean
}

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ key: 'root', label: t('map.save_breadcrumb_root') }]
  if (props.archive && layer.value !== 'list') {
    items.push({
      key: 'archive',
      label: props.archive.meta.playerName,
      clickable: true
    })
  }
  if (selectedCategory.value && layer.value === 'coord') {
    items.push({
      key: 'category',
      label: getCategoryLabel(selectedCategory.value),
      clickable: true
    })
  }
  return items
})

function getCategoryLabel(category: SavePoiCategory): string {
  const labels: Record<SavePoiCategory, string> = {
    playerStation: t('map.save_category_player_station'),
    npcStation: t('map.save_category_npc_station'),
    xenonStation: t('map.save_category_xenon_station'),
    khaakStation: t('map.save_category_khaak_station'),
    abandonedShip: t('map.save_category_abandoned_ship'),
    datavault: t('map.save_category_datavault'),
    erlkingVault: t('map.save_category_erlking_vault')
  }
  return labels[category]
}

function onBreadcrumbNavigate(key: string) {
  if (key === 'root') {
    layer.value = 'list'
    selectedCategory.value = null
    emit('active-category-change', null)
  } else if (key === 'archive') {
    layer.value = 'category'
    selectedCategory.value = null
    emit('active-category-change', null)
  }
}

function onArchiveSelect(payload: { guid: string; time: number } | null) {
  emit('select-archive', payload)
}

function onArchiveSelectAndNavigate(payload: { guid: string; time: number }) {
  emit('select-archive-and-navigate', payload)
  layer.value = 'category'
  selectedCategory.value = null
  emit('active-category-change', null)
}

function onCategorySelect(category: SavePoiCategory) {
  selectedCategory.value = category
  layer.value = 'coord'
  emit('active-category-change', category)
}

function onPoiFocus(poi: SavePoiOverlayItem) {
  emit('focus-poi', poi)
}

function onClose() {
  emit('active-category-change', null)
  emit('close')
}

watch(() => props.open, (open) => {
  if (!open) {
    layer.value = 'list'
    selectedCategory.value = null
    emit('active-category-change', null)
  } else {
    layer.value = 'list'
    selectedCategory.value = null
    emit('active-category-change', null)
  }
})

watch(() => props.archive, (archive) => {
  if (!archive) {
    layer.value = 'list'
    selectedCategory.value = null
    emit('active-category-change', null)
  }
})
</script>

<template>
  <aside v-show="open" class="map-save-panel" data-testid="map-save-panel">
    <div class="map-save-panel__header">
      <MapSaveBreadcrumb :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
      <button
        class="map-save-panel__close"
        data-testid="map-save-panel-close"
        type="button"
        @click="onClose"
      >
        {{ t('map.save_panel_close') }}
      </button>
    </div>

    <div class="map-save-panel__body scrollbar-thin">
      <MapSaveArchiveList
        v-if="layer === 'list'"
        @select="onArchiveSelect"
        @select-and-navigate="onArchiveSelectAndNavigate"
      />

      <MapSaveCategoryMenu
        v-else-if="layer === 'category'"
        :archive="archive"
        @select-category="onCategorySelect"
      />

      <MapSaveCoordList
        v-else-if="layer === 'coord'"
        :archive="archive"
        :category="selectedCategory!"
        @focus-poi="onPoiFocus"
      />
    </div>

    <div class="map-save-panel__hint">
      {{ t('map.save_panel_hint') }}
    </div>
  </aside>
</template>

<style scoped>
.map-save-panel {
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/60 py-3 px-0 text-amber-50;
  backdrop-filter: blur(8px);
}

.map-save-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-amber-300/15 px-3 pb-3;
}

.map-save-panel__close {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-save-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto px-3;
  scrollbar-gutter: stable both-edges;
  scrollbar-color: rgba(251, 191, 36, 0.55) rgba(15, 23, 42, 0.25);
  scrollbar-width: thin;
}

.map-save-panel__body::-webkit-scrollbar {
  width: 6px;
}

.map-save-panel__body::-webkit-scrollbar-track {
  @apply rounded-full bg-slate-900/35;
}

.map-save-panel__body::-webkit-scrollbar-thumb {
  @apply rounded-full bg-amber-300/45;
}

.map-save-panel__body::-webkit-scrollbar-thumb:hover {
  @apply bg-amber-200/60;
}

.map-save-panel__hint {
  @apply px-3 pt-2 text-xs text-amber-100/60;
}

</style>
