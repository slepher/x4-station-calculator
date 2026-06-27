import { describe, expect, it } from 'vitest'
import { buildRouteSectorVisualSegments } from '@/components/map/utils/routeSectorSegments'
import type { TransitRouteSegment } from '@/store/logic/transitRouteBuilder'

describe('route sector visual segments', () => {
  it('collapses multiple internal segments in one sector into one entry-to-exit segment', () => {
    const rows = buildRouteSectorVisualSegments({
      idPrefix: 'route:0',
      routeSectors: ['sector-a', 'sector-b'],
      segments: [
        segment('station-to-gate', 'sector-a', 'gate-a', p(0, 0), p(10, 0)),
        segment('gate-to-gate', 'sector-a', 'gate-a', p(10, 0), p(20, 0)),
        segment('highway', 'sector-a', undefined, p(20, 0), p(30, 0), 'highway-a'),
        segment('gate-transit', 'sector-a', 'gate-b', p(30, 0), p(100, 0), undefined, 'sector-b')
      ]
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      kind: 'sector-internal',
      fromSectorId: 'sector-a',
      toSectorId: 'sector-a',
      fromPosition: p(0, 0),
      toPosition: p(30, 0),
      highwayIds: ['highway-a'],
      sourceSegmentIndexes: [0, 1, 2]
    })
    expect(rows[1]).toMatchObject({
      kind: 'gate-transit',
      fromSectorId: 'sector-a',
      toSectorId: 'sector-b',
      sourceSegmentIndexes: [3]
    })
  })

  it('keeps separate internal segments for separate sector visits in one candidate', () => {
    const rows = buildRouteSectorVisualSegments({
      idPrefix: 'route:0',
      routeSectors: ['sector-a', 'sector-b'],
      segments: [
        segment('station-to-gate', 'sector-a', undefined, p(0, 0), p(10, 0)),
        segment('gate-transit', 'sector-a', 'gate-a', p(10, 0), p(100, 0), undefined, 'sector-b'),
        segment('gate-to-station', 'sector-b', undefined, p(100, 0), p(120, 0))
      ]
    })

    expect(rows.map((row) => row.kind)).toEqual(['sector-internal', 'gate-transit', 'sector-internal'])
    expect(rows[2]).toMatchObject({
      fromSectorId: 'sector-b',
      toSectorId: 'sector-b',
      fromPosition: p(100, 0),
      toPosition: p(120, 0)
    })
  })
})

function segment(
  kind: TransitRouteSegment['kind'],
  sectorId: string,
  gateId: string | undefined,
  fromPosition: { x: number; y: number; z: number },
  toPosition: { x: number; y: number; z: number },
  highwayId?: string,
  toSectorId = sectorId
): TransitRouteSegment {
  return {
    kind,
    fromLabel: 'from',
    toLabel: 'to',
    distanceKm: 1,
    countsInSummaryDistance: false,
    fromPosition,
    toPosition,
    fromEndpoint: gateId ? { kind: 'cluster-gate', sectorMacro: sectorId, gateId } : undefined,
    toEndpoint: gateId ? { kind: 'cluster-gate', sectorMacro: toSectorId, gateId: `${gateId}:to` } : undefined,
    highwayId
  }
}

function p(x: number, z: number) {
  return { x, y: 0, z }
}
