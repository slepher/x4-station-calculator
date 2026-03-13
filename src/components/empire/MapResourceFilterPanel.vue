<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import regionYieldsData from '@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json'
import {
  buildDefaultResourceFilters,
  buildYieldRanksByWare,
  getContextReachableMaxYieldName,
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
type FilterSectorCandidate = {
  sectorId: string
  name: string
  displayName: string
  resources: SectorResourceEntry[]
  sunlight: number
}
type ResourceCatalogItem = {
  ware: string
  color: string
  yields: string[]
  kind: 'ware' | 'sunlight'
}

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
const SUNLIGHT_FILTER_ID = 'sunlight'
const SUNLIGHT_COLOR = '#F7D24B'
const sunlightFilterEnabled = ref(false)
const sunlightMinimum = ref(100)

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

const resourceCatalog = computed<ResourceCatalogItem[]>(() => [
  ...RESOURCE_ORDER
    .map((wareId) => regionYields.find((entry) => entry.ware === wareId))
    .filter((entry): entry is ResourceEntry => Boolean(entry))
    .map((entry) => ({
      ware: entry.ware,
      color: entry.color || '#fbbf24',
      yields: entry.yields.map((item) => item.name),
      kind: 'ware' as const
    })),
  {
    ware: SUNLIGHT_FILTER_ID,
    color: SUNLIGHT_COLOR,
    yields: [],
    kind: 'sunlight' as const
  }
])

const sectorDataById = computed<Record<string, { resources: SectorResourceEntry[]; sunlight: number }>>(() => {
  const out: Record<string, { resources: SectorResourceEntry[]; sunlight: number }> = {}
  const clusters = (mapsData as { clusters?: Record<string, any> }).clusters || {}
  Object.values(clusters).forEach((cluster) => {
    Object.values(cluster.sectors || {}).forEach((sector: any) => {
      out[sector.id] = {
        resources: Array.isArray(sector.resources) ? sector.resources : [],
        sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100)
      }
    })
  })
  return out
})

const sectorCandidates = computed<FilterSectorCandidate[]>(() =>
  props.sectorLayouts.map((layout) => ({
    sectorId: layout.sectorId,
    name: layout.name,
    displayName: layout.displayName,
    resources: sectorDataById.value[layout.sectorId]?.resources || [],
    sunlight: sectorDataById.value[layout.sectorId]?.sunlight || 0
  }))
)

const selectedWareIds = computed(() => getSelectedResourceIds(resourceFilters.value))
const selectedFilterIds = computed(() =>
  sunlightFilterEnabled.value ? [...selectedWareIds.value, SUNLIGHT_FILTER_ID] : [...selectedWareIds.value]
)
const showBatchYieldControl = computed(() => selectedWareIds.value.length >= 2)
const sharedMinYieldName = computed(() => getSharedMinYieldName(selectedWareIds.value, resourceFilters.value))
const reachableMaxByWare = computed<Record<string, string | null>>(() =>
  selectedWareIds.value.reduce<Record<string, string | null>>((acc, wareId) => {
    const sectorsWithinSunlight = sunlightFilterEnabled.value
      ? sectorCandidates.value.filter((sector) => sector.sunlight >= sunlightMinimum.value)
      : sectorCandidates.value
    acc[wareId] = getContextReachableMaxYieldName(wareId, sectorsWithinSunlight, resourceFilters.value, yieldRanksByWare)
    return acc
  }, {})
)

const filteredSectorCandidates = computed(() => {
  if (!selectedFilterIds.value.length) return [] as FilterSectorCandidate[]
  return sectorCandidates.value
    .filter((sector) => {
      if (sunlightFilterEnabled.value && sector.sunlight < sunlightMinimum.value) return false
      if (!selectedWareIds.value.length) return true
      return isSectorMatchedByResources(sector, resourceFilters.value, yieldRanksByWare)
    })
})

const matchedSectorIds = computed(() => filteredSectorCandidates.value.map((sector) => sector.sectorId))

