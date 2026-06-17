<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapStore } from '@/store/useMapStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSectorNameFilter } from '@/composables/useSectorNameFilter'
import type { X4MapSector } from '@/types/x4'

const props = defineProps<{
  open: boolean
  mode?: 'inline' | 'overlay'
  playerSectorMacros: string[]
  occupiedSectorMacros: string[]
  draftAnchorSectorMacro?: string | null
  currentBoundSectorMacro?: string | null
}>()

const isOverlay = computed(() => props.mode === 'overlay')

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add-hub', sectorMacro: string): void
  (e: 'focus-sector', sectorMacro: string): void
}>()

const { t } = useI18n()
const mapStore = useMapStore()
const gameDataStore = useGameDataStore()

const searchQuery = ref('')
const { getSectorDisplayName, normalizedQuery, filterSectors } = useSectorNameFilter(searchQuery)

const occupied = computed(() => new Set(props.occupiedSectorMacros))
const isCurrentBound = computed(() => new Set(props.currentBoundSectorMacro ? [props.currentBoundSectorMacro] : []))
const isDraftBound = computed(() => new Set(props.draftAnchorSectorMacro ? [props.draftAnchorSectorMacro] : []))

function isSectorOccupied(macro: string) { return occupied.value.has(macro) }
function isCurrentBoundSector(macro: string) { return isCurrentBound.value.has(macro) }
function isDraftBoundSector(macro: string) { return isDraftBound.value.has(macro) }

const saveSectors = computed(() => {
  const entries = props.playerSectorMacros.map((m) => getSectorDisplayName(m, m))
  return filterSectors(entries)
})

const visibleMapSectors = computed(() => {
  if (normalizedQuery.value) return []
  const visible = mapStore.computeVisibleSectorCenters()
  if (!visible) return []
  const saveSet = new Set(props.playerSectorMacros)
  const entries = visible
    .filter((v: { sectorMacro: string }) => !saveSet.has(v.sectorMacro))
    .map((v: { sectorMacro: string }) => getSectorDisplayName(v.sectorMacro, v.sectorMacro))
  return filterSectors(entries)
})

const searchAllSectors = computed(() => {
  if (!normalizedQuery.value) return []
  const maps = gameDataStore.maps
  if (!maps) return []
  const entries = (Object.values(maps.sectors) as X4MapSector[])
    .map((s) => getSectorDisplayName(s.id, s.id))
  const filtered = filterSectors(entries)
  return filtered
})

const filteredSearchAllSectors = computed(() => {
  const saveMacros = new Set(saveSectors.value.map((s) => s.sectorMacro))
  return searchAllSectors.value.filter((s) => !saveMacros.has(s.sectorMacro))
})

function onSelect(macro: string) {
  searchQuery.value = ''
  emit('add-hub', macro)
}

function onFocus(macro: string) {
  emit('focus-sector', macro)
}

function close() {
  searchQuery.value = ''
  emit('close')
}

defineExpose({ resetSearch: () => { searchQuery.value = '' } })
</script>

