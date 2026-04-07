import { computed, type ComputedRef } from 'vue'
import { fitWorldToScreen, computeClusterRadius, minCenterDistance, hexPoints } from '@/components/map/utils/geometry'
import { getSectorViewportTransform } from '@/components/map/utils/coordinates'
import type { Cluster, LayoutConfig, SearchSectorLayout, Sector, Vec2 } from '@/components/map/types'

const SQRT3 = Math.sqrt(3)
const CANVAS_SCALE_FACTOR = 1.8
const HEX_TOP_EDGE_RATIO = SQRT3 / 2

export type MapSvgLayoutState = {
  cfg: LayoutConfig
  fit: { minX: number; minY: number; scale: number; offsetX: number; offsetY: number }
  centers: Record<string, Vec2>
  clusterRadius: number
}

type SectorLayoutSource = {
  sectors: Array<{
    id: string
    clusterId: string
    name: string
    displayName: string
    sx: number
    sy: number
    radius: number
  }>
}

const clusterCenterScreen = (cluster: Cluster, fit: MapSvgLayoutState['fit']): Vec2 => {
  const basis = cluster.normalized?.pixel_basis || { x: 0, y: 0 }
  return {
    x: fit.offsetX + (basis.x - fit.minX) * fit.scale,
    y: fit.offsetY + ((-basis.y) - fit.minY) * fit.scale
  }
}

const scaledLayoutConfig = (cfg: LayoutConfig, factor: number): LayoutConfig => ({
  width: cfg.width * factor,
  height: cfg.height * factor,
  padX: cfg.padX * factor,
  padY: cfg.padY * factor,
  topPad: cfg.topPad * factor
})

export function useMapSvgLayout(args: {
  gameData: {
    maps?: unknown
    enforceDlcActivation: boolean
    isDlcActive: (tag?: string) => boolean
  }
  sectorClipId: (clusterId: string, sectorId: string) => string
  sectorLayoutSource?: ComputedRef<SectorLayoutSource[]>
}) {
  const clusters = computed<Record<string, Cluster>>(() => {
    const all = (args.gameData.maps as unknown as { clusters: Record<string, Cluster> })?.clusters || {}
    if (!args.gameData.enforceDlcActivation) return all
    return Object.fromEntries(
      Object.entries(all).filter(([, cluster]) => args.gameData.isDlcActive(cluster.dlc_tag))
    )
  })

  const sectors = computed<Record<string, Sector>>(() => {
    return (args.gameData.maps as unknown as { sectors: Record<string, Sector> })?.sectors || {}
  })

  const allClusters = computed<Record<string, Cluster>>(() => {
    return (args.gameData.maps as unknown as { clusters: Record<string, Cluster> })?.clusters || {}
  })

  const regionIds = computed(() => Object.keys(clusters.value))

  const layoutState = computed<MapSvgLayoutState>(() => {
    let cfg: LayoutConfig = {
      width: 3600 * CANVAS_SCALE_FACTOR,
      height: 2600 * CANVAS_SCALE_FACTOR,
      padX: 180 * CANVAS_SCALE_FACTOR,
      padY: 180 * CANVAS_SCALE_FACTOR,
      topPad: 140 * CANVAS_SCALE_FACTOR
    }
    const points = Object.values(allClusters.value).map((cluster) => cluster.normalized?.pixel_basis || { x: 0, y: 0 })
    let fit = fitWorldToScreen(points, cfg)
    let centers: Record<string, Vec2> = {}
    Object.entries(allClusters.value).forEach(([clusterId, cluster]) => {
      centers[clusterId] = clusterCenterScreen(cluster, fit)
    })

    const minDistance = minCenterDistance(centers)
    const clusterRadiusInitial = computeClusterRadius(centers)
    const requiredDistance = SQRT3 * clusterRadiusInitial
    if (minDistance < requiredDistance) {
      cfg = scaledLayoutConfig(cfg, requiredDistance / minDistance)
      fit = fitWorldToScreen(points, cfg)
      centers = {}
      Object.entries(allClusters.value).forEach(([clusterId, cluster]) => {
        centers[clusterId] = clusterCenterScreen(cluster, fit)
      })
    }

    return {
      cfg,
      fit,
      centers,
      clusterRadius: computeClusterRadius(centers)
    }
  })

  const clipDefs = computed(() => {
    const defs: Array<{ id: string; points: string }> = []
    const { centers, clusterRadius } = layoutState.value
    regionIds.value.forEach((clusterId) => {
      const cluster = clusters.value[clusterId]
      const center = centers[clusterId]
      if (!cluster || !center) return
      ;(cluster.sectors || []).forEach((sectorId) => {
        const sector = sectors.value[sectorId]
        if (!sector) return
        const transform = getSectorViewportTransform(cluster, center, clusterRadius, sector)
        defs.push({
          id: args.sectorClipId(clusterId, sector.id),
          points: hexPoints(transform.center.x, transform.center.y, transform.sectorRadius)
        })
      })
    })
    return defs
  })

  const canvasWidth = computed(() => layoutState.value.cfg.width)
  const canvasHeight = computed(() => layoutState.value.cfg.height)

  const sectorLayouts = computed<SearchSectorLayout[]>(() =>
    (args.sectorLayoutSource?.value || []).flatMap((cluster) =>
      cluster.sectors.map((sector) => ({
        sectorId: sector.id,
        clusterId: sector.clusterId,
        name: sector.name,
        displayName: sector.displayName,
        centerX: sector.sx,
        centerY: sector.sy,
        radius: sector.radius,
        verticalExtent: sector.radius * HEX_TOP_EDGE_RATIO
      }))
    )
  )

  return {
    clusters,
    sectors,
    allClusters,
    regionIds,
    layoutState,
    clipDefs,
    canvasWidth,
    canvasHeight,
    sectorLayouts
  }
}
