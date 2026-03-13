<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MapSvgCanvas from './MapSvgCanvas.vue'
import MapSectorTooltip from './MapSectorTooltip.vue'
import MapResourceFilterPanel from './MapResourceFilterPanel.vue'
import regionYieldsData from '@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json'
import factionsData from '@/assets/x4_game_data/8.0-Diplomacy/data/factions.json'
import { useGameDataStore } from '@/store/useGameDataStore'

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
type SectorHoverPayload = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  resources: Array<{
    ware: string
    yield?: string
    level?: number
  }>
  anchorRect: {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }
}
type TooltipResourceItem = {
  wareId: string
  label: string
  yieldLabel: string
  color: string
}
type TooltipPlacement = 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type TooltipViewModel = {
  sectorId: string
  title: string
  ownerName: string
  sunlightPercent: number
  resources: TooltipResourceItem[]
  anchorRect: SectorHoverPayload['anchorRect']
}

const clusterRefHeightPx = ref(142)
const MAX_SCALE_MULTIPLIER = 2
const TOOLTIP_OFFSET = 14
const TOOLTIP_VIEWPORT_PADDING = 12
const RESOURCE_ORDER = ['ore', 'silicon', 'ice', 'hydrogen', 'helium', 'methane', 'nividium', 'rawscrap'] as const

const viewportRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const tooltipRef = ref<InstanceType<typeof MapSectorTooltip> | null>(null)
const viewportResizeObserver = ref<ResizeObserver | null>(null)

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
const selectedSectorId = ref<string | null>(null)
const selectedSectorSource = ref<'search' | 'resource' | null>(null)
const searchSectors = ref<SearchSectorLayout[]>([])
const resourceHighlightedSectorIds = ref<string[]>([])
const isResourcePanelOpen = ref(false)
const resourcePrimaryColor = ref<string | null>(null)
const hoveredSectorSource = ref<SectorHoverPayload | null>(null)
const lastHoveredSectorSource = ref<SectorHoverPayload | null>(null)
const hoveredSector = ref<TooltipViewModel | null>(null)
const isTooltipHovered = ref(false)
const tooltipPlacement = ref<TooltipPlacement>('bottom')
const tooltipPosition = ref({ left: 0, top: 0 })
const tooltipMeasuredSize = ref({ width: 0, height: 0 })
const tooltipHideTimer = ref<number | null>(null)
const zoomRestoreTimer = ref<number | null>(null)
const lastMousePos = ref({ x: 0, y: 0 })

const { t, te, locale } = useI18n()
const gameDataStore = useGameDataStore()
const factionsById = Object.fromEntries(
  (factionsData as Array<{ id: string; nameId: string }>).map((entry) => [entry.id, entry])
) as Record<string, { id: string; nameId: string }>
const resourceColorByWare = Object.fromEntries(
  (regionYieldsData as Array<{ ware: string; color?: string }>).map((entry) => [entry.ware, entry.color || '#fbbf24'])
) as Record<string, string>

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

