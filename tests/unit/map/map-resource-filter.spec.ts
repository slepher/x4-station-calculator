import { describe, expect, it } from 'vitest'
import {
  buildDefaultResourceFilters,
  buildResourceCandidates,
  buildYieldRanksByWare,
  getContextReachableMaxYieldName,
  getSelectedResourceIds,
  getSharedMinYieldName,
  isSectorMatchedByResources,
  MIXED_YIELD_VALUE,
  type RegionYieldEntry,
  type ResourceFilterMap,
  type ResourceCandidateInput
} from '@/store/logic/mapResourceFilter'

const regionYields: RegionYieldEntry[] = [
  { ware: 'ore', yields: [{ name: 'low' }, { name: 'midlow' }, { name: 'medium' }, { name: 'midhigh' }, { name: 'high' }] },
  { ware: 'silicon', yields: [{ name: 'low' }, { name: 'midlow' }, { name: 'medium' }, { name: 'midhigh' }, { name: 'high' }] },
  { ware: 'ice', yields: [{ name: 'low' }, { name: 'midlow' }, { name: 'medium' }, { name: 'midhigh' }, { name: 'high' }] }
]

const makeFilters = (patch: Partial<ResourceFilterMap> = {}) => ({
  ...buildDefaultResourceFilters(regionYields),
  ...patch
})

const sectors: ResourceCandidateInput[] = [
  {
    sectorId: 'sector-a',
    name: 'Alpha',
    displayName: 'Alpha',
    resources: [
      { ware: 'ore', yield: 'high', level: 14, rating: 5 },
      { ware: 'silicon', yield: 'high', level: 12, rating: 5 },
      { ware: 'ice', yield: 'medium', level: 8, rating: 3 }
    ]
  },
  {
    sectorId: 'sector-b',
    name: 'Beta',
    displayName: 'Beta',
    resources: [
      { ware: 'ore', yield: 'high', level: 13, rating: 5 },
      { ware: 'silicon', yield: 'medium', level: 8, rating: 3 },
      { ware: 'ice', yield: 'high', level: 14, rating: 5 }
    ]
  },
  {
    sectorId: 'sector-c',
    name: 'Gamma',
    displayName: 'Gamma',
    resources: [
      { ware: 'ore', yield: 'medium', level: 8, rating: 3 }
    ]
  }
]

describe('mapResourceFilter', () => {
  it('builds default filters from first yield per ware', () => {
    const filters = buildDefaultResourceFilters(regionYields)

    expect(filters.ore).toEqual({ selected: false, minYieldName: 'low' })
    expect(filters.silicon).toEqual({ selected: false, minYieldName: 'low' })
  })

  it('matches sectors only when all selected resources satisfy minimum yields', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'medium' }
    })

    // sector-a: ore rating=5 (>=3 medium ✓), silicon rating=5 (>=3 medium ✓) => match
    // sector-b: ore rating=5 (>=3 medium ✓), silicon rating=3 (>=3 medium ✓) => match
    // sector-c: ore rating=3 (>=3 medium ✓), silicon missing => no match
    expect(isSectorMatchedByResources(sectors[0]!, filters, ranks)).toBe(true)
    expect(isSectorMatchedByResources(sectors[1]!, filters, ranks)).toBe(true)
    expect(isSectorMatchedByResources(sectors[2]!, filters, ranks)).toBe(false)
  })

  it('sorts matched sectors by selected resource rating sum and limits to top results', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'medium' }
    })

    // sector-a: ore=5 + silicon=5 = 10
    // sector-b: ore=5 + silicon=3 = 8
    const result = buildResourceCandidates(sectors, filters, ranks, 1)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      sectorId: 'sector-a',
      score: 10
    })
  })

  it('returns mixed marker when selected resources do not share one minimum yield', () => {
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: false, minYieldName: 'low' }
    })

    expect(getSelectedResourceIds(filters)).toEqual(['ore', 'silicon'])
    expect(getSharedMinYieldName(['ore', 'silicon'], filters)).toBe(MIXED_YIELD_VALUE)
  })

  it('computes reachable max for a resource within the current filter context', () => {
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: true, minYieldName: 'low' }
    })

    // ice: Only sector-b has ice with rating=5 (high), sector-a has ice rating=3 (medium)
    // But silicon requires high (rating>=5), so only sector-a qualifies (silicon=5)
    // In sector-a context, ice max is medium (rating=3)
    expect(getContextReachableMaxYieldName('ice', sectors, filters)).toBe('medium')
    // silicon: sector-a has silicon=5 (high), sector-b has silicon=3 (medium)
    // ore requires medium (rating>=3), both sectors qualify
    // Best silicon among qualifying sectors is high (rating=5) from sector-a
    expect(getContextReachableMaxYieldName('silicon', sectors, filters)).toBe('high')
  })

  it('returns null when a resource is unreachable under the other selected filters', () => {
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: true, minYieldName: 'high' }
    })

    // silicon: other selected = ore (medium, rating>=3) + ice (high, rating>=5)
    // sector-a: ore=5 ✓, ice=3 < 5 ✗ => doesn't qualify
    // sector-b: ore=5 ✓, ice=5 ✓ => qualifies, silicon=3 (medium)
    // Best silicon in qualifying sectors is medium (rating=3) from sector-b
    expect(getContextReachableMaxYieldName('silicon', sectors, filters)).toBe('medium')
    // ice: only sector-c with ore=3, no ice resource
    // No sectors have ice, so reachable max is null
    expect(getContextReachableMaxYieldName('ice', sectors.filter((item) => item.sectorId === 'sector-c'), filters)).toBe(null)
  })
})
