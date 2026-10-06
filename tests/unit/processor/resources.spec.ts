import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { processResources, normalizeBlocksCache, type ResourceContext } from '../../../scripts/processor/resources-ts'
import { aggregateSectorResources, calculateRating, roundSignificant, summarizeSectorResources } from '../../../scripts/processor/resources-ts/shared'
import { aggregateTilesForWare, calculateSaveResourcesForSector } from '../../../scripts/processor/resources-ts/save-replay'
import { calculateGasBlockCount, calculateGasVolumeKm3, calculateSolidVolumeTruncated } from '../../../scripts/processor/resources-ts/estimator'
import * as bridge from '../../../scripts/processor/resources-ts/per-block/bridge'
const roots: string[] = []
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const put = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value))
function setup(version = '8.0'): ResourceContext {
  const root = mkdtempSync(join(tmpdir(), 'x4-resources-')); roots.push(root)
  const context: ResourceContext = { config: { version }, rawPath: root, outputRoot: root, paths: { 'maps-json': join(root, 'maps.json'), 'regions-json': join(root, 'regions.json'), 'resource-output-dir': root }, blocksCache: join(root, 'blocks.json') }
  const region = { id: 'field', boundary: { class: 'cylinder', size: { r: 10000, linear: 10000 } }, falloff: {}, resources: [{ ware: 'ore', resourcedensity: 2, delay: 120 }], density: 1, fields: [{ tag: 'asteroid', groupref: 'ore', resource: 'ore', yield: 1 }] }
  put(context.paths['regions-json']!, [region])
  put(context.paths['maps-json']!, { sectors: { A: { id: 'A', cluster_id: 'C', regions: [{ ref: 'field', amount: 2, position: {} }] }, B: { id: 'B', regions: [{ ref: 'field', position: {} }] } } })
  return context
}
const cache = (total: number) => [{ ref: 'field', total: { ore: total }, tiles: [{ x: 0, y: 0, z: 0, wares: { ore: total } }] }]
describe('resources cache state and output', () => {
  it('computes pure-map sidecar inputs in a separate output directory and preserves only destination non-target areas', () => {
    const context = setup(), input = context.outputRoot
    put(context.paths['maps-json']!, { sectors: { a: { id: 'a' } } })
    const inputAreasPath = join(input, 'resourceareas.json')
    put(inputAreasPath, { a: [{ ref: 'field', amount: 2, position: {}, resources: [{ ware: 'ore', resourcedensity: 2, delay: 120 }] }] })
    const inputPaths = [context.paths['maps-json']!, context.paths['regions-json']!, inputAreasPath]
    const before = inputPaths.map(path => readFileSync(path))
    const output = join(input, 'isolated'); mkdirSync(output)
    context.paths['resource-output-dir'] = output; context.outputRoot = output; context.blocksCache = join(output, 'blocks.json')
    const spy = vi.spyOn(bridge, 'calculateResourcePerBlock')
    processResources(context)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(read(join(output, 'map_resources.json')).sectors.a.resources[0].replay_reserve).toBeGreaterThan(0)
    const computedArea = read(join(output, 'resourceareas.json')).a[0]
    expect(computedArea.resources[0].reserve).toBeGreaterThan(0)
    // Destination state is for preservation; it must not replace the source definitions.
    put(join(output, 'resourceareas.json'), { a: [{ ref: 'wrong-destination-input' }], b: [{ ref: 'keep-output-sector' }] })
    context.sector = 'a'; context.forceRecalcPerBlock = true; spy.mockClear()
    processResources(context)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(read(join(output, 'resourceareas.json')).a[0]).toEqual(computedArea)
    expect(read(join(output, 'resourceareas.json')).b).toEqual([{ ref: 'keep-output-sector' }])
    inputPaths.forEach((path, i) => expect(readFileSync(path)).toEqual(before[i]))
  })
  it('cold calculates both sectors, hot reuses them without touching maps or cache', () => {
    const context = setup(), mapBytes = readFileSync(context.paths['maps-json']!)
    const spy = vi.spyOn(bridge, 'calculateResourcePerBlock')
    const cold = processResources(context)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(cold.output_files).toContain(context.blocksCache)
    const bytes = readFileSync(context.blocksCache)
    spy.mockClear(); const hot = processResources(context)
    expect(spy).not.toHaveBeenCalled(); expect(hot.output_files).not.toContain(context.blocksCache)
    expect(readFileSync(context.blocksCache)).toEqual(bytes)
    expect(readFileSync(context.paths['maps-json']!)).toEqual(mapBytes)
    const payload = read(join(context.outputRoot, 'map_resources.json'))
    expect(payload.sectors.a.resources[0].replay_reserve).toBe(payload.sectors.b.resources[0].replay_reserve * 2)
  })
  it('partial caches calculate only missing sectors and retain cached totals', () => {
    const context = setup(); put(context.blocksCache, { a: cache(101) })
    const spy = vi.spyOn(bridge, 'calculateResourcePerBlock')
    processResources(context)
    expect(spy).toHaveBeenCalledTimes(1); expect(spy.mock.calls[0]![0]).toBe('B')
    const payload = read(join(context.outputRoot, 'map_resources.json'))
    expect(payload.sectors.a.resources[0].replay_reserve).toBe(202)
    expect(read(context.blocksCache).a).toEqual(cache(101))
  })
  it('targeted forced updates preserve other sector outputs and caches', () => {
    const context = setup(); processResources(context)
    const previous = read(join(context.outputRoot, 'map_resources.json')).sectors.b, previousAreas = read(join(context.outputRoot, 'resourceareas.json')).B
    put(context.blocksCache, { a: cache(11), b: cache(99) })
    context.sector = 'A'; context.forceRecalcPerBlock = true
    const spy = vi.spyOn(bridge, 'calculateResourcePerBlock'); processResources(context)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(read(context.blocksCache).b).toEqual(cache(99))
    expect(read(join(context.outputRoot, 'map_resources.json')).sectors.b).toEqual(previous)
    expect(read(join(context.outputRoot, 'resourceareas.json')).b).toEqual(previousAreas)
  })
  it.each(['not json', '{"a":{}}', '{"a":[{"ref":"field","total":{},"tiles":[{}]}]}'])('rejects corrupt cache, force recovers: %s', text => {
    const context = setup(); writeFileSync(context.blocksCache, text)
    expect(() => processResources(context)).toThrow(/Blocks cache/)
    expect(readFileSync(context.blocksCache, 'utf8')).toBe(text)
    context.forceRecalcPerBlock = true; expect(processResources(context).status).toBe('success')
  })
  it('calculation failure leaves every previous file intact', () => {
    const context = setup(); processResources(context)
    const paths = [context.blocksCache, join(context.outputRoot, 'resourceareas.json'), join(context.outputRoot, 'map_resources.json')]
    const before = paths.map(path => readFileSync(path))
    context.forceRecalcPerBlock = true
    vi.spyOn(bridge, 'calculateResourcePerBlock').mockImplementation(() => { throw new Error('numeric failure') })
    expect(() => processResources(context)).toThrow('numeric failure')
    paths.forEach((path, i) => expect(readFileSync(path)).toEqual(before[i]))
  })
  it('invalid field yield raises before replacing outputs or cache with NaN/null values', () => {
    const context = setup(); processResources(context)
    const paths = [context.blocksCache, join(context.outputRoot, 'resourceareas.json'), join(context.outputRoot, 'map_resources.json')]
    const before = paths.map(path => readFileSync(path)), regions = read(context.paths['regions-json']!)
    regions[0].fields[0].yield = 'oops'; put(context.paths['regions-json']!, regions)
    context.forceRecalcPerBlock = true
    expect(() => processResources(context)).toThrow(/Invalid numeric state value/)
    paths.forEach((path, i) => expect(readFileSync(path)).toEqual(before[i]))
  })
  it('rejects output/cache paths that would overwrite maps-json', () => {
    const context = setup(), bytes = readFileSync(context.paths['maps-json']!)
    context.blocksCache = context.paths['maps-json']!
    expect(() => processResources(context)).toThrow(/overwrite maps-json/)
    expect(readFileSync(context.paths['maps-json']!)).toEqual(bytes)
  })
  it('force can recover a corrupt cache when there are no resources', () => {
    const context = setup(); put(context.paths['maps-json']!, { sectors: {} }); writeFileSync(context.blocksCache, 'bad')
    context.forceRecalcPerBlock = true
    processResources(context)
    expect(read(context.blocksCache)).toEqual({})
  })
  it('save override changes actual values/rating after replay but leaves areas at replay values', () => {
    const context = setup(); put(context.blocksCache, { a: cache(101), b: cache(101) })
    context.saveSampleDir = join(context.outputRoot, 'saves'); mkdirSync(context.saveSampleDir)
    put(join(context.saveSampleDir, 'a.json'), { sector_id: 'A', ware: { ore: [{ max: 30001, time: 3600, x: -480000, y: 64000, z: 480000 }] } })
    processResources(context)
    const resource = read(join(context.outputRoot, 'map_resources.json')).sectors.a.resources[0]
    expect(resource).toMatchObject({ reserve: 30001, respawn: 30001, replay_reserve: 202, replay_respawn: 100, rating: 3 })
    expect(read(join(context.outputRoot, 'resourceareas.json')).A[0].resources[0].reserve).toBe(101)
    context.saveSampleDir = join(context.outputRoot, 'absent')
    expect(() => processResources(context)).toThrow(/Save sample directory/)
  })
  it('cache paths are exclusive and legacy cache reads are validated', () => {
    const context = setup(); put(join(context.outputRoot, 'blocks.json'), { a: cache(11), b: cache(11) })
    context.blocksCache = join(context.outputRoot, 'another-version.json')
    const spy = vi.spyOn(bridge, 'calculateResourcePerBlock'); processResources(context)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(normalizeBlocksCache({ regions: [{ sector_id: 'A', ...cache(1)[0] }] })).toEqual({ grouped: { a: cache(1) }, legacy: true })
  })
})
describe('resource aggregation and estimators', () => {
  it('preserves amount weighting, optional theoretical fields, ware order and half-even', () => {
    expect(aggregateSectorResources([{ sector_id: 'a', amount: 3, resources: [{ ware: 'z', reserve: 2.5, respawn: 1.5, theoretical_reserve: 8.5 }, { ware: 'a', reserve: 0 }] }])).toEqual({ a: [{ ware: 'a', reserve: 0, respawn: 0, replay_reserve: 0, replay_respawn: 0, rating: 0 }, { ware: 'z', reserve: 0, respawn: 0, replay_reserve: 8, replay_respawn: 4, rating: 0, theoretical_reserve: 8 }] })
    expect(summarizeSectorResources([{ resources: [{ ware: ' ore ', yield: '2.5', respawn: '3.5' }] }])).toEqual([{ ware: 'ore', amount: 2, respawn: 4 }])
    expect([99, 100, 300, 1000, 3000].map(n => calculateRating(n, 'nividium'))).toEqual([1, 2, 3, 4, 5])
    expect(roundSignificant(123456.6, 3)).toBe(123457)
  })
  it('clips estimator volumes and preserves gas sphere discretization', () => {
    expect(calculateSolidVolumeTruncated({ class: 'box', size: { x: 3000000, y: 2, z: 3 } })).toEqual([18000000, 12288000])
    expect(calculateGasVolumeKm3({}, { class: 'sphere', size: { r: 32001 } })).toEqual([125 * 64 ** 3, 125 * 64 ** 3])
    expect(calculateGasBlockCount({}, { class: 'unknown' })).toEqual([1, 0])
  })
  it('save bounds are inclusive and ignore negative reserves and out-of-range tiles', () => {
    expect(aggregateTilesForWare([{ x: -480000, y: -64000, z: 480000, max: 2, time: 3600 }, { y: 64001, max: 100, time: 1 }, { max: -1, time: 1 }, { max: 3, time: 0 }])).toEqual([5, 2])
    expect(calculateSaveResourcesForSector({ ware: { ore: [{ max: 1, time: 7 }] } })).toEqual([{ ware: 'ore', reserve: 1, respawn: 514 }])
  })
})
describe('modern resources', () => {
  it('rebuilds empty definitions/references from XML before writing and preserves prior output on missing XML', () => {
    const context = setup('9.0')
    put(join(context.outputRoot, 'regionyield_definitions.json'), [])
    put(context.paths['maps-json']!, { sectors: { cluster_01_sector001_macro: { regions: [] } } })
    const yields = join(context.outputRoot, 'yields.xml'), defaults = join(context.outputRoot, 'defaults.xml')
    writeFileSync(yields, '<regionyields><boundaries><boundary id="sphere_small"><size r="1000"/></boundary></boundaries><gatherspeeds><gatherspeed id="normal" factor="2" rating="3"/></gatherspeeds><yields><yield id="medium"><ware id="ore" yield="50" respawndelay="30"/></yield></yields></regionyields>')
    writeFileSync(defaults, '<defaults><dataset macro="Cluster_01_Sector001_macro"><properties><resourceareas><resourcearea ref="sphere_small_ore_medium_normal" amount="2"/></resourceareas></properties></dataset></defaults>')
    context.paths['regionyields-xml'] = yields; context.paths['mapdefaults-xml'] = defaults
    const summary = processResources(context)
    expect(summary.output_files).toContain(join(context.outputRoot, 'regionyield_definitions.json'))
    expect(read(join(context.outputRoot, 'map_resources.json')).sectors.cluster_01_sector001_macro.resources[0]).toEqual({ ware: 'ore', reserve: 100, respawn: 200, rating: 1 })
    const bytes = readFileSync(join(context.outputRoot, 'map_resources.json'))
    context.paths['mapdefaults-xml'] = join(context.outputRoot, 'missing.xml')
    expect(() => processResources(context)).toThrow()
    expect(readFileSync(join(context.outputRoot, 'map_resources.json'))).toEqual(bytes)
  })
  it('aggregates definitions, uses raw respawn for rating, retains maps and targeted sectors', () => {
    const context = setup('9.0'), bytes = readFileSync(context.paths['maps-json']!)
    put(join(context.outputRoot, 'regionyield_definitions.json'), [{ id: 'field', ware: 'ore', yield: 4999.95, respawnDelay: 30, rating: 2, gatherspeedfactor: 4 }])
    processResources(context)
    const map = read(join(context.outputRoot, 'map_resources.json'))
    expect(map.sectors.a.resources[0]).toEqual({ ware: 'ore', reserve: 10000, respawn: 20000, rating: 2 })
    const b = map.sectors.b
    context.sector = 'a'; processResources(context)
    expect(read(join(context.outputRoot, 'map_resources.json')).sectors.b).toEqual(b)
    expect(readFileSync(context.paths['maps-json']!)).toEqual(bytes)
    expect(read(join(context.outputRoot, 'resourceareas.json'))).toHaveLength(2)
    context.forceRecalcPerBlock = true; expect(() => processResources(context)).toThrow(/unsupported/)
  })
})
