import type { SectorResourceFill, SectorResourceVisualInput } from './mapResourceFilter'
import { buildSectorResourceFill, YIELD_NAME_TO_RATING } from '@/store/logic/mapResourceFilter'
import { breadthFirstReachable } from '@/store/logic/mapSectorGraph'

export const ADVANCED_SUNLIGHT_TAG_ID = 'sunlight'

export type AdvancedResourceTagGroup = {
  id: string
  tagIds: string[]
  minYieldByWare: Record<string, string>
  sunlightMinimum: number
}

export type AdvancedResourceSector = SectorResourceVisualInput

export type AdvancedGroupMatch = {
  groupId: string
  matched: boolean
  matchedOrdinaryWareIds: string[]
  ordinaryAverageLevel: number | null
  includesSunlight: boolean
}

export type AdvancedCandidate = {
  resourceSectorIds: string[]
  hubCandidateSectorIds: string[]
  coveredGroupIds: string[]
  score: number
}

export type AdvancedSectorFillMap = Record<string, SectorResourceFill>

export type BuildAdvancedCandidatesInput = {
  sectors: AdvancedResourceSector[]
  tagGroups: AdvancedResourceTagGroup[]
  jumpLimit: number
  allowTransit: boolean
  yieldRanksByWare: Record<string, Record<string, number>>
  resourceColors: Record<string, string>
  sectorGraph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
}

export type BuildAdvancedCandidatesResult = {
  candidates: AdvancedCandidate[]
  matchedGroupsBySector: Record<string, string[]>
  matchedResourceTagsBySector: Record<string, string[]>
  matchedSunlightBySector: Record<string, boolean>
  sectorFillSetsByCandidateKey: Record<string, AdvancedSectorFillMap>
}

const normalizeOrdinaryTagIds = (tagIds: string[]) =>
  Array.from(new Set(tagIds.filter((tagId) => tagId !== ADVANCED_SUNLIGHT_TAG_ID))).sort()

const buildCandidateKey = (sectorIds: string[]) => sectorIds.slice().sort().join('|')

