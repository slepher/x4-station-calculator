import { describe, expect, it, vi } from 'vitest'
import { createProductionWareRuleActions } from '@/store/actions/productionWareRuleActions'

describe('createProductionWareRuleActions', () => {
  it('forbids locking archive-produced ware without forcing locked state', () => {
    const station = {
      id: 'station-1',
      lockedWares: [] as string[],
      warePriority: {},
      settings: {} as any
    }

    const actions = createProductionWareRuleActions({
      getActiveStation: () => station,
      getComputeDeps: () => ({}) as any,
      getPlannedModules: () => [],
      getAutoIndustryModules: () => [],
      getModulesMap: () => ({}),
      getWaresMap: () => ({
        energycells: { transport: 'container' },
        ore: { transport: 'solid' }
      }) as any,
      isLockForbidden: (wareId) => wareId === 'energycells',
      getLockedWares: () => station.lockedWares,
      getWarePriority: () => station.warePriority,
      cloneStringList: (values) => [...values],
      clonePriorityMap: (values) => ({ ...values }),
      now: () => 123,
      commitStationMutation: vi.fn(),
      recompute: vi.fn()
    })

    expect(actions.isWareOperable('energycells')).toBe(false)
    expect(actions.isWareLocked('energycells')).toBe(false)
    expect(actions.isWareLocked('ore')).toBe(true)

    expect(actions.toggleWareLock('energycells')).toEqual({
      ok: false,
      reason: 'ware-lock-forbidden'
    })
    expect(station.lockedWares).toEqual([])
  })

  it('treats recommended-planned outputs as default priority 2', () => {
    const station = {
      id: 'station-1',
      lockedWares: [] as string[],
      warePriority: {},
      settings: {} as any
    }

    const actions = createProductionWareRuleActions({
      getActiveStation: () => station,
      getComputeDeps: () => ({}) as any,
      getPlannedModules: () => [{ id: 'orphan_mod', count: 4 }],
      getAutoIndustryModules: () => [],
      getModulesMap: () => ({
        orphan_mod: {
          id: 'orphan_mod',
          outputs: { energycells: 100 },
          inputs: {},
          type: 'production',
          method: 'default'
        }
      }) as any,
      getWaresMap: () => ({
        energycells: { transport: 'container' }
      }) as any,
      getLockedWares: () => station.lockedWares,
      getWarePriority: () => station.warePriority,
      cloneStringList: (values) => [...values],
      clonePriorityMap: (values) => ({ ...values }),
      now: () => 123,
      commitStationMutation: vi.fn(),
      recompute: vi.fn()
    })

    expect(actions.getResolvedLevel('energycells')).toBe(2)
  })
})
