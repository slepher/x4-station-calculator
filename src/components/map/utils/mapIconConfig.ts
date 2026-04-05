import type { SavePoiOverlayItem } from '@/types/saveArchive'

export const MAP_ICON_SIZES = {
  placement: 18,
  preview: 20,
  savePoiLarge: 18,
  savePoiSmall: 9
} as const

export const MAP_LINK_ICON_SIZES = {
  superhighwayStart: 4.2,
  superhighwayEnd: 3.15,
  gateDiameterMultiplier: 6,
  crossLinkStroke: 0.6
} as const

export const MAP_STARGATE_VISUAL_SCALE = 1.5
export const MAP_LARGE_POI_MAX_CLUSTER_SCALE = 0.5

const LARGE_SAVE_POI_TAGS = ['shipyard', 'wharf', 'tradestation', 'equipmentdock', 'playerhq', 'hive', 'nest', 'piratebase']

export function isLargeMapSavePoiIcon(poi: SavePoiOverlayItem): boolean {
  if (poi.owner === 'player' && poi.is_headquarter) {
    return true
  }
  return Boolean(poi.tag && LARGE_SAVE_POI_TAGS.includes(poi.tag))
}

export function getMapSavePoiBaseIconSize(poi: SavePoiOverlayItem): number {
  return isLargeMapSavePoiIcon(poi) ? MAP_ICON_SIZES.savePoiLarge : MAP_ICON_SIZES.savePoiSmall
}

export function getMapDynamicLargePoiIconSize(args: {
  clusterRadius: number
  currentScale: number
  maxScale: number
}): number {
  const clampedCurrentScale = Math.max(args.currentScale, 0)
  const clampedMaxScale = Math.max(args.maxScale, 1e-6)
  const halfClusterScreenSizeAtThreshold = args.clusterRadius * MAP_LARGE_POI_MAX_CLUSTER_SCALE
  const maxScaleScreenSize = MAP_ICON_SIZES.savePoiLarge * clampedMaxScale
  if (clampedCurrentScale <= MAP_LARGE_POI_MAX_CLUSTER_SCALE) {
    return args.clusterRadius * clampedCurrentScale
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      (clampedCurrentScale - MAP_LARGE_POI_MAX_CLUSTER_SCALE) /
        Math.max(clampedMaxScale - MAP_LARGE_POI_MAX_CLUSTER_SCALE, 1e-6)
    )
  )
  return halfClusterScreenSizeAtThreshold + (maxScaleScreenSize - halfClusterScreenSizeAtThreshold) * progress
}

export function getMapSuperhighwayEndpointIconSize(stargateVisualScale: number, end: 'start' | 'end'): number {
  return (end === 'start' ? MAP_LINK_ICON_SIZES.superhighwayStart : MAP_LINK_ICON_SIZES.superhighwayEnd) * stargateVisualScale
}

export function getMapSuperhighwayEndpointIconOffset(stargateVisualScale: number, end: 'start' | 'end'): number {
  return getMapSuperhighwayEndpointIconSize(stargateVisualScale, end) / 2
}

export function getMapGateRadius(args: {
  sectorCount: number
  stargateVisualScale: number
}): number {
  return (args.sectorCount === 1 ? 1.1 : 0.8) * args.stargateVisualScale
}

export function getMapGateIconDiameter(radius: number): number {
  return radius * MAP_LINK_ICON_SIZES.gateDiameterMultiplier
}

export function getMapCrossLinkStrokeWidth(stargateVisualScale: number): number {
  return MAP_LINK_ICON_SIZES.crossLinkStroke * stargateVisualScale
}
