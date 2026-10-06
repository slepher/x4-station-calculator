import { roundHalfEven } from '../shared-ts/math'
import { asNumber } from './estimator'
export type Json = Record<string, any>
export const get = (obj: Json, key: string, value: any): any => obj[key] === undefined ? value : obj[key]
export function roundSignificant(value: number, digits = 5): number {
  if (value === 0) return 0
  const integerDigits = Math.floor(Math.log10(Math.abs(value))) + 1
  return roundHalfEven(value, integerDigits > digits ? 0 : digits - integerDigits)
}
export function calculateRating(respawn: number, ware = ''): number {
  const threshold = ware.toLowerCase() === 'nividium' ? respawn : respawn / 100
  if (threshold < 100) return 1
  if (threshold < 300) return 2
  if (threshold < 1000) return 3
  if (threshold < 3000) return 4
  return 5
}
export function calculateFalloffFactors(falloff?: Json): [number, number, number] {
  if (falloff === undefined || falloff === null) return [1, 1, 1]
  const lateral = asNumber(falloff.lateral_factor, 1), radial = asNumber(falloff.radial_factor, 1)
  return [lateral, radial, lateral * radial]
}
export function aggregateSectorResources(rows: Json[]): Record<string, Json[]> {
  const sectors: Record<string, Record<string, Json>> = {}
  for (const area of rows) {
    const sid = get(area, 'sector_id', ''), amount = get(area, 'amount', 1), resources = get(area, 'resources', [])
    if (!sid || !resources.length) continue
    if (sectors[sid] === undefined) sectors[sid] = {}
    for (const resource of resources) {
      const ware = get(resource, 'ware', '')
      if (!ware) continue
      if (sectors[sid]![ware] === undefined) sectors[sid]![ware] = { ware, reserve: 0, respawn: 0, replay_reserve: 0, replay_respawn: 0, theoretical_reserve: 0, theoretical_respawn: 0 }
      const entry = sectors[sid]![ware]!
      if ('reserve' in resource) entry.replay_reserve += resource.reserve * amount
      if ('respawn' in resource) entry.replay_respawn += resource.respawn * amount
      if ('theoretical_reserve' in resource) entry.theoretical_reserve += resource.theoretical_reserve
      if ('theoretical_respawn' in resource) entry.theoretical_respawn += resource.theoretical_respawn
    }
  }
  return Object.fromEntries(Object.entries(sectors).map(([sid, wares]) => [sid, Object.keys(wares).sort().map(ware => {
    const e = wares[ware]!, entry: Json = { ware, reserve: roundHalfEven(e.reserve), respawn: roundHalfEven(e.respawn), replay_reserve: roundHalfEven(e.replay_reserve), replay_respawn: roundHalfEven(e.replay_respawn), rating: 0 }
    if (e.theoretical_reserve !== 0) entry.theoretical_reserve = roundHalfEven(e.theoretical_reserve)
    if (e.theoretical_respawn !== 0) entry.theoretical_respawn = roundHalfEven(e.theoretical_respawn)
    return entry
  })]))
}
export function summarizeSectorResources(rows: Json[]): Json[] {
  const wares: Record<string, { amount: number; respawn: number }> = {}
  for (const region of rows) for (const resource of get(region, 'resources', [])) {
    const ware = String(get(resource, 'ware', '')).trim()
    if (!ware) continue
    if (!wares[ware]) wares[ware] = { amount: 0, respawn: 0 }
    wares[ware]!.amount += asNumber(resource.yield); wares[ware]!.respawn += asNumber(resource.respawn)
  }
  return Object.keys(wares).sort().map(ware => ({ ware, amount: roundHalfEven(wares[ware]!.amount), respawn: roundHalfEven(wares[ware]!.respawn) }))
}
export function iterMapsSectors(maps: Json): [string, Json][] {
  const sectors = get(maps, 'sectors', {})
  if (sectors !== null && typeof sectors === 'object' && !Array.isArray(sectors)) return Object.entries(sectors)
  const collected: Record<string, Json> = {}
  for (const cluster of Object.values(get(maps, 'clusters', {})) as Json[]) {
    if (cluster === null || typeof cluster !== 'object') continue
    for (const [id, sector] of Object.entries(get(cluster, 'sectors', {}))) if (sector !== null && typeof sector === 'object' && !Array.isArray(sector)) collected[id] = sector as Json
  }
  return Object.entries(collected)
}
export function extractSectorRegions(maps: Json): Record<string, Json[]> {
  return Object.fromEntries(iterMapsSectors(maps).filter(([, sector]) => sector && get(sector, 'regions', []).length).map(([macro, sector]) => [macro.toLowerCase(), sector.regions]))
}
export function buildMapResourcesPayload(version: string, model: string, ids: string[], regions: Record<string, Json[]>, resources: Record<string, Json[]>, areas: Record<string, Json[]>, definitions: Json[] = []) {
  const sectors: Record<string, Json> = {}
  for (const id of [...new Set(ids.filter(Boolean).map(id => id.toLowerCase()))].sort()) sectors[id] = { regions: get(regions, id, []), resources: get(resources, id, []), areas: get(areas, id, []) }
  for (const [id, rows] of Object.entries(areas)) {
    const sid = id.toLowerCase()
    if (sectors[sid] === undefined) sectors[sid] = { regions: get(regions, sid, []), resources: get(resources, sid, []), areas: [] }
    sectors[sid]!.areas = rows
  }
  return { version, resource_model: model, sectors, regionyield_definitions: definitions }
}
