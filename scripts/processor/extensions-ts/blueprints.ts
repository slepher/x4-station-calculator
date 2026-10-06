import { a, tags, library, nodes, descendants, collect } from './common'
import type { ExtensionLoader, Row } from './common'
const classNames: Record<string,string> = { connectionmodule:'{20104,59901}', production:'{1001,2421}', storage:'{1001,2422}', defencemodule:'{1001,2424}', habitation:'{1001,2451}', dockarea:'{20104,79901}', pier:'{20104,79801}', buildmodule:'{1001,2439}', radar:'{1001,1706}', processingmodule:'{1001,9621}', welfaremodule:'{1001,9620}', ventureplatform:'{1001,2454}', ship_s:'{1001,11000}', ship_m:'{1001,11001}', ship_l:'{1001,11002}', ship_xl:'{1001,11003}', engine:'{20109,15101}', shieldgenerator:'{20109,15501}', turret:'{1001,1319}', weapon:'{20109,15301}', drone:'{1001,8}', consumable:'{1001,8003}', missile:'{1001,1304}' }
export function processBlueprints(loader: ExtensionLoader): void {
  const macroClasses: Record<string,string> = {}
  for (const file of ['module_macros.xml','ship_macros.xml','equipment_macros.xml']) {
    const root = library(loader.raw_path,'libraries',file)
    if (root) for (const m of descendants({root},'macro')) if (a(m,'name') && a(m,'class')) macroClasses[a(m,'name')] = a(m,'class')
  }
  const root = library(loader.raw_path,'libraries','wares','final.xml')
  if (!root) throw new Error(`Missing blueprint wares library: ${loader.raw_path}`)
  const blueprints: Row[] = []
  for (const w of nodes(root.ware)) {
    const t = tags(a(w,'tags'))
    if (t.includes('noblueprint')) continue
    const type = ['module','ship','equipment'].find(k => t.includes(k))
    if (!type) continue
    const entry: Row = { id:a(w,'id'), name:'', nameId:a(w,'name'), type }
    if (a(w.price,'average')) entry.price = Number(a(w.price,'average'))
    if (a(w.restriction,'licence')) entry.licence = a(w.restriction,'licence')
    const factions = nodes(w.owner).map(o => a(o,'faction')).filter(Boolean)
    if (factions.length) entry.factions = factions
    let cls = macroClasses[a(w.component,'ref')] ?? ''
    if (type === 'equipment' && ['ship_xs','ship_s'].includes(cls)) cls = 'drone'
    else if (type === 'equipment' && ['mine','satellite','scanner','countermeasure','navbeacon','resourceprobe'].includes(cls)) cls = 'consumable'
    else if (cls === 'missileturret') cls = 'turret'
    else if (cls === 'missilelauncher') cls = 'weapon'
    if (cls) entry.class = cls
    for (const flag of ['missiononly','noplayerblueprint']) if (t.includes(flag)) entry[flag] = true
    loader.needed_raw_names.add(entry.nameId)
    blueprints.push(entry)
  }
  const seen = new Map<string,string>()
  for (const b of blueprints) if (b.class && !seen.has(b.class)) seen.set(b.class,b.type)
  const classes = [...seen].sort(([x],[y]) => x < y ? -1 : x > y ? 1 : 0).map(([id,type]) => ({id,type,name:'',nameId:classNames[id] ?? ''}))
  const types = [{id:'module',name:'',nameId:'{1001,56}'},{id:'ship',name:'',nameId:'{1001,6}'},{id:'equipment',name:'',nameId:'{1001,7935}'}]
  for (const c of [...classes,...types]) collect(loader.needed_raw_names,c.nameId)
  const faction_blueprints: Row = {}, general_blueprints: Record<string,number> = {}
  for (const b of blueprints) if (b.class && !b.noplayerblueprint) {
    general_blueprints[b.class] = (general_blueprints[b.class] ?? 0) + 1
    if (b.factions && b.licence) for (const f of b.factions) {
      const cls = faction_blueprints[b.class] ??= {}, licences = cls[f] ??= {}
      licences[b.licence] = (licences[b.licence] ?? 0) + 1
    }
  }
  loader.blueprints_data = { blueprints, types, classes, faction_blueprints, general_blueprints }
}
