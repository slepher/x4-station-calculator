import type { X4MapCluster, X4MapSector } from '@/types/x4'

export type TransitRoutePoint = {
  sectorMacro: string
  label: string
  position: { x: number; y: number; z: number }
}

export type TransitRouteSegmentKind =
  | 'station-to-gate'
  | 'gate-to-gate'
  | 'gate-transit'
  | 'superhighway'
  | 'highway'
  | 'highway-approach'
  | 'highway-exit'
  | 'gate-to-station'

export type TransitRouteSegment = {
  kind: TransitRouteSegmentKind
  fromLabel: string
  toLabel: string
  distanceKm: number
  countsInSummaryDistance: boolean
  fromPosition?: { x: number; y: number; z: number }
  toPosition?: { x: number; y: number; z: number }
  highwayAlternative?: TransitRouteSegment[]
}

export type TransitRouteTerminal = {
  kind: 'gate' | 'superhighway-exit' | 'station' | 'origin'
  label: string
  sectorMacro: string
  position: { x: number; y: number; z: number }
}

export type TransitRouteSummary = {
  gateCount: number
  normalDistanceKm: number
  superhighwayDistanceKm: number
}

export type TransitRouteResult = {
  summary: TransitRouteSummary
  sectors: string[]
  segments: TransitRouteSegment[]
  terminal: TransitRouteTerminal
  problems: string[]
}

export type TransitRouteTarget =
  | { kind: 'sector'; sectorMacro: string }
  | { kind: 'station'; sectorMacro: string; position: { x: number; y: number; z: number }; label: string }

export type TransitRouteInput = {
  clusters: Record<string, X4MapCluster>
  sectors: Record<string, X4MapSector>
  resolveSectorLabel?: (sector: X4MapSector) => string
  from: {
    sectorMacro: string
    position: { x: number; y: number; z: number }
    label: string
  }
  target: TransitRouteTarget
}

type Edge = {
  kind: 'gate' | 'superhighway'
  fromSector: string
  toSector: string
  from: TransitRoutePoint
  to: TransitRoutePoint
}

type SearchState = {
  sectorMacro: string
  sectors: string[]
  segments: TransitRouteSegment[]
  current: TransitRoutePoint
  gateCount: number
  normalDistanceKm: number
  superhighwayDistanceKm: number
}

const METERS_PER_KM = 1000
const MAX_QUEUE_STATES = 20000

function distanceKm(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / METERS_PER_KM
}

function hasPosition(position: { x?: number; y?: number; z?: number } | undefined): position is { x: number; y: number; z: number } {
  return !!position && Number.isFinite(position.x) && Number.isFinite(position.z)
}

function toPosition(position: { x?: number; y?: number; z?: number } | undefined): { x: number; y: number; z: number } | null {
  if (!hasPosition(position)) return null
  return { x: position.x, y: position.y ?? 0, z: position.z }
}

function compareRoute(a: Pick<SearchState, 'gateCount' | 'normalDistanceKm'>, b: Pick<SearchState, 'gateCount' | 'normalDistanceKm'>): number {
  if (a.gateCount !== b.gateCount) return a.gateCount - b.gateCount
  return a.normalDistanceKm - b.normalDistanceKm
}

function addEdge(graph: Map<string, Edge[]>, edge: Edge) {
  const edges = graph.get(edge.fromSector) ?? []
  if (!edges.some((item) => item.toSector === edge.toSector)) {
    graph.set(edge.fromSector, [...edges, edge])
  }
}

