import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { readJson, writeJson } from '../shared-ts/io'
import { roundHalfEven } from '../shared-ts/math'
import { calculateGasVolumeKm3, calculateSolidVolumeKm3, estimateGasYield, estimateSolidYield, isGasWare } from './estimator'
import { buildResourceareasPayload, buildSectorResourceSummaries, migrateResourceareaDefinitions, migrateSectorResourceareas } from './modern'
import { calculateResourcePerBlock } from './per-block/bridge'
import { calculateSaveResourcesAll } from './save-replay'
import { aggregateSectorResources, buildMapResourcesPayload, calculateFalloffFactors, calculateRating, extractSectorRegions, get, iterMapsSectors, roundSignificant, type Json } from './shared'
export interface ResourceContext { config: Record<string, any>; rawPath: string; outputRoot: string; paths: Record<string, string>; sector?: string; forceRecalcPerBlock?: boolean; saveSampleDir?: string; blocksCache: string }
type Grouped = Record<string, Json[]>
const object = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v)
export function detectResourceModel(version: string): 'regions' | 'resourceareas' {
  const match = /^(\d+)/.exec(version)
  return match !== null && Number(match[1]) >= 9 ? 'resourceareas' : 'regions'
}
export function normalizeBlocksCache(payload: unknown): { grouped: Grouped; legacy: boolean } {
  if (!object(payload)) throw new Error('Invalid blocks cache: expected an object')
  let grouped: Grouped = {}, legacy = false
  if ('regions' in payload) {
    legacy = true
    if (!Array.isArray(payload.regions)) throw new Error('Invalid blocks cache: regions must be an array')
    for (const entry of payload.regions) {
      if (!object(entry) || typeof entry.sector_id !== 'string' || !entry.sector_id) throw new Error('Invalid legacy blocks cache sector_id')
      const sid = entry.sector_id.toLowerCase()
      if (grouped[sid] === undefined) grouped[sid] = []
      grouped[sid]!.push({ ref: entry.ref, total: entry.total, tiles: entry.tiles })
    }
  } else {
    for (const [sid, rows] of Object.entries(payload)) {
      if (!sid || !Array.isArray(rows)) throw new Error(`Invalid blocks cache sector ${sid}`)
      grouped[sid.toLowerCase()] = rows
    }
  }
  for (const [sid, rows] of Object.entries(grouped)) for (const row of rows) {
    if (!object(row) || typeof row.ref !== 'string' || !row.ref || !object(row.total) || !Array.isArray(row.tiles)) throw new Error(`Invalid blocks cache region in ${sid}`)
    if (Object.values(row.total).some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error(`Invalid blocks cache total in ${sid}/${row.ref}`)
    for (const tile of row.tiles) {
      if (!object(tile) || ['x', 'y', 'z'].some(k => typeof tile[k] !== 'number' || !Number.isFinite(tile[k])) || !object(tile.wares) || Object.values(tile.wares).some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error(`Invalid blocks cache tile in ${sid}/${row.ref}`)
    }
  }
  return { grouped, legacy }
}
export function loadGroupedResourceareas(path: string): Grouped {
  if (!existsSync(path)) return {}
  const payload = readJson<unknown>(path), grouped: Grouped = {}
  if (Array.isArray(payload)) {
    for (const row of payload) if (object(row) && row.sector_id) {
      if (!Array.isArray(row.areas)) throw new Error(`Invalid resourceareas at ${path}`)
      grouped[row.sector_id.toLowerCase()] = row.areas
    }
    return grouped
  }
  if (!object(payload)) throw new Error(`Invalid resourceareas at ${path}`)
  if (object(payload.sectors)) {
    for (const [sid, row] of Object.entries(payload.sectors)) if (object(row)) {
      const areas = get(row, 'areas', [])
      if (!Array.isArray(areas)) throw new Error(`Invalid resourceareas at ${path}`)
      grouped[sid.toLowerCase()] = areas
    }
    return grouped
  }
  if ('regions' in payload) return grouped
  for (const [sid, areas] of Object.entries(payload)) {
    if (!Array.isArray(areas)) throw new Error(`Invalid resourceareas at ${path}: ${sid}`)
    grouped[sid.toLowerCase()] = areas
  }
  return grouped
}
function regionsFromAreas(areas: Grouped): Grouped {
  return Object.fromEntries(Object.entries(areas).map(([sid, rows]) => [sid.toLowerCase(), rows.filter(row => object(row) && row.ref).map(row => ({ ref: row.ref, amount: get(row, 'amount', 1), position: get(row, 'position', {}) }))]))
}
export function calculateBlocks(rows: Json[], regions: Record<string, Json>): Grouped {
  const entries = new Map<string, { sid: string; ref: string; total: Record<string, number>; tiles: Map<string, Json> }>()
  for (const area of rows) {
    const sid = get(area, 'sector_id', ''), ref = get(area, 'ref', ''), region = regions[ref]
    if (region === undefined) continue
    for (const resource of get(area, 'resources', [])) {
      const ware = get(resource, 'ware', ''), result = calculateResourcePerBlock(sid, ref, area, region, ware, get(resource, 'resourcedensity', 1))
      const key = JSON.stringify([sid, ref])
      if (!entries.has(key)) entries.set(key, { sid, ref, total: {}, tiles: new Map() })
      const entry = entries.get(key)!
      for (const tile of result.per_tile) {
        const [x, y, z] = get(tile, 'world_coord', [0, 0, 0]), tileKey = `${x}_${y}_${z}`
        if (!entry.tiles.has(tileKey)) entry.tiles.set(tileKey, { x, y, z, wares: {} })
        const target = entry.tiles.get(tileKey)!
        if ('fields' in tile) {
          for (const field of get(tile, 'fields', [])) if (field.ware === ware) {
            const value = get(field, 'area_value', 0)
            target.wares[ware] = get(target.wares, ware, 0) + value; entry.total[ware] = get(entry.total, ware, 0) + value
          }
        } else if (ware in tile && tile[ware] > 0) {
          target.wares[ware] = get(target.wares, ware, 0) + tile[ware]; entry.total[ware] = get(entry.total, ware, 0) + tile[ware]
        }
      }
    }
  }
  const grouped: Grouped = {}
  for (const entry of entries.values()) {
    const sid = entry.sid.toLowerCase()
    if (grouped[sid] === undefined) grouped[sid] = []
    grouped[sid]!.push({ ref: entry.ref, total: entry.total, tiles: [...entry.tiles.values()] })
  }
  return grouped
}
function theoreticalRows(maps: Json, regions: Record<string, Json>, sector?: string): { rows: Json[]; regions: Grouped; ids: string[]; hasRegions: boolean } {
  const rows: Json[] = [], sectorRegions: Grouped = {}, ids: string[] = []
  let hasRegions = false
  for (const [macro, data] of iterMapsSectors(maps)) {
    if (!object(data)) continue
    const sid: string = get(data, 'id', macro)
    if (sector !== undefined && sid.toLowerCase() !== sector.toLowerCase()) continue
    ids.push(sid)
    const refs = get(data, 'regions', [])
    sectorRegions[sid.toLowerCase()] = refs
    for (const reference of refs) {
      hasRegions = true
      const ref = get(reference, 'ref', ''), template = get(regions, ref, {}), boundary = get(template, 'boundary', {}), position = get(reference, 'position', {})
      const [lateral, radial, factor] = calculateFalloffFactors(get(template, 'falloff', {}))
      let solidVolume = 0, gasVolume = 0
      const resources = get(template, 'resources', []).map((resource: Json) => {
        const ware = get(resource, 'ware', ''), density = get(resource, 'resourcedensity', 1), delay = get(resource, 'delay', 60)
        let reserve: number, respawn: number
        if (isGasWare(ware)) { gasVolume = calculateGasVolumeKm3(position, boundary)[1]; [reserve, respawn] = estimateGasYield(position, boundary, factor, density, delay) }
        else { solidVolume = calculateSolidVolumeKm3(boundary); [reserve, respawn] = estimateSolidYield(boundary, factor, density, delay) }
        const entry: Json = { ware, resourcedensity: density, theoretical_reserve: roundHalfEven(reserve), theoretical_respawn: roundHalfEven(respawn), delay, gatherfactor: get(resource, 'gatherfactor', 1) }
        if (resource.yield_name) entry.yield_name = resource.yield_name
        return entry
      })
      const row: Json = { cluster_id: get(data, 'cluster_id', ''), sector_id: sid, ref, amount: get(reference, 'amount', 1), position, boundary, lateral_factor: roundSignificant(lateral), radial_factor: roundSignificant(radial), falloff_factor: roundSignificant(factor) }
      if (solidVolume > 0) row.solid_volume_km3 = roundHalfEven(solidVolume)
      if (gasVolume > 0) row.gas_volume_km3 = roundHalfEven(gasVolume)
      row.resources = resources; rows.push(row)
    }
  }
  return { rows, regions: sectorRegions, ids, hasRegions }
}
function areaFromRow(row: Json): Json {
  const area: Json = { ref: get(row, 'ref', ''), amount: get(row, 'amount', 1), position: get(row, 'position', {}), boundary: get(row, 'boundary', {}), lateral_factor: get(row, 'lateral_factor', 1), radial_factor: get(row, 'radial_factor', 1), falloff_factor: get(row, 'falloff_factor', 1), resources: get(row, 'resources', []) }
  for (const key of ['solid_volume_km3', 'gas_volume_km3']) if (row[key]) area[key] = row[key]
  return area
}
function processLegacy(context: ResourceContext, mapsPath: string, outputDir: string) {
  const regionsPath = context.paths['regions-json']
  if (regionsPath === undefined) throw new Error('Missing regions-json path')
  const templates = readJson<unknown>(regionsPath)
  if (!Array.isArray(templates)) throw new Error(`Invalid regions JSON: ${regionsPath}`)
  const regions = Object.fromEntries(templates.filter(object).map(row => [row.id, row]))
  const maps = readJson<Json>(mapsPath), areasPath = join(outputDir, 'resourceareas.json'), outputPath = join(outputDir, 'map_resources.json')
  const inputAreasPath = join(dirname(mapsPath), 'resourceareas.json')
  const inputAreas = loadGroupedResourceareas(inputAreasPath)
  const existingAreas = loadGroupedResourceareas(areasPath)
  let cache: Grouped = {}, legacyCache = false, recovered = false
  if (existsSync(context.blocksCache)) {
    try { const parsed = normalizeBlocksCache(readJson(context.blocksCache)); cache = parsed.grouped; legacyCache = parsed.legacy }
    catch (error) {
      if (!context.forceRecalcPerBlock) throw new Error(`Blocks cache ${context.blocksCache}: ${error instanceof Error ? error.message : String(error)}`)
      recovered = true
    }
  }
  const calculated = theoreticalRows(maps, regions, context.sector), rows = calculated.rows
  if (!calculated.hasRegions) for (const [sid, areas] of Object.entries(inputAreas)) {
    if (context.sector !== undefined && sid !== context.sector.toLowerCase()) continue
    for (const area of areas) if (object(area)) rows.push({ sector_id: sid, ...structuredClone(area) })
  }
  const targetSectors = new Set(rows.map(row => String(row.sector_id).toLowerCase()))
  const emptyCache = !Object.values(cache).some(rows => rows.some(row => row.ref))
  const recalcAll = Boolean(context.forceRecalcPerBlock) || emptyCache || recovered
  const missing = new Set<string>()
  if (!recalcAll) {
    if (context.sector !== undefined) { if (legacyCache || cache[context.sector.toLowerCase()] === undefined) missing.add(context.sector.toLowerCase()) }
    else for (const sid of targetSectors) if (legacyCache || cache[sid] === undefined) missing.add(sid)
  }
  const needRecalc = recalcAll || missing.size > 0
  if (needRecalc) {
    const rowsToCalculate = recalcAll ? rows : rows.filter(row => missing.has(row.sector_id.toLowerCase()))
    const fresh = calculateBlocks(rowsToCalculate, regions)
    if (context.sector !== undefined) {
      delete cache[context.sector.toLowerCase()]
      Object.assign(cache, fresh)
    } else if (!recalcAll) Object.assign(cache, fresh)
    else cache = fresh
  }
  for (const row of rows) {
    const entry = get(cache, row.sector_id.toLowerCase(), []).find((entry: Json) => entry.ref === row.ref)
    if (entry === undefined) continue
    for (const resource of get(row, 'resources', [])) if (resource.ware in entry.total) {
      resource.reserve = entry.total[resource.ware]
      const delay = get(resource, 'delay', 60)
      resource.respawn = delay > 0 ? roundHalfEven(resource.reserve * 60 / delay) : 0
    }
  }
  const grouped: Grouped = context.sector === undefined ? {} : Object.fromEntries(Object.entries(existingAreas).filter(([sid]) => sid !== context.sector!.toLowerCase()))
  for (const row of rows) {
    const sid = row.sector_id
    if (grouped[sid] === undefined) grouped[sid] = []
    grouped[sid]!.push(areaFromRow(row))
  }
  const resources = aggregateSectorResources(rows)
  if (context.saveSampleDir !== undefined) {
    if (!existsSync(context.saveSampleDir) || !statSync(context.saveSampleDir).isDirectory()) throw new Error(`Save sample directory does not exist: ${context.saveSampleDir}`)
    const saved = calculateSaveResourcesAll(context.saveSampleDir, context.sector)
    for (const [sid, wares] of Object.entries(resources)) for (const resource of wares) {
      const save = saved[sid.toLowerCase()]?.[resource.ware]
      if (save !== undefined) { resource.reserve = get(save, 'reserve', 0); resource.respawn = get(save, 'respawn', 0) }
    }
  }
  for (const wares of Object.values(resources)) for (const resource of wares) resource.rating = calculateRating(resource.respawn > 0 ? resource.respawn : get(resource, 'replay_respawn', 0), resource.ware)
  const sectorRegions = calculated.hasRegions ? Object.fromEntries(Object.entries(calculated.regions).filter(([, rows]) => rows.length)) : regionsFromAreas(grouped)
  const normalizedResources = Object.fromEntries(Object.entries(resources).map(([sid, rows]) => [sid.toLowerCase(), rows]))
  const normalizedAreas = Object.fromEntries(Object.entries(grouped).map(([sid, rows]) => [sid.toLowerCase(), rows]))
  const payload = buildMapResourcesPayload('8.0', 'regions', calculated.ids, sectorRegions, normalizedResources, normalizedAreas)
  preserveOtherSectors(payload, outputPath, context.sector)
  // All reads, numerical work and merges complete before the first atomic file replacement.
  writeJson(areasPath, grouped); writeJson(outputPath, payload)
  const files = [areasPath, outputPath]
  if (needRecalc && (Object.keys(cache).length || recovered || context.sector !== undefined)) { writeJson(context.blocksCache, cache); files.push(context.blocksCache) }
  return { status: 'success', resource_model: 'regions', sectors_processed: Object.keys(grouped).length, output_files: files }
}
function preserveOtherSectors(payload: ReturnType<typeof buildMapResourcesPayload>, path: string, sector?: string) {
  if (sector === undefined || !existsSync(path)) return
  const existing = readJson<Json>(path)
  if (!object(existing.sectors)) throw new Error(`Invalid map_resources sectors: ${path}`)
  for (const [sid, value] of Object.entries(existing.sectors)) if (sid.toLowerCase() !== sector.toLowerCase()) payload.sectors[sid] = value as Json
}
function processModern(context: ResourceContext, mapsPath: string, outputDir: string) {
  if (context.forceRecalcPerBlock || context.saveSampleDir !== undefined) throw new Error('Per-block recalculation/save samples are unsupported for resourceareas')
  const definitionsPath = join(dirname(mapsPath), 'regionyield_definitions.json'), outputPath = join(outputDir, 'map_resources.json'), areasPath = join(outputDir, 'resourceareas.json')
  const definitionsList = readJson<unknown>(definitionsPath)
  if (!Array.isArray(definitionsList)) throw new Error(`Invalid definitions JSON: ${definitionsPath}`)
  let definitions: Record<string, Json> = Object.fromEntries(definitionsList.filter(row => object(row) && row.id).map(row => [row.id, row]))
  const maps = readJson<Json>(mapsPath)
  let areas = extractSectorRegions(maps), ids = iterMapsSectors(maps).filter(([, row]) => object(row)).map(([macro, row]) => String(get(row, 'id', macro)))
  let rebuilt = false
  if (!Object.keys(definitions).length) {
    const xml = context.paths['regionyields-xml']
    if (xml === undefined) throw new Error(`Empty ${definitionsPath} and missing regionyields XML`)
    definitions = migrateResourceareaDefinitions(xml); rebuilt = true
  }
  if (!Object.values(areas).some(rows => rows.length)) {
    const xml = context.paths['mapdefaults-xml']
    if (xml === undefined) throw new Error('maps.json has empty sector.regions and missing mapdefaults XML')
    areas = migrateSectorResourceareas(xml)
  }
  if (context.sector !== undefined) {
    const sid = context.sector.toLowerCase()
    areas = Object.fromEntries(Object.entries(areas).filter(([id]) => id.toLowerCase() === sid))
    ids = ids.filter(id => id.toLowerCase() === sid)
  }
  const rows = buildResourceareasPayload(areas, definitions), summaries = buildSectorResourceSummaries(areas, definitions)
  const grouped = Object.fromEntries(rows.map(row => [row.sector_id.toLowerCase(), row.areas]))
  const payload = buildMapResourcesPayload('9.0', 'resourceareas', ids, areas, summaries, grouped, Object.values(definitions))
  preserveOtherSectors(payload, outputPath, context.sector)
  let outputRows = rows
  if (context.sector !== undefined && existsSync(areasPath)) {
    const existing = readJson<unknown>(areasPath)
    if (!Array.isArray(existing)) throw new Error(`Invalid modern resourceareas: ${areasPath}`)
    outputRows = [...existing.filter(row => object(row) && row.sector_id.toLowerCase() !== context.sector!.toLowerCase()), ...rows].sort((a, b) => a.sector_id < b.sector_id ? -1 : a.sector_id > b.sector_id ? 1 : 0)
  }
  writeJson(areasPath, outputRows); writeJson(outputPath, payload)
  const files = [areasPath, outputPath]
  if (rebuilt) {
    const regeneratedPath = join(outputDir, 'regionyield_definitions.json')
    writeJson(regeneratedPath, Object.values(definitions)); files.push(regeneratedPath)
  }
  return { status: 'success', resource_model: 'resourceareas', sectors_processed: Object.keys(areas).length, definitions_count: Object.keys(definitions).length, output_files: files }
}
export function processResources(context: ResourceContext) {
  const mapsPath = context.paths['maps-json']
  if (mapsPath === undefined) throw new Error('Missing maps-json path')
  let outputDir: string
  if (context.paths['resource-output-dir'] !== undefined) outputDir = context.paths['resource-output-dir']
  else outputDir = join(context.outputRoot, 'data')
  const outputs = [join(outputDir, 'map_resources.json'), join(outputDir, 'resourceareas.json'), join(outputDir, 'regionyield_definitions.json')]
  if (detectResourceModel(String(context.config.version)) === 'regions') outputs.push(context.blocksCache)
  if (outputs.some(path => resolve(path) === resolve(mapsPath))) throw new Error('Resource output/cache path must not overwrite maps-json')
  return detectResourceModel(String(context.config.version)) === 'resourceareas' ? processModern(context, mapsPath, outputDir) : processLegacy(context, mapsPath, outputDir)
}
