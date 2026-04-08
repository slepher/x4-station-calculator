<script setup lang="ts">
import { computed, toRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { SavePoiOverlayItem, SectorData } from '@/types/saveArchive'
import {
  FALLBACK_OWNER_COLOR,
  MAP_FONT_FAMILY,
  OVERLAY_ICON_SIZE,
  PREVIEW_ICON_SIZE,
  getSavePoiIconUrl,
  placementIconHref,
  svgIdSafe
} from '@/components/map/utils/style'
import { hexPoints } from '@/components/map/utils/geometry'
import type {
  PlacementOverlay,
  PlacementPreview,
  SearchSectorLayout,
  SectorResourceEntry,
  SectorResourceFill
} from '@/components/map/types'
import { useMapSvgLayout } from '@/composables/useMapSvgLayout'
import { useMapSvgLinks } from '@/composables/useMapSvgLinks'
import { useMapSvgOverlays } from '@/composables/useMapSvgOverlays'
import { useMapSvgSectors } from '@/composables/useMapSvgSectors'
import MapLinkLayer from '@/components/map/layers/MapLinkLayer.vue'
import MapOverlayLayer from '@/components/map/layers/MapOverlayLayer.vue'
import MapSectorLayer from '@/components/map/layers/MapSectorLayer.vue'
type SectorHoverPayload = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  resources: SectorResourceEntry[]
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
const SECTOR_LABEL_FONT_SIZE = 14
const STARGATE_VISUAL_SCALE = 1.5
const SEARCH_HIGHLIGHT_FILTER_ID = 'map-search-sector-glow'
const RESOURCE_HIGHLIGHT_FILTER_ID = 'map-resource-sector-glow'
const SEARCH_SELECTED_FILTER_ID = 'map-search-sector-selected-glow'

const props = withDefaults(defineProps<{
  searchHighlightedSectorIds?: string[]
  resourceHighlightedSectorIds?: string[]
  resourceSectorFills?: Record<string, SectorResourceFill>
  resourceSectorGroupBadges?: Record<string, string[]>
  resourceFillColorOverride?: string | null
  selectedSectorId?: string | null
  placementOverlays?: PlacementOverlay[]
  placementPreview?: PlacementPreview | null
  isDragging?: boolean
  isZooming?: boolean
  draggingOverlayKey?: string | null
  focusedOverlayKey?: string | null
  savePoiOverlays?: SavePoiOverlayItem[]
  saveSectors?: Record<string, SectorData> | undefined
  viewportContentBounds?: {
    left: number
    top: number
    right: number
    bottom: number
  } | null
  sectorViewportContentBounds?: {
    left: number
    top: number
    right: number
    bottom: number
  } | null
  minScale?: number
  maxScale?: number
  currentScale?: number
  zoomProgress?: number
  clusterVisibilityThresholdPx?: number
  focusedSavePoiKey?: string | null
  viewportWidth?: number
  viewportHeight?: number
  viewBoxBounds?: {
    left: number
    top: number
    width: number
    height: number
  } | null
  sectorOwnerOverride?: Record<string, string>
  clusterOwnerOverride?: Record<string, string>
  factionColorMap?: Record<string, string>
  showSectorLabels?: boolean
  showSectorLinks?: boolean
  showResourceBadges?: boolean
}>(), {
  searchHighlightedSectorIds: () => [],
  resourceHighlightedSectorIds: () => [],
  resourceSectorFills: () => ({}),
  resourceSectorGroupBadges: () => ({}),
  resourceFillColorOverride: null,
  selectedSectorId: null,
  placementOverlays: () => [],
  placementPreview: null,
  isDragging: false,
  isZooming: false,
  draggingOverlayKey: null,
  focusedOverlayKey: null,
  savePoiOverlays: () => [],
  saveSectors: undefined,
  viewportContentBounds: null,
  sectorViewportContentBounds: null,
  minScale: 1,
  maxScale: 1,
  currentScale: 1,
  zoomProgress: 0,
  clusterVisibilityThresholdPx: 0,
  focusedSavePoiKey: null,
  viewportWidth: 0,
  viewportHeight: 0,
  viewBoxBounds: null,
  sectorOwnerOverride: undefined,
  clusterOwnerOverride: undefined,
  factionColorMap: undefined,
  showSectorLabels: true,
  showSectorLinks: true,
  showResourceBadges: true
})

const emit = defineEmits<{
  (e: 'content-size', payload: { width: number; height: number; clusterRefHeight: number }): void
  (e: 'sector-layout', payload: SearchSectorLayout[]): void
  (e: 'sector-hover', payload: SectorHoverPayload): void
  (e: 'sector-leave', sectorId: string): void
  (e: 'overlay-pointerdown', payload: PlacementOverlay): void
  (e: 'save-poi-pointerdown', payload: SavePoiOverlayItem): void
}>()
const { t, te } = useI18n()
const gameData = useGameDataStore()

const sectorClipId = (clusterId: string, sectorId: string) =>
  `sector-clip-${svgIdSafe(clusterId)}-${svgIdSafe(sectorId)}`
const resolveOwnerColor = (node: { owner_color?: string }, sectorId?: string, clusterId?: string) => {
  if (sectorId && props.sectorOwnerOverride && props.sectorOwnerOverride[sectorId]) {
    const overrideOwner = props.sectorOwnerOverride[sectorId]
    if (props.factionColorMap && props.factionColorMap[overrideOwner]) {
      return props.factionColorMap[overrideOwner]
    }
  }
  if (clusterId && props.clusterOwnerOverride && props.clusterOwnerOverride[clusterId]) {
    const overrideOwner = props.clusterOwnerOverride[clusterId]
    if (props.factionColorMap && props.factionColorMap[overrideOwner]) {
      return props.factionColorMap[overrideOwner]
    }
  }
  return node.owner_color || FALLBACK_OWNER_COLOR
}

const resolveName = (nameId?: string, fallback?: string) => {
  if (nameId && te(nameId)) {
    const translated = t(nameId)
    if (translated && translated !== nameId) return translated
  }
  return fallback || nameId || ''
}

const emitSectorHover = (
  event: MouseEvent,
  payload: Omit<SectorHoverPayload, 'anchorRect'>
) => {
  const rect = (event.currentTarget as SVGGraphicsElement | null)?.getBoundingClientRect()
  if (!rect) return
  emit('sector-hover', {
    ...payload,
    anchorRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  })
}

const emitSectorLeave = (sectorId: string) => {
  emit('sector-leave', sectorId)
}

const placementOverlaysRef = toRef(props, 'placementOverlays')
const placementPreviewRef = toRef(props, 'placementPreview')
const savePoiOverlaysRef = toRef(props, 'savePoiOverlays')
const saveSectorsRef = toRef(props, 'saveSectors')
const viewportContentBoundsRef = toRef(props, 'viewportContentBounds')
const sectorViewportContentBoundsRef = toRef(props, 'sectorViewportContentBounds')
const factionColorMapRef = toRef(props, 'factionColorMap')
const focusedSavePoiKeyRef = toRef(props, 'focusedSavePoiKey')

const {
  clusters,
  sectors,
  regionIds,
  layoutState,
  clipDefs,
  canvasWidth,
  canvasHeight
} = useMapSvgLayout({
  gameData,
  sectorClipId
})

const {
  shouldRenderResourceOverlay,
  sectorFillOpacity,
  sectorStrokeWidth,
  sectorStrokeOpacity,
  sectorLabelFill,
  sectorLabelWeight,
  sectorFilter: sectorFilterState,
  sectorFillColor,
  sectorStrokeColor,
  buildPieSliceGeometries,
  buildResourceGroupBadgeGeometries,
  clusterPolygons,
  sectorLayouts
} = useMapSvgSectors({
  gameData,
  clusters,
  sectors,
  regionIds,
  layoutState,
  searchHighlightedSectorIds: toRef(props, 'searchHighlightedSectorIds'),
  resourceHighlightedSectorIds: toRef(props, 'resourceHighlightedSectorIds'),
  resourceSectorFills: toRef(props, 'resourceSectorFills'),
  resourceSectorGroupBadges: toRef(props, 'resourceSectorGroupBadges'),
  resourceFillColorOverride: toRef(props, 'resourceFillColorOverride'),
  selectedSectorId: toRef(props, 'selectedSectorId'),
  resolveName,
  resolveOwnerColor
})

const sectorFilter = (sectorId: string) => {
  const state = sectorFilterState(sectorId)
  if (state === 'selected') return `url(#${SEARCH_SELECTED_FILTER_ID})`
  if (state === 'search') return `url(#${SEARCH_HIGHLIGHT_FILTER_ID})`
  if (state === 'resource') return `url(#${RESOURCE_HIGHLIGHT_FILTER_ID})`
  return undefined
}

const {
  sectorLinkLines,
  highwaySegments,
  gateCircles,
  crossClusterGateLines
} = useMapSvgLinks({
  clusters,
  sectors,
  saveSectors: saveSectorsRef,
  regionIds,
  layoutState,
  resolveOwnerColor,
  stargateVisualScale: STARGATE_VISUAL_SCALE
})

const {
  overlayScreenItems,
  factionColorFilters,
  savePoiScreenItems,
  previewScreenItem
} = useMapSvgOverlays({
  clusters,
  sectors,
  layoutState,
  placementOverlays: placementOverlaysRef,
  placementPreview: placementPreviewRef,
  savePoiOverlays: savePoiOverlaysRef,
  viewportContentBounds: viewportContentBoundsRef,
  sectorViewportContentBounds: sectorViewportContentBoundsRef,
  minScale: toRef(props, 'minScale'),
  maxScale: toRef(props, 'maxScale'),
  currentScale: toRef(props, 'currentScale'),
  zoomProgress: toRef(props, 'zoomProgress'),
  clusterVisibilityThresholdPx: toRef(props, 'clusterVisibilityThresholdPx'),
  isDragging: toRef(props, 'isDragging'),
  factionColorMap: factionColorMapRef
})

const renderedWidth = computed(() => props.viewportWidth || canvasWidth.value)
const renderedHeight = computed(() => props.viewportHeight || canvasHeight.value)
const renderedViewBox = computed(() => {
  const bounds = props.viewBoxBounds
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    return `${bounds.left.toFixed(1)} ${bounds.top.toFixed(1)} ${bounds.width.toFixed(1)} ${bounds.height.toFixed(1)}`
  }
  return `0 0 ${canvasWidth.value.toFixed(1)} ${canvasHeight.value.toFixed(1)}`
})