<template>
  <template v-if="isOverlay && open">
    <div class="hub-add-menu-backdrop" @click.self="close()">
      <div class="hub-add-menu hub-add-menu--overlay">
        <div class="hub-add-menu-header">
          <span class="hub-add-menu-title">{{ t('sector.add_hub') }}</span>
          <button class="hub-add-menu-close" type="button" @click="close()">x</button>
        </div>
        <div class="hub-add-menu-search hub-add-menu-search--overlay">
          <input
            v-model="searchQuery"
            class="hub-add-menu-search-input"
            :placeholder="t('map.save_coord_search_placeholder')"
            @keydown.escape="close()"
          />
          <button v-if="searchQuery" class="hub-add-menu-search-clear" type="button" @click="searchQuery = ''">x</button>
        </div>
        <div class="hub-add-menu-groups hub-add-menu-groups--overlay">
        <div class="hub-add-menu-group">
          <div class="hub-add-menu-group-title">{{ t('map.binding_save_sector_candidates') }}</div>
          <button
            v-for="sector in saveSectors"
            :key="sector.sectorMacro"
            type="button"
            class="hub-add-menu-item"
            :class="{
              active: isCurrentBoundSector(sector.sectorMacro),
              'draft-active': isDraftBoundSector(sector.sectorMacro),
              orange: isSectorOccupied(sector.sectorMacro)
            }"
            :disabled="isSectorOccupied(sector.sectorMacro)"
            @click="onSelect(sector.sectorMacro)"
          >{{ sector.sectorName }}<span v-if="sector.showRawSectorName" class="sector-raw-name">{{ sector.rawSectorName }}</span></button>
          <div v-if="saveSectors.length === 0" class="hub-add-menu-empty">{{ t('map.binding_no_unbound_sectors') }}</div>
        </div>
        <div v-if="normalizedQuery" class="hub-add-menu-group">
          <div class="hub-add-menu-group-title">{{ t('map.binding_search_results') }}</div>
          <button
            v-for="sector in filteredSearchAllSectors"
            :key="sector.sectorMacro"
            type="button"
            class="hub-add-menu-item"
            :class="{ orange: isSectorOccupied(sector.sectorMacro) }"
            :disabled="isSectorOccupied(sector.sectorMacro)"
            @click="onSelect(sector.sectorMacro)"
          >{{ sector.sectorName }}<span v-if="sector.showRawSectorName" class="sector-raw-name">{{ sector.rawSectorName }}</span></button>
          <div v-if="filteredSearchAllSectors.length === 0" class="hub-add-menu-empty">{{ normalizedQuery ? t('map.binding_no_visible_sectors') : '' }}</div>
        </div>
        </div>
      </div>
    </div>
  </template>
  <div v-else-if="open" class="hub-add-menu">
    <div v-if="isOverlay" class="hub-add-menu-header">
      <span class="hub-add-menu-title">{{ t('sector.add_hub') }}</span>
      <button class="hub-add-menu-close" type="button" @click="close()">x</button>
    </div>
    <div class="hub-add-menu-search" :class="{ 'hub-add-menu-search--overlay': isOverlay }">
      <input
        v-model="searchQuery"
        class="hub-add-menu-search-input"
        type="text"
        name="hub-sector-search"
        :placeholder="t('map.save_coord_search_placeholder')"
        @keydown.escape="close()"
      />
      <button v-if="searchQuery" class="hub-add-menu-search-clear" type="button" @click="searchQuery = ''">x</button>
    </div>

    <!-- Group lists -->
    <div class="hub-add-menu-groups" :class="{ 'hub-add-menu-groups--overlay': isOverlay }">
    <div class="hub-add-menu-group">
      <div class="hub-add-menu-group-title">{{ t('map.binding_save_sector_candidates') }}</div>
      <button
        v-for="sector in saveSectors"
        :key="sector.sectorMacro"
        type="button"
        class="hub-add-menu-item"
        :class="{
          active: isCurrentBoundSector(sector.sectorMacro),
          'draft-active': isDraftBoundSector(sector.sectorMacro),
          orange: isSectorOccupied(sector.sectorMacro)
        }"
        :disabled="isSectorOccupied(sector.sectorMacro)"
        @click="onSelect(sector.sectorMacro)"
      >
        <span class="sector-name">{{ sector.sectorName }}</span>
        <span v-if="sector.showRawSectorName" class="sector-raw-name">{{ sector.rawSectorName }}</span>
        <span v-if="!isOverlay" class="hub-add-menu-locate-btn" :title="t('map.binding_locate_sector')" @click.stop="onFocus(sector.sectorMacro)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.5"/>
            <line x1="6" y1="1" x2="6" y2="3"/><line x1="6" y1="9" x2="6" y2="11"/>
            <line x1="1" y1="6" x2="3" y2="6"/><line x1="9" y1="6" x2="11" y2="6"/>
          </svg>
        </span>
      </button>
      <div v-if="saveSectors.length === 0" class="hub-add-menu-empty">{{ t('map.binding_no_unbound_sectors') }}</div>
    </div>

    <!-- Search results: all map sectors -->
    <div v-if="normalizedQuery" class="hub-add-menu-group">
      <div class="hub-add-menu-group-title">{{ t('map.binding_search_results') }}</div>
      <button
        v-for="sector in filteredSearchAllSectors"
        :key="sector.sectorMacro"
        type="button"
        class="hub-add-menu-item"
        :class="{ orange: isSectorOccupied(sector.sectorMacro) }"
        :disabled="isSectorOccupied(sector.sectorMacro)"
        @click="onSelect(sector.sectorMacro)"
      >
        <span class="sector-name">{{ sector.sectorName }}</span>
        <span v-if="sector.showRawSectorName" class="sector-raw-name">{{ sector.rawSectorName }}</span>
        <span v-if="!isOverlay" class="hub-add-menu-locate-btn" :title="t('map.binding_locate_sector')" @click.stop="onFocus(sector.sectorMacro)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.5"/>
            <line x1="6" y1="1" x2="6" y2="3"/><line x1="6" y1="9" x2="6" y2="11"/>
            <line x1="1" y1="6" x2="3" y2="6"/><line x1="9" y1="6" x2="11" y2="6"/>
          </svg>
        </span>
      </button>
      <div v-if="filteredSearchAllSectors.length === 0" class="hub-add-menu-empty">{{ t('map.binding_no_visible_sectors') }}</div>
    </div>

    <!-- No search: visible map sectors -->
    <div v-else-if="!isOverlay && (visibleMapSectors.length > 0 || !normalizedQuery)" class="hub-add-menu-group">
      <div class="hub-add-menu-group-title">{{ t('map.binding_visible_sector_candidates') }}</div>
      <template v-if="visibleMapSectors.length > 0 && visibleMapSectors.length <= 10">
        <button
          v-for="sector in visibleMapSectors"
          :key="sector.sectorMacro"
          type="button"
          class="hub-add-menu-item"
          :class="{ orange: isSectorOccupied(sector.sectorMacro) }"
          :disabled="isSectorOccupied(sector.sectorMacro)"
          @click="onSelect(sector.sectorMacro)"
        >
        <span class="sector-name">{{ sector.sectorName }}</span>
        <span v-if="sector.showRawSectorName" class="sector-raw-name">{{ sector.rawSectorName }}</span>
        <span v-if="!isOverlay" class="hub-add-menu-locate-btn" :title="t('map.binding_locate_sector')" @click.stop="onFocus(sector.sectorMacro)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.5"/>
              <line x1="6" y1="1" x2="6" y2="3"/><line x1="6" y1="9" x2="6" y2="11"/>
              <line x1="1" y1="6" x2="3" y2="6"/><line x1="9" y1="6" x2="11" y2="6"/>
            </svg>
          </span>
        </button>
      </template>
      <div v-else-if="visibleMapSectors.length > 10" class="hub-add-menu-hint">
        {{ t('map.binding_filter_hint_zoom') }}
      </div>
      <div v-else class="hub-add-menu-empty">{{ t('map.binding_no_visible_sectors') }}</div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.hub-add-menu-backdrop {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm;
}

