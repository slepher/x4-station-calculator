import { describe, expect, it } from 'vitest'
import { calculateTradeAutoFill } from '@/store/logic/tradeAutoFill'
import { fact, wares } from './fixtures'

describe('four inventory target rules', () => {
  it('aggregates station building deficits before deducting group stock once: 2000', () => {
    const r = calculateTradeAutoFill([fact('hub', 'trade'), fact('a', 'station', 8000, 3000, 2000), fact('b', 'station', 4000, 1000, 4000)], 'hub', 'buy', wares)
    expect(r.status === 'ready' && r.targets).toEqual([{ wareId: 'hullparts', targetQty: 2000 }])
  })
  it('sells existing group output surplus: 11000 - 8000 = 3000', () => {
    const r = calculateTradeAutoFill([fact('hub', 'trade', 0, 0, 1000), fact('a', 'station', 5000, 0, 4000), fact('b', 'station', 3000, 0, 6000)], 'hub', 'sell', wares)
    expect(r.status === 'ready' && r.targets).toEqual([{ wareId: 'hullparts', targetQty: 3000 }])
  })
  it('uses group stock for own purchasing and own stock/retention for own selling', () => {
    const facts = [fact('hub', 'trade', 900, 0, 500), fact('a', 'station', 100, 0, 200)]
    const buy = calculateTradeAutoFill(facts, 'a', 'buy', wares)
    const sell = calculateTradeAutoFill(facts, 'a', 'sell', wares)
    expect(buy.status === 'ready' && buy.targets).toEqual([])
    expect(sell.status === 'ready' && sell.targets).toEqual([{ wareId: 'hullparts', targetQty: 100 }])
  })
  it('returns valid empty results for satisfied construction and insufficient surplus', () => {
    for (const direction of ['buy', 'sell'] as const) {
      const r = calculateTradeAutoFill([fact('hub', 'trade', 100, 0, 100)], 'hub', direction, wares)
      expect(r.status === 'ready' && r.targets).toEqual([])
    }
  })
  it('excludes purchased-only stock, future outputs and non-primary outputs', () => {
    const a = fact('a', 'station', 0, 0, 500)
    a.stock.input = 999; a.stock.future = 900; a.stock.energycells = 888
    a.producedWareIds.push('energycells')
    const own = calculateTradeAutoFill([a], 'a', 'sell', wares)
    const group = calculateTradeAutoFill([fact('hub', 'trade'), a], 'hub', 'sell', wares)
    expect(own.status === 'ready' && own.targets.map(t => t.wareId)).toEqual(['hullparts'])
    expect(group.status === 'ready' && group.targets.map(t => t.wareId)).toEqual(['hullparts'])
  })
  it('includes a ware primary at any group station while using inventory across the group', () => {
    const a = fact('a', 'station', 0, 0, 50); a.stock.energycells = 800; a.producedWareIds.push('energycells')
    const b = fact('b', 'station', 0, 0, 0); b.stock.energycells = 200; b.producedWareIds.push('energycells'); b.primaryWareIds.push('energycells')
    const hub = fact('hub', 'trade'); hub.producedWareIds = []; hub.primaryWareIds = []
    const r = calculateTradeAutoFill([hub, a, b], 'hub', 'sell', wares)
    expect(r.status === 'ready' && r.targets).toEqual([{ wareId: 'energycells', targetQty: 1000 }, { wareId: 'hullparts', targetQty: 50 }])
    b.primaryWareIds = ['hullparts']
    const secondaryOnly = calculateTradeAutoFill([hub, a, b], 'hub', 'sell', wares)
    expect(secondaryOnly.status === 'ready' && secondaryOnly.targets).toEqual([{ wareId: 'hullparts', targetQty: 50 }])
  })
  it('supports virtual plan demand and no virtual spot inventory', () => {
    const virtual = fact('v', 'station', 100, 0, 0); virtual.producedWareIds = []; virtual.primaryWareIds = []
    const buy = calculateTradeAutoFill([virtual], 'v', 'buy', wares)
    const sell = calculateTradeAutoFill([virtual], 'v', 'sell', wares)
    expect(buy.status === 'ready' && buy.targets[0]!.targetQty).toBe(100)
    expect(sell.status === 'ready' && sell.targets).toEqual([])
  })
  it('sorts unique positive integer targets and preserves inputs', () => {
    const a = fact('a', 'trade', 0, 0, 11000000); a.stock.energycells = 999; a.producedWareIds.push('energycells'); a.primaryWareIds.push('energycells')
    const before = JSON.stringify(a)
    const r = calculateTradeAutoFill([a], 'a', 'sell', wares)
    expect(r.status === 'ready' && r.targets).toEqual([{ wareId: 'energycells', targetQty: 999 }, { wareId: 'hullparts', targetQty: 11000000 }])
    expect(JSON.stringify(a)).toBe(before)
  })
  it('rejects unknown wares and invalid or duplicate membership', () => {
    const a = fact('a', 'station'); a.stock.unknown = 5
    expect(calculateTradeAutoFill([a], 'a', 'buy', wares)).toMatchObject({ status: 'unavailable', reason: 'wareUnknown' })
    expect(calculateTradeAutoFill([fact('a', 'station')], 'missing', 'buy', wares).status).toBe('unavailable')
    expect(calculateTradeAutoFill([fact('a', 'station'), fact('a', 'station')], 'a', 'buy', wares).status).toBe('unavailable')
  })
})