function buildTransitEdgeGraph(
  clusters: Record<string, X4MapCluster>,
  sectors: Record<string, X4MapSector>,
  resolveSectorLabel: (sector: X4MapSector) => string
): { graph: Map<string, Edge[]>; problems: string[] } {
  const graph = new Map<string, Edge[]>()
  const problems: string[] = []
  const sectorsByCluster = new Map<string, string[]>()

  for (const sector of Object.values(sectors)) {
    graph.set(sector.id, graph.get(sector.id) ?? [])
    sectorsByCluster.set(sector.cluster_id, [...(sectorsByCluster.get(sector.cluster_id) ?? []), sector.id])
  }

  for (const sector of Object.values(sectors)) {
    for (const [gateId, gate] of Object.entries(sector.cluster_gates ?? {})) {
      if (!gate.target_cluster_id) continue
      const sourceClusterId = sector.cluster_id
      const targetSectorIds = sectorsByCluster.get(gate.target_cluster_id) ?? []
      for (const targetSectorId of targetSectorIds) {
        const targetSector = sectors[targetSectorId]
        if (!targetSector) continue
        const targetGateEntry = Object.entries(targetSector.cluster_gates ?? {}).find(([, targetGate]) =>
          targetGate.target_cluster_id === sourceClusterId
        )
        if (!targetGateEntry) continue
        const fromPosition = toPosition(gate.raw_local_pos)
        const toPositionValue = toPosition(targetGateEntry[1].raw_local_pos)
        if (!fromPosition || !toPositionValue) {
          problems.push(`gate:${sector.id}:${gateId}`)
          continue
        }
        const from: TransitRoutePoint = { sectorMacro: sector.id, label: resolveSectorLabel(sector), position: fromPosition }
        const to: TransitRoutePoint = { sectorMacro: targetSector.id, label: resolveSectorLabel(targetSector), position: toPositionValue }
        addEdge(graph, { kind: 'gate', fromSector: sector.id, toSector: targetSector.id, from, to })
      }
    }
  }

  for (const cluster of Object.values(clusters)) {
    for (const link of Object.values(cluster.sector_links ?? {})) {
      const sectorA = sectors[link.sector_a_id]
      const sectorB = sectors[link.sector_b_id]
      if (!sectorA || !sectorB || link.render?.lane_count === 1) continue
      const fromPosition = toPosition(sectorA.zones?.[link.from_zone_id ?? '']?.raw_sector_pos)
      const toPositionValue = toPosition(sectorB.zones?.[link.to_zone_id ?? '']?.raw_sector_pos)
      if (!fromPosition || !toPositionValue) {
        problems.push(`superhighway:${link.id}`)
        continue
      }
      const pointA: TransitRoutePoint = { sectorMacro: sectorA.id, label: resolveSectorLabel(sectorA), position: fromPosition }
      const pointB: TransitRoutePoint = { sectorMacro: sectorB.id, label: resolveSectorLabel(sectorB), position: toPositionValue }
      addEdge(graph, { kind: 'superhighway', fromSector: sectorA.id, toSector: sectorB.id, from: pointA, to: pointB })
      addEdge(graph, { kind: 'superhighway', fromSector: sectorB.id, toSector: sectorA.id, from: pointB, to: pointA })
    }
  }

  return { graph, problems }
}

function appendNormalSegment(
  state: SearchState,
  to: TransitRoutePoint,
  kind: TransitRouteSegmentKind
): { segment: TransitRouteSegment | null; distanceKm: number } {
  const distance = distanceKm(state.current.position, to.position)
  if (distance === 0) return { segment: null, distanceKm: 0 }
  return {
    distanceKm: distance,
    segment: {
      kind,
      fromLabel: state.current.label,
      toLabel: to.label,
      distanceKm: distance,
      countsInSummaryDistance: true,
      fromPosition: state.current.position,
      toPosition: to.position
    }
  }
}

function finishRoute(state: SearchState, target: TransitRouteTarget): TransitRouteResult {
  if (target.kind === 'sector') {
    return {
      summary: {
        gateCount: state.gateCount,
        normalDistanceKm: state.normalDistanceKm,
        superhighwayDistanceKm: state.superhighwayDistanceKm
      },
      sectors: state.sectors,
      segments: state.segments,
      terminal: {
        kind: state.current.label === 'origin' ? 'origin' : 'gate',
        label: state.current.label,
        sectorMacro: state.current.sectorMacro,
        position: state.current.position
      },
      problems: []
    }
  }

  const destination: TransitRoutePoint = {
    sectorMacro: target.sectorMacro,
    label: target.label,
    position: target.position
  }
  const appended = appendNormalSegment(state, destination, 'gate-to-station')
  const segments = appended.segment ? [...state.segments, appended.segment] : state.segments
  const normalDistance = state.normalDistanceKm + appended.distanceKm

  return {
    summary: {
      gateCount: state.gateCount,
      normalDistanceKm: normalDistance,
      superhighwayDistanceKm: state.superhighwayDistanceKm
    },
    sectors: state.sectors,
    segments,
    terminal: {
      kind: 'station',
      label: target.label,
      sectorMacro: target.sectorMacro,
      position: target.position
    },
    problems: []
  }
}

