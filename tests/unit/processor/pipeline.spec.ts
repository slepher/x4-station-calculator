import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseTargets, planProcessor, processorTargets, targetFiles } from '../../../scripts/processor/targets'
import { parseProcessorArgs, resolveContext, type ProcessorConfig } from '../../../scripts/processor/shared-ts/config'
import { processPipeline } from '../../../scripts/processor/pipeline'
import { X4PrecisionLoader } from '../../../scripts/processor/data-ts/loader'
import * as io from '../../../scripts/processor/shared-ts/io'
import { cli, runProcessor } from '../../../scripts/x4_processor'

const dirs: string[] = []
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const config: ProcessorConfig = { versions: [{ version: '8.0', folder_name: '8' }, { version: '9.0', folder_name: '9' }],
  current_version: '9.0', beta: false, raw_assets_dir: 'raw', processed_assets_dir: 'out', dlc_order: [] }
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
function setup(version = '9.0') {
  const root = mkdtempSync(join(tmpdir(), 'x4-pipeline-')); dirs.push(root)
  const raw = join(root, 'raw', version === '9.0' ? '9' : '8')
  const put = (name: string, text: string) => { const path = join(raw, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); return path }
  put('libraries/wares/final.xml', '<wares><ware id="ore" name="{1,1}" transport="solid"><price min="1" average="2" max="3"/></ware><ware id="research_test" transport="research" name="{1,2}"><research time="30"/></ware><ware id="ship" name="{1,3}" tags="ship" transport="ship"><component ref="ship_arg_s_test_macro"/></ware><ware id="engine" name="{1,4}" tags="equipment"><component ref="engine"/></ware></wares>')
  put('libraries/defaults/final.xml', '<defaults/>')
  put('libraries/module_macros.xml', '<macros/>')
  put('libraries/ship_macros.xml', '<macros><macro name="ship_arg_s_test_macro" class="ship_s"><component ref="ship"/><properties><ship type="transport"/><people capacity="1"/></properties></macro></macros>')
  put('libraries/ship_components.xml', '<components><component name="ship"><connections><connection name="cockpit" tags="cockpit"/><connection name="engine" tags="engine small standard"/></connections></component></components>')
  put('libraries/equipment_macros.xml', '<macros><macro name="engine" class="engine"><component ref="engine"/><properties/></macro></macros>')
  put('libraries/equipment_components.xml', '<components><component name="engine"><connections><connection tags="component engine small standard"/></connections></component></components>')
  put('libraries/colors/final.xml', '<colors/>')
  put('libraries/factions/final.xml', '<factions><faction id="argon" name="{1,5}" tags="claimspace"/></factions>')
  put('libraries/terraforming/final.xml', '<terraforming><projects><project id="test" name="{1,6}"/></projects></terraforming>')
  put('libraries/regionyields/final.xml', '<regionyields><definitions><definition id="field" ware="ore" yield="10" respawndelay="30"><boundary class="sphere"><size r="1"/></boundary></definition></definitions></regionyields>')
  put('libraries/region_definitions/final.xml', '<regions/>')
  put('libraries/regionobjectgroups/final.xml', '<groups/>')
  put('libraries/mapdefaults/final.xml', '<mapdefaults><dataset macro="cluster_01_macro"><properties><identification name="{1,7}"/></properties></dataset><dataset macro="cluster_01_sector001_macro"><properties><identification name="{1,8}"/><resourceareas><resourcearea ref="field" amount="2"/></resourceareas></properties></dataset></mapdefaults>')
  for (const name of ['galaxy', 'clusters', 'sectors', 'zones', 'zonehighways', 'sechighways']) put(`maps/xu_ep2_universe/${name}/final.xml`, '<macros/>')
  put('maps/xu_ep2_universe/galaxy/final.xml', '<macros><macro class="galaxy"><connections><connection ref="clusters"><macro ref="Cluster_01_macro"/><offset><position x="15000000" z="8660000"/></offset></connection></connections></macro></macros>')
  put('maps/xu_ep2_universe/clusters/final.xml', '<macros><macro class="cluster" name="Cluster_01_macro"><connections><connection ref="sectors"><macro ref="Cluster_01_Sector001_macro"/></connection></connections></macro></macros>')
  put('maps/xu_ep2_universe/sectors/final.xml', '<macros><macro class="sector" name="Cluster_01_Sector001_macro"><connections><connection ref="zones"><macro ref="zone001_cluster_01_sector001_macro"/></connection></connections></macro></macros>')
  put('maps/xu_ep2_universe/zones/final.xml', '<macros><macro class="zone" name="zone001_cluster_01_sector001_macro"/></macros>')
  put('t/0001-L044.xml', '<language><page id="1">' + ['Ore', 'Research', 'Ship', 'Engine', 'Argon', 'Project', 'Cluster', 'Sector'].map((name, i) => `<t id="${i + 1}">${name}</t>`).join('') + '</page><page id="20221"><t id="1">Transport</t></page><page id="20109"><t id="1">Engine</t></page><page id="20228"><t id="1">Standard</t></page></language>')
  const context = (target: string, output = target.replaceAll(',', '-'), options: string[] = []) => resolveContext(config, config.versions.find(item => item.version === version)!, parseProcessorArgs([target, '--output-dir', join(root, output), ...options]), root)
  return { root, raw, put, context }
}

