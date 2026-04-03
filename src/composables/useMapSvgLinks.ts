import { computed, type ComputedRef } from 'vue'
import { buildHighwayPathPoints, catmullRomToBezierPath, clipPolylineToConvexPolygon, hexVertices } from '@/components/map/utils/geometry'
import { clusterRatioToScreen, gateClusterRatioFromRaw, getSectorViewportTransform, sectorLocalRatioToScreen, sectorPointToLocalRatio, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import type { Cluster, Vec2 } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'

export type MapSectorLinkLine = { id: string; start: Vec2; end: Vec2 }
export type MapHighwaySegment = { id: string; type: 'path' | 'line'; d?: string; start?: Vec2; end?: Vec2 }
export type MapGateCircle = { id: string; point: Vec2; r: number; color: string; clusterId: string; targetClusterId?: string }
export type MapCrossClusterGateLine = { id: string; left: Vec2; right: Vec2 }

const GATE_ICON_RADIUS_SCALE = 3
const GATE_LINE_MARGIN = 0.6

export function useMapSvgLinks(args: {
  clusters: ComputedRef<Record<string, Cluster>>
  regionIds: ComputedRef<string[]>
  layoutState: ComputedRef<MapSvgLayoutState>
  resolveOwnerColor: (node: { owner_color?: string }, sectorId?: string, clusterId?: string) => string
  stargateVisualScale: number
}) {
  const sectorLinkLines = computed<MapSectorLinkLine[]>(() => {
    const rows: MapSectorLinkLine[] = []
    const { centers, clusterRadius } = args.layoutState.value

    args.regionIds.value.forEach((clusterId) => {
      const cluster = args.clusters.value[clusterId]
      const center = centers[clusterId]
      if (!cluster || !center) return
      const sectors = cluster.sectors || {}
      Object.values(cluster.sector_links || {}).forEach((link) => {
        const sectorA = sectors[link.sector_a_id || '']
        const sectorB = sectors[link.sector_b_id || '']
        if (!sectorA || !sectorB || !link.from_zone_id || !link.to_zone_id) return
        const fromRaw = sectorA.zones?.[link.from_zone_id]?.raw_sector_pos
        const toRaw = sectorB.zones?.[link.to_zone_id]?.raw_sector_pos
        const fromRatio = sectorPointToLocalRatio(sectorA, fromRaw)
        const toRatio = sectorPointToLocalRatio(sectorB, toRaw)
        const startRatio = sectorRatioToClusterRatio(sectorA.normalized, fromRatio)
        const endRatio = sectorRatioToClusterRatio(sectorB.normalized, toRatio)
        if (!startRatio || !endRatio) return

        rows.push({
          id: link.id,
          start: clusterRatioToScreen(center, clusterRadius, startRatio),
          end: clusterRatioToScreen(center, clusterRadius, endRatio)
        })
      })
    })

    return rows
  })

  const highwaySegments = computed<MapHighwaySegment[]>(() => {
    const rows: MapHighwaySegment[] = []
    const { centers, clusterRadius } = args.layoutState.value

    args.regionIds.value.forEach((clusterId) => {
      const cluster = args.clusters.value[clusterId]
      const center = centers[clusterId]
      if (!cluster || !center) return

      Object.values(cluster.sectors || {}).forEach((sector) => {
        const transform = getSectorViewportTransform(cluster, center, clusterRadius, sector)
        const sectorHex = hexVertices(transform.center.x, transform.center.y, transform.sectorRadius)

        Object.entries(sector.highways || {}).forEach(([highwayId, highway]) => {
          const entry = highway.entry_pos || highway.entry
          const exit = highway.exit_pos || highway.exit
          if (!entry || !exit) return

          const start = sectorLocalRatioToScreen(cluster, center, clusterRadius, sector, sectorPointToLocalRatio(sector, entry))
          const end = sectorLocalRatioToScreen(cluster, center, clusterRadius, sector, sectorPointToLocalRatio(sector, exit))
          if (!start || !end) return

          const middlePoints: Vec2[] = []
          ;((highway.spline || []) as Array<{ x?: number; z?: number; sx?: number; sy?: number }>).forEach((point) => {
            const screenPoint = sectorLocalRatioToScreen(cluster, center, clusterRadius, sector, sectorPointToLocalRatio(sector, point))
            if (screenPoint) middlePoints.push(screenPoint)
          })

          const pathPoints = buildHighwayPathPoints(start, end, middlePoints)
          const visibleChains = clipPolylineToConvexPolygon(pathPoints, sectorHex)
          visibleChains.forEach((chain, index) => {
            if (chain.length >= 3) {
              rows.push({
                id: `${sector.id}:${highwayId}:path:${index}`,
                type: 'path',
                d: catmullRomToBezierPath(chain)
              })
              return
            }
            if (chain.length === 2) {
              rows.push({
                id: `${sector.id}:${highwayId}:line:${index}`,
                type: 'line',
                start: chain[0],
                end: chain[1]
              })
            }
          })
        })
      })
    })

    return rows
  })

  const gateCircles = computed<MapGateCircle[]>(() => {
    const rows: MapGateCircle[] = []
    const { centers, clusterRadius } = args.layoutState.value
    args.regionIds.value.forEach((clusterId) => {
      const cluster = args.clusters.value[clusterId]
      const center = centers[clusterId]
      if (!cluster || !center) return
      const sectors = Object.values(cluster.sectors || {})
      sectors.forEach((sector) => {
        const sectorColor = args.resolveOwnerColor(sector, sector.id, clusterId)
        Object.entries(sector.cluster_gates || {}).forEach(([gateId, gate]) => {
          const ratio = gateClusterRatioFromRaw(gate, sector)
          if (!ratio) return
          rows.push({
            id: `${clusterId}:${sector.id}:${gateId}`,
            point: clusterRatioToScreen(center, clusterRadius, ratio),
            r: (sectors.length === 1 ? 1.1 : 0.8) * args.stargateVisualScale,
            color: sectorColor,
            clusterId,
            targetClusterId: gate.target_cluster_id
          })
        })
      })
    })
    return rows
  })

  const crossClusterGateLines = computed<MapCrossClusterGateLine[]>(() => {
    const rows: MapCrossClusterGateLine[] = []
    const gateIndex: Record<string, { clusterId: string; targetClusterId?: string; point: Vec2; r: number }> = {}
    gateCircles.value.forEach((gate) => {
      gateIndex[gate.id] = {
        clusterId: gate.clusterId,
        targetClusterId: gate.targetClusterId,
        point: gate.point,
        r: gate.r
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
      const reverseGate = gateIndex[reverseId]
      if (!reverseGate) return
      const dx = reverseGate.point.x - gate.point.x
      const dy = reverseGate.point.y - gate.point.y
      const length = Math.hypot(dx, dy)
      if (!length) return
      const ux = dx / length
      const uy = dy / length
      const leftInset = gate.r * GATE_ICON_RADIUS_SCALE + GATE_LINE_MARGIN
      const rightInset = reverseGate.r * GATE_ICON_RADIUS_SCALE + GATE_LINE_MARGIN
      rows.push({
        id: `${gateId}<->${reverseId}`,
        left: {
          x: gate.point.x + ux * leftInset,
          y: gate.point.y + uy * leftInset
        },
        right: {
          x: reverseGate.point.x - ux * rightInset,
          y: reverseGate.point.y - uy * rightInset
        }
      })
      used.add(gateId)
      used.add(reverseId)
    })
    return rows
  })

  return {
    sectorLinkLines,
    highwaySegments,
    gateCircles,
    crossClusterGateLines
  }
}
