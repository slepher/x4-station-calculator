<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import regionYieldsData from '@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json'
import {
  buildDefaultResourceFilters,
  buildResourceCandidates,
  buildYieldRanksByWare,
  getSelectedResourceIds,
  getSharedMinYieldName,
  isSectorMatchedByResources,
  MIXED_YIELD_VALUE,
  type RegionYieldEntry,
  type SectorResourceEntry
} from '@/store/logic/mapResourceFilter'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
}

type ResourceEntry = RegionYieldEntry & { color?: string }

const props = defineProps<{
  sectorLayouts: SearchSectorLayout[]
  mode?: 'overlay' | 'sidebar'
}>()

const emit = defineEmits<{
  (e: 'highlight-change', sectorIds: string[]): void
  (e: 'select-sector', sectorId: string): void
  (e: 'active-change', active: boolean): void
  (e: 'primary-color-change', color: string | null): void
}>()

const { t, locale } = useI18n()
const gameDataStore = useGameDataStore()

const regionYields = regionYieldsData as ResourceEntry[]
const yieldRanksByWare = buildYieldRanksByWare(regionYields)
const resourceFilters = ref(buildDefaultResourceFilters(regionYields))
const RESOURCE_ORDER = ['ore', 'silicon', 'methane', 'hydrogen', 'helium', 'ice', 'rawscrap', 'nividium'] as const

