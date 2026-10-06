import { modernDefinitions, sectorResourceareas } from '../map-ts/definitions'
import { readMapXml } from '../map-ts/xml'
import { roundHalfEven } from '../shared-ts/math'
import { asNumber } from './estimator'
import { calculateRating, get, type Json } from './shared'
export const migrateResourceareaDefinitions = (path: string): Record<string, Json> => modernDefinitions(readMapXml(path))
export const migrateSectorResourceareas = (path: string): Record<string, Json[]> => sectorResourceareas(readMapXml(path))
export function buildSectorResourceSummaries(areasBySector: Record<string, Json[]>, definitions: Record<string, Json>): Record<string, Json[]> {
  const result: Record<string, Json[]> = {}
  for (const [sid, areas] of Object.entries(areasBySector)) {
    const wares: Record<string, { reserve: number; respawn: number }> = {}
    for (const area of areas) {
      const definition = get(definitions, get(area, 'ref', ''), {}), ware = get(definition, 'ware', '')
      if (!ware) continue
      const reserve = asNumber(definition.yield), delay = asNumber(definition.respawnDelay), amount = get(area, 'amount', 1)
      if (wares[ware] === undefined) wares[ware] = { reserve: 0, respawn: 0 }
      wares[ware]!.reserve += reserve * amount
      wares[ware]!.respawn += (delay > 0 ? reserve * 60 / delay : 0) * amount
    }
    result[sid] = Object.keys(wares).sort().map(ware => ({ ware, reserve: roundHalfEven(wares[ware]!.reserve), respawn: roundHalfEven(wares[ware]!.respawn), rating: calculateRating(wares[ware]!.respawn, ware) }))
  }
  return result
}
export function buildResourceareasPayload(areasBySector: Record<string, Json[]>, definitions: Record<string, Json>, clusterId = ''): Json[] {
  const result: Json[] = []
  for (const sid of Object.keys(areasBySector).sort()) {
    const areas: Json[] = []
    for (const area of areasBySector[sid]!) {
      const ref = get(area, 'ref', ''), definition = definitions[ref]
      if (definition === undefined) continue
      const reserve = asNumber(definition.yield), delay = asNumber(definition.respawnDelay)
      const resource: Json = { ware: get(definition, 'ware', ''), reserve: roundHalfEven(reserve), respawn: roundHalfEven(delay > 0 ? reserve * 60 / delay : 0), delay, rating: asNumber(definition.rating) }
      if (definition.gatherspeedfactor !== undefined && definition.gatherspeedfactor !== null) resource.gatherfactor = definition.gatherspeedfactor
      if (definition.objectyieldfactor !== undefined && definition.objectyieldfactor !== null) resource.objectyieldfactor = definition.objectyieldfactor
      areas.push({ ref, amount: get(area, 'amount', 1), resources: [resource] })
    }
    if (areas.length) result.push({ cluster_id: clusterId, sector_id: sid, areas })
  }
  return result
}