describe('one processor pipeline', () => {
  it('normalizes every public target and rejects invalid selections', () => {
    for (const target of processorTargets) expect(parseProcessorArgs([target]).targets).toEqual([target])
    expect(parseTargets('data')).toEqual(['all'])
    expect(parseTargets('map,resources')).toEqual(['maps', 'map-resources'])
    for (const value of ['', 'wares,', ',ships', 'nope', 'wares,wares', 'map,maps', 'resources,map-resources', 'all,ships', 'all,data']) expect(() => parseTargets(value)).toThrow()
    expect(() => parseProcessorArgs([])).toThrow('缺少目标')
  })

  it('deduplicates shared stages without expanding saved targets', () => {
    const plan = planProcessor(parseTargets('slot-tags,ships'))
    expect(plan.stages.filter(stage => stage === 'database')).toHaveLength(1)
    expect(plan.stages).toContain('equipments')
    expect([...plan.files]).not.toContain('equipments')
    expect(planProcessor(parseTargets('languages')).stages).toContain('maps')
    expect(planProcessor(parseTargets('languages')).stages).not.toContain('map-resources')
  })

  it('validates resource scope, versions and isolated outputs', () => {
    for (const target of ['all', 'data', 'maps,map-resources']) expect(() => parseProcessorArgs([target, '--sector', 's'])).toThrow('唯一目标')
    expect(() => parseProcessorArgs(['wares', '--blocks-cache', '/tmp/cache'])).toThrow()
    for (const option of ['--blocks-cache', '--save-sample-dir']) expect(() => resolveContext(config, config.versions[1]!, parseProcessorArgs(['all', option, '/tmp/foo']))).toThrow('不适用')
    expect(() => resolveContext(config, config.versions[1]!, parseProcessorArgs(['all', '--force-recalc-per-block']))).toThrow('不适用')
    const args = parseProcessorArgs(['all', '--all-versions', '--output-dir', '/tmp/processor'])
    expect(config.versions.map(version => resolveContext(config, version, args).outputRoot)).toEqual(['/tmp/processor/8', '/tmp/processor/9'])
    expect(() => resolveContext(config, config.versions[0]!, parseProcessorArgs(['map-resources', '--maps-json', '/missing-input']))).toThrow('输入不存在')
  })

  it.each(['8.0', '9.0'])('%s: every target runs from empty output and matches all owned data', async version => {
    const f = setup(version)
    const all = f.context('all')
    all.blocksCache = join(f.root, 'all-cache.json')
    await processPipeline(all, () => {})
    for (const target of processorTargets) {
      const context = f.context(target); context.blocksCache = join(f.root, `${target}-cache.json`)
      const result = await processPipeline(context, () => {})
      for (const name of targetFiles[target]) expect(read(join(context.outputRoot, 'data', `${name}.json`))).toEqual(read(join(all.outputRoot, 'data', `${name}.json`)))
      const allowed = new Set([...targetFiles[target], 'languages'])
      if (target === 'map-resources') for (const name of version === '8.0' ? ['regions', 'regionyields'] : ['regionyield_definitions']) allowed.add(name)
      expect(readdirSync(join(context.outputRoot, 'data')).every(file => allowed.has(file.slice(0, -5)))).toBe(true)
      expect(new Set(result.files).size).toBe(result.files.length)
    }
    expect(read(join(all.outputRoot, 'data/research.json')).items[0].name).toBe('Research')
    expect(read(join(all.outputRoot, 'data/ships.json'))[0].name).toBe('Ship')
    expect(read(join(all.outputRoot, 'locales/en.json'))).toMatchObject({ '{1,1}': 'Ore', '{1,5}': 'Argon', '{1,8}': 'Sector' })
  })

  it('deduplicates shared work, preserves unselected files and translations, and ignores target order', async () => {
    const f = setup(); const a = f.context('ships,equipments')
    mkdirSync(join(a.outputRoot, 'data'), { recursive: true }); mkdirSync(join(a.outputRoot, 'locales'))
    writeFileSync(join(a.outputRoot, 'data/maps.json'), 'unselected bytes')
    writeFileSync(join(a.outputRoot, 'locales/en.json'), JSON.stringify({ unrelated: 'Keep', '{1,3}': 'Old' }))
    writeFileSync(join(a.outputRoot, 'locales/custom.json'), '{"custom":"Keep"}')
    const spy = vi.spyOn(X4PrecisionLoader.prototype, 'buildDatabase')
    await processPipeline(a, () => {})
    expect(spy).toHaveBeenCalledTimes(1)
    expect(readFileSync(join(a.outputRoot, 'data/maps.json'), 'utf8')).toBe('unselected bytes')
    const locale = read(join(a.outputRoot, 'locales/en.json'))
    expect(locale).toMatchObject({ unrelated: 'Keep', '{1,3}': 'Ship' })
    expect(Object.keys(locale)).toEqual(Object.keys(locale).sort())
    expect(read(join(a.outputRoot, 'data/languages.json')).some((item: any) => item.code === 'custom')).toBe(true)
    const b = f.context('equipments,ships'); await processPipeline(b, () => {})
    for (const name of ['ships', 'equipments', 'ship_types', 'equipment_types']) expect(read(join(a.outputRoot, 'data', `${name}.json`))).toEqual(read(join(b.outputRoot, 'data', `${name}.json`)))
  })

  it('uses the fresh map, writes each resource file once and keeps maps/resources ownership separate', async () => {
    const f = setup(); const all = f.context('all')
    mkdirSync(join(all.outputRoot, 'data'), { recursive: true }); writeFileSync(join(all.outputRoot, 'data/maps.json'), '{}')
    const writes = vi.spyOn(io, 'writeJson')
    await processPipeline(all, () => {})
    expect(read(join(all.outputRoot, 'data/map_resources.json')).sectors.cluster_01_sector001_macro.resources[0].reserve).toBe(20)
    for (const name of ['maps', 'resourceareas', 'regionyield_definitions']) expect(writes.mock.calls.filter(([path]) => path === join(all.outputRoot, 'data', `${name}.json`))).toHaveLength(1)
    const maps = f.context('maps'); await processPipeline(maps, () => {})
    expect(existsSync(join(maps.outputRoot, 'data/factions.json'))).toBe(false)
    expect(existsSync(join(maps.outputRoot, 'data/resourceareas.json'))).toBe(false)
    const resources = f.context('map-resources'); await processPipeline(resources, () => {})
    expect(existsSync(join(resources.outputRoot, 'data/maps.json'))).toBe(false)
    expect(existsSync(join(resources.outputRoot, 'data/factions.json'))).toBe(false)
  })

  it('uses explicit external map inputs, fails invalid JSON and does not silently rebuild them', async () => {
    const f = setup(); const all = f.context('all'); await processPipeline(all, () => {})
    const maps = join(all.outputRoot, 'data/maps.json'); const data = read(maps)
    data.sectors.cluster_01_sector001_macro.regions = [{ ref: 'field', amount: 5 }]; writeFileSync(maps, JSON.stringify(data))
    rmSync(join(f.raw, 'maps'), { recursive: true })
    const external = f.context('map-resources', 'external', ['--maps-json', maps])
    await processPipeline(external, () => {})
    expect(read(join(external.outputRoot, 'data/map_resources.json')).sectors.cluster_01_sector001_macro.resources[0].reserve).toBe(50)
    writeFileSync(maps, '{}')
    await expect(processPipeline(external, () => {})).rejects.toThrow('[9.0:map-resources] Invalid maps JSON')
  })

  it('reports the failed version/stage, stops subsequent stages and versions, and isolates state', async () => {
    const f = setup(); const visited: string[] = []; const logs: string[] = []
    const versions = { ...config, versions: [...config.versions, { version: '10.0', folder_name: '10' }] }
    await expect(runProcessor(parseProcessorArgs(['data', '--all-versions']), versions, async context => {
      expect(context.config.dlc_order).toEqual([]); context.config.dlc_order.push('mutation'); visited.push(context.config.version)
      if (context.config.version === '9.0') { const target = f.context('maps'); rmSync(join(f.raw, 'maps'), { recursive: true }); return processPipeline(target, text => logs.push(text)) }
    }, text => logs.push(text))).rejects.toThrow('[9.0:maps]')
    expect(visited).toEqual(['8.0', '9.0']); expect(config.dlc_order).toEqual([])
    expect(logs.filter(text => text.includes('完成'))).toHaveLength(1)
    expect(logs.some(text => text.includes(':save'))).toBe(false)
    const missing = f.context('wares'); missing.rawPath = join(f.root, 'missing')
    await expect(processPipeline(missing, () => {})).rejects.toThrow('[9.0:initialize]')
  })

  it('returns a nonzero CLI exit for invalid target and resource scope', async () => {
    const previous = process.exitCode, errors = vi.spyOn(console, 'error').mockImplementation(() => {}), logs = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      for (const argv of [['unknown'], ['all', '--sector', 'a'], ['all', '--version', '9.0', '--force-recalc-per-block']]) {
        process.exitCode = 0; errors.mockClear()
        await cli(argv)
        expect(process.exitCode).toBe(1); expect(errors).toHaveBeenCalledOnce()
      }
      expect(logs).not.toHaveBeenCalled()
    } finally { process.exitCode = previous }
  })

  it('8.0: explicit inputs support hot/forced sector updates and corrupt-cache recovery without changing other sectors', async () => {
    const f = setup('8.0'), input = join(f.root, 'input'); mkdirSync(input)
    const maps = join(input, 'maps.json'), regions = join(input, 'regions.json')
    writeFileSync(maps, JSON.stringify({ sectors: { a: { id: 'a', regions: [{ ref: 'field', amount: 2, position: {} }] }, b: { id: 'b', regions: [{ ref: 'field', position: {} }] } } }))
    writeFileSync(regions, JSON.stringify([{ id: 'field', boundary: { class: 'cylinder', size: { r: 10000, linear: 10000 } }, falloff: {}, density: 1, resources: [{ ware: 'ore', resourcedensity: 2, delay: 120 }], fields: [{ tag: 'asteroid', groupref: 'ore', resource: 'ore', yield: 1 }] }]))
    const options = ['--maps-json', maps, '--regions-json', regions, '--blocks-cache', join(f.root, 'blocks.json')]
    rmSync(join(f.raw, 'maps'), { recursive: true })
    const context = f.context('map-resources', 'resources', options)
    const source = [readFileSync(maps), readFileSync(regions)]
    await processPipeline(context, () => {})
    const cache = readFileSync(context.blocksCache), prior = read(join(context.outputRoot, 'data/map_resources.json')).sectors.b
    const priorAreas = read(join(context.outputRoot, 'data/resourceareas.json')).b
    await processPipeline(context, () => {}); expect(readFileSync(context.blocksCache)).toEqual(cache)
    const sector = f.context('map-resources', 'resources', [...options, '--sector', 'a', '--force-recalc-per-block'])
    await processPipeline(sector, () => {})
    expect(read(join(context.outputRoot, 'data/map_resources.json')).sectors.b).toEqual(prior)
    expect(read(join(context.outputRoot, 'data/resourceareas.json')).b).toEqual(priorAreas)
    expect(read(context.blocksCache).b).toEqual(JSON.parse(cache.toString()).b)
    writeFileSync(context.blocksCache, 'corrupt')
    await expect(processPipeline(context, () => {})).rejects.toThrow('[8.0:map-resources] Blocks cache')
    context.forceRecalcPerBlock = true; await processPipeline(context, () => {})
    expect(read(context.blocksCache).a.length).toBeGreaterThan(0)
    expect(readFileSync(maps)).toEqual(source[0]); expect(readFileSync(regions)).toEqual(source[1])
    expect(existsSync(join(context.outputRoot, 'data/regionyields.json'))).toBe(true)
  })

  it('9.0: sector updates preserve other outputs and explicit output paths belong only to selected targets', async () => {
    const f = setup(), all = f.context('all'); const factionPath = join(f.root, 'custom/factions.json')
    all.paths['factions-output'] = factionPath
    await processPipeline(all, () => {})
    expect(read(factionPath)[0].name).toBe('Argon')
    expect(existsSync(join(all.outputRoot, 'data/factions.json'))).toBe(false)
    const maps = join(all.outputRoot, 'data/maps.json'), payload = read(maps)
    payload.sectors.b = { id: 'b', regions: [{ ref: 'field', amount: 3 }] }
    payload.sectors.cluster_01_sector001_macro.regions = [{ ref: 'field', amount: 2 }]
    writeFileSync(maps, JSON.stringify(payload))
    const options = ['--maps-json', maps]
    const context = f.context('map-resources', 'resources', options); await processPipeline(context, () => {})
    const prior = read(join(context.outputRoot, 'data/map_resources.json')).sectors.b
    const priorArea = read(join(context.outputRoot, 'data/resourceareas.json')).find((row: any) => row.sector_id === 'b')
    await processPipeline(f.context('map-resources', 'resources', [...options, '--sector', 'cluster_01_sector001_macro']), () => {})
    expect(read(join(context.outputRoot, 'data/map_resources.json')).sectors.b).toEqual(prior)
    expect(read(join(context.outputRoot, 'data/resourceareas.json')).find((row: any) => row.sector_id === 'b')).toEqual(priorArea)
  })
})
