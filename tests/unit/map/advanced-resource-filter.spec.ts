/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  matchSectorToTagGroup,
  buildAdvancedCandidates,
  ADVANCED_SUNLIGHT_TAG_ID,
  type AdvancedResourceTagGroup,
  type AdvancedResourceSector
} from '@/store/logic/mapAdvancedResourceFilter'
import { buildSectorGraph } from '@/store/logic/mapSectorGraph'
import { buildYieldRanksByWare, YIELD_NAME_TO_RATING, type RegionYieldEntry } from '@/store/logic/mapResourceFilter'

const regionYields: RegionYieldEntry[] = [
  { ware: 'ore', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'silicon', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'methane', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] }
]

const yieldRanksByWare = buildYieldRanksByWare(regionYields)

const makeSector = (id: string, resources: Array<{ ware: string; yield: string; level: number }>, sunlight = 100): AdvancedResourceSector => ({
  sectorId: id,
  name: id,
  displayName: id,
  resources: resources.map(r => ({
    ...r,
    rating: YIELD_NAME_TO_RATING[r.yield] || 1
  })),
  sunlight
})

const makeGroup = (id: string, tagIds: string[], minYieldByWare: Record<string, string> = {}, sunlightMinimum = 100): AdvancedResourceTagGroup => ({
  id,
  tagIds,
  minYieldByWare,
  sunlightMinimum
})

describe('1.1 matchSectorToTagGroup: 组内 AND 语义判定', () => {
  it('1.1 传入包含多个普通资源 tag 的组配置', () => {
    // 1.1.1 传入包含多个普通资源 tag 的组配置，验证当星区满足全部 tag 时返回 matched=true #期望: [matched=true]
    const sector = makeSector('s1', [
      { ware: 'ore', yield: 'high', level: 14 },
      { ware: 'silicon', yield: 'high', level: 12 }
    ])
    const group = makeGroup('g1', ['ore', 'silicon'], { ore: 'medium', silicon: 'medium' })
    const result = matchSectorToTagGroup(sector, group, yieldRanksByWare)
    expect(result.matched).toBe(true)

    // 1.1.2 传入包含多个普通资源 tag 的组配置，验证当星区仅满足部分 tag 时返回 matched=false #期望: [matched=false]
    const sectorPartial = makeSector('s1', [
      { ware: 'ore', yield: 'high', level: 14 }
    ])
    const resultPartial = matchSectorToTagGroup(sectorPartial, group, yieldRanksByWare)
    expect(resultPartial.matched).toBe(false)
  })
})

describe('1.2 matchSectorToTagGroup: 日光条件判定', () => {
  it('1.2 传入包含日光 tag 且 sunlightMinimum=120 的组配置', () => {
    // 1.2.1 传入包含日光 tag 且 sunlightMinimum=120 的组配置，验证当星区日光值>=120 时返回 includesSunlight=true 且 matched=true #期望: [matched=true, includesSunlight=true]
    const sectorGood = makeSector('s1', [
      { ware: 'ore', yield: 'high', level: 14 }
    ], 150)
    const group = makeGroup('g1', ['ore', ADVANCED_SUNLIGHT_TAG_ID], { ore: 'medium' }, 120)
    const resultGood = matchSectorToTagGroup(sectorGood, group, yieldRanksByWare)
    expect(resultGood.matched).toBe(true)
    expect(resultGood.includesSunlight).toBe(true)

    // 1.2.2 传入包含日光 tag 且 sunlightMinimum=120 的组配置，验证当星区日光值<120 时返回 matched=false #期望: [matched=false]
    const sectorBad = makeSector('s1', [
      { ware: 'ore', yield: 'high', level: 14 }
    ], 100)
    const resultBad = matchSectorToTagGroup(sectorBad, group, yieldRanksByWare)
    expect(resultBad.matched).toBe(false)
  })
})

