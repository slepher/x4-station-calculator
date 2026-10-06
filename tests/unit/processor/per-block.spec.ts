import { describe, expect, it } from 'vitest'
import { AREA_SIZE, build_query_grid_window, build_runtime_sampled_splinetube_points, compute_axis_storage_origin, compute_composite_spline_interval_scan, compute_storage_axis_range, eval_profile_avg, f32, segment_param_interval_inside_radius, truncate_to_runtime_int, world_coord_from_storage_coord, type SplineControlPoint } from '../../../scripts/processor/resources-ts/per-block/common'
import { calculateResourcePerBlock, buildSolidRegionState, stateFloat } from '../../../scripts/processor/resources-ts/per-block/bridge'
import { compute_boundary_volume, compute_box_intervals, compute_noise_cdf } from '../../../scripts/processor/resources-ts/per-block/solid'
const area = { position: { x: 0, y: 0, z: 0 }, resources: [{ delay: 60 }] }
function region(shape: string) {
  return { boundary: { class: shape, size: { r: 64000, linear: 64000, x: 128000, y: 128000, z: 128000 }, spline: [{ x: -64000, y: 0, z: 0, tx: 1, ty: 0, tz: 0, inlength: 0, outlength: 42666 }, { x: 64000, y: 0, z: 0, tx: 1, ty: 0, tz: 0, inlength: 42666, outlength: 0 }] }, density: 1, fields: [{ tag: 'asteroid', resource: 'ore', groupref: 'ore', yield: 3 }], falloff: { lateral: [{ position: 0, value: 1 }, { position: 1, value: 1 }], radial: [{ position: 0, value: 1 }, { position: 1, value: 0 }] } }
}
describe('native per-block numerics', () => {
  it('uses float32 at exact conversion points, CDF symmetry and runtime truncation', () => {
    expect(f32(16777217)).toBe(16777216)
    expect(() => f32(1e39)).toThrow(/overflow/)
    expect(f32(Infinity)).toBe(Infinity)
    expect(f32(-Infinity)).toBe(-Infinity)
    expect(f32(NaN)).toBeNaN()
    expect(compute_noise_cdf(0.5)).toBe(0.5)
    expect(compute_noise_cdf(0)).toBe(0.0009005038882605731)
    expect(compute_noise_cdf(1)).toBe(0.9990994930267334)
    expect(truncate_to_runtime_int(-1.5)).toBe(0)
    expect(truncate_to_runtime_int(3.99999)).toBe(3)
    expect(() => truncate_to_runtime_int(Infinity)).toThrow(/nonfinite/)
    expect(() => truncate_to_runtime_int(NaN)).toThrow(/nonfinite/)
    expect(truncate_to_runtime_int(-Infinity)).toBe(0)
  })
  it.each(['oops', '', '0x10', null, [], {}])('rejects invalid state floats: %s', value => {
    const input = region('cylinder')
    input.fields[0]!.yield = value as any
    expect(() => buildSolidRegionState('s', 'r', area, input)).toThrow(/Invalid numeric state value/)
  })
  it('parses Python float spellings without rejecting explicit nonfinite floats', () => {
    expect(stateFloat(' 1_000.25e-2 ')).toBe(10.0025)
    expect(stateFloat('+inf')).toBe(Infinity)
    expect(stateFloat('-Infinity')).toBe(-Infinity)
    expect(stateFloat('NaN')).toBeNaN()
  })
  it('preserves nested intervals and zero tiles for degenerate solid boxes', () => {
    const input = region('box')
    input.boundary.size = { r: 0, linear: 0, x: 1, y: 0, z: 1 }
    input.falloff = { lateral: [], radial: [] }
    const state = buildSolidRegionState('s', 'r', area, input)
    const [, y] = compute_box_intervals(state, [0, 0, 0])
    expect(y).toEqual([[0, 1], [0, 1]])
    expect(eval_profile_avg([], y)).toBe(1)
    expect(eval_profile_avg([{ position: 0, value: 1 }], y)).toBe(0)
    const result = calculateResourcePerBlock('s', 'r', area, input, 'ore', 1)
    expect(result.per_tile).toHaveLength(1)
    expect(result.per_tile[0]!.tile_total).toBe(0)
    expect(result.per_tile[0]!.falloff).toBe(1)
  })
  it('uses floor for negative coordinates and full-grid limits for origin', () => {
    expect(AREA_SIZE).toBe(64000)
    expect(compute_axis_storage_origin(-1024001, 1024000)).toBe(-1088000)
    expect(compute_storage_axis_range(-32001, 32001, 0, -480000, 480000)).toEqual([-64000, 0])
    expect(world_coord_from_storage_coord(build_query_grid_window(1100000, -1100000, 0), [0, 0, 0])).toEqual([1088000, -1152000, 0])
  })
  it('integrates profiles with knots, duplicates and zero-width intervals', () => {
    const profile = [{ position: 0, value: 0 }, { position: 0.5, value: 1 }, { position: 1, value: 0 }]
    expect(eval_profile_avg(profile, [0, 1])).toBe(0.5)
    expect(eval_profile_avg(profile, [0.25, 0.75])).toBe(0.75)
    expect(eval_profile_avg(profile, [0.5, 0.5])).toBe(0)
    expect(eval_profile_avg([], [0.5, 0.5])).toBe(1)
    expect(eval_profile_avg([{ position: 0, value: 1 }, { position: 0, value: 0 }, { position: 1, value: 0 }], [0, 1])).toBe(0.5)
  })
  it('samples all 2001 spline points and handles nearest intervals and degenerate segments', () => {
    const spline = region('splinetube').boundary.spline as SplineControlPoint[], points = build_runtime_sampled_splinetube_points(spline)
    expect(points).toHaveLength(2001); expect(points[0]).toEqual([-64000, 0, 0]); expect(points[2000]).toEqual([64000, 0, 0])
    expect(segment_param_interval_inside_radius([0, 0, 0], [-10, 0, 0], [10, 0, 0], 5)).toEqual([0.25, 0.75])
    expect(segment_param_interval_inside_radius([0, 0, 0], [10, 0, 0], [10, 0, 0], 5)).toBeNull()
    expect(compute_composite_spline_interval_scan([0, 0, 0], [[0, 0, 0], [0, 0, 0]], [0], [0, 0], 0, 1, 5)).toEqual([[0, 0], 0])
    expect(() => build_runtime_sampled_splinetube_points([])).toThrow(/at least two/)
  })
  it.each(['cylinder', 'sphere', 'box', 'splinetube'])('%s replays solid and gas without mutating definition/area inputs', shape => {
    const input = region(shape), before = structuredClone(input), solid = calculateResourcePerBlock('s', 'r', area, input, 'ore', 100)
    expect(solid.per_tile.length).toBeGreaterThan(0)
    expect(solid.per_tile.every(tile => tile.fields.every((field: any) => Number.isInteger(field.area_value) && field.area_value >= 0))).toBe(true)
    const gas = calculateResourcePerBlock('s', 'r', area, input, 'hydrogen', 123.456789)
    expect(gas.per_tile.length).toBeGreaterThan(0)
    expect(gas.per_tile.every(tile => Number.isInteger(tile.hydrogen) && tile.hydrogen >= 0)).toBe(true)
    if (shape === 'splinetube') expect(gas.per_tile.every(tile => tile.coord[1] === 0)).toBe(true)
    expect(input).toEqual(before)
  })
  it('preserves cylinder half-height mismatch between estimator and replay and rejects unsupported paths', () => {
    const state = buildSolidRegionState('s', 'r', area, region('cylinder'))
    expect(compute_boundary_volume(state)).toBe(64000 * Math.PI * 64000 * 64000)
    expect(() => calculateResourcePerBlock('s', 'r', area, region('other'), 'hydrogen', 1)).toThrow(/unsupported/)
    expect(() => calculateResourcePerBlock('s', 'r', area, region('other'), 'ore', 1)).toThrow(/unsupported/)
    expect(() => calculateResourcePerBlock('s', 'r', area, region('cylinder'), 'silicon', 1)).toThrow(/No matching fields/)
  })
})
