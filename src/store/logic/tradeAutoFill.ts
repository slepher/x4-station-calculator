import type { BindingStationPlan, SaveBindingPlan, SavedModule, X4Module, X4Ware } from '@/types/x4'
import type { ArchiveStationData, PlayerStationRecord, WareAmount } from '@/types/saveArchive'
import type { PlayerTradeDirection, WareTarget } from './npcTradeOffers'
import { isSectorMacroInBindingScope } from './saveBindingSectorScope'

export type TradeRole = 'trade' | 'station'
export interface TradeUnavailable {
  status: 'unavailable'
  reason: 'context' | 'loading' | 'ownership' | 'stationMissing' | 'storageMissing' | 'moduleUnknown' | 'wareUnknown' | 'classification' | 'quantity'
  entityId?: string
}
export interface TradeMember {
  entityId: string
  referenceId: string
  role: TradeRole
  name: string
  sectorMacro: string | null
  stationCode: string | null
  plan: BindingStationPlan | null
}
export type TradeMembersResult = { status: 'ready'; members: TradeMember[] } | TradeUnavailable

export function resolveTradeMembers(binding: SaveBindingPlan, groupId: string, records: PlayerStationRecord[]): TradeMembersResult {
  const groupIndex = binding.groups.findIndex(g => g.sectorMacro === groupId)
  if (groupIndex < 0 || binding.groups.filter(g => g.sectorMacro === groupId).length !== 1) return { status: 'unavailable', reason: 'ownership' }
  const group = binding.groups[groupIndex]!
  const members = new Map<string, TradeMember>()
  const plansByCode = new Map<string, BindingStationPlan>()
  const planIds = new Set<string>()
  for (const plan of binding.stationPlans) {
    if (planIds.has(plan.id)) return { status: 'unavailable', reason: 'ownership', entityId: plan.id }
    planIds.add(plan.id)
    if (plan.saveStationCode !== undefined) {
      if (plansByCode.has(plan.saveStationCode)) return { status: 'unavailable', reason: 'ownership', entityId: plan.saveStationCode }
      plansByCode.set(plan.saveStationCode, plan)
    }
  }
  const stationRecords = records.filter(r => r.type === 'station')
  const codes = new Set<string>()
  for (const record of stationRecords) {
    if (codes.has(record.code)) return { status: 'unavailable', reason: 'ownership', entityId: record.code }
    codes.add(record.code)
    const plan = plansByCode.get(record.code)
    const tradeOwners = binding.groups.filter(g => g.tradeStation?.saveStationCode === record.code)
    if (tradeOwners.length > 1) return { status: 'unavailable', reason: 'ownership', entityId: record.code }
    let owner: string | null
    if (plan !== undefined && plan.groupId != null) {
      owner = plan.groupId
      if (tradeOwners.length === 1 && tradeOwners[0]!.sectorMacro !== owner) return { status: 'unavailable', reason: 'ownership', entityId: record.code }
    } else if (tradeOwners.length === 1) {
      const tradeOwner = tradeOwners[0]!.sectorMacro
      owner = tradeOwner === undefined ? null : tradeOwner
    } else {
      const owners = binding.groups.filter(g => isSectorMacroInBindingScope(g, record.sectorMacro))
      if (owners.length > 1 && owners.some(g => g === group)) return { status: 'unavailable', reason: 'ownership', entityId: record.code }
      owner = owners.length === 1 && owners[0]!.sectorMacro !== undefined ? owners[0]!.sectorMacro! : null
    }
    if (owner !== groupId) continue
    let name = record.code
    if (plan !== undefined) name = plan.name
    else if (tradeOwners.length === 1) name = tradeOwners[0]!.tradeStation!.name
    members.set(record.code, {
      entityId: record.code, referenceId: plan === undefined ? `archive:${record.code}` : `station:${plan.id}`,
      role: tradeOwners.length === 1 ? 'trade' : 'station', name,
      sectorMacro: record.sectorMacro, stationCode: record.code, plan: plan === undefined ? null : plan
    })
  }
  for (const plan of binding.stationPlans) {
    if (plan.groupId !== groupId) continue
    if (plan.saveStationCode !== undefined) {
      if (!codes.has(plan.saveStationCode)) return { status: 'unavailable', reason: 'stationMissing', entityId: plan.saveStationCode }
      continue
    }
    members.set(`virtual:${plan.id}`, {
      entityId: plan.id, referenceId: `station:${plan.id}`, role: 'station', name: plan.name,
      sectorMacro: plan.sectorMacro === undefined ? groupId : plan.sectorMacro, stationCode: null, plan
    })
  }
  const trade = group.tradeStation
  if (trade !== undefined) {
    if (trade.saveStationCode !== undefined) {
      if (!members.has(trade.saveStationCode)) return { status: 'unavailable', reason: 'stationMissing', entityId: trade.saveStationCode }
    } else {
      const virtualPlan = members.get(`virtual:${trade.id}`)
      if (virtualPlan !== undefined) virtualPlan.role = 'trade'
      else members.set(`virtual:${trade.id}`, {
        entityId: trade.id, referenceId: `trade:${groupIndex}:${trade.id}`, role: 'trade', name: trade.name,
        sectorMacro: trade.sectorMacro === undefined ? groupId : trade.sectorMacro, stationCode: null, plan: null
      })
    }
  }
  return { status: 'ready', members: [...members.values()] }
}

