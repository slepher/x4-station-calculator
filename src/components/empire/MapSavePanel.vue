<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MapSaveBreadcrumb from './MapSaveBreadcrumb.vue'
import MapSaveArchiveList from './MapSaveArchiveList.vue'
import MapSaveCategoryMenu from './MapSaveCategoryMenu.vue'
import MapSaveCoordList from './MapSaveCoordList.vue'
import type { SaveArchive } from '@/types/saveArchive'

export type SavePoiCategory = 'playerStation' | 'npcStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

export type SavePoiVisibility = Record<SavePoiCategory, boolean>

export interface SavePoiOverlayItem {
  key: string
  code: string
  category: SavePoiCategory
  owner?: string
  sectorMacro: string
  sectorName: string
  pos: { x: number; z: number }
}

const props = defineProps<{
  open: boolean
  archive: SaveArchive | null
  visibility: SavePoiVisibility
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-archive', archive: SaveArchive): void
  (e: 'visibility-change', visibility: SavePoiVisibility): void
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
    emit('select-archive', null as any)
  } else if (key === 'archive') {
    layer.value = 'category'
    selectedCategory.value = null
  }
}

function onArchiveSelect(archive: SaveArchive) {
  emit('select-archive', archive)
  layer.value = 'category'
}

function onCategorySelect(category: SavePoiCategory) {
  selectedCategory.value = category
  layer.value = 'coord'
}

function onVisibilityChange(newVisibility: SavePoiVisibility) {
  emit('visibility-change', newVisibility)
}

function onPoiFocus(poi: SavePoiOverlayItem) {
  emit('focus-poi', poi)
}

function onClose() {
  emit('close')
}

watch(() => props.open, (open) => {
  if (!open) {
    layer.value = 'list'
    selectedCategory.value = null
  }
})

watch(() => props.archive, (archive) => {
  if (!archive) {
    layer.value = 'list'
    selectedCategory.value = null
  } else if (layer.value === 'list') {
    layer.value = 'category'
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
      />

      <MapSaveCategoryMenu
        v-else-if="layer === 'category'"
        :archive="archive"
        :visibility="visibility"
        @visibility-change="onVisibilityChange"
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
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/80 p-4 text-amber-50;
  backdrop-filter: blur(10px);
}

.map-save-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3;
}

.map-save-panel__close {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-save-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto pr-1;
  scrollbar-color: rgba(251, 191, 36, 0.5) rgba(255, 255, 255, 0.06);
  scrollbar-width: thin;
}

.map-save-panel__body::-webkit-scrollbar {
  width: 10px;
}

.map-save-panel__body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
}

.map-save-panel__body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(252, 211, 77, 0.65), rgba(245, 158, 11, 0.55));
  border-radius: 9999px;
  border: 2px solid rgba(0, 0, 0, 0.35);
}

.map-save-panel__hint {
  @apply pt-2 text-xs text-amber-100/60;
}
</style>