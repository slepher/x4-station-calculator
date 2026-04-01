<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveStore } from '@/store/useSaveStore'
import { resolveMapSectorByMacro } from './mapSectorMacro'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import type { SaveArchive, SavePoiCategory, SavePoiOverlayItem } from '@/types/saveArchive'

const props = defineProps<{
  archive: SaveArchive | null
  category: SavePoiCategory
}>()

const emit = defineEmits<{
  (e: 'focus-poi', poi: SavePoiOverlayItem): void
}>()

const { t, te, locale } = useI18n()
const gameDataStore = useGameDataStore()
const saveStore = useSaveStore()

const searchQuery = ref('')

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

interface SectorPoiGroup {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  pois: SavePoiOverlayItem[]
}

const poiGroups = computed<SectorPoiGroup[]>(() => {
  const categoryData = saveStore.getArchivePoiCategories(props.archive)[props.category]

  return categoryData.groups
    .map((group) => {
      const searchNames = getSectorSearchNames(group.sectorMacro, group.sectorName)
      const match = getLocalizedSectorQueryMatch({
        rawName: searchNames.rawName,
        displayName: searchNames.displayName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      })

      return {
        sectorMacro: group.sectorMacro,
        rawSectorName: searchNames.rawName,
        sectorName: searchNames.displayName,
        showRawSectorName: locale.value !== 'en' && match.matchedRawName && !match.matchedDisplayName,
        pois: group.items.map((item) => ({
          key: `${props.category}:${item.code}`,
          code: item.code,
          category: props.category,
          owner: 'owner' in item ? item.owner : undefined,
          sectorMacro: group.sectorMacro,
          sectorName: searchNames.displayName,
          pos: { x: item.x, z: item.z }
        }))
      }
    })
    .sort((a, b) => a.sectorName.localeCompare(b.sectorName))
})

const filteredGroups = computed<SectorPoiGroup[]>(() => {
  if (!normalizedQuery.value) return poiGroups.value

  return poiGroups.value.filter((group) =>
    getLocalizedSectorQueryMatch({
      rawName: group.rawSectorName,
      displayName: group.sectorName,
      normalizedQuery: normalizedQuery.value,
      locale: locale.value
    }).matched
  )
})

function getSectorSearchNames(sectorMacro: string, fallbackName: string): { rawName: string; displayName: string } {
  const clusters = gameDataStore.maps?.clusters || {}
  const resolved = resolveMapSectorByMacro(clusters, sectorMacro)
  if (resolved) {
    const rawName = (resolved.sector as any).name || fallbackName
    const nameId = (resolved.sector as any).nameId
    if (nameId && te(nameId)) {
      return {
        rawName,
        displayName: t(nameId)
      }
    }
    return {
      rawName,
      displayName: rawName
    }
  }
  return {
    rawName: fallbackName,
    displayName: fallbackName
  }
}

function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}

function onPoiClick(poi: SavePoiOverlayItem) {
  emit('focus-poi', poi)
}

function onClearSearch() {
  searchQuery.value = ''
}
</script>

<template>
  <div class="save-coord-list">
    <div class="search-wrap">
      <input
        v-model="searchQuery"
        class="search-input"
        :placeholder="t('map.save_coord_search_placeholder')"
        type="text"
      />
      <button
        v-if="searchQuery"
        class="search-clear"
        type="button"
        @click="onClearSearch"
      >
        ×
      </button>
    </div>

    <div class="coord-stats">
      {{ filteredGroups.reduce((sum, g) => sum + g.pois.length, 0) }} {{ t('map.save_coord_count') }}
    </div>

    <div v-if="filteredGroups.length === 0" class="empty-hint">
      {{ t('map.save_coord_empty') }}
    </div>

    <div v-else class="poi-groups">
      <div
        v-for="group in filteredGroups"
        :key="group.sectorMacro"
        class="poi-group"
      >
        <div class="group-header">
          {{ group.sectorName }}
          <span v-if="group.showRawSectorName" class="group-header-raw">({{ group.rawSectorName }})</span>
        </div>
        <div class="poi-list">
          <div
            v-for="poi in group.pois"
            :key="poi.key"
            class="poi-item"
            @click="onPoiClick(poi)"
          >
            <span class="poi-code">{{ poi.code }}</span>
            <span class="poi-coords">({{ formatCoord(poi.pos.x) }}, {{ formatCoord(poi.pos.z) }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-coord-list {
  @apply flex flex-col gap-3;
}

.search-wrap {
  @apply relative;
}

.search-input {
  @apply h-10 w-full rounded border border-amber-300/30 bg-black/60 px-3 pr-10 text-sm text-amber-50 outline-none;
}

.search-clear {
  @apply absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-amber-100/60 transition-colors duration-150 hover:text-amber-50;
}

.coord-stats {
  @apply text-xs text-amber-100/55;
}

.empty-hint {
  @apply text-sm text-amber-100/50 text-center py-4;
}

.poi-groups {
  @apply flex flex-col gap-3;
}

.poi-group {
  @apply flex flex-col gap-1;
}

.group-header {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-200/80 px-2;
}

.group-header-raw {
  @apply text-amber-100/60 font-normal normal-case;
}

.poi-list {
  @apply flex flex-col gap-1;
}

.poi-item {
  @apply flex items-center gap-2 p-2 rounded cursor-pointer bg-black/45 border border-amber-300/15 hover:bg-amber-200/5 hover:border-amber-200/45 transition-colors;
}

.poi-code {
  @apply text-sm text-amber-50 font-medium;
}

.poi-coords {
  @apply text-xs text-amber-100/55;
}
</style>