export interface TradeStationFacts {
  entityId: string
  role: TradeRole
  requirements: Record<string, number>
  buildingStock: Record<string, number>
  stock: Record<string, number>
  producedWareIds: string[]
  primaryWareIds: string[]
}
export interface TradeWareAccount {
  wareId: string
  requirement: number
  buildingStock: number
  buildingApplied: number
  deficit: number
  stock: number
}
export interface TradeReady {
  status: 'ready'
  targets: Array<WareTarget & { targetQty: number }>
  accounts: Array<TradeWareAccount & { suggested: number }>
  stations: Array<{ entityId: string; accounts: TradeWareAccount[] }>
}
export type TradeAutoFillResult = TradeReady | TradeUnavailable

export function aggregateTradeCargo(cargo: WareAmount[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of cargo) result[item.ware] = (result[item.ware] ?? 0) + item.amount
  return result
}

export function buildTradeStationFacts(input: {
  member: TradeMember
  archive: ArchiveStationData | null
  targetModules: SavedModule[]
  priorityLevels: Record<string, number> | null
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
}): { status: 'ready'; facts: TradeStationFacts } | TradeUnavailable {
  const { member, archive, targetModules, priorityLevels, modulesMap, waresMap } = input
  if (member.stationCode !== null && archive === null) return { status: 'unavailable', reason: 'stationMissing', entityId: member.entityId }
  const built = archive === null ? [] : archive.modules
  const queued = archive === null ? [] : archive.building.modules
  const consumed = archive === null || archive.building.inProgressModule === undefined ? [] : [archive.building.inProgressModule]
  if ([...targetModules, ...built, ...queued, ...consumed].some(m => !Number.isSafeInteger(m.count) || m.count < 0)) {
    return { status: 'unavailable', reason: 'quantity', entityId: member.entityId }
  }
  if (archive !== null) {
    const cargo = archive.cargo === undefined ? [] : archive.cargo
    if ([...cargo, ...archive.building.cargo].some(c => !Number.isSafeInteger(c.amount) || c.amount < 0)) {
      return { status: 'unavailable', reason: 'quantity', entityId: member.entityId }
    }
  }
  const counts = (modules: SavedModule[]) => {
    const result: Record<string, number> = {}
    for (const m of modules) result[m.id] = (result[m.id] ?? 0) + m.count
    return result
  }
  const builtCounts = counts(built)
  const queuedCounts = counts(queued)
  const consumedCounts = counts(consumed)
  const targetCounts = counts(targetModules)
  const requirements: Record<string, number> = {}
  const produced = new Set<string>()
  for (const id of new Set([...Object.keys(targetCounts), ...Object.keys(builtCounts), ...Object.keys(queuedCounts)])) {
    const info = modulesMap[id]
    if (info === undefined) return { status: 'unavailable', reason: 'moduleUnknown', entityId: id }
    const remaining = member.stationCode === null && member.role === 'trade' ? 0
      : Math.max(0, Math.max(targetCounts[id] ?? 0, (builtCounts[id] ?? 0) + (queuedCounts[id] ?? 0)) - (builtCounts[id] ?? 0) - (consumedCounts[id] ?? 0))
    if (info.buildCost === undefined) return { status: 'unavailable', reason: 'moduleUnknown', entityId: id }
    for (const [wareId, amount] of Object.entries(info.buildCost)) {
      if (waresMap[wareId] === undefined) return { status: 'unavailable', reason: 'wareUnknown', entityId: wareId }
      if (remaining > 0) requirements[wareId] = (requirements[wareId] ?? 0) + remaining * amount
    }
    if ((builtCounts[id] ?? 0) > 0) {
      for (const wareId of Object.keys(info.outputs)) {
        if (waresMap[wareId] === undefined) return { status: 'unavailable', reason: 'wareUnknown', entityId: wareId }
        produced.add(wareId)
      }
    }
  }
  if (priorityLevels === null && produced.size > 0) return { status: 'unavailable', reason: 'classification', entityId: member.entityId }
  const stock = archive === null ? {} : aggregateTradeCargo(archive.cargo === undefined ? [] : archive.cargo)
  const buildingStock = archive === null ? {} : aggregateTradeCargo(archive.building.cargo)
  for (const values of [requirements, stock, buildingStock]) {
    for (const [wareId, amount] of Object.entries(values)) {
      if (waresMap[wareId] === undefined) return { status: 'unavailable', reason: 'wareUnknown', entityId: wareId }
      if (!Number.isSafeInteger(amount) || amount < 0) return { status: 'unavailable', reason: 'quantity', entityId: wareId }
    }
  }
  return { status: 'ready', facts: {
    entityId: member.entityId, role: member.role, requirements, stock, buildingStock,
    producedWareIds: [...produced], primaryWareIds: [...produced].filter(id => priorityLevels !== null && priorityLevels[id] === 2)
  } }
}

