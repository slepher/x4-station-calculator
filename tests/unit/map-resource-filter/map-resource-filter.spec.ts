import { describe, expect, it } from 'vitest'
import {
  buildDefaultResourceFilters,
  buildResourceCandidates,
  buildYieldRanksByWare,
  getSelectedResourceIds,
  getSharedMinYieldName,
  isSectorMatchedByResources,
  MIXED_YIELD_VALUE,
  type RegionYieldEntry,
  type ResourceFilterMap,
  type ResourceCandidateInput
} from '@/store/logic/mapResourceFilter'

const regionYields: RegionYieldEntry[] = [
  { ware: 'ore', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'silicon', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'ice', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] }
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
      { ware: 'ore', yield: 'high', level: 14 },
      { ware: 'silicon', yield: 'high', level: 12 },
      { ware: 'ice', yield: 'medium', level: 8 }
    ]
  },
  {
    sectorId: 'sector-b',
    name: 'Beta',
    displayName: 'Beta',
    resources: [
      { ware: 'ore', yield: 'high', level: 13 },
      { ware: 'silicon', yield: 'medium', level: 8 },
      { ware: 'ice', yield: 'high', level: 14 }
    ]
  },
  {
    sectorId: 'sector-c',
    name: 'Gamma',
    displayName: 'Gamma',
    resources: [
      { ware: 'ore', yield: 'medium', level: 8 }
    ]
  }
]

describe('mapResourceFilter', () => {
  it('builds default filters from first yield per ware', () => {
    const filters = buildDefaultResourceFilters(regionYields)

    expect(filters.ore).toEqual({ selected: false, minYieldName: 'lowest' })
    expect(filters.silicon).toEqual({ selected: false, minYieldName: 'lowest' })
  })

  it('matches sectors only when all selected resources satisfy minimum yields', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' }
    })

    expect(isSectorMatchedByResources(sectors[0]!, filters, ranks)).toBe(true)
    expect(isSectorMatchedByResources(sectors[1]!, filters, ranks)).toBe(false)
    expect(isSectorMatchedByResources(sectors[2]!, filters, ranks)).toBe(false)
  })

  it('sorts matched sectors by selected resource level sum and limits to top results', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'medium' }
    })

    const result = buildResourceCandidates(sectors, filters, ranks, 1)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      sectorId: 'sector-a',
      score: 26
    })
  })

  it('returns mixed marker when selected resources do not share one minimum yield', () => {
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: false, minYieldName: 'lowest' }
    })

    expect(getSelectedResourceIds(filters)).toEqual(['ore', 'silicon'])
    expect(getSharedMinYieldName(['ore', 'silicon'], filters)).toBe(MIXED_YIELD_VALUE)
  })
})
