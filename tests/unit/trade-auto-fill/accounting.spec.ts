import { describe, expect, it } from 'vitest'
import { aggregateTradeCargo, calculateTradeAutoFill, buildTradeStationFacts } from '@/store/logic/tradeAutoFill'
import { fact, wares, modules, makeMember, makeArchiveStation } from './fixtures'

describe('per station construction ledger', () => {
  it('keeps surplus building stock at its owner and outside sell inventory', () => {
    const facts = [fact('a', 'trade', 100, 150, 0), fact('b', 'station', 80, 0, 0)]
    const r = calculateTradeAutoFill(facts, 'a', 'buy', wares)
    expect(r.status).toBe('ready')
    if (r.status !== 'ready') return
    expect(r.targets[0]!.targetQty).toBe(80)
    expect(r.accounts[0]).toMatchObject({ requirement: 180, buildingStock: 150, buildingApplied: 100, deficit: 80, stock: 0 })
    const sell = calculateTradeAutoFill(facts, 'a', 'sell', wares)
    expect(sell.status === 'ready' && sell.targets).toEqual([])
  })
  it('adds duplicate cargo entries without mixing ordinary stock and building cargo/reservation', () => {
    expect(aggregateTradeCargo([{ ware: 'hullparts', amount: 10 }, { ware: 'hullparts', amount: 20 }])).toEqual({ hullparts: 30 })
    const archive = makeArchiveStation(); archive.cargo!.push({ ware: 'hullparts', amount: 10 })
    const r = buildTradeStationFacts({ member: makeMember(), archive, targetModules: [{ id: 'factory', count: 4 }], priorityLevels: { hullparts: 2 }, modulesMap: modules, waresMap: wares })
    expect(r.status).toBe('ready')
    if (r.status === 'ready') expect(r.facts).toMatchObject({ requirements: { hullparts: 200 }, buildingStock: { hullparts: 20 }, stock: { hullparts: 40 } })
  })
  it('rejects invalid stock and unknown material rather than producing an empty result', () => {
    const a = fact('a', 'trade', 0, 0, -1)
    expect(calculateTradeAutoFill([a], 'a', 'sell', wares).status).toBe('unavailable')
    a.stock.hullparts = 1.5
    expect(calculateTradeAutoFill([a], 'a', 'sell', wares).status).toBe('unavailable')
    const archive = makeArchiveStation(); archive.building.cargo.push({ ware: 'unknown', amount: 1 })
    expect(buildTradeStationFacts({ member: makeMember(), archive, targetModules: [], priorityLevels: {}, modulesMap: modules, waresMap: wares }).status).toBe('unavailable')
  })
})

it('does not let invalid per-station amounts disappear in valid group sums', () => {
  const a = fact('a', 'trade', 0, 0, -10); const b = fact('b', 'station', 0, 0, 20)
  expect(calculateTradeAutoFill([a, b], 'a', 'sell', wares)).toMatchObject({ status: 'unavailable', reason: 'quantity' })
  const archive = makeArchiveStation(); archive.cargo = [{ ware: 'hullparts', amount: -1 }, { ware: 'hullparts', amount: 30 }]
  expect(buildTradeStationFacts({ member: makeMember(), archive, targetModules: [], priorityLevels: {}, modulesMap: modules, waresMap: wares })).toMatchObject({ status: 'unavailable', reason: 'quantity' })
})