const toRgba = (hex: string | undefined, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(251, 191, 36, ${alpha})`
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getReadableTextColor = (hex: string | undefined) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return '#111827'
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b)
  return luminance > 168 ? '#111827' : '#f8fafc'
}

const formatYieldLabel = (yieldName: string) => {
  const localized = t(`map.yield_names.${yieldName}`)
  if (localized !== `map.yield_names.${yieldName}`) return localized
  return yieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}

const resourceCatalog = computed(() =>
  RESOURCE_ORDER
    .map((wareId) => regionYields.find((entry) => entry.ware === wareId))
    .filter((entry): entry is ResourceEntry => Boolean(entry))
    .map((entry) => ({
      ware: entry.ware,
      color: entry.color || '#fbbf24',
      yields: entry.yields.map((item) => item.name)
    }))
)

const resourceMapById = computed<Record<string, SectorResourceEntry[]>>(() => {
  const out: Record<string, SectorResourceEntry[]> = {}
  const clusters = (mapsData as { clusters?: Record<string, any> }).clusters || {}
  Object.values(clusters).forEach((cluster) => {
    Object.values(cluster.sectors || {}).forEach((sector: any) => {
      out[sector.id] = Array.isArray(sector.resources) ? sector.resources : []
    })
  })
  return out
})

const sectorCandidates = computed(() =>
  props.sectorLayouts.map((layout) => ({
    sectorId: layout.sectorId,
    name: layout.name,
    displayName: layout.displayName,
    resources: resourceMapById.value[layout.sectorId] || []
  }))
)

const selectedResourceIds = computed(() => getSelectedResourceIds(resourceFilters.value))
const showBatchYieldControl = computed(() => selectedResourceIds.value.length >= 2)
const sharedMinYieldName = computed(() => getSharedMinYieldName(selectedResourceIds.value, resourceFilters.value))

const matchedSectorIds = computed(() => {
  if (!selectedResourceIds.value.length) return [] as string[]
  return sectorCandidates.value
    .filter((sector) => isSectorMatchedByResources(sector, resourceFilters.value, yieldRanksByWare))
    .map((sector) => sector.sectorId)
})

const resourceCandidates = computed(() =>
  buildResourceCandidates(sectorCandidates.value, resourceFilters.value, yieldRanksByWare, 10)
)

const batchYieldOptions = computed(() => {
  const firstSelected = selectedResourceIds.value[0]
  if (!firstSelected) return [] as string[]
  return resourceCatalog.value.find((entry) => entry.ware === firstSelected)?.yields || []
})

watchEffect(() => {
  emit('highlight-change', matchedSectorIds.value)
  emit('active-change', selectedResourceIds.value.length > 0)
  emit(
    'primary-color-change',
    resourceCatalog.value.find((entry) => entry.ware === selectedResourceIds.value[0])?.color || null
  )
})

const getResourceLabel = (wareId: string) => {
  const displayName = gameDataStore.getWareDisplayName(wareId)
  if (displayName) return displayName
  const fallback = t(`res.${wareId}`)
  return fallback !== `res.${wareId}` ? fallback : wareId
}

const getTagStyle = (wareId: string) => {
  const entry = resourceCatalog.value.find((item) => item.ware === wareId)
  const selected = resourceFilters.value[wareId]?.selected
  const color = entry?.color || '#fbbf24'
  return {
    borderColor: selected ? color : toRgba(color, 0.72),
    backgroundColor: selected ? color : 'transparent',
    color: selected ? getReadableTextColor(color) : '#f8fafc',
    boxShadow: 'none'
  }
}

const toggleResource = (wareId: string) => {
  const current = resourceFilters.value[wareId]
  if (!current) return
  resourceFilters.value = {
    ...resourceFilters.value,
    [wareId]: {
      ...current,
      selected: !current.selected
    }
  }
}

const updateResourceYield = (wareId: string, nextValue: string) => {
  const current = resourceFilters.value[wareId]
  if (!current) return
  resourceFilters.value = {
    ...resourceFilters.value,
    [wareId]: {
      ...current,
      minYieldName: nextValue
    }
  }
}

const updateAllSelectedYields = (nextValue: string) => {
  const nextFilters = { ...resourceFilters.value }
  selectedResourceIds.value.forEach((wareId) => {
    const current = nextFilters[wareId]
    if (!current) return
    nextFilters[wareId] = {
      ...current,
      minYieldName: nextValue
    }
  })
  resourceFilters.value = nextFilters
}

const clearSelectedResources = () => {
  const nextFilters = { ...resourceFilters.value }
  selectedResourceIds.value.forEach((wareId) => {
    const current = nextFilters[wareId]
    if (!current) return
    nextFilters[wareId] = {
      ...current,
      selected: false
    }
  })
  resourceFilters.value = nextFilters
}

const getSectorPrimaryLabel = (item: { name: string; displayName: string }) =>
  locale.value === 'en' ? item.name : item.displayName
</script>

<template>
  <div class="map-resource-panel" :class="props.mode || 'overlay'" @mousedown.stop>
    <div class="resource-panel-shell" :class="{ sidebar: props.mode === 'sidebar' }">
      <button
        v-if="selectedResourceIds.length > 0"
        type="button"
        class="resource-close-btn"
        data-testid="map-resource-clear-selection"
        @click="clearSelectedResources"
      >
        ×
      </button>

      <div class="resource-tag-grid" :class="{ compact: selectedResourceIds.length > 0 }">
        <button
          v-for="resource in resourceCatalog"
          :key="resource.ware"
          type="button"
          class="resource-tag"
          :class="{ selected: resourceFilters[resource.ware]?.selected }"
          :style="getTagStyle(resource.ware)"
          :data-testid="`map-resource-tag-${resource.ware}`"
          @click="toggleResource(resource.ware)"
        >
          {{ getResourceLabel(resource.ware) }}
        </button>
      </div>

      <div v-if="selectedResourceIds.length > 0" class="resource-config-list">
        <div v-if="showBatchYieldControl" class="resource-config-row all-row">
          <span class="config-label">{{ t('map.resource_filter_all') }}</span>
          <select
            class="yield-select"
            :value="sharedMinYieldName"
            data-testid="map-resource-yield-all"
            @change="updateAllSelectedYields(($event.target as HTMLSelectElement).value)"
          >
            <option v-if="sharedMinYieldName === MIXED_YIELD_VALUE" :value="MIXED_YIELD_VALUE" disabled>
              {{ t('map.resource_filter_mixed') }}
            </option>
            <option v-for="yieldName in batchYieldOptions" :key="yieldName" :value="yieldName">
              {{ formatYieldLabel(yieldName) }}
            </option>
          </select>
        </div>

        <div
          v-for="wareId in selectedResourceIds"
          :key="wareId"
          class="resource-config-row"
        >
          <span class="config-label">{{ getResourceLabel(wareId) }}</span>
          <select
            class="yield-select"
            :value="resourceFilters[wareId]?.minYieldName"
            :data-testid="`map-resource-yield-${wareId}`"
            @change="updateResourceYield(wareId, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="yieldName in resourceCatalog.find((entry) => entry.ware === wareId)?.yields || []"
              :key="yieldName"
              :value="yieldName"
            >
              {{ formatYieldLabel(yieldName) }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="selectedResourceIds.length > 0" class="resource-candidate-box">
        <div class="candidate-header">
          <span>{{ t('map.resource_filter_candidates') }}</span>
          <span class="candidate-count">{{ matchedSectorIds.length }}</span>
        </div>
        <div v-if="resourceCandidates.length > 0" class="candidate-list">
          <button
            v-for="candidate in resourceCandidates"
            :key="candidate.sectorId"
            type="button"
            class="candidate-item"
            :data-testid="`map-resource-candidate-${candidate.sectorId}`"
            @click="emit('select-sector', candidate.sectorId)"
          >
            <span class="candidate-name">{{ getSectorPrimaryLabel(candidate) }}</span>
            <span class="candidate-score">{{ candidate.score }}</span>
          </button>
        </div>
        <div v-else class="resource-empty">{{ t('map.resource_filter_no_match') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-resource-panel {
  width: 320px;
  max-width: calc(100% - 3rem);
}

.map-resource-panel.overlay {
  @apply absolute right-6 top-5 z-10;
}

.map-resource-panel.sidebar {
  @apply relative z-0 h-full;
  flex: 0 0 320px;
  max-width: 320px;
}

.resource-panel-shell {
  @apply relative rounded-lg border border-amber-300/35 bg-black/75 p-3 shadow-2xl;
  backdrop-filter: blur(8px);
}

.resource-panel-shell.sidebar {
  @apply flex h-full flex-col rounded-lg bg-black/60 shadow-none;
  backdrop-filter: blur(0px);
}

.resource-tag-grid {
  @apply flex flex-wrap gap-2;
}

.resource-tag-grid.compact {
  padding-right: 2.75rem;
}

.resource-close-btn {
  @apply absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/35 bg-black/55 text-lg leading-none text-amber-100/75 transition-colors duration-150 hover:text-amber-50 hover:border-amber-200/70;
}

.resource-tag {
  @apply rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors duration-150;
}

.resource-config-list {
  @apply mt-3 space-y-2 border-t border-amber-300/15 pt-3;
}

.resource-config-row {
  @apply flex items-center justify-between gap-3;
}

.config-label {
  @apply text-sm text-amber-50;
}

.yield-select {
  @apply rounded-md border border-amber-300/30 bg-black/70 px-2 py-1 text-sm text-amber-50 outline-none;
  min-width: 142px;
}

.resource-candidate-box {
  @apply mt-3 border-t border-amber-300/15 pt-3;
}

.resource-panel-shell.sidebar .resource-candidate-box {
  @apply flex min-h-0 flex-1 flex-col;
}

.candidate-header {
  @apply mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-amber-200/80;
}

.candidate-count {
  @apply rounded border border-amber-300/20 px-1.5 py-0.5 text-[11px] text-amber-100;
}

.candidate-list {
  @apply max-h-64 overflow-y-auto rounded-md border border-amber-300/20 bg-black/40;
}

.resource-panel-shell.sidebar .candidate-list {
  @apply max-h-none min-h-0 flex-1;
}

.candidate-item {
  @apply flex w-full items-center justify-between gap-3 border-b border-amber-300/10 px-3 py-2 text-left hover:bg-amber-300/10;
}

.candidate-name {
  @apply truncate text-sm text-amber-50;
}

.candidate-score {
  @apply shrink-0 text-xs font-semibold text-amber-200;
}

.resource-empty {
  @apply rounded-md border border-amber-300/20 bg-black/40 px-3 py-4 text-center text-xs text-amber-100/55;
}

.resource-panel-shell.sidebar .resource-empty {
  @apply flex min-h-0 flex-1 items-center justify-center;
}
</style>