const searchHighlightedSectorIds = computed(() => {
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

const clearTooltipHideTimer = () => {
  if (tooltipHideTimer.value !== null) {
    window.clearTimeout(tooltipHideTimer.value)
    tooltipHideTimer.value = null
  }
}

const clearZoomRestoreTimer = () => {
  if (zoomRestoreTimer.value !== null) {
    window.clearTimeout(zoomRestoreTimer.value)
    zoomRestoreTimer.value = null
  }
}

const clearBrowserSelection = () => {
  const selection = window.getSelection?.()
  if (!selection) return
  selection.removeAllRanges()
}

const getSectorElementAtPointer = (clientX: number, clientY: number) => {
  const element = document.elementFromPoint(clientX, clientY)
  if (!element) return null
  return element.closest('[data-sector-hover-id]') as SVGGraphicsElement | null
}

const closeTooltip = () => {
  clearTooltipHideTimer()
  hoveredSector.value = null
  isTooltipHovered.value = false
}

const scheduleTooltipClose = () => {
  clearTooltipHideTimer()
  tooltipHideTimer.value = window.setTimeout(() => {
    if (!isTooltipHovered.value) {
      hoveredSectorSource.value = null
      hoveredSector.value = null
    }
    tooltipHideTimer.value = null
  }, 90)
}

const formatOwnerName = (owner: string) => {
  const faction = factionsById[owner]!
  if (te(faction.nameId)) return t(faction.nameId)
  return t(faction.nameId)
}

const formatYieldLabel = (yieldName: string) => {
  const localized = t(`map.yield_names.${yieldName}`)
  if (localized !== `map.yield_names.${yieldName}`) return localized
  return yieldName
}

const chooseTooltipPlacement = (
  anchor: SectorHoverPayload['anchorRect'],
  viewportWidth: number,
  viewportHeight: number,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPlacement => {
  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2
  const candidates: Array<{ placement: TooltipPlacement; left: number; top: number }> = [
    { placement: 'bottom', left: centerX - tooltipWidth / 2, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'top', left: centerX - tooltipWidth / 2, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'right', left: anchor.right + TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'top-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'top-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'bottom-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'bottom-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET }
  ]

  const fits = (candidate: { left: number; top: number }) =>
    candidate.left >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.top >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.left + tooltipWidth <= viewportWidth - TOOLTIP_VIEWPORT_PADDING &&
    candidate.top + tooltipHeight <= viewportHeight - TOOLTIP_VIEWPORT_PADDING

  const orthogonal = candidates.slice(0, 4)
  const diagonal = candidates.slice(4)
  return (
    orthogonal.find(fits)?.placement ||
    diagonal.find(fits)?.placement ||
    candidates
      .map((candidate) => {
        const overflowLeft = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.left)
        const overflowTop = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.top)
        const overflowRight = Math.max(0, candidate.left + tooltipWidth - (viewportWidth - TOOLTIP_VIEWPORT_PADDING))
        const overflowBottom = Math.max(0, candidate.top + tooltipHeight - (viewportHeight - TOOLTIP_VIEWPORT_PADDING))
        return {
          placement: candidate.placement,
          overflow: overflowLeft + overflowTop + overflowRight + overflowBottom
        }
      })
      .sort((left, right) => left.overflow - right.overflow)[0]?.placement ||
    'bottom'
  )
}

const positionTooltip = () => {
  if (!hoveredSector.value || !viewportRef.value) return

  const viewportRect = viewportRef.value.getBoundingClientRect()
  const viewportWidth = viewportRef.value.clientWidth
  const viewportHeight = viewportRef.value.clientHeight
  const tooltipWidth = tooltipMeasuredSize.value.width
  const tooltipHeight = tooltipMeasuredSize.value.height
  if (!tooltipWidth || !tooltipHeight) return

  const anchor = {
    left: hoveredSector.value.anchorRect.left - viewportRect.left,
    top: hoveredSector.value.anchorRect.top - viewportRect.top,
    right: hoveredSector.value.anchorRect.right - viewportRect.left,
    bottom: hoveredSector.value.anchorRect.bottom - viewportRect.top,
    width: hoveredSector.value.anchorRect.width,
    height: hoveredSector.value.anchorRect.height
  }
  const placement = chooseTooltipPlacement(anchor, viewportWidth, viewportHeight, tooltipWidth, tooltipHeight)
  tooltipPlacement.value = placement

  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2
  let left = centerX - tooltipWidth / 2
  let top = anchor.bottom + TOOLTIP_OFFSET

  switch (placement) {
    case 'top':
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = centerY - tooltipHeight / 2
      break
    case 'right':
      left = anchor.right + TOOLTIP_OFFSET
      top = centerY - tooltipHeight / 2
      break
    case 'top-left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'top-right':
      left = anchor.right + TOOLTIP_OFFSET
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'bottom-left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = anchor.bottom + TOOLTIP_OFFSET
      break
    case 'bottom-right':
      left = anchor.right + TOOLTIP_OFFSET
      top = anchor.bottom + TOOLTIP_OFFSET
      break
    default:
      top = anchor.bottom + TOOLTIP_OFFSET
      break
  }

  tooltipPosition.value = {
    left: Math.min(
      viewportWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, left)
    ),
    top: Math.min(
      viewportHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, top)
    )
  }
}

const syncTooltipMeasurement = async () => {
  if (!hoveredSector.value) return
  await nextTick()
  const el = tooltipRef.value?.$el as HTMLElement | undefined
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  tooltipMeasuredSize.value = { width: rect.width, height: rect.height }
  positionTooltip()
}