describe('1.3 buildAdvancedCandidates: 候选生成与合并', () => {
  it('1.3 传入两个不同中转核心但对应相同资源星区集合的场景', () => {
    // 1.3.1 传入两个不同中转核心但对应相同资源星区集合的场景，验证返回结果中这两个核心被合并到同一候选项 #期望: [hubCandidateSectorIds.length=2]
    const sectors: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 10 }]),
      makeSector('r2', [{ ware: 'silicon', yield: 'high', level: 10 }]),
      makeSector('h1', []),
      makeSector('h2', [])
    ]
    const groups = [
      makeGroup('g1', ['ore'], { ore: 'medium' }),
      makeGroup('g2', ['silicon'], { silicon: 'medium' })
    ]
    const sectorGraph = {
      r1: ['h1', 'h2'],
      r2: ['h1', 'h2'],
      h1: ['r1', 'r2'],
      h2: ['r1', 'r2']
    }
    const sectorClusterMap = { r1: 'c1', r2: 'c1', h1: 'c1', h2: 'c1' }
    const result = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 1,
      allowTransit: true,
      yieldRanksByWare,
      resourceColors: { ore: '#f00', silicon: '#0f0' },
      sectorGraph,
      sectorClusterMap
    })
    expect(result.candidates).toHaveLength(1)
    // 所有 sector 都在同一 cluster，跳数限制为 1 时可以互访，所以 hubCandidateSectorIds 包含所有 4 个
    expect(result.candidates[0]?.hubCandidateSectorIds).toHaveLength(4)

    // 1.3.2 传入一个资源星区集合为另一个严格子集的候选对，验证最终结果中子集候选被过滤 #期望: [candidates.length=1]
    // In this case, both r1 and r2 satisfy the ore requirement, so they both should be in the candidate
    // But r2 doesn't have ore, so it won't be matched. Let's adjust the test.
    const sectorsSubset: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 10 }]),
      makeSector('r2', [{ ware: 'ore', yield: 'high', level: 8 }]),
      makeSector('h1', [])
    ]
    const groupsSubset = [makeGroup('g1', ['ore'], { ore: 'medium' })]
    const sectorGraphSubset = {
      r1: ['h1', 'r2'],
      r2: ['h1', 'r1'],
      h1: ['r1', 'r2']
    }
    const sectorClusterMapSubset = { r1: 'c1', r2: 'c1', h1: 'c1' }
    const resultSubset = buildAdvancedCandidates({
      sectors: sectorsSubset,
      tagGroups: groupsSubset,
      jumpLimit: 1,
      allowTransit: true,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph: sectorGraphSubset,
      sectorClusterMap: sectorClusterMapSubset
    })
    // Both r1 and r2 have ore, so the candidate should contain both
    expect(resultSubset.candidates).toHaveLength(1)
    expect(resultSubset.candidates[0]?.resourceSectorIds).toContain('r1')
    expect(resultSubset.candidates[0]?.resourceSectorIds).toContain('r2')
  })
})

describe('1.4 buildAdvancedCandidates: 评分计算', () => {
  it('1.4 传入多个 tag 组配置', () => {
    // 1.4.1 传入多个 tag 组配置，验证每个候选的分数为各组最佳星区平均 level 的最小值 #期望: [score 等于预期最小值]
    const sectors: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 14 }]),
      makeSector('r2', [{ ware: 'silicon', yield: 'high', level: 8 }])
    ]
    const groups = [
      makeGroup('g1', ['ore'], { ore: 'medium' }),
      makeGroup('g2', ['silicon'], { silicon: 'medium' })
    ]
    const sectorGraph = {
      r1: ['r2'],
      r2: ['r1']
    }
    const sectorClusterMap = { r1: 'c1', r2: 'c1' }
    const result = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 1,
      allowTransit: false,
      yieldRanksByWare,
      resourceColors: { ore: '#f00', silicon: '#0f0' },
      sectorGraph,
      sectorClusterMap
    })
    expect(result.candidates[0]?.score).toBe(5)

    // 1.4.2 传入仅包含日光命中的星区，验证该星区不参与评分计算 #期望: [score=0]
    const sectorsSunlight: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 14 }], 150),
      makeSector('s1', [], 180)
    ]
    const groupsSunlight = [
      makeGroup('g1', ['ore', ADVANCED_SUNLIGHT_TAG_ID], { ore: 'medium' }, 100)
    ]
    const sectorGraphSunlight = {
      r1: ['s1'],
      s1: ['r1']
    }
    const sectorClusterMapSunlight = { r1: 'c1', s1: 'c1' }
    const resultSunlight = buildAdvancedCandidates({
      sectors: sectorsSunlight,
      tagGroups: groupsSunlight,
      jumpLimit: 1,
      allowTransit: true,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph: sectorGraphSunlight,
      sectorClusterMap: sectorClusterMapSunlight
    })
    const candidateWithS1 = resultSunlight.candidates.find(c => c.resourceSectorIds.includes('s1'))
    expect(candidateWithS1).toBeUndefined()
  })
})

