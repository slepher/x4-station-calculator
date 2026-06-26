import { computed, type ComputedRef, type Ref } from 'vue'
import { clusterRatioToScreen, sectorPointToLocalRatio, sectorRatioToClusterRatio } from '@/components/map/utils/coordinates'
import { applyRouteLaneOffsets, type RouteLaneOffsetInput } from '@/components/map/utils/routeLaneOffset'
import type { Cluster, Sector, Vec2 } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'
import type { HubLinkRouteEntry } from '@/store/logic/hubLinkRoutes'
import type { SectorData } from '@/types/saveArchive'
import type { TransitRouteEndpointRef, TransitRouteSegment } from '@/store/logic/transitRouteBuilder'
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
        let sectorIndex = 0
        candidate.segments.forEach((segment, segmentIndex) => {
          const sectorIds = segmentSectors(candidate.sectors, sectorIndex, segment)
          const start = pointToScreen(args.clusters.value, args.sectors.value, args.saveSectors?.value, centers, clusterRadius, sectorIds.fromSectorId, segment.fromPosition, segment.fromEndpoint)
          const end = pointToScreen(args.clusters.value, args.sectors.value, args.saveSectors?.value, centers, clusterRadius, sectorIds.toSectorId, segment.toPosition, segment.toEndpoint)
          if (start && end) {
            rows.push({
              id: `${entry.id}:${candidateIndex}:${segmentIndex}`,
              linkId: entry.id,
              baseLinkKey: segmentBaseLinkKey(segment, sectorIds, [start, end], args.highwayRingChains?.value),
              points: [start, end],
              curved: false,
              color
            })
          }
          if (segment.kind === 'gate-transit' || segment.kind === 'superhighway') {
            sectorIndex += 1
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
  segment: TransitRouteSegment,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined },
  points: Vec2[],
  highwayRingChains: X4MapHighwayRingChain[] | undefined
): string {
  const ringHighwayKey = ringHighwayBaseLinkKey(segment, sectorIds, highwayRingChains)
  if (ringHighwayKey) return ringHighwayKey
  if (isSectorInternalSegment(segment, sectorIds)) {
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
  segment: TransitRouteSegment,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined },
  highwayRingChains: X4MapHighwayRingChain[] | undefined
): string | null {
  if (segment.kind !== 'highway' || !segment.highwayId || !sectorIds.fromSectorId || !highwayRingChains) return null
  for (const chain of highwayRingChains) {
    const hop = chain.hops.find((item) =>
      item.sectorId === sectorIds.fromSectorId &&
      (item.forwardHighwayId === segment.highwayId || item.backwardHighwayId === segment.highwayId)
    )
    if (!hop) continue
    const pair = [hop.forwardHighwayId, hop.backwardHighwayId].sort((a, b) => a.localeCompare(b)).join('|')
    return `ring-highway:${sectorIds.fromSectorId}:${pair}`
  }
  return null
}

function isSectorInternalSegment(
  segment: TransitRouteSegment,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined }
): boolean {
  if (!sectorIds.fromSectorId || sectorIds.fromSectorId !== sectorIds.toSectorId) return false
  return segment.kind !== 'gate-transit' && segment.kind !== 'superhighway'
}

function geometryPairFromSegmentEndpoints(
  segment: TransitRouteSegment,
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

function segmentSectors(
  sectors: string[],
  sectorIndex: number,
  segment: TransitRouteSegment
): { fromSectorId: string | undefined; toSectorId: string | undefined } {
  const current = sectors[sectorIndex]
  const fromEndpointSectorId = segment.fromEndpoint?.sectorMacro
  const toEndpointSectorId = segment.toEndpoint?.sectorMacro
  if (fromEndpointSectorId || toEndpointSectorId) {
    return {
      fromSectorId: fromEndpointSectorId ?? current,
      toSectorId: toEndpointSectorId ?? current
    }
  }
  if (segment.kind === 'gate-transit' || segment.kind === 'superhighway') {
    return {
      fromSectorId: current,
      toSectorId: sectors[sectorIndex + 1] ?? current
    }
  }
  return {
    fromSectorId: current,
    toSectorId: current
  }
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