.hub-add-menu {
  @apply border border-amber-400/40 bg-slate-900/95 rounded-lg mb-3 overflow-hidden;
}

.hub-add-menu-search {
  @apply flex items-center gap-2 p-2 border-b border-amber-400/20;
}

.hub-add-menu-search-input {
  @apply flex-1 bg-transparent border-none outline-none text-sm text-amber-100 placeholder-amber-100/40;
}

.hub-add-menu-search-clear {
  @apply text-amber-100/60 hover:text-amber-100 text-sm px-1;
}

.hub-add-menu-group {
  @apply p-1;
}

.hub-add-menu-group + .hub-add-menu-group {
  @apply border-t border-amber-400/15;
}

.hub-add-menu-group-title {
  @apply px-2 py-1 text-[10px] font-bold uppercase text-amber-100/50;
}

.hub-add-menu-item {
  @apply flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-amber-100 hover:bg-amber-200/10 disabled:opacity-50 disabled:cursor-not-allowed;
}

.hub-add-menu-item:not(:disabled) {
  @apply cursor-pointer;
}

.hub-add-menu-item.active {
  @apply text-amber-200 bg-amber-200/10;
}

.hub-add-menu-item.draft-active {
  @apply text-sky-200 bg-sky-500/10;
}

.hub-add-menu-item.orange {
  @apply text-orange-400 bg-orange-500/10;
}

.sector-name {
  @apply flex-1 truncate text-left;
}

.sector-raw-name {
  @apply text-amber-100/40 text-xs;
}

.hub-add-menu-locate-btn {
  @apply text-amber-100/40 hover:text-amber-100/80 px-0.5 shrink-0;
}

.hub-add-menu-empty {
  @apply text-xs text-amber-100/30 text-center py-2;
}

.hub-add-menu-hint {
  @apply text-xs text-amber-100/40 text-center py-2;
}

/* Overlay mode */
.hub-add-menu--overlay {
  @apply w-96 max-h-[80vh] bg-slate-900 border border-slate-600/60 rounded-lg shadow-2xl flex flex-col overflow-hidden;
}

.hub-add-menu--overlay .hub-add-menu-group {
  @apply px-2;
}

.hub-add-menu-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-slate-700/50;
}

.hub-add-menu-title {
  @apply text-sm font-semibold text-slate-200;
}

.hub-add-menu-close {
  @apply text-slate-400 hover:text-slate-200 text-lg leading-none px-1;
}

.hub-add-menu-search--overlay {
  @apply px-4 pt-3 pb-2;
}

.hub-add-menu--overlay .hub-add-menu-search-input {
  @apply w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 text-base text-slate-200 outline-none placeholder:text-slate-500;
}

.hub-add-menu--overlay .hub-add-menu-search-clear {
  @apply text-slate-400 hover:text-slate-200;
}

.hub-add-menu--overlay .hub-add-menu-item {
  @apply py-2 text-sm text-slate-200 hover:bg-slate-700/30;
}

.hub-add-menu--overlay .hub-add-menu-group-title {
  @apply text-xs font-semibold text-slate-400 px-2 py-1;
}

.hub-add-menu--overlay .hub-add-menu-empty {
  @apply text-xs text-slate-500 px-4 py-2;
}

.hub-add-menu--overlay .hub-add-menu-hint {
  @apply text-xs text-slate-500;
}

.hub-add-menu--overlay .hub-add-menu-group {
  @apply px-2;
}

.hub-add-menu--overlay .hub-add-menu-locate-btn {
  @apply text-slate-500 hover:text-slate-300;
}

.hub-add-menu--overlay .sector-raw-name {
  @apply text-slate-500;
}

.hub-add-menu--overlay .hub-add-menu-group + .hub-add-menu-group {
  @apply border-t border-slate-700/50;
}

.hub-add-menu-groups--overlay {
  @apply overflow-y-auto flex flex-col;
}
</style>
