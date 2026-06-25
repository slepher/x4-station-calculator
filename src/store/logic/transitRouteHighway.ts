import type { X4MapSector } from '@/types/x4'
import type { TransitRouteSegment } from '@/store/logic/transitRouteBuilder'

export type HighwaySplinePoint = { x: number; z: number }

export type SplineSegment = {
  points: HighwaySplinePoint[]
  totalLength: number
  cumulativeLengths: number[]
}

const HIGHWAY_SPEED_MPS = 12000
const GATE_ADJACENT_THRESHOLD_METERS = 1000

function dist2D(a: HighwaySplinePoint, b: HighwaySplinePoint): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

function buildSplineSegment(points: HighwaySplinePoint[]): SplineSegment | null {
  if (points.length < 2) return null
  const cumulativeLengths: number[] = [0]
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    totalLength += dist2D(points[i - 1]!, points[i]!)
    cumulativeLengths.push(totalLength)
  }
  return { points, totalLength, cumulativeLengths }
}

function nearestPointOnSpline(point: HighwaySplinePoint, spline: SplineSegment): { param: number; distance: number; projection: HighwaySplinePoint } {
  let minDist = Infinity
  let bestParam = 0
  let bestProjection: HighwaySplinePoint = spline.points[0]!

  for (let i = 0; i < spline.points.length - 1; i++) {
    const a = spline.points[i]!
    const b = spline.points[i + 1]!
    const segLen = dist2D(a, b)
    if (segLen === 0) {
      const d = dist2D(point, a)
      if (d < minDist) {
        minDist = d
        bestParam = spline.cumulativeLengths[i]!
        bestProjection = a
      }
      continue
    }
    const ab = { x: b.x - a.x, z: b.z - a.z }
    const ap = { x: point.x - a.x, z: point.z - a.z }
    let t = (ap.x * ab.x + ap.z * ab.z) / (segLen * segLen)
    t = Math.max(0, Math.min(1, t))
    const proj: HighwaySplinePoint = { x: a.x + t * ab.x, z: a.z + t * ab.z }
    const d = dist2D(point, proj)
    if (d < minDist) {
      minDist = d
      bestParam = (spline.cumulativeLengths[i] ?? 0) + t * segLen
      bestProjection = proj
    }
  }

  return { param: bestParam, distance: minDist, projection: bestProjection }
}

function arcLengthBetweenParams(spline: SplineSegment, paramA: number, paramB: number): number {
  if (paramB <= paramA) return 0
  return Math.min(paramB, spline.totalLength) - Math.max(paramA, 0)
}

export type SectorHighwayData = {
  splines: Array<{ spline: SplineSegment }>
}

export function extractSectorHighways(sector: X4MapSector): SectorHighwayData {
  const splines: Array<{ spline: SplineSegment }> = []
  if (!sector.highways) return { splines }

  for (const [_key, hw] of Object.entries(sector.highways)) {
    const rawSpline = hw.spline
    if (!rawSpline || rawSpline.length < 2) continue
    const points: HighwaySplinePoint[] = rawSpline
      .filter((p): p is { x: number; z: number; sx?: number; sy?: number } =>
        Number.isFinite(p.x) && Number.isFinite(p.z)
      )
      .map((p) => ({ x: p.x!, z: p.z! }))
    if (points.length < 2) continue
    const spline = buildSplineSegment(points)
    if (spline) splines.push({ spline })
  }

  return { splines }
}

export type HighwayAlternative = {
  approachDistanceKm: number
  highwayDistanceKm: number
  exitDistanceKm: number
  totalDistanceKm: number
  approachSegments: TransitRouteSegment[]
  highwaySegment: TransitRouteSegment
  exitSegments: TransitRouteSegment[]
  approachTimeSec: number
  exitTimeSec: number
  highwayTimeSec: number
  totalTimeSec: number
}

export function generateHighwayAlternative(
  origin: { x: number; z: number },
  destination: { x: number; z: number },
  originLabel: string,
  destLabel: string,
  sector: X4MapSector
): HighwayAlternative | null {
  const { splines } = extractSectorHighways(sector)
  if (splines.length === 0) return null

  const origin2D: HighwaySplinePoint = { x: origin.x, z: origin.z }
  const dest2D: HighwaySplinePoint = { x: destination.x, z: destination.z }
  const directDistM = dist2D(origin2D, dest2D)
  const directDistKm = directDistM / 1000

  let best: HighwayAlternative | null = null

  for (const { spline } of splines) {
    const entryProj = nearestPointOnSpline(origin2D, spline)
    const exitProj = nearestPointOnSpline(dest2D, spline)
    if (entryProj.param >= exitProj.param) continue

    const approachDistKm = entryProj.distance / 1000
    const exitDistKm = exitProj.distance / 1000
    const rampDistKm = approachDistKm + exitDistKm
    if (directDistKm < rampDistKm) continue

    const highwayDistM = arcLengthBetweenParams(spline, entryProj.param, exitProj.param)
    const highwayDistKm = highwayDistM / 1000
    const totalDistKm = rampDistKm + highwayDistKm

    const isApproachAdjacent = entryProj.distance <= GATE_ADJACENT_THRESHOLD_METERS
    const isExitAdjacent = exitProj.distance <= GATE_ADJACENT_THRESHOLD_METERS

    const approachSegments: TransitRouteSegment[] = []
    const exitSegments: TransitRouteSegment[] = []

    if (!isApproachAdjacent) {
      approachSegments.push({
        kind: 'highway-approach',
        fromLabel: originLabel,
        toLabel: originLabel,
        distanceKm: approachDistKm,
        countsInSummaryDistance: true
      })
    }

    const highwaySegment: TransitRouteSegment = {
      kind: 'highway',
      fromLabel: originLabel,
      toLabel: destLabel,
      distanceKm: highwayDistKm,
      countsInSummaryDistance: false
    }

    if (!isExitAdjacent) {
      exitSegments.push({
        kind: 'highway-exit',
        fromLabel: destLabel,
        toLabel: destLabel,
        distanceKm: exitDistKm,
        countsInSummaryDistance: true
      })
    }

    const highwayTimeSec = highwayDistKm / (HIGHWAY_SPEED_MPS / 1000)

    const candidate: HighwayAlternative = {
      approachDistanceKm: isApproachAdjacent ? 0 : approachDistKm,
      highwayDistanceKm: highwayDistKm,
      exitDistanceKm: isExitAdjacent ? 0 : exitDistKm,
      totalDistanceKm: totalDistKm,
      approachSegments,
      highwaySegment,
      exitSegments,
      approachTimeSec: 0,
      exitTimeSec: 0,
      highwayTimeSec,
      totalTimeSec: highwayTimeSec
    }

    if (!best || candidate.totalDistanceKm < best.totalDistanceKm) {
      best = candidate
    }
  }

  return best
}
