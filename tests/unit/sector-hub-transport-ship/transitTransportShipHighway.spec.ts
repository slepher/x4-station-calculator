import { describe, expect, it } from 'vitest'
import {
  buildStationTravelEstimate,
  buildTransportTravelEstimate,
  canUseHighway,
  estimateHighwaySegmentTimeSec,
  estimateRouteSegmentsTravel,
  estimateSegmentTravelTimeSec,
  expandHighwayAlternatives,
  filterTransitRouteCandidatesForProfile,
  selectTransitRouteByTravelTime,
  type TransportShipTravelProfile
} from '@/store/logic/transitTransportShip'
import type { TransitRouteResult, TransitRouteSegment } from '@/store/logic/transitRouteBuilder'

function profile(patch: Partial<TransportShipTravelProfile> = {}): TransportShipTravelProfile {
  return {
    blueprintId: 'bp',
    blueprintName: 'Blueprint',
    shipId: 'ship_m',
    shipName: 'Ship M',
    shipClass: 'ship_m',
    containerCapacityM3: 1200,
    baseSpeedMps: 100,
    travelSpeedMps: 2000,
    chargeSec: 1,
    attackSec: 10,
    releaseSec: 2,
    attackDistanceKm: 10.5,
    decelDistanceKm: 2.1,
    engines: [],
    ...patch
  }
}

function normalSegment(distanceKm: number, highwayAlternative?: TransitRouteSegment[]): TransitRouteSegment {
  return {
    kind: 'gate-to-station',
    fromLabel: 'A',
    toLabel: 'B',
    distanceKm,
    countsInSummaryDistance: true,
    highwayAlternative
  }
}

function route(
  distanceKm: number,
  segmentDistanceKm: number,
  candidateOrder: number,
  summaryPatch: Partial<TransitRouteResult['summary']> = {}
): TransitRouteResult {
  return {
    summary: {
      gateCount: candidateOrder + 1,
      normalDistanceKm: distanceKm,
      superhighwayDistanceKm: 0,
      highwayDistanceKm: 0,
      engineDistanceKm: distanceKm,
      highwayGateCount: 0,
      engineGateCount: candidateOrder + 1,
      ...summaryPatch
    },
    sectors: ['a', 'b'],
    segments: [normalSegment(segmentDistanceKm)],
    terminal: { kind: 'gate', label: 'B', sectorMacro: 'b', position: { x: 0, y: 0, z: 0 } },
    problems: [],
    candidateOrder
  }
}

