import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readJson } from '../shared-ts/io'
import { get, roundSignificant, type Json } from './shared'
export function isTileInRange(tile: Json): boolean {
  const x = get(tile, 'x', 0), y = get(tile, 'y', 0), z = get(tile, 'z', 0)
  return -480000 <= x && x <= 480000 && -64000 <= y && y <= 64000 && -480000 <= z && z <= 480000
}
export function aggregateTilesForWare(tiles: Json[]): [number, number] {
  let reserve = 0, respawn = 0
  for (const tile of tiles) {
    if (!isTileInRange(tile)) continue
    const max = get(tile, 'max', 0), time = get(tile, 'time', 0)
    if (max <= 0) continue
    reserve += max
    if (time > 0) respawn += max * 3600 / time
  }
  return [reserve, respawn]
}
export function calculateSaveResourcesForSector(data: Json): Json[] {
  const result: Json[] = []
  for (const [ware, tiles] of Object.entries(get(data, 'ware', {}))) {
    if (!Array.isArray(tiles) || !tiles.length) continue
    const [reserve, respawn] = aggregateTilesForWare(tiles)
    if (reserve > 0) result.push({ ware, reserve, respawn: roundSignificant(respawn, 3) })
  }
  return result
}
export function loadSectorSaveData(dir: string, sector: string): Json | null {
  const path = join(dir, `${sector.toLowerCase()}.json`)
  return existsSync(path) ? readJson<Json>(path) : null
}
export function calculateSaveResourcesAll(dir: string, sector?: string): Record<string, Record<string, Json>> {
  const result: Record<string, Record<string, Json>> = {}
  if (!existsSync(dir)) return result
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith('.json') || filename === 'total.json') continue
    const fileSector = filename.replaceAll('.json', '')
    if (sector !== undefined && fileSector.toLowerCase() !== sector.toLowerCase()) continue
    const data = readJson<Json>(join(dir, filename)), sid = get(data, 'sector_id', fileSector).toLowerCase(), resources = calculateSaveResourcesForSector(data)
    if (!resources.length) continue
    result[sid] = Object.fromEntries(resources.filter(res => res.ware).map(res => [res.ware, { reserve: res.reserve, respawn: res.respawn }]))
  }
  return result
}