const showTooltipFromSectorElement = async (sectorElement: SVGGraphicsElement) => {
  const sectorId = sectorElement.getAttribute('data-sector-hover-id')
  if (!sectorId) return

  const source = lastHoveredSectorSource.value
  if (!source || source.sectorId !== sectorId) return

  const rect = sectorElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  clearTooltipHideTimer()
  hoveredSectorSource.value = {
    ...source,
    anchorRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  }
  hoveredSector.value = createTooltipViewModel(hoveredSectorSource.value)
  await syncTooltipMeasurement()
}

const scheduleZoomTooltipRestore = () => {
  clearZoomRestoreTimer()
  zoomRestoreTimer.value = window.setTimeout(() => {
    zoomRestoreTimer.value = null
    const sectorElement = getSectorElementAtPointer(lastMousePos.value.x, lastMousePos.value.y)
    if (!sectorElement) return
    void showTooltipFromSectorElement(sectorElement)
  }, 200)
}

const createTooltipViewModel = (payload: SectorHoverPayload): TooltipViewModel => ({
    sectorId: payload.sectorId,
    title: locale.value === 'en' ? payload.name : payload.displayName,
    ownerName: formatOwnerName(payload.owner),
    sunlightPercent: payload.sunlight,
    resources: RESOURCE_ORDER
      .map((wareId) => payload.resources.find((item) => item.ware === wareId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => ({
        wareId: entry.ware,
        label: gameDataStore.getWareDisplayName(entry.ware) || (t(`res.${entry.ware}`) !== `res.${entry.ware}` ? t(`res.${entry.ware}`) : entry.ware),
        yieldLabel: formatYieldLabel(entry.yield || 'medium'),
        color: resourceColorByWare[entry.ware] || '#fbbf24'
      })),
    anchorRect: payload.anchorRect
  })

const onSectorHover = (payload: SectorHoverPayload) => {
  lastMousePos.value = {
    x: payload.anchorRect.left + payload.anchorRect.width / 2,
    y: payload.anchorRect.top + payload.anchorRect.height / 2
  }
  clearTooltipHideTimer()
  lastHoveredSectorSource.value = payload
  hoveredSectorSource.value = payload
  hoveredSector.value = createTooltipViewModel(payload)
  void syncTooltipMeasurement()
}

const onSectorLeave = (sectorId: string) => {
  if (hoveredSector.value?.sectorId !== sectorId) return
  scheduleTooltipClose()
}

const onTooltipMouseEnter = () => {
  clearTooltipHideTimer()
  isTooltipHovered.value = true
}

const onTooltipMouseLeave = () => {
  isTooltipHovered.value = false
  scheduleTooltipClose()
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
  if (selectedSectorSource.value === 'search') {
    selectedSectorId.value = null
    selectedSectorSource.value = null
  }
  searchInputRef.value?.focus()
}

const selectSector = (sectorId: string, source: 'search' | 'resource') => {
  selectedSectorId.value = sectorId
  selectedSectorSource.value = source
  if (source === 'search') {
    isSearchFocused.value = false
    searchInputRef.value?.blur()
  }
  focusSector(sectorId)
}

const selectSearchResult = (item: SearchSectorLayout) => {
  selectSector(item.sectorId, 'search')
}

const onResourceHighlightChange = (sectorIds: string[]) => {
  resourceHighlightedSectorIds.value = sectorIds
}

const onResourceSectorSelect = (sectorId: string) => {
  selectSector(sectorId, 'resource')
}

const onResourceActiveChange = (active: boolean) => {
  void active
}

const onResourcePrimaryColorChange = (color: string | null) => {
  resourcePrimaryColor.value = color
}

const onResourcePanelOpen = () => {
  isResourcePanelOpen.value = true
}

const onResourcePanelClose = () => {
  isResourcePanelOpen.value = false
}

const onMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return
  event.preventDefault()
  clearBrowserSelection()
  closeTooltip()
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragOriginX.value = panX.value
  dragOriginY.value = panY.value
}

const onMouseMove = (event: MouseEvent) => {
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  clampPan(dragOriginX.value + dx, dragOriginY.value + dy)
}

const onWheel = (event: WheelEvent) => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  event.preventDefault()
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  closeTooltip()

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
  scheduleZoomTooltipRestore()
}

const stopDrag = () => {
  isDragging.value = false
}

const onResize = () => {
  recomputeScaleBounds()
  closeTooltip()
}

watch(isResourcePanelOpen, async () => {
  await nextTick()
  recomputeScaleBounds()
  closeTooltip()
})

watch(locale, () => {
  if (!hoveredSectorSource.value) return
  hoveredSector.value = createTooltipViewModel(hoveredSectorSource.value)
  void syncTooltipMeasurement()
})

