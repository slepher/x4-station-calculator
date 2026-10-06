import type { Row } from './common'
function simplify(expr: Row | null): Row | null {
 if (!expr) return null
 for (const op of ['all','any']) if (op in expr) {
   const items: Row[] = []
   for (const c of expr[op]) { const s = simplify(c); if (s) items.push(...(op in s ? s[op] : [s])) }
   const unique = [...new Map(items.map(item => [JSON.stringify(item),item])).values()]
   return !unique.length ? null : unique.length === 1 ? unique[0]! : {[op]:unique}
 }
 return expr
}
export function buildDependencies(projects: Row[]) {
 const byId = Object.fromEntries(projects.map(p => [p.id,p])), sources: Record<string,string[]> = {}
 const same = (left: string,right: string) => Boolean(byId[left] && byId[right] && byId[left].group === byId[right].group)
 const blockers = (ref: string,id: string,group: string) => projects.filter(p => p.id && sources[p.id]?.includes(ref) && (p.blockedProjects.includes(id) || p.blockedGroups.includes(group))).map(p => p.id)
 const exclusive = (l: string,r: string) => byId[l] && byId[r] && (byId[l].removedProjects.includes(r) || byId[r].removedProjects.includes(l))
 for (const p of projects) { delete p.dependencyConditions; for (const effect of p.sideEffects) if (p.id && effect.project) { const ids = sources[effect.project] ??= []; if (!ids.includes(p.id)) ids.push(p.id) } }
 for (const p of projects) {
   const exprs: Row[] = [], attached = new Set<string>(), source = sources[p.id] ?? []
   if (source.length === 1) {
     const id = source[0]!
     if (same(id,p.id)) { const pred = {ref:id,type:'project',any:false}; if (!p.predecessors.some((e: Row) => e.ref === id && e.type === 'project' && !e.any)) p.predecessors.push(pred) }
     else exprs.push({completed:id})
   } else if (source.length > 1) exprs.push({any:source.map(completed => ({completed}))})
   const retained = p.predecessors.filter((e: Row) => e.type !== 'project'), any = p.predecessors.filter((e: Row) => e.type === 'project' && e.any), all = p.predecessors.filter((e: Row) => e.type === 'project' && !e.any)
   if (any.length && any.some((e: Row) => !same(e.ref,p.id) || blockers(e.ref,p.id,p.group).length)) {
     exprs.push({any:any.map((e: Row) => {
       const branch = [{completed:e.ref}]
       for (const id of blockers(e.ref,p.id,p.group)) { branch.push({completed:id}); attached.add(JSON.stringify([id,e.ref])) }
       return simplify({all:branch})
     })})
   } else retained.push(...any)
   for (const e of all) { if (same(e.ref,p.id)) retained.push(e); else exprs.push({completed:e.ref}) }
   p.predecessors = retained
   const plain: string[] = []
   for (const b of projects) {
     if (!b.id || (!b.blockedProjects.includes(p.id) && !b.blockedGroups.includes(p.group))) continue
     const s = sources[b.id] ?? []
     if (s.length) { for (const id of s) if (!attached.has(JSON.stringify([b.id,id]))) exprs.push({any:[{notCompleted:id},{completed:b.id}]}) }
     else if (!plain.includes(b.id)) plain.push(b.id)
   }
   while (plain.length) {
     const group = [plain.shift()!]; let changed = true
     while (changed) { changed = false; for (const id of [...plain]) if (group.some(g => exclusive(id,g))) { group.push(id); plain.splice(plain.indexOf(id),1); changed = true } }
     exprs.push(group.length === 1 ? {completed:group[0]} : {any:group.map(completed => ({completed}))})
   }
   for (const remover of projects) if (remover.id && remover.removedProjects.includes(p.id)) exprs.push({notCompleted:remover.id})
   const result = simplify({all:exprs})
   if (result) p.dependencies = result; else delete p.dependencies
 }
}
