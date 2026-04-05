import type { Cluster, Gate, Ratio, Sector, Vec2 } from '../types'

const INNER_CLUSTER_PADDING_2SEC = 0.965
const INNER_CLUSTER_PADDING_3SEC = 0.98
const SECTOR_SCALE_3SEC = 0.97
const DEFAULT_HEX_INNER_RATIO = Math.sqrt(3) / 2
const DEFAULT_EXTENT_RATIO = 0.8
const SECTOR_CENTER_GRID = 64000

type SectorRawPoint = {
  x?: number
  z?: number
  sx?: number
  sy?: number
} | null | undefined

const snapToSectorCenterGrid = (value: number) => Math.round(value / SECTOR_CENTER_GRID) * SECTOR_CENTER_GRID

export const getSectorZoneBoundingCenter = (sector: Sector) => {
  if (sector.raw_center_pos?.x !== undefined && sector.raw_center_pos?.z !== undefined) {
    return {
      x: sector.raw_center_pos.x,
      z: sector.raw_center_pos.z
    }
  }

  const points = Object.values(sector.zones || {})
    .map((zone) => {
      if (zone.raw_sector_pos?.x !== undefined && zone.raw_sector_pos?.z !== undefined) {
        return { x: zone.raw_sector_pos.x, z: zone.raw_sector_pos.z }
      }
      return null
    })
    .filter((point): point is { x: number; z: number } => point !== null)

  if (!points.length) return { x: 0, z: 0 }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minZ = Math.min(...points.map((point) => point.z))
  const maxZ = Math.max(...points.map((point) => point.z))
  return {
    x: snapToSectorCenterGrid((minX + maxX) / 2),
    z: snapToSectorCenterGrid((minZ + maxZ) / 2)
  }
}

export const sectorPointToLocalRatio = (sector: Sector, point: SectorRawPoint): Ratio | null => {
  if (!point) return null

  const scalePerRadius = getSectorScalePerRadius(sector)
  if (point.x !== undefined && point.z !== undefined && scalePerRadius) {
    const center = getSectorZoneBoundingCenter(sector)
    return {
      x: (point.x - center.x) * scalePerRadius,
      y: -(point.z - center.z) * scalePerRadius
    }
  }

  if (point.sx !== undefined && point.sy !== undefined) {
    return { x: point.sx, y: point.sy }
  }

  return null
}

export const sectorLocalRatioToRawPoint = (sector: Sector, localRatio?: Ratio | null): { x: number; z: number } | null => {
  if (!localRatio) return null

  const scalePerRadius = getSectorScalePerRadius(sector)
  if (!scalePerRadius) return null

  const center = getSectorZoneBoundingCenter(sector)
  return {
    x: center.x + localRatio.x / scalePerRadius,
    z: center.z - localRatio.y / scalePerRadius
  }
}

export const getSectorScalePerRadius = (sector: Sector): number => {
  const normalized = sector.normalized as (Sector['normalized'] & {
    scale_basis?: {
      hex_inner_ratio?: number
      extent_ratio?: number
    }
  }) | undefined

  const points: Array<{ x: number; z: number }> = []
  Object.values(sector.zones || {}).forEach((zone) => {
    if (zone.raw_sector_pos?.x !== undefined && zone.raw_sector_pos?.z !== undefined) {
      points.push({ x: zone.raw_sector_pos.x, z: zone.raw_sector_pos.z })
    }
  })
  Object.values(sector.cluster_gates || {}).forEach((gate) => {
    if (gate.raw_local_pos?.x !== undefined && gate.raw_local_pos?.z !== undefined) {
      points.push({ x: gate.raw_local_pos.x, z: gate.raw_local_pos.z })
    }
  })

  if (!points.length) {
    return Number(normalized?.scale_per_radius || 0)
  }

  const center = getSectorZoneBoundingCenter(sector)
  const maxExtent = Math.max(
    1,
    ...points.map((point) => Math.hypot(point.x - center.x, point.z - center.z))
  )
  const innerRatio = Number(normalized?.scale_basis?.hex_inner_ratio || DEFAULT_HEX_INNER_RATIO)
  const extentRatio = Number(normalized?.scale_basis?.extent_ratio || DEFAULT_EXTENT_RATIO)
  return (innerRatio * extentRatio) / maxExtent
}

export const sectorRatioToClusterRatio = (sectorNorm: Sector['normalized'], localRatio?: Ratio | null): Ratio | null => {
  if (!localRatio) return null
  const center = sectorNorm?.center_offset_ratio
  const radiusRatio = sectorNorm?.sector_radius_ratio
  if (!center || radiusRatio === undefined) return null
  return {
    x: center.x + localRatio.x * radiusRatio,
    y: center.y + localRatio.y * radiusRatio
  }
}

export const clusterRatioToScreen = (center: Vec2, clusterRadius: number, ratio: Ratio): Vec2 => ({
  x: center.x + ratio.x * clusterRadius,
  y: center.y + ratio.y * clusterRadius
})

export const getSectorViewportTransform = (cluster: Cluster, center: Vec2, clusterRadius: number, sector: Sector) => {
  const ratio = sector.normalized?.center_offset_ratio || { x: 0, y: 0 }
  const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
  const sectorCount = Object.keys(cluster.sectors || {}).length
  let innerPadding = 1
  let sectorScale = 1
  if (sectorCount === 2) {
    innerPadding = INNER_CLUSTER_PADDING_2SEC
    sectorScale = INNER_CLUSTER_PADDING_2SEC
  } else if (sectorCount === 3) {
    innerPadding = INNER_CLUSTER_PADDING_3SEC
    sectorScale = INNER_CLUSTER_PADDING_3SEC * SECTOR_SCALE_3SEC
  }

  return {
    center: {
      x: center.x + ratio.x * clusterRadius * innerPadding,
      y: center.y + ratio.y * clusterRadius * innerPadding
    },
    sectorRadius: sectorRadiusRatio * clusterRadius * sectorScale,
    sectorRadiusRatio
  }
}

export const sectorLocalRatioToScreen = (
  cluster: Cluster,
  center: Vec2,
  clusterRadius: number,
  sector: Sector,
  localRatio?: Ratio | null
): Vec2 | null => {
  if (!localRatio) return null
  const transform = getSectorViewportTransform(cluster, center, clusterRadius, sector)
  return {
    x: transform.center.x + localRatio.x * transform.sectorRadius,
    y: transform.center.y + localRatio.y * transform.sectorRadius
  }
}

export const gateClusterRatioFromRaw = (gate: Gate, sector: Sector): Ratio | null => {
  const localRatio = sectorPointToLocalRatio(sector, gate.raw_local_pos)
  return sectorRatioToClusterRatio(sector.normalized, localRatio)
}
