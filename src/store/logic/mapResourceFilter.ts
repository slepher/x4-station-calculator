export type RegionYieldEntry = {
  ware: string
  yields: Array<{ name: string }>
}

export const FIXED_RESOURCE_YIELD_NAMES = ['low', 'midlow', 'medium', 'midhigh', 'high'] as const

export type SectorResourceEntry = {
  ware: string
  yield: string
  level: number
}

export type ResourceFilterState = {
  selected: boolean
  minYieldName: string
}

export type ResourceFilterMap = Record<string, ResourceFilterState>

export type ResourceCandidateInput = {
  sectorId: string
  name: string
  displayName: string
  resources: SectorResourceEntry[]
}

export type ResourceCandidate = {
  sectorId: string
  name: string
  displayName: string
  score: number
}

export type SectorResourceColorSlice = {
  ware: string
  color: string
  share: number
}

export type SectorResourceFill =
  | {
      mode: 'solid'
      ware: string
      color: string
    }
  | {
      mode: 'pie'
      slices: SectorResourceColorSlice[]
    }

export type SectorResourceVisualInput = ResourceCandidateInput & {
  sunlight: number
}

export type BuildSectorResourceFillInput = {
  sector: SectorResourceVisualInput
  selectedWareIds: string[]
  sunlightFilterEnabled: boolean
  resourceColors: Record<string, string>
  minShare?: number
}

export const MIXED_YIELD_VALUE = '__mixed__'

export const buildFixedYieldEntries = (wareIds: string[]): RegionYieldEntry[] =>
  wareIds.map((ware) => ({
    ware,
    yields: FIXED_RESOURCE_YIELD_NAMES.map((name) => ({ name }))
  }))

export const buildYieldRanksByWare = (entries: RegionYieldEntry[]) => {
  const out: Record<string, Record<string, number>> = {}
  entries.forEach((entry) => {
    out[entry.ware] = {}
    entry.yields.forEach((yieldEntry, index) => {
      out[entry.ware]![yieldEntry.name] = index
    })
  })
  return out
}

export const buildDefaultResourceFilters = (entries: RegionYieldEntry[]): ResourceFilterMap => {
  const out: ResourceFilterMap = {}
  entries.forEach((entry) => {
    out[entry.ware] = {
      selected: false,
      minYieldName: entry.yields[0]?.name || 'low'
    }
  })
  return out
}

export const getSelectedResourceIds = (filters: ResourceFilterMap) =>
  Object.entries(filters)
    .filter(([, state]) => state.selected)
    .map(([ware]) => ware)

export const getSharedMinYieldName = (selectedIds: string[], filters: ResourceFilterMap) => {
  if (!selectedIds.length) return MIXED_YIELD_VALUE
  const values = new Set(selectedIds.map((ware) => filters[ware]?.minYieldName || MIXED_YIELD_VALUE))
  return values.size === 1 ? values.values().next().value || MIXED_YIELD_VALUE : MIXED_YIELD_VALUE
}

export const isSectorMatchedByResources = (
  candidate: ResourceCandidateInput,
  filters: ResourceFilterMap,
  ranksByWare: Record<string, Record<string, number>>
) => {
  const selectedIds = getSelectedResourceIds(filters)
  if (!selectedIds.length) return false
  return isSectorMatchedBySelectedIds(candidate, filters, ranksByWare, selectedIds)
}

export const isSectorMatchedBySelectedIds = (
  candidate: ResourceCandidateInput,
  filters: ResourceFilterMap,
  ranksByWare: Record<string, Record<string, number>>,
  selectedIds: string[]
) => {
  if (!selectedIds.length) return false

  return selectedIds.every((ware) => {
    const state = filters[ware]
    const rankMap = ranksByWare[ware]
    const resource = candidate.resources.find((item) => item.ware === ware)
    if (!state || !rankMap || !resource) return false
    const actualRank = rankMap[resource.yield]
    const minimumRank = rankMap[state.minYieldName]
    if (actualRank === undefined || minimumRank === undefined) return false
    return actualRank >= minimumRank
  })
}