export function buildTransitRoute(input: TransitRouteInput): TransitRouteResult {
  const resolveSectorLabel = input.resolveSectorLabel ?? ((sector: X4MapSector) => sector.name || sector.id)
  const graphData = buildTransitEdgeGraph(input.clusters, input.sectors, resolveSectorLabel)
  const sourceSector = input.sectors[input.from.sectorMacro]
  const targetSector = input.sectors[input.target.sectorMacro]

  if (!sourceSector) {
    return { summary: { gateCount: 0, normalDistanceKm: 0, superhighwayDistanceKm: 0 }, sectors: [], segments: [], terminal: { kind: 'origin', label: input.from.label, sectorMacro: input.from.sectorMacro, position: input.from.position }, problems: [`sector:${input.from.sectorMacro}`] }
  }
  if (!targetSector) {
    return { summary: { gateCount: 0, normalDistanceKm: 0, superhighwayDistanceKm: 0 }, sectors: [], segments: [], terminal: { kind: 'origin', label: input.from.label, sectorMacro: input.from.sectorMacro, position: input.from.position }, problems: [`sector:${input.target.sectorMacro}`] }
  }

  const initial: SearchState = {
    sectorMacro: input.from.sectorMacro,
    sectors: [input.from.sectorMacro],
    segments: [],
    current: {
      sectorMacro: input.from.sectorMacro,
      label: input.from.label || 'origin',
      position: input.from.position
    },
    gateCount: 0,
    normalDistanceKm: 0,
    superhighwayDistanceKm: 0
  }

  const queue: SearchState[] = [initial]
  let best: SearchState | null = null
  let iterations = 0

  while (queue.length > 0 && iterations < MAX_QUEUE_STATES) {
    iterations += 1
    queue.sort(compareRoute)
    const state = queue.shift()!
    if (best && compareRoute(state, best) > 0) continue
    if (state.sectorMacro === input.target.sectorMacro) {
      if (!best || compareRoute(state, best) < 0) best = state
      continue
    }

    for (const edge of graphData.graph.get(state.sectorMacro) ?? []) {
      if (state.sectors.includes(edge.toSector)) continue
      const normal = appendNormalSegment(state, edge.from, state.segments.length === 0 ? 'station-to-gate' : 'gate-to-gate')
      const edgeSegments = normal.segment ? [...state.segments, normal.segment] : [...state.segments]
      let gateCount = state.gateCount
      let superhighwayDistanceKm = state.superhighwayDistanceKm

      if (edge.kind === 'gate') {
        gateCount += 1
        edgeSegments.push({
          kind: 'gate-transit',
          fromLabel: edge.from.label,
          toLabel: edge.to.label,
          distanceKm: 0,
          countsInSummaryDistance: false
        })
      } else {
        const highwayDistance = distanceKm(edge.from.position, edge.to.position)
        superhighwayDistanceKm += highwayDistance
        edgeSegments.push({
          kind: 'superhighway',
          fromLabel: edge.from.label,
          toLabel: edge.to.label,
          distanceKm: highwayDistance,
          countsInSummaryDistance: false
        })
      }

      queue.push({
        sectorMacro: edge.toSector,
        sectors: [...state.sectors, edge.toSector],
        segments: edgeSegments,
        current: edge.to,
        gateCount,
        normalDistanceKm: state.normalDistanceKm + normal.distanceKm,
        superhighwayDistanceKm
      })
    }
  }

  if (!best) {
    return {
      summary: { gateCount: 0, normalDistanceKm: 0, superhighwayDistanceKm: 0 },
      sectors: [],
      segments: [],
      terminal: { kind: 'origin', label: input.from.label, sectorMacro: input.from.sectorMacro, position: input.from.position },
      problems: graphData.problems.length > 0 ? graphData.problems : [`route:${input.from.sectorMacro}->${input.target.sectorMacro}`]
    }
  }

  const result = finishRoute(best, input.target)
  const lastSegment = result.segments[result.segments.length - 1]
  if (input.target.kind === 'sector' && lastSegment?.kind === 'superhighway') {
    result.terminal.kind = 'superhighway-exit'
  }
  return result
}
