import { describe, expect, it } from 'vitest'
import {
  normalizeNpcTradeSectorOwner,
  paginateNpcTradeSectorGroups,
  npcTradeSourceLabelKey
} from '@/components/empire/presenters/useNpcTradePresenter'

describe('NPC trade presenter labels', () => {
  it('uses a seller label when the player buys from a station', () => {
    expect(npcTradeSourceLabelKey('buy', 'station')).toBe('npc_trade.source.stationSell')
    expect(npcTradeSourceLabelKey('sell', 'station')).toBe('npc_trade.source.station')
  })

  it('treats ownerless sectors as having no sector owner', () => {
    expect(normalizeNpcTradeSectorOwner('ownerless')).toBeNull()
    expect(normalizeNpcTradeSectorOwner('')).toBeNull()
    expect(normalizeNpcTradeSectorOwner('argon')).toBe('argon')
  })

  it('paginates complete sector groups', () => {
    const sectors = Array.from({ length: 11 }, (_, index) => `sector-${index}`)

    expect(paginateNpcTradeSectorGroups(sectors, 1)).toEqual(sectors.slice(0, 10))
    expect(paginateNpcTradeSectorGroups(sectors, 2)).toEqual(['sector-10'])
  })
})
