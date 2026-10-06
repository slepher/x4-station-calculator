import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { X4PrecisionLoader, roundProduction } from '../../../scripts/processor/data-ts/loader'
import { processData } from '../../../scripts/processor/data-ts/index'
import * as mapProcessor from '../../../scripts/processor/map-ts/index'
import { compareDirectories } from '../../../scripts/processor/compare'
import { loadProcessorConfig, parseProcessorArgs, resolveContext, type ProcessorContext } from '../../../scripts/processor/shared-ts/config'

const directories: string[] = []
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function fixture(files: Record<string, string>, config: Record<string, any> = {}) {
  const raw = mkdtempSync(join(tmpdir(), 'x4-data-unit-'))
  directories.push(raw)
  for (const [name, text] of Object.entries(files)) {
    const path = join(raw, name)
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text)
  }
  return new X4PrecisionLoader(raw, join(raw, 'output'), config)
}
const price = '<price min="5" average="10" max="15"/>'
const build = '<production method="default" time="30" amount="1"><primary><ware ware="ore" amount="3"/></primary></production>'

describe('native X4 data domains', () => {
  it('preserves commodity filters, null tiers, BoGas, consumption and DLC first attribution', () => {
    const loader = fixture({
      'libraries/wares/base.xml': '<wares><ware id="ore"/></wares>',
      'libraries/wares/dlc_split.xml': '<diff><add sel="/wares"><ware id="bogas"/><ware id="ore"/></add></diff>',
      'libraries/wares/dlc_terran.xml': '<wares><ware id="bogas"/><ware id="ice"/></wares>',
      'libraries/wares/final.xml': `<wares>
        <ware id="ore" name="Ore" tags="transmutable" transport="solid" volume="2">${price}</ware>
        <ware id="bogas" name="BoGas" group="refined" transport="container">${price}<production time="60" amount="2"><primary><ware ware="ore" amount="1"/></primary></production></ware>
        <ware id="unconnected" name="Unconnected" transport="condensate">${price}</ware>
        <ware id="nividiumgems" name="Filtered" transport="container">${price}</ware>
        <ware id="module" name="Module" transport="container" tags="module"><component ref="module_macro"/>${price}${build}</ware>
        <ware id="workunit_idle" transport="workunit"><production method="argon" time="600" amount="200"><primary><ware ware="food" amount="40"/></primary></production></ware>
        <ware id="workunit_busy" transport="workunit"><production method="argon" time="600" amount="200"><primary><ware ware="food" amount="80"/></primary></production></ware>
      </wares>`
    }, { dlc_order: ['ego_dlc_split', 'ego_dlc_terran'] })
    loader.buildDatabase()
    expect(loader.wares_data.map(w => [w.id, w.tier])).toEqual([['ore', 0], ['bogas', 1], ['unconnected', null]])
    expect(loader.wares_data[0]).toMatchObject({ transmutable: true, volume: 2, price: 10 })
    expect(loader.wares_data[1]).toMatchObject({ group: 'agricultural', dlc_tag: 'dlc_split' })
    expect(loader.ware_index.bogas!.group).toBe('refined')
    expect(loader.ware_dlc_tags).toEqual({ ore: 'base', bogas: 'dlc_split', ice: 'dlc_terran' })
    expect(loader.race_consumption.argon).toEqual({ idle: { food: 1.2 }, busy: { food: 2.4 } })
    expect(loader.valid_macros.module_macro).toMatchObject({ build_cost: { ore: 3 }, build_time: 30 })
  })

  it('uses sequence time across queue items and scales default processing products', () => {
    const loader = fixture({
      'libraries/wares/final.xml': `<wares>
        <ware id="ore" transport="solid">${price}</ware>
        <ware id="a" transport="container" group="refined">${price}<production time="60" amount="3"><primary><ware ware="ore" amount="2"/></primary><effects><effect type="work" product="0.3"/></effects></production></ware>
        <ware id="b" transport="container">${price}<production time="120" amount="4"><primary><ware ware="ore" amount="1"/></primary></production></ware>
        <ware id="processed" transport="container">${price}<production method="processing" time="30" amount="2"><primary><ware ware="ore" amount="5"/></primary></production></ware>
        <ware id="producer" tags="module"><component ref="producer_macro"/>${build}</ware>
        <ware id="processor" tags="module"><component ref="processor_macro"/></ware>
        <ware id="dock" tags="module"><component ref="dock_macro"/></ware>
      </wares>`,
      'libraries/defaults/final.xml': '<defaults><dataset class="processingmodule"><properties><products><ware ware="processed" amount="8"/></products></properties></dataset></defaults>',
      'libraries/module_macros.xml': `<macros>
        <macro name="producer_macro" class="production"><properties><build/><workforce max="12" capacity="20"/><production><queue><item ware="a" method="absent"/><item ware="b"/></queue></production></properties></macro>
        <macro name="processor_macro" class="processingmodule"><properties><build/><identification makerrace="xenon"/></properties></macro>
        <macro name="dock_macro" class="pier"><connections><connection/><connection/></connections></macro>
      </macros>`
    })
    loader.buildDatabase(); loader.scanAssets()
    expect(loader.all_modules[0]).toMatchObject({ group: 'refined', cycleTime: 180, outputs: { a: 60, b: 80 }, inputs: { ore: 60 },
      workforce: { needed: 12, capacity: 20, maxBonus: 0.3 }, tier: 1, buildCost: { ore: 3 } })
    expect(loader.all_modules[1]).toMatchObject({ cycleTime: 30, outputs: { processed: 960 }, inputs: { ore: 2400 }, isPlayerBlueprint: false })
    expect(loader.all_modules[2]!.dockingCount).toBe(2)
    expect(roundProduction(2.675)).toBe(2.67)
    expect(roundProduction(0.125)).toBe(0.12)
    expect(roundProduction(-0.375)).toBe(-0.38)
  })

  it('assembles ship storage and groups, derives equipment slots from components, and filters inaccessible ships', () => {
    const loader = fixture({
      'libraries/wares/final.xml': `<wares>
        <ware id="ship" name="Ship" tags="ship noplayerblueprint" transport="ship"><component ref="ship_arg_l_test_macro"/>${build}</ware>
        <ware id="uncrewed" name="Uncrewed" tags="ship" transport="ship"><component ref="ship_arg_s_uncrewed_macro"/>${build}</ware>
        <ware id="engine" name="Engine" tags="equipment noplayerblueprint"><component ref="engine_macro"/>${build}</ware>
      </wares>`,
      'libraries/ship_components.xml': `<components><component name="ship_component"><connections>
        <connection name="cockpit" tags="cockpit"/>
        <connection name="engine_b" group="B" tags="engine large standard mandatory symmetry1"/>
        <connection name="engine_a" group="A" tags="engine large advanced"/>
        <connection name="shield_a" group="A" tags="shield medium standard"/>
      </connections></component></components>`,
      'libraries/ship_macros.xml': `<macros>
        <macro name="ship_arg_l_test_macro" class="ship_l"><component ref="ship_component"/><properties><ship type="transport"/><purpose primary="mine"/><people capacity="10"/><storage missile="12" unit="2"/><hull max="100"/><thruster tags="thruster large standard"/></properties><connections><connection><macro ref="cargo"/></connection><connection><macro ref="dockarea"/></connection></connections></macro>
        <macro name="ship_arg_s_uncrewed_macro" class="ship_s"><component ref="ship_component"/><properties><people capacity="0"/></properties></macro>
      </macros>`,
      'libraries/ship_connection_macros.xml': `<macros>
        <macro name="cargo" class="storage"><properties><cargo tags="solid liquid" max="500"/></properties></macro>
        <macro name="dockarea" class="dockarea"><properties/><connections><connection><macro ref="bay"/></connection><connection><macro ref="bay"/></connection><connection><macro ref="hangar"/></connection></connections></macro>
        <macro name="bay" class="dockingbay"><properties><dock capacity="2"/><docksize tags="dock_s"/></properties></macro>
        <macro name="hangar" class="dockingbay"><properties><dock capacity="3" storage="1"/><docksize tags="dock_m"/></properties></macro>
      </macros>`,
      'libraries/loadouts/final.xml': '<loadouts><loadout macro="ship_arg_l_test_macro"><macros><engine macro="engine_macro" path="../engine_a" optional="1"/></macros><groups><engines macro="engine_macro" group="A" exact="2"/></groups></loadout></loadouts>',
      'libraries/defaults/final.xml': '<defaults><dataset class="ship_l"><properties><radar range="30000"/><storage countermeasure="4" deployable="6"/></properties></dataset></defaults>',
      'libraries/equipment_components.xml': '<components><component name="engine_component"><connections><connection tags="component engine large standard"/></connections></component></components>',
      'libraries/equipment_macros.xml': '<macros><macro name="engine_macro" class="engine"><component ref="engine_component"/><properties><identification mk="2" makerrace="argon"/><hull integrated="false"/><thrust forward="100" reverse="25"/></properties></macro></macros>'
    })
    loader.buildDatabase(); loader.parseShipAndEquipmentData()
    expect(loader.loadouts_map.ship_arg_l_test_macro).toEqual({ A: { engine: { engine_macro: { count: 3, optional: 1 } } } })
    expect(loader.ships_data).toHaveLength(1)
    expect(loader.ships_data[0]).toMatchObject({ race: 'argon', noplayerblueprint: true, noplayerbuild: false, radarRange: 30000,
      cargo: [{ type: 'solid', capacity: 500 }, { type: 'liquid', capacity: 500 }], droneTags: ['mine', 'liquid', 'solid'],
      dockarea: [{ size: 'dock_s', capacity: 2 }], shipstorage: [{ size: 'dock_m', capacity: 3 }], storage: { missile: 12, unit: 2, countermeasure: 4, deployable: 6 } })
    const engineSlot = loader.ships_data[0]!.slots[0]
    expect(engineSlot.count).toEqual({ large: 2 })
    expect(engineSlot.groups.map((g: any) => g.group)).toEqual(['A', 'B'])
    expect(engineSlot.groups[0].connection.shield).toEqual({ size: 'medium', tags: ['standard'], count: 1 })
    expect(loader.equipments_data[0]).toMatchObject({ type: 'engine', size: 'large', slotTags: ['standard'], tags: ['equipment'],
      integrated: false, noplayerblueprint: true, thrust: { forward: 100, reverse: 25 }, cost: { default: { ore: 3 } }, buildTime: { default: 30 } })
    expect(loader.shipSlotsMaxes().ship_l).toEqual([{ slot: 'engine', size: 'large', count: 2 }, { slot: 'thruster', size: 'large', count: 1 }])
  })

  it('retains beam heat, range independent of ammunition, reload rates and drone classifications', () => {
    const loader = fixture({
      'libraries/wares/final.xml': `<wares>
        <ware id="gasdrone" name="Gas Drone" tags="equipment noplayerblueprint"><component ref="gas_macro"/>${build}</ware>
        <ware id="repairdrone" name="Repair Drone" tags="equipment"><component ref="repair_macro"/></ware>
        <ware id="missile" name="Missile" tags="equipment"><component ref="missile_macro"/>${build}</ware>
        <ware id="probe" name="Probe" tags="equipment"><component ref="probe_macro"/></ware>
      </wares>`,
      'libraries/equipment_macros.xml': `<macros>
        <macro name="gas_macro" class="ship_xs"><properties><purpose primary="mine"/><storage unit="12"/><gatherrate gas="5"/></properties></macro>
        <macro name="repair_macro" class="ship_s"><properties><purpose primary="build"/><loadouts><loadout><macros><engine macro="engine_gen_xs_repairdrone_01_macro"/></macros></loadout></loadouts></properties></macro>
        <macro name="missile_macro" class="missile"><properties><missile amount="2" lifetime="5" range="100" tags="guided"/><explosiondamage value="200"/><reload time="3"/><hull max="4"/><countermeasure resilience="0.5"/><ammunition value="8"/></properties></macro>
        <macro name="probe_macro" class="resourceprobe"><properties><identification deployable="1"/></properties></macro>
      </macros>`,
      'libraries/bullet_macros.xml': `<macros>
        <macro name="beam"><properties><bullet speed="299792500" lifetime="1" range="2000"/><heat initial="4" value="8"/><reload rate="2"/><damage value="10"/></properties></macro>
        <macro name="shot"><properties><bullet speed="100" lifetime="3" amount="4" barrelamount="2"/><heat value="6"/><ammunition value="2" reload="5"/><reload time="0.1"/><damage repair="9"/></properties></macro>
      </macros>`
    })
    loader.buildDatabase(); loader.buildDronesAndConsumables(); loader.buildMissiles(); loader.buildBullets()
    expect(loader.drones_data[0]).toMatchObject({ cargo: [{ type: 'liquid', capacity: 12 }], droneTags: ['mine', 'liquid'], noplayerblueprint: true })
    expect(loader.drones_data[1]!.droneTags).toEqual([])
    expect(loader.consumables_data[0]).toMatchObject({ class: 'resourceprobe', deployable: true })
    expect(loader.missiles_data[0]).toMatchObject({ amount: 2, lifetime: 5, range: 100, missileTags: ['guided'], explosive: 200, reload: 3, hull: 4, resilience: 0.5, ammunition: 8 })
    expect(loader.bullets_data[0]).toMatchObject({ type: 'beam', range: 2000, shotHeat: 4, heat: 8, reload: 0.5, ammo: 1 })
    expect(loader.bullets_data[1]).toMatchObject({ type: 'bullet', range: 300, shotHeat: 6, heat: 0, amount: 4, barrelamount: 2, ammo: 2, ammoreload: 5, repair: 9 })
  })

  it('keeps locale source order for normalized type collisions and model-specific resource colors', () => {
    const loader = fixture({
      't/0001-L044.xml': '<language><page id="20221"><t id="200">Transport</t><t id="100">Trans port</t></page></language>',
      'libraries/colors/final.xml': '<colormap><colors><color id="resource" r="16" g="32" b="255"/></colors><mappings><mapping id="resource_map_scrap" ref="resource"/></mappings></colormap>',
      'libraries/regionyields/final.xml': '<regionyields><resource ware="ore" effect_r="207" effect_g="127" effect_b="84"/></regionyields>'
    })
    loader.ship_type_counts = { transport: 1 }
    loader.needed_raw_names.add('{20221,200}')
    loader.extractAndResolveLanguages(); loader.analyzeTypesAndDlcs()
    expect(loader.ship_types_data[0]!.nameId).toBe('{20221,100}')
    loader.loadColors(); loader.loadRegionyieldsColors()
    loader.wares_data = [{ id: 'ore', tier: 0, name: 'Ore', nameId: 'Ore' }, { id: 'energycells', tier: 0, name: 'Energy Cells', nameId: 'Energy Cells' },
      { id: 'rawscrap', tier: 0, name: 'Raw Scrap', nameId: 'Raw Scrap' }, { id: 'unconnected', tier: null }]
    expect(loader.resourceData()).toMatchObject([
      { id: 'ore', color_rgb: '#CF7F54', color_r: 207, color_g: 127, color_b: 84 },
      { id: 'energycells', color: 'magenta_bright', color_rgb: '#FF66FF' },
      { id: 'rawscrap', color: 'resource', color_rgb: '#1020FF' }
    ])
    loader.regionyields_db = {}
    expect(loader.resourceData()[2]).not.toHaveProperty('color_r')
  })

  it('preserves original objective references instead of substituting generated map names', async () => {
    const objective = (id: string, macro: string) => `<cue name="Terraforming_${id}"><actions><find_cluster macro="macro.${macro}"/><add_terraforming_project id="'project'"/></actions><cues><cue name="Objective"><actions><substitute_text text="$Text" source="{1,1}"><replace string="'location'" with="$Cluster_${id}.knownname"/></substitute_text><update_mission><briefing><objective step="1" text="$Text"/></briefing></update_mission></actions></cue></cues></cue>`
    const loader = fixture({
      'libraries/wares/final.xml': `<wares><ware id="ore" transport="solid" name="Ore">${price}</ware></wares>`,
      'libraries/defaults/final.xml': '<defaults><dataset class="processingmodule"><properties/></dataset></defaults>',
      'libraries/module_macros.xml': '<macros><macro name="unmapped"/></macros>',
      'libraries/terraforming/final.xml': '<terraforming><projects><project id="project"/></projects></terraforming>',
      'md/terraforming/final.xml': `<mdscript><cues><cue name="Start"><cues>${objective('Single', 'single')}${objective('Multi', 'multi')}</cues></cue></cues></mdscript>`
    })
    const mapPath = join(loader.raw_path, 'current-run-map.json')
    const spy = vi.spyOn(mapProcessor, 'buildMap').mockImplementationOnce(context => {
      expect(context.rawPath).toBe(loader.raw_path)
      const maps = { clusters: {
        single: { nameId: '{2,1}', sectors: ['sector_one'] },
        multi: { nameId: '{2,2}', sectors: ['sector_two', 'sector_three'] }
      }, sectors: { sector_one: { nameId: '{3,1}' }, sector_two: { nameId: '{3,2}' }, sector_three: { nameId: '{3,3}' } } }
      return { data: { maps }, name_ids: new Set(['{2,1}', '{2,2}', '{3,1}', '{3,2}', '{3,3}']) }
    })
    try {
      await processData({ config: { version: '9.0' }, rawPath: loader.raw_path, outputRoot: loader.output_root, paths: { output: mapPath },
        targets: ['maps', 'terraforming'], blocksCache: join(loader.raw_path, 'cache.json'), forceRecalcPerBlock: false } as ProcessorContext)
      const data = JSON.parse(readFileSync(join(loader.output_root, 'data', 'terraforming.json'), 'utf8'))
      expect(data.clusters.map((cluster: any) => cluster.objectives[0].textReplaces[0].to)).toEqual(['$Cluster_Single.knownname', '$Cluster_Multi.knownname'])
    } finally { spy.mockRestore() }
  })

  it('takes the first repeated component, connection macro and drone engine like ElementTree.find', () => {
    const loader = fixture({
      'libraries/wares/final.xml': `<wares>
        <ware id="ship" name="Ship" tags="ship" transport="ship"><component ref="ship_arg_s_first_macro"/><component ref="ignored_macro"/>${build}</ware>
        <ware id="repair" name="Repair" tags="equipment"><component ref="repair_macro"/></ware>
      </wares>`,
      'libraries/ship_components.xml': '<components><component name="first_component"><connections><connection name="cockpit" tags="cockpit"/></connections></component></components>',
      'libraries/ship_macros.xml': '<macros><macro name="ship_arg_s_first_macro" class="ship_s"><component ref="first_component"/><component ref="ignored_component"/><properties><people capacity="1"/></properties><connections><connection><macro ref="cargo"/><macro ref="ignored_cargo"/></connection><connection><macro ref="dock"/><macro ref="ignored_dock"/></connection></connections></macro></macros>',
      'libraries/ship_connection_macros.xml': '<macros><macro name="cargo" class="storage"><properties><cargo tags="solid" max="42"/><cargo tags="liquid" max="99"/></properties></macro><macro name="dock" class="dockingbay"><properties><dock capacity="2"/><dock capacity="9"/><docksize tags="dock_s"/><docksize tags="dock_m"/></properties></macro></macros>',
      'libraries/equipment_macros.xml': '<macros><macro name="repair_macro" class="ship_xs"><properties><purpose primary="build"/><loadouts><loadout><macros><engine macro="engine_gen_xs_repairdrone_01_macro"/><engine macro="other_engine"/></macros></loadout></loadouts></properties></macro></macros>'
    })
    loader.buildDatabase(); loader.parseShipAndEquipmentData(); loader.buildDronesAndConsumables()
    expect(loader.component_to_ware.ship_arg_s_first_macro).toBe('ship')
    expect(loader.component_to_ware.ignored_macro).toBeUndefined()
    expect(loader.ships_data[0]).toMatchObject({ cargo: [{ type: 'solid', capacity: 42 }], dockarea: [{ size: 'dock_s', capacity: 2 }] })
    expect(loader.drones_data[0]!.droneTags).toEqual([])
  })

  it('treats constructor and __proto__ identifiers as domain keys, not inherited object properties', () => {
    const loader = fixture({
      'libraries/wares/base.xml': '<wares><ware id="ore"/></wares>',
      'libraries/wares/dlc_split.xml': '<diff><add sel="/wares"><ware id="constructor"/><ware id="__proto__"/></add></diff>',
      'libraries/wares/final.xml': `<wares>
        <ware id="constructor" name="Constructor" transport="solid">${price}<production method="constructor" time="60"><primary><ware ware="ore" amount="1"/></primary></production></ware>
        <ware id="__proto__" name="Prototype" transport="solid">${price}<production time="60"><primary><ware ware="constructor" amount="1"/></primary></production></ware>
      </wares>`,
      't/0001-L044.xml': '<language><page id="20221"><t id="5">constructor</t></page></language>'
    }, { dlc_order: ['ego_dlc_split'] })
    loader.buildDatabase()
    expect(loader.wares_data.map(ware => [ware.id, ware.tier, ware.dlc_tag])).toEqual([['constructor', 1, 'dlc_split'], ['__proto__', 2, 'dlc_split']])
    expect(loader.recipes.constructor!.constructor).toMatchObject({ inputs: { ore: 1 }, time: 60 })
    loader.ship_type_counts = Object.fromEntries([['constructor', 1]])
    loader.extractAndResolveLanguages(); loader.analyzeTypesAndDlcs()
    expect(loader.ship_types_data[0]).toMatchObject({ id: 'constructor', nameId: '{20221,5}' })
    expect(loader.moduleColors('constructor')).toEqual({ color: 'grey_160', color_rgb: '#A0A0A0' })
  })

  it('refreshes names collected after initial languages and injects extension text without changing drone placeholders', () => {
    const loader = fixture({ 't/0001-L044.xml': '<language><page id="1"><t id="1">Early</t><t id="2">Late</t><t id="3">Description</t></page></language>' })
    loader.needed_raw_names.add('{1,1}')
    loader.extractAndResolveLanguages()
    expect(loader.i18n_data.en!['{1,2}']).toBeUndefined()
    loader.needed_raw_names.add('{1,2}'); loader.needed_raw_names.add('{1,3}')
    loader.research_data = { items: [{ nameId: '{1,2}', descriptionId: '{1,3}' }] }
    loader.terraforming_data = { stats: [{ nameId: '{1,2}', ranges: [{ descriptionId: '{1,3}' }] }] }
    loader.drones_data = [{ nameId: '{1,2}', name: '{1,2}' }]
    loader.refreshExportedI18n(); loader.injectEnglishNames()
    expect(loader.research_data.items[0]).toMatchObject({ name: 'Late', description: 'Description' })
    expect(loader.terraforming_data.stats[0].ranges[0].description).toBe('Description')
    expect(loader.drones_data[0]!.name).toBe('{1,2}')
    expect(loader.i18n_data.en!['{1,2}']).toBe('Late')
  })
})

