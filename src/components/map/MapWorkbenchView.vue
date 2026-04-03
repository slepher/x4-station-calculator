<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MapSvgCanvas from '@/components/map/MapSvgCanvas.vue'
import MapSectorTooltip from './MapSectorTooltip.vue'
import MapResourceFilterPanel from './MapResourceFilterPanel.vue'
import MapStationPanel, { type MapStationPanelItem } from './MapStationPanel.vue'
import MapSavePanel from './MapSavePanel.vue'
import { getEffectiveVisibleSavePoiCategories } from './savePoiVisibility'
import MapSavePoiTooltip from './MapSavePoiTooltip.vue'
import { focusOverlayInViewport } from './focusOverlayInViewport'
import { resolveMapSectorByMacro } from './mapSectorMacro'
import { getSectorScalePerRadius } from '@/components/map/utils/coordinates'
import { shouldHideSavePoiSmallIconAtClusterOverview } from '@/components/map/utils/style'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import type { SectorResourceFill } from '@/store/logic/mapResourceFilter'
import type { EntityLocation } from '@/types/x4'
import { useSaveStore } from '@/store/useSaveStore'
import type { SaveArchive, SavePoiCategory, SavePoiVisibility, SavePoiOverlayItem } from '@/types/saveArchive'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
  radius: number
  verticalExtent: number
}
type SearchResultItem = SearchSectorLayout & {
  matchType: 'name' | 'localeName' | 'id'
}
type MapSectorResourceEntry = {
  ware: string
  yield?: string
  level?: number
  respawn?: number
  rating?: number
}
type MapSectorDataset = {
  id: string
  clusterId: string
  name: string
  displayName: string
  sunlight: number
  resources: MapSectorResourceEntry[]
  scalePerRadius: number
}
const UNASSIGNED_STATION_GROUP_ID = '__unassigned__'
type SectorHoverPayload = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  resources: MapSectorResourceEntry[]
  hasKhaakHive: boolean
  khaakHiveSources: string[]
  anchorRect: {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }
}
type TooltipPlacement = 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type TooltipViewModel = {
  sectorId: string
  anchorRect: SectorHoverPayload['anchorRect']
}
type PlacementOverlayItem = {
  key: string
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: EntityLocation
}
type PlacementPreview = {
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: EntityLocation
}
type DraggingPlacementItem = {
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
}

const clusterRefHeightPx = ref(142)
const MAX_SCALE_MULTIPLIER = 2
const TOOLTIP_OFFSET = 14
const TOOLTIP_VIEWPORT_PADDING = 12

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
const clusterVisibilityThresholdPx = ref(0)

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
const isStationPanelOpen = ref(false)
const isSavePanelOpen = ref(false)
const selectedSaveArchive = ref<SaveArchive | null>(null)
const activeSavePoiCategory = ref<SavePoiCategory | null>(null)
const excludeConditionalSmallStations = ref(true)
const savePoiVisibility = ref<SavePoiVisibility>({
  playerStation: false,
  npcStation: false,
  xenonStation: false,
  khaakStation: false,
  abandonedShip: false,
  datavault: false,
  erlkingVault: false
})
const focusedSavePoiKey = ref<string | null>(null)
const savePoiTooltipItem = ref<SavePoiOverlayItem | null>(null)
const resourcePrimaryColor = ref<string | null>(null)
const resourceSectorFills = ref<Record<string, SectorResourceFill>>({})
const resourceSectorGroupBadges = ref<Record<string, string[]>>({})
const draggingPlacementItem = ref<DraggingPlacementItem | null>(null)
const draggingOverlayKey = ref<string | null>(null)
const focusedPlacementKey = ref<string | null>(null)
const placementPreview = ref<PlacementPreview | null>(null)
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
const saveStore = useSaveStore()
const empireStore = useEmpireStore()
const sectorsById = computed<Record<string, MapSectorDataset>>(() => {
  const out: Record<string, MapSectorDataset> = {}
  const clusters = gameDataStore.maps?.clusters || {}
  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    // DLC filter: skip clusters from inactive DLC
    if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
      return
    }
    Object.values(cluster.sectors || {}).forEach((sector: any) => {
      const displayName = sector.nameId && te(sector.nameId) ? t(sector.nameId) : (sector.name || sector.id)
      out[sector.id] = {
        id: sector.id,
        clusterId,
        name: sector.name || sector.id,
        displayName,
        sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100),
        resources: Array.isArray(sector.resources) ? sector.resources : [],
        scalePerRadius: getSectorScalePerRadius(sector as any)
      }
    })
  })
  return out
})