export function calculateTradeAutoFill(facts: TradeStationFacts[], selectedEntityId: string, direction: PlayerTradeDirection, waresMap: Record<string, X4Ware>): TradeAutoFillResult {
  const selected = facts.find(f => f.entityId === selectedEntityId)
  if (selected === undefined || new Set(facts.map(f => f.entityId)).size !== facts.length) return { status: 'unavailable', reason: 'ownership' }
  for (const f of facts) {
    if ([...Object.values(f.requirements), ...Object.values(f.buildingStock), ...Object.values(f.stock)].some(n => !Number.isSafeInteger(n) || n < 0)) {
      return { status: 'unavailable', reason: 'quantity', entityId: f.entityId }
    }
  }
  const allWares = new Set<string>()
  for (const f of facts) {
    for (const id of [...Object.keys(f.requirements), ...Object.keys(f.buildingStock), ...Object.keys(f.stock), ...f.producedWareIds, ...f.primaryWareIds]) allWares.add(id)
  }
  const wareIds = [...allWares].sort()
  for (const id of wareIds) if (waresMap[id] === undefined) return { status: 'unavailable', reason: 'wareUnknown', entityId: id }
  const stations = facts.map(f => ({ entityId: f.entityId, accounts: wareIds.map(wareId => {
    const requirement = f.requirements[wareId] ?? 0
    const buildingStock = f.buildingStock[wareId] ?? 0
    return { wareId, requirement, buildingStock, buildingApplied: Math.min(requirement, buildingStock), deficit: Math.max(0, requirement - buildingStock), stock: f.stock[wareId] ?? 0 }
  }) }))
  const selectedAccounts = stations.find(s => s.entityId === selectedEntityId)!.accounts
  const groupPrimaryWares = new Set(facts.flatMap(f => f.primaryWareIds))
  const targets: TradeReady['targets'] = []
  const accounts = wareIds.map((wareId, index) => {
    const total = stations.reduce((sum, s) => {
      const a = s.accounts[index]!
      return { wareId, requirement: sum.requirement + a.requirement, buildingStock: sum.buildingStock + a.buildingStock, buildingApplied: sum.buildingApplied + a.buildingApplied, deficit: sum.deficit + a.deficit, stock: sum.stock + a.stock }
    }, { wareId, requirement: 0, buildingStock: 0, buildingApplied: 0, deficit: 0, stock: 0 })
    const own = selectedAccounts[index]!
    const scope = selected.role === 'trade' ? total : own
    const stock = selected.role === 'station' && direction === 'sell' ? own.stock : total.stock
    const inScope = direction === 'buy' ? scope.requirement > 0 : selected.role === 'trade' ? groupPrimaryWares.has(wareId) : selected.primaryWareIds.includes(wareId)
    const suggested = !inScope ? 0 : direction === 'buy' ? Math.max(0, scope.deficit - stock) : Math.max(0, stock - scope.deficit)
    if (suggested > 0) targets.push({ wareId, targetQty: suggested })
    return { ...scope, stock, suggested }
  })
  if (accounts.some(a => [a.requirement, a.buildingStock, a.buildingApplied, a.deficit, a.stock, a.suggested].some(n => !Number.isSafeInteger(n) || n < 0))) return { status: 'unavailable', reason: 'quantity' }
  return { status: 'ready', targets, accounts, stations }
}