watch(hoveredSector, () => {
  if (!hoveredSector.value) {
    tooltipMeasuredSize.value = { width: 0, height: 0 }
    return
  }
  void syncTooltipMeasurement()
})

onMounted(() => {
  window.addEventListener('resize', onResize)
  if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
    viewportResizeObserver.value = new ResizeObserver(() => {
      recomputeScaleBounds()
    })
    viewportResizeObserver.value.observe(viewportRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  viewportResizeObserver.value?.disconnect()
  viewportResizeObserver.value = null
  clearTooltipHideTimer()
  clearZoomRestoreTimer()
})
</script>

<template>
  <section class="map-workbench">
    <div class="map-layout" :class="{ 'sidebar-active': isResourcePanelOpen }">
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
              :search-highlighted-sector-ids="searchHighlightedSectorIds"
              :resource-highlighted-sector-ids="resourceHighlightedSectorIds"
              :resource-fill-color-override="resourcePrimaryColor"
              :selected-sector-id="selectedSectorId"
              @content-size="onCanvasSize"
              @sector-layout="onSectorLayout"
              @sector-hover="onSectorHover"
              @sector-leave="onSectorLeave"
            />
          </div>

          <div
            v-if="hoveredSector"
            class="map-sector-tooltip-layer"
            :class="`placement-${tooltipPlacement}`"
            :style="{
              left: `${tooltipPosition.left}px`,
              top: `${tooltipPosition.top}px`
            }"
            @mouseenter="onTooltipMouseEnter"
            @mouseleave="onTooltipMouseLeave"
            @mousedown.stop
          >
            <MapSectorTooltip
              ref="tooltipRef"
              :title="hoveredSector.title"
              :owner-name="hoveredSector.ownerName"
              :sunlight-percent="hoveredSector.sunlightPercent"
              :resources="hoveredSector.resources"
              :sunlight-label="t('map.resource_filter_sunlight')"
              :sunlight-suffix="t('map.resource_filter_sunlight_suffix')"
            />
          </div>
        </div>

        <div class="map-search-panel" @mousedown.stop>
          <div class="search-box group" :class="{ focused: isSearchFocused }">
            <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M16 16l4 4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
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

        <button
          v-if="!isResourcePanelOpen"
          type="button"
          class="map-resource-entry-btn"
          data-testid="map-resource-entry-button"
          @click="onResourcePanelOpen"
        >
          <span class="map-resource-entry-label">{{ t('map.resource_filter_button') }}</span>
          <svg class="map-resource-entry-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
        </button>

        <div class="zoom-panel">
          <div class="zoom-label-row">
            <span class="zoom-label">{{ t('map.scale') }}</span>
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

      <MapResourceFilterPanel
        v-show="isResourcePanelOpen"
        :sector-layouts="searchSectors"
        :mode="isResourcePanelOpen ? 'sidebar' : 'overlay'"
        :show-entry-button="false"
        @highlight-change="onResourceHighlightChange"
        @select-sector="onResourceSectorSelect"
        @active-change="onResourceActiveChange"
        @primary-color-change="onResourcePrimaryColorChange"
        @panel-open="onResourcePanelOpen"
        @panel-close="onResourcePanelClose"
      />
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
  @apply relative min-w-0 flex-1 bg-black/70 rounded-lg border border-amber-300/35 p-3 overflow-hidden;
  height: 100%;
}

.map-layout {
  @apply relative flex h-full min-h-0;
}

.map-layout.sidebar-active {
  @apply gap-3;
}

.map-viewport {
  @apply relative w-full overflow-hidden cursor-grab;
  height: 100%;
  min-height: 0;
}

.map-viewport.dragging {
  @apply cursor-grabbing;
  user-select: none;
}

.map-viewport.dragging * {
  user-select: none;
}

.map-content {
  @apply select-none;
  will-change: transform;
}

.map-sector-tooltip-layer {
  @apply absolute z-20;
  pointer-events: auto;
}

.map-search-panel {
  @apply absolute left-6 top-5 z-10;
  width: 220px;
}

.map-resource-entry-btn {
  @apply absolute right-6 top-5 z-10 inline-flex h-10 items-center justify-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-resource-entry-label {
  @apply leading-none;
}

.map-resource-entry-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
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
  @apply mr-2 h-[18px] w-[18px] shrink-0 text-amber-200/70;
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
