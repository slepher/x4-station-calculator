import { computed, type ComputedRef, type Ref } from 'vue'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { clusterRatioToScreen, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import { SAVE_POI_COLORS, colorToFeColorMatrix, svgIdSafe } from '@/components/map/utils/style'
import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { Cluster, PlacementOverlay, PlacementPreview, Sector } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'

export function useMapSvgOverlays(args: {
  clusters: ComputedRef<Record<string, Cluster>>
  layoutState: ComputedRef<MapSvgLayoutState>
  placementOverlays: Ref<PlacementOverlay[]>
  placementPreview: Ref<PlacementPreview | null>
  savePoiOverlays: Ref<SavePoiOverlayItem[]>
  factionColorMap: Ref<Record<string, string> | undefined>
}) {
  const overlayScreenItems = computed(() => {
    const { centers, clusterRadius } = args.layoutState.value
    return args.placementOverlays.value
      .map((overlay) => {
        const cluster = args.clusters.value[overlay.location.cluster_id]
        const sector = cluster?.sectors?.[overlay.location.sector_id]
        const center = centers[overlay.location.cluster_id]
        const scalePerRadius = Number(sector?.normalized?.scale_per_radius || 0)
        const sectorRadiusRatio = Number(sector?.normalized?.sector_radius_ratio || 0)
        const sectorCenter = sector?.normalized?.center_offset_ratio
        if (!cluster || !sector || !center || !scalePerRadius || !sectorCenter || !sectorRadiusRatio) return null
        const ratio = sectorRatioToClusterRatio(sector.normalized, {
          x: overlay.location.pos.x * scalePerRadius,
          y: -overlay.location.pos.z * scalePerRadius
        })
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
    return args.savePoiOverlays.value
      .map((poi) => {
        const resolved = resolveMapSectorByMacro(args.clusters.value, poi.sectorMacro)
        if (!resolved) return null
        const center = centers[resolved.clusterId]
        const sector = resolved.sector as Sector
        const scalePerRadius = Number(sector.normalized?.scale_per_radius || 0)
        const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
        const sectorCenter = sector.normalized?.center_offset_ratio
        if (!center || !scalePerRadius || !sectorCenter || !sectorRadiusRatio) return null
        const ratio = sectorRatioToClusterRatio(sector.normalized, {
          x: poi.pos.x * scalePerRadius,
          y: -poi.pos.z * scalePerRadius
        })
        if (!ratio) return null
        const point = clusterRatioToScreen(center, clusterRadius, ratio)
        const factionColor = poi.owner && factionColorMap?.[poi.owner] ? factionColorMap[poi.owner] : null
        return {
          ...poi,
          x: point.x,
          y: point.y,
          color: SAVE_POI_COLORS[poi.category],
          factionFilterId: factionColor ? `faction-color-${svgIdSafe(factionColor.replace('#', ''))}` : null
        }
      })
      .filter((item): item is SavePoiOverlayItem & { x: number; y: number; color: string; factionFilterId: string | null } => !!item)
  })

  const previewScreenItem = computed(() => {
    const preview = args.placementPreview.value
    if (!preview) return null
    const cluster = args.clusters.value[preview.location.cluster_id]
    const sector = cluster?.sectors?.[preview.location.sector_id]
    const center = args.layoutState.value.centers[preview.location.cluster_id]
    const scalePerRadius = Number(sector?.normalized?.scale_per_radius || 0)
    if (!cluster || !sector || !center || !scalePerRadius) return null
    const ratio = sectorRatioToClusterRatio(sector.normalized, {
      x: preview.location.pos.x * scalePerRadius,
      y: -preview.location.pos.z * scalePerRadius
    })
    if (!ratio) return null
    const point = clusterRatioToScreen(center, args.layoutState.value.clusterRadius, ratio)
    return { ...preview, x: point.x, y: point.y }
  })

  return {
    overlayScreenItems,
    factionColorFilters,
    savePoiScreenItems,
    previewScreenItem
  }
}