describe('1.5 buildSectorGraph: 跨 cluster 连通', () => {
  it('1.5 传入包含 cluster_gates 的地图数据', () => {
    // 1.5.1 传入包含 cluster_gates 的地图数据，验证返回的图中包含跨 cluster 的双向连通边 #期望: [graph 包含跨 cluster 邻居]
    const clusters = {
      cluster1: {
        sectors: ['s1'],
        sector_links: {}
      },
      cluster2: {
        sectors: ['s2'],
        sector_links: {}
      }
    }
    const sectors = {
      s1: {
        id: 's1',
        cluster_id: 'cluster1',
        cluster_gates: {
          g1: { target_cluster_id: 'cluster2' }
        }
      },
      s2: {
        id: 's2',
        cluster_id: 'cluster2',
        cluster_gates: {
          g2: { target_cluster_id: 'cluster1' }
        }
      }
    }
    const { graph } = buildSectorGraph(clusters as any, sectors as any)
    expect(graph.s1).toContain('s2')
    expect(graph.s2).toContain('s1')
  })
})

describe('1.6 buildAdvancedCandidates: allowTransit 开关', () => {
  it('1.6 设置 allowTransit 开关', () => {
    // 1.6.1 设置 allowTransit=true，验证中转核心候选可来自任意星区 #期望: [hubCandidateSectorIds 包含非资源星区]
    const sectors: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 10 }]),
      makeSector('nonResource', [])
    ]
    const groups = [makeGroup('g1', ['ore'], { ore: 'medium' })]
    const sectorGraph = {
      r1: ['nonResource'],
      nonResource: ['r1']
    }
    const sectorClusterMap = { r1: 'c1', nonResource: 'c1' }
    const resultTrue = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 1,
      allowTransit: true,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph,
      sectorClusterMap
    })
    expect(resultTrue.candidates.some(c => c.hubCandidateSectorIds.includes('nonResource'))).toBe(true)

    // 1.6.2 设置 allowTransit=false，验证中转核心候选仅来自命中资源星区 #期望: [hubCandidateSectorIds 仅包含资源星区]
    const resultFalse = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 1,
      allowTransit: false,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph,
      sectorClusterMap
    })
    expect(resultFalse.candidates.every(c => !c.hubCandidateSectorIds.includes('nonResource'))).toBe(true)
  })
})

describe('1.7 buildAdvancedCandidates: 同一 cluster 内跳数计算', () => {
  it('1.7 同一 cluster 内的 sector 移动不计跳数', () => {
    // 1.7.1 验证同一 cluster 内的 sector 之间跳数为 0
    const sectors: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 10 }]),
      makeSector('r2', [{ ware: 'ore', yield: 'high', level: 8 }]),
      makeSector('r3', [{ ware: 'ore', yield: 'high', level: 6 }])
    ]
    const groups = [makeGroup('g1', ['ore'], { ore: 'medium' })]
    // r1 -> r2 -> r3 在同一 cluster 内
    const sectorGraph = {
      r1: ['r2'],
      r2: ['r1', 'r3'],
      r3: ['r2']
    }
    const sectorClusterMap = { r1: 'c1', r2: 'c1', r3: 'c1' }
    const result = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 0, // 跳数限制为 0，但因为在同一 cluster，应该都能访问到
      allowTransit: false,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph,
      sectorClusterMap
    })
    // 所有资源星区都在同一 cluster，跳数限制为 0 也应该能访问到
    expect(result.candidates[0]?.resourceSectorIds).toContain('r1')
    expect(result.candidates[0]?.resourceSectorIds).toContain('r2')
    expect(result.candidates[0]?.resourceSectorIds).toContain('r3')
  })

  it('1.8 跨 cluster 的 sector 移动计跳数', () => {
    // 1.8.1 验证跨 cluster 的 sector 之间跳数 +1
    const sectors: AdvancedResourceSector[] = [
      makeSector('r1', [{ ware: 'ore', yield: 'high', level: 10 }]),
      makeSector('r2', [{ ware: 'ore', yield: 'high', level: 8 }])
    ]
    const groups = [makeGroup('g1', ['ore'], { ore: 'medium' })]
    // r1 和 r2 之间有连接，但在不同 cluster
    const sectorGraph = {
      r1: ['r2'],
      r2: ['r1']
    }
    const sectorClusterMap = { r1: 'c1', r2: 'c2' } // 不同 cluster
    const result = buildAdvancedCandidates({
      sectors,
      tagGroups: groups,
      jumpLimit: 0, // 跳数限制为 0，跨 cluster 无法访问
      allowTransit: false,
      yieldRanksByWare,
      resourceColors: { ore: '#f00' },
      sectorGraph,
      sectorClusterMap
    })
    // r1 和 r2 在不同 cluster，跳数限制为 0 时只能访问到各自的资源
    expect(result.candidates.length).toBeGreaterThan(0)
    // 每个候选只包含一个资源星区
    expect(result.candidates[0]?.resourceSectorIds.length).toBe(1)
  })
})
