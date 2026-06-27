import { computed, type ComputedRef, type Ref } from 'vue'
import { clusterRatioToScreen, sectorPointToLocalRatio, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import { applyRouteLaneOffsets, type RouteLaneOffsetInput } from '@/components/map/utils/routeLaneOffset'
import { buildRouteSectorVisualSegments, type RouteSectorVisualSegment } from '@/components/map/utils/routeSectorSegments'
import type { Cluster, Sector, Vec2 } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'
import type { HubLinkRouteEntry } from '@/store/logic/hubLinkRoutes'
import type { SectorData } from '@/types/saveArchive'
import type { TransitRouteEndpointRef } from '@/store/logic/transitRouteBuilder'
import type { X4MapHighwayRingChain } from '@/types/x4'

export type MapHubLinkRouteLine = {
  id: string
  type: 'line' | 'path'
  start?: Vec2
  end?: Vec2
  d?: string
  color: string
}

type RawMapHubLinkRouteLine = RouteLaneOffsetInput & {
  color: string
}

const FALLBACK_ROUTE_COLOR = '#f8fafc'

export function useMapHubLinkRoutes(args: {
  clusters: ComputedRef<Record<string, Cluster>>
  sectors: ComputedRef<Record<string, Sector>>
  saveSectors?: Ref<Record<string, SectorData> | undefined>
  highwayRingChains?: ComputedRef<X4MapHighwayRingChain[] | undefined>
  layoutState: ComputedRef<MapSvgLayoutState>
  routeEntries: ComputedRef<HubLinkRouteEntry[]> | Ref<HubLinkRouteEntry[]>
}) {
  const routeLines = computed<MapHubLinkRouteLine[]>(() => {
    const rows: RawMapHubLinkRouteLine[] = []
    const { centers, clusterRadius } = args.layoutState.value

    for (const entry of args.routeEntries.value) {
      if (entry.candidates.length === 0) {
        continue
      }
      const color = entry.color || FALLBACK_ROUTE_COLOR
      entry.candidates.forEach((candidate, candidateIndex) => {
        const visualSegments = buildRouteSectorVisualSegments({
          idPrefix: `${entry.id}:${candidateIndex}`,
          routeSectors: candidate.sectors,
          segments: candidate.segments
        })
        visualSegments.forEach((segment) => {
          const start = pointToScreen(args.clusters.value, args.sectors.value, args.saveSectors?.value, centers, clusterRadius, segment.fromSectorId, segment.fromPosition, segment.fromEndpoint)
          const end = pointToScreen(args.clusters.value, args.sectors.value, args.saveSectors?.value, centers, clusterRadius, segment.toSectorId, segment.toPosition, segment.toEndpoint)
          if (start && end) {
            const baseLinkKey = segmentBaseLinkKey(segment, [start, end], args.highwayRingChains?.value)
            rows.push({
              id: segment.id,
              linkId: entry.id,
              baseLinkKey,
              points: [start, end],
              curved: false,
              color
            })
          }
        })
      })
    }

    const offsetRows = applyRouteLaneOffsets(rows)

    return offsetRows.map((line) => ({
      id: line.id,
      type: 'path',
      d: polylinePath(line.points),
      color: line.color
    }))
  })

  return { routeLines }
}

function segmentBaseLinkKey(
  segment: RouteSectorVisualSegment,
  points: Vec2[],
  highwayRingChains: X4MapHighwayRingChain[] | undefined
): string {
  const sectorIds = { fromSectorId: segment.fromSectorId, toSectorId: segment.toSectorId }
  const ringHighwayKey = ringHighwayBaseLinkKey(segment, highwayRingChains)
  if (ringHighwayKey) return ringHighwayKey
  if (segment.kind === 'sector-internal') {
    return `sector-internal:${sectorIds.fromSectorId}:${geometryPairFromSegmentEndpoints(segment, sectorIds) ?? geometryPairKey(points)}`
  }
  if (segment.kind === 'superhighway') {
    return `superhighway:${endpointPairKey(segment.fromEndpoint, segment.toEndpoint, sectorIds)}`
  }
  if (segment.kind === 'gate-transit') {
    return `gate:${endpointPairKey(segment.fromEndpoint, segment.toEndpoint, sectorIds)}`
  }
  return `${segment.kind}:${geometryPairKey(points)}`
}

function ringHighwayBaseLinkKey(
  segment: RouteSectorVisualSegment,
  highwayRingChains: X4MapHighwayRingChain[] | undefined
): string | null {
  if (segment.kind !== 'sector-internal' || !segment.fromSectorId || !highwayRingChains) return null
  for (const chain of highwayRingChains) {
    const hop = chain.hops.find((item) => {
      if (item.sectorId !== segment.fromSectorId) return false
      return segmentMatchesRingGatePair(segment, item.prevGateId, item.nextGateId)
    })
    if (!hop) continue
    const pair = [hop.forwardHighwayId, hop.backwardHighwayId].sort((a, b) => a.localeCompare(b)).join('|')
    return `ring-highway:${segment.fromSectorId}:${pair}`
  }
  return null
}

function segmentMatchesRingGatePair(
  segment: RouteSectorVisualSegment,
  prevGateId: string,
  nextGateId: string
): boolean {
  const fromGateId = sameSectorClusterGateId(segment.fromEndpoint, segment.fromSectorId)
  const toGateId = sameSectorClusterGateId(segment.toEndpoint, segment.toSectorId)
  if (!fromGateId || !toGateId) return false
  if (fromGateId === prevGateId && toGateId === nextGateId) return true
  return fromGateId === nextGateId && toGateId === prevGateId
}

function sameSectorClusterGateId(
  endpoint: TransitRouteEndpointRef | undefined,
  sectorId: string | undefined
): string | null {
  if (endpoint?.kind !== 'cluster-gate') return null
  if (!sectorId) return null
  if (endpoint.sectorMacro !== sectorId) return null
  return endpoint.gateId
}

function geometryPairFromSegmentEndpoints(
  segment: RouteSectorVisualSegment,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined }
): string | null {
  const from = segment.fromPosition
  const to = segment.toPosition
  if (!from || !to) return null
  const first = pointKeyWithSector(sectorIds.fromSectorId, { x: from.x, y: from.z })
  const second = pointKeyWithSector(sectorIds.toSectorId, { x: to.x, y: to.z })
  return [first, second].sort((a, b) => a.localeCompare(b)).join('|')
}

