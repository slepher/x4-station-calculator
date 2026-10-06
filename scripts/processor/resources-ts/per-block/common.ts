export type Vec3 = [number, number, number]
export type Interval = [number, number]
export type ProfileInterval = Interval | [Interval, Interval]
export interface ProfilePoint { position: number; value: number }
export interface FalloffProfiles { lateral: ProfilePoint[]; radial: ProfilePoint[]; lateral_factor?: number; radial_factor?: number }
export interface SplineControlPoint { x: number; y: number; z: number; tx: number; ty: number; tz: number; inlength: number; outlength: number }
export interface QueryGridWindow { origin_x: number; origin_y: number; origin_z: number }
export const AREA_SIZE = 64000, AREA_HALF = 32000, QUERY_RADIUS = 55425.625
export const SAVE_GRID_MIN_CENTER_XZ = -480000, SAVE_GRID_MAX_CENTER_XZ = 480000
export const SAVE_GRID_MIN_CENTER_Y = -96000, SAVE_GRID_MAX_CENTER_Y = 96000
export const FULL_GRID_MAX_CENTER_XZ = 1024000, FULL_GRID_MAX_CENTER_Y = 1024000
export const SPLINETUBE_SEGMENT_COUNT_DEFAULT = 2000, SPLINETUBE_INTERVAL_SAMPLE_COUNT = 5
export const NOISE_CLAMP_SCALE = 9.999999717180685e-10, CLAMP_UPPER = 262144
export function f32(value: number): number {
  const result = Math.fround(value)
  if (Number.isFinite(value) && !Number.isFinite(result)) throw new RangeError('float32 overflow')
  return result
}
export const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value))
export function truncate_to_runtime_int(value: number): number {
  if (value <= 0) return 0
  if (!Number.isFinite(value)) throw new RangeError('Cannot truncate a nonfinite runtime value')
  return Math.trunc(value)
}
export const vec_add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const vec_sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const vec_mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const vec_length = (a: Vec3) => Math.sqrt(dot(a, a))
export function compute_axis_storage_origin(position: number, maxCenter: number) {
  return Math.abs(position) <= maxCenter ? 0 : Math.floor(position / AREA_SIZE) * AREA_SIZE
}
export function build_query_grid_window(x: number, y: number, z: number): QueryGridWindow {
  return { origin_x: compute_axis_storage_origin(x, FULL_GRID_MAX_CENTER_XZ), origin_y: compute_axis_storage_origin(y, FULL_GRID_MAX_CENTER_Y), origin_z: compute_axis_storage_origin(z, FULL_GRID_MAX_CENTER_XZ) }
}
export const world_coord_from_storage_coord = (grid: QueryGridWindow, coord: Vec3): Vec3 => [coord[0] + grid.origin_x, coord[1] + grid.origin_y, coord[2] + grid.origin_z]
export function compute_storage_axis_range(min: number, max: number, origin: number, lower: number, upper: number): Interval {
  return [Math.max(Math.floor((min - origin) / AREA_SIZE) * AREA_SIZE, lower), Math.min(Math.floor((max - origin) / AREA_SIZE) * AREA_SIZE, upper)]
}
export function eval_profile_avg(profile: ProfilePoint[], [lower, upper]: ProfileInterval): number {
  if (!profile.length) return 1
  if (Array.isArray(lower) && Array.isArray(upper)) {
    if (upper[0] < lower[0] || (upper[0] === lower[0] && upper[1] <= lower[1])) return 0
    throw new TypeError('Cannot integrate a nonnumeric profile interval')
  }
  if (typeof lower !== 'number' || typeof upper !== 'number') throw new TypeError('Cannot integrate a mixed profile interval')
  if (upper <= lower) return 0
  const valueAt = (x: number) => {
    if (x <= profile[0]!.position) return profile[0]!.value
    for (let i = 0; i < profile.length - 1; i++) {
      const left = profile[i]!, right = profile[i + 1]!
      if (x <= right.position) {
        if (right.position === left.position) return right.value
        const t = (x - left.position) / (right.position - left.position)
        return left.value + (right.value - left.value) * t
      }
    }
    return profile[profile.length - 1]!.value
  }
  const xs = [lower, upper, ...profile.filter(p => lower < p.position && p.position < upper).map(p => p.position)].sort((a, b) => a - b)
  let area = 0
  for (let i = 0; i < xs.length - 1; i++) area += (valueAt(xs[i]!) + valueAt(xs[i + 1]!)) * 0.5 * (xs[i + 1]! - xs[i]!)
  return area / (upper - lower)
}
export function cubic_bezier_sample(p0: Vec3, c0: Vec3, c1: Vec3, p1: Vec3, t: number): Vec3 {
  const omt = 1 - t, omt2 = omt * omt, omt3 = omt2 * omt, t2 = t * t, t3 = t2 * t
  return vec_add(vec_add(vec_mul(p0, omt3), vec_mul(c0, 3 * omt2 * t)), vec_add(vec_mul(c1, 3 * omt * t2), vec_mul(p1, t3)))
}
export function sample_composite_spline_uniform_param(spline: SplineControlPoint[], t: number): Vec3 {
  const count = spline.length - 1
  if (count <= 0) throw new Error('splinetube requires at least two spline control points')
  t = clamp(t, 0, 1)
  const scaled = t * count
  let index = Math.min(Math.floor(scaled), count - 1), localT = scaled - index
  if (t >= 1) { index = count - 1; localT = 1 }
  const left = spline[index]!, right = spline[index + 1]!
  return cubic_bezier_sample([left.x, left.y, left.z], [left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength], [right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength], [right.x, right.y, right.z], localT)
}
export const build_runtime_sampled_splinetube_points = (spline: SplineControlPoint[]): Vec3[] => Array.from({ length: SPLINETUBE_SEGMENT_COUNT_DEFAULT + 1 }, (_, i) => sample_composite_spline_uniform_param(spline, i / SPLINETUBE_SEGMENT_COUNT_DEFAULT))
export function build_polyline_arclength_table(points: Vec3[]): [number[], number[], number] {
  const lengths: number[] = [], accum = [0]
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const length = vec_length(vec_sub(points[i + 1]!, points[i]!))
    lengths.push(length); total += length; accum.push(total)
  }
  return [lengths, accum, total]
}
export function distance_point_to_segment_with_param(query: Vec3, a: Vec3, b: Vec3): Interval {
  const ab = vec_sub(b, a), ab2 = dot(ab, ab)
  if (ab2 <= 1e-6) return [vec_length(vec_sub(query, a)), 0]
  const t = clamp(dot(vec_sub(query, a), ab) / ab2, 0, 1)
  return [vec_length(vec_sub(query, vec_add(a, vec_mul(ab, t)))), t]
}
export function nearest_distance_to_sampled_polyline(query: Vec3, points: Vec3[], lengths: number[], accum: number[]): Interval {
  let best = Infinity, arc = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [distance, t] = distance_point_to_segment_with_param(query, points[i]!, points[i + 1]!)
    if (distance < best) { best = distance; arc = accum[i]! + lengths[i]! * t }
  }
  return [best, arc]
}
export function sample_point_on_sampled_polyline_at_fraction(points: Vec3[], lengths: number[], accum: number[], total: number, fraction: number): Vec3 {
  if (total <= 1e-6) return points[0]!
  const target = clamp(fraction, 0, 1) * total
  for (let i = 0; i < lengths.length; i++) {
    if (target <= accum[i + 1]! || i === lengths.length - 1) {
      if (lengths[i]! <= 1e-6) return points[i]!
      const t = clamp((target - accum[i]!) / lengths[i]!, 0, 1)
      return vec_add(points[i]!, vec_mul(vec_sub(points[i + 1]!, points[i]!), t))
    }
  }
  return points[points.length - 1]!
}
export function compute_composite_spline_nearest_global_t(query: Vec3, points: Vec3[], lengths: number[], accum: number[], total: number): Interval {
  const [distance, arc] = nearest_distance_to_sampled_polyline(query, points, lengths, accum)
  return [total <= 1e-6 ? 0 : clamp(arc / total, 0, 1), distance]
}
export function segment_param_interval_inside_radius(query: Vec3, a: Vec3, b: Vec3, radius: number): Interval | null {
  const ab = vec_sub(b, a), aq = vec_sub(a, query), aa = dot(ab, ab)
  if (aa <= 1e-6) return vec_length(aq) <= radius ? [0, 1] : null
  const bb = 2 * dot(aq, ab), cc = dot(aq, aq) - radius * radius, disc = bb * bb - 4 * aa * cc
  const bothInside = () => vec_length(aq) <= radius && vec_length(vec_sub(b, query)) <= radius
  if (disc < 0) return bothInside() ? [0, 1] : null
  const root = Math.sqrt(disc), aT = (-bb - root) / (2 * aa), bT = (-bb + root) / (2 * aa)
  const lower = clamp(Math.min(aT, bT), 0, 1), upper = clamp(Math.max(aT, bT), 0, 1)
  if (upper <= lower) return bothInside() ? [0, 1] : null
  return [lower, upper]
}
export function compute_composite_spline_interval_scan(query: Vec3, points: Vec3[], lengths: number[], accum: number[], total: number, radius: number, sampleCount: number): [Interval | null, number] {
  const [nearestT] = compute_composite_spline_nearest_global_t(query, points, lengths, accum, total)
  if (total <= 1e-6) {
    const distance = vec_length(vec_sub(points[0]!, query))
    return [distance < radius ? [0, 0] : null, distance]
  }
  const window = (radius + radius) / total, step = window / sampleCount, start = nearestT - window, end = start + window + window + step
  let first: number | null = null, last: number | null = null
  for (let t = start; t < end; t += step) {
    const point = sample_point_on_sampled_polyline_at_fraction(points, lengths, accum, total, t)
    if (vec_length(vec_sub(point, query)) < radius) {
      const hit = clamp(t, 0, 1)
      if (first === null) first = hit
      last = hit
    }
  }
  const representative = sample_point_on_sampled_polyline_at_fraction(points, lengths, accum, total, nearestT)
  return [first === null || last === null ? null : [first, last], vec_length(vec_sub(representative, query))]
}
export function compute_splinetube_lateral_interval_polyline(query: Vec3, points: Vec3[], lengths: number[], accum: number[], total: number, threshold: number): Interval | null {
  const hits: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const interval = segment_param_interval_inside_radius(query, points[i]!, points[i + 1]!, threshold)
    if (interval) hits.push((accum[i]! + lengths[i]! * interval[0]) / total, (accum[i]! + lengths[i]! * interval[1]) / total)
  }
  return hits.length ? [Math.min(...hits), Math.max(...hits)] : null
}
export function compute_splinetube_radial_interval(distance: number, radius: number, queryRadius: number): Interval {
  if (radius === 0) throw new Error('splinetube radius is zero')
  return [clamp((distance - queryRadius) / radius, 0, 1), clamp((distance + queryRadius) / radius, 0, 1)]
}
// Shared enumeration preserves Python's floor, clipping and x/y/z iteration order.
export function enumerate_grid(grid: QueryGridWindow, min: Vec3, max: Vec3, planar = false): Vec3[] {
  const [sx, ex] = compute_storage_axis_range(min[0], max[0], grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ)
  const [sy, ey] = planar ? [0, 0] : compute_storage_axis_range(min[1], max[1], grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y)
  const [sz, ez] = compute_storage_axis_range(min[2], max[2], grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ)
  const coords: Vec3[] = []
  for (let x = sx; x <= ex; x += AREA_SIZE) for (let y = sy; y <= ey; y += AREA_SIZE) for (let z = sz; z <= ez; z += AREA_SIZE) coords.push([x, y, z])
  return coords
}