const renderedBackgroundRect = computed(() => {
  const bounds = props.viewBoxBounds
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    return {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height
    }
  }
  return {
    x: 0,
    y: 0,
    width: canvasWidth.value,
    height: canvasHeight.value
  }
})

watchEffect(() => {
  emit('content-size', {
    width: canvasWidth.value,
    height: canvasHeight.value,
    clusterRefHeight: layoutState.value.clusterRadius * 2
  })
  emit('sector-layout', sectorLayouts.value)
})
</script>

<template>
  <svg
    class="map-svg"
    :class="{ 'zooming-text-hidden': isZooming }"
    data-testid="map-svg-canvas"
    :width="Math.round(renderedWidth)"
    :height="Math.round(renderedHeight)"
    :viewBox="renderedViewBox"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      :x="renderedBackgroundRect.x.toFixed(1)"
      :y="renderedBackgroundRect.y.toFixed(1)"
      :width="renderedBackgroundRect.width.toFixed(1)"
      :height="renderedBackgroundRect.height.toFixed(1)"
      fill="#050505"
    />
    <defs>
      <filter :id="SEARCH_HIGHLIGHT_FILTER_ID" x="-40%" y="-40%" width="180%" height="180%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="spread" />
        <feGaussianBlur in="spread" stdDeviation="2.4" result="blur" />
        <feFlood flood-color="#fde68a" flood-opacity="0.9" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter :id="RESOURCE_HIGHLIGHT_FILTER_ID" x="-40%" y="-40%" width="180%" height="180%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="spread" />
        <feGaussianBlur in="spread" stdDeviation="2.1" result="blur" />
        <feFlood flood-color="#f472b6" flood-opacity="0.75" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter :id="SEARCH_SELECTED_FILTER_ID" x="-50%" y="-50%" width="200%" height="200%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="spread" />
        <feGaussianBlur in="spread" stdDeviation="3.2" result="blur" />
        <feFlood flood-color="#f59e0b" flood-opacity="1" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter
        v-for="f in factionColorFilters"
        :id="f.id"
        :key="f.id"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feColorMatrix type="matrix" :values="f.matrix" />
      </filter>
      <clipPath v-for="clip in clipDefs" :id="clip.id" :key="clip.id">
        <polygon :points="clip.points" />
      </clipPath>
    </defs>

    <MapLinkLayer
      :visible="showSectorLinks"
      :sector-link-lines="sectorLinkLines"
      :highway-segments="highwaySegments"
      :gate-circles="gateCircles"
      :cross-cluster-gate-lines="crossClusterGateLines"
      :stargate-visual-scale="STARGATE_VISUAL_SCALE"
    />

    <MapSectorLayer
      :cluster-polygons="clusterPolygons"
      :game-data-enforce-dlc-activation="gameData.enforceDlcActivation"
      :sector-label-font-size="SECTOR_LABEL_FONT_SIZE"
      :map-font-family="MAP_FONT_FAMILY"
      :sector-clip-id="sectorClipId"
      :hex-points="hexPoints"
      :should-render-resource-overlay="shouldRenderResourceOverlay"
      :build-pie-slice-geometries="buildPieSliceGeometries"
      :build-resource-group-badge-geometries="buildResourceGroupBadgeGeometries"
      :sector-fill-color="sectorFillColor"
      :sector-fill-opacity="sectorFillOpacity"
      :sector-stroke-color="sectorStrokeColor"
      :sector-stroke-width="sectorStrokeWidth"
      :sector-stroke-opacity="sectorStrokeOpacity"
      :sector-filter="sectorFilter"
      :sector-label-weight="sectorLabelWeight"
      :sector-label-fill="sectorLabelFill"
      :show-sector-labels="showSectorLabels"
      :show-resource-badges="showResourceBadges"
      @sector-hover="emitSectorHover"
      @sector-leave="emitSectorLeave"
    />

    <MapOverlayLayer
      :overlay-screen-items="overlayScreenItems"
      :preview-screen-item="previewScreenItem"
      :save-poi-screen-items="savePoiScreenItems"
      :dragging-overlay-key="draggingOverlayKey"
      :focused-overlay-key="focusedOverlayKey"
      :focused-save-poi-key="focusedSavePoiKeyRef"
      :overlay-icon-size="OVERLAY_ICON_SIZE"
      :preview-icon-size="PREVIEW_ICON_SIZE"
      :placement-icon-href="placementIconHref"
      :get-save-poi-icon-url="getSavePoiIconUrl"
      @overlay-pointerdown="emit('overlay-pointerdown', $event)"
      @save-poi-pointerdown="emit('save-poi-pointerdown', $event)"
    />
  </svg>
</template>

<style scoped>
.map-svg {
  display: block;
  user-select: none;
  pointer-events: none;
}

.map-svg.zooming-text-hidden :deep(.sector-label),
.map-svg.zooming-text-hidden :deep(.resource-badge) {
  display: none;
}
</style>
