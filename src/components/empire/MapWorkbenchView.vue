<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MapSvgCanvas from './MapSvgCanvas.vue'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
}
type SearchResultItem = SearchSectorLayout & {
  matchType: 'name' | 'localeName' | 'id'
}

const clusterRefHeightPx = ref(142)
const MAX_SCALE_MULTIPLIER = 2

const viewportRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

const minScale = ref(1)
const maxScale = ref(4)
const scale = ref(0)
const zoomPercent = ref(0)

const panX = ref(0)
const panY = ref(0)

const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOriginX = ref(0)
const dragOriginY = ref(0)

const searchQuery = ref('')
const isSearchFocused = ref(false)
const selectedSearchSectorId = ref<string | null>(null)
const searchSectors = ref<SearchSectorLayout[]>([])

const { t, locale } = useI18n()

const displayScaleText = computed(() => `${Math.round(scale.value * 100)}%`)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())

const getViewportSize = () => {
  const viewport = viewportRef.value
  if (!viewport) return { width: 0, height: 0 }
  return {
    width: viewport.clientWidth,
    height: viewport.clientHeight
  }
}

const clampScale = (next: number) => Math.min(maxScale.value, Math.max(minScale.value, next))

const clampPan = (nextX: number, nextY: number) => {
  const { width: vw, height: vh } = getViewportSize()
  const scaledW = imageNaturalWidth.value * scale.value
  const scaledH = imageNaturalHeight.value * scale.value

  let x = nextX
  let y = nextY

  if (scaledW <= vw) {
    x = (vw - scaledW) / 2
  } else {
    const minX = vw - scaledW
    x = Math.min(0, Math.max(minX, x))
  }

  if (scaledH <= vh) {
    y = (vh - scaledH) / 2
  } else {
    const minY = vh - scaledH
    y = Math.min(0, Math.max(minY, y))
  }

  panX.value = x
  panY.value = y
}

const applyScaleFromSlider = (value: number) => {
  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const ratio = value / 100
  const nextScale = minScale.value + (maxScale.value - minScale.value) * ratio
  const safeScale = clampScale(nextScale)

  const centerContentX = (vw * 0.5 - panX.value) / scale.value
  const centerContentY = (vh * 0.5 - panY.value) / scale.value
  scale.value = safeScale
  const nextPanX = vw * 0.5 - centerContentX * safeScale
  const nextPanY = vh * 0.5 - centerContentY * safeScale
  clampPan(nextPanX, nextPanY)
}

const syncSliderFromScale = () => {
  if (maxScale.value <= minScale.value) {
    zoomPercent.value = 0
    return
  }
  zoomPercent.value = ((scale.value - minScale.value) / (maxScale.value - minScale.value)) * 100
}

