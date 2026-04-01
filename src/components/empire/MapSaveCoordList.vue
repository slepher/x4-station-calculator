<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { SaveArchive, SectorData } from '@/types/saveArchive'
import type { SavePoiCategory, SavePoiOverlayItem } from './MapSavePanel.vue'

const props = defineProps<{
  archive: SaveArchive | null
  category: SavePoiCategory
}>()

const emit = defineEmits<{
  (e: 'focus-poi', poi: SavePoiOverlayItem): void
}>()

const { t, te } = useI18n()
const gameDataStore = useGameDataStore()

const searchQuery = ref('')

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

interface SectorPoiGroup {
  sectorMacro: string
  sectorName: string
  pois: SavePoiOverlayItem[]
}

const poiGroups = computed<SectorPoiGroup[]>(() => {
  if (!props.archive) return []

  const groups: Map<string, SectorPoiGroup> = new Map()

  for (const [sectorMacro, sector] of Object.entries(props.archive.sectors)) {
    const pois = getSectorPois(sectorMacro, sector, props.category)
    if (pois.length === 0) continue

    const sectorName = getSectorDisplayName(sectorMacro, sector.name)
    groups.set(sectorMacro, {
      sectorMacro,
      sectorName,
      pois
    })
  }

  return Array.from(groups.values()).sort((a, b) => a.sectorName.localeCompare(b.sectorName))
})

const filteredGroups = computed<SectorPoiGroup[]>(() => {
  if (!normalizedQuery.value) return poiGroups.value

  return poiGroups.value.filter(group =>
    group.sectorName.toLowerCase().includes(normalizedQuery.value)
  )
})

function getSectorDisplayName(sectorMacro: string, name: string): string {
  const clusters = gameDataStore.maps?.clusters || {}
  for (const cluster of Object.values(clusters)) {
    for (const [sectorId, sector] of Object.entries(cluster.sectors || {})) {
      if (sectorId === sectorMacro || (sector as any).macro === sectorMacro) {
        const nameId = (sector as any).nameId
        if (nameId && te(nameId)) {
          return t(nameId)
        }
        return (sector as any).name || name
      }
    }
  }
  return name
}

function getSectorPois(sectorMacro: string, sector: SectorData, category: SavePoiCategory): SavePoiOverlayItem[] {
  const pois: SavePoiOverlayItem[] = []
  const sectorName = sector.name

  if (category === 'playerStation' || category === 'npcStation') {
    const filtered = sector.stations.filter(s =>
      category === 'playerStation' ? s.owner === 'player' : s.owner !== 'player'
    )
    for (const station of filtered) {
      pois.push({
        key: `${category}:${station.code}`,
        code: station.code,
        category,
        owner: station.owner,
        sectorMacro,
        sectorName,
        pos: { x: station.x, z: station.z }
      })
    }
  } else if (category === 'abandonedShip') {
    for (const ship of sector.abandonedShips) {
      pois.push({
        key: `${category}:${ship.code}`,
        code: ship.code,
        category,
        owner: undefined,
        sectorMacro,
        sectorName,
        pos: { x: ship.x, z: ship.z }
      })
    }
  } else if (category === 'datavault') {
    for (const vault of sector.datavaults) {
      pois.push({
        key: `${category}:${vault.code}`,
        code: vault.code,
        category,
        owner: vault.owner,
        sectorMacro,
        sectorName,
        pos: { x: vault.x, z: vault.z }
      })
    }
  } else if (category === 'erlkingVault') {
    for (const vault of sector.erlkingVaults) {
      pois.push({
        key: `${category}:${vault.code}`,
        code: vault.code,
        category,
        owner: vault.owner,
        sectorMacro,
        sectorName,
        pos: { x: vault.x, z: vault.z }
      })
    }
  }

  return pois
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
        <div class="group-header">{{ group.sectorName }}</div>
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