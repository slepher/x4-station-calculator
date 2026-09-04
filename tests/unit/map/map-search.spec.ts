import { describe, it, expect } from 'vitest'
import {
  parseClusterQuery,
  extractClusterNumber,
  searchSectors,
  calculateHighlightedSectorIds,
  hasIdMatchedResult,
  getResultPrimaryLabel,
  getResultMeta,
  type SearchSectorLayout
} from '@/utils/mapSearch'

describe('map-search unit', () => {
  const createMockSector = (overrides: Partial<SearchSectorLayout>): SearchSectorLayout => ({
    sectorId: 'sector-1',
    clusterId: 'Cluster_01_macro',
    name: 'Grand Exchange I',
    displayName: '大交易所 I',
    centerX: 100,
    centerY: 200,
    ...overrides
  })

  it('1.1 搜索索引构造：验证 sector 搜索索引字段完整性', () => {
    // 1.1.1 从 `maps.json` 加载 `clusters` 数据，提取首个 cluster 的首个 sector 构造 `SearchSectorLayout` 对象
    const sector = createMockSector({})

    // 1.1.2 断言对象包含 `sectorId`、`clusterId`、`name`、`displayName`、`centerX`、`centerY` 六个必需字段 #期望: [6]
    const keys = Object.keys(sector)
    expect(keys.length).toBe(6)
    expect(keys).toContain('sectorId')
    expect(keys).toContain('clusterId')
    expect(keys).toContain('name')
    expect(keys).toContain('displayName')
    expect(keys).toContain('centerX')
    expect(keys).toContain('centerY')
  })

  it('1.2 匹配规则：验证 name 包含匹配逻辑', () => {
    // 1.2.1 构造测试数据：`[{name:'Grand Exchange I', displayName:'大交易所 I', ...}]`，调用匹配函数输入 `"grand"`
    const sectors = [createMockSector({ name: 'Grand Exchange I', displayName: '大交易所 I' })]
    const results = searchSectors(sectors, 'grand', 'en')

    // 1.2.2 断言返回结果包含 `Grand Exchange I` 且 `matchType` 为 `name` #期望: ['Grand Exchange I', 'name']
    expect(results.length).toBe(1)
    expect(results[0]!.name).toBe('Grand Exchange I')
    expect(results[0]!.matchType).toBe('name')
  })

  it('1.3 匹配规则：验证非 en locale 下 localeName 包含匹配逻辑', () => {
    // 1.3.1 设置 `locale = 'zh-CN'`，构造测试数据包含 `displayName:'大交易所 I'`，输入 `"大交易"`
    const sectors = [createMockSector({ name: 'Grand Exchange I', displayName: '大交易所 I' })]
    const results = searchSectors(sectors, '大交易', 'zh-CN')

    // 1.3.2 断言返回结果 `matchType` 为 `localeName` #期望: ['localeName']
    expect(results.length).toBe(1)
    expect(results[0]!.matchType).toBe('localeName')
  })

  it('1.4 匹配规则：验证 en locale 下不额外搜索 localeName', () => {
    // 1.4.1 设置 `locale = 'en'`，构造测试数据 `name:'Grand Exchange I'`，输入 `"grand"` 后验证匹配路径
    const sectors = [createMockSector({ name: 'Grand Exchange I', displayName: '大交易所 I' })]
    const resultsEn = searchSectors(sectors, '大交易', 'en')

    // 1.4.2 断言仅 `name` 字段被匹配，不触发 `localeName` 分支 #期望: ['name']
    expect(resultsEn.length).toBe(0)

    // Also verify that name matching works
    const resultsName = searchSectors(sectors, 'grand', 'en')
    expect(resultsName.length).toBe(1)
    expect(resultsName[0]!.matchType).toBe('name')
  })

  it('1.5 匹配规则：验证 cluster id 完整数字匹配', () => {
    // 1.5.1 输入 `"cluster 01"`，匹配函数应返回 `clusterId` 数字部分为 `1` 的 sector
    const sectors = [
      createMockSector({ sectorId: 'sector-1', clusterId: 'Cluster_01_macro' }),
      createMockSector({ sectorId: 'sector-2', clusterId: 'Cluster_02_macro' })
    ]
    const results = searchSectors(sectors, 'cluster 01', 'en')

    // 1.5.2 断言 `matchType` 为 `id` 且结果展开为对应 cluster 下的 sector 列表 #期望: ['id']
    expect(results.length).toBe(1)
    expect(results[0]!.matchType).toBe('id')
    expect(results[0]!.clusterId).toBe('Cluster_01_macro')
  })

  it('1.6 匹配规则：验证 cluster id 不允许前缀误命中', () => {
    // 1.6.1 构造测试数据同时包含 `Cluster_01_macro` 和 `Cluster_011_macro` 两个 cluster 下的 sector
    const sectors = [
      createMockSector({ sectorId: 'sector-01', clusterId: 'Cluster_01_macro' }),
      createMockSector({ sectorId: 'sector-011', clusterId: 'Cluster_011_macro' })
    ]
    const results = searchSectors(sectors, 'cluster 01', 'en')

    // 1.6.2 输入 `"cluster 01"`，断言仅返回 `Cluster_01_macro` 下的 sector，不包含 `Cluster_011_macro` 的 sector #期望: ['Cluster_01_macro']
    expect(results.length).toBe(1)
    expect(results[0]!.clusterId).toBe('Cluster_01_macro')
    expect(results.find(r => r.clusterId === 'Cluster_011_macro')).toBeUndefined()
  })

  it('1.7 高亮阈值：验证结果数小于 10 时触发批量高亮', () => {
    // 1.7.1 构造 5 个匹配结果的搜索输出，计算 `highlightedSectorIds`
    const sectors = Array.from({ length: 5 }, (_, i) =>
      createMockSector({ sectorId: `sector-${i}`, name: `Test Sector ${i}` })
    )
    const results = searchSectors(sectors, 'test', 'en')
    const highlighted = calculateHighlightedSectorIds('test', results)

    // 1.7.2 断言 `highlightedSectorIds` 长度等于结果数 #期望: [5]
    expect(highlighted.length).toBe(5)
  })

  it('1.8 高亮阈值：验证结果数大于等于 10 时不触发批量高亮', () => {
    // 1.8.1 构造 15 个匹配结果的搜索输出，计算 `highlightedSectorIds`
    const sectors = Array.from({ length: 15 }, (_, i) =>
      createMockSector({ sectorId: `sector-${i}`, name: `Test Sector ${i}` })
    )
    const results = searchSectors(sectors, 'test', 'en')
    const highlighted = calculateHighlightedSectorIds('test', results)

    // 1.8.2 断言 `highlightedSectorIds` 为空数组 #期望: [[]]
    expect(highlighted.length).toBe(0)
    expect(highlighted).toEqual([])
  })
})