export const getContextReachableMaxYieldName = (
  targetWare: string,
  sectors: ResourceCandidateInput[],
  filters: ResourceFilterMap,
  ranksByWare: Record<string, Record<string, number>>
) => {
  const rankMap = ranksByWare[targetWare]
  if (!rankMap) return null

  const otherSelectedIds = getSelectedResourceIds(filters).filter((ware) => ware !== targetWare)
  let bestName: string | null = null
  let bestRank = Number.NEGATIVE_INFINITY

  sectors.forEach((sector) => {
    if (otherSelectedIds.length && !isSectorMatchedBySelectedIds(sector, filters, ranksByWare, otherSelectedIds)) return
    const resource = sector.resources.find((item) => item.ware === targetWare)
    if (!resource) return
    const rank = rankMap[resource.yield]
    if (rank === undefined || rank <= bestRank) return
    bestRank = rank
    bestName = resource.yield
  })

  return bestName
}

export const buildResourceCandidates = (
  sectors: ResourceCandidateInput[],
  filters: ResourceFilterMap,
  ranksByWare: Record<string, Record<string, number>>,
  limit = 10
): ResourceCandidate[] => {
  const selectedIds = getSelectedResourceIds(filters)
  if (!selectedIds.length) return []

  return sectors
    .filter((sector) => isSectorMatchedByResources(sector, filters, ranksByWare))
    .map((sector) => ({
      sectorId: sector.sectorId,
      name: sector.name,
      displayName: sector.displayName,
      score: selectedIds.reduce((sum, ware) => {
        const resource = sector.resources.find((item) => item.ware === ware)
        return sum + (resource?.level || 0)
      }, 0)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.displayName.localeCompare(right.displayName) ||
      left.sectorId.localeCompare(right.sectorId)
    )
    .slice(0, limit)
}

const normalizeSliceShares = (slices: SectorResourceColorSlice[]) => {
  const total = slices.reduce((sum, slice) => sum + slice.share, 0)
  if (total <= 0) return slices
  return slices.map((slice, index) => {
    if (index < slices.length - 1) {
      return {
        ...slice,
        share: slice.share / total
      }
    }
    const allocated = slices
      .slice(0, -1)
      .reduce((sum, current) => sum + (current.share / total), 0)
    return {
      ...slice,
      share: Math.max(0, 1 - allocated)
    }
  })
}

export const buildSectorResourceFill = ({
  sector,
  selectedWareIds,
  sunlightFilterEnabled,
  resourceColors,
  minShare = 0.05
}: BuildSectorResourceFillInput): SectorResourceFill | null => {
  const normalResourceSlices = selectedWareIds
    .map((ware) => ({
      ware,
      level: sector.resources.find((item) => item.ware === ware)?.level || 0,
      color: resourceColors[ware] || '#fbbf24'
    }))
    .filter((entry) => sector.resources.some((item) => item.ware === entry.ware))

  if (normalResourceSlices.length === 1) {
    const slice = normalResourceSlices[0]!
    return {
      mode: 'solid',
      ware: slice.ware,
      color: slice.color
    }
  }

  if (normalResourceSlices.length >= 2) {
    const baseShare = minShare * normalResourceSlices.length
    const remainingShare = Math.max(0, 1 - baseShare)
    const totalLevel = normalResourceSlices.reduce((sum, slice) => sum + Math.max(0, slice.level), 0)
    const weightedSlices = normalResourceSlices.map((slice) => ({
      ware: slice.ware,
      color: slice.color,
      share: minShare + (
        totalLevel > 0
          ? remainingShare * (Math.max(0, slice.level) / totalLevel)
          : remainingShare / normalResourceSlices.length
      )
    }))

    return {
      mode: 'pie',
      slices: normalizeSliceShares(weightedSlices)
    }
  }

  if (sunlightFilterEnabled) {
    return {
      mode: 'solid',
      ware: 'sunlight',
      color: resourceColors.sunlight || '#fbbf24'
    }
  }

  return null
}
