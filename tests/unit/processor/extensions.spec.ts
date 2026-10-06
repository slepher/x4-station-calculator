import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { processFactions, processTerraforming, processResearch, processBlueprints } from '../../../scripts/processor/extensions-ts'
import type { ExtensionLoader } from '../../../scripts/processor/extensions-ts'
import { readXml, nodes } from '../../../scripts/processor/shared-ts/xml'
import { I18nRegistry, X4_LANG_CONFIG } from '../../../scripts/processor/shared-ts/i18n'
function loader(raw_path: string): ExtensionLoader { return {raw_path,needed_raw_names:new Set(),ware_dlc_tags:{},component_to_ware:{},ware_index:{},wares_data:[]} }
function fixture(files: Record<string,string>) {
 const root = mkdtempSync(join(tmpdir(),'extensions-'))
 for (const [path,text] of Object.entries(files)) { const full = join(root,path); mkdirSync(join(full,'..'),{recursive:true}); writeFileSync(full,text) }
 return root
}
describe('native extension processors',() => {
 it('filters licences and blueprints, preserves owners and equipment class remapping',() => {
  const root = fixture({'libraries/factions/final.xml':'<factions><faction id="b" name="{1,1}" tags="claimspace nodiplomacyselection"><licences><licence type="x" name="{1,2}" minrelation="0.5"/><licence name="{1,3}" factions="a"/></licences></faction></factions>','libraries/wares/final.xml':'<wares><ware id="a" name="{1,4}" tags="equipment"><component ref="drone"/><owner faction="b"/><owner faction="a"/><restriction licence="military"/></ware><ware id="b" tags="ship noblueprint"/></wares>','libraries/equipment_macros.xml':'<macros><macro name="drone" class="ship_s"/></macros>'})
  try { const l = loader(root); processFactions(l); processBlueprints(l); expect(l.factions_data?.[0]?.licences).toEqual([{type:'x',nameId:'{1,2}',name:'',minrelation:0.5}]); expect(l.blueprints_data?.blueprints).toEqual([{id:'a',name:'',nameId:'{1,4}',type:'equipment',licence:'military',factions:['b','a'],class:'drone'}]); expect(l.blueprints_data?.faction_blueprints).toEqual({drone:{b:{military:1},a:{military:1}}}) } finally { rmSync(root,{recursive:true}) }
 })
 it('classifies hidden research and deduplicates ordered dependencies',() => {
  const root = fixture({'libraries/wares/final.xml':'<wares><ware id="research_teleportation" transport="research" tags="hidden"><research time="2.9"><primary><ware ware="ore" amount="1.9"/></primary><research><ware ware="research_a"/><ware ware="research_a"/><ware ware="research_b"/></research></research></ware></wares>'})
  try { const l = loader(root); processResearch(l); expect(l.research_data?.items[0]).toMatchObject({category:'abandoned',researchTime:2,cost:{ore:1},dependencies:['research_a','research_b']}) } finally {rmSync(root,{recursive:true})}
 })
 it('preserves interleaved MD stat actions, ignore flags and explicit map objective names',() => {
  const root = fixture({
   'libraries/terraforming/final.xml':'<terraforming><stats><stat id="temperature" dynamic="true"><range end="3"/></stat></stats><projectgroups/><projects><project id="tmp_moholes" group="heat" repeatcooldown="0"><resources price="100"><ware ware="ore" amount="2"/></resources></project></projects></terraforming>',
   'md/terraforming/final.xml':`<mdscript><cues><cue name="Start"><cues><cue name="Terraforming_Test"><actions><find_cluster macro="macro.test"/><set_terraforming_stat id="'temperature'" value="2"/><remove_terraforming_stat id="'temperature'"/><set_terraforming_stat id="'temperature'" value="3"/><run_actions ref="SetupStatDependentProjects"><param name="IgnoreTemperature" value="true"/></run_actions></actions><cues><cue name="Objective"><actions><substitute_text text="$Text" source="{1,1}"><replace string="'location'" with="$Cluster_Test.knownname"/></substitute_text><update_mission><briefing><objective step="1" text="$Text"/></briefing></update_mission></actions></cue></cues></cue></cues></cue></cues></mdscript>`
  })
  try {
   const l = loader(root); l.wares_data = [{id:'ore',maxPrice:10}]; l.maps_data = {clusters:{test:{sectors:['sector']}},sectors:{sector:{nameId:'{2,3}'}}}
   processTerraforming(l)
   const data = l.terraforming_data!
   expect(data.stats[0].ranges.map((r: any) => [r.start,r.end])).toEqual([[0,0],[1,3]])
   expect(data.projects[0]).toMatchObject({duration:null,repeatCooldown:0,resources:{wares:[{ware:'ore',amount:2,actualAmount:10}]}})
   expect(data.clusters[0]).toMatchObject({initialStats:{temperature:3},removedStats:[],taskProjectIds:[],objectives:[{step:1,textId:'{1,1}',textReplaces:[{from:'location',to:'{2,3}'}]}]})
   expect(l.needed_raw_names).toEqual(new Set(['{1,1}','{2,3}']))
  } finally {rmSync(root,{recursive:true})}
 })
 for (const version of ['8.0','9.0']) it.skipIf(!existsSync(`/tmp/x4-migrate/python/${version}/data-output/${version === '8.0' ? '8.0-Diplomacy' : '9.0-Empire'}/data/terraforming.json`))(`matches every extension domain against Python ${version}`,() => {
  const folder = version === '8.0' ? '8.0-Diplomacy' : '9.0-Empire'
  const base = `/tmp/x4-migrate/python/${version}/data-output/${folder}/data`
  const l = loader(resolve('x4raw_assets',folder))
  const wares = nodes(readXml(join(l.raw_path,'libraries/wares/final.xml')).wares.ware)
  for (const w of wares) {
   const id = w['@_id']; l.ware_index[id] = {nameId:w['@_name']}
   if (w.component?.['@_ref'] && !(w.component['@_ref'] in l.component_to_ware)) l.component_to_ware[w.component['@_ref']] = id
  }
  const read = (file: string) => JSON.parse(readFileSync(join(base,file+'.json'),'utf8'))
  l.wares_data = read('wares')
  const expectedResearch = read('research')
  // DLC tagging is upstream-owned; feed the same assigned tags to this domain check.
  for (const item of expectedResearch.items) l.ware_dlc_tags[item.id] = item.dlcTag
  processFactions(l); processTerraforming(l); processResearch(l); processBlueprints(l)
  const registry = new I18nRegistry(); registry.configure(l.raw_path,X4_LANG_CONFIG)
  function inject(row: any, keys: string[]) {
   for (const key of keys) if (row[key]) { const value = registry.getName(row[key]); if (value) row[key.replace('Id','')] = value }
  }
  for (const key of ['stats','projectGroups','projects','deliveryShips']) for (const row of l.terraforming_data![key]) inject(row,['nameId','descriptionId','inactiveTextId'])
  for (const stat of l.terraforming_data!.stats) for (const row of stat.ranges) inject(row,['descriptionId'])
  for (const row of l.research_data!.items) inject(row,['nameId','descriptionId'])
  for (const key of ['blueprints','classes','types']) for (const row of l.blueprints_data![key]) inject(row,['nameId'])
  for (const row of l.factions_data!) { inject(row,['nameId']); for (const licence of row.licences) inject(licence,['nameId']) }
  for (const [file,data] of [['factions',l.factions_data],['terraforming',l.terraforming_data],['research',l.research_data],['blueprints',l.blueprints_data]] as const) {expect(data,`${version} ${file}`).toStrictEqual(read(file))}
 },120000)
})