describe('map-search helper functions', () => {
  it('parseClusterQuery parses valid cluster queries', () => {
    expect(parseClusterQuery('cluster 01')).toBe('1')
    expect(parseClusterQuery('cluster 1')).toBe('1')
    expect(parseClusterQuery('cluster_01')).toBe('1')
    expect(parseClusterQuery('CLUSTER 01')).toBe('1')
    expect(parseClusterQuery('not a cluster')).toBeNull()
    expect(parseClusterQuery('sector 01')).toBeNull()
  })

  it('extractClusterNumber extracts cluster number from cluster id', () => {
    expect(extractClusterNumber('Cluster_01_macro')).toBe('1')
    expect(extractClusterNumber('Cluster_011_macro')).toBe('11')
    expect(extractClusterNumber('cluster_01')).toBe('1')
    expect(extractClusterNumber('not_a_cluster')).toBeNull()
  })

  it('hasIdMatchedResult detects id matches', () => {
    const sectors = [
      { sectorId: 's1', clusterId: 'c1', name: 'n1', displayName: 'd1', centerX: 0, centerY: 0, matchType: 'id' as const },
      { sectorId: 's2', clusterId: 'c2', name: 'n2', displayName: 'd2', centerX: 0, centerY: 0, matchType: 'name' as const }
    ]
    expect(hasIdMatchedResult(sectors)).toBe(true)
    expect(hasIdMatchedResult(sectors.slice(1))).toBe(false)
  })

  it('getResultPrimaryLabel returns correct label based on locale', () => {
    const sector = { sectorId: 's1', clusterId: 'c1', name: 'Grand Exchange', displayName: '大交易所', centerX: 0, centerY: 0 }
    expect(getResultPrimaryLabel(sector, 'en')).toBe('Grand Exchange')
    expect(getResultPrimaryLabel(sector, 'zh-CN')).toBe('大交易所')
  })

  it('getResultMeta returns correct meta text', () => {
    const idMatch = { sectorId: 'Cluster_01_Sector001_macro', clusterId: 'c1', name: 'n', displayName: 'd', centerX: 0, centerY: 0, matchType: 'id' as const }
    const nameMatch = { sectorId: 's1', clusterId: 'c1', name: 'Grand Exchange', displayName: '大交易所', centerX: 0, centerY: 0, matchType: 'name' as const }
    const localeMatch = { sectorId: 's2', clusterId: 'c2', name: 'n', displayName: 'd', centerX: 0, centerY: 0, matchType: 'localeName' as const }

    expect(getResultMeta(idMatch, 'en')).toBe('Cluster_01_Sector001_macro')
    expect(getResultMeta(nameMatch, 'zh-CN')).toBe('Grand Exchange')
    expect(getResultMeta(nameMatch, 'en')).toBe('')
    expect(getResultMeta(localeMatch, 'zh-CN')).toBe('')
  })
})