const displayScaleText = computed(() => `${Math.round(scale.value * 100)}%`)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())
const stationPanelItems = computed<MapStationPanelItem[]>(() => {
  const empire = empireStore.activeEmpire
  if (!empire) return []
  const sortedSectors = [...(empire.sectors || [])].sort((left, right) => (left.order || 0) - (right.order || 0))
  const items: MapStationPanelItem[] = []

  sortedSectors.forEach((sector) => {
    items.push({
      id: sector.id,
      kind: 'sector',
      name: sector.name,
      icon: 'tradestation',
      groupId: sector.id,
      groupName: sector.name,
      targetSectorName: sector.location ? (sectorsById.value[sector.location.sector_id]?.displayName || sector.location.sector_id) : undefined,
      location: sector.location
    })

    ;(empire.stations || [])
      .filter((station) => station.sectorId === sector.id)
      .forEach((station) => {
        const targetSectorId = station.location?.sector_id
        const isAddressInactive = gameDataStore.enforceDlcActivation &&
          targetSectorId !== undefined &&
          sectorsById.value[targetSectorId] === undefined
        items.push({
          id: station.id,
          kind: 'station',
          name: station.name,
          icon: station.type === 'shipyard' ? 'shipyard' : 'factory',
          groupId: sector.id,
          groupName: sector.name,
          targetSectorName: station.location ? (sectorsById.value[station.location.sector_id]?.displayName || station.location.sector_id) : undefined,
          location: station.location,
          isAddressInactive
        })
      })
  })

  ;(empire.stations || [])
    .filter((station) => !station.sectorId)
    .forEach((station) => {
      const targetSectorId = station.location?.sector_id
      const isAddressInactive = gameDataStore.enforceDlcActivation &&
        targetSectorId !== undefined &&
        sectorsById.value[targetSectorId] === undefined
      items.push({
        id: station.id,
        kind: 'station',
        name: station.name,
        icon: station.type === 'shipyard' ? 'shipyard' : 'factory',
        groupId: UNASSIGNED_STATION_GROUP_ID,
        groupName: t('sectorManagement.unassigned'),
        targetSectorName: station.location ? (sectorsById.value[station.location.sector_id]?.displayName || station.location.sector_id) : undefined,
        location: station.location,
        isAddressInactive
      })
    })

  return items
})
const placementOverlays = computed<PlacementOverlayItem[]>(() => {
  if (!isStationPanelOpen.value) return []
  return stationPanelItems.value
    .filter((item): item is MapStationPanelItem & { location: EntityLocation } => Boolean(item.location))
    .map((item) => ({
      key: `${item.kind}:${item.id}`,
      id: item.id,
      kind: item.kind,
      name: item.name,
      icon: item.icon,
      location: item.location
    }))
})

const savePoiOverlays = computed<SavePoiOverlayItem[]>(() => {
  if (!isSavePanelOpen.value || !selectedSaveArchive.value) return []
  const activeCategories = getEffectiveVisibleSavePoiCategories(
    savePoiVisibility.value,
    activeSavePoiCategory.value
  )
  const isClusterOverview =
    clusterVisibilityThresholdPx.value > 0 &&
    clusterRefHeightPx.value * scale.value <= clusterVisibilityThresholdPx.value
  const shouldCullHiddenSmallIcons = isDragging.value || isClusterOverview

  return saveStore
    .getArchivePoiOverlays(selectedSaveArchive.value, activeCategories, {
      excludeConditionalSmallStations: excludeConditionalSmallStations.value,
      isClusterOverview
    })
    .filter((overlay) => !shouldCullHiddenSmallIcons || !shouldHideSavePoiSmallIconAtClusterOverview(overlay))
    .map((overlay) => {
      const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, overlay.sectorMacro)
      const sectorData = resolved ? sectorsById.value[resolved.sectorId] : null
      return {
        ...overlay,
        sectorName: sectorData?.displayName || overlay.sectorName
      }
    })
})

