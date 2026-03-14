<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import {
  buildFixedYieldEntries,
  buildDefaultResourceFilters,
  buildSectorResourceFill,
  buildYieldRanksByWare,
  getContextReachableMaxYieldName,
  getSelectedResourceIds,
  getSharedMinYieldName,
  isSectorMatchedByResources,
  MIXED_YIELD_VALUE,
  type SectorResourceEntry,
  type SectorResourceFill
} from '@/store/logic/mapResourceFilter'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
}

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
type ResourceVisualChangePayload = {
  highlightedSectorIds: string[]
  sectorFills: Record<string, SectorResourceFill>
}

const props = defineProps<{
  sectorLayouts: SearchSectorLayout[]
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'highlight-change', sectorIds: string[]): void
  (e: 'select-sector', sectorId: string): void
  (e: 'active-change', active: boolean): void
  (e: 'primary-color-change', color: string | null): void
  (e: 'resource-visual-change', payload: ResourceVisualChangePayload): void
}>()

const { t, locale } = useI18n()
const gameData = useGameDataStore()

const RESOURCE_ORDER = ['ore', 'silicon', 'methane', 'hydrogen', 'helium', 'ice', 'rawscrap', 'nividium'] as const
const regionYields = computed(() => buildFixedYieldEntries([...RESOURCE_ORDER]))
const regionYieldColors = computed<Record<string, string>>(() =>
  Object.fromEntries(((gameData.regionyields || []) as Array<{ ware: string; color?: string }>).map((entry) => [entry.ware, entry.color || '#fbbf24']))
)
const yieldRanksByWare = computed(() => buildYieldRanksByWare(regionYields.value))
const resourceFilters = ref(buildDefaultResourceFilters([]))
const SUNLIGHT_FILTER_ID = 'sunlight'
const SUNLIGHT_COLOR = '#F7D24B'
const DEFAULT_CANDIDATE_WARE_IDS = ['ore', 'silicon', 'methane', 'hydrogen', 'helium'] as const
const sunlightFilterEnabled = ref(false)
const sunlightMinimum = ref(100)

// Initialize resourceFilters when regionYields becomes available
watchEffect(() => {
  if (regionYields.value.length > 0 && Object.keys(resourceFilters.value).length === 0) {
    resourceFilters.value = buildDefaultResourceFilters(regionYields.value)
  }
})

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
  ...regionYields.value
    .map((entry) => ({
      ware: entry.ware,
      color: regionYieldColors.value[entry.ware] || '#fbbf24',
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
  const clusters = gameData.maps?.clusters || {}
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
    acc[wareId] = getContextReachableMaxYieldName(wareId, sectorsWithinSunlight, resourceFilters.value, yieldRanksByWare.value)
    return acc
  }, {})
)

const filteredSectorCandidates = computed(() => {
  if (!selectedFilterIds.value.length) return [] as FilterSectorCandidate[]
  return sectorCandidates.value.filter((sector) => {
    if (sunlightFilterEnabled.value && sector.sunlight < sunlightMinimum.value) return false
    if (!selectedWareIds.value.length) return true
    return isSectorMatchedByResources(sector, resourceFilters.value, yieldRanksByWare.value)
  })
})

const matchedSectorIds = computed(() => filteredSectorCandidates.value.map((sector) => sector.sectorId))
const candidateBaseSectors = computed(() =>
  selectedFilterIds.value.length > 0 ? filteredSectorCandidates.value : sectorCandidates.value
)
const candidateCount = computed(() => candidateBaseSectors.value.length)

const resourceCandidates = computed(() =>
  candidateBaseSectors.value
    .map((sector) => ({
      sectorId: sector.sectorId,
      name: sector.name,
      displayName: sector.displayName,
      score: selectedWareIds.value.length
        ? selectedWareIds.value.reduce((sum, ware) => {
            const resource = sector.resources.find((item) => item.ware === ware)
            return sum + (resource?.level || 0)
          }, 0)
        : sunlightFilterEnabled.value
          ? sector.sunlight
          : DEFAULT_CANDIDATE_WARE_IDS.reduce((sum, ware) => {
              const resource = sector.resources.find((item) => item.ware === ware)
              return sum + (resource?.level || 0)
            }, 0)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.displayName.localeCompare(right.displayName) ||
      left.sectorId.localeCompare(right.sectorId)
    )
    .slice(0, 10)
)

const resourceColors = computed<Record<string, string>>(() =>
  resourceCatalog.value.reduce<Record<string, string>>((acc, item) => {
    acc[item.ware] = item.color
    return acc
  }, {})
)

const resourceSectorFills = computed<Record<string, SectorResourceFill>>(() => {
  if (!selectedFilterIds.value.length) return {}
  return filteredSectorCandidates.value.reduce<Record<string, SectorResourceFill>>((acc, sector) => {
    const fill = buildSectorResourceFill({
      sector,
      selectedWareIds: selectedWareIds.value,
      sunlightFilterEnabled: sunlightFilterEnabled.value,
      resourceColors: resourceColors.value
    })
    if (fill) acc[sector.sectorId] = fill
    return acc
  }, {})
})

const batchYieldOptions = computed(() => {
  const firstSelected = selectedWareIds.value[0]
  if (!firstSelected) return [] as string[]
  return resourceCatalog.value.find((entry) => entry.ware === firstSelected)?.yields || []
})

watchEffect(() => {
  if (!props.active) return
  emit('highlight-change', matchedSectorIds.value)
  emit('active-change', selectedFilterIds.value.length > 0)
  emit('resource-visual-change', {
    highlightedSectorIds: matchedSectorIds.value,
    sectorFills: resourceSectorFills.value
  })
  emit(
    'primary-color-change',
    resourceCatalog.value.find((entry) => entry.ware === selectedFilterIds.value[0])?.color || null
  )
})

const getResourceLabel = (wareId: string) => {
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
  const rankMap = yieldRanksByWare.value[wareId]
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
  const rankMap = yieldRanksByWare.value[wareId]
  const currentRank = rankMap?.[currentValue]
  const reachableRank = rankMap?.[reachableName]
  if (currentRank === undefined || reachableRank === undefined) return false
  return currentRank > reachableRank
}
</script>

<template>
  <div class="simple-panel">
    <div class="resource-tag-grid">
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
        {{ resource.ware === SUNLIGHT_FILTER_ID ? t('res.energycells') : getResourceLabel(resource.ware) }}
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

      <div v-for="wareId in selectedWareIds" :key="wareId" class="resource-config-row">
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

    <div class="resource-candidate-box">
      <div class="candidate-header">
        <span>{{ t('map.resource_filter_candidates') }}</span>
        <span class="candidate-count">{{ candidateCount }}</span>
      </div>
      <div v-if="resourceCandidates.length > 0" class="candidate-list custom-scrollbar" data-testid="map-resource-simple-candidate-list">
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
</template>
