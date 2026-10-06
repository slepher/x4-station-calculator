import { a, tags, library, nodes, collect } from './common'
import type { ExtensionLoader, Row } from './common'
const defaults = new Set(`high_mass_teleportation module_build module_defence module_dock module_habitation module_production module_storage module_venture mod_engine_mk1 mod_engine_mk2 mod_engine_mk3 mod_shield_mk1 mod_shield_mk2 mod_shield_mk3 mod_ship_mk1 mod_ship_mk2 mod_ship_mk3 mod_weapon_mk1 mod_weapon_mk2 mod_weapon_mk3 teleportation teleportation_range_01 teleportation_range_02 teleportation_range_03 warp_hq_01 warp_hq_02 module_welfare_1 module_welfare_2 seta diplomacy_network`.split(' ').map(x => 'research_'+x))
const unlocks: Record<string,Row> = {
  agentslot_01:{key:'embassy'},agentslot_02:{key:'embassy'},equipment_xenon:{key:'xen_equipment',params:{itemWareId:'inv_quantum_data_shard'}},interference_network:{key:'interference_network',params:{count:2}},xenon_crisis_01:{key:'xenon_crisis_01'},xenon_crisis_02:{key:'xenon_crisis_02'},condensate_sample:{key:'condensate_sample',params:{npcNameId:'{30201,2}',itemWareId:'inv_condensate_sample'}},erlking_core:{key:'erlking',params:{shipWareId:'ship_pir_xl_battleship_01_a',sectorMacro:'cluster_502_sector001_macro'}},
  ship_ter_s_fighter_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_31_sector001_macro',shipWareId:'ship_ter_s_fighter_04_a'}},ship_ter_m_corvette_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_48_sector001_macro',shipWareId:'ship_ter_m_corvette_02_a'}},ship_ter_l_flagship_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_715_sector001_macro',shipWareId:'ship_ter_l_flagship_01_a'}},ship_arg_s_racing_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_713_sector001_macro',shipWareId:'ship_arg_s_racer_01_a'}},ship_tel_s_racing_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_714_sector001_macro',shipWareId:'ship_tel_s_racer_01_a'}},ship_par_s_racing_01:{key:'abandoned_ship',params:{sectorMacro:'cluster_710_sector001_macro',shipWareId:'ship_par_s_racer_01_a'}},ship_gen_m_corvette_02:{key:'abandoned_ship',params:{shipWareId:'ship_gen_m_corvette_02'}}
}
const sectors: Record<string,string> = Object.fromEntries([31,48,715,713,714,710,502].map(id => [`cluster_${id}_sector001_macro`,`{20004,${id}0011}`]))
export function processResearch(loader: ExtensionLoader): void {
  const root = library(loader.raw_path,'libraries','wares','final.xml')
  if (!root) { loader.research_data = null; return }
  const wares = nodes(root.ware), names = Object.fromEntries(wares.filter(w => a(w,'id') && a(w,'name')).map(w => [a(w,'id'),a(w,'name')]))
  const items: Row[] = []
  for (const w of wares) {
    const id = a(w,'id')
    if (!id.startsWith('research_') || a(w,'transport') !== 'research') continue
    const nameId = a(w,'name'), descriptionId = a(w,'description'), t = tags(a(w,'tags'))
    collect(loader.needed_raw_names,nameId,descriptionId)
    const researchTime = Math.trunc(Number(a(w.research,'time','0'))), cost: Record<string,number> = {}, dependencies: string[] = []
    for (const p of nodes(w.research?.primary?.ware)) { const amount = Math.trunc(Number(a(p,'amount','0'))); if (a(p,'ware') && amount) cost[a(p,'ware')] = amount }
    for (const d of nodes(w.research?.research?.ware)) { const dep = a(d,'ware'); if (dep.startsWith('research_') && !dependencies.includes(dep)) dependencies.push(dep) }
    let category: string
    if (t.includes('hidden') || t.includes('missiononly')) category = t.includes('hidden') && !t.includes('missiononly') ? 'abandoned' : 'mission_progress'
    else if (defaults.has(id)) category = researchTime === 0 && !Object.keys(cost).length ? 'abandoned' : 'default'
    else category = 'conditional'
    const item: Row = { id,nameId,name:nameId,descriptionId,dlcTag:loader.ware_dlc_tags[id] ?? 'base',tags:t,category,researchTime,cost,dependencies }
    const u = unlocks[id.slice(9)]
    if (category === 'conditional' && u) {
      const unlock: Row = {key:u.key}, params: Row = {}
      for (const [key,value] of Object.entries(u.params ?? {})) {
        params[key] = value
        if (key === 'shipWareId' && names[String(value)]) params.shipNameId = names[String(value)]
        if (key === 'itemWareId' && names[String(value)]) params.itemNameId = names[String(value)]
        if (key === 'sectorMacro' && sectors[String(value)]) params.sectorNameId = sectors[String(value)]
      }
      if (Object.keys(params).length) unlock.params = params
      for (const key of ['npcNameId','shipNameId','itemNameId','sectorNameId']) collect(loader.needed_raw_names,params[key])
      item.unlock = unlock
    }
    items.push(item)
  }
  loader.research_data = {items}
}
