import { a, integer, clean, nodes, descendants, uniqueAppend, children as xmlChildren } from './common'
import type { Row } from './common'
export const dynamicStats: Record<string,string> = {
 tmp_moholes:'temperature',tmp_blackdust:'temperature',atm_methane_import:'temperature',tmp_cloudparticles:'temperature',bio_cyanobacteria:'oxygen',atm_methane_oxidizers:'methane',atm_methane_oxidize:'methane',atm_carbon_mineralizers:'carbondioxide',atm_carbon_mineralize:'carbondioxide',atm_toxin_cleanup:'toxicity',ter_radioactive_cleanup:'radioactivity',wat_import:'humidity',wat_irrigation:'humidity',wat_surfacing:'humidity',atm_nitrogen_fix:'airpressure',atm_helium_import:'airpressure',atm_outgassing:'airpressure',evt_globalwarming_methane:'methane',evt_globalwarming_co2:'carbondioxide',evt_quake_mild:'seismicactivity',evt_quake_moderate:'seismicactivity',evt_quake_severe:'seismicactivity',ter_tectonic_scaffolding:'seismicactivity'
}
export const ignoreStats: Record<string,string> = {IgnoreTemperature:'temperature',IgnoreOxygen:'oxygen',IgnoreMethane:'methane',IgnoreCarbonDioxide:'carbondioxide',IgnoreToxicity:'toxicity',IgnoreRadioactivity:'radioactivity',IgnoreHumidity:'humidity',IgnoreAirPressure:'airpressure'}
const libraries: Record<string,string[]> = {
 Industrial:['pwr_antimatter','ind_refineries_clean','ind_refineries_cheap','ind_factories','ind_von_neumann'],Biosphere:['bio_tailored','bio_jumpstart','agr_fertilize','agr_fields_scruffin'],Water:['wat_import','wat_irrigation','wat_surfacing'],Agriculture:['agr_hydroponics','agr_forestation','agr_fields_wheat','agr_fields_sunrise','agr_fields_soja','agr_fields_spices'],Amenities:['ame_themepark','ame_venues','ame_temple','ame_finedining'],Residential:['res_bubblecity','res_habmodule','res_housing_dense','res_arcology','res_housing_luxury'],Training:['trn_boarding','trn_boarding_group','trn_boarding_single','trn_boarding_competition','trn_pilot','trn_pilot_group','trn_pilot_single','trn_pilot_competition'],Economy:['eco_clinic','eco_clinic_supply','eco_campus','eco_campus_supply','eco_bank','eco_bank_supply']
}
function expand(ref: string): string[] {
 if (ref === 'SetupGeneralProjects') return Object.values(libraries).flat()
 if (ref === 'TemperatureProjectsHelper') return ['tmp_moholes','tmp_blackdust','atm_methane_import','tmp_cloudparticles']
 return libraries[ref.replace('SetupGeneralProjects_','')] ?? []
}
function predecessors(n: Row): Row[] {
 return nodes(n.predecessor).flatMap(p => { const id = clean(a(p,'id')), group = clean(a(p,'group')); return id || group ? [{ref:id || group,type:id ? 'project' : 'group',any:a(n,'any','false') === 'true' || a(p,'any','false') === 'true'}] : [] })
}
function statProjects(c: Row, preds: Row) {
 const s = c.initialStats, ids = c.projectIds
 const add = (stat: string, condition: boolean, list: string[]) => { if (stat in s && condition) uniqueAppend(ids,...list) }
 const pred = (id: string, refs: string[], type = 'project', any = false) => { if (!(id in preds)) preds[id] = refs.map(ref => ({ref,type,any})) }
 add('temperature',s.temperature < 5,['tmp_moholes','tmp_blackdust','atm_methane_import'])
 add('temperature',s.temperature > 5,['tmp_cloudparticles'])
 if ('temperature' in s && s.temperature > 5) pred('tmp_cloudparticles',['wat_import','wat_surfacing'],'project',true)
 const ignored = (flag: string) => c.values['$'+flag] === 'true'
 if (!ignored('IgnoreOxygen') && 'oxygen' in s && s.oxygen < 4) { uniqueAppend(ids,'bio_cyanobacteria'); pred('bio_cyanobacteria',['bio_tailored','bio_jumpstart'],'project',true) }
 for (const [flag,stat,p1,p2,event] of [['IgnoreMethane','methane','atm_methane_oxidizers','atm_methane_oxidize','evt_globalwarming_methane'],['IgnoreCarbonDioxide','carbondioxide','atm_carbon_mineralizers','atm_carbon_mineralize','evt_globalwarming_co2']]) {
   if (!ignored(flag!) && stat! in s && s[stat!] > 0) { uniqueAppend(ids,p1!,p2!,event!); pred(p1!,['power'],'group'); pred(p2!,[p1!]) }
 }
 if (!ignored('IgnoreToxicity') && 'toxicity' in s && s.toxicity > 0) { uniqueAppend(ids,'atm_toxin_cleanup'); pred('atm_toxin_cleanup',['src_toxicity'],'group') }
 if (!ignored('IgnoreRadioactivity')) add('radioactivity',s.radioactivity > 0,['ter_radioactive_cleanup'])
 if (!ignored('IgnoreHumidity')) add('humidity',s.humidity < 6,libraries.Water!)
 if (!ignored('IgnoreAirPressure') && 'airpressure' in s) { uniqueAppend(ids,'atm_nitrogen_fix','atm_helium_import'); pred('atm_nitrogen_fix',['agr_fertilize']) }
 add('airpressure',s.airpressure < 5,['atm_outgassing'])
 add('seismicactivity',s.seismicactivity > 0,['evt_quake_mild','evt_quake_moderate','evt_quake_severe','ter_tectonic_scaffolding'])
}
function clusterActions(cue: Row, id: string, preds: Row): Row {
 const c: Row = {id,macro:'',partName:'',initialStats:{},projectIds:[],values:{},removedStats:[]}, removed = new Set<string>(), directValues: Row = {}
 function process(n: Row, tag: string) {
   const pid = clean(a(n,'id'))
   if (tag === 'find_cluster' && a(n,'macro')) c.macro = a(n,'macro')
   else if (tag === 'initialise_terraforming' && a(n,'partname')) c.partName = a(n,'partname')
   else if (tag === 'set_terraforming_stat') { const value = integer(n['@_value']); if (pid && value !== null) { c.initialStats[pid] = value; removed.delete(pid) } }
   else if (tag === 'remove_terraforming_stat' && pid) { removed.add(pid); delete c.initialStats[pid] }
   else if (tag === 'set_value' && a(n,'name') && a(n,'exact')) directValues[a(n,'name')] = a(n,'exact')
   else if (tag === 'add_terraforming_project') { uniqueAppend(c.projectIds,pid); if (n.predecessors) { const p = predecessors(n.predecessors); if (p.length && !(pid in preds)) preds[pid] = p } }
   else if (tag === 'add_terraforming_event') uniqueAppend(c.projectIds,pid)
   else if (['do_if','do_elseif','do_else'].includes(tag)) children(n)
   else if (tag === 'run_actions') {
     const params = Object.fromEntries(nodes(n.param).filter(p => a(p,'name')).map(p => [a(p,'name'),a(p,'value')]))
     for (const flag of Object.keys(ignoreStats)) if (params[flag]?.toLowerCase() === 'true') c.values['$'+flag] = 'true'
     if (a(n,'ref') === 'SetupStatDependentProjects') return
     let ids = expand(a(n,'ref'))
     if (params.Biosphere?.toLowerCase() === 'false') ids = ids.filter(p => !libraries.Biosphere!.includes(p))
     if (params.EnergyProject && params.EnergyProject !== 'pwr_antimatter' && clean(params.EnergyProject)) ids = ids.map(p => p === 'pwr_antimatter' ? clean(params.EnergyProject!) : p)
     if (params.PilotTrainingCourseProject) c.values.$PilotTrainingCourseProject = clean(params.PilotTrainingCourseProject)
     uniqueAppend(c.projectIds,...ids)
   }
 }
 function children(n: Row) { for (const [tag,child] of xmlChildren(n)) process(child,tag) }
 children(cue.actions)
 for (const patch of nodes(cue.patch)) children(patch)
 c.removedStats = [...removed].sort()
 c.values = {...c.values,...directValues}
 statProjects(c,preds)
 for (const pid of c.projectIds) if (preds[pid]) preds[pid] = preds[pid].map((p: Row) => p.ref === '$PilotTrainingCourseProject' ? {...p,ref:c.values.$PilotTrainingCourseProject ?? 'trn_pilot'} : p)
 return c
}
function objectives(cue: Row): Row[] {
 let mission: Row[] = []; const offer: Row[] = []
 const parse = (n: Row) => nodes(n.briefing?.objective).map(o => {
   const e: Row = {step:integer(o['@_step'],0),action:a(o,'action'),textId:a(o,'text')}
   if (a(o,'encyclopedia')) e.encyclopedia = a(o,'encyclopedia')
   if (a(o,'completed')) e.completedVariable = a(o,'completed')
   return e
 })
 for (const c of [cue,...descendants(cue,'cue')]) {
   for (const o of descendants(c,'create_offer')) offer.push(...parse(o))
   for (const u of descendants(c,'update_mission')) { const parsed = parse(u); if (parsed.length) mission = parsed }
 }
 return mission.length ? mission : offer
}
export function extractRewards(cue: Row): Row {
 const result: Row = {factionRewards:[],blueprintWares:[],npcNameIds:[],rewardNameIds:[]}, cast: Row = {}
 for (const actor of descendants(cue,'create_cue_actor')) if (a(cue,'name').includes('_BlackHoleSun') && a(actor,'name').startsWith('$') && a(actor,'name').includes('Contact_1')) cast[a(actor,'name')] = '{30507,102}'
 function actions(n: Row | undefined, milestone: string | number, conditionLabel: string) {
   if (!n) return
   if (milestone === 'complete') conditionLabel = 'mission_complete'
   for (const action of descendants(n,'add_faction_relation')) {
     const value = Number(a(action,'value','0'))
     if (Number.isFinite(value)) result.factionRewards.push({faction:a(action,'faction').replaceAll('faction.',''),type:'add',value,milestone,conditionLabel})
   }
   for (const action of descendants(n,'set_faction_relation')) if (a(action,'value').toLowerCase().includes('friend')) result.factionRewards.push({faction:a(action,'faction').replaceAll('faction.',''),type:'unlock',milestone,conditionLabel})
   for (const action of descendants(n,'add_blueprints')) for (const w of a(action,'wares').trim().split(/\s+/)) { const ware = w.replace(/^\[+/,''); if (ware.startsWith('ware.')) result.blueprintWares.push({ware,milestone,conditionLabel}) }
   for (const action of descendants(n,'add_actor_to_room')) {
     const actor = a(action,'actor')
     if (cast[actor] && descendants(n,'set_owner').some(o => a(o,'object') === actor && a(o,'faction').includes('faction.player'))) result.npcNameIds.push({nameId:cast[actor],milestone,conditionLabel})
   }
 }
 for (const sub of nodes(cue.cues?.cue)) {
   const name = a(sub,'name'); let milestone: number | string | undefined
   if (name.includes('_Milestone_')) { const part = name.split('_').reverse().find(p => /^\d+$/.test(p)); if (part !== undefined) milestone = Number(part) }
   else if (name.endsWith('_MissionComplete')) milestone = 'complete'
   if (milestone === undefined) continue
   const text = JSON.stringify(sub.conditions); let label = ''
   if (text?.includes('event_terraforming_stat_changed')) label = text.includes('habitable') ? 'habitable' : text.includes('population') ? 'population' : text.includes('temperature') ? 'temperature_improved' : 'stat_changed'
   else if (text?.includes('event_terraforming_project_succeeded')) label = 'first_project'
   else if (text?.includes('event_terraforming_project_completed')) label = 'basic_projects'
   actions(sub.actions,milestone,label)
   for (const patch of nodes(sub.patch)) actions(patch.actions,milestone,'')
 }
 result.rewardNameIds = result.npcNameIds.map((n: Row) => n.nameId).filter(Boolean)
 return result
}
function descriptions(root: Row): Row {
 const result: Row = {}, skills: Record<string,string> = {boarding:'boarding',piloting:'piloting',engineering:'engineering',management:'management',morale:'morale'}
 const skill = (n: Row) => skills[a(n,'type').replace('skilltype.','')] ?? ''
 for (const cue of descendants(root,'cue')) {
   const event = cue.conditions?.event_terraforming_project_succeeded, actions = cue.actions
   if (!event || !actions || !clean(a(event,'project'))) continue
   let desc: Row | undefined
   const add = descendants(actions,'add_skill')[0]
   if (add) {
     if (!skill(add)) continue
     let maxStars = 0
     for (const cond of descendants(actions,'do_if')) { const m = /lt\s+(\d+)/.exec(a(cond,'value')); if (m && Number(m[1]) > 0 && Number(m[1]) % 3 === 0) { maxStars = Number(m[1])/3; break } }
     desc = {type:'skill_add',skill:skill(add),stars:1,maxStars:maxStars || 4,scope:descendants(actions,'do_for_each').some(n => a(n,'in').includes('trainee_group')) ? 'group' : 'single'}
   } else if (descendants(actions,'create_npc_template').length) {
     const values = new Map<string,number>()
     for (const n of descendants(actions,'set_skill')) { const type = a(n,'type'), max = integer(n['@_max'],0)!; if (type && (!values.has(type) || max > values.get(type)!)) values.set(type,max) }
     const primary = [...values].sort((x,y) => y[1]-x[1])[0]?.[0]
     if (!primary || !skills[primary.replace('skilltype.','')]) continue
     const gchar = descendants(actions,'get_character_definition').find(n => n['@_tags'] !== undefined)
     desc = {type:'recruitment',role:a(gchar,'tags').includes('tag.marine') ? 'marine' : 'pilot',count:3,primarySkill:skills[primary.replace('skilltype.','')],skillMin:13,skillMax:15,morale:13}
   }
   if (desc) result[clean(a(event,'project'))] = [desc]
 }
 return result
}
export function parseMd(root: Row): {clusters: Row[], predecessors: Row, descriptions: Row} {
 const global: Row = {}, preds: Row = {}, clusters: Row[] = []
 for (const n of descendants(root,'add_terraforming_project')) {
   const id = clean(a(n,'id')); if (!id || !n.predecessors) continue
   const p = predecessors(n.predecessors); if (p.length && !(id in global)) global[id] = p
 }
 for (const start of descendants(root,'cue').filter(n => a(n,'name') === 'Start')) for (const cue of nodes(start.cues?.cue)) {
   const name = a(cue,'name')
   if (!name.startsWith('Terraforming_') || !cue.actions || (!descendants(cue.actions,'find_cluster').length && !descendants(cue.actions,'initialise_terraforming').length)) continue
   const c = clusterActions(cue,name.replaceAll('Terraforming_',''),preds)
   c.objectives = objectives(cue); c.variableTexts = {}
   for (const n of descendants(cue,'substitute_text')) if (a(n,'text') && a(n,'source')) c.variableTexts[a(n,'text')] = {source:a(n,'source'),replaces:nodes(n.replace).map(r => ({from:clean(a(r,'string')),to:a(r,'with').startsWith("'") && a(r,'with').endsWith("'") ? a(r,'with').slice(1,-1) : a(r,'with')}))}
   const rewards = extractRewards(cue)
   for (const key of Object.keys(rewards)) if (rewards[key].length) c[key] = rewards[key]
   clusters.push(c)
 }
 for (const [id,p] of Object.entries(global)) if (!(id in preds)) preds[id] = p
 return {clusters,predecessors:preds,descriptions:descriptions(root)}
}
export function resolveObjectives(clusters: Row[], names: Record<string,string>, collected: Set<string>) {
 for (const c of clusters) {
   const seen = new Set<number>()
   c.objectives = c.objectives.filter((o: Row) => { if (!o.textId || seen.has(o.step)) return false; seen.add(o.step); return true })
   for (const o of c.objectives) {
     if (!o.textId.startsWith('$')) continue
     const info = c.variableTexts[o.textId]; if (!info) continue
     o.textId = info.source; if (info.source) collected.add(info.source)
     const replaces = info.replaces.map((r: Row) => {
       let to = r.to
       if (/\$Cluster_(\w+)\.knownname|\$Sector_(\w+)\.knownname|^Sector_(\w+)/.test(to) && Object.keys(names).length) {
         const id = names[c.macro.replace('macro.','')]; if (id) to = id
       } else {
         const variable = /^(?:'[^']*'\.\[)?\$(\w+)\]?/.exec(to)
         if (variable) { const value = c.values['$'+variable[1]]; if (value !== undefined) to = value; else if (variable[1] === 'HQName') to = '{20102,2011}' }
       }
       if (/^\$Sector_(\w+)\.knownname/.test(r.to)) o.relocateTarget = 'sector'
       return {from:r.from,to}
     })
     if (replaces.length) o.textReplaces = replaces
   }
 }
}
