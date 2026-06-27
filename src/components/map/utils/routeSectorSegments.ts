import type { TransitRouteEndpointRef, TransitRouteSegment } from '@/store/logic/transitRouteBuilder'

export type RouteSectorVisualSegmentKind = 'sector-internal' | 'gate-transit' | 'superhighway'

export type RouteSectorVisualSegment = {
  id: string
  kind: RouteSectorVisualSegmentKind
  fromSectorId?: string
  toSectorId?: string
  fromPosition?: { x: number; y?: number; z: number }
  toPosition?: { x: number; y?: number; z: number }
  fromEndpoint?: TransitRouteEndpointRef
  toEndpoint?: TransitRouteEndpointRef
  highwayIds: string[]
  sourceSegmentIndexes: number[]
}

type PendingInternalSegment = RouteSectorVisualSegment & {
  kind: 'sector-internal'
}

export function buildRouteSectorVisualSegments(input: {
  routeSectors: string[]
  segments: TransitRouteSegment[]
  idPrefix: string
}): RouteSectorVisualSegment[] {
  const rows: RouteSectorVisualSegment[] = []
  let pending: PendingInternalSegment | null = null
  let sectorIndex = 0

  input.segments.forEach((segment, segmentIndex) => {
    const sectorIds = segmentSectors(input.routeSectors, sectorIndex, segment)
    if (isCrossSectorSegment(segment, sectorIds)) {
      flushPending()
      rows.push({
        id: `${input.idPrefix}:${segmentIndex}`,
        kind: segment.kind === 'superhighway' ? 'superhighway' : 'gate-transit',
        fromSectorId: sectorIds.fromSectorId,
        toSectorId: sectorIds.toSectorId,
        fromPosition: segment.fromPosition,
        toPosition: segment.toPosition,
        fromEndpoint: segment.fromEndpoint,
        toEndpoint: segment.toEndpoint,
        highwayIds: [],
        sourceSegmentIndexes: [segmentIndex]
      })
      sectorIndex += 1
      return
    }

    if (!sectorIds.fromSectorId || sectorIds.fromSectorId !== sectorIds.toSectorId) {
      flushPending()
      return
    }

    if (!pending || pending.fromSectorId !== sectorIds.fromSectorId) {
      flushPending()
      pending = {
        id: `${input.idPrefix}:${segmentIndex}`,
        kind: 'sector-internal',
        fromSectorId: sectorIds.fromSectorId,
        toSectorId: sectorIds.toSectorId,
        fromPosition: segment.fromPosition,
        toPosition: segment.toPosition,
        fromEndpoint: segment.fromEndpoint,
        toEndpoint: segment.toEndpoint,
        highwayIds: [],
        sourceSegmentIndexes: []
      }
    } else {
      pending.toPosition = segment.toPosition
      pending.toEndpoint = segment.toEndpoint
    }

    if (segment.highwayId) {
      pending.highwayIds.push(segment.highwayId)
    }
    pending.sourceSegmentIndexes.push(segmentIndex)
  })

  flushPending()
  return rows

  function flushPending(): void {
    if (!pending) return
    rows.push(pending)
    pending = null
  }
}

function isCrossSectorSegment(
  segment: TransitRouteSegment,
  sectorIds: { fromSectorId: string | undefined; toSectorId: string | undefined }
): boolean {
  return segment.kind === 'gate-transit' ||
    segment.kind === 'superhighway' ||
    Boolean(sectorIds.fromSectorId && sectorIds.toSectorId && sectorIds.fromSectorId !== sectorIds.toSectorId)
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