const resourceCandidates = computed(() =>
  filteredSectorCandidates.value
    .map((sector) => ({
      sectorId: sector.sectorId,
      name: sector.name,
      displayName: sector.displayName,
      score: selectedWareIds.value.length
        ? selectedWareIds.value.reduce((sum, ware) => {
            const resource = sector.resources.find((item) => item.ware === ware)
            return sum + (resource?.level || 0)
          }, 0)
        : sector.sunlight
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.displayName.localeCompare(right.displayName) ||
      left.sectorId.localeCompare(right.sectorId)
    )
    .slice(0, 10)
)

const batchYieldOptions = computed(() => {
  const firstSelected = selectedWareIds.value[0]
  if (!firstSelected) return [] as string[]
  return resourceCatalog.value.find((entry) => entry.ware === firstSelected)?.yields || []
})

watchEffect(() => {
  emit('highlight-change', matchedSectorIds.value)
  emit('active-change', selectedFilterIds.value.length > 0)
  emit(
    'primary-color-change',
    resourceCatalog.value.find((entry) => entry.ware === selectedFilterIds.value[0])?.color || null
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
  const selected = wareId === SUNLIGHT_FILTER_ID ? sunlightFilterEnabled.value : resourceFilters.value[wareId]?.selected
  const color = entry?.color || '#fbbf24'
  return {
    borderColor: selected ? color : toRgba(color, 0.72),
    backgroundColor: selected ? color : 'transparent',
    color: selected ? getReadableTextColor(color) : '#f8fafc',
    boxShadow: 'none'
  }
}

const toggleResource = (wareId: string) => {
  if (wareId === SUNLIGHT_FILTER_ID) {
    sunlightFilterEnabled.value = !sunlightFilterEnabled.value
    if (sunlightFilterEnabled.value && !sunlightMinimum.value) sunlightMinimum.value = 100
    return
  }
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
  selectedWareIds.value.forEach((wareId) => {
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
  selectedWareIds.value.forEach((wareId) => {
    const current = nextFilters[wareId]
    if (!current) return
    nextFilters[wareId] = {
      ...current,
      selected: false
    }
  })
  resourceFilters.value = nextFilters
  sunlightFilterEnabled.value = false
}

const updateSunlightMinimum = (nextValue: number) => {
  sunlightMinimum.value = Math.max(0, Math.round(nextValue))
}

const stepSunlightMinimum = (delta: number) => {
  updateSunlightMinimum(sunlightMinimum.value + delta)
}

const getSectorPrimaryLabel = (item: { name: string; displayName: string }) =>
  locale.value === 'en' ? item.name : item.displayName

const isYieldOptionDisabled = (wareId: string, yieldName: string) => {
  const reachableName = reachableMaxByWare.value[wareId]
  if (!reachableName) return yieldName !== resourceFilters.value[wareId]?.minYieldName
  const rankMap = yieldRanksByWare[wareId]
  const targetRank = rankMap?.[yieldName]
  const reachableRank = rankMap?.[reachableName]
  const currentValue = resourceFilters.value[wareId]?.minYieldName
  if (yieldName === currentValue) return false
  if (targetRank === undefined || reachableRank === undefined) return false
  return targetRank > reachableRank
}

const isYieldBeyondReachable = (wareId: string) => {
  const reachableName = reachableMaxByWare.value[wareId]
  const currentValue = resourceFilters.value[wareId]?.minYieldName
  if (!reachableName || !currentValue) return false
  const rankMap = yieldRanksByWare[wareId]
  const currentRank = rankMap?.[currentValue]
  const reachableRank = rankMap?.[reachableName]
  if (currentRank === undefined || reachableRank === undefined) return false
  return currentRank > reachableRank
}
</script>

<template>
  <div class="map-resource-panel" :class="props.mode || 'overlay'" @mousedown.stop>
    <div class="resource-panel-shell" :class="{ sidebar: props.mode === 'sidebar' }">
      <button
        v-if="selectedFilterIds.length > 0"
        type="button"
        class="resource-close-btn"
        data-testid="map-resource-clear-selection"
        @click="clearSelectedResources"
      >
        ×
      </button>

      <div class="resource-tag-grid" :class="{ compact: selectedFilterIds.length > 0 }">
        <button
          v-for="resource in resourceCatalog"
          :key="resource.ware"
          type="button"
          class="resource-tag"
          :class="{ selected: resource.ware === SUNLIGHT_FILTER_ID ? sunlightFilterEnabled : resourceFilters[resource.ware]?.selected }"
          :style="getTagStyle(resource.ware)"
          :data-testid="`map-resource-tag-${resource.ware}`"
          @click="toggleResource(resource.ware)"
        >
          {{ resource.ware === SUNLIGHT_FILTER_ID ? t('map.resource_filter_sunlight') : getResourceLabel(resource.ware) }}
        </button>
      </div>

      <div v-if="selectedFilterIds.length > 0" class="resource-config-list">
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
          v-for="wareId in selectedWareIds"
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
              :disabled="isYieldOptionDisabled(wareId, yieldName)"
            >
              {{ formatYieldLabel(yieldName) }}
            </option>
          </select>
          <span v-if="isYieldBeyondReachable(wareId)" class="config-warning">
            {{ t('map.resource_filter_exceeds_reachable') }}
          </span>
        </div>

        <div v-if="sunlightFilterEnabled" class="resource-config-row">
          <span class="config-label">{{ t('map.resource_filter_sunlight') }}</span>
          <div class="sunlight-input-wrap">
            <input
              class="sunlight-input"
              type="number"
              min="0"
              step="1"
              :value="sunlightMinimum"
              data-testid="map-resource-sunlight-input"
              @input="updateSunlightMinimum(Number(($event.target as HTMLInputElement).value || 0))"
            />
            <span class="sunlight-suffix">{{ t('map.resource_filter_sunlight_suffix') }}</span>
            <div class="sunlight-stepper">
              <button
                type="button"
                class="sunlight-step-btn"
                data-testid="map-resource-sunlight-increase"
                @click="stepSunlightMinimum(1)"
              >
                ▲
              </button>
              <button
                type="button"
                class="sunlight-step-btn"
                data-testid="map-resource-sunlight-decrease"
                @click="stepSunlightMinimum(-1)"
              >
                ▼
              </button>
            </div>
          </div>
          <span />
        </div>
      </div>

      <div v-if="selectedFilterIds.length > 0" class="resource-candidate-box">
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
  @apply grid items-center gap-3;
  grid-template-columns: minmax(0, 72px) minmax(0, 142px) minmax(0, 1fr);
  min-width: 0;
}

.config-label {
  @apply truncate text-sm text-amber-50;
}

.config-warning {
  @apply min-w-0 truncate text-[11px] text-rose-300;
}

.yield-select {
  @apply rounded-md border border-amber-300/30 bg-black/70 px-3 py-1 text-sm text-amber-50 outline-none;
  min-width: 142px;
}

.sunlight-input {
  @apply w-full rounded-md border border-amber-300/30 bg-black/70 px-3 py-1 text-sm text-amber-50 outline-none;
  min-width: 142px;
  text-indent: 0.18rem;
  padding-right: 3.25rem;
  appearance: textfield;
}

.sunlight-input-wrap {
  @apply relative;
  width: 142px;
}

.sunlight-suffix {
  @apply pointer-events-none absolute right-[1.35rem] top-1/2 -translate-y-1/2 text-sm font-semibold text-amber-100/90;
}

.sunlight-input::-webkit-outer-spin-button,
.sunlight-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sunlight-stepper {
  @apply absolute right-0 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-md rounded-l-sm border border-amber-300/25 bg-black/80;
}

.sunlight-step-btn {
  @apply flex h-3.5 w-4 items-center justify-center bg-amber-200/10 text-[9px] leading-none text-amber-100/85 transition-colors duration-150 hover:bg-amber-200/20 hover:text-amber-50;
}

.sunlight-step-btn + .sunlight-step-btn {
  @apply border-t border-amber-300/20;
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