describe('sector-hub-transport-ship highway travel timing', () => {
  it('uses fixed 12km/s highway timing and engine timing for approach/exit', () => {
    const ship = profile()
    const segments: TransitRouteSegment[] = [
      { kind: 'highway-approach', fromLabel: 'A', toLabel: 'A', distanceKm: 10, countsInSummaryDistance: true },
      { kind: 'highway', fromLabel: 'A', toLabel: 'B', distanceKm: 120, countsInSummaryDistance: false },
      { kind: 'highway-exit', fromLabel: 'B', toLabel: 'B', distanceKm: 10, countsInSummaryDistance: true }
    ]

    const travels = estimateRouteSegmentsTravel(segments, ship)

    expect(travels[0]?.timeSec).toBeCloseTo(estimateSegmentTravelTimeSec(10, ship, { skipRelease: true }), 5)
    expect(travels[1]?.timeSec).toBe(10)
    expect(travels[2]?.timeSec).toBeCloseTo(estimateSegmentTravelTimeSec(10, ship), 5)
    expect(estimateHighwaySegmentTimeSec(0)).toBe(0)
  })

  it('allows only S/M ships to use highway alternatives', () => {
    expect(canUseHighway(profile({ shipClass: 'ship_s' }))).toBe(true)
    expect(canUseHighway(profile({ shipClass: 'ship_m' }))).toBe(true)
    expect(canUseHighway(profile({ shipClass: 'ship_l' }))).toBe(false)
    expect(canUseHighway(profile({ shipClass: 'ship_xl' }))).toBe(false)
  })

  it('uses highway alternative when it is faster than direct travel', () => {
    const ship = profile()
    const direct = normalSegment(100, [
      { kind: 'highway', fromLabel: 'A', toLabel: 'B', distanceKm: 100, countsInSummaryDistance: false }
    ])

    const selected = expandHighwayAlternatives([direct], ship)
    const selectedTime = estimateRouteSegmentsTravel(selected, ship)[0]?.timeSec ?? 0
    const directTime = estimateSegmentTravelTimeSec(100, ship)

    expect(selected.map((segment) => segment.kind)).toEqual(['highway'])
    expect(selectedTime).toBeLessThan(directTime)
  })

  it('keeps direct segment when highway alternative is slower', () => {
    const fastShip = profile({
      baseSpeedMps: 1000,
      travelSpeedMps: 200_000,
      chargeSec: 0,
      attackSec: 1,
      releaseSec: 1,
      attackDistanceKm: 1,
      decelDistanceKm: 1
    })
    const direct = normalSegment(100, [
      { kind: 'highway', fromLabel: 'A', toLabel: 'B', distanceKm: 100, countsInSummaryDistance: false }
    ])

    const selected = expandHighwayAlternatives([direct], fastShip)
    const selectedTime = estimateRouteSegmentsTravel(selected, fastShip)[0]?.timeSec ?? 0
    const directTime = estimateSegmentTravelTimeSec(100, fastShip)

    expect(selected.map((segment) => segment.kind)).toEqual(['gate-to-station'])
    expect(selectedTime).toBeCloseTo(directTime, 5)
    expect(estimateHighwaySegmentTimeSec(100)).toBeGreaterThan(directTime)
  })

  it('leaves alternatives unused when no ship is selected and preserves throughput math', () => {
    const direct = normalSegment(100, [
      { kind: 'highway', fromLabel: 'A', toLabel: 'B', distanceKm: 100, countsInSummaryDistance: false }
    ])
    expect(expandHighwayAlternatives([direct])).toEqual([direct])

    const ship = profile({ containerCapacityM3: 3600 })
    expect(buildTransportTravelEstimate(3600, ship)?.throughputM3PerHour).toBe(3600)
    expect(buildStationTravelEstimate({ localTimeSec: 100, sectorTimeSec: 200, profile: ship })?.timeSec).toBeUndefined()
    expect(buildStationTravelEstimate({ localTimeSec: 100, sectorTimeSec: 200, profile: ship })?.totalTimeSec).toBe(300)
  })

  it('selects route candidates by ship travel time before normal distance', () => {
    const ship = profile()
    const shortDistanceSlowRoute = route(10, 100, 0)
    const longerDistanceFastRoute = route(20, 20, 1, { gateCount: 0, engineGateCount: 0 })

    const selected = selectTransitRouteByTravelTime([shortDistanceSlowRoute, longerDistanceFastRoute], ship)

    expect(selected.route).toBe(longerDistanceFastRoute)
    expect(selected.travelTimeSec).toBeLessThan(estimateSegmentTravelTimeSec(100, ship))
  })

  it('breaks equal ship travel time ties by normal distance then enumeration order', () => {
    const ship = profile()
    const first = route(30, 20, 0)
    const second = route(20, 20, 1)
    const third = route(20, 20, 2)

    expect(selectTransitRouteByTravelTime([first, second, third], ship).route).toBe(second)
  })

  it('filters route candidates by ship class before selecting the fastest route', () => {
    const largeShip = profile({ shipClass: 'ship_l' })
    const mediumShip = profile({ shipClass: 'ship_m' })
    const normalGateWinner = route(100, 100, 0, {
      gateCount: 1,
      normalDistanceKm: 100,
      engineDistanceKm: 100,
      engineGateCount: 1
    })
    const highwayEngineWinner = route(120, 5, 1, {
      gateCount: 2,
      normalDistanceKm: 120,
      highwayDistanceKm: 115,
      engineDistanceKm: 5,
      highwayGateCount: 2,
      engineGateCount: 0
    })
    const dominated = route(140, 1, 2, {
      gateCount: 2,
      normalDistanceKm: 140,
      engineDistanceKm: 140,
      engineGateCount: 2
    })

    expect(filterTransitRouteCandidatesForProfile([normalGateWinner, highwayEngineWinner, dominated], largeShip))
      .toEqual([normalGateWinner])
    expect(filterTransitRouteCandidatesForProfile([normalGateWinner, highwayEngineWinner, dominated], mediumShip))
      .toEqual([normalGateWinner, highwayEngineWinner])

    expect(selectTransitRouteByTravelTime([normalGateWinner, highwayEngineWinner, dominated], largeShip).route)
      .toBe(normalGateWinner)
    expect(selectTransitRouteByTravelTime([normalGateWinner, highwayEngineWinner, dominated], mediumShip).route)
      .toBe(highwayEngineWinner)
  })
})
