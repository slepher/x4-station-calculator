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
  // 1.10 linkWareFlows 结构与方向正确
  it('1.10 returns link-level flows grouped by ware and direction', () => {
    // 1.10.1 验证 flow 结构包含必需字段
    // 1.10.2 验证 from/to 方向语义正确
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

    // 1.10.3 期望: linkWareFlows 包含 linkId/wareId/from/to/amount #期望: [流量结构完整]
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

  // 1.11 货物间隔离性
  it('1.11 keeps wares isolated from each other', () => {
    // 1.11.1 验证不同货物的 flow 互不干扰
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

    // 1.11.2 验证多货物场景下的独立性
    const out1 = run(base)
    const out2 = run(changedOre)
    const food1 = out1.linkWareFlows.filter((f) => f.wareId === 'food')
    const food2 = out2.linkWareFlows.filter((f) => f.wareId === 'food')
    // 1.11.3 期望: 修改一种货物不影响其他货物流量 #期望: [货物间隔离正确]
    expect(food2).toEqual(food1)
  })

  // 1.12 与单货物基线一致
  it('1.12 matches per-ware single-solver baseline', () => {
    // 1.12.1 验证多货物聚合与单货物串行结果一致
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

    // 1.12.2 验证边界条件对齐
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

    // 1.12.3 期望: 多货物结果等于单货物结果聚合 #期望: [与基线一致]
    expect(oreFromMulti).toEqual(oreSingle.linkFlows)
    expect(foodFromMulti).toEqual(foodSingle.linkFlows)
  })

  // 1.13 deficitSummary 按 sector 汇总
  // 1.14 allocatedDemandBySector 按 sector + byWare 汇总
  it('1.13 aggregates deficitByNode and producerNodes by node across wares', () => {
    // 1.13.1 验证 deficit 按 sector 正确聚合
    // 1.13.2 验证汇总数值准确性
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

    // 1.13.3 期望: deficitSummary.totalDeficit 等于各节点缺口之和 #期望: [缺口汇总正确]
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

    // 1.14.1 验证按 sector 分组汇总正确
    // 1.14.2 验证 byWare 维度的汇总正确
    // 1.14.3 期望: byWare 包含各货物维度的分配量 #期望: [多维度汇总正确]
    expect(out.allocatedDemandBySector).toEqual([
      {
        sectorId: 'B',
        totalAmount: 15,
        byWare: { food: 5, ore: 10 }
      }
    ])
  })
})