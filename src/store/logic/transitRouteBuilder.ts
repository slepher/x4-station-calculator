import type { X4MapCluster, X4MapHighwayRingChain, X4MapHighwayRingChainHop, X4MapSector } from '@/types/x4'

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
  highwayDistanceKm: number
  engineDistanceKm: number
  highwayGateCount: number
  engineGateCount: number
}

export type TransitRouteResult = {
  summary: TransitRouteSummary
  sectors: string[]
  segments: TransitRouteSegment[]
  terminal: TransitRouteTerminal
  problems: string[]
  candidateOrder?: number
}

export type TransitRouteTarget =
  | { kind: 'sector'; sectorMacro: string }
  | { kind: 'station'; sectorMacro: string; position: { x: number; y: number; z: number }; label: string }

export type TransitRouteInput = {
  clusters: Record<string, X4MapCluster>
  sectors: Record<string, X4MapSector>
  highwayRingChains?: X4MapHighwayRingChain[]
  resolveSectorLabel?: (sector: X4MapSector) => string
  from: {
    sectorMacro: string
    position: { x: number; y: number; z: number }
    label: string
  }
  target: TransitRouteTarget
}

export type TransitRouteBuildOptions = {
  maxCandidates?: number
  includeHighwayRingCandidates?: boolean
  multiTargetRouteCache?: Map<string, Map<string, TransitRouteResult>>
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
const GATE_PRUNE_MARGIN = 2
const MAX_ROUTE_GATE_COUNT = 5

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

function compareRouteDistanceFirst(
  a: { summary?: TransitRouteSummary; gateCount?: number; normalDistanceKm?: number; candidateOrder?: number },
  b: { summary?: TransitRouteSummary; gateCount?: number; normalDistanceKm?: number; candidateOrder?: number }
): number {
  const aDistance = a.summary?.normalDistanceKm ?? a.normalDistanceKm ?? 0
  const bDistance = b.summary?.normalDistanceKm ?? b.normalDistanceKm ?? 0
  if (aDistance !== bDistance) return aDistance - bDistance
  const aGateCount = a.summary?.gateCount ?? a.gateCount ?? 0
  const bGateCount = b.summary?.gateCount ?? b.gateCount ?? 0
  if (aGateCount !== bGateCount) return aGateCount - bGateCount
  return (a.candidateOrder ?? 0) - (b.candidateOrder ?? 0)
}

function compareRouteGateFirst(
  a: { gateCount?: number; normalDistanceKm?: number },
  b: { gateCount?: number; normalDistanceKm?: number }
): number {
  const aGateCount = a.gateCount ?? 0
  const bGateCount = b.gateCount ?? 0
  if (aGateCount !== bGateCount) return aGateCount - bGateCount
  return (a.normalDistanceKm ?? 0) - (b.normalDistanceKm ?? 0)
}

function buildTransitRouteSummary(input: {
  gateCount: number
  normalDistanceKm: number
  superhighwayDistanceKm: number
  highwayDistanceKm?: number
  highwayGateCount?: number
}): TransitRouteSummary {
  const highwayDistanceKm = input.highwayDistanceKm ?? 0
  const highwayGateCount = input.highwayGateCount ?? 0
  return {
    gateCount: input.gateCount,
    normalDistanceKm: input.normalDistanceKm,
    superhighwayDistanceKm: input.superhighwayDistanceKm,
    highwayDistanceKm,
    engineDistanceKm: Math.max(0, input.normalDistanceKm - highwayDistanceKm),
    highwayGateCount,
    engineGateCount: Math.max(0, input.gateCount - highwayGateCount)
  }
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

function buildNormalSegment(
  from: TransitRoutePoint,
  to: TransitRoutePoint,
  kind: TransitRouteSegmentKind
): { segment: TransitRouteSegment | null; distanceKm: number } {
  const distance = distanceKm(from.position, to.position)
  if (distance === 0) return { segment: null, distanceKm: 0 }
  return {
    distanceKm: distance,
    segment: {
      kind,
      fromLabel: from.label,
      toLabel: to.label,
      distanceKm: distance,
      countsInSummaryDistance: true,
      fromPosition: from.position,
      toPosition: to.position
    }
  }
}

function finishRoute(state: SearchState, target: TransitRouteTarget): TransitRouteResult {
  if (target.kind === 'sector') {
    return {
      summary: {
        ...buildTransitRouteSummary({
          gateCount: state.gateCount,
          normalDistanceKm: state.normalDistanceKm,
          superhighwayDistanceKm: state.superhighwayDistanceKm
        })
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
      ...buildTransitRouteSummary({
        gateCount: state.gateCount,
        normalDistanceKm: normalDistance,
        superhighwayDistanceKm: state.superhighwayDistanceKm
      })
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

function problemRoute(input: TransitRouteInput, problems: string[]): TransitRouteResult {
  return {
    summary: buildTransitRouteSummary({ gateCount: 0, normalDistanceKm: 0, superhighwayDistanceKm: 0 }),
    sectors: [],
    segments: [],
    terminal: { kind: 'origin', label: input.from.label, sectorMacro: input.from.sectorMacro, position: input.from.position },
    problems
  }
}

function finalizeRoute(result: TransitRouteResult): TransitRouteResult {
  const lastSegment = result.segments[result.segments.length - 1]
  if (result.terminal.kind === 'gate' && lastSegment?.kind === 'superhighway') {
    return {
      ...result,
      terminal: { ...result.terminal, kind: 'superhighway-exit' }
    }
  }
  return result
}

function routePointForGate(
  sectors: Record<string, X4MapSector>,
  sectorId: string,
  gateId: string,
  resolveSectorLabel: (sector: X4MapSector) => string
): TransitRoutePoint | null {
  const sector = sectors[sectorId]
  const gate = sector?.cluster_gates?.[gateId]
  const position = toPosition(gate?.raw_local_pos)
  if (!sector || !position) return null
  return { sectorMacro: sectorId, label: resolveSectorLabel(sector), position }
}

function ringHopIndices(startIndex: number, endIndex: number, length: number, direction: 'forward' | 'backward'): number[] {
  const indices = [startIndex]
  let current = startIndex
  while (current !== endIndex) {
    current = direction === 'forward'
      ? (current + 1) % length
      : (current - 1 + length) % length
    indices.push(current)
    if (indices.length > length) break
  }
  return indices
}

function hopEntryGateId(hop: X4MapHighwayRingChainHop, direction: 'forward' | 'backward'): string {
  return direction === 'forward' ? hop.prevGateId : hop.nextGateId
}

function hopExitGateId(hop: X4MapHighwayRingChainHop, direction: 'forward' | 'backward'): string {
  return direction === 'forward' ? hop.nextGateId : hop.prevGateId
}

function hopHighwayLengthKm(hop: X4MapHighwayRingChainHop, direction: 'forward' | 'backward'): number {
  return direction === 'forward' ? hop.forwardHighwayLengthKm : hop.backwardHighwayLengthKm
}

function buildHighwayRingSegments(input: {
  chain: X4MapHighwayRingChain
  startIndex: number
  endIndex: number
  direction: 'forward' | 'backward'
  sectors: Record<string, X4MapSector>
  resolveSectorLabel: (sector: X4MapSector) => string
}): {
  segments: TransitRouteSegment[]
  sectors: string[]
  highwayDistanceKm: number
  highwayGateCount: number
  exitPoint: TransitRoutePoint
} | null {
  if (input.startIndex === input.endIndex) return null
  const indices = ringHopIndices(input.startIndex, input.endIndex, input.chain.hops.length, input.direction)
  if (indices.length < 2) return null

  const segments: TransitRouteSegment[] = []
  const sectors: string[] = []
  let highwayDistanceKm = 0

  for (let i = 0; i < indices.length; i += 1) {
    const hop = input.chain.hops[indices[i]!]!
    const sector = input.sectors[hop.sectorId]
    if (!sector) return null
    sectors.push(hop.sectorId)

    const entryPoint = routePointForGate(input.sectors, hop.sectorId, hopEntryGateId(hop, input.direction), input.resolveSectorLabel)
    const exitPoint = routePointForGate(input.sectors, hop.sectorId, hopExitGateId(hop, input.direction), input.resolveSectorLabel)
    if (!entryPoint || !exitPoint) return null

    const highwayDistance = hopHighwayLengthKm(hop, input.direction)
    highwayDistanceKm += highwayDistance
    segments.push({
      kind: 'highway',
      fromLabel: entryPoint.label,
      toLabel: exitPoint.label,
      distanceKm: highwayDistance,
      countsInSummaryDistance: false,
      fromPosition: entryPoint.position,
      toPosition: exitPoint.position
    })

    if (i < indices.length - 1) {
      const nextHop = input.chain.hops[indices[i + 1]!]!
      segments.push({
        kind: 'gate-transit',
        fromLabel: exitPoint.label,
        toLabel: input.resolveSectorLabel(input.sectors[nextHop.sectorId]!),
        distanceKm: 0,
        countsInSummaryDistance: false
      })
    }
  }

  const lastHop = input.chain.hops[indices[indices.length - 1]!]!
  const exitPoint = routePointForGate(input.sectors, lastHop.sectorId, hopExitGateId(lastHop, input.direction), input.resolveSectorLabel)
  if (!exitPoint) return null
  return {
    segments,
    sectors,
    highwayDistanceKm,
    highwayGateCount: indices.length - 1,
    exitPoint
  }
}

function buildRoutesFromPointToSectorTargets(
  input: TransitRouteInput,
  from: TransitRouteInput['from'],
  targetSectorMacros: Set<string>,
  graphData: { graph: Map<string, Edge[]>; problems: string[] },
  cache?: Map<string, Map<string, TransitRouteResult>>
): Map<string, TransitRouteResult> {
  const sourceSector = input.sectors[from.sectorMacro]
  if (!sourceSector || targetSectorMacros.size === 0) return new Map()
  const cacheKey = [
    from.sectorMacro,
    from.position.x,
    from.position.y,
    from.position.z,
    [...targetSectorMacros].sort().join(',')
  ].join('|')
  const cached = cache?.get(cacheKey)
  if (cached) return cached

  const initial: SearchState = {
    sectorMacro: from.sectorMacro,
    sectors: [from.sectorMacro],
    segments: [],
    current: {
      sectorMacro: from.sectorMacro,
      label: from.label || 'origin',
      position: from.position
    },
    gateCount: 0,
    normalDistanceKm: 0,
    superhighwayDistanceKm: 0
  }

  const queue: SearchState[] = [initial]
  const results = new Map<string, TransitRouteResult>()
  let iterations = 0
  let bestGateCount = Number.POSITIVE_INFINITY

  while (queue.length > 0 && iterations < MAX_QUEUE_STATES) {
    iterations += 1
    queue.sort(compareRouteGateFirst)
    const state = queue.shift()!
    if (Number.isFinite(bestGateCount) && state.gateCount > bestGateCount) break

    if (targetSectorMacros.has(state.sectorMacro)) {
      const existing = results.get(state.sectorMacro)
      if (!existing || compareRouteGateFirst(state, existing.summary) < 0) {
        results.set(state.sectorMacro, finalizeRoute(finishRoute(state, { kind: 'sector', sectorMacro: state.sectorMacro })))
      }
      if (state.gateCount < bestGateCount) bestGateCount = state.gateCount
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
        if (gateCount > MAX_ROUTE_GATE_COUNT) continue
        if (Number.isFinite(bestGateCount) && gateCount > bestGateCount) continue
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

  cache?.set(cacheKey, results)
  return results
}

function buildRouteFromPointToTarget(
  input: TransitRouteInput,
  point: TransitRoutePoint,
  resolveSectorLabel: (sector: X4MapSector) => string
): TransitRouteResult | null {
  const route = buildTransitRouteCandidates({
    clusters: input.clusters,
    sectors: input.sectors,
    resolveSectorLabel,
    from: {
      sectorMacro: point.sectorMacro,
      position: point.position,
      label: point.label
    },
    target: input.target
  }, { includeHighwayRingCandidates: false })[0]
  if (!route || route.problems.length > 0) return null
  return route
}

type RingStartAccess = {
  index: number
  route: TransitRouteResult
  approachDistanceKm: number
}

type RingTargetAccess = {
  index: number
  bestGateCount: number
  bestDistanceKm: number
}

function betterRingAccess(
  current: { bestGateCount: number; bestDistanceKm: number; index: number } | null,
  next: { bestGateCount: number; bestDistanceKm: number; index: number }
): boolean {
  if (!current) return true
  return next.bestGateCount < current.bestGateCount ||
    (next.bestGateCount === current.bestGateCount && next.bestDistanceKm < current.bestDistanceKm) ||
    (next.bestGateCount === current.bestGateCount && next.bestDistanceKm === current.bestDistanceKm && next.index < current.index)
}

function selectRingStartAccess(
  input: TransitRouteInput,
  chain: X4MapHighwayRingChain,
  preRoutes: Map<string, TransitRouteResult>,
  resolveSectorLabel: (sector: X4MapSector) => string
): RingStartAccess | null {
  let best: RingStartAccess | null = null
  for (let index = 0; index < chain.hops.length; index += 1) {
    const hop = chain.hops[index]!
    const route = preRoutes.get(hop.sectorId)
    if (!route) continue
    let bestApproachDistanceKm = Number.POSITIVE_INFINITY
    for (const direction of ['forward', 'backward'] as const) {
      const entryPoint = routePointForGate(input.sectors, hop.sectorId, hopEntryGateId(hop, direction), resolveSectorLabel)
      if (!entryPoint) continue
      const approach = buildNormalSegment(
        {
          sectorMacro: route.terminal.sectorMacro,
          label: route.terminal.label,
          position: route.terminal.position
        },
        entryPoint,
        route.segments.length === 0 ? 'station-to-gate' : 'gate-to-gate'
      )
      bestApproachDistanceKm = Math.min(bestApproachDistanceKm, approach.distanceKm)
    }
    if (!Number.isFinite(bestApproachDistanceKm)) continue
    const candidate = {
      index,
      route,
      approachDistanceKm: bestApproachDistanceKm,
      bestGateCount: route.summary.gateCount,
      bestDistanceKm: route.summary.normalDistanceKm + bestApproachDistanceKm
    }
    if (betterRingAccess(best ? {
      index: best.index,
      bestGateCount: best.route.summary.gateCount,
      bestDistanceKm: best.route.summary.normalDistanceKm + best.approachDistanceKm
    } : null, candidate)) {
      best = { index, route, approachDistanceKm: bestApproachDistanceKm }
    }
  }
  return best
}

function selectRingTargetAccess(
  chain: X4MapHighwayRingChain,
  targetRoutes: Map<string, TransitRouteResult>
): RingTargetAccess | null {
  let best: RingTargetAccess | null = null
  for (let index = 0; index < chain.hops.length; index += 1) {
    const hop = chain.hops[index]!
    const route = targetRoutes.get(hop.sectorId)
    if (!route) continue
    const candidate = {
      index,
      bestGateCount: route.summary.gateCount,
      bestDistanceKm: route.summary.normalDistanceKm
    }
    if (betterRingAccess(best, candidate)) best = candidate
  }
  return best
}

function targetSourcePoint(input: TransitRouteInput, resolveSectorLabel: (sector: X4MapSector) => string): TransitRouteInput['from'] | null {
  if (input.target.kind === 'station') {
    return {
      sectorMacro: input.target.sectorMacro,
      position: input.target.position,
      label: input.target.label
    }
  }
  const sector = input.sectors[input.target.sectorMacro]
  if (!sector) return null
  const position = toPosition(sector.raw_center_pos) ?? { x: 0, y: 0, z: 0 }
  return {
    sectorMacro: sector.id,
    position,
    label: resolveSectorLabel(sector)
  }
}

function buildHighwayRingRouteCandidates(
  input: TransitRouteInput,
  resolveSectorLabel: (sector: X4MapSector) => string,
  firstCandidateOrder: number,
  graphData: { graph: Map<string, Edge[]>; problems: string[] },
  ordinaryBest: TransitRouteResult | null,
  options?: TransitRouteBuildOptions
): TransitRouteResult[] {
  const chains = input.highwayRingChains ?? []
  if (chains.length === 0) return []
  const candidates: TransitRouteResult[] = []
  let order = firstCandidateOrder

  for (const chain of chains) {
    const ringSectorIds = new Set(chain.hops.map((hop) => hop.sectorId))
    const preRoutes = buildRoutesFromPointToSectorTargets(input, input.from, ringSectorIds, graphData, options?.multiTargetRouteCache)
    const targetSource = targetSourcePoint(input, resolveSectorLabel)
    const targetRoutes = targetSource
      ? buildRoutesFromPointToSectorTargets(input, targetSource, ringSectorIds, graphData, options?.multiTargetRouteCache)
      : new Map<string, TransitRouteResult>()

    const startAccess = selectRingStartAccess(input, chain, preRoutes, resolveSectorLabel)
    if (startAccess && ordinaryBest) {
      const startGateCount = startAccess.route.summary.gateCount
      const startDistanceKm = startAccess.route.summary.normalDistanceKm + startAccess.approachDistanceKm
      if (startGateCount >= ordinaryBest.summary.gateCount && startDistanceKm >= ordinaryBest.summary.normalDistanceKm) {
        continue
      }
    }
    const targetAccess = selectRingTargetAccess(chain, targetRoutes)
    if (!startAccess || !targetAccess) continue
    const startHop = chain.hops[startAccess.index]!
    const preRoute = startAccess.route

    for (const direction of ['forward', 'backward'] as const) {
      const entryPoint = routePointForGate(input.sectors, startHop.sectorId, hopEntryGateId(startHop, direction), resolveSectorLabel)
      if (!entryPoint) continue
      const approach = buildNormalSegment(
        {
          sectorMacro: preRoute.terminal.sectorMacro,
          label: preRoute.terminal.label,
          position: preRoute.terminal.position
        },
        entryPoint,
        preRoute.segments.length === 0 ? 'station-to-gate' : 'gate-to-gate'
      )
      const ring = buildHighwayRingSegments({
        chain,
        startIndex: startAccess.index,
        endIndex: targetAccess.index,
        direction,
        sectors: input.sectors,
        resolveSectorLabel
      })
      if (!ring) continue
      const postPoint = routePointForGate(input.sectors, chain.hops[targetAccess.index]!.sectorId, hopExitGateId(chain.hops[targetAccess.index]!, direction), resolveSectorLabel)
      if (!postPoint) continue
      const postRoute = buildRouteFromPointToTarget(input, postPoint, resolveSectorLabel)
      if (!postRoute) continue

      const approachSegments = approach.segment ? [approach.segment] : []
      const segments = [
        ...preRoute.segments,
        ...approachSegments,
        ...ring.segments,
        ...postRoute.segments
      ]
      const sectorPath = [
        ...preRoute.sectors,
        ...ring.sectors.filter((sectorId) => !preRoute.sectors.includes(sectorId)),
        ...postRoute.sectors.filter((sectorId) => !preRoute.sectors.includes(sectorId) && !ring.sectors.includes(sectorId))
      ]
      const engineDistanceKm = preRoute.summary.engineDistanceKm + approach.distanceKm + postRoute.summary.engineDistanceKm
      const highwayDistanceKm = ring.highwayDistanceKm
      const highwayGateCount = ring.highwayGateCount
      const totalGateCount = preRoute.summary.gateCount + highwayGateCount + postRoute.summary.gateCount
      if (totalGateCount > MAX_ROUTE_GATE_COUNT) continue

      candidates.push({
        summary: buildTransitRouteSummary({
          gateCount: totalGateCount,
          normalDistanceKm: engineDistanceKm + highwayDistanceKm,
          superhighwayDistanceKm: preRoute.summary.superhighwayDistanceKm + postRoute.summary.superhighwayDistanceKm,
          highwayDistanceKm,
          highwayGateCount
        }),
        sectors: sectorPath,
        segments,
        terminal: postRoute.terminal,
        problems: [],
        candidateOrder: order
      })
      order += 1
    }
  }

  return candidates
}

export function buildTransitRouteCandidates(
  input: TransitRouteInput,
  options?: TransitRouteBuildOptions
): TransitRouteResult[] {
  const resolveSectorLabel = input.resolveSectorLabel ?? ((sector: X4MapSector) => sector.name || sector.id)
  const graphData = buildTransitEdgeGraph(input.clusters, input.sectors, resolveSectorLabel)
  const sourceSector = input.sectors[input.from.sectorMacro]
  const targetSector = input.sectors[input.target.sectorMacro]

  if (!sourceSector) {
    return [problemRoute(input, [`sector:${input.from.sectorMacro}`])]
  }
  if (!targetSector) {
    return [problemRoute(input, [`sector:${input.target.sectorMacro}`])]
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
  const candidates: TransitRouteResult[] = []
  let iterations = 0
  let candidateOrder = 0
  let minGateCount = Number.POSITIVE_INFINITY

  while (queue.length > 0 && iterations < MAX_QUEUE_STATES) {
    iterations += 1
    queue.sort(compareRouteDistanceFirst)
    const state = queue.shift()!
    if (Number.isFinite(minGateCount) && state.gateCount > minGateCount + GATE_PRUNE_MARGIN) {
      continue
    }
    if (state.sectorMacro === input.target.sectorMacro) {
      if (state.gateCount < minGateCount) minGateCount = state.gateCount
      candidates.push(finalizeRoute({ ...finishRoute(state, input.target), candidateOrder }))
      candidateOrder += 1
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
        if (gateCount > MAX_ROUTE_GATE_COUNT) continue
        if (Number.isFinite(minGateCount) && gateCount > minGateCount + GATE_PRUNE_MARGIN) {
          continue
        }
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

  if (candidates.length === 0) {
    return [problemRoute(input, graphData.problems.length > 0 ? graphData.problems : [`route:${input.from.sectorMacro}->${input.target.sectorMacro}`])]
  }

  const ordinarySorted = candidates.sort(compareRouteDistanceFirst)
  const ringCandidates = options?.includeHighwayRingCandidates === false
    ? []
    : buildHighwayRingRouteCandidates(input, resolveSectorLabel, candidateOrder, graphData, ordinarySorted[0] ?? null, options)
  const sorted = [...ordinarySorted, ...ringCandidates]
    .map((candidate, index) => ({ ...candidate, candidateOrder: candidate.candidateOrder ?? index }))
    .sort(compareRouteDistanceFirst)
  if (options?.maxCandidates === undefined) return sorted
  return sorted.slice(0, Math.max(1, options.maxCandidates))
}

export function buildTransitRoute(input: TransitRouteInput): TransitRouteResult {
  return buildTransitRouteCandidates(input)[0]!
}
