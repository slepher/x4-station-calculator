import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeExpandUpstream } from '@/store/logic/logicFlowStream'
import { precomputeCandidateWares } from '@/store/logic/useGameData'
import { rebuildLogicFlowSnapshotFromPlan } from '@/store/logic/buildPlanLogicFlowSource'
import type { LogicFlowPlan, X4Module, X4Ware } from '@/types/x4'

const unrankedWare = { id: 'isolated', tier: null, transmutable: false } as X4Ware
const producer = {
  id: 'producer',
  race: 'default',
  group: 'hightech',
  method: 'default',
  outputs: { isolated: 1 },
  inputs: {},
} as X4Module

describe('Logic Flow tier boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rejects unranked wares from candidates and upstream expansion', () => {
    const waresMap = { isolated: unrankedWare }
    const modulesMap = { producer }
    const modulesByOutputMap = { isolated: [producer] }

    const candidates = precomputeCandidateWares(modulesMap, waresMap, modulesByOutputMap)
    expect(candidates.wareSetsByIndustrialRace.default).not.toContain('isolated')
    expect(computeExpandUpstream(
      { waresMap, modulesMap, modulesByOutputMap },
      { id: 'group', nodes: [], isLocked: false, subCategory: 'default' },
      'isolated',
      'manual',
    )).toEqual({ newNodes: [], updatedNodes: [] })
  })

  it('warns and skips an unranked ware while rebuilding a BuildPlan snapshot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plan = {
      id: 'plan',
      name: 'Plan',
      groups: [{
        id: 'group',
        name: 'Group',
        category: 'industrial',
        subCategory: 'default',
        isLocked: false,
        nodes: [{ isolated: 'isolated' }],
      }],
      settings: { isDefaultLocked: false },
      lastUpdated: 0,
    } as LogicFlowPlan

    const snapshot = rebuildLogicFlowSnapshotFromPlan(plan, {
      waresMap: { isolated: unrankedWare },
      modulesMap: {},
      modulesByOutputMap: {},
      getWareDisplayName: id => id,
    })

    expect(snapshot.groups[0]?.nodes).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })
})
