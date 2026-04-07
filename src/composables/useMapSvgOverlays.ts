import { computed, getCurrentScope, hasInjectionContext, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { getActivePinia } from 'pinia'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { clusterRatioToScreen, getSectorViewportTransform, sectorPointToLocalRatio, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import {
  SAVE_POI_COLORS,
  colorToFeColorMatrix,
  shouldHideSavePoiSmallIconAtClusterOverview,
  svgIdSafe
} from '@/components/map/utils/style'
import {
  getMapSavePoiBaseIconSize,
  getMapDynamicLargePoiIconSize,
  isLargeMapSavePoiIcon
} from '@/components/map/utils/mapIconConfig'
import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { Cluster, PlacementOverlay, PlacementPreview, Sector } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'
import { useMapStore } from '@/store/useMapStore'

const SAVE_POI_VIEWPORT_MARGIN = 24
const SECTOR_VIEWPORT_MARGIN = 48
const SECTOR_VIEWPORT_SETTLE_MS = 120

export function useMapSvgOverlays(args: {
  clusters: ComputedRef<Record<string, Cluster>>
  sectors: ComputedRef<Record<string, Sector>>
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
  sectorViewportContentBounds: Ref<{
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
  const sectorViewportBoundsRef = args.sectorViewportContentBounds || args.viewportContentBounds
  const mapStore = hasInjectionContext() && getActivePinia() ? useMapStore() : null
  const settledSectorViewportBounds = ref<{
    left: number
    top: number
    right: number
    bottom: number
  } | null>(null)
  const sectorViewportSettleTimer = ref<number | null>(null)
  const lastLoggedSavePoiDebugKey = ref<string | null>(null)
  const loggedSavePoiDataErrors = new Set<string>()

  const clearSectorViewportSettleTimer = () => {
    if (sectorViewportSettleTimer.value !== null) {
      window.clearTimeout(sectorViewportSettleTimer.value)
      sectorViewportSettleTimer.value = null
    }
  }

  const resolveSectorScreenRatio = (sector: Sector, point?: { x: number; z: number } | null) => {
    if (!point) return null
    return sectorRatioToClusterRatio(sector.normalized, sectorPointToLocalRatio(sector, point))
  }

  const resolveSectorByMacro = (macro: string | null | undefined) =>
    mapStore?.resolveSectorByMacro(macro) || resolveMapSectorByMacro({
      clusters: args.clusters.value,
      sectors: args.sectors.value
    }, macro)

  const logSavePoiDataError = (poi: SavePoiOverlayItem, reason: string) => {
    const key = `${poi.key}:${reason}`
    if (loggedSavePoiDataErrors.has(key)) return
    loggedSavePoiDataErrors.add(key)
    console.error('[MapOverlay][SavePoiData]', reason, {
      key: poi.key,
      code: poi.code,
      category: poi.category,
      sectorMacro: poi.sectorMacro,
      hasTx: poi.position.tx !== undefined,
      hasTy: poi.position.ty !== undefined
    })
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
      ;(cluster.sectors || []).forEach((sectorId) => {
        const sector = args.sectors.value[sectorId]
        if (!sector) return
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

  const isClusterOverview = computed(() => {
    const clusterDisplayDiameterPx = args.layoutState.value.clusterRadius * 2 * args.currentScale.value
    return args.clusterVisibilityThresholdPx.value > 0 &&
      clusterDisplayDiameterPx <= args.clusterVisibilityThresholdPx.value
  })

  const hasConditionalSmallPoi = computed(() =>
    args.savePoiOverlays.value.some((poi) => shouldHideSavePoiSmallIconAtClusterOverview(poi))
  )

  const shouldComputeVisibleSectorKeys = computed(() =>
    !isClusterOverview.value && hasConditionalSmallPoi.value
  )

  watch(
    [sectorViewportBoundsRef, shouldComputeVisibleSectorKeys],
    ([viewportBounds, shouldCompute]) => {
      clearSectorViewportSettleTimer()
      if (!shouldCompute) {
        settledSectorViewportBounds.value = null
        return
      }
      sectorViewportSettleTimer.value = window.setTimeout(() => {
        settledSectorViewportBounds.value = viewportBounds
        sectorViewportSettleTimer.value = null
      }, SECTOR_VIEWPORT_SETTLE_MS)
    },
    { immediate: true }
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearSectorViewportSettleTimer()
    })
  }

  const visibleSectorKeys = computed(() => {
    if (!shouldComputeVisibleSectorKeys.value) return null
    return buildVisibleSectorKeys(
      settledSectorViewportBounds.value,
      args.layoutState.value.centers,
      args.layoutState.value.clusterRadius
    )
  })

  const overlayScreenItems = computed(() => {
    const { centers, clusterRadius } = args.layoutState.value
    return args.placementOverlays.value
      .map((overlay) => {
        const cluster = args.clusters.value[overlay.location.cluster_id]
        const sector = args.sectors.value[overlay.location.sector_id]
        const center = centers[overlay.location.cluster_id]
        if (!cluster || !sector || !center) return null
        const ratio = overlay.localRatio
          ? sectorRatioToClusterRatio(sector.normalized, overlay.localRatio)
          : resolveSectorScreenRatio(sector, overlay.location.pos)
        if (!ratio) return null
        const point = clusterRatioToScreen(center, clusterRadius, ratio)
        return { ...overlay, x: point.x, y: point.y }
      })
      .filter((item): item is PlacementOverlay & { x: number; y: number } => !!item)
  })

  function getVaultFactionId(poi: SavePoiOverlayItem): string | null {
    if (poi.category === 'erlkingVault') {
      return poi.unlocked ? 'player' : 'loanshark'
    }
    if (poi.category === 'datavault') {
      return poi.unlocked ? 'player' : 'kaori'
    }
    return null
  }

  function getPoiFactionId(poi: SavePoiOverlayItem): string | null {
    const vaultFaction = getVaultFactionId(poi)
    if (vaultFaction) return vaultFaction
    return poi.owner || null
  }

  const factionColorFilters = computed<Array<{ id: string; matrix: string }>>(() => {
    const factionColorMap = args.factionColorMap.value
    if (!factionColorMap) return []
    const filters: Array<{ id: string; matrix: string }> = []
    const addedColors = new Set<string>()
    args.savePoiOverlays.value.forEach((poi) => {
      const factionId = getPoiFactionId(poi)
      if (!factionId) return
      const color = factionColorMap[factionId]
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
    const clampedScale = Math.max(args.currentScale.value, 1e-6)
    const largeIconScreenSize = getMapDynamicLargePoiIconSize({
      clusterRadius,
      currentScale: args.currentScale.value,
      maxScale: args.maxScale.value
    })
    const hideConditionalSmallIcons = isClusterOverview.value
    const activeVisibleSectorKeys = visibleSectorKeys.value
    const alwaysVisiblePois = args.savePoiOverlays.value.filter((poi) => !shouldHideSavePoiSmallIconAtClusterOverview(poi))
    const conditionalSmallPois = args.savePoiOverlays.value.filter((poi) => shouldHideSavePoiSmallIconAtClusterOverview(poi))
    const candidatePois = hideConditionalSmallIcons
      ? alwaysVisiblePois
      : [
          ...alwaysVisiblePois,
          ...conditionalSmallPois.filter((poi) => {
            if (!activeVisibleSectorKeys || !viewportBounds) return true
            const resolved = resolveSectorByMacro(poi.sectorMacro)
            if (!resolved) return false
            return activeVisibleSectorKeys.has(`${resolved.clusterId}:${resolved.sector.id}`)
          })
        ]

    return candidatePois
      .map((poi) => {
        const resolved = resolveSectorByMacro(poi.sectorMacro)
        if (!resolved) return null
        const cluster = args.clusters.value[resolved.clusterId]
        const center = centers[resolved.clusterId]
        const sector = resolved.sector as Sector
        const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
        const sectorCenter = sector.normalized?.center_offset_ratio
        if (poi.position.tx === undefined || poi.position.ty === undefined) {
          logSavePoiDataError(poi, 'missing-tx-ty')
          return null
        }
        if (!center || !sectorCenter || !sectorRadiusRatio) {
          logSavePoiDataError(poi, 'missing-sector-layout')
          return null
        }
        if (hideConditionalSmallIcons && shouldHideSavePoiSmallIconAtClusterOverview(poi)) return null
        if (!hideConditionalSmallIcons && activeVisibleSectorKeys && viewportBounds && shouldHideSavePoiSmallIconAtClusterOverview(poi) && cluster) {
          if (!activeVisibleSectorKeys.has(`${resolved.clusterId}:${sector.id}`)) return null
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
        const iconSize = isLargeMapSavePoiIcon(poi)
          ? largeIconScreenSize / clampedScale
          : getMapSavePoiBaseIconSize(poi)

        const factionId = getPoiFactionId(poi)
        const factionColor = factionId && factionColorMap?.[factionId] ? factionColorMap[factionId] : null
        const poiColor = factionColor || SAVE_POI_COLORS[poi.category]
        const poiFilterId = factionColor ? `faction-color-${svgIdSafe(factionColor.replace('#', ''))}` : null

        return {
          ...poi,
          x: point.x,
          y: point.y,
          color: poiColor,
          factionFilterId: poiFilterId,
          iconSize
        }
      })
      .filter((item): item is SavePoiOverlayItem & { x: number; y: number; color: string; factionFilterId: string | null; iconSize: number } => item !== null)
  })

  const savePoiDebugStats = computed(() => {
    const viewportBounds = args.viewportContentBounds.value
    const hideConditionalSmallIcons = isClusterOverview.value
    const activeVisibleSectorKeys = visibleSectorKeys.value
    let participatingPoiCount = 0

    const alwaysVisiblePois = args.savePoiOverlays.value.filter((poi) => !shouldHideSavePoiSmallIconAtClusterOverview(poi))
    const conditionalSmallPois = args.savePoiOverlays.value.filter((poi) => shouldHideSavePoiSmallIconAtClusterOverview(poi))
    const candidatePois = hideConditionalSmallIcons
      ? alwaysVisiblePois
      : [
          ...alwaysVisiblePois,
          ...conditionalSmallPois.filter((poi) => {
            if (!activeVisibleSectorKeys || !viewportBounds) return true
            const resolved = resolveSectorByMacro(poi.sectorMacro)
            if (!resolved) return false
            return activeVisibleSectorKeys.has(`${resolved.clusterId}:${resolved.sector.id}`)
          })
        ]

    candidatePois.forEach((poi) => {
      const resolved = resolveSectorByMacro(poi.sectorMacro)
      if (!resolved) return
      if (hideConditionalSmallIcons && shouldHideSavePoiSmallIconAtClusterOverview(poi)) return
      participatingPoiCount += 1
    })

    const stats = {
      sectorCount: activeVisibleSectorKeys?.size || 0,
      participatingPoiCount
    }
    const logKey = `${stats.sectorCount}:${stats.participatingPoiCount}`
    lastLoggedSavePoiDebugKey.value = logKey
    return stats
  })

  const previewScreenItem = computed(() => {
    const preview = args.placementPreview.value
    if (!preview) return null
    const cluster = args.clusters.value[preview.location.cluster_id]
    const sector = args.sectors.value[preview.location.sector_id]
    const center = args.layoutState.value.centers[preview.location.cluster_id]
    if (!cluster || !sector || !center) return null
    const ratio = preview.localRatio
      ? sectorRatioToClusterRatio(sector.normalized, preview.localRatio)
      : resolveSectorScreenRatio(sector, preview.location.pos)
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