const isStrictSubset = (left: string[], right: string[]) => {
  if (left.length >= right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

export const matchSectorToTagGroup = (
  sector: AdvancedResourceSector,
  group: AdvancedResourceTagGroup,
  _yieldRanksByWare: Record<string, Record<string, number>>
): AdvancedGroupMatch => {
  if (!group.tagIds.length) {
    return {
      groupId: group.id,
      matched: false,
      matchedOrdinaryWareIds: [],
      ordinaryAverageLevel: null,
      includesSunlight: false
    }
  }

  let matched = true
  let includesSunlight = false
  const ordinaryRatings: number[] = []
  const ordinaryWareIds: string[] = []

  group.tagIds.forEach((tagId) => {
    if (tagId === ADVANCED_SUNLIGHT_TAG_ID) {
      includesSunlight = true
      if (sector.sunlight < group.sunlightMinimum) matched = false
      return
    }

    const resource = sector.resources.find((entry) => entry.ware === tagId)
    const minYieldName = group.minYieldByWare[tagId]
    // 将 minYieldName（如 'low', 'high'）转换为 rating 数值
    const minimumRating = minYieldName ? (YIELD_NAME_TO_RATING[minYieldName] ?? 1) : 1
    const actualRating = resource?.rating ?? 0

    // 如果资源不存在或 rating < 最低要求，设置 matched = false
    if (!resource || actualRating < minimumRating) {
      matched = false
      return
    }

    ordinaryWareIds.push(tagId)
    ordinaryRatings.push(actualRating)
  })

  // 如果没有任何资源匹配，则该组不匹配
  if (ordinaryRatings.length === 0) {
    matched = false
  }

  return {
    groupId: group.id,
    matched,
    matchedOrdinaryWareIds: normalizeOrdinaryTagIds(ordinaryWareIds),
    ordinaryAverageLevel: ordinaryRatings.length
      ? ordinaryRatings.reduce((sum, rating) => sum + rating, 0) / ordinaryRatings.length
      : null,
    includesSunlight
  }
}

export const buildAdvancedCandidates = ({
  sectors,
  tagGroups,
  jumpLimit,
  allowTransit,
  yieldRanksByWare,
  resourceColors,
  sectorGraph,
  sectorClusterMap
}: BuildAdvancedCandidatesInput): BuildAdvancedCandidatesResult => {
  const groupIds = tagGroups.map((group) => group.id)
  const requiredGroupIdSet = new Set(groupIds)
  const sectorById = Object.fromEntries(sectors.map((sector) => [sector.sectorId, sector])) as Record<string, AdvancedResourceSector>

  const matchedGroupsBySector: Record<string, string[]> = {}
  const matchedResourceTagsBySector: Record<string, string[]> = {}
  const matchedSunlightBySector: Record<string, boolean> = {}
  const groupScoresBySector: Record<string, Record<string, number | null>> = {}

  sectors.forEach((sector) => {
    const matchedGroupIds: string[] = []
    const ordinaryWareSet = new Set<string>()
    let hasSunlightMatch = false
    const groupAverageScoresBySector: Record<string, number | null> = {}

    tagGroups.forEach((group) => {
      const match = matchSectorToTagGroup(sector, group, yieldRanksByWare)
      // 使用该组匹配资源的平均 rating 作为分数（可以是小数）
      groupAverageScoresBySector[group.id] = match.ordinaryAverageLevel
      if (!match.matched) return
      matchedGroupIds.push(group.id)
      match.matchedOrdinaryWareIds.forEach((wareId) => ordinaryWareSet.add(wareId))
      if (match.includesSunlight) hasSunlightMatch = true
    })

    matchedGroupsBySector[sector.sectorId] = matchedGroupIds
    matchedResourceTagsBySector[sector.sectorId] = Array.from(ordinaryWareSet).sort()
    matchedSunlightBySector[sector.sectorId] = hasSunlightMatch
    groupScoresBySector[sector.sectorId] = groupAverageScoresBySector
  })

  const matchedResourceSectorIds = sectors
    .map((sector) => sector.sectorId)
    .filter((sectorId) => (matchedGroupsBySector[sectorId] || []).length > 0)

  const hubSectorIds = allowTransit ? sectors.map((sector) => sector.sectorId) : matchedResourceSectorIds
  const mergedCandidates = new Map<string, { resourceSectorIds: string[]; hubCandidateSectorIds: Set<string>; coveredGroupIds: string[] }>()

  hubSectorIds.forEach((hubSectorId) => {
    const reachable = breadthFirstReachable(sectorGraph, hubSectorId, Math.max(0, jumpLimit), sectorClusterMap)
    const resourceSectorIds = matchedResourceSectorIds
      .filter((sectorId) => reachable[sectorId] !== undefined)
      .sort()

    if (!resourceSectorIds.length) return

    const coveredGroupIds = Array.from(new Set(
      resourceSectorIds.flatMap((sectorId) => matchedGroupsBySector[sectorId] || [])
    )).sort()

    if (coveredGroupIds.length !== requiredGroupIdSet.size || coveredGroupIds.some((groupId) => !requiredGroupIdSet.has(groupId))) {
      return
    }

    const key = buildCandidateKey(resourceSectorIds)
    const existing = mergedCandidates.get(key)
    if (existing) {
      existing.hubCandidateSectorIds.add(hubSectorId)
      return
    }

    mergedCandidates.set(key, {
      resourceSectorIds,
      hubCandidateSectorIds: new Set([hubSectorId]),
      coveredGroupIds
    })
  })

  const mergedList = Array.from(mergedCandidates.values())
  const maximalCandidates = mergedList.filter((candidate) => (
    !mergedList.some((other) => other !== candidate && isStrictSubset(candidate.resourceSectorIds, other.resourceSectorIds))
  ))

  const buildCandidateScore = (resourceSectorIds: string[]) => {
    // 1. 对每个 tag group，取候选中所有 sector 在该 group 上的最高平均分
    const groupScores = tagGroups
      .map((group) => resourceSectorIds
        .map((sectorId) => groupScoresBySector[sectorId]?.[group.id] ?? null)
        .filter((value): value is number => value !== null)
      )
      .filter((scores) => scores.length > 0)
      .map((scores) => Math.max(...scores))

    if (!groupScores.length) return 0
    // 2. 取所有组分数中的最低分（瓶颈）
    return Math.min(...groupScores)
  }

  const candidates = maximalCandidates
    .map((candidate) => ({
      resourceSectorIds: candidate.resourceSectorIds,
      hubCandidateSectorIds: Array.from(candidate.hubCandidateSectorIds).sort(),
      coveredGroupIds: candidate.coveredGroupIds,
      score: buildCandidateScore(candidate.resourceSectorIds)
    }))
    .sort((left, right) => (
      right.score - left.score ||
      right.resourceSectorIds.length - left.resourceSectorIds.length ||
      left.resourceSectorIds.join(',').localeCompare(right.resourceSectorIds.join(','))
    ))

  const sectorFillSetsByCandidateKey = candidates.reduce<Record<string, AdvancedSectorFillMap>>((acc, candidate) => {
    acc[buildCandidateKey(candidate.resourceSectorIds)] = candidate.resourceSectorIds.reduce<AdvancedSectorFillMap>((fills, sectorId) => {
      const sector = sectorById[sectorId]
      if (!sector) return fills
      const fill = buildSectorResourceFill({
        sector,
        selectedWareIds: matchedResourceTagsBySector[sectorId] || [],
        sunlightFilterEnabled: matchedSunlightBySector[sectorId] || false,
        resourceColors
      })
      if (fill) fills[sectorId] = fill
      return fills
    }, {})
    return acc
  }, {})

  return {
    candidates,
    matchedGroupsBySector,
    matchedResourceTagsBySector,
    matchedSunlightBySector,
    sectorFillSetsByCandidateKey
  }
}
