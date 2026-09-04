import { describe, expect, it } from 'vitest'
import type { SaveArchive } from '@/types/saveArchive'
import {
  buildNpcTradeCandidates,
  calculateContainerWareMaxLoad,
  createNpcTradeStationComparator,
  groupNpcTradeStations
} from '@/store/logic/npcTradeOffers'

const archive = {
  sectors: {
    alpha: {
      npc_stations: {
        A: {
          code: 'A', owner: 'argon', macro: 'station', relative_position: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 },
          tradeOffers: [
            { tradeId: 'a1', ware: 'hullparts', side: 'buy', price: 10, amount: 4, desired: 8, flags: [] },
            { tradeId: 'a2', ware: 'hullparts', side: 'buy', price: 12, amount: 10, desired: 10, flags: ['supplies'] },
            { tradeId: 'a3', ware: 'energycells', side: 'sell', price: 3, amount: 20, flags: [] }
          ],
          buildStorage: {
            componentId: 'build-a', code: 'BUILD-A', tradeOffers: [
              { tradeId: 'a4', ware: 'hullparts', side: 'buy', price: 11, amount: 6, desired: 6, flags: [] }
            ]
          }
        }
      }
    },
    beta: {
      npc_stations: {
        B: {
          code: 'B', owner: 'teladi', macro: 'station', relative_position: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 },
          tradeOffers: [
            { tradeId: 'b1', ware: 'hullparts', side: 'buy', price: 13, amount: 5, desired: 5, flags: [] },
            { tradeId: 'b2', ware: 'energycells', side: 'sell', price: 2, amount: 5, flags: [] }
          ]
        }
      }
    }
  }
} as SaveArchive

describe('NPC trade offer domain logic', () => {
  it('calculates empty-hold maximum load independently of target quantity and current cargo', () => {
    expect(calculateContainerWareMaxLoad(62000, { transport: 'container', volume: 10 })).toBe(6200)
    expect(calculateContainerWareMaxLoad(62000, { transport: 'solid', volume: 10 })).toBe(0)
    expect(calculateContainerWareMaxLoad(62000, { transport: 'container', volume: 0 })).toBe(0)
  })

  it('keeps station, supplies, and buildstorage demand separate', () => {
    const candidates = buildNpcTradeCandidates(archive, 'sell', ['hullparts'])
    expect(candidates[0]?.offersByWare.hullparts?.map((offer) => offer.source)).toEqual([
      'station', 'supplies', 'buildStorage'
    ])
    expect(candidates[0]?.offersByWare.hullparts?.[2]?.amount).toBe(6)
  })

  it('uses direction-aware single ware ranking', () => {
    const sell = buildNpcTradeCandidates(archive, 'sell', ['hullparts'])
    const sellComparator = createNpcTradeStationComparator({
      direction: 'sell', rankMode: 'primary', metric: 'fillablePrice',
      targets: [{ wareId: 'hullparts', targetQty: 6 }], primaryWareId: 'hullparts'
    })
    expect(sell.sort(sellComparator).map((station) => station.code)).toEqual(['A', 'B'])

    const buy = buildNpcTradeCandidates(archive, 'buy', ['energycells'])
    const buyComparator = createNpcTradeStationComparator({
      direction: 'buy', rankMode: 'primary', metric: 'targetTotal',
      targets: [{ wareId: 'energycells', targetQty: 10 }], primaryWareId: 'energycells'
    })
    expect(buy.sort(buyComparator).map((station) => station.code)).toEqual(['A', 'B'])
  })

  it('treats missing wares as zero in composite ranking and reuses station order for sectors', () => {
    const candidates = buildNpcTradeCandidates(archive, 'sell', ['hullparts', 'energycells'])
    const comparator = createNpcTradeStationComparator({
      direction: 'sell', rankMode: 'composite', metric: 'quantity',
      targets: [
        { wareId: 'hullparts', targetQty: 5 },
        { wareId: 'energycells', targetQty: 5 }
      ],
      primaryWareId: 'hullparts'
    })
    expect(candidates.sort(comparator).map((station) => station.code)).toEqual(['B', 'A'])
    expect(groupNpcTradeStations(candidates, comparator).map((group) => group.sectorMacro)).toEqual(['beta', 'alpha'])
  })
})
