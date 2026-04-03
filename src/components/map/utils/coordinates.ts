import type { Cluster, Gate, Ratio, Sector, Vec2 } from '../types'

const INNER_CLUSTER_PADDING_2SEC = 0.965
const INNER_CLUSTER_PADDING_3SEC = 0.98
const SECTOR_SCALE_3SEC = 0.97

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

export const gateClusterRatioFromRaw = (gate: Gate, sectorNorm: Sector['normalized']): Ratio | null => {
  const raw = gate.raw_local_pos || {}
  if (raw.sx === undefined || raw.sy === undefined) return null
  return sectorRatioToClusterRatio(sectorNorm, { x: raw.sx, y: raw.sy })
}
