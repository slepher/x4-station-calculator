import { AREA_HALF, CLAMP_UPPER, NOISE_CLAMP_SCALE, QUERY_RADIUS, SPLINETUBE_INTERVAL_SAMPLE_COUNT, build_query_grid_window, build_runtime_sampled_splinetube_points, build_polyline_arclength_table, clamp, compute_composite_spline_interval_scan, compute_composite_spline_nearest_global_t, compute_splinetube_radial_interval, dot, enumerate_grid, eval_profile_avg, f32, truncate_to_runtime_int, vec_add, vec_length, vec_mul, vec_sub, world_coord_from_storage_coord, type FalloffProfiles, type Interval, type ProfileInterval, type SplineControlPoint, type Vec3 } from './common'
export interface RegionYieldPayload { ware: string; yield_name: string; resourcedensity: number; replenishtime: number; gatherspeedfactor: number }
export interface SolidFieldState {
  name: string; ware_key: string; yield_value: number; resourcepercentage: number; yieldvariation: number; densityfactor: number; region_density: number; field_0x1150_density_base_scaled: number; ref_target_class_id: number; class_density_by_id: Record<number, number>; universe_yield_density_by_ware: Record<string, number>; universe_object_yield_density_by_ware: Record<string, number>; noisescale: number; seed: string; minnoisevalue: number; maxnoisevalue: number
}
export function solidField(values: Partial<SolidFieldState> & { name: string }): SolidFieldState {
  return { ware_key: '', yield_value: 0, resourcepercentage: 1, yieldvariation: 0, densityfactor: 1, region_density: 1, field_0x1150_density_base_scaled: 0, ref_target_class_id: 0x77, class_density_by_id: { 0x77: 1 }, universe_yield_density_by_ware: {}, universe_object_yield_density_by_ware: {}, noisescale: 5000, seed: '', minnoisevalue: 0, maxnoisevalue: 1, ...values }
}
export interface SolidRegionState {
  sector_id: string; field_ref: string; boundary_class: string; position_x: number; position_y: number; position_z: number; radius: number; linear: number; region_density: number; falloff: FalloffProfiles; payload: RegionYieldPayload; fields: SolidFieldState[]; spline: SplineControlPoint[]; box_size_x: number; box_size_y: number; box_size_z: number
}
export function compute_noise_cdf(value: number): number {
  const x = f32(value - 0.5), sign = x < 0 ? -1 : x > 0 ? 1 : 0
  const absScaled = f32(Math.abs(x) * 4.5), x2 = f32(x * x)
  const poly = f32(x2 * 4.665377140045166 + absScaled * 0.30000001192092896 + absScaled * 0.0009720000089146197 * x2 * 20.25 + x2 * x2 * 32.02915954589844 + 1)
  const squared = f32(poly * poly)
  return f32(((sign - sign / f32(squared * squared)) + 1) * 0.5)
}
export const compute_local_noise_fast_path = (field: SolidFieldState) => f32(compute_noise_cdf(field.maxnoisevalue) - compute_noise_cdf(field.minnoisevalue))
// ponytail: Python's effective path approximates small noise cells with CDF; exact cell noise is outside this migration.
export const compute_multiplier_a = (field: SolidFieldState) => field.field_0x1150_density_base_scaled * (field.class_density_by_id[field.ref_target_class_id] === undefined ? 1 : field.class_density_by_id[field.ref_target_class_id]!)
export const compute_multiplier_b = (field: SolidFieldState) => (field.universe_yield_density_by_ware[field.ware_key] === undefined ? 1 : field.universe_yield_density_by_ware[field.ware_key]!) * field.yield_value * (field.universe_object_yield_density_by_ware[field.ware_key] === undefined ? 1 : field.universe_object_yield_density_by_ware[field.ware_key]!)
export const compute_noise_window_weight = (field: SolidFieldState) => compute_multiplier_a(field) * compute_multiplier_b(field) * compute_local_noise_fast_path(field)
export function apply_per_field_value_writeback(field: SolidFieldState, value: number) {
  field.resourcepercentage = value
  if (value > 1) { field.resourcepercentage = 1; field.yield_value = value * field.yield_value }
}
export function apply_region_yield_payload_to_field(field: SolidFieldState, payload: RegionYieldPayload) {
  if (field.yield_value <= 0) field.yield_value = payload.resourcedensity
}
export function apply_groupref_to_field(field: SolidFieldState, group: { resource: string; yield_value: number; yieldvariation: number }) {
  if (!field.ware_key) field.ware_key = group.resource
  if (field.yield_value <= 0) { field.yield_value = group.yield_value; field.yieldvariation = group.yieldvariation; field.resourcepercentage = 0 }
}
export function initialize_field_from_region_definition(field: SolidFieldState, values: Pick<SolidFieldState, 'densityfactor' | 'region_density' | 'noisescale' | 'seed' | 'minnoisevalue' | 'maxnoisevalue'>) {
  Object.assign(field, values)
  field.field_0x1150_density_base_scaled = values.densityfactor * values.region_density * 0.01
}
export function compute_cylinder_axial_interval(region: SolidRegionState, query: Vec3): Interval {
  const p0: Vec3 = [region.position_x, region.position_y - region.linear, region.position_z], p1: Vec3 = [region.position_x, region.position_y + region.linear, region.position_z]
  const axis = vec_sub(p1, p0), axisSq = dot(axis, axis)
  if (axisSq === 0) throw new Error('solid cylinder axis has zero length')
  const t = dot(vec_sub(query, p0), axis) / axisSq, delta = QUERY_RADIUS / vec_length(axis)
  return [clamp(t - delta, 0, 1), clamp(t + delta, 0, 1)]
}
export function compute_cylinder_radial_interval(region: SolidRegionState, query: Vec3): Interval {
  const p0: Vec3 = [region.position_x, region.position_y - region.linear, region.position_z], p1: Vec3 = [region.position_x, region.position_y + region.linear, region.position_z]
  const axis = vec_sub(p1, p0), axisSq = dot(axis, axis)
  if (axisSq === 0 || region.radius === 0) throw new Error('solid cylinder has zero axis/radius')
  const t = dot(vec_sub(query, p0), axis) / axisSq, distance = vec_length(vec_sub(query, vec_add(p0, vec_mul(axis, t))))
  return compute_splinetube_radial_interval(distance, region.radius, QUERY_RADIUS)
}
export function compute_sphere_radial_interval(region: SolidRegionState, query: Vec3): Interval {
  if (region.radius === 0) throw new Error('solid sphere radius is zero')
  return compute_splinetube_radial_interval(vec_length(vec_sub(query, [region.position_x, region.position_y, region.position_z])), region.radius, QUERY_RADIUS)
}
export interface FalloffWeight { radial_interval: Interval | ProfileInterval[]; radial_weight: number; falloff: number; axial_interval?: ProfileInterval; axial_weight?: number; nearest_distance?: number; nearest_arclength?: number }
export function compute_sphere_falloff_weight(region: SolidRegionState, query: Vec3): FalloffWeight {
  const interval = compute_sphere_radial_interval(region, query), weight = eval_profile_avg(region.falloff.radial, interval)
  return { radial_interval: interval, radial_weight: weight, falloff: weight }
}
export function compute_box_intervals(region: SolidRegionState, query: Vec3): [ProfileInterval, ProfileInterval, ProfileInterval] {
  const center = [region.position_x, region.position_y, region.position_z]
  const halves = [region.box_size_x > 0 ? region.box_size_x / 2 : region.radius, region.box_size_y > 0 ? region.box_size_y / 2 : region.linear, region.box_size_z > 0 ? region.box_size_z / 2 : region.radius]
  return halves.map((half, i): ProfileInterval => half > 0 ? [clamp((query[i]! - center[i]! - QUERY_RADIUS) / half, 0, 1), clamp((query[i]! - center[i]! + QUERY_RADIUS) / half, 0, 1)] : [[0, 1], [0, 1]]) as [ProfileInterval, ProfileInterval, ProfileInterval]
}
export function compute_box_falloff_weight(region: SolidRegionState, query: Vec3): FalloffWeight {
  const [x, y, z] = compute_box_intervals(region, query), axial = eval_profile_avg(region.falloff.lateral, y)
  const radial = (eval_profile_avg(region.falloff.radial, x) + eval_profile_avg(region.falloff.radial, z)) / 2
  return { axial_interval: y, radial_interval: [x, z], axial_weight: axial, radial_weight: radial, falloff: axial * radial }
}
export function compute_cylinder_falloff_weight(region: SolidRegionState, query: Vec3): FalloffWeight {
  const axial = compute_cylinder_axial_interval(region, query), radial = compute_cylinder_radial_interval(region, query)
  const a = eval_profile_avg(region.falloff.lateral, axial), r = eval_profile_avg(region.falloff.radial, radial)
  return { axial_interval: axial, radial_interval: radial, axial_weight: a, radial_weight: r, falloff: a * r }
}
export const build_sampled_spline_points_from_region_bezier = (region: SolidRegionState) => build_runtime_sampled_splinetube_points(region.spline)
export function compute_splinetube_falloff_weight(region: SolidRegionState, query: Vec3, sampled = build_sampled_spline_points_from_region_bezier(region)): FalloffWeight | null {
  const [lengths, accum, total] = build_polyline_arclength_table(sampled), threshold = QUERY_RADIUS + region.radius
  const [lateral, distance] = compute_composite_spline_interval_scan(query, sampled, lengths, accum, total, threshold, SPLINETUBE_INTERVAL_SAMPLE_COUNT)
  const [nearestT] = compute_composite_spline_nearest_global_t(query, sampled, lengths, accum, total)
  if (distance > threshold || lateral === null) return null
  if (region.radius === 0) throw new Error('solid splinetube radius is zero')
  const radial = compute_splinetube_radial_interval(distance, region.radius, QUERY_RADIUS)
  const a = eval_profile_avg(region.falloff.lateral, lateral), r = eval_profile_avg(region.falloff.radial, radial)
  return { nearest_distance: distance, nearest_arclength: nearestT * total, axial_interval: lateral, radial_interval: radial, axial_weight: a, radial_weight: r, falloff: a * r }
}
export function compute_boundary_volume(region: SolidRegionState): number {
  if (region.boundary_class === 'cylinder') return region.linear * Math.PI * region.radius * region.radius
  if (region.boundary_class === 'splinetube') {
    const [, , total] = build_polyline_arclength_table(build_sampled_spline_points_from_region_bezier(region))
    return total * Math.PI * region.radius * region.radius
  }
  if (region.boundary_class === 'sphere') return (4 / 3) * Math.PI * region.radius * region.radius * region.radius
  if (region.boundary_class === 'box') return region.box_size_x * region.box_size_y * region.box_size_z
  throw new Error(`unsupported solid boundary class for volume: ${region.boundary_class}`)
}
export const compute_clamp_factor = (region: SolidRegionState) => Math.min(compute_boundary_volume(region) * NOISE_CLAMP_SCALE, CLAMP_UPPER)
export function area_intersects_field_query_box(region: SolidRegionState, x: number, y: number, z: number): boolean {
  if (y + AREA_HALF < region.position_y - region.linear || y - AREA_HALF > region.position_y + region.linear) return false
  const dx = Math.max(Math.abs(region.position_x - x) - AREA_HALF, 0), dz = Math.max(Math.abs(region.position_z - z) - AREA_HALF, 0)
  return dx * dx + dz * dz <= region.radius * region.radius
}
export function enumerate_candidate_area_centers_for_splinetube_reverse(region: SolidRegionState, points: Vec3[], radius: number, queryRadius: number): Vec3[] {
  const extension = radius + queryRadius
  const min = [0, 1, 2].map(i => Math.min(...points.map(p => p[i]!)) - extension) as Vec3
  const max = [0, 1, 2].map(i => Math.max(...points.map(p => p[i]!)) + extension) as Vec3
  return enumerate_grid(build_query_grid_window(region.position_x, region.position_y, region.position_z), min, max)
}
export function enumerate_candidate_area_centers(region: SolidRegionState): Vec3[] {
  if (region.boundary_class === 'splinetube') return enumerate_candidate_area_centers_for_splinetube_reverse(region, build_sampled_spline_points_from_region_bezier(region), region.radius, QUERY_RADIUS)
  const grid = build_query_grid_window(region.position_x, region.position_y, region.position_z)
  const min: Vec3 = [region.position_x - region.radius - AREA_HALF, region.position_y - region.linear - AREA_HALF, region.position_z - region.radius - AREA_HALF]
  const max: Vec3 = [region.position_x + region.radius + AREA_HALF, region.position_y + region.linear + AREA_HALF, region.position_z + region.radius + AREA_HALF]
  return enumerate_grid(grid, min, max).filter(coord => area_intersects_field_query_box(region, ...world_coord_from_storage_coord(grid, coord)))
}
export function compute_falloff_weight_for_query(region: SolidRegionState, query: Vec3): FalloffWeight | null {
  switch (region.boundary_class) {
    case 'cylinder': return compute_cylinder_falloff_weight(region, query)
    case 'splinetube': return compute_splinetube_falloff_weight(region, query)
    case 'sphere': return compute_sphere_falloff_weight(region, query)
    case 'box': return compute_box_falloff_weight(region, query)
    default: throw new Error(`unsupported solid boundary class for falloff: ${region.boundary_class}`)
  }
}
export function replay_region_solid_sum_weights_and_areas(region: SolidRegionState) {
  const fields = region.fields.filter(field => field.ware_key === region.payload.ware)
  for (const field of fields) apply_region_yield_payload_to_field(field, region.payload)
  let sumWeights = 0
  const weights = fields.map(field => {
    const weight = compute_noise_window_weight(field); sumWeights += weight
    return { field: field.name, multiplier_a: compute_multiplier_a(field), multiplier_b_before: compute_multiplier_b(field), local_noise_fast: compute_local_noise_fast_path(field), weight }
  })
  const value = sumWeights <= 0 ? 0 : region.payload.resourcedensity / sumWeights
  for (const field of fields) apply_per_field_value_writeback(field, value)
  const clampFactor = compute_clamp_factor(region), perTile: Record<string, any>[] = []
  let total = 0
  const grid = build_query_grid_window(region.position_x, region.position_y, region.position_z)
  for (const coord of enumerate_candidate_area_centers(region)) {
    const world = world_coord_from_storage_coord(grid, coord), falloff = compute_falloff_weight_for_query(region, world)
    if (falloff === null) continue
    let tileFloat = 0, tileTotal = 0
    const fieldRows = fields.map(field => {
      const noise = compute_local_noise_fast_path(field)
      const areaFloat = compute_multiplier_b(field) * compute_multiplier_a(field) * noise * field.resourcepercentage * falloff.falloff * clampFactor
      const area = truncate_to_runtime_int(areaFloat); tileFloat += areaFloat; tileTotal += area
      return { field: field.name, ware: field.ware_key, yield_after: field.yield_value, resourcepercentage_after: field.resourcepercentage, multiplier_a: compute_multiplier_a(field), multiplier_b: compute_multiplier_b(field), local_noise: noise, area_value_float: areaFloat, area_value: area }
    })
    total += tileTotal
    const tile: Record<string, any> = { coord, world_coord: world, radial_interval: falloff.radial_interval, radial_weight: falloff.radial_weight, falloff: falloff.falloff, tile_total_float: tileFloat, tile_total: tileTotal, fields: fieldRows }
    if (falloff.axial_interval !== undefined) { tile.axial_interval = falloff.axial_interval; tile.axial_weight = falloff.axial_weight }
    perTile.push(tile)
  }
  return { field: `${region.sector_id} / ${region.field_ref}`, payload: region.payload, sum_weights: sumWeights, per_field_value: value, clamp_factor: clampFactor, weights, per_tile: perTile, total_max: total, grid_window: grid }
}
