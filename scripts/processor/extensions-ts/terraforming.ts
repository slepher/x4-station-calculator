import { library, collect, uniqueAppend } from './common'
import type { ExtensionLoader, Row } from './common'
import { parseStats, parseProjectGroups, parseProjects } from './terraforming-library'
import { parseMd, resolveObjectives, dynamicStats, ignoreStats } from './terraforming-md'
import { buildDependencies } from './terraforming-dependencies'
export function processTerraforming(loader: ExtensionLoader): void {
 const root = library(loader.raw_path,'libraries','terraforming','final.xml')
 if (!root) { loader.terraforming_data = null; return }
 const names = loader.needed_raw_names, stats = parseStats(root), projectGroups = parseProjectGroups(root), projects = parseProjects(root,names)
 const prices = Object.fromEntries(loader.wares_data.filter(w => 'id' in w).map(w => [w.id,w.maxPrice ?? 0])), ships = new Map<string,Row>()
 for (const p of projects) {
   const res = p.resources
   if (res.price > 0 && res.wares.length) {
     const total = res.wares.reduce((sum: number,w: Row) => sum + w.amount * (prices[w.ware] ?? 0),0)
     if (total > 0) { const scale = Math.floor(res.price / total); for (const w of res.wares) w.actualAmount = w.amount * scale }
   }
   for (const d of p.deliveries) {
     if (!ships.has(d.macro)) {
       const entry: Row = {macro:d.macro,buildDuration:d.buildDuration}, wareId = loader.component_to_ware[d.macro]
       if (wareId && loader.ware_index[wareId]?.nameId) { entry.nameId = loader.ware_index[wareId].nameId; collect(names,entry.nameId) }
       ships.set(d.macro,entry)
     }
     delete d.buildDuration
   }
 }
 const md = library(loader.raw_path,'md','terraforming','final.xml'), parsed = md ? parseMd(md) : {clusters:[],predecessors:{},descriptions:{}}
 const clusters = parsed.clusters.filter(c => c.projectIds.length)
 // Map belongs to this run: use the supplied generated output, never a global asset path.
 const mapNames: Record<string,string> = {}
 if (loader.maps_data) for (const [id,c] of Object.entries(loader.maps_data.clusters) as [string,Row][]) {
   const name = c.sectors.length === 1 ? loader.maps_data.sectors[c.sectors[0]]?.nameId : c.nameId
   if (name) mapNames[id] = name
 }
 for (const c of clusters) {
   const rewards: Row[] = []
   for (const n of c.npcNameIds ?? []) if (n.nameId) { names.add(n.nameId); rewards.push({type:'npc',nameId:n.nameId,milestone:n.milestone}) }
   for (const b of c.blueprintWares ?? []) {
     const id = b.ware.replaceAll('ware.','')
     if (id && !rewards.some(r => r.id === id && r.type === 'blueprint')) rewards.push({type:'blueprint',id,milestone:b.milestone})
   }
   delete c.npcNameIds; delete c.blueprintWares; delete c.rewardNameIds
   if (rewards.length) c.rewards = rewards
 }
 resolveObjectives(clusters,mapNames,names)
 for (const id of Object.values(mapNames)) collect(names,id)
 for (const p of projects) {
   if (p.id in parsed.predecessors) p.predecessors = parsed.predecessors[p.id]
   if (p.id in parsed.descriptions) p.descriptions = parsed.descriptions[p.id]
   const descriptions: Row[] = p.descriptions ?? [], res = p.resources
   if (res.payout) { const d: Row = {type:'payout',amount:res.payout,price:res.price}; if (res.pricescale && res.pricescale !== 'absolute') d.pricescale = res.pricescale; if (res.maxPrice) d.maxPrice = res.maxPrice; descriptions.push(d) }
   if (p.chance < 100) descriptions.push({type:'chance',value:p.chance})
   if (p.research) { const d: Row = {type:'research',id:p.research}; if (loader.ware_index[p.research]?.nameId) { d.nameId = loader.ware_index[p.research].nameId; names.add(d.nameId) } descriptions.push(d) }
   if (descriptions.length) p.descriptions = descriptions
   p.predecessors = p.predecessors.map((pred: Row) => pred.ref === '$PilotTrainingCourseProject' ? {...pred,ref:'trn_pilot'} : pred)
 }
 buildDependencies(projects)
 const projectMap = Object.fromEntries(projects.map(p => [p.id,p]))
 for (const c of clusters) {
   const ignored = new Set<string>(c.removedStats)
   for (const [flag,stat] of Object.entries(ignoreStats)) if (c.values['$'+flag] === 'true') ignored.add(stat)
   const matches = (id: string) => !(id in dynamicStats) || (dynamicStats[id]! in c.initialStats && !ignored.has(dynamicStats[id]!))
   const tasks: string[] = []
   for (const id of c.projectIds) if (matches(id)) uniqueAppend(tasks,id)
   for (const id of Object.keys(dynamicStats)) if (matches(id)) uniqueAppend(tasks,id)
   for (let i = 0; i < tasks.length; i++) for (const e of projectMap[tasks[i]!]?.sideEffects ?? []) if (e.project && matches(e.project)) uniqueAppend(tasks,e.project)
   c.taskProjectIds = tasks
 }
 for (const s of stats) { collect(names,s.nameId,s.inactiveTextId); for (const r of s.ranges) collect(names,r.descriptionId) }
 for (const g of projectGroups) collect(names,g.nameId)
 loader.terraforming_data = {stats,projectGroups,projects,clusters,deliveryShips:[...ships.values()].sort((x,y) => x.macro < y.macro ? -1 : x.macro > y.macro ? 1 : 0)}
}