const isClusterOverview = computed(() =>
  clusterVisibilityThresholdPx.value > 0 &&
  clusterRefHeightPx.value * scale.value <= clusterVisibilityThresholdPx.value
)

const savePoiViewportContentBounds = computed(() => {
  const { width, height } = getViewportSize()
  if (!width || !height || !scale.value) return null
  return {
    left: (-panX.value) / scale.value,
    top: (-panY.value) / scale.value,
    right: (width - panX.value) / scale.value,
    bottom: (height - panY.value) / scale.value
  }
})

const sectorOwnerOverride = computed<Record<string, string> | undefined>(() => {
  if (!isSavePanelOpen.value || !selectedSaveArchive.value) return undefined
  const map: Record<string, string> = {}
  let hasOverride = false
  Object.entries(selectedSaveArchive.value.sectors).forEach(([macro, sector]) => {
    if (sector.owner) {
      const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, macro)
      if (resolved?.sectorId) {
        map[resolved.sectorId] = sector.owner
        hasOverride = true
      }
    }
  })
  return hasOverride ? map : undefined
})

const clusterOwnerOverride = computed<Record<string, string> | undefined>(() => {
  if (!sectorOwnerOverride.value) return undefined
  const clusters = gameDataStore.maps?.clusters || {}
  const result: Record<string, string> = {}
  
  for (const [clusterId, cluster] of Object.entries(clusters)) {
    const sectorIds = Object.keys(cluster.sectors || {})
    if (sectorIds.length === 0) continue
    
    const owners = sectorIds
      .map(id => sectorOwnerOverride.value?.[id])
      .filter((o): o is string => !!o)
    
    if (owners.length === sectorIds.length && owners.length > 0) {
      const firstOwner = owners[0]!
      if (owners.every(o => o === firstOwner)) {
        result[clusterId] = firstOwner
      } else {
        result[clusterId] = 'ownerless'
      }
    } else if (owners.length > 0) {
      result[clusterId] = 'ownerless'
    }
  }
  
  return Object.keys(result).length > 0 ? result : undefined
})

const factionColorMap = computed<Record<string, string> | undefined>(() => {
  return gameDataStore.factionColorMap
})

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
  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const fitByWidth = vw / imageNaturalWidth.value
  const nextMin = fitByWidth
  const targetHalfScreen = window.innerHeight * 0.5
  const refHeight = Math.max(1, clusterRefHeightPx.value)
  const nextMax = Math.max(nextMin, targetHalfScreen / refHeight) * MAX_SCALE_MULTIPLIER

  minScale.value = nextMin
  maxScale.value = nextMax
  clusterVisibilityThresholdPx.value = Math.min(vw, vh) / 3
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
  return element.closest('[data-map-sector-id], [data-sector-hover-id]') as SVGGraphicsElement | null
}

const resolveLocationFromSectorElement = (sectorElement: SVGGraphicsElement, clientX: number, clientY: number): EntityLocation | null => {
  const sectorId = sectorElement.getAttribute('data-map-sector-id') || sectorElement.getAttribute('data-sector-hover-id')
  if (!sectorId) return null
  const mapSector = sectorsById.value[sectorId]
  if (!mapSector || !mapSector.scalePerRadius) return null
  const rect = sectorElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const radius = rect.width / 2
  if (!radius) return null
  const ratioX = (clientX - centerX) / radius
  const ratioY = (clientY - centerY) / radius
  const rawScale = 1 / mapSector.scalePerRadius
  return {
    cluster_id: mapSector.clusterId,
    sector_id: sectorId,
    pos: {
      x: Math.round(ratioX * rawScale),
      z: Math.round(-ratioY * rawScale)
    },
    sunlight: mapSector.sunlight,
    resources: Array.from(new Set(mapSector.resources.map((entry) => entry.ware)))
  }
}

const resolveLocationAtPointer = (clientX: number, clientY: number): EntityLocation | null => {
  const sectorElement = getSectorElementAtPointer(clientX, clientY)
  if (!sectorElement) return null
  return resolveLocationFromSectorElement(sectorElement, clientX, clientY)
}

