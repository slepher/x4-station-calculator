import { describe, expect, it } from 'vitest'
import {
  solveMultiWareByLink,
  solveSingleWareDistancePull,
  type SolveMultiWareByLinkInput
} from '../../../src/store/logic/sectorLinkFlow'

function run(input: SolveMultiWareByLinkInput) {
  return solveMultiWareByLink({ epsilon: 1e-9, ...input })
}

describe('solveMultiWareByLink', () => {
  it('returns link-level flows grouped by ware and direction', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', netByWare: { ore: 100, food: 0 } },
        { sectorId: 'B', netByWare: { ore: -40, food: 50 } },
        { sectorId: 'C', netByWare: { ore: 0, food: -20 } }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'BC', a: 'B', b: 'C', distance: 1 }
      ]
    })

    expect(out.linkWareFlows).toEqual([
      { linkId: 'AB', wareId: 'ore', from: 'A', to: 'B', amount: 40 },
      { linkId: 'BC', wareId: 'food', from: 'B', to: 'C', amount: 20 }
    ])
    expect(out.allocatedDemandBySector).toEqual([
      {
        sectorId: 'B',
        totalAmount: 40,
        byWare: { ore: 40 }
      },
      {
        sectorId: 'C',
        totalAmount: 20,
        byWare: { food: 20 }
      }
    ])
  })

  it('keeps wares isolated from each other', () => {
    const base: SolveMultiWareByLinkInput = {
      sectors: [
        { sectorId: 'A', netByWare: { ore: 50, food: 0 } },
        { sectorId: 'B', netByWare: { ore: -20, food: 40 } },
        { sectorId: 'C', netByWare: { ore: 0, food: -40 } }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'BC', a: 'B', b: 'C', distance: 1 }
      ]
    }
    const changedOre: SolveMultiWareByLinkInput = {
      ...base,
      sectors: [
        { sectorId: 'A', netByWare: { ore: 80, food: 0 } },
        { sectorId: 'B', netByWare: { ore: -20, food: 40 } },
        { sectorId: 'C', netByWare: { ore: 0, food: -40 } }
      ]
    }

    const out1 = run(base)
    const out2 = run(changedOre)
    const food1 = out1.linkWareFlows.filter((f) => f.wareId === 'food')
    const food2 = out2.linkWareFlows.filter((f) => f.wareId === 'food')
    expect(food2).toEqual(food1)
  })

  it('matches per-ware single-solver baseline', () => {
    const input: SolveMultiWareByLinkInput = {
      sectors: [
        { sectorId: 'A', netByWare: { ore: 60, food: -10 } },
        { sectorId: 'B', netByWare: { ore: -30, food: 20 } },
        { sectorId: 'C', netByWare: { ore: -30, food: -10 } }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'AC', a: 'A', b: 'C', distance: 3 },
        { linkId: 'BC', a: 'B', b: 'C', distance: 1 }
      ]
    }
    const out = run(input)

    const oreSingle = solveSingleWareDistancePull({
      sectors: input.sectors.map((s) => ({ sectorId: s.sectorId, net: s.netByWare.ore || 0 })),
      links: input.links,
      epsilon: 1e-9
    })
    const foodSingle = solveSingleWareDistancePull({
      sectors: input.sectors.map((s) => ({ sectorId: s.sectorId, net: s.netByWare.food || 0 })),
      links: input.links,
      epsilon: 1e-9
    })

    const oreFromMulti = out.linkWareFlows
      .filter((f) => f.wareId === 'ore')
      .map(({ wareId, ...rest }) => rest)
    const foodFromMulti = out.linkWareFlows
      .filter((f) => f.wareId === 'food')
      .map(({ wareId, ...rest }) => rest)

    expect(oreFromMulti).toEqual(oreSingle.linkFlows)
    expect(foodFromMulti).toEqual(foodSingle.linkFlows)
  })

  it('aggregates deficitByNode and producerNodes by node across wares', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', netByWare: { ore: 10, food: 0 } },
        { sectorId: 'D', netByWare: { ore: 0, food: 5 } },
        { sectorId: 'B', netByWare: { ore: -30, food: -10 } }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'DB', a: 'D', b: 'B', distance: 1 }
      ]
    })

    expect(out.deficitSummary).toEqual({
      totalDeficit: 25,
      deficitByNode: [
        {
          sectorId: 'B',
          totalAmount: 25,
          byWare: { food: 5, ore: 20 }
        }
      ],
      producerNodes: [
        { sectorId: 'B', producerSectorIds: ['A', 'D'] }
      ]
    })
    expect(out.allocatedDemandBySector).toEqual([
      {
        sectorId: 'B',
        totalAmount: 15,
        byWare: { food: 5, ore: 10 }
      }
    ])
  })
})
