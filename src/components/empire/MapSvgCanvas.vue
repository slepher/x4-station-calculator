<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'

type Vec2 = { x: number; y: number }
type LayoutConfig = { width: number; height: number; padX: number; padY: number; topPad: number }
type FitState = { minX: number; minY: number; scale: number; offsetX: number; offsetY: number }
type Ratio = { x: number; y: number }

type HighwayPoint = { sx?: number; sy?: number }
type Highway = { entry?: HighwayPoint; exit?: HighwayPoint; spline?: HighwayPoint[] }
type Gate = { id?: string; target_cluster_id?: string; raw_local_pos?: { sx?: number; sy?: number } }
type Anchor = { raw_sector_pos?: { sx?: number; sy?: number } }
type SectorLink = {
  id: string
  sector_a_id?: string
  sector_b_id?: string
  from_zone_id?: string
  to_zone_id?: string
  render?: { lane_count?: number; lane_index?: number }
}
type Sector = {
  id: string
  nameId?: string
  name?: string
  owner_color?: string
  normalized?: {
    center_offset_ratio?: Ratio
    sector_radius_ratio?: number
  }
  shcon_anchors?: Record<string, Anchor>
  highways?: Record<string, Highway>
  cluster_gates?: Record<string, Gate>
}
type Cluster = {
  id: string
  nameId?: string
  name?: string
  owner_color?: string
  normalized?: { pixel_basis?: Vec2 }
  sectors?: Record<string, Sector>
  sector_links?: Record<string, SectorLink>
}
type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
}

const FALLBACK_OWNER_COLOR = '#94a3b8'
const SQRT3 = Math.sqrt(3)
const SECTOR_LABEL_FONT_SIZE = 14
const SINGLE_SECTOR_LABEL_FONT_SIZE = 18
const MIN_SECTOR_LABEL_FONT_SIZE = 8
const HEX_TOP_EDGE_RATIO = SQRT3 / 2
const MULTI_SECTOR_LABEL_PAD_RATIO = 0.03
const MULTI_SECTOR_LABEL_PAD_MIN_PX = 2
const MAP_FONT_FAMILY = "Consolas, 'Courier New', monospace"
const CANVAS_SCALE_FACTOR = 1.8
const STARGATE_VISUAL_SCALE = 1.5
const SEARCH_HIGHLIGHT_FILTER_ID = 'map-search-sector-glow'
const RESOURCE_HIGHLIGHT_FILTER_ID = 'map-resource-sector-glow'
const SEARCH_SELECTED_FILTER_ID = 'map-search-sector-selected-glow'

const props = withDefaults(defineProps<{
  searchHighlightedSectorIds?: string[]
  resourceHighlightedSectorIds?: string[]
  resourceFillColorOverride?: string | null
  selectedSectorId?: string | null
}>(), {
  searchHighlightedSectorIds: () => [],
  resourceHighlightedSectorIds: () => [],
  resourceFillColorOverride: null,
  selectedSectorId: null
})

const emit = defineEmits<{
  (e: 'content-size', payload: { width: number; height: number; clusterRefHeight: number }): void
  (e: 'sector-layout', payload: SearchSectorLayout[]): void
}>()
const { t, te } = useI18n()

const svgIdSafe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_')
const sectorClipId = (clusterId: string, sectorId: string) =>
  `sector-clip-${svgIdSafe(clusterId)}-${svgIdSafe(sectorId)}`
const resolveOwnerColor = (node: { owner_color?: string }) => node.owner_color || FALLBACK_OWNER_COLOR

const resolveName = (nameId?: string, fallback?: string) => {
  if (nameId && te(nameId)) {
    const translated = t(nameId)
    if (translated && translated !== nameId) return translated
  }
  return fallback || nameId || ''
}