const clearPlacementState = () => {
  draggingPlacementItem.value = null
  draggingOverlayKey.value = null
  placementPreview.value = null
}

const applyLocationToItem = (item: DraggingPlacementItem, location: EntityLocation) => {
  if (item.kind === 'station') {
    empireStore.setStationLocation(item.id, location)
    return
  }
  empireStore.setSectorLocation(item.id, location)
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
    anchorRect: payload.anchorRect,
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

const fitSectors = (sectorIds: string[]) => {
  const targets = Array.from(new Set(sectorIds))
    .map((sectorId) => searchSectors.value.find((item) => item.sectorId === sectorId))
    .filter((item): item is SearchSectorLayout => Boolean(item))
  if (!targets.length) return

  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const minX = Math.min(...targets.map((item) => item.centerX - item.radius))
  const maxX = Math.max(...targets.map((item) => item.centerX + item.radius))
  const minY = Math.min(...targets.map((item) => item.centerY - item.verticalExtent))
  const maxY = Math.max(...targets.map((item) => item.centerY + item.verticalExtent))
  const boundsW = Math.max(1, maxX - minX)
  const boundsH = Math.max(1, maxY - minY)
  const safeWidth = boundsW * 1.25
  const safeHeight = boundsH * 1.25
  const fittedScale = Math.min(vw / safeWidth, vh / safeHeight)
  const maxRadius = Math.max(...targets.map((item) => item.radius), 1)
  const maxVerticalExtent = Math.max(...targets.map((item) => item.verticalExtent), 1)
  const targetScale = boundsW <= maxRadius * 2.2 && boundsH <= maxVerticalExtent * 2.2
    ? (scale.value < 1 ? clampScale(1) : scale.value)
    : clampScale(fittedScale)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  focusedPlacementKey.value = null
  selectedSectorId.value = null
  selectedSectorSource.value = null
  scale.value = targetScale
  syncSliderFromScale()
  clampPan(vw * 0.5 - centerX * targetScale, vh * 0.5 - centerY * targetScale)
}

const focusPlacementOverlay = async (placementKey: string) => {
  const viewport = viewportRef.value
  if (!viewport) return

  const targetScale = scale.value < 1 ? clampScale(1) : scale.value
  if (targetScale !== scale.value) {
    scale.value = targetScale
    syncSliderFromScale()
    await nextTick()
  }

  focusOverlayInViewport(viewport, `[data-placement-key="${placementKey}"]`, {
    panX: panX.value,
    panY: panY.value,
    clampPan
  })
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
  focusedPlacementKey.value = null
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
  if (selectedSectorSource.value === 'resource') {
    selectedSectorId.value = null
    selectedSectorSource.value = null
  }
  resourceHighlightedSectorIds.value = sectorIds
}

const onResourceSectorSelect = (sectorId: string) => {
  selectSector(sectorId, 'resource')
}

const onResourceFitSectors = (sectorIds: string[]) => {
  fitSectors(sectorIds)
}

const onResourceVisualChange = (payload: {
  highlightedSectorIds: string[]
  sectorFills: Record<string, SectorResourceFill>
  sectorGroupBadges?: Record<string, string[]>
}) => {
  resourceHighlightedSectorIds.value = payload.highlightedSectorIds
  resourceSectorFills.value = payload.sectorFills
  resourceSectorGroupBadges.value = payload.sectorGroupBadges || {}
  const firstSectorId = payload.highlightedSectorIds[0]
  const firstFill = firstSectorId ? payload.sectorFills[firstSectorId] : null
  resourcePrimaryColor.value = firstFill?.mode === 'solid' ? firstFill.color : null
}

const onResourceActiveChange = (active: boolean) => {
  void active
}

const onResourcePrimaryColorChange = (color: string | null) => {
  resourcePrimaryColor.value = color
}

const onResourcePanelOpen = () => {
  isStationPanelOpen.value = false
  isSavePanelOpen.value = false
  clearPlacementState()
  isResourcePanelOpen.value = true
}

const onResourcePanelClose = () => {
  isResourcePanelOpen.value = false
  resourceHighlightedSectorIds.value = []
  resourceSectorFills.value = {}
  resourceSectorGroupBadges.value = {}
  resourcePrimaryColor.value = null
}

const onStationPanelOpen = () => {
  isResourcePanelOpen.value = false
  isSavePanelOpen.value = false
  isStationPanelOpen.value = true
}

const onStationPanelClose = () => {
  isStationPanelOpen.value = false
  focusedPlacementKey.value = null
  clearPlacementState()
}

const onSavePanelOpen = () => {
  isResourcePanelOpen.value = false
  isStationPanelOpen.value = false
  clearPlacementState()
  isSavePanelOpen.value = true
}

const onSavePanelClose = () => {
  isSavePanelOpen.value = false
  selectedSaveArchive.value = null
  activeSavePoiCategory.value = null
  focusedSavePoiKey.value = null
  savePoiVisibility.value = {
    playerStation: false,
    npcStation: false,
    xenonStation: false,
    khaakStation: false,
    abandonedShip: false,
    datavault: false,
    erlkingVault: false
  }
}

const onSaveSelectArchive = async (payload: { guid: string; time: number } | null) => {
  if (!payload) {
    selectedSaveArchive.value = null
    activeSavePoiCategory.value = null
    return
  }

  await saveStore.selectArchive(payload.guid, payload.time)
  selectedSaveArchive.value = saveStore.selectedArchive
  activeSavePoiCategory.value = null
  savePoiVisibility.value = {
    playerStation: false,
    npcStation: false,
    xenonStation: false,
    khaakStation: false,
    abandonedShip: false,
    datavault: false,
    erlkingVault: false
  }
}

const onSaveVisibilityChange = (visibility: SavePoiVisibility) => {
  savePoiVisibility.value = visibility
}

const onSaveActiveCategoryChange = (category: SavePoiCategory | null) => {
  activeSavePoiCategory.value = category
}

const onSavePoiFocus = async (poi: SavePoiOverlayItem) => {
  const viewport = viewportRef.value
  if (!viewport) return

  const targetScale = scale.value < 1 ? clampScale(1) : scale.value
  if (targetScale !== scale.value) {
    scale.value = targetScale
    syncSliderFromScale()
    await nextTick()
  }
  focusedSavePoiKey.value = poi.key
  await nextTick()
  focusOverlayInViewport(viewport, `[data-save-poi-key="${poi.key}"]`, {
    panX: panX.value,
    panY: panY.value,
    clampPan
  })
}

const onStationItemDragStart = (item: MapStationPanelItem) => {
  draggingPlacementItem.value = {
    id: item.id,
    kind: item.kind,
    name: item.name,
    icon: item.icon
  }
  draggingOverlayKey.value = item.location ? `${item.kind}:${item.id}` : null
}

const onStationItemDragEnd = () => {
  clearPlacementState()
}

const onStationItemClearLocation = (item: MapStationPanelItem) => {
  if (item.kind === 'station') {
    empireStore.clearStationLocation(item.id)
    return
  }
  empireStore.clearSectorLocation(item.id)
}

const onStationItemFocus = (item: MapStationPanelItem) => {
  if (!item.location) return
  selectedSectorId.value = null
  selectedSectorSource.value = null
  focusedPlacementKey.value = `${item.kind}:${item.id}`
  void focusPlacementOverlay(focusedPlacementKey.value)
}

const onMouseDown = (event: MouseEvent) => {
  if (draggingPlacementItem.value) return
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
  if (draggingPlacementItem.value && isStationPanelOpen.value) {
    const location = resolveLocationAtPointer(event.clientX, event.clientY)
    placementPreview.value = location ? {
      kind: draggingPlacementItem.value.kind,
      name: draggingPlacementItem.value.name,
      icon: draggingPlacementItem.value.icon,
      location
    } : null
  }
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
  if (!draggingPlacementItem.value) return
  if (placementPreview.value) {
    applyLocationToItem(draggingPlacementItem.value, placementPreview.value.location)
  }
  clearPlacementState()
}

const onResize = () => {
  recomputeScaleBounds()
  closeTooltip()
}

const onViewportDragOver = (event: DragEvent) => {
  if (!draggingPlacementItem.value || !isStationPanelOpen.value) return
  event.preventDefault()
  const location = resolveLocationAtPointer(event.clientX, event.clientY)
  placementPreview.value = location ? {
    kind: draggingPlacementItem.value.kind,
    name: draggingPlacementItem.value.name,
    icon: draggingPlacementItem.value.icon,
    location
  } : null
}

const onViewportDrop = (event: DragEvent) => {
  if (!draggingPlacementItem.value || !isStationPanelOpen.value) return
  event.preventDefault()
  const location = resolveLocationAtPointer(event.clientX, event.clientY)
  if (location) {
    applyLocationToItem(draggingPlacementItem.value, location)
  }
  clearPlacementState()
}

const onOverlayPointerDown = (payload: {
  key: string
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
}) => {
  draggingPlacementItem.value = {
    id: payload.id,
    kind: payload.kind,
    name: payload.name,
    icon: payload.icon
  }
  draggingOverlayKey.value = payload.key
}

const onSavePoiPointerDown = (poi: SavePoiOverlayItem) => {
  focusedSavePoiKey.value = poi.key
  savePoiTooltipItem.value = poi
}

watch(isResourcePanelOpen, async () => {
  await nextTick()
  recomputeScaleBounds()
  closeTooltip()
})

watch(isStationPanelOpen, async (open) => {
  if (!open) clearPlacementState()
  await nextTick()
  recomputeScaleBounds()
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
  <section class="map-workbench" data-testid="map-workbench-view">
    <div class="map-layout" :class="{ 'sidebar-active': isResourcePanelOpen, 'station-sidebar-active': isStationPanelOpen, 'save-sidebar-active': isSavePanelOpen }">
      <MapResourceFilterPanel
        v-show="isResourcePanelOpen"
        :sector-layouts="searchSectors"
        :mode="isResourcePanelOpen ? 'sidebar' : 'overlay'"
        :show-entry-button="false"
        @highlight-change="onResourceHighlightChange"
        @resource-visual-change="onResourceVisualChange"
        @select-sector="onResourceSectorSelect"
        @fit-sectors="onResourceFitSectors"
        @active-change="onResourceActiveChange"
        @primary-color-change="onResourcePrimaryColorChange"
        @panel-open="onResourcePanelOpen"
        @panel-close="onResourcePanelClose"
      />

      <MapStationPanel
        :open="isStationPanelOpen"
        :items="stationPanelItems"
        @close="onStationPanelClose"
        @drag-start="onStationItemDragStart"
        @drag-end="onStationItemDragEnd"
        @clear-location="onStationItemClearLocation"
        @focus-item="onStationItemFocus"
      />

      <MapSavePanel
        :open="isSavePanelOpen"
        :archive="selectedSaveArchive"
        :visibility="savePoiVisibility"
        :exclude-conditional-small-stations="excludeConditionalSmallStations"
        :is-cluster-overview="isClusterOverview"
        @close="onSavePanelClose"
        @select-archive="onSaveSelectArchive"
        @visibility-change="onSaveVisibilityChange"
        @active-category-change="onSaveActiveCategoryChange"
        @exclude-conditional-small-stations-change="excludeConditionalSmallStations = $event"
        @focus-poi="onSavePoiFocus"
      />

      <div class="map-shell">
        <div
          ref="viewportRef"
          class="map-viewport"
          data-testid="map-viewport"
          :class="{ dragging: isDragging }"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @wheel="onWheel"
          @dragover="onViewportDragOver"
          @drop="onViewportDrop"
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
              :resource-sector-fills="resourceSectorFills"
              :resource-sector-group-badges="resourceSectorGroupBadges"
              :resource-fill-color-override="resourcePrimaryColor"
              :selected-sector-id="selectedSectorId"
              :placement-overlays="placementOverlays"
              :placement-preview="isStationPanelOpen ? placementPreview : null"
              :is-dragging="isDragging"
              :dragging-overlay-key="draggingOverlayKey"
              :focused-overlay-key="focusedPlacementKey"
              :save-poi-overlays="savePoiOverlays"
              :viewport-content-bounds="savePoiViewportContentBounds"
              :min-scale="minScale"
              :max-scale="maxScale"
              :current-scale="scale"
              :zoom-progress="zoomPercent / 100"
              :cluster-visibility-threshold-px="clusterVisibilityThresholdPx"
              :focused-save-poi-key="focusedSavePoiKey"
              :sector-owner-override="sectorOwnerOverride"
              :cluster-owner-override="clusterOwnerOverride"
              :faction-color-map="factionColorMap"
              @content-size="onCanvasSize"
              @sector-layout="onSectorLayout"
              @sector-hover="onSectorHover"
              @sector-leave="onSectorLeave"
              @overlay-pointerdown="onOverlayPointerDown"
              @save-poi-pointerdown="onSavePoiPointerDown"
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
              :sector-id="hoveredSector.sectorId"
              :sector-owner-override="sectorOwnerOverride"
            />
          </div>

          <div
            v-if="savePoiTooltipItem"
            class="save-poi-tooltip-layer"
            @mousedown.stop
          >
            <MapSavePoiTooltip :poi="savePoiTooltipItem" />
            <button
              class="tooltip-close"
              type="button"
              @click="savePoiTooltipItem = null"
            >
              ×
            </button>
          </div>
        </div>

        <div class="map-search-panel left-6 top-5" @mousedown.stop>
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

        <div class="map-panel-tabs left-6 bottom-5" @mousedown.stop>
          <button
            type="button"
            class="map-panel-tab"
            :class="{ active: isResourcePanelOpen }"
            data-testid="map-resource-panel-tab"
            @click="onResourcePanelOpen"
          >
            <span class="map-panel-tab-label">{{ t('map.resource_filter_button') }}</span>
            <svg class="map-panel-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
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

          <button
            type="button"
            class="map-panel-tab"
            :class="{ active: isStationPanelOpen }"
            data-testid="map-station-entry-button"
            @click="onStationPanelOpen"
          >
            <span class="map-panel-tab-label">{{ t('map.station_panel_button') }}</span>
            <svg class="map-panel-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3l7 4v10l-7 4-7-4V7l7-4zm0 4.2L8 9.4v5.2l4 2.2 4-2.2V9.4l-4-2.2z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.6"
              />
            </svg>
          </button>

          <button
            type="button"
            class="map-panel-tab"
            :class="{ active: isSavePanelOpen }"
            data-testid="map-save-panel-tab"
            @click="onSavePanelOpen"
          >
            <span class="map-panel-tab-label">{{ t('map.save_panel_button') }}</span>
            <svg class="map-panel-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>
        </div>

        <div class="zoom-panel right-6 bottom-5">
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
  @apply relative min-w-0 flex-1 bg-black/70 rounded-lg border border-amber-300/35 overflow-hidden;
  height: 100%;
}

.map-layout {
  @apply relative flex h-full min-h-0;
}

.map-layout.sidebar-active {
  @apply gap-3;
}

.map-layout.station-sidebar-active {
  @apply gap-3;
}

.map-layout.save-sidebar-active {
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
  @apply absolute z-10;
  width: 220px;
}

.map-resource-entry-btn {
  @apply absolute z-10 inline-flex h-10 items-center justify-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-station-entry-btn {
  @apply absolute z-10 inline-flex h-10 items-center justify-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-resource-entry-label {
  @apply leading-none;
}

.map-resource-entry-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.map-station-entry-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.map-panel-tabs {
  @apply absolute z-10 flex items-center gap-1;
}

.map-panel-tab {
  @apply inline-flex items-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 h-10 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-panel-tab.active {
  @apply border-amber-200/70 bg-amber-200/15 text-amber-50;
}

.map-panel-tab-label {
  @apply leading-none;
}

.map-panel-tab-icon {
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
  @apply absolute z-10 rounded-md border border-amber-300/40 bg-black/70 px-3 py-2;
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

.save-poi-tooltip-layer {
  @apply absolute z-30 bottom-20 right-6 flex items-start gap-2;
}

.tooltip-close {
  @apply w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-amber-100/60 hover:text-amber-50 hover:bg-black/80 transition-colors;
}
</style>
