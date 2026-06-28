import { describe, expect, it } from 'vitest'
import { applyRouteLaneOffsets } from '@/components/map/utils/routeLaneOffset'

describe('route lane offset', () => {
  it('assigns separate lanes to different links sharing one base segment', () => {
    const [first, second] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      routeSegment('b', 'link-b', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(first?.laneOffset).not.toBe(second?.laneOffset)
    expect(first?.points[0]).toEqual({ x: 0, y: 0 })
    expect(second?.points[0]).toEqual({ x: 0, y: 0 })
    expect(first?.points.at(-1)).toEqual({ x: 100, y: 0 })
    expect(second?.points.at(-1)).toEqual({ x: 100, y: 0 })
    expect(first?.points.some((point) => point.y !== 0)).toBe(true)
    expect(second?.points.some((point) => point.y !== 0)).toBe(true)
  })

  it('keeps opposite route directions on opposite visual sides of the same base segment', () => {
    const [first, second] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      routeSegment('b', 'link-b', 'gate:one', [{ x: 100, y: 0 }, { x: 0, y: 0 }])
    ])

    expect(first?.points[1]?.y).toBeLessThan(0)
    expect(second?.points[1]?.y).toBeGreaterThan(0)
  })

  it('uses the center lane for a single native route segment', () => {
    const [route] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(route?.laneOffset).toBe(0)
    expect(route?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('does not offset a single free-space route segment without a native map link', () => {
    const [route] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'space:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(route?.laneOffset).toBe(0)
    expect(route?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('keeps the center lane for free-space route segments shared by different links', () => {
    const [center, side] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'space:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      routeSegment('b', 'link-b', 'space:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(center?.laneOffset).toBe(0)
    expect(center?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
    expect(side?.laneOffset).toBe(-4)
    expect(side?.points[1]).toEqual({ x: 4, y: -4 })
  })

  it('deduplicates candidates from the same link on one base segment', () => {
    const routes = applyRouteLaneOffsets([
      routeSegment('a:0', 'link-a', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      routeSegment('a:1', 'link-a', 'gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(routes).toHaveLength(1)
    expect(routes[0]?.laneOffset).toBe(0)
  })

  it('treats single gate-to-gate segments as native replacements on the center line', () => {
    const [route] = applyRouteLaneOffsets([
      routeSegment('a', 'link-a', 'gate-to-gate:one', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(route?.laneOffset).toBe(0)
    expect(route?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('deduplicates sector-internal alternatives for the same link and endpoint pair', () => {
    const routes = applyRouteLaneOffsets([
      routeSegment('direct', 'link-a', 'sector-internal:sector-a:gate-a|gate-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }]),
      routeSegment('highway-direct', 'link-a', 'sector-internal:sector-a:gate-a|gate-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }])
    ])

    expect(routes).toHaveLength(1)
    expect(routes[0]?.id).toBe('direct')
  })

  it('keeps single sector-internal routes as direct center lines', () => {
    const [route] = applyRouteLaneOffsets([
      routeSegment('internal', 'link-a', 'sector-internal:sector-a:gate-a|gate-b', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(route?.laneOffset).toBe(0)
    expect(route?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('uses the center lane for a single ring highway route', () => {
    const [route] = applyRouteLaneOffsets([
      routeSegment('ring', 'link-a', 'ring-highway:sector-a:highway-a|highway-b', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    ])

    expect(route?.laneOffset).toBe(0)
    expect(route?.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('treats sector-internal routes sharing a ring highway channel as native lanes', () => {
    const [direct, ring] = applyRouteLaneOffsets([
      routeSegment('direct', 'link-a', 'sector-internal:sector-a:gate-a|gate-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }]),
      routeSegment('ring', 'link-b', 'ring-highway:sector-a:highway-a|highway-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }])
    ])

    expect(direct?.laneOffset).not.toBe(0)
    expect(ring?.laneOffset).not.toBe(0)
    expect(direct?.laneOffset).not.toBe(ring?.laneOffset)
  })

  it('prefers ring highway semantics over direct alternatives from the same link and channel', () => {
    const routes = applyRouteLaneOffsets([
      routeSegment('direct', 'link-a', 'sector-internal:sector-a:gate-a|gate-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }]),
      routeSegment('ring', 'link-a', 'ring-highway:sector-a:highway-a|highway-b', [{ x: 0, y: 0 }, { x: 0, y: 100 }])
    ])

    expect(routes).toHaveLength(1)
    expect(routes[0]?.id).toBe('ring')
    expect(routes[0]?.laneOffset).toBe(0)
  })
})

function routeSegment(
  id: string,
  linkId: string,
  baseLinkKey: string,
  points: Array<{ x: number; y: number }>
) {
  return {
    id,
    linkId,
    baseLinkKey,
    points
  }
}
