import type { Vec2 } from '@/components/map/types'

export type RouteLaneOffsetInput = {
  id: string
  linkId: string
  baseLinkKey: string
  points: Vec2[]
  curved?: boolean
}

export type RouteLaneOffsetResult = RouteLaneOffsetInput & {
  laneOffset: number
}

const BASE_LANE_OFFSET_PX = 4
const LANE_STEP_PX = 3

export function applyRouteLaneOffsets<T extends RouteLaneOffsetInput>(segments: T[]): Array<T & RouteLaneOffsetResult> {
  const visibleSegments = dedupeSegmentsByLinkAndLaneGroup(segments)
  const laneBySegmentId = new Map<string, number>()
  const canonicalDirectionBySegmentId = new Map<string, 1 | -1>()
  const groups = groupByLaneGroupKey(visibleSegments)

  for (const group of groups.values()) {
    const linkIds = uniqueSortedLinkIds(group)
    const nativeMapLink = group.some((segment) => isNativeMapLink(segment.baseLinkKey))
    for (const segment of group) {
      const laneIndex = linkIds.indexOf(segment.linkId)
      laneBySegmentId.set(segment.id, laneOffsetForIndex(laneIndex, linkIds.length, nativeMapLink))
      canonicalDirectionBySegmentId.set(segment.id, canonicalDirection(segment.points))
    }
  }

  return visibleSegments.map((segment) => {
    const laneOffset = laneBySegmentId.get(segment.id)
    const offset = typeof laneOffset === 'number' ? laneOffset : -BASE_LANE_OFFSET_PX
    const direction = canonicalDirectionBySegmentId.get(segment.id) ?? canonicalDirection(segment.points)
    return {
      ...segment,
      laneOffset: offset,
      points: offsetRoutePoints(segment.points, offset * direction)
    }
  })
}

function dedupeSegmentsByLinkAndLaneGroup<T extends RouteLaneOffsetInput>(segments: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const segment of segments) {
    const key = `${segment.linkId}|${laneGroupKey(segment)}`
    const existing = byKey.get(key)
    if (!existing || prefersSegment(segment, existing)) {
      byKey.set(key, segment)
    }
  }
  return Array.from(byKey.values())
}

function groupByLaneGroupKey(segments: RouteLaneOffsetInput[]): Map<string, RouteLaneOffsetInput[]> {
  const groups = new Map<string, RouteLaneOffsetInput[]>()
  for (const segment of segments) {
    const key = laneGroupKey(segment)
    const group = groups.get(key)
    if (group) {
      group.push(segment)
    } else {
      groups.set(key, [segment])
    }
  }
  return groups
}

function laneGroupKey(segment: RouteLaneOffsetInput): string {
  if (isSectorInternalVisualLink(segment.baseLinkKey) || segment.baseLinkKey.startsWith('ring-highway:')) {
    return `internal:${geometryPairKey(segment.points)}`
  }
  return segment.baseLinkKey
}

function prefersSegment(candidate: RouteLaneOffsetInput, existing: RouteLaneOffsetInput): boolean {
  if (candidate.baseLinkKey.startsWith('ring-highway:') && !existing.baseLinkKey.startsWith('ring-highway:')) return true
  return false
}

function uniqueSortedLinkIds(segments: RouteLaneOffsetInput[]): string[] {
  return Array.from(new Set(segments.map((segment) => segment.linkId))).sort((a, b) => a.localeCompare(b))
}

function laneOffsetForIndex(index: number, count: number, nativeMapLink: boolean): number {
  if (count <= 1) return 0
  if (!nativeMapLink) {
    if (index === 0) return 0
    const sideIndex = index - 1
    const pair = Math.floor(sideIndex / 2)
    const magnitude = BASE_LANE_OFFSET_PX + pair * LANE_STEP_PX
    return sideIndex % 2 === 0 ? -magnitude : magnitude
  }
  const pair = Math.floor(index / 2)
  const magnitude = BASE_LANE_OFFSET_PX + pair * LANE_STEP_PX
  return index % 2 === 0 ? -magnitude : magnitude
}

