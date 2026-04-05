<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapStore } from '@/store/useMapStore'
import { useSaveStore, createOverlayItem } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import MapSavePoiSearchControl from './MapSavePoiSearchControl.vue'
import {
  filterStationBySearchState,
  isSearchStateEmpty,
  buildReachableSectorMacros,
  isSectorReachable
} from './savePoiSearchFilter'
import type { SearchState } from './savePoiSearchFilter'
import type { SaveArchive, SavePoiCategory, SavePoiOverlayItem, StationEntry } from '@/types/saveArchive'
import { getStationPoiLabel } from './savePoiLabel'

const props = defineProps<{
  archive: SaveArchive | null
  category: SavePoiCategory
}>()

const emit = defineEmits<{
  (e: 'focus-poi', poi: SavePoiOverlayItem): void
}>()

const { t, te, locale } = useI18n()
const mapStore = useMapStore()
const saveStore = useSaveStore()
const gameData = useGameDataStore()
const { translateShip } = useX4I18n()

const searchQuery = ref('')
const searchState = ref<SearchState & { sectorJumpLimit?: number }>({
  productModuleTags: [],
  factionTags: [],
  sectorTags: [],
  sectorJumpLimit: 5
})

const isStationCategory = computed(() => {
  return (
    props.category === 'npcStation' ||
    props.category === 'playerStation' ||
    props.category === 'xenonStation' ||
    props.category === 'khaakStation'
  )
})

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

interface SectorPoiGroup {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  pois: SavePoiOverlayItem[]
  rawItems?: StationEntry[]
}

const reachableSectorMacros = computed(() => {
  if (searchState.value.sectorTags.length === 0) {
    return new Set<string>()
  }
  const jumpLimit = searchState.value.sectorJumpLimit ?? 5
  return buildReachableSectorMacros(searchState.value.sectorTags, gameData.maps, jumpLimit)
})

const poiGroups = computed<SectorPoiGroup[]>(() => {
  const categoryData = saveStore.getArchivePoiCategories(props.archive, {})[props.category]

  return categoryData.groups
    .map((group) => {
      const searchNames = getSectorSearchNames(group.sectorMacro, group.sectorName)

      return {
        sectorMacro: group.sectorMacro,
        rawSectorName: searchNames.rawName,
        sectorName: searchNames.displayName,
        showRawSectorName: false,
        pois: group.items.map((item) => createOverlayItem(props.category, group.sectorMacro, searchNames.displayName, item)),
        rawItems: group.items as StationEntry[]
      }
    })
    .filter((group) => group.pois.length > 0)
    .sort((a, b) => a.sectorName.localeCompare(b.sectorName))
})

const filteredGroups = computed<SectorPoiGroup[]>(() => {
  let groups = poiGroups.value

  if (!isStationCategory.value && normalizedQuery.value) {
    groups = groups.filter((group) =>
      getLocalizedSectorQueryMatch({
        rawName: group.rawSectorName,
        displayName: group.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      }).matched
    )
  }

  if (isStationCategory.value && !isSearchStateEmpty(searchState.value)) {
    if (reachableSectorMacros.value.size > 0) {
      groups = groups.filter((group) => isSectorReachable(group.sectorMacro, reachableSectorMacros.value))
    }

    if (searchState.value.productModuleTags.length > 0 || searchState.value.factionTags.length > 0) {
      const modulesByMacroId = gameData.modulesByMacroId
      groups = groups.map((group) => {
        const filteredItems = (group.rawItems || []).filter((item) =>
          filterStationBySearchState(item, searchState.value, modulesByMacroId)
        )
        return {
          ...group,
          pois: filteredItems.map((item) =>
            createOverlayItem(props.category, group.sectorMacro, group.sectorName, item)
          ),
          rawItems: filteredItems
        }
      }).filter((group) => group.pois.length > 0)
    }
  }

  return groups
})

function getSectorSearchNames(sectorMacro: string, fallbackName: string): { rawName: string; displayName: string } {
  const resolved = mapStore.resolveSectorByMacro(sectorMacro)
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

function getShipName(poi: SavePoiOverlayItem): string {
  if (poi.category !== 'abandonedShip' || !poi.shipId) return poi.code
  
  const ships = gameData.gameData?.ships
  if (!ships) return poi.code
  
  const ship = ships.find((s) => s.id === poi.shipId)
  if (!ship) return poi.code
  
  return translateShip(ship)
}

function onPoiClick(poi: SavePoiOverlayItem) {
  emit('focus-poi', poi)
}

function onClearSearch() {
  searchQuery.value = ''
}

function onSearchChange(newState: SearchState & { sectorJumpLimit?: number }) {
  searchState.value = newState
}

function getPoiLabel(poi: SavePoiOverlayItem): string {
  if (poi.category === 'abandonedShip') return getShipName(poi)
  if (
    poi.category === 'npcStation' ||
    poi.category === 'playerStation' ||
    poi.category === 'xenonStation' ||
    poi.category === 'khaakStation'
  ) {
    return getStationPoiLabel(poi, {
      t,
      localizedModulesMap: gameData.localizedModulesMap,
      localizedModuleGroupsMap: gameData.localizedModuleGroupsMap
    })
  }
  return poi.code
}
</script>

<template>
  <div class="save-coord-list">
    <MapSavePoiSearchControl
      v-if="isStationCategory"
      @search-change="onSearchChange"
    />

    <div v-if="!isStationCategory" class="search-wrap">
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
            <div class="poi-text">
              <div class="poi-title-row">
                <span class="poi-code">{{ getPoiLabel(poi) }}</span>
                <span
                  v-if="(poi.category === 'playerStation' || poi.category === 'npcStation' || poi.category === 'xenonStation' || poi.category === 'khaakStation') && poi.is_headquarter"
                  class="poi-badge"
                >
                  {{ t('map.save_station_headquarter') }}
                </span>
              </div>
              <span
                v-if="poi.category === 'npcStation' || poi.category === 'playerStation' || poi.category === 'xenonStation' || poi.category === 'khaakStation'"
                class="poi-subcode"
              >{{ poi.code }}</span>
            </div>
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

.poi-text {
  @apply flex min-w-0 flex-col;
}

.poi-title-row {
  @apply flex min-w-0 items-center gap-2;
}

.poi-code {
  @apply truncate text-sm text-amber-50;
}

.poi-badge {
  @apply shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300;
}

.poi-subcode {
  @apply text-xs text-amber-100/55;
}

.poi-coords {
  @apply text-xs text-amber-100/55;
}
</style>