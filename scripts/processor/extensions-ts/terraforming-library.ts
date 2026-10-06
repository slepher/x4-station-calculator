import { a, integer, nodes, descendants } from './common'
import type { Row } from './common'
export function parseStats(root: Row): Row[] {
  return descendants(root,'stats').flatMap(section => nodes(section.stat)).filter(n => a(n,'id')).map(n => {
    const dynamic = a(n,'dynamic','false') === 'true'
    const ranges: Row[] = nodes(n.range).map(r => {
      const entry: Row = {end:integer(a(r,'end'),0),state:integer(a(r,'state'),0),rgb:'#'+['r','g','b'].map(k => Number(a(r,k,'0')).toString(16).padStart(2,'0')).join('').toUpperCase(),descriptionId:a(r,'description')}
      if (r['@_habitable'] !== undefined) entry.habitable = a(r,'habitable') === 'true'
      return entry
    })
    if (dynamic && ranges.length && ranges[0]!.end !== 0) ranges.unshift({end:0,state:0,rgb:'#000000',descriptionId:''})
    let start = 0
    for (const r of ranges) { r.start = start; start = r.end + 1 }
    return {id:a(n,'id'),nameId:a(n,'name'),default:integer(a(n,'default'),0),dynamic,icon:a(n,'icon'),inactiveTextId:a(n,'inactivetext'),ranges}
  })
}
export function parseProjectGroups(root: Row): Row[] {
  return descendants(root,'projectgroups').flatMap(s => nodes(s.projectgroup)).filter(n => a(n,'id')).map(n => ({id:a(n,'id'),nameId:a(n,'name')}))
}
export function parseProjects(root: Row, names: Set<string>): Row[] {
  return descendants(root,'projects').flatMap(s => nodes(s.project)).filter(n => a(n,'id')).map(n => {
    const entry: Row = {id:a(n,'id'),group:a(n,'group'),nameId:a(n,'name'),descriptionId:a(n,'description'),duration:integer(n['@_duration']),repeatCooldown:n['@_repeatcooldown'] === undefined ? null : integer(n['@_repeatcooldown'],0),resilient:a(n,'resilient') === 'true',chance:integer(n['@_chance'],100),version:a(n,'version') || null,research:a(n,'research') || null,conditions:[],effects:[],sideEffects:[],resources:{price:0,wares:[]},deliveries:[],rebates:[],removedProjects:[],blockedProjects:[],blockedGroups:[],predecessors:[]}
    for (const id of [entry.nameId,entry.descriptionId]) if (id) names.add(id)
    entry.conditions = nodes(n.conditions?.condition).map(c => {
      const result: Row = {stat:a(c,'stat')}
      for (const k of ['min','max','minvalue','maxvalue']) { const v = integer(c['@_'+k]); if (v !== null) result[k] = v }
      result.usesStateBounds = 'min' in result || 'max' in result
      result.usesValueBounds = 'minvalue' in result || 'maxvalue' in result
      return result
    })
    entry.effects = nodes(n.effects?.effect).map(e => {
      const result: Row = {stat:a(e,'stat')}
      for (const k of ['change','value','min','max']) { const v = integer(e['@_'+k]); if (v !== null) result[k] = v }
      if (!('change' in result) && !('value' in result)) result.value = 0
      return result
    })
    entry.sideEffects = nodes(n.sideeffects?.sideeffect).map(s => {
      if (a(s,'text')) names.add(a(s,'text'))
      return {chance:integer(s['@_chance'],0),setback:integer(s['@_setback'],0),project:a(s,'project') || null,stat:a(s,'stat') || null,change:integer(s['@_change']),beneficial:a(s,'beneficial','true') === 'true',textId:a(s,'text') || null}
    })
    if (n.resources !== undefined) {
      entry.resources.price = Number(a(n.resources,'price','0'))
      const res = entry.resources
      if (n.resources['@_pricescale'] !== undefined) res.pricescale = a(n.resources,'pricescale')
      for (const [xml,key] of [['payout','payout'],['minwares','minWares'],['maxwares','maxWares'],['maxprice','maxPrice']]) if (n.resources['@_'+xml] !== undefined) res[key!] = integer(n.resources['@_'+xml])
      res.wares = nodes(n.resources.ware).map(w => ({ware:a(w,'ware'),amount:integer(w['@_amount'],0)}))
    }
    entry.deliveries = nodes(n.deliveries?.ship).map(d => ({macro:a(d,'macro'),amount:integer(d['@_amount'],0),buildDuration:integer(d['@_buildduration'],0)}))
    entry.rebates = nodes(n.rebates?.rebate).map(r => ({ware:a(r,'ware') || null,wareGroup:a(r,'waregroup') || null,value:integer(r['@_value'],0)}))
    for (const [section,tag,key] of [['removedprojects','project','removedProjects'],['blockedprojects','project','blockedProjects'],['blockedgroups','group','blockedGroups']]) entry[key!] = nodes(n[section!]?.[tag!]).map(p => a(p,'id')).filter(Boolean)
    return entry
  })
}
