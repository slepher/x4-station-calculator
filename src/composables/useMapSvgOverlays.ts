import { computed, type ComputedRef, type Ref } from 'vue'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { clusterRatioToScreen, getSectorViewportTransform, sectorPointToLocalRatio, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import {
  OVERLAY_ICON_SIZE,
  SMALL_ICON_SIZE,
  SAVE_POI_COLORS,
  colorToFeColorMatrix,
  isLargeSavePoiIcon,
  shouldHideSavePoiSmallIconAtClusterOverview,
  svgIdSafe
} from '@/components/map/utils/style'
import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { Cluster, PlacementOverlay, PlacementPreview, Sector } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'

const SAVE_POI_VIEWPORT_MARGIN = 24
const LARGE_ICON_MAX_CLUSTER_SCALE = 0.5
const SECTOR_VIEWPORT_MARGIN = 48

export function useMapSvgOverlays(args: {
  clusters: ComputedRef<Record<string, Cluster>>
  layoutState: ComputedRef<MapSvgLayoutState>
  placementOverlays: Ref<PlacementOverlay[]>
  placementPreview: Ref<PlacementPreview | null>
  savePoiOverlays: Ref<SavePoiOverlayItem[]>
  viewportContentBounds: Ref<{
    left: number
    top: number
    right: number
    bottom: number
  } | null>
  minScale: Ref<number>
  maxScale: Ref<number>
  currentScale: Ref<number>
  zoomProgress: Ref<number>
  clusterVisibilityThresholdPx: Ref<number>
  isDragging: Ref<boolean>
  factionColorMap: Ref<Record<string, string> | undefined>
}) {
  const resolveSectorScreenRatio = (sector: Sector, point?: { x: number; z: number } | null) => {
    if (!point) return null
    return sectorRatioToClusterRatio(sector.normalized, sectorPointToLocalRatio(sector, point))
  }

  const buildVisibleSectorKeys = (
    viewportBounds: {
      left: number
      top: number
      right: number
      bottom: number
    } | null,
    centers: Record<string, { x: number; y: number }>,
    clusterRadius: number
  ) => {
    const visibleSectorKeys = new Set<string>()
    if (!viewportBounds) return visibleSectorKeys
    Object.entries(args.clusters.value).forEach(([clusterId, cluster]) => {
      const center = centers[clusterId]
      if (!center) return
      Object.values(cluster.sectors || {}).forEach((sector) => {
        const transform = getSectorViewportTransform(cluster, center, clusterRadius, sector)
        const verticalRadius = transform.sectorRadius * (Math.sqrt(3) / 2)
        const visible =
          transform.center.x + transform.sectorRadius >= viewportBounds.left - SECTOR_VIEWPORT_MARGIN &&
          transform.center.x - transform.sectorRadius <= viewportBounds.right + SECTOR_VIEWPORT_MARGIN &&
          transform.center.y + verticalRadius >= viewportBounds.top - SECTOR_VIEWPORT_MARGIN &&
          transform.center.y - verticalRadius <= viewportBounds.bottom + SECTOR_VIEWPORT_MARGIN
        if (visible) visibleSectorKeys.add(`${clusterId}:${sector.id}`)
      })
    })
    return visibleSectorKeys
  }

  const overlayScreenItems = computed(() => {
    const { centers, clusterRadius } = args.layoutState.value
    return args.placementOverlays.value
      .map((overlay) => {
        const cluster = args.clusters.value[overlay.location.cluster_id]
        const sector = cluster?.sectors?.[overlay.location.sector_id]
        const center = centers[overlay.location.cluster_id]
        if (!cluster || !sector || !center) return null
        const ratio = resolveSectorScreenRatio(sector, overlay.location.pos)
        if (!ratio) return null
        const point = clusterRatioToScreen(center, clusterRadius, ratio)
        return { ...overlay, x: point.x, y: point.y }
      })
      .filter((item): item is PlacementOverlay & { x: number; y: number } => !!item)
  })

  const factionColorFilters = computed<Array<{ id: string; matrix: string }>>(() => {
    const factionColorMap = args.factionColorMap.value
    if (!factionColorMap) return []
    const filters: Array<{ id: string; matrix: string }> = []
    const addedColors = new Set<string>()
    args.savePoiOverlays.value.forEach((poi) => {
      if (!poi.owner) return
      const color = factionColorMap[poi.owner]
      if (!color || addedColors.has(color)) return
      const matrix = colorToFeColorMatrix(color)
      if (!matrix) return
      addedColors.add(color)
      filters.push({ id: `faction-color-${svgIdSafe(color.replace('#', ''))}`, matrix })
    })
    return filters
  })

  const savePoiScreenItems = computed(() => {
    const { centers, clusterRadius } = args.layoutState.value
    const factionColorMap = args.factionColorMap.value
    const viewportBounds = args.viewportContentBounds.value
    const clusterDisplayDiameterPx = clusterRadius * 2 * args.currentScale.value
    const clampedScale = Math.max(args.currentScale.value, 1e-6)
    const halfClusterScreenSizeAtThreshold = clusterRadius * LARGE_ICON_MAX_CLUSTER_SCALE
    const maxScaleScreenSize = OVERLAY_ICON_SIZE * args.maxScale.value
    const largeIconScreenSize = args.currentScale.value <= LARGE_ICON_MAX_CLUSTER_SCALE
      ? clusterRadius * args.currentScale.value
      : halfClusterScreenSizeAtThreshold + (maxScaleScreenSize - halfClusterScreenSizeAtThreshold) * Math.max(
        0,
        Math.min(
          1,
          (args.currentScale.value - LARGE_ICON_MAX_CLUSTER_SCALE) /
            Math.max(args.maxScale.value - LARGE_ICON_MAX_CLUSTER_SCALE, 1e-6)
        )
      )
    const hideConditionalSmallIcons =
      args.clusterVisibilityThresholdPx.value > 0 &&
      clusterDisplayDiameterPx <= args.clusterVisibilityThresholdPx.value
    const visibleSectorKeys = buildVisibleSectorKeys(viewportBounds, centers, clusterRadius)
    const candidatePois = args.savePoiOverlays.value.filter((poi) => {
      if (!viewportBounds || !shouldHideSavePoiSmallIconAtClusterOverview(poi)) return true
      const resolved = resolveMapSectorByMacro(args.clusters.value, poi.sectorMacro)
      if (!resolved) return false
      return visibleSectorKeys.has(`${resolved.clusterId}:${resolved.sector.id}`)
    })

    return candidatePois
      .map((poi) => {
        const resolved = resolveMapSectorByMacro(args.clusters.value, poi.sectorMacro)
        if (!resolved) return null
        const cluster = args.clusters.value[resolved.clusterId]
        const center = centers[resolved.clusterId]
        const sector = resolved.sector as Sector
        const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
        const sectorCenter = sector.normalized?.center_offset_ratio
        if (!center || poi.position.tx === undefined || poi.position.ty === undefined || !sectorCenter || !sectorRadiusRatio) return null
        if (hideConditionalSmallIcons && shouldHideSavePoiSmallIconAtClusterOverview(poi)) return null
        if (viewportBounds && shouldHideSavePoiSmallIconAtClusterOverview(poi) && cluster) {
          if (!visibleSectorKeys.has(`${resolved.clusterId}:${sector.id}`)) return null
        }
        const ratio = sectorRatioToClusterRatio(sector.normalized, {
          x: poi.position.tx,
          y: poi.position.ty
        })
        if (!ratio) return null
        const point = clusterRatioToScreen(center, clusterRadius, ratio)
        if (viewportBounds) {
          const withinX =
            point.x >= viewportBounds.left - SAVE_POI_VIEWPORT_MARGIN &&
            point.x <= viewportBounds.right + SAVE_POI_VIEWPORT_MARGIN
          const withinY =
            point.y >= viewportBounds.top - SAVE_POI_VIEWPORT_MARGIN &&
            point.y <= viewportBounds.bottom + SAVE_POI_VIEWPORT_MARGIN
          if (!withinX || !withinY) return null
        }
        const factionColor = poi.owner && factionColorMap?.[poi.owner] ? factionColorMap[poi.owner] : null
        const iconSize = isLargeSavePoiIcon(poi)
          ? largeIconScreenSize / clampedScale
          : SMALL_ICON_SIZE
        return {
          ...poi,
          x: point.x,
          y: point.y,
          color: SAVE_POI_COLORS[poi.category],
          factionFilterId: factionColor ? `faction-color-${svgIdSafe(factionColor.replace('#', ''))}` : null,
          iconSize
        }
      })
      .filter((item): item is SavePoiOverlayItem & { x: number; y: number; color: string; factionFilterId: string | null; iconSize?: number } => !!item)
  })

  const savePoiDebugStats = computed(() => {
    const { centers, clusterRadius } = args.layoutState.value
    const viewportBounds = args.viewportContentBounds.value
    const clusterDisplayDiameterPx = clusterRadius * 2 * args.currentScale.value
    const hideConditionalSmallIcons =
      args.clusterVisibilityThresholdPx.value > 0 &&
      clusterDisplayDiameterPx <= args.clusterVisibilityThresholdPx.value
    const visibleSectorKeys = buildVisibleSectorKeys(viewportBounds, centers, clusterRadius)
    let participatingPoiCount = 0

    const candidatePois = args.savePoiOverlays.value.filter((poi) => {
      if (!viewportBounds || !shouldHideSavePoiSmallIconAtClusterOverview(poi)) return true
      const resolved = resolveMapSectorByMacro(args.clusters.value, poi.sectorMacro)
      if (!resolved) return false
      return visibleSectorKeys.has(`${resolved.clusterId}:${resolved.sector.id}`)
    })

    candidatePois.forEach((poi) => {
      const resolved = resolveMapSectorByMacro(args.clusters.value, poi.sectorMacro)
      if (!resolved) return
      if (hideConditionalSmallIcons && shouldHideSavePoiSmallIconAtClusterOverview(poi)) return
      participatingPoiCount += 1
    })

    return {
      sectorCount: visibleSectorKeys.size,
      participatingPoiCount
    }
  })

  const previewScreenItem = computed(() => {
    const preview = args.placementPreview.value
    if (!preview) return null
    const cluster = args.clusters.value[preview.location.cluster_id]
    const sector = cluster?.sectors?.[preview.location.sector_id]
    const center = args.layoutState.value.centers[preview.location.cluster_id]
    if (!cluster || !sector || !center) return null
    const ratio = resolveSectorScreenRatio(sector, preview.location.pos)
    if (!ratio) return null
    const point = clusterRatioToScreen(center, args.layoutState.value.clusterRadius, ratio)
    return { ...preview, x: point.x, y: point.y }
  })

  return {
    overlayScreenItems,
    factionColorFilters,
    savePoiScreenItems,
    previewScreenItem,
    savePoiDebugStats
  }
}
