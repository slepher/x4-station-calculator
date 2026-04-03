import type { FitState, LayoutConfig, Vec2 } from '../types'

const SQRT3 = Math.sqrt(3)

export const hexPoints = (cx: number, cy: number, radius: number) => {
  const points: string[] = []
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index)
    const px = cx + radius * Math.cos(angle)
    const py = cy + radius * Math.sin(angle)
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`)
  }
  return points.join(' ')
}

export const hexVertices = (cx: number, cy: number, radius: number): Vec2[] => {
  const vertices: Vec2[] = []
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index)
    vertices.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return vertices
}

export const fitWorldToScreen = (points: Vec2[], cfg: LayoutConfig): FitState => {
  const minX = Math.min(...points.map((p) => p.x), 0)
  const maxX = Math.max(...points.map((p) => p.x), 1)
  const minY = Math.min(...points.map((p) => -p.y), 0)
  const maxY = Math.max(...points.map((p) => -p.y), 1)

  const availableW = cfg.width - cfg.padX * 2
  const availableH = cfg.height - cfg.padY * 2 - cfg.topPad
  const worldW = Math.max(maxX - minX, 1)
  const worldH = Math.max(maxY - minY, 1)
  const scale = Math.min(availableW / worldW, availableH / worldH)
  const offsetX = cfg.padX + (availableW - worldW * scale) / 2
  const offsetY = cfg.padY + cfg.topPad + (availableH - worldH * scale) / 2
  return { minX, minY, scale, offsetX, offsetY }
}

export const minCenterDistance = (centers: Record<string, Vec2>) => {
  const values = Object.values(centers)
  if (values.length < 2) return 1
  let best = Number.POSITIVE_INFINITY
  for (let idx = 0; idx < values.length; idx += 1) {
    for (let j = idx + 1; j < values.length; j += 1) {
      const left = values[idx]!
      const right = values[j]!
      const dist = Math.hypot(left.x - right.x, left.y - right.y)
      if (dist < best) best = dist
    }
  }
  return Number.isFinite(best) ? best : 1
}

export const computeClusterRadius = (centers: Record<string, Vec2>) => {
  const minDistance = minCenterDistance(centers)
  return Math.max(82, Math.min(126, minDistance / SQRT3))
}

export const catmullRomToBezierPath = (points: Vec2[]) => {
  if (points.length < 2) return ''
  if (points.length === 2) {
    const p0 = points[0]!
    const p1 = points[1]!
    return `M ${p0.x.toFixed(1)},${p0.y.toFixed(1)} L ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }
  const start = points[0]!
  const path: string[] = [`M ${start.x.toFixed(1)},${start.y.toFixed(1)}`]
  const count = points.length
  for (let index = 0; index < count - 1; index += 1) {
    const p0 = points[index - 1] || points[index]!
    const p1 = points[index]!
    const p2 = points[index + 1]!
    const p3 = points[index + 2] || points[index + 1]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path.push(
      `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    )
  }
  return path.join(' ')
}

export const buildHighwayPathPoints = (start: Vec2, end: Vec2, middle: Vec2[], eps = 0.1) => {
  const points: Vec2[] = [start]
  middle.forEach((point) => {
    if (Math.hypot(point.x - start.x, point.y - start.y) <= eps) return
    if (Math.hypot(point.x - end.x, point.y - end.y) <= eps) return
    points.push(point)
  })
  points.push(end)
  const deduped: Vec2[] = []
  points.forEach((point) => {
    if (!deduped.length) {
      deduped.push(point)
      return
    }
    const prev = deduped[deduped.length - 1]
    if (!prev) return
    if (Math.hypot(point.x - prev.x, point.y - prev.y) > eps) deduped.push(point)
  })
  return deduped
}

export const clipSegmentToConvexPolygon = (p0: Vec2, p1: Vec2, polygon: Vec2[]): [Vec2, Vec2] | null => {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  let tEnter = 0
  let tLeave = 1
  const eps = 1e-9

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    if (!a || !b) continue
    const ex = b.x - a.x
    const ey = b.y - a.y

    const c = ex * (p0.y - a.y) - ey * (p0.x - a.x)
    const d = ex * dy - ey * dx
    const n = -c

    if (Math.abs(d) <= eps) {
      if (c < -eps) return null
      continue
    }

    const t = n / d
    if (d > 0) tEnter = Math.max(tEnter, t)
    else tLeave = Math.min(tLeave, t)
    if (tEnter - tLeave > eps) return null
  }

  return [
    { x: p0.x + dx * tEnter, y: p0.y + dy * tEnter },
    { x: p0.x + dx * tLeave, y: p0.y + dy * tLeave }
  ]
}

const samePoint = (left: Vec2, right: Vec2, eps = 0.25) =>
  Math.hypot(left.x - right.x, left.y - right.y) <= eps

export const clipPolylineToConvexPolygon = (points: Vec2[], polygon: Vec2[]) => {
  const chains: Vec2[][] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    if (!start || !end) continue
    const clipped = clipSegmentToConvexPolygon(start, end, polygon)
    if (!clipped) continue

    const lastChain = chains[chains.length - 1]
    if (lastChain && samePoint(lastChain[lastChain.length - 1]!, clipped[0])) {
      if (!samePoint(lastChain[lastChain.length - 1]!, clipped[1])) {
        lastChain.push(clipped[1])
      }
      continue
    }

    chains.push(samePoint(clipped[0], clipped[1]) ? [clipped[0]] : [clipped[0], clipped[1]])
  }

  return chains
}
