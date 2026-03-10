import { describe, expect, it } from 'vitest'
import {
  getSectorNetworkComponent,
  solveSingleWareDistancePull,
  splitSectorNetwork,
  type SolveSingleWareDistancePullInput
} from '../../../src/store/logic/sectorLinkFlow'

function run(input: SolveSingleWareDistancePullInput) {
  return solveSingleWareDistancePull({ epsilon: 1e-9, ...input })
}

describe('solveSingleWareDistancePull', () => {
  it('allocates direct flow for single supplier/demander', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'C', net: -40 }
      ],
      links: [{ linkId: 'L1', a: 'A', b: 'C', distance: 10 }]
    })

    expect(out.linkFlows).toEqual([{ linkId: 'L1', from: 'A', to: 'C', amount: 40 }])
    expect(out.unmetDemand).toEqual([])
    expect(out.unusedSupply).toEqual([{ sectorId: 'A', amount: 60 }])
    expect(out.allocatedDemandBySector).toEqual([{ sectorId: 'C', amount: 40 }])
  })

  it('prioritizes shorter distance before farther supplier', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'B', net: 10 },
        { sectorId: 'C', net: -40 }
      ],
      links: [
        { linkId: 'L1', a: 'B', b: 'C', distance: 1 },
        { linkId: 'L2', a: 'A', b: 'C', distance: 5 }
      ]
    })

    const flowBC = out.linkFlows.find((f) => f.linkId === 'L1')
    const flowAC = out.linkFlows.find((f) => f.linkId === 'L2')
    expect(flowBC?.amount).toBe(10)
    expect(flowAC?.amount).toBe(30)
  })

  it('splits by deficit ratio in the same distance layer', () => {
    const out = run({
      sectors: [
        { sectorId: 'S', net: 30 },
        { sectorId: 'D1', net: -40 },
        { sectorId: 'D2', net: -20 }
      ],
      links: [
        { linkId: 'L1', a: 'S', b: 'D1', distance: 1 },
        { linkId: 'L2', a: 'S', b: 'D2', distance: 1 }
      ]
    })

    const sToD1 = out.linkFlows.find((f) => f.from === 'S' && f.to === 'D1')?.amount || 0
    const sToD2 = out.linkFlows.find((f) => f.from === 'S' && f.to === 'D2')?.amount || 0
    expect(sToD1).toBeCloseTo(20, 8)
    expect(sToD2).toBeCloseTo(10, 8)
  })

  it('handles cycle graph and still uses minimum-distance path', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', net: 50 },
        { sectorId: 'B', net: 0 },
        { sectorId: 'C', net: -30 }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'BC', a: 'B', b: 'C', distance: 1 },
        { linkId: 'CA', a: 'C', b: 'A', distance: 10 }
      ]
    })

    expect(out.linkFlows).toEqual([
      { linkId: 'AB', from: 'A', to: 'B', amount: 30 },
      { linkId: 'BC', from: 'B', to: 'C', amount: 30 }
    ])
  })

  it('keeps unmet demand when disconnected', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'C', net: -40 }
      ],
      links: [{ linkId: 'B-D', a: 'B', b: 'D', distance: 1 }]
    })

    expect(out.linkFlows).toEqual([])
    expect(out.unmetDemand).toEqual([{ sectorId: 'C', amount: 40 }])
    expect(out.unusedSupply).toEqual([{ sectorId: 'A', amount: 100 }])
  })

  it('is deterministic on equal shortest paths (lexicographic tie-break)', () => {
    const input: SolveSingleWareDistancePullInput = {
      sectors: [
        { sectorId: 'S', net: 10 },
        { sectorId: 'D', net: -10 }
      ],
      links: [
        { linkId: 'SX', a: 'S', b: 'X', distance: 1 },
        { linkId: 'XD', a: 'X', b: 'D', distance: 1 },
        { linkId: 'SY', a: 'S', b: 'Y', distance: 1 },
        { linkId: 'YD', a: 'Y', b: 'D', distance: 1 }
      ]
    }
    const first = run(input)
    const second = run(input)

    expect(second).toEqual(first)
    expect(first.linkFlows).toEqual([
      { linkId: 'SX', from: 'S', to: 'X', amount: 10 },
      { linkId: 'XD', from: 'X', to: 'D', amount: 10 }
    ])
  })

  it('splits disconnected network and returns total deficit summary', () => {
    const out = run({
      sectors: [
        { sectorId: 'A', net: 20 },
        { sectorId: 'E', net: 10 },
        { sectorId: 'B', net: -50 },
        { sectorId: 'C', net: -10 }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'EB', a: 'E', b: 'B', distance: 1 }
      ]
    })

    expect(out.deficitSummary).toEqual({ totalDeficit: 30 })
    expect(out.allocatedDemandBySector).toEqual([{ sectorId: 'B', amount: 30 }])

    const components = splitSectorNetwork(
      ['A', 'B', 'C', 'E'],
      [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
        { linkId: 'EB', a: 'E', b: 'B', distance: 1 }
      ]
    )
    expect(components).toEqual([
      { componentId: 0, sectorIds: ['A', 'B', 'E'], linkIds: ['AB', 'EB'] },
      { componentId: 1, sectorIds: ['C'], linkIds: [] }
    ])
  })

  it('gets component by sector id', () => {
    const sectorIds = ['A', 'B', 'C', 'E']
    const links = [
      { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
      { linkId: 'EB', a: 'E', b: 'B', distance: 1 }
    ]

    expect(getSectorNetworkComponent('B', sectorIds, links)).toEqual({
      componentId: 0,
      sectorIds: ['A', 'B', 'E'],
      linkIds: ['AB', 'EB']
    })
    expect(getSectorNetworkComponent('C', sectorIds, links)).toEqual({
      componentId: 1,
      sectorIds: ['C'],
      linkIds: []
    })
    expect(getSectorNetworkComponent('Z', sectorIds, links)).toBeNull()
  })
})