// Optional real-input parity regression; synthetic domain checks above are always runnable.
const baselineRoot = process.env.PROCESSOR_BASELINE_ROOT
const baselines = ['8.0-Diplomacy', '9.0-Empire'].map(folder => join(baselineRoot === undefined ? '/missing-processor-baseline' : baselineRoot, folder))
const parityAvailable = baselines.every(existsSync) && ['8.0-Diplomacy', '9.0-Empire'].every(folder => existsSync(join(process.cwd(), 'x4raw_assets', folder)))
it.skipIf(!parityAvailable)('matches both original final baselines and isolates sequential version runs', async () => {
  const config = loadProcessorConfig()
  const output = mkdtempSync(join(tmpdir(), 'x4-data-parity-'))
  directories.push(output)
  for (const version of config.versions) {
    const actual = join(output, version.folder_name)
    const context = resolveContext(config, version, parseProcessorArgs(['data', '--output-dir', actual]))
    context.blocksCache = join(output, `${version.version}-cache.json`)
    const summary = await processData(context)
    expect(summary.targets).toContain('map-resources')
    expect(compareDirectories(join(baselineRoot!, version.folder_name), actual)).toEqual([])
    expect(existsSync(join(actual, 'data', 'map_resources.json'))).toBe(true)
  }
}, 120000)
