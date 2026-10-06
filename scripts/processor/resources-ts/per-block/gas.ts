import { AREA_HALF, QUERY_RADIUS, SPLINETUBE_INTERVAL_SAMPLE_COUNT, build_polyline_arclength_table, build_query_grid_window, build_runtime_sampled_splinetube_points, clamp, compute_composite_spline_interval_scan, compute_splinetube_radial_interval, dot, enumerate_grid, eval_profile_avg, f32, truncate_to_runtime_int, vec_add, vec_length, vec_mul, vec_sub, world_coord_from_storage_coord, type FalloffProfiles, type Interval, type SplineControlPoint, type Vec3 } from './common'
export interface GasResourceEntry { ware_key: string; resourcedensity: number; recharge_time_seconds: number; gather_speed_factor: number; yield_name: string }
export interface NebulaFieldState { name: string; boundary_class: string; position_x: number; position_y: number; position_z: number; radius: number; linear: number; falloff: FalloffProfiles; resources: GasResourceEntry[]; size_x: number; size_y: number; size_z: number; spline: SplineControlPoint[]; universe_yield_density_by_ware: Record<string, number> }
export const compute_resource_field_base_multiplier = (field: NebulaFieldState, resource: GasResourceEntry) => f32(f32(field.universe_yield_density_by_ware[resource.ware_key] === undefined ? 1 : field.universe_yield_density_by_ware[resource.ware_key]!) * f32(resource.resourcedensity))
export const resource_field_is_enabled = (resource: GasResourceEntry) => resource.resourcedensity > 0
export function compute_uniform_profile_weight_for_cylinder(field: NebulaFieldState) {
  if (field.falloff.lateral_factor === undefined || field.falloff.radial_factor === undefined) throw new Error('cylinder replay path requires precomputed lateral/radial factors')
  return f32(f32(field.falloff.lateral_factor) * f32(field.falloff.radial_factor))
}
export function compute_cylinder_axial_interval(field: NebulaFieldState, query: Vec3): Interval {
  const p0: Vec3 = [field.position_x, field.position_y, field.position_z], p1: Vec3 = [field.position_x, field.position_y + field.linear, field.position_z]
  const axis = vec_sub(p1, p0), axisSq = dot(axis, axis)
  if (axisSq === 0) throw new Error('gas cylinder axis has zero length')
  const t = dot(vec_sub(query, p0), axis) / axisSq, delta = QUERY_RADIUS / vec_length(axis)
  return [clamp(t - delta, 0, 1), clamp(t + delta, 0, 1)]
}
export function compute_cylinder_radial_interval(field: NebulaFieldState, query: Vec3): Interval {
  const p0: Vec3 = [field.position_x, field.position_y, field.position_z], p1: Vec3 = [field.position_x, field.position_y + field.linear, field.position_z]
  const axis = vec_sub(p1, p0), axisSq = dot(axis, axis)
  if (axisSq === 0 || field.radius === 0) throw new Error('gas cylinder has zero axis/radius')
  const t = dot(vec_sub(query, p0), axis) / axisSq, distance = vec_length(vec_sub(query, vec_add(p0, vec_mul(axis, t))))
  return compute_splinetube_radial_interval(distance, field.radius, QUERY_RADIUS)
}
export function compute_cylinder_profile_weight_for_query(field: NebulaFieldState, query: Vec3): number {
  const axial = eval_profile_avg(field.falloff.lateral, compute_cylinder_axial_interval(field, query)), radial = eval_profile_avg(field.falloff.radial, compute_cylinder_radial_interval(field, query))
  return f32(f32(axial) * f32(radial))
}
export function compute_sphere_radial_interval(field: NebulaFieldState, query: Vec3): Interval {
  if (field.radius === 0) throw new Error('gas sphere radius is zero')
  return compute_splinetube_radial_interval(vec_length(vec_sub(query, [field.position_x, field.position_y, field.position_z])), field.radius, QUERY_RADIUS)
}
export function compute_box_normalized_scalar(field: NebulaFieldState, query: Vec3): number {
  return Math.max(field.size_x > 0 ? Math.abs(query[0] - field.position_x) / field.size_x : Infinity, field.size_y > 0 ? Math.abs(query[1] - field.position_y) / field.size_y : Infinity, field.size_z > 0 ? Math.abs(query[2] - field.position_z) / field.size_z : Infinity)
}
export function compute_box_interval(field: NebulaFieldState, query: Vec3): Interval {
  const distances = [Math.abs(query[0] - field.position_x), Math.abs(query[1] - field.position_y), Math.abs(query[2] - field.position_z)], sizes = [field.size_x, field.size_y, field.size_z]
  const lower = Math.max(...sizes.map((size, i) => size > 0 ? clamp((distances[i]! - QUERY_RADIUS) / size, 0, 1) : 1))
  const upper = Math.min(Math.max(...sizes.map((size, i) => size > 0 ? clamp((distances[i]! + QUERY_RADIUS) / size, 0, 1) : 1)), 1)
  return [lower, upper]
}
export function area_intersects_field_query_box(field: NebulaFieldState, x: number, y: number, z: number): boolean {
  if (y + AREA_HALF < field.position_y || y - AREA_HALF > field.position_y + field.linear) return false
  const dx = Math.max(Math.abs(field.position_x - x) - AREA_HALF, 0), dz = Math.max(Math.abs(field.position_z - z) - AREA_HALF, 0)
  return dx * dx + dz * dz <= field.radius * field.radius
}
export function enumerate_candidate_area_centers_for_cylinder(field: NebulaFieldState): Vec3[] {
  const grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
  return enumerate_grid(grid, [field.position_x - field.radius - AREA_HALF, field.position_y - AREA_HALF, field.position_z - field.radius - AREA_HALF], [field.position_x + field.radius + AREA_HALF, field.position_y + field.linear + AREA_HALF, field.position_z + field.radius + AREA_HALF]).filter(coord => area_intersects_field_query_box(field, ...world_coord_from_storage_coord(grid, coord)))
}
export function enumerate_hex_grid_for_boundary(field: NebulaFieldState, points: Vec3[], radius: number, queryRadius: number): Vec3[] {
  const extension = radius + queryRadius
  // Effective Python implementation uses a planar square grid, despite its historical name.
  return enumerate_grid(build_query_grid_window(field.position_x, field.position_y, field.position_z), [Math.min(...points.map(p => p[0])) - extension, 0, Math.min(...points.map(p => p[2])) - extension], [Math.max(...points.map(p => p[0])) + extension, 0, Math.max(...points.map(p => p[2])) + extension], true)
}
export const enumerate_candidate_area_centers_for_splinetube = enumerate_hex_grid_for_boundary
export function enumerate_candidate_area_centers_for_sphere(field: NebulaFieldState): Vec3[] {
  const extension = field.radius + QUERY_RADIUS
  return enumerate_grid(build_query_grid_window(field.position_x, field.position_y, field.position_z), [field.position_x - extension, field.position_y - extension, field.position_z - extension], [field.position_x + extension, field.position_y + extension, field.position_z + extension])
}
export function enumerate_candidate_area_centers_for_box(field: NebulaFieldState): Vec3[] {
  return enumerate_grid(build_query_grid_window(field.position_x, field.position_y, field.position_z), [field.position_x - field.size_x - QUERY_RADIUS, field.position_y - field.size_y - QUERY_RADIUS, field.position_z - field.size_z - QUERY_RADIUS], [field.position_x + field.size_x + QUERY_RADIUS, field.position_y + field.size_y + QUERY_RADIUS, field.position_z + field.size_z + QUERY_RADIUS])
}
export function replay_cylinder_field(field: NebulaFieldState) {
  if (field.resources.length !== 1) throw new Error('legacy cylinder replay path expects one gas resource row')
  const resource = field.resources[0]!, coords = enumerate_candidate_area_centers_for_cylinder(field), grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
  const base = resource_field_is_enabled(resource) ? compute_resource_field_base_multiplier(field, resource) : 0
  let total = 0
  const tiles = coords.map(coord => {
    const world = world_coord_from_storage_coord(grid, coord), weight = base <= 0 ? 0 : compute_cylinder_profile_weight_for_query(field, world)
    const value = base <= 0 ? 0 : truncate_to_runtime_int(f32(f32(base) * f32(weight)))
    total += value
    return { coord, world_coord: world, falloff_weight: weight, [resource.ware_key]: value }
  })
  return { field: field.name, boundary_class: field.boundary_class, tile_count: coords.length, tile_coords: coords, per_tile: tiles, ware_totals: { [resource.ware_key]: total }, grid_window: grid }
}
export function replay_splinetube_field(field: NebulaFieldState) {
  const points = build_runtime_sampled_splinetube_points(field.spline), [lengths, accum, total] = build_polyline_arclength_table(points), threshold = QUERY_RADIUS + field.radius
  const grid = build_query_grid_window(field.position_x, field.position_y, field.position_z), tiles: Record<string, any>[] = []
  const totals: Record<string, number> = Object.fromEntries(field.resources.map(r => [r.ware_key, 0]))
  for (const coord of enumerate_candidate_area_centers_for_splinetube(field, points, field.radius, QUERY_RADIUS)) {
    const world = world_coord_from_storage_coord(grid, coord)
    const [lateral, distance] = compute_composite_spline_interval_scan(world, points, lengths, accum, total, threshold, SPLINETUBE_INTERVAL_SAMPLE_COUNT)
    if (lateral === null) continue
    if (field.radius === 0) throw new Error('gas splinetube radius is zero')
    const radial = compute_splinetube_radial_interval(distance, field.radius, QUERY_RADIUS)
    const a = eval_profile_avg(field.falloff.lateral, lateral), r = eval_profile_avg(field.falloff.radial, radial), weight = a * r
    const tile: Record<string, any> = { coord, world_coord: world, representative_distance: distance, lateral_interval: lateral, radial_interval: radial, lateral_weight: a, radial_weight: r, tile_weight: weight }
    for (const resource of field.resources) {
      const value = resource_field_is_enabled(resource) ? truncate_to_runtime_int(f32(f32(compute_resource_field_base_multiplier(field, resource)) * f32(weight))) : 0
      tile[resource.ware_key] = value; totals[resource.ware_key]! += value
    }
    tiles.push(tile)
  }
  return { field: field.name, boundary_class: field.boundary_class, tile_count: tiles.length, tile_coords: tiles.map(t => t.coord), per_tile: tiles, ware_totals: totals, sampled_point_count: points.length, sampled_segment_count: points.length - 1, query_radius: QUERY_RADIUS, grid_window: grid }
}
function replay_radial_field(field: NebulaFieldState, shape: 'sphere' | 'box') {
  const grid = build_query_grid_window(field.position_x, field.position_y, field.position_z), tiles: Record<string, any>[] = []
  const totals: Record<string, number> = Object.fromEntries(field.resources.map(r => [r.ware_key, 0]))
  const coords = shape === 'sphere' ? enumerate_candidate_area_centers_for_sphere(field) : enumerate_candidate_area_centers_for_box(field)
  for (const coord of coords) {
    const world = world_coord_from_storage_coord(grid, coord)
    if (shape === 'sphere') {
      if (vec_length(vec_sub(world, [field.position_x, field.position_y, field.position_z])) > field.radius + QUERY_RADIUS) continue
    } else {
      const positiveSizes = [field.size_x, field.size_y, field.size_z].filter(v => v > 0)
      if (!positiveSizes.length) throw new Error('gas box requires a positive size')
      if (compute_box_normalized_scalar(field, world) > 1 + QUERY_RADIUS / Math.min(...positiveSizes)) continue
    }
    const interval = shape === 'sphere' ? compute_sphere_radial_interval(field, world) : compute_box_interval(field, world), weight = eval_profile_avg(field.falloff.radial, interval)
    const tile: Record<string, any> = { coord, world_coord: world, radial_interval: interval, radial_weight: weight, tile_weight: weight }
    for (const resource of field.resources) {
      const value = resource_field_is_enabled(resource) ? truncate_to_runtime_int(f32(f32(compute_resource_field_base_multiplier(field, resource)) * f32(weight))) : 0
      tile[resource.ware_key] = value; totals[resource.ware_key]! += value
    }
    tiles.push(tile)
  }
  return { field: field.name, boundary_class: field.boundary_class, tile_count: tiles.length, tile_coords: tiles.map(t => t.coord), per_tile: tiles, ware_totals: totals, query_radius: QUERY_RADIUS, grid_window: grid }
}
export const replay_sphere_field = (field: NebulaFieldState) => replay_radial_field(field, 'sphere')
export const replay_box_field = (field: NebulaFieldState) => replay_radial_field(field, 'box')
export function replay_gas_area_values_for_field(field: NebulaFieldState) {
  switch (field.boundary_class) {
    case 'cylinder': return replay_cylinder_field(field)
    case 'splinetube': return replay_splinetube_field(field)
    case 'sphere': return replay_sphere_field(field)
    case 'box': return replay_box_field(field)
    default: throw new Error(`unsupported gas boundary class for replay: ${field.boundary_class}`)
  }
}
