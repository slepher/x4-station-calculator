import { describe, expect, it } from 'vitest'
import {
  buildSectorResourceFill,
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

  it('computes reachable max for a resource within the current filter context', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: true, minYieldName: 'lowest' }
    })

    expect(getContextReachableMaxYieldName('ice', sectors, filters, ranks)).toBe('medium')
    expect(getContextReachableMaxYieldName('silicon', sectors, filters, ranks)).toBe('high')
  })

  it('returns null when a resource is unreachable under the other selected filters', () => {
    const ranks = buildYieldRanksByWare(regionYields)
    const filters = makeFilters({
      ore: { selected: true, minYieldName: 'medium' },
      silicon: { selected: true, minYieldName: 'high' },
      ice: { selected: true, minYieldName: 'high' }
    })

    expect(getContextReachableMaxYieldName('silicon', sectors, filters, ranks)).toBe('medium')
    expect(getContextReachableMaxYieldName('ice', sectors.filter((item) => item.sectorId === 'sector-c'), filters, ranks)).toBe(null)
  })

  it('builds pie slices in selected resource order and excludes sunlight when resources exist', () => {
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-a',
        name: 'Alpha',
        displayName: 'Alpha',
        resources: [
          { ware: 'ore', yield: 'high', level: 14 },
          { ware: 'silicon', yield: 'high', level: 2 }
        ],
        sunlight: 180
      },
      selectedWareIds: ['ore', 'silicon'],
      sunlightFilterEnabled: true,
      resourceColors: {
        ore: '#ff9900',
        silicon: '#00bbff',
        sunlight: '#f7d24b'
      }
    })

    expect(fill).toMatchObject({
      mode: 'pie',
      slices: [
        { ware: 'ore', color: '#ff9900' },
        { ware: 'silicon', color: '#00bbff' }
      ]
    })
    expect(fill?.mode).toBe('pie')
    expect(fill?.slices).toHaveLength(2)
    expect(fill?.slices.every((slice) => slice.share >= 0.05)).toBe(true)
    expect(fill?.slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6)
  })

  it('keeps a visible minimum share and normalizes zero-level pie sectors', () => {
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-z',
        name: 'Zero',
        displayName: 'Zero',
        resources: [
          { ware: 'ore', yield: 'lowest', level: 0 },
          { ware: 'silicon', yield: 'lowest', level: 0 },
          { ware: 'ice', yield: 'lowest', level: 0 }
        ],
        sunlight: 0
      },
      selectedWareIds: ['ore', 'silicon', 'ice'],
      sunlightFilterEnabled: false,
      resourceColors: {
        ore: '#ff9900',
        silicon: '#00bbff',
        ice: '#ddeeff',
        sunlight: '#f7d24b'
      }
    })

    expect(fill?.mode).toBe('pie')
    expect(fill?.slices).toHaveLength(3)
    expect(fill?.slices.every((slice) => slice.share >= 0.05)).toBe(true)
    expect(fill?.slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6)
  })

  it('falls back to sunlight solid fill only when no normal resource slice participates', () => {
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-s',
        name: 'Sun',
        displayName: 'Sun',
        resources: [],
        sunlight: 150
      },
      selectedWareIds: [],
      sunlightFilterEnabled: true,
      resourceColors: {
        sunlight: '#f7d24b'
      }
    })

    expect(fill).toEqual({
      mode: 'solid',
      ware: 'sunlight',
      color: '#f7d24b'
    })
  })
})