const hexPoints = (cx: number, cy: number, radius: number) => {
  const points: string[] = []
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index)
    const px = cx + radius * Math.cos(angle)
    const py = cy + radius * Math.sin(angle)
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`)
  }
  return points.join(' ')
}

const hexVertices = (cx: number, cy: number, radius: number): Vec2[] => {
  const vertices: Vec2[] = []
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index)
    vertices.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return vertices
}

const fitWorldToScreen = (points: Vec2[], cfg: LayoutConfig): FitState => {
  const minX = Math.min(...points.map((p) => p.x), 0)
  const maxX = Math.max(...points.map((p) => p.x), 1)
  const minY = Math.min(...points.map((p) => -p.y), 0)
  const maxY = Math.max(...points.map((p) => -p.y), 1)

  const availableW = cfg.width - cfg.padX * 2
  const availableH = cfg.height - cfg.padY * 2 - cfg.topPad
  const worldW = Math.max(maxX - minX, 1)
  const worldH = Math.max(maxY - minY, 1)
  const scale = Math.min(availableW / worldW, availableH / worldH)
  const offsetX = cfg.padX + (availableW - worldW * scale) / 2
  const offsetY = cfg.padY + cfg.topPad + (availableH - worldH * scale) / 2
  return { minX, minY, scale, offsetX, offsetY }
}

const clusterCenterScreen = (cluster: Cluster, fit: FitState): Vec2 => {
  const basis = cluster.normalized?.pixel_basis || { x: 0, y: 0 }
  return {
    x: fit.offsetX + (basis.x - fit.minX) * fit.scale,
    y: fit.offsetY + ((-basis.y) - fit.minY) * fit.scale
  }
}

const minCenterDistance = (centers: Record<string, Vec2>) => {
  const values = Object.values(centers)
  if (values.length < 2) return 1
  let best = Number.POSITIVE_INFINITY
  for (let idx = 0; idx < values.length; idx += 1) {
    for (let j = idx + 1; j < values.length; j += 1) {
      const left = values[idx]!
      const right = values[j]!
      const dist = Math.hypot(left.x - right.x, left.y - right.y)
      if (dist < best) best = dist
    }
  }
  return Number.isFinite(best) ? best : 1
}

const computeClusterRadius = (centers: Record<string, Vec2>) => {
  const minDistance = minCenterDistance(centers)
  return Math.max(82, Math.min(126, minDistance / SQRT3))
}

const scaledLayoutConfig = (cfg: LayoutConfig, factor: number): LayoutConfig => ({
  width: cfg.width * factor,
  height: cfg.height * factor,
  padX: cfg.padX * factor,
  padY: cfg.padY * factor,
  topPad: cfg.topPad * factor
})

const catmullRomToBezierPath = (points: Vec2[]) => {
  if (points.length < 2) return ''
  if (points.length === 2) {
    const p0 = points[0]!
    const p1 = points[1]!
    return `M ${p0.x.toFixed(1)},${p0.y.toFixed(1)} L ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }
  const start = points[0]!
  const path: string[] = [`M ${start.x.toFixed(1)},${start.y.toFixed(1)}`]
  const count = points.length
  for (let index = 0; index < count - 1; index += 1) {
    const p0 = points[index - 1] || points[index]!
    const p1 = points[index]!
    const p2 = points[index + 1]!
    const p3 = points[index + 2] || points[index + 1]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path.push(
      `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    )
  }
  return path.join(' ')
}

const buildHighwayPathPoints = (start: Vec2, end: Vec2, middle: Vec2[], eps = 0.1) => {
  const points: Vec2[] = [start]
  middle.forEach((point) => {
    if (Math.hypot(point.x - start.x, point.y - start.y) <= eps) return
    if (Math.hypot(point.x - end.x, point.y - end.y) <= eps) return
    points.push(point)
  })
  points.push(end)
  const deduped: Vec2[] = []
  points.forEach((point) => {
    if (!deduped.length) {
      deduped.push(point)
      return
    }
    const prev = deduped[deduped.length - 1]
    if (!prev) return
    if (Math.hypot(point.x - prev.x, point.y - prev.y) > eps) deduped.push(point)
  })
  return deduped
}

const clipSegmentToConvexPolygon = (p0: Vec2, p1: Vec2, polygon: Vec2[]): [Vec2, Vec2] | null => {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  let tEnter = 0
  let tLeave = 1
  const eps = 1e-9

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    if (!a || !b) continue
    const ex = b.x - a.x
    const ey = b.y - a.y

    const c = ex * (p0.y - a.y) - ey * (p0.x - a.x)
    const d = ex * dy - ey * dx
    const n = -c

    if (Math.abs(d) <= eps) {
      if (c < -eps) return null
      continue
    }

    const t = n / d
    if (d > 0) tEnter = Math.max(tEnter, t)
    else tLeave = Math.min(tLeave, t)
    if (tEnter - tLeave > eps) return null
  }

  return [
    { x: p0.x + dx * tEnter, y: p0.y + dy * tEnter },
    { x: p0.x + dx * tLeave, y: p0.y + dy * tLeave }
  ]
}

const sectorRatioToClusterRatio = (sectorNorm: Sector['normalized'], localRatio?: Ratio | null): Ratio | null => {
  if (!localRatio) return null
  const center = sectorNorm?.center_offset_ratio
  const radiusRatio = sectorNorm?.sector_radius_ratio
  if (!center || radiusRatio === undefined) return null
  return {
    x: center.x + localRatio.x * radiusRatio,
    y: center.y + localRatio.y * radiusRatio
  }
}

const clusterRatioToScreen = (center: Vec2, clusterRadius: number, ratio: Ratio): Vec2 => ({
  x: center.x + ratio.x * clusterRadius,
  y: center.y + ratio.y * clusterRadius
})

const gateClusterRatioFromRaw = (gate: Gate, sectorNorm: Sector['normalized']): Ratio | null => {
  const raw = gate.raw_local_pos || {}
  if (raw.sx === undefined || raw.sy === undefined) return null
  return sectorRatioToClusterRatio(sectorNorm, { x: raw.sx, y: raw.sy })
}

const clusters = computed<Record<string, Cluster>>(() => (mapsData as { clusters: Record<string, Cluster> }).clusters || {})
const regionIds = computed(() => Object.keys(clusters.value))
const searchHighlightedSectorIdSet = computed(() => new Set(props.searchHighlightedSectorIds))
const resourceHighlightedSectorIdSet = computed(() => new Set(props.resourceHighlightedSectorIds))
const isSelectedSector = (sectorId: string) => props.selectedSectorId === sectorId
const isResourceFilterActive = computed(() => Boolean(props.resourceFillColorOverride))
const getSectorVisualState = (sectorId: string) => {
  if (isSelectedSector(sectorId)) return 'selected'
  if (searchHighlightedSectorIdSet.value.has(sectorId)) return 'search'
  if (resourceHighlightedSectorIdSet.value.has(sectorId)) return 'resource'
  return 'default'
}
const sectorFillOpacity = (sectorId: string) => {
  const state = getSectorVisualState(sectorId)
  if (isResourceFilterActive.value && state === 'default') return 0
  if (state === 'selected') return 0.28
  if (state === 'search') return 0.18
  if (state === 'resource') return 0.15
  return 0.08
}
const sectorStrokeWidth = (sectorId: string, defaultValue: number) => {
  const state = getSectorVisualState(sectorId)
  if (state === 'selected') return defaultValue + 0.9
  if (state === 'search') return defaultValue + 0.45
  if (state === 'resource') return defaultValue + 0.25
  return defaultValue
}
const sectorStrokeOpacity = (sectorId: string, defaultValue: number) => {
  const state = getSectorVisualState(sectorId)
  if (state === 'selected') return 1
  if (state === 'search') return Math.min(1, defaultValue + 0.08)
  if (state === 'resource') return Math.min(1, defaultValue + 0.03)
  return defaultValue
}
const sectorLabelFill = (sectorId: string) => {
  const state = getSectorVisualState(sectorId)
  if (state === 'selected' || state === 'search') return '#fef3c7'
  if (state === 'resource') return '#fce7f3'
  return '#f8fafc'
}
const sectorLabelWeight = (sectorId: string) => getSectorVisualState(sectorId) === 'default' ? 500 : 700
const sectorFilter = (sectorId: string) => {
  if (isSelectedSector(sectorId)) return `url(#${SEARCH_SELECTED_FILTER_ID})`
  if (searchHighlightedSectorIdSet.value.has(sectorId)) return `url(#${SEARCH_HIGHLIGHT_FILTER_ID})`
  if (resourceHighlightedSectorIdSet.value.has(sectorId)) return `url(#${RESOURCE_HIGHLIGHT_FILTER_ID})`
  return undefined
}
const sectorFillColor = (sectorId: string, defaultColor: string) => {
  if (!isResourceFilterActive.value) return defaultColor
  if (resourceHighlightedSectorIdSet.value.has(sectorId)) return props.resourceFillColorOverride || defaultColor
  return 'transparent'
}
const sectorStrokeColor = (sectorId: string, defaultColor: string) => {
  if (!isResourceFilterActive.value) return defaultColor
  if (resourceHighlightedSectorIdSet.value.has(sectorId)) return props.resourceFillColorOverride || defaultColor
  return defaultColor
}

const regionClusters = computed<Record<string, Cluster>>(() => {
  const out: Record<string, Cluster> = {}
  regionIds.value.forEach((id) => {
    const cluster = clusters.value[id]
    if (cluster) out[id] = cluster
  })
  return out
})

const layoutState = computed(() => {
  let cfg: LayoutConfig = {
    width: 3600 * CANVAS_SCALE_FACTOR,
    height: 2600 * CANVAS_SCALE_FACTOR,
    padX: 180 * CANVAS_SCALE_FACTOR,
    padY: 180 * CANVAS_SCALE_FACTOR,
    topPad: 140 * CANVAS_SCALE_FACTOR
  }
  const points = Object.values(regionClusters.value).map((cluster) => cluster.normalized?.pixel_basis || { x: 0, y: 0 })
  let fit = fitWorldToScreen(points, cfg)
  let centers: Record<string, Vec2> = {}
  Object.entries(regionClusters.value).forEach(([clusterId, cluster]) => {
    centers[clusterId] = clusterCenterScreen(cluster, fit)
  })

  const minDistance = minCenterDistance(centers)
  const clusterRadiusInitial = computeClusterRadius(centers)
  const requiredDistance = SQRT3 * clusterRadiusInitial
  if (minDistance < requiredDistance) {
    cfg = scaledLayoutConfig(cfg, requiredDistance / minDistance)
    fit = fitWorldToScreen(points, cfg)
    centers = {}
    Object.entries(regionClusters.value).forEach(([clusterId, cluster]) => {
      centers[clusterId] = clusterCenterScreen(cluster, fit)
    })
  }
  const clusterRadius = computeClusterRadius(centers)
  return { cfg, fit, centers, clusterRadius }
})

const clipDefs = computed(() => {
  const defs: Array<{ id: string; points: string }> = []
  const { centers, clusterRadius } = layoutState.value
  regionIds.value.forEach((clusterId) => {
    const cluster = clusters.value[clusterId]
    if (!cluster) return
    const center = centers[clusterId]
    if (!center) return
    Object.values(cluster.sectors || {}).forEach((sector) => {
      const ratio = sector.normalized?.center_offset_ratio || { x: 0, y: 0 }
      const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
      const sx = center.x + ratio.x * clusterRadius
      const sy = center.y + ratio.y * clusterRadius
      const sectorRadius = sectorRadiusRatio * clusterRadius
      defs.push({
        id: sectorClipId(clusterId, sector.id),
        points: hexPoints(sx, sy, sectorRadius)
      })
    })
  })
  return defs
})

const sectorLinkLines = computed(() => {
  const rows: Array<{ id: string; start: Vec2; end: Vec2 }> = []
  const { centers, clusterRadius } = layoutState.value

  regionIds.value.forEach((clusterId) => {
    const cluster = clusters.value[clusterId]
    if (!cluster) return
    const center = centers[clusterId]
    if (!center) return
    const sectors = cluster.sectors || {}
    Object.values(cluster.sector_links || {}).forEach((link) => {
      const sectorA = sectors[link.sector_a_id || '']
      const sectorB = sectors[link.sector_b_id || '']
      if (!sectorA || !sectorB || !link.from_zone_id || !link.to_zone_id) return
      const fromAnchor = sectorA.shcon_anchors?.[link.from_zone_id]
      const toAnchor = sectorB.shcon_anchors?.[link.to_zone_id]
      const fromRaw = fromAnchor?.raw_sector_pos
      const toRaw = toAnchor?.raw_sector_pos
      const fromRatio = (fromRaw?.sx !== undefined && fromRaw?.sy !== undefined)
        ? { x: fromRaw.sx, y: fromRaw.sy }
        : null
      const toRatio = (toRaw?.sx !== undefined && toRaw?.sy !== undefined)
        ? { x: toRaw.sx, y: toRaw.sy }
        : null
      const startRatio = sectorRatioToClusterRatio(sectorA.normalized, fromRatio)
      const endRatio = sectorRatioToClusterRatio(sectorB.normalized, toRatio)
      if (!startRatio || !endRatio) return

      let start = clusterRatioToScreen(center, clusterRadius, startRatio)
      let end = clusterRatioToScreen(center, clusterRadius, endRatio)

      rows.push({ id: link.id, start, end })
    })
  })

  return rows
})

const highwaySegments = computed(() => {
  const rows: Array<{ id: string; type: 'path' | 'line'; d?: string; start?: Vec2; end?: Vec2; clipId?: string }> = []
  const { centers, clusterRadius } = layoutState.value

  regionIds.value.forEach((clusterId) => {
    const cluster = clusters.value[clusterId]
    if (!cluster) return
    const center = centers[clusterId]
    if (!center) return
    const sectors = cluster.sectors || {}
    Object.values(sectors).forEach((sector) => {
      const ratio = sector.normalized?.center_offset_ratio || { x: 0, y: 0 }
      const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
      const sx = center.x + ratio.x * clusterRadius
      const sy = center.y + ratio.y * clusterRadius
      const sectorRadius = sectorRadiusRatio * clusterRadius
      const sectorHex = hexVertices(sx, sy, sectorRadius)

      Object.entries(sector.highways || {}).forEach(([highwayId, highway]) => {
        const entry = highway.entry
        const exit = highway.exit
        if (!entry || !exit) return
        if (entry.sx === undefined || entry.sy === undefined || exit.sx === undefined || exit.sy === undefined) return

        const centerRatio = sector.normalized?.center_offset_ratio || { x: 0, y: 0 }
        const startRatio: Ratio = { x: centerRatio.x + entry.sx * sectorRadiusRatio, y: centerRatio.y + entry.sy * sectorRadiusRatio }
        const endRatio: Ratio = { x: centerRatio.x + exit.sx * sectorRadiusRatio, y: centerRatio.y + exit.sy * sectorRadiusRatio }
        const start = clusterRatioToScreen(center, clusterRadius, startRatio)
        const end = clusterRatioToScreen(center, clusterRadius, endRatio)

        const middlePoints: Vec2[] = []
        ;(highway.spline || []).forEach((point) => {
          if (point.sx === undefined || point.sy === undefined) return
          middlePoints.push(
            clusterRatioToScreen(center, clusterRadius, {
              x: centerRatio.x + point.sx * sectorRadiusRatio,
              y: centerRatio.y + point.sy * sectorRadiusRatio
            })
          )
        })

        const pathPoints = buildHighwayPathPoints(start, end, middlePoints)
        const clipId = sectorClipId(clusterId, sector.id)
        if (pathPoints.length >= 3) {
          rows.push({
            id: `${sector.id}:${highwayId}:path`,
            type: 'path',
            d: catmullRomToBezierPath(pathPoints),
            clipId
          })
          return
        }
        const clipped = clipSegmentToConvexPolygon(start, end, sectorHex)
        if (!clipped) return
        rows.push({
          id: `${sector.id}:${highwayId}:line`,
          type: 'line',
          start: clipped[0],
          end: clipped[1]
        })
      })
    })
  })
  return rows
})

const clusterPolygons = computed(() => {
  const rows: Array<{
    id: string
    cx: number
    cy: number
    color: string
    clusterRadius: number
    sectors: Array<{
      id: string
      clusterId: string
      name: string
      displayName: string
      sx: number
      sy: number
      radius: number
      color: string
      label: string
      labelY: number
      labelFontSize: number
    }>
    singleLabel?: string
    singleRadius?: number
    singleLabelY?: number
    singleLabelFontSize?: number
  }> = []
  const { centers, clusterRadius } = layoutState.value

  regionIds.value.forEach((clusterId) => {
    const cluster = clusters.value[clusterId]
    if (!cluster) return
    const center = centers[clusterId]
    if (!center) return
    const color = resolveOwnerColor(cluster)
    const sectors: Array<{
      id: string
      clusterId: string
      name: string
      displayName: string
      sx: number
      sy: number
      radius: number
      color: string
      label: string
      labelY: number
      labelFontSize: number
    }> = []
    Object.values(cluster.sectors || {}).forEach((sector) => {
      const ratio = sector.normalized?.center_offset_ratio || { x: 0, y: 0 }
      const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
      const radius = Number(sector.normalized?.sector_radius_ratio || 0) * clusterRadius
      const sx = center.x + ratio.x * clusterRadius
      const sy = center.y + ratio.y * clusterRadius
      const topEdgeY = sy - radius * HEX_TOP_EDGE_RATIO
      const pad = Math.max(MULTI_SECTOR_LABEL_PAD_MIN_PX, radius * MULTI_SECTOR_LABEL_PAD_RATIO)
      const baseLabelY = topEdgeY + pad
      const displayName = resolveName(sector.nameId, sector.name || sector.id)
      sectors.push({
        id: sector.id,
        clusterId,
        name: sector.name || sector.id,
        displayName,
        sx,
        sy,
        radius,
        color: resolveOwnerColor(sector),
        label: displayName,
        labelY: baseLabelY,
        labelFontSize: Math.max(MIN_SECTOR_LABEL_FONT_SIZE, SECTOR_LABEL_FONT_SIZE * sectorRadiusRatio)
      })
    })

    if (sectors.length === 1) {
      const singleRadius = sectors[0]!.radius
      const topEdgeY = center.y - singleRadius * HEX_TOP_EDGE_RATIO
      const pad = Math.max(MULTI_SECTOR_LABEL_PAD_MIN_PX, singleRadius * MULTI_SECTOR_LABEL_PAD_RATIO)
      rows.push({
        id: clusterId,
        cx: center.x,
        cy: center.y,
        color,
        clusterRadius,
        sectors,
        singleLabel: sectors[0]!.label,
        singleRadius,
        singleLabelY: topEdgeY + pad,
        singleLabelFontSize: SINGLE_SECTOR_LABEL_FONT_SIZE
      })
      return
    }

    rows.push({ id: clusterId, cx: center.x, cy: center.y, color, clusterRadius, sectors })
  })
  return rows
})

const gateCircles = computed(() => {
  const rows: Array<{ id: string; point: Vec2; r: number; color: string; clusterId: string; targetClusterId?: string }> = []
  const { centers, clusterRadius } = layoutState.value
  regionIds.value.forEach((clusterId) => {
    const cluster = clusters.value[clusterId]
    if (!cluster) return
    const center = centers[clusterId]
    if (!center) return
    const sectors = Object.values(cluster.sectors || {})
    sectors.forEach((sector) => {
      const sectorColor = resolveOwnerColor(sector)
      Object.entries(sector.cluster_gates || {}).forEach(([gateId, gate]) => {
        const ratio = gateClusterRatioFromRaw(gate, sector.normalized)
        if (!ratio) return
        rows.push({
          id: `${clusterId}:${sector.id}:${gateId}`,
          point: clusterRatioToScreen(center, clusterRadius, ratio),
          r: (sectors.length === 1 ? 1.1 : 0.8) * STARGATE_VISUAL_SCALE,
          color: sectorColor,
          clusterId,
          targetClusterId: gate.target_cluster_id
        })
      })
    })
  })
  return rows
})

const crossClusterGateLines = computed(() => {
  const rows: Array<{ id: string; left: Vec2; right: Vec2 }> = []
  const gateIndex: Record<string, { clusterId: string; targetClusterId?: string; point: Vec2 }> = {}
  gateCircles.value.forEach((gate) => {
    const key = gate.id
    gateIndex[key] = {
      clusterId: gate.clusterId,
      targetClusterId: gate.targetClusterId,
      point: gate.point
    }
  })
  const used = new Set<string>()
  Object.entries(gateIndex).forEach(([gateId, gate]) => {
    if (used.has(gateId)) return
    const reverseId = Object.entries(gateIndex).find(([otherId, other]) =>
      !used.has(otherId) &&
      other.clusterId === gate.targetClusterId &&
      other.targetClusterId === gate.clusterId
    )?.[0]
    if (!reverseId) return
    rows.push({
      id: `${gateId}<->${reverseId}`,
      left: gate.point,
      right: gateIndex[reverseId]?.point || gate.point
    })
    used.add(gateId)
    used.add(reverseId)
  })
  return rows
})

const canvasWidth = computed(() => layoutState.value.cfg.width)
const canvasHeight = computed(() => layoutState.value.cfg.height)
const sectorLayouts = computed<SearchSectorLayout[]>(() =>
  clusterPolygons.value.flatMap((cluster) =>
    cluster.sectors.map((sector) => ({
      sectorId: sector.id,
      clusterId: sector.clusterId,
      name: sector.name,
      displayName: sector.displayName,
      centerX: sector.sx,
      centerY: sector.sy
    }))
  )
)

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
    :width="Math.round(canvasWidth)"
    :height="Math.round(canvasHeight)"
    :viewBox="`0 0 ${canvasWidth.toFixed(1)} ${canvasHeight.toFixed(1)}`"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="100%" height="100%" fill="#050505" />
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
      <clipPath v-for="clip in clipDefs" :id="clip.id" :key="clip.id">
        <polygon :points="clip.points" />
      </clipPath>
    </defs>

    <g class="sector-links">
      <template v-for="link in sectorLinkLines" :key="link.id">
        <line
          :x1="link.start.x.toFixed(1)"
          :y1="link.start.y.toFixed(1)"
          :x2="link.end.x.toFixed(1)"
          :y2="link.end.y.toFixed(1)"
          stroke="#1d4ed8"
          stroke-width="0.4"
          stroke-opacity="0.95"
        />
        <circle :cx="link.start.x.toFixed(1)" :cy="link.start.y.toFixed(1)" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />
        <circle :cx="link.end.x.toFixed(1)" :cy="link.end.y.toFixed(1)" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />
      </template>
    </g>

    <g class="highways">
      <template v-for="segment in highwaySegments" :key="segment.id">
        <path
          v-if="segment.type === 'path'"
          :d="segment.d"
          :clip-path="`url(#${segment.clipId})`"
          fill="none"
          stroke="#0ea5e9"
          stroke-width="0.45"
          stroke-opacity="0.92"
        />
        <line
          v-else
          :x1="segment.start?.x.toFixed(1)"
          :y1="segment.start?.y.toFixed(1)"
          :x2="segment.end?.x.toFixed(1)"
          :y2="segment.end?.y.toFixed(1)"
          stroke="#0ea5e9"
          stroke-width="0.45"
          stroke-opacity="0.92"
        />
      </template>
    </g>

    <g class="clusters">
      <template v-for="cluster in clusterPolygons" :key="cluster.id">
        <polygon
          v-if="cluster.sectors.length === 1"
          :points="hexPoints(cluster.cx, cluster.cy, cluster.singleRadius || 0)"
          :fill="sectorFillColor(cluster.sectors[0]?.id || '', cluster.color)"
          :fill-opacity="sectorFillOpacity(cluster.sectors[0]?.id || '')"
          :stroke="sectorStrokeColor(cluster.sectors[0]?.id || '', cluster.color)"
          :stroke-width="sectorStrokeWidth(cluster.sectors[0]?.id || '', 2.8)"
          :stroke-opacity="sectorStrokeOpacity(cluster.sectors[0]?.id || '', 0.95)"
          :filter="sectorFilter(cluster.sectors[0]?.id || '')"
        />
        <template v-else>
          <polygon
            :points="hexPoints(cluster.cx, cluster.cy, cluster.clusterRadius)"
            fill="none"
            :stroke="cluster.color"
            stroke-width="2.8"
            stroke-opacity="0.95"
          />
          <template v-for="sector in cluster.sectors" :key="sector.id">
            <polygon
              :points="hexPoints(sector.sx, sector.sy, sector.radius)"
              :fill="sectorFillColor(sector.id, sector.color)"
              :fill-opacity="sectorFillOpacity(sector.id)"
              :stroke="sectorStrokeColor(sector.id, sector.color)"
              :stroke-width="sectorStrokeWidth(sector.id, 2.2)"
              :stroke-opacity="sectorStrokeOpacity(sector.id, 0.9)"
              :filter="sectorFilter(sector.id)"
            />
            <text
              :x="sector.sx.toFixed(1)"
              :y="sector.labelY.toFixed(1)"
              text-anchor="middle"
              dominant-baseline="text-before-edge"
              alignment-baseline="text-before-edge"
              :font-size="sector.labelFontSize.toFixed(1)"
              :font-family="MAP_FONT_FAMILY"
              :font-weight="sectorLabelWeight(sector.id)"
              :fill="sectorLabelFill(sector.id)"
            >
              {{ sector.label }}
            </text>
          </template>
        </template>

        <text
          v-if="cluster.sectors.length === 1"
          :x="cluster.cx.toFixed(1)"
          :y="(cluster.singleLabelY || 0).toFixed(1)"
          text-anchor="middle"
          dominant-baseline="text-before-edge"
          alignment-baseline="text-before-edge"
          :font-size="(cluster.singleLabelFontSize || SECTOR_LABEL_FONT_SIZE).toFixed(1)"
          :font-family="MAP_FONT_FAMILY"
          :font-weight="sectorLabelWeight(cluster.sectors[0]?.id || '')"
          :fill="sectorLabelFill(cluster.sectors[0]?.id || '')"
        >
          {{ cluster.singleLabel }}
        </text>
      </template>
    </g>

    <g class="gates">
      <circle
        v-for="gate in gateCircles"
        :key="gate.id"
        :cx="gate.point.x.toFixed(1)"
        :cy="gate.point.y.toFixed(1)"
        :r="gate.r.toFixed(1)"
        :fill="gate.color"
        stroke="#ffffff"
        :stroke-width="(0.3 * STARGATE_VISUAL_SCALE).toFixed(2)"
      />
    </g>

    <g class="cross-links">
      <line
        v-for="line in crossClusterGateLines"
        :key="line.id"
        :x1="line.left.x.toFixed(1)"
        :y1="line.left.y.toFixed(1)"
        :x2="line.right.x.toFixed(1)"
        :y2="line.right.y.toFixed(1)"
        stroke="#e5e7eb"
        :stroke-width="(0.6 * STARGATE_VISUAL_SCALE).toFixed(2)"
        stroke-opacity="0.85"
      />
    </g>
  </svg>
</template>

<style scoped>
.map-svg {
  display: block;
  user-select: none;
  pointer-events: none;
}
</style>