function offsetRoutePoints(points: Vec2[], laneOffset: number): Vec2[] {
  if (points.length < 2) return points
  if (laneOffset === 0) return points
  const shifted = offsetPolyline(points, laneOffset)
  const first = points[0]!
  const last = points[points.length - 1]!
  const result: Vec2[] = [first]

  const taperDistance = Math.abs(laneOffset)
  const firstInner = pointAtDistance(points, shifted, taperDistance)
  if (firstInner) result.push(firstInner)

  for (let index = 1; index < shifted.length - 1; index += 1) {
    result.push(shifted[index]!)
  }

  const lastInner = pointAtDistance(points, shifted, polylineLength(points) - taperDistance)
  if (lastInner) result.push(lastInner)

  result.push(last)
  return dedupePoints(result)
}

function offsetPolyline(points: Vec2[], laneOffset: number): Vec2[] {
  return points.map((point, index) => {
    const normal = pointNormal(points, index)
    return {
      x: point.x + normal.x * laneOffset,
      y: point.y + normal.y * laneOffset
    }
  })
}

function pointNormal(points: Vec2[], index: number): Vec2 {
  const previous = points[Math.max(0, index - 1)]!
  const next = points[Math.min(points.length - 1, index + 1)]!
  const dx = next.x - previous.x
  const dy = next.y - previous.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { x: 0, y: -1 }
  return { x: -dy / length, y: dx / length }
}

function pointAtDistance(original: Vec2[], shifted: Vec2[], target: number): Vec2 | null {
  const total = polylineLength(original)
  if (total === 0) return null
  const clampedTarget = Math.max(0, Math.min(total, target))
  let accumulated = 0
  for (let index = 0; index < original.length - 1; index += 1) {
    const start = original[index]!
    const end = original[index + 1]!
    const shiftedStart = shifted[index]!
    const shiftedEnd = shifted[index + 1]!
    const segmentLength = distance(start, end)
    const segmentEnd = accumulated + segmentLength
    if (segmentEnd >= clampedTarget) {
      const localRatio = segmentLength === 0 ? 0 : (clampedTarget - accumulated) / segmentLength
      return {
        x: shiftedStart.x + (shiftedEnd.x - shiftedStart.x) * localRatio,
        y: shiftedStart.y + (shiftedEnd.y - shiftedStart.y) * localRatio
      }
    }
    accumulated = segmentEnd
  }
  return shifted[shifted.length - 1] ?? null
}

function polylineLength(points: Vec2[]): number {
  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distance(points[index]!, points[index + 1]!)
  }
  return total
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function canonicalDirection(points: Vec2[]): 1 | -1 {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 1
  return pointSortKey(first).localeCompare(pointSortKey(last)) <= 0 ? 1 : -1
}

function geometryPairKey(points: Vec2[]): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 'empty'
  return [pointSortKey(first), pointSortKey(last)].sort((a, b) => a.localeCompare(b)).join('|')
}

function pointSortKey(point: Vec2): string {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`
}

function isNativeMapLink(baseLinkKey: string): boolean {
  return baseLinkKey.startsWith('gate:') ||
    baseLinkKey.startsWith('gate-to-gate:') ||
    baseLinkKey.startsWith('superhighway:') ||
    baseLinkKey.startsWith('ring-highway:') ||
    baseLinkKey.startsWith('highway:')
}

function isSectorInternalVisualLink(baseLinkKey: string): boolean {
  return baseLinkKey.startsWith('sector-internal:')
}

function dedupePoints(points: Vec2[], eps = 0.25): Vec2[] {
  const result: Vec2[] = []
  for (const point of points) {
    const previous = result[result.length - 1]
    if (previous && distance(previous, point) <= eps) continue
    result.push(point)
  }
  return result
}
