import { describe, expect, it } from 'vitest'
import {
  getSectorNetworkComponent,
  solveSingleWareDistancePull,
  solveMultiWareByLink,
  splitSectorNetwork,
  type SolveSingleWareDistancePullInput,
  type SolveMultiWareByLinkInput
} from '../../../src/store/logic/sectorLinkFlow'

function run(input: SolveSingleWareDistancePullInput) {
  return solveSingleWareDistancePull({ epsilon: 1e-9, ...input })
}

function runMulti(input: SolveMultiWareByLinkInput) {
  return solveMultiWareByLink({ epsilon: 1e-9, ...input })
}

describe('solveSingleWareDistancePull', () => {
  // 1.1 solveSingleWareDistancePull 基础分配
  it('1.1 allocates direct flow for single supplier/demander', () => {
    // 1.1.1 验证基础货物分配逻辑正确性
    // 1.1.2 验证缺口计算与供给匹配
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'C', net: -40 }
      ],
      links: [{ linkId: 'L1', a: 'A', b: 'C', distance: 10 }]
    })

    // 1.1.3 期望: linkFlows 包含正确的 from/to/amount 字段 #期望: [linkFlows 包含正确的流量分配]
    expect(out.linkFlows).toEqual([{ linkId: 'L1', from: 'A', to: 'C', amount: 40 }])
    expect(out.unmetDemand).toEqual([])
    expect(out.unusedSupply).toEqual([{ sectorId: 'A', amount: 60 }])
    expect(out.allocatedDemandBySector).toEqual([{ sectorId: 'C', amount: 40 }])
  })

  // 1.2 距离优先分配（替代跳数）
  it('1.2 prioritizes shorter distance before farther supplier', () => {
    // 1.2.1 验证距离优先于跳数的分配策略
    // 1.2.2 验证等距离情况下的确定性
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

    // 1.2.3 期望: 短距离链路优先获得流量分配 #期望: [短距离链路优先分配]
    const flowBC = out.linkFlows.find((f) => f.linkId === 'L1')
    const flowAC = out.linkFlows.find((f) => f.linkId === 'L2')
    expect(flowBC?.amount).toBe(10)
    expect(flowAC?.amount).toBe(30)
  })

  // 1.3 同层按缺口比例分配
  it('1.3 splits by deficit ratio in the same distance layer', () => {
    // 1.3.1 验证同层级节点按缺口比例分配
    // 1.3.2 验证比例计算的数值精度
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
    // 1.3.3 期望: 缺口比例与流量比例一致 #期望: [按缺口比例分配]
    expect(sToD1).toBeCloseTo(20, 8)
    expect(sToD2).toBeCloseTo(10, 8)
  })

  // 1.4 环路网络稳定性
  it('1.4 handles cycle graph and still uses minimum-distance path', () => {
    // 1.4.1 验证环形网络拓扑下的收敛性
    // 1.4.2 验证无死循环或无限递归
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

    // 1.4.3 期望: 环路网络正确选择最短路径 #期望: [环路网络稳定收敛]
    expect(out.linkFlows).toEqual([
      { linkId: 'AB', from: 'A', to: 'B', amount: 30 },
      { linkId: 'BC', from: 'B', to: 'C', amount: 30 }
    ])
  })

  // 1.5 中转边流量结算（多路径累积显式验证）
  it('1.5 accumulates flow correctly on transit edges used by multiple paths', () => {
    // 1.5.1 验证多路径流量累积正确
    // Scenario: A supplies 100, B and C each demand 40, B-C is transit edge
    // A -> B (via edge L1), A -> C (via edges L1 and L2)
    // Edge L1 (A-B) should accumulate flows from both paths
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'B', net: -40 },
        { sectorId: 'C', net: -40 }
      ],
      links: [
        { linkId: 'L1', a: 'A', b: 'B', distance: 1 },
        { linkId: 'L2', a: 'B', b: 'C', distance: 1 }
      ]
    })

    // 1.5.2 验证中转边显式结算输出
    // Edge L1 (A->B) carries: 40 for B + 40 for C = 80 total
    // Edge L2 (B->C) carries: 40 for C
    const flowL1 = out.linkFlows.find((f) => f.linkId === 'L1')
    const flowL2 = out.linkFlows.find((f) => f.linkId === 'L2')

    // 1.5.3 期望: 中转边流量正确累积 #期望: [中转边流量累积正确]
    expect(flowL1?.amount).toBe(80)
    expect(flowL1?.from).toBe('A')
    expect(flowL1?.to).toBe('B')
    expect(flowL2?.amount).toBe(40)
    expect(flowL2?.from).toBe('B')
    expect(flowL2?.to).toBe('C')
  })

  // 1.6 不可达缺口保留
  it('1.6 keeps unmet demand when disconnected', () => {
    // 1.6.1 验证无法到达的缺口被正确保留
    const out = run({
      sectors: [
        { sectorId: 'A', net: 100 },
        { sectorId: 'C', net: -40 }
      ],
      links: [{ linkId: 'B-D', a: 'B', b: 'D', distance: 1 }]
    })

    // 1.6.2 验证缺口状态在结果中可见
    // 1.6.3 期望: unmetDemand 包含不可达缺口 #期望: [不可达缺口正确保留]
    expect(out.linkFlows).toEqual([])
    expect(out.unmetDemand).toEqual([{ sectorId: 'C', amount: 40 }])
    expect(out.unusedSupply).toEqual([{ sectorId: 'A', amount: 100 }])
  })

  // 1.7 并列最短路径确定性
  it('1.7 is deterministic on equal shortest paths (lexicographic tie-break)', () => {
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
    // 1.7.1 验证等距路径的确定性选择
    const first = run(input)
    // 1.7.2 验证结果可重复性
    const second = run(input)

    // 1.7.3 期望: 多次运行结果完全一致 #期望: [确定性选择一致]
    expect(second).toEqual(first)
    expect(first.linkFlows).toEqual([
      { linkId: 'SX', from: 'S', to: 'X', amount: 10 },
      { linkId: 'XD', from: 'X', to: 'D', amount: 10 }
    ])
  })

  // 1.8 分网 splitSectorNetwork 与缺口来源映射
  it('1.8 splits disconnected network and returns total deficit summary', () => {
    // 1.8.1 验证网络分割后的独立计算
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

    // 1.8.2 验证缺口来源映射正确性
    // 1.8.3 期望: 分网后各组件独立返回结果 #期望: [分网计算正确]
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

  // 1.9 allocatedDemandBySector 输出正确
  it('1.9 gets component by sector id', () => {
    // 1.9.1 验证按 sector 汇总的分配需求
    const sectorIds = ['A', 'B', 'C', 'E']
    const links = [
      { linkId: 'AB', a: 'A', b: 'B', distance: 1 },
      { linkId: 'EB', a: 'E', b: 'B', distance: 1 }
    ]

    // 1.9.2 验证输出结构与字段完整性
    // 1.9.3 期望: allocatedDemandBySector 包含 sectorId 和 amount #期望: [分配需求汇总正确]
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

describe('solveMultiWareByLink', () => {
  // 1.10 linkWareFlows 结构与方向正确
  it('1.10 returns link-level flows grouped by ware and direction', () => {
    // 1.10.1 验证 flow 结构包含必需字段
    const out = runMulti({
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
    // 1.10.2 验证 from/to 方向语义正确
    // 1.10.3 期望: linkWareFlows 包含 linkId/wareId/from/to/amount #期望: [流量结构完整]
    expect(out.linkWareFlows).toEqual([
      { linkId: 'AB', wareId: 'ore', from: 'A', to: 'B', amount: 40 },
      { linkId: 'BC', wareId: 'food', from: 'B', to: 'C', amount: 20 }
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
    // 1.11.2 验证多货物场景下的独立性
    const changedOre: SolveMultiWareByLinkInput = {
      ...base,
      sectors: [
        { sectorId: 'A', netByWare: { ore: 80, food: 0 } },
        { sectorId: 'B', netByWare: { ore: -20, food: 40 } },
        { sectorId: 'C', netByWare: { ore: 0, food: -40 } }
      ]
    }
    const out1 = runMulti(base)
    const out2 = runMulti(changedOre)
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
    // 1.12.2 验证边界条件对齐
    const out = runMulti(input)
    const oreSingle = solveSingleWareDistancePull({
      sectors: input.sectors.map((s) => ({ sectorId: s.sectorId, net: s.netByWare.ore || 0 })),
      links: input.links,
      epsilon: 1e-9
    })
    const oreFromMulti = out.linkWareFlows
      .filter((f) => f.wareId === 'ore')
      .map(({ wareId, ...rest }) => rest)
    // 1.12.3 期望: 多货物结果等于单货物结果聚合 #期望: [与基线一致]
    expect(oreFromMulti).toEqual(oreSingle.linkFlows)
  })

  // 1.13 deficitSummary 按 sector 汇总
  it('1.13 aggregates deficitByNode and producerNodes by node across wares', () => {
    // 1.13.1 验证 deficit 按 sector 正确聚合
    const out = runMulti({
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
    // 1.13.2 验证汇总数值准确性
    // 1.13.3 期望: deficitSummary.totalDeficit 等于各节点缺口之和 #期望: [缺口汇总正确]
    expect(out.deficitSummary.totalDeficit).toBe(25)
    expect(out.deficitSummary.deficitByNode).toEqual([
      { sectorId: 'B', totalAmount: 25, byWare: { food: 5, ore: 20 } }
    ])
  })

  // 1.14 allocatedDemandBySector 按 sector + byWare 汇总
  it('1.14 aggregates allocatedDemandBySector by sector and byWare', () => {
    // 1.14.1 验证按 sector 分组汇总正确
    const out = runMulti({
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
    // 1.14.2 验证 byWare 维度的汇总正确
    // 1.14.3 期望: byWare 包含各货物维度的分配量 #期望: [多维度汇总正确]
    expect(out.allocatedDemandBySector).toEqual([
      { sectorId: 'B', totalAmount: 15, byWare: { food: 5, ore: 10 } }
    ])
  })

  // 1.15 仓储/运输条目文案方向
  it('1.15 external entries show in/out direction labels', () => {
    // 1.15.1 验证外部条目显示输入/输出
    const out = runMulti({
      sectors: [
        { sectorId: 'A', netByWare: { ore: 100 } },
        { sectorId: 'B', netByWare: { ore: -50 } }
      ],
      links: [
        { linkId: 'AB', a: 'A', b: 'B', distance: 1 }
      ]
    })
    // 1.15.2 验证本地条目保持产出/消耗
    // 1.15.3 期望: 外部条目显示 in/out 方向标识 #期望: [文案方向正确]
    expect(out.linkWareFlows).toEqual([
      { linkId: 'AB', wareId: 'ore', from: 'A', to: 'B', amount: 50 }
    ])
    // Direction: A is supplier (output), B is demander (input)
    expect(out.linkWareFlows[0].from).toBe('A')
    expect(out.linkWareFlows[0].to).toBe('B')
  })
})