function endpointPairKey(
  fromEndpoint: TransitRouteEndpointRef | undefined,
  toEndpoint: TransitRouteEndpointRef | undefined,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined }
): string {
  const first = endpointKey(fromEndpoint, sectorIds.fromSectorId)
  const second = endpointKey(toEndpoint, sectorIds.toSectorId)
  return [first, second].sort((a, b) => a.localeCompare(b)).join('|')
}

function endpointKey(endpoint: TransitRouteEndpointRef | undefined, sectorId: string | undefined): string {
  if (endpoint?.kind === 'cluster-gate') {
    return `gate:${endpoint.sectorMacro}:${endpoint.gateId}`
  }
  if (endpoint?.kind === 'superhighway') {
    return `superhighway:${endpoint.sectorMacro}:${endpoint.linkId}:${endpoint.zoneId}`
  }
  return `sector:${sectorId ?? 'unknown'}`
}

function geometryPairKey(points: Vec2[]): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 'empty'
  const pair = [pointKey(first), pointKey(last)].sort((a, b) => a.localeCompare(b))
  return `${pair[0]}|${pair[1]}`
}

function pointKey(point: Vec2): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
}

function pointKeyWithSector(sectorId: string | undefined, point: Vec2): string {
  return `${sectorId ?? 'unknown'}:${point.x.toFixed(1)},${point.y.toFixed(1)}`
}

function polylinePath(points: Vec2[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const parts = [`M ${first!.x.toFixed(1)},${first!.y.toFixed(1)}`]
  rest.forEach((point) => {
    parts.push(`L ${point.x.toFixed(1)},${point.y.toFixed(1)}`)
  })
  return parts.join(' ')
}

function pointToScreen(
  clusters: Record<string, Cluster>,
  sectors: Record<string, Sector>,
  saveSectors: Record<string, SectorData> | undefined,
  centers: Record<string, Vec2>,
  clusterRadius: number,
  sectorId: string | undefined,
  point: { x: number; y?: number; z: number } | undefined,
  endpoint?: TransitRouteEndpointRef
): Vec2 | null {
  if (!sectorId || !point) return null
  const sector = sectors[sectorId]
  if (!sector) return null
  const clusterId = sector.cluster_id
  if (!clusterId) return null
  const center = centers[clusterId]
  if (!clusters[clusterId] || !center) return null
  const savedSector = saveSectors?.[sectorId]
  const localRatio = routePointRatio(savedSector, endpoint, point, sector)
  const clusterRatio = sectorRatioToClusterRatio(sector.normalized, localRatio)
  if (!clusterRatio) return null
  return clusterRatioToScreen(center, clusterRadius, clusterRatio)
}

function routePointRatio(
  savedSector: SectorData | undefined,
  endpoint: TransitRouteEndpointRef | undefined,
  point: { x: number; y?: number; z: number },
  sector: Sector
): { x: number; y: number } | null {
  const endpointRatio = savedEndpointRatio(savedSector, endpoint)
  if (endpointRatio) return endpointRatio

  const archiveRatio = savedRawPointRatio(savedSector, point)
  if (archiveRatio) return archiveRatio

  return sectorPointToLocalRatio(sector, point)
}

function savedEndpointRatio(
  savedSector: SectorData | undefined,
  endpoint?: TransitRouteEndpointRef
): { x: number; y: number } | null {
  if (!savedSector || !endpoint) return null
  if (endpoint.kind === 'cluster-gate') {
    const match = (savedSector.clusterGates || []).find((gate) =>
      gate.id === endpoint.gateId &&
      Number.isFinite(gate.position.tx) &&
      Number.isFinite(gate.position.ty)
    )
    if (!match) return null
    return { x: match.position.tx!, y: match.position.ty! }
  }
  const match = (savedSector.superhighwayGates || []).find((gate) =>
    gate.link_id === endpoint.linkId &&
    gate.zone_id === endpoint.zoneId &&
    Number.isFinite(gate.position.tx) &&
    Number.isFinite(gate.position.ty)
  )
  if (!match) return null
  return { x: match.position.tx!, y: match.position.ty! }
}

function savedRawPointRatio(
  savedSector: SectorData | undefined,
  point: { x?: number; z?: number } | undefined
): { x: number; y: number } | null {
  if (!savedSector || !point) return null
  if (!savedSector.center) return null
  if (typeof point.x !== 'number' || typeof point.z !== 'number') return null
  if (typeof savedSector.center.x !== 'number' || typeof savedSector.center.z !== 'number') return null
  if (typeof savedSector.scale_per_radius !== 'number') return null
  if (!Number.isFinite(savedSector.scale_per_radius) || savedSector.scale_per_radius <= 0) return null
  return {
    x: (point.x - savedSector.center.x) * savedSector.scale_per_radius,
    y: -(point.z - savedSector.center.z) * savedSector.scale_per_radius
  }
}