const recomputeScaleBounds = () => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  const { width: vw } = getViewportSize()
  if (!vw) return

  const fitByWidth = vw / imageNaturalWidth.value
  const nextMin = fitByWidth
  const targetHalfScreen = window.innerHeight * 0.5
  const refHeight = Math.max(1, clusterRefHeightPx.value)
  const nextMax = Math.max(nextMin, targetHalfScreen / refHeight) * MAX_SCALE_MULTIPLIER

  minScale.value = nextMin
  maxScale.value = nextMax
  scale.value = clampScale(scale.value || nextMin)
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onCanvasSize = async (payload: { width: number; height: number; clusterRefHeight: number }) => {
  imageNaturalWidth.value = payload.width
  imageNaturalHeight.value = payload.height
  clusterRefHeightPx.value = payload.clusterRefHeight
  await nextTick()
  recomputeScaleBounds()
  if (scale.value < minScale.value + 1e-6) {
    scale.value = minScale.value
  }
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onSectorLayout = (payload: SearchSectorLayout[]) => {
  searchSectors.value = payload
}

const parseClusterQuery = (query: string) => {
  const match = query.match(/^cluster[\s_-]*([0-9]+)$/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

const extractClusterNumber = (clusterId: string) => {
  const match = clusterId.match(/^cluster_([0-9]+)(?:_|$)/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

const searchResults = computed<SearchResultItem[]>(() => {
  const query = normalizedSearchQuery.value
  if (!query) return []

  const clusterNumber = parseClusterQuery(query)
  if (clusterNumber) {
    return searchSectors.value
      .filter((item) => extractClusterNumber(item.clusterId) === clusterNumber)
      .map((item) => ({ ...item, matchType: 'id' as const }))
  }

  return searchSectors.value.flatMap((item) => {
    const rawName = item.name.toLowerCase()
    const displayName = item.displayName.toLowerCase()
    const matched: SearchResultItem[] = []
    if (rawName.includes(query)) {
      matched.push({ ...item, matchType: 'name' })
      return matched
    }
    if (locale.value !== 'en' && displayName.includes(query)) {
      matched.push({ ...item, matchType: 'localeName' })
    }
    return matched
  })
})

const highlightedSectorIds = computed(() => {
  if (!normalizedSearchQuery.value) return [] as string[]
  if (searchResults.value.length >= 10) return [] as string[]
  return searchResults.value.map((item) => item.sectorId)
})
const shouldShowSearchPopover = computed(() => isSearchFocused.value && normalizedSearchQuery.value.length > 0)
const hasIdMatchedResult = computed(() => searchResults.value.some((item) => item.matchType === 'id'))
const getResultPrimaryLabel = (item: SearchResultItem | SearchSectorLayout) => (
  locale.value === 'en' ? item.name : item.displayName
)
const getResultMeta = (item: SearchResultItem) => {
  if (item.matchType === 'id') return item.sectorId
  if (item.matchType === 'name' && locale.value !== 'en') return item.name
  return ''
}

const focusSector = (sectorId: string) => {
  const target = searchSectors.value.find((item) => item.sectorId === sectorId)
  if (!target) return
  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const targetScale = scale.value < 1 ? clampScale(1) : scale.value
  scale.value = targetScale
  syncSliderFromScale()
  clampPan(vw * 0.5 - target.centerX * targetScale, vh * 0.5 - target.centerY * targetScale)
}

const onSliderInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  zoomPercent.value = value
  applyScaleFromSlider(value)
}

const onSearchInput = (event: Event) => {
  searchQuery.value = (event.target as HTMLInputElement).value
  selectedSearchSectorId.value = null
}

const onSearchFocus = () => {
  isSearchFocused.value = true
}

const onSearchBlur = () => {
  window.setTimeout(() => {
    isSearchFocused.value = false
  }, 100)
}

const onClearSearch = () => {
  searchQuery.value = ''
  selectedSearchSectorId.value = null
  searchInputRef.value?.focus()
}

const selectSearchResult = (item: SearchSectorLayout) => {
  selectedSearchSectorId.value = item.sectorId
  isSearchFocused.value = false
  searchInputRef.value?.blur()
  focusSector(item.sectorId)
}

const onMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragOriginX.value = panX.value
  dragOriginY.value = panY.value
}

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  clampPan(dragOriginX.value + dx, dragOriginY.value + dy)
}

const onWheel = (event: WheelEvent) => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  event.preventDefault()

  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const contentX = (mouseX - panX.value) / scale.value
  const contentY = (mouseY - panY.value) / scale.value

  const zoomStep = 0.08
  const factor = event.deltaY < 0 ? (1 + zoomStep) : (1 - zoomStep)
  const nextScale = clampScale(scale.value * factor)
  if (nextScale === scale.value) return

  scale.value = nextScale
  const nextPanX = mouseX - contentX * nextScale
  const nextPanY = mouseY - contentY * nextScale
  clampPan(nextPanX, nextPanY)
  syncSliderFromScale()
}

const stopDrag = () => {
  isDragging.value = false
}

const onResize = () => {
  recomputeScaleBounds()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <section class="map-workbench">
    <div class="map-shell">
      <div
        ref="viewportRef"
        class="map-viewport"
        :class="{ dragging: isDragging }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="stopDrag"
        @mouseleave="stopDrag"
        @wheel="onWheel"
      >
        <div
          class="map-content"
          :style="{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transformOrigin: 'top left'
          }"
        >
          <MapSvgCanvas
            :highlighted-sector-ids="highlightedSectorIds"
            :selected-sector-id="selectedSearchSectorId"
            @content-size="onCanvasSize"
            @sector-layout="onSectorLayout"
          />
        </div>
      </div>

      <div class="map-search-panel" @mousedown.stop>
        <div class="search-box group" :class="{ focused: isSearchFocused }">
          <span class="search-icon">🔍</span>
          <input
            ref="searchInputRef"
            :value="searchQuery"
            class="search-input"
            data-testid="map-sector-search-input"
            :placeholder="t('map.search_sector_placeholder')"
            @input="onSearchInput"
            @focus="onSearchFocus"
            @blur="onSearchBlur"
          />
          <button
            v-show="searchQuery"
            class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            type="button"
            @mousedown.prevent="onClearSearch"
          >
            ×
          </button>
        </div>

        <Transition name="fade-slide-down">
          <div
            v-if="shouldShowSearchPopover"
            class="map-search-popover scrollbar-thin"
            :class="{ 'map-search-popover-wide': hasIdMatchedResult }"
            data-testid="map-sector-search-popover"
            @mousedown.prevent
          >
            <template v-if="searchResults.length > 0">
              <button
                v-for="item in searchResults"
                :key="item.sectorId"
                type="button"
                class="result-item"
                :data-testid="`map-sector-search-result-${item.sectorId}`"
                @click="selectSearchResult(item)"
              >
                <span class="result-label">{{ getResultPrimaryLabel(item) }}</span>
                <span v-if="getResultMeta(item)" class="result-meta">{{ getResultMeta(item) }}</span>
              </button>
            </template>
            <div v-else class="no-results">{{ t('map.no_search_results') }}</div>
          </div>
        </Transition>
      </div>

      <div class="zoom-panel">
        <div class="zoom-label-row">
          <span class="zoom-label">Scale</span>
          <span class="zoom-value">{{ displayScaleText }}</span>
        </div>
        <input
          class="zoom-slider"
          type="range"
          min="0"
          max="100"
          step="0.5"
          :value="zoomPercent"
          @input="onSliderInput"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-workbench {
  @apply w-full;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.map-shell {
  @apply relative bg-black/70 rounded-lg border border-amber-300/35 p-3 overflow-hidden;
  height: 100%;
}

.map-viewport {
  @apply relative w-full overflow-hidden cursor-grab;
  height: 100%;
  min-height: 0;
}

.map-viewport.dragging {
  @apply cursor-grabbing;
}

.map-content {
  @apply select-none;
  will-change: transform;
}

.map-search-panel {
  @apply absolute left-6 top-5 z-10;
  width: 220px;
}

.search-box {
  @apply flex items-center h-10 w-full bg-black/75 border border-amber-300/40 rounded px-2 shadow-xl;
  backdrop-filter: blur(4px);
}

.search-box.focused {
  @apply border-amber-200/80 ring-1 ring-amber-300/30;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none text-amber-50 text-sm;
}

.search-input::placeholder {
  @apply text-amber-100/45;
}

.search-icon {
  @apply mr-2 text-amber-200/70;
}

.clear-btn {
  @apply text-amber-100/60 hover:text-amber-50 px-1 cursor-pointer;
}

.map-search-popover {
  @apply mt-2 max-h-80 overflow-y-auto rounded-md border border-amber-300/35 bg-black/85 shadow-2xl;
  backdrop-filter: blur(8px);
  width: 100%;
}

.map-search-popover-wide {
  width: 320px;
}

.result-item {
  @apply flex w-full items-start justify-between gap-3 border-b border-amber-300/10 px-3 py-2 text-left hover:bg-amber-300/10;
}

.result-label {
  @apply truncate text-sm text-amber-50;
}

.result-meta {
  @apply shrink-0 text-[11px] text-amber-100/55;
}

.no-results {
  @apply px-3 py-4 text-center text-xs text-amber-100/55;
}

.zoom-panel {
  @apply absolute left-6 bottom-5 z-10 rounded-md border border-amber-300/40 bg-black/70 px-3 py-2;
  width: 220px;
  backdrop-filter: blur(4px);
}

.zoom-label-row {
  @apply mb-1 flex items-center justify-between text-xs text-amber-200;
}

.zoom-label {
  @apply uppercase tracking-wider;
}

.zoom-value {
  @apply font-semibold text-amber-100;
}

.zoom-slider {
  @apply w-full accent-amber-400;
}

.fade-slide-down-enter-active,
.fade-slide-down-leave-active {
  @apply transition-all duration-100;
}

.fade-slide-down-enter-from,
.fade-slide-down-leave-to {
  @apply opacity-0 -translate-y-1;
}
</style>
