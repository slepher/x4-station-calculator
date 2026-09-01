import { describe, expect, it } from 'vitest'
import { classifyPlayerShip } from '@/store/logic/playerShipAvailability'
import type { PlayerShipEntry, PlayerShipOrderSummary } from '@/types/saveArchive'

function order(name: string): PlayerShipOrderSummary {
  return { id: name, order: name, failed: false }
}

function ship(patch: Partial<PlayerShipEntry> = {}): PlayerShipEntry {
  return {
    component_id: 'ship-1',
    code: 'ABC-123',
    macro: 'ship_arg_l_trans_container_01_a_macro',
    class: 'ship_l',
    assignment: { state: 'none' },
    default_order: order('Wait'),
    orders: [],
    is_repeat: false,
    ...patch
  }
}

describe('player ship availability', () => {
  it('retains station assignment and economic activity independently', () => {
    const result = classifyPlayerShip(ship({
      assignment: {
        state: 'resolved',
        commander_id: 'station-1',
        commander_kind: 'station',
        role: 'trade'
      },
      default_order: order('TradeRoutine')
    }), 'sector-a')

    expect(result).toMatchObject({
      assignment: 'station',
      activity: 'economic',
      availability: 'unavailable',
      reason: 'stationAssignment'
    })
  })

  it('classifies ship assignments as unavailable', () => {
    const result = classifyPlayerShip(ship({
      assignment: {
        state: 'resolved',
        commander_id: 'ship-commander',
        commander_kind: 'ship',
        role: 'defence'
      }
    }), 'sector-a')

    expect(result).toMatchObject({
      assignment: 'ship',
      activity: 'idle',
      availability: 'unavailable',
      reason: 'shipAssignment'
    })
  })

  it('keeps unresolved commander references unknown', () => {
    const result = classifyPlayerShip(ship({
      assignment: { state: 'unresolved', commander_ref: 'missing-connection' }
    }), 'sector-a')

    expect(result).toMatchObject({
      assignment: 'unknown',
      availability: 'unknown',
      reason: 'unresolvedAssignment'
    })
  })

  it.each(['TradeRoutine', 'MiningRoutine', 'SalvageRoutine'])(
    'classifies %s as unavailable economic work',
    (orderName) => {
      const result = classifyPlayerShip(ship({ default_order: order(orderName) }), 'sector-a')
      expect(result).toMatchObject({
        activity: 'economic',
        availability: 'unavailable',
        reason: 'economicOrder'
      })
    }
  )

  it('classifies explicitly confirmed repeat behavior as unavailable', () => {
    const result = classifyPlayerShip(ship({ is_repeat: true }), 'sector-a')

    expect(result).toMatchObject({
      activity: 'repeat',
      repeatStatus: 'confirmed',
      availability: 'unavailable',
      reason: 'repeatOrder'
    })
  })

  it('classifies default Wait with an empty queue as immediately available', () => {
    const result = classifyPlayerShip(ship(), 'sector-a')

    expect(result).toMatchObject({
      assignment: 'none',
      activity: 'idle',
      availability: 'immediatelyAvailable',
      reason: 'idleWait'
    })
  })

  it.each(['DockAndWait', 'FlyAndWait'])(
    'classifies a %s-only queue as reclaimable',
    (orderName) => {
      const result = classifyPlayerShip(ship({ orders: [order(orderName)] }), 'sector-a')
      expect(result).toMatchObject({
        activity: 'waitOnly',
        availability: 'reclaimable',
        reason: 'waitOnlyOrder'
      })
    }
  )

  it('keeps unrecognized active orders unknown', () => {
    const result = classifyPlayerShip(ship({ orders: [order('ExploreUnknownSpace')] }), 'sector-a')

    expect(result).toMatchObject({
      activity: 'unknown',
      availability: 'unknown',
      reason: 'unknownOrder'
    })
  })

  it('retains sector and L class without requiring a docking fact', () => {
    const result = classifyPlayerShip(ship(), 'sector-a')

    expect(result.sectorMacro).toBe('sector-a')
    expect(result.class).toBe('ship_l')
    expect(result.availability).toBe('immediatelyAvailable')
  })
})
