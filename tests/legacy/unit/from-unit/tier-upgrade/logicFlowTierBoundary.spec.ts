import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeExpandUpstream, selectModuleForFlow } from '@/store/logic/logicFlowStream'
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

  it('includes the recycling upstream chain and selects a processor for a manual tier 1 root', () => {
    const waresMap = Object.fromEntries([
      ['hullparts', 2],
      ['scrapmetal', 1],
      ['rawscrap', 0],
      ['energycells', 0],
    ].map(([id, tier]) => [id, { id, tier, transmutable: false } as X4Ware]))
    const recycler = {
      id: 'recycler', type: 'production', method: 'recycling', race: 'default', group: 'shiptech',
      outputs: { hullparts: 1200 }, inputs: { scrapmetal: 2250, energycells: 93000 },
    } as X4Module
    const processor = {
      id: 'processor', type: 'processingmodule', method: 'none', race: 'default', group: 'refined',
      outputs: { scrapmetal: 9000 }, inputs: { rawscrap: 9000, energycells: 90000 },
    } as X4Module
    const solar = {
      id: 'solar', type: 'production', method: 'default', race: 'default', group: 'energy',
      outputs: { energycells: 1000 }, inputs: {},
    } as X4Module
    const modulesMap = { recycler, processor, solar }
    const modulesByOutputMap = {
      hullparts: [recycler],
      scrapmetal: [processor],
      energycells: [solar],
    }

    const candidates = precomputeCandidateWares(modulesMap, waresMap, modulesByOutputMap)
    expect(candidates.wareSetsByIndustrialRace.recycling).toEqual(
      new Set(['hullparts', 'scrapmetal', 'rawscrap', 'energycells'])
    )

    const group = { id: 'group', nodes: [], isLocked: false, subCategory: 'recycling' }
    expect(selectModuleForFlow(
      { waresMap, modulesMap, modulesByOutputMap }, group, 'scrapmetal', 'manual',
    )).toEqual({ module: processor, lineage: 'default' })
    expect(selectModuleForFlow(
      { waresMap, modulesMap, modulesByOutputMap }, group, 'hullparts', 'manual',
    )).toEqual({ module: recycler, lineage: 'default' })
  })
})
