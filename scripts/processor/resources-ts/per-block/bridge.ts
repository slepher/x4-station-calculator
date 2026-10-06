import { isGasWare } from '../estimator'
import { type FalloffProfiles, type SplineControlPoint } from './common'
import { solidField, replay_region_solid_sum_weights_and_areas, type SolidRegionState } from './solid'
import { replay_gas_area_values_for_field, type NebulaFieldState } from './gas'
type Json = Record<string, any>
const get = (obj: Json, key: string, value: any) => obj[key] === undefined ? value : obj[key]
export function stateFloat(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'boolean') return Number(value)
  if (typeof value !== 'string') throw new TypeError(`Invalid numeric state value: ${String(value)}`)
  const text = value.trim()
  if (/^[+-]?(?:inf(?:inity)?|nan)$/i.test(text)) {
    if (/nan$/i.test(text)) return NaN
    return text.startsWith('-') ? -Infinity : Infinity
  }
  const digits = '\\d(?:_?\\d)*'
  if (!new RegExp(`^[+-]?(?:${digits}(?:\\.(?:${digits})?)?|\\.${digits})(?:[eE][+-]?${digits})?$`).test(text)) throw new TypeError(`Invalid numeric state value: ${value}`)
  return Number(text.replaceAll('_', ''))
}
function profiles(region: Json): FalloffProfiles {
  const falloff = get(region, 'falloff', {})
  const profile = (key: string) => get(falloff, key, []).map((p: Json) => ({ position: stateFloat(get(p, 'position', 0)), value: stateFloat(get(p, 'value', 1)) }))
  return { lateral: profile('lateral'), radial: profile('radial') }
}
function splinePoints(boundary: Json, position: Json): SplineControlPoint[] {
  if (boundary.class !== 'splinetube') return []
  return get(boundary, 'spline', []).map((row: Json) => ({ x: stateFloat(get(row, 'x', 0)) + stateFloat(get(position, 'x', 0)), y: stateFloat(get(row, 'y', 0)) + stateFloat(get(position, 'y', 0)), z: stateFloat(get(row, 'z', 0)) + stateFloat(get(position, 'z', 0)), tx: stateFloat(get(row, 'tx', 0)), ty: stateFloat(get(row, 'ty', 0)), tz: stateFloat(get(row, 'tz', 0)), inlength: stateFloat(get(row, 'inlength', 0)), outlength: stateFloat(get(row, 'outlength', 0)) }))
}
export function buildSolidRegionState(sectorId: string, ref: string, area: Json, region: Json): SolidRegionState {
  const position = get(area, 'position', {}), boundary = get(region, 'boundary', {}), size = get(boundary, 'size', {}), density = stateFloat(get(region, 'density', 1))
  const fields = get(region, 'fields', []).filter((field: Json) => ['asteroid', 'debris'].includes(field.tag) && field.resource).map((field: Json) => solidField({ name: get(field, 'groupref', ''), ware_key: field.resource, yield_value: stateFloat(get(field, 'yield', '1.0')), yieldvariation: stateFloat(get(field, 'yieldvariation', '0.0')), densityfactor: stateFloat(get(field, 'densityfactor', 1)), region_density: density, field_0x1150_density_base_scaled: stateFloat(get(field, 'densityfactor', 1)) * density, noisescale: stateFloat(get(field, 'noisescale', 15000)), seed: get(field, 'seed', ''), minnoisevalue: stateFloat(get(field, 'minnoisevalue', 0)), maxnoisevalue: stateFloat(get(field, 'maxnoisevalue', 1)) }))
  return { sector_id: sectorId, field_ref: ref, boundary_class: get(boundary, 'class', 'cylinder'), position_x: stateFloat(get(position, 'x', 0)), position_y: stateFloat(get(position, 'y', 0)), position_z: stateFloat(get(position, 'z', 0)), radius: stateFloat(get(size, 'r', 0)), linear: stateFloat(get(size, 'linear', 0)), region_density: density, falloff: profiles(region), payload: { ware: '', yield_name: 'lowest', resourcedensity: 1, replenishtime: 60, gatherspeedfactor: 1 }, fields, spline: splinePoints(boundary, position), box_size_x: stateFloat(get(size, 'x', 0)), box_size_y: stateFloat(get(size, 'y', 0)), box_size_z: stateFloat(get(size, 'z', 0)) }
}
export function calculateFieldPerBlock(sectorId: string, ref: string, area: Json, region: Json, ware: string, density: number) {
  const state = buildSolidRegionState(sectorId, ref, area, region)
  state.payload.ware = ware; state.payload.resourcedensity = stateFloat(density)
  state.fields = state.fields.filter(field => field.ware_key === ware)
  if (!state.fields.length) throw new Error(`No matching fields for ware=${ware} in sector=${sectorId}, field=${ref}`)
  return replay_region_solid_sum_weights_and_areas(state)
}
export function calculateGasFieldPerBlock(_sectorId: string, ref: string, area: Json, region: Json, ware: string, density: number) {
  const position = get(area, 'position', {}), boundary = get(region, 'boundary', {}), size = get(boundary, 'size', {})
  const resources = get(area, 'resources', [{}])
  if (!resources.length) throw new Error(`No resource rows in ${ref}`)
  const field: NebulaFieldState = { name: ref, boundary_class: get(boundary, 'class', 'cylinder'), position_x: stateFloat(get(position, 'x', 0)), position_y: stateFloat(get(position, 'y', 0)), position_z: stateFloat(get(position, 'z', 0)), radius: stateFloat(get(size, 'r', 0)), linear: stateFloat(get(size, 'linear', 0)), falloff: profiles(region), resources: [{ ware_key: ware, resourcedensity: stateFloat(density), recharge_time_seconds: stateFloat(get(resources[0], 'delay', 60)) * 60, gather_speed_factor: 1, yield_name: '' }], spline: splinePoints(boundary, position), size_x: stateFloat(get(size, 'x', 0)), size_y: stateFloat(get(size, 'y', 0)), size_z: stateFloat(get(size, 'z', 0)), universe_yield_density_by_ware: {} }
  return replay_gas_area_values_for_field(field)
}
export function calculateResourcePerBlock(sectorId: string, ref: string, area: Json, region: Json, ware: string, density: number): { per_tile: Json[] } {
  return isGasWare(ware) ? calculateGasFieldPerBlock(sectorId, ref, area, region, ware, density) : calculateFieldPerBlock(sectorId, ref, area, region, ware, density)
}
