import type { X4Module } from '@/types/x4'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'
import type { BindingSectorGroup } from '@/types/x4'
import {
  detectStationHub,
  getSectorPureHub,
  DEFAULT_HUB_CONFIG,
  type HubDetectionConfig,
  type StationHubInfo,
  type SectorPureHub
} from './autoGroupHub'
import {
  getCoverageSectors,
  getSaveSectorsWithPlayerStations
} from './saveBindingUtils'

export const DEFAULT_JUMP_RANGE = 3
export const MAX_UNCERTAIN_JUMP = 5
export const SCORE_TIE_THRESHOLD = 0.3

export interface AssignmentOption {
  type: 'absorb' | 'standalone'
  targetGroupId?: string
  distance: number
  extendsRange: boolean
  resultingGroupSize: number
}

export interface SectorAssignment {
  sectorMacro: string
  status: 'auto' | 'uncertain_tie' | 'uncertain_extend' | 'standalone' | 'exception'
  defaultGroupId?: string
  options: AssignmentOption[]
  selectedOptionIndex: number | null
}

export interface GroupDraftInfo {
  id: string
  name: string
  sectorMacro?: string
  jumpRange: number
  originalJumpRange: number
  coverageSectorMacros: string[]
  connectedGroupIds: string[]
  isNew: boolean
  isPinned: boolean
  hubScore?: number
}

export interface AutoGroupResult {
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  playerSectorMacros: string[]
}

function buildSectorDistanceMap(
  startSectorMacro: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): Map<string, number> {
  const distances = new Map<string, number>()
  distances.set(startSectorMacro, 0)
  const queue = [startSectorMacro]
  let index = 0

  while (index < queue.length) {
    const current = queue[index++]!
    const currentDepth = distances.get(current) || 0
    const currentClusterId = sectorClusterMap[current]

    ;(sectorGraph[current] || []).forEach((next) => {
      if (distances.has(next)) return
      const nextClusterId = sectorClusterMap[next]
      const depthIncrease = (currentClusterId && nextClusterId && currentClusterId !== nextClusterId) ? 1 : 0
      distances.set(next, currentDepth + depthIncrease)
      queue.push(next)
    })
  }

  return distances
}

function getDistance(
  from: string,
  to: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): number | null {
  const distances = buildSectorDistanceMap(from, sectorGraph, sectorClusterMap)
  const d = distances.get(to)
  return d !== undefined ? d : null
}

function determineAssignmentOptions(
  _sectorMacro: string,
  candidateGroups: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }>,
  sectorCount: number
): { options: AssignmentOption[]; isUncertain: boolean; uncertaintyReason: 'tie' | 'extend' | null; defaultGroupId?: string } {
  if (candidateGroups.length === 0) return { options: [], isUncertain: false, uncertaintyReason: null }

  const sorted = [...candidateGroups].sort((a, b) => a.distance - b.distance)
  const best = sorted[0]!
  const minDist = best.distance

  const sameDistGroups = sorted.filter((g) => g.distance === minDist)

  if (sameDistGroups.length > 1) {
    const scores = sameDistGroups.filter((g) => g.score !== undefined).map((g) => g.score!)
    if (scores.length === sameDistGroups.length) {
      const maxScore = Math.max(...scores)
      const hasScoreTie = scores.some((s) => s !== maxScore && (maxScore - s) / maxScore < SCORE_TIE_THRESHOLD)

      if (hasScoreTie) {
        const options: AssignmentOption[] = sameDistGroups.map((g) => ({
          type: 'absorb' as const,
          targetGroupId: g.groupId,
          distance: g.distance,
          extendsRange: g.distance > g.jumpRange,
          resultingGroupSize: sectorCount
        }))
        options.push({
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        })
        return { options, isUncertain: true, uncertaintyReason: 'tie' }
      }
    }
  }

  const extendsRange = best.distance > best.jumpRange

  if (extendsRange && best.distance <= MAX_UNCERTAIN_JUMP) {
    const options: AssignmentOption[] = [
      {
        type: 'absorb' as const,
        targetGroupId: best.groupId,
        distance: best.distance,
        extendsRange: true,
        resultingGroupSize: sectorCount
      },
      {
        type: 'standalone' as const,
        distance: 0,
        extendsRange: false,
        resultingGroupSize: 1
      }
    ]
    return { options, isUncertain: true, uncertaintyReason: 'extend', defaultGroupId: best.groupId }
  }

  if (extendsRange && best.distance > MAX_UNCERTAIN_JUMP) {
    return {
      options: [{
        type: 'standalone' as const,
        distance: 0,
        extendsRange: false,
        resultingGroupSize: 1
      }],
      isUncertain: false,
      uncertaintyReason: null
    }
  }

  const options: AssignmentOption[] = [
    {
      type: 'absorb' as const,
      targetGroupId: best.groupId,
      distance: best.distance,
      extendsRange: false,
      resultingGroupSize: sectorCount
    },
    {
      type: 'standalone' as const,
      distance: 0,
      extendsRange: false,
      resultingGroupSize: 1
    }
  ]
  return { options, isUncertain: false, uncertaintyReason: null, defaultGroupId: best.groupId }
}

export function groupCleanSlate(
  archive: SaveArchive,
  modulesByMacroId: Record<string, X4Module>,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG,
  prefJumpRange: number = DEFAULT_JUMP_RANGE
): AutoGroupResult {
  const sectorsWithStations = getSaveSectorsWithPlayerStations(archive)
    .filter((s) => s.playerStations.length > 0)
  const playerSectorMacros = sectorsWithStations.map((s) => s.sectorMacro)

  const sectorStationMap = new Map<string, PlayerStationEntry[]>()
  for (const s of sectorsWithStations) {
    sectorStationMap.set(s.sectorMacro, s.playerStations)
  }

  const pureHubs: SectorPureHub[] = []
  const sectorHubMap = new Map<string, StationHubInfo[]>()
  for (const sectorMacro of playerSectorMacros) {
    const stations = sectorStationMap.get(sectorMacro) || []
    const hub = getSectorPureHub(sectorMacro, stations, modulesByMacroId, config)
    const allHubs = stations.map((s) => detectStationHub(s, modulesByMacroId, config))

    sectorHubMap.set(sectorMacro, allHubs)
    if (hub) {
      pureHubs.push(hub)
    }
  }

  pureHubs.sort((a, b) => b.score - a.score)

  const groups: GroupDraftInfo[] = []
  const groupMap = new Map<string, GroupDraftInfo>()
  const assignedSectors = new Map<string, string>()
  const occupiedSectors = new Set<string>()

  // Pure hub anchors should not appear in each other's coverage
  const pureHubAnchors = new Set(pureHubs.map((h) => h.sectorMacro))

  let groupCounter = 0

  // Phase A: Pure hub groups
  for (const hub of pureHubs) {
    const sectorMacro = hub.sectorMacro
    if (assignedSectors.has(sectorMacro)) continue

    const groupId = `auto_${crypto.randomUUID()}`
    const allCoverage = getSectorCoverageMacros(sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap)
    const coverage = allCoverage.filter((m) =>
      playerSectorMacros.includes(m) &&
      !occupiedSectors.has(m) &&
      m !== sectorMacro &&
      // Don't claim other pure hub anchors
      !pureHubAnchors.has(m)
    )

    const group: GroupDraftInfo = {
      id: groupId,
      name: `Sector ${++groupCounter}`,
      sectorMacro,
      jumpRange: prefJumpRange,
      originalJumpRange: prefJumpRange,
      coverageSectorMacros: coverage,
      connectedGroupIds: [],
      isNew: true,
      isPinned: false,
      hubScore: hub.score
    }
    groups.push(group)
    groupMap.set(groupId, group)
    assignedSectors.set(sectorMacro, groupId)
    // Anchor is always occupied by its own group
    occupiedSectors.add(sectorMacro)
    coverage.forEach((m) => occupiedSectors.add(m))
  }

  // Auto-connect each new group to its nearest neighbor
  for (const group of groups) {
    if (!group.sectorMacro) continue
    let nearest: string | null = null
    let minDist = Infinity
    for (const other of groups) {
      if (other.id === group.id || !other.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, other.sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null && dist < minDist) {
        minDist = dist
        nearest = other.id
      }
    }
    if (nearest) {
      group.connectedGroupIds = [nearest]
    }
  }

  // Phase A: Greedy assignment
  const unassignedSectors = playerSectorMacros.filter((s) => !assignedSectors.has(s))

  for (const sectorMacro of unassignedSectors) {
    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []

    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null && dist <= group.jumpRange) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: group.jumpRange,
          score: group.hubScore
        })
      }
    }

    if (candidates.length > 0) {
      const result = determineAssignmentOptions(sectorMacro, candidates, playerSectorMacros.length)
      if (!result.isUncertain && result.defaultGroupId) {
        assignedSectors.set(sectorMacro, result.defaultGroupId)
      }
    }
  }

  const phaseAAssigned = new Set<string>(assignedSectors.keys())
  let phaseAAssignedCount = 0
  do {
    phaseAAssignedCount = assignedSectors.size
    for (const sectorMacro of playerSectorMacros.filter((s) => !assignedSectors.has(s))) {
      const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
      for (const group of groups) {
        if (!group.sectorMacro) continue
        const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
        if (dist !== null && dist <= group.jumpRange) {
          candidates.push({
            groupId: group.id,
            distance: dist,
            jumpRange: group.jumpRange,
            score: group.hubScore
          })
        }
      }

      if (candidates.length > 0) {
        const result = determineAssignmentOptions(sectorMacro, candidates, playerSectorMacros.length)
        if (!result.isUncertain && result.defaultGroupId) {
          assignedSectors.set(sectorMacro, result.defaultGroupId)
        }
      }
    }
    for (const s of assignedSectors.keys()) {
      phaseAAssigned.add(s)
    }
  } while (assignedSectors.size > phaseAAssignedCount)

  // Phase B: Impure Tier 1
  for (const sectorMacro of playerSectorMacros) {
    if (assignedSectors.has(sectorMacro)) continue

    const hubs = sectorHubMap.get(sectorMacro) || []
    const hasTier1Impure = hubs.some((h) => h.qualified && !h.isPureHub)

    if (!hasTier1Impure) continue

    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: group.jumpRange,
          score: group.hubScore
        })
      }
    }

    const closest = candidates.sort((a, b) => a.distance - b.distance)[0]
    if (!closest) continue

    if (closest.distance <= closest.jumpRange) {
      assignedSectors.set(sectorMacro, closest.groupId)
    } else if (closest.distance <= MAX_UNCERTAIN_JUMP) {
      // uncertain - will be handled in buildAssignmentResult
    } else {
      // beyond 5 jumps - standalone (Phase B impure can be standalone)
    }
  }

  // Phase C: Tier 2
  for (const sectorMacro of playerSectorMacros) {
    if (assignedSectors.has(sectorMacro)) continue

    const hubs = sectorHubMap.get(sectorMacro) || []
    const isTier2 = hubs.every((h) => !h.qualified)

    if (!isTier2) continue

    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: group.jumpRange,
          score: group.hubScore
        })
      }
    }

    const closest = candidates.sort((a, b) => a.distance - b.distance)[0]
    if (!closest) continue

    if (closest.distance <= MAX_UNCERTAIN_JUMP) {
      assignedSectors.set(sectorMacro, closest.groupId)
    }
  }

  // Build assignments
  const assignments = buildAssignmentResult(
    playerSectorMacros,
    assignedSectors,
    groups,
    sectorGraph,
    sectorClusterMap
  )

  return { groups, assignments, playerSectorMacros }
}

export function groupIncremental(
  archive: SaveArchive,
  existingGroups: BindingSectorGroup[],
  _modulesByMacroId: Record<string, X4Module>,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  _config: HubDetectionConfig = DEFAULT_HUB_CONFIG,
  _prefJumpRange: number = DEFAULT_JUMP_RANGE
): AutoGroupResult {
  const sectorsWithStations = getSaveSectorsWithPlayerStations(archive)
    .filter((s) => s.playerStations.length > 0)
  const playerSectorMacros = sectorsWithStations.map((s) => s.sectorMacro)

  const existingCoverage = new Set<string>()
  for (const group of existingGroups) {
    for (const entry of group.coverageSectorMacros) {
      existingCoverage.add(entry.ref)
    }
    if (group.sectorMacro) existingCoverage.add(group.sectorMacro)
  }

  const unassignedSectors = playerSectorMacros.filter((s) => !existingCoverage.has(s))

  const groups: GroupDraftInfo[] = existingGroups.map((group) => ({
    id: group.id,
    name: group.name,
    sectorMacro: group.sectorMacro,
    jumpRange: group.jumpRange,
    originalJumpRange: group.jumpRange,
    coverageSectorMacros: group.coverageSectorMacros.map((c) => c.ref),
    connectedGroupIds: [...(group.connectedGroupIds || [])],
    isNew: false,
    isPinned: true,
    hubScore: undefined
  }))

  const assignedSectors = new Map<string, string>()

  for (const sectorMacro of unassignedSectors) {
    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []

    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: group.jumpRange
        })
      }
    }

    if (candidates.length === 0) continue

    const sorted = candidates.sort((a, b) => a.distance - b.distance)
    const closest = sorted[0]!

    if (closest.distance <= closest.jumpRange) {
      assignedSectors.set(sectorMacro, closest.groupId)
    }
  }

  const assignments = buildAssignmentResult(
    unassignedSectors.filter((s) => !assignedSectors.has(s)),
    assignedSectors,
    groups,
    sectorGraph,
    sectorClusterMap
  )

  return { groups, assignments, playerSectorMacros }
}

function getSectorCoverageMacros(
  sectorMacro: string,
  jumpRange: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): string[] {
  const results = getCoverageSectors(sectorMacro, jumpRange, sectorGraph, sectorClusterMap)
  return results.map((r) => r.sectorMacro)
}

function buildAssignmentResult(
  unassignedSectors: string[],
  assignedSectors: Map<string, string>,
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): SectorAssignment[] {
  const assignments: SectorAssignment[] = []
  const allSectors = [...unassignedSectors, ...Array.from(assignedSectors.keys())]
  const uniqueSectors = [...new Set(allSectors)]

  for (const sectorMacro of uniqueSectors) {
    const alreadyAssignedTo = assignedSectors.get(sectorMacro)

    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: group.jumpRange,
          score: group.hubScore
        })
      }
    }

    if (candidates.length === 0) {
      assignments.push({
        sectorMacro,
        status: 'exception',
        options: [],
        selectedOptionIndex: null
      })
      continue
    }

    const sorted = candidates.sort((a, b) => a.distance - b.distance)
    const best = sorted[0]!
    const minDist = best.distance
    const sameDist = sorted.filter((g) => g.distance === minDist)

    if (sameDist.length > 1) {
      const scores = sameDist.filter((g) => g.score !== undefined).map((g) => g.score!)
      let hasScoreTie = false
      if (scores.length === sameDist.length) {
        const maxScore = Math.max(...scores)
        hasScoreTie = scores.some((s) => s !== maxScore && (maxScore - s) / maxScore < SCORE_TIE_THRESHOLD)
      }

      if (hasScoreTie) {
        const options: AssignmentOption[] = sameDist.map((g) => ({
          type: 'absorb' as const,
          targetGroupId: g.groupId,
          distance: g.distance,
          extendsRange: g.distance > g.jumpRange,
          resultingGroupSize: uniqueSectors.length
        }))
        options.push({
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        })
        assignments.push({
          sectorMacro,
          status: 'uncertain_tie',
          options,
          selectedOptionIndex: null
        })
        continue
      }
    }

    const extendsRange = best.distance > best.jumpRange

    if (extendsRange && best.distance <= MAX_UNCERTAIN_JUMP) {
      const options: AssignmentOption[] = [
        {
          type: 'absorb' as const,
          targetGroupId: best.groupId,
          distance: best.distance,
          extendsRange: true,
          resultingGroupSize: uniqueSectors.length
        },
        {
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        }
      ]
      assignments.push({
        sectorMacro,
        status: 'uncertain_extend',
        defaultGroupId: best.groupId,
        options,
        selectedOptionIndex: null
      })
      continue
    }

    if (extendsRange && best.distance > MAX_UNCERTAIN_JUMP) {
      assignments.push({
        sectorMacro,
        status: 'standalone',
        options: [{
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        }],
        selectedOptionIndex: 0
      })
      continue
    }

    if (alreadyAssignedTo) {
      const options: AssignmentOption[] = [{
        type: 'absorb' as const,
        targetGroupId: alreadyAssignedTo,
        distance: best.distance,
        extendsRange: false,
        resultingGroupSize: uniqueSectors.length
      }]
      assignments.push({
        sectorMacro,
        status: 'auto',
        defaultGroupId: alreadyAssignedTo,
        options,
        selectedOptionIndex: 0
      })
    } else {
      const options: AssignmentOption[] = [{
        type: 'absorb' as const,
        targetGroupId: best.groupId,
        distance: best.distance,
        extendsRange: false,
        resultingGroupSize: uniqueSectors.length
      }]
      assignments.push({
        sectorMacro,
        status: 'auto',
        defaultGroupId: best.groupId,
        options,
        selectedOptionIndex: 0
      })
    }

    // For absorbed sectors, add standalone option (unless sector is the group's own anchor)
    const last = assignments[assignments.length - 1]!
    const isAnchorOfDefault = last.defaultGroupId
      ? groups.find((g) => g.id === last.defaultGroupId)?.sectorMacro === last.sectorMacro
      : false
    if (!isAnchorOfDefault && last.options.length > 0 && last.options[last.options.length - 1]!.type !== 'standalone') {
      last.options.push({
        type: 'standalone' as const,
        distance: 0,
        extendsRange: false,
        resultingGroupSize: 1
      })
    }
  }

  return assignments
}

export function detectScoreTies(
  candidates: Array<{ distance: number; score: number }>
): boolean {
  if (candidates.length < 2) return false

  const minDist = Math.min(...candidates.map((c) => c.distance))
  const sameDist = candidates.filter((c) => c.distance === minDist)
  if (sameDist.length < 2) return false

  const maxScore = Math.max(...sameDist.map((c) => c.score))
  return sameDist.some((c) => c.score !== maxScore && (maxScore - c.score) / maxScore < SCORE_TIE_THRESHOLD)
}

export function resolveUncertainAssignment(
  assignment: SectorAssignment,
  optionIndex: number
): SectorAssignment {
  return {
    ...assignment,
    selectedOptionIndex: optionIndex,
    status: 'auto'
  }
}

export function applyAbsorbToResult(
  result: AutoGroupResult,
  sectorMacro: string,
  optionIndex: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  _prefJumpRange: number = 3
): AutoGroupResult {
  const assignments = [...result.assignments]
  const idx = assignments.findIndex((a) => a.sectorMacro === sectorMacro)
  if (idx < 0) return result

  const assignment = assignments[idx]!
  const opt = assignment.options[optionIndex]!
  if (opt.type !== 'absorb' || !opt.targetGroupId) return result

  const wasStandalone = assignment.selectedOptionIndex !== null
    && assignment.options[assignment.selectedOptionIndex]?.type === 'standalone'

  assignments[idx] = resolveUncertainAssignment(assignment, optionIndex)

  let groups = [...result.groups]

  // If switching back from standalone, remove the now-empty standalone group
  let removedGroupId: string | null = null
  if (wasStandalone) {
    const standaloneGroupIdx = groups.findIndex((g) =>
      g.isNew && g.sectorMacro === sectorMacro
    )
    if (standaloneGroupIdx >= 0) {
      removedGroupId = groups[standaloneGroupIdx]!.id
      groups.splice(standaloneGroupIdx, 1)
      // Remove connections to removed group
      for (let i = 0; i < groups.length; i++) {
        groups[i] = {
          ...groups[i]!,
          connectedGroupIds: groups[i]!.connectedGroupIds.filter((id) => id !== removedGroupId)
        }
      }
    }
  }

  const targetGroupIdx = groups.findIndex((g) => g.id === opt.targetGroupId)
  if (targetGroupIdx < 0) return { groups, assignments: assignments as SectorAssignment[], playerSectorMacros: result.playerSectorMacros }

  const g = groups[targetGroupIdx]!

  // Remove sector from other groups' coverage
  for (let i = 0; i < groups.length; i++) {
    if (i !== targetGroupIdx) {
      groups[i] = { ...groups[i]!, coverageSectorMacros: groups[i]!.coverageSectorMacros.filter((m) => m !== sectorMacro) }
    }
  }

  // Add to target group's coverage
  const newCoverage = [...g.coverageSectorMacros]
  if (!newCoverage.includes(sectorMacro)) {
    newCoverage.push(sectorMacro)
  }

  // Extend jump range if needed
  let newJumpRange = g.jumpRange
  if (opt.extendsRange && g.sectorMacro) {
    const distances = getCoverageSectors(g.sectorMacro, 99, sectorGraph, sectorClusterMap)
    const dist = distances.find((d) => d.sectorMacro === sectorMacro)?.distance
    if (dist !== undefined && dist > newJumpRange) {
      newJumpRange = dist
    }
  }

  groups[targetGroupIdx] = { ...g, jumpRange: newJumpRange, coverageSectorMacros: newCoverage }

  // If standalone group was removed, recompute candidates for remaining uncertain sectors
  if (removedGroupId) {
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i]!
      if (a.sectorMacro === sectorMacro) continue
      if (a.status !== 'uncertain_tie' && a.status !== 'uncertain_extend') continue
      if (a.selectedOptionIndex !== null) continue
      // Remove the removed group's options
      assignments[i] = {
        ...a,
        options: a.options.filter((o) => o.targetGroupId !== removedGroupId)
      }
    }
  }

  return { groups, assignments: assignments as SectorAssignment[], playerSectorMacros: result.playerSectorMacros }
}

export function applyStandaloneToResult(
  result: AutoGroupResult,
  sectorMacro: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  prefJumpRange: number,
  getSectorName: (macro: string) => string
): AutoGroupResult {
  const assignments = [...result.assignments]
  const idx = assignments.findIndex((a) => a.sectorMacro === sectorMacro)
  if (idx < 0) return result

  const assignment = assignments[idx]!

  const groups = [...result.groups]

  // Default: all player sectors are occupied (already in some group)
  const occupied = new Set(result.playerSectorMacros)
  // Release only unselected uncertain sectors (still need resolution)
  for (const a of result.assignments) {
    if ((a.status === 'uncertain_tie' || a.status === 'uncertain_extend') && a.selectedOptionIndex === null) {
      occupied.delete(a.sectorMacro)
    }
  }
  // Standalone sector always excluded from its own coverage
  occupied.add(sectorMacro)

  console.log('[applyStandalone] sectorMacro:', sectorMacro, 'prefJumpRange:', prefJumpRange)
  console.log('[applyStandalone] playerSectorMacros count:', result.playerSectorMacros.length)
  console.log('[applyStandalone] occupied.size:', occupied.size, 'assignments.count:', result.assignments.length)
  console.log('[applyStandalone] uncertain unselected:', result.assignments.filter(a => (a.status === 'uncertain_tie' || a.status === 'uncertain_extend') && a.selectedOptionIndex === null).map(a => a.sectorMacro))
  console.log('[applyStandalone] groups before:', result.groups.map(g => g.name + '(anchor=' + g.sectorMacro + ' cover=' + g.coverageSectorMacros.length + ')'))

  const allSectors = getCoverageSectors(sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap)
  const withinRange = allSectors.map(c => c.sectorMacro)
  const playerWithinRange = withinRange.filter(m => result.playerSectorMacros.includes(m))
  const notOccupied = playerWithinRange.filter(m => !occupied.has(m) && m !== sectorMacro)
  console.log('[applyStandalone] within range (total):', withinRange.length, 'player:', playerWithinRange.length, 'not occupied:', notOccupied.length)
  console.log('[applyStandalone] not occupied sectors:', notOccupied)

  const groupId = `auto_${crypto.randomUUID()}`

  const coverage = allSectors
    .map((c) => c.sectorMacro)
    .filter((m) =>
      result.playerSectorMacros.includes(m) &&
      m !== sectorMacro &&
      !occupied.has(m)
    )

  const newGroup: GroupDraftInfo = {
    id: groupId,
    name: getSectorName(sectorMacro),
    sectorMacro,
    jumpRange: prefJumpRange,
    originalJumpRange: prefJumpRange,
    coverageSectorMacros: coverage,
    connectedGroupIds: [],
    isNew: true,
    isPinned: false,
    hubScore: undefined
  }

  // Auto-connect to nearest
  let nearest: string | null = null
  let minDist = Infinity
  for (const g of groups) {
    if (!g.sectorMacro) continue
    const distances = getCoverageSectors(g.sectorMacro, 99, sectorGraph, sectorClusterMap)
    const dist = distances.find((d) => d.sectorMacro === sectorMacro)?.distance
    if (dist !== undefined && dist < minDist) {
      minDist = dist
      nearest = g.id
    }
  }
  if (nearest) {
    newGroup.connectedGroupIds = [nearest]
    const ti = groups.findIndex((g) => g.id === nearest)
    if (ti >= 0) {
      groups[ti] = { ...groups[ti]!, connectedGroupIds: [...(groups[ti]!.connectedGroupIds || []), groupId] }
    }
  }
  groups.push(newGroup)

  // Select standalone option, keep card visible
  const standaloneIdx = assignment.options.findIndex((o) => o.type === 'standalone')
  assignments[idx] = {
    ...assignment,
    selectedOptionIndex: standaloneIdx >= 0 ? standaloneIdx : assignment.options.length,
  }

  // Remove this sector from other groups' coverage
  for (let i = 0; i < groups.length - 1; i++) {
    groups[i] = { ...groups[i]!, coverageSectorMacros: groups[i]!.coverageSectorMacros.filter((m) => m !== sectorMacro) }
  }

  // Recompute candidates for remaining uncertain sectors: add new group as candidate
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!
    if (a.sectorMacro === sectorMacro) continue
    if (a.status === 'exception') continue

    const dist = getCoverageSectors(sectorMacro, 99, sectorGraph, sectorClusterMap)
      .find((d) => d.sectorMacro === a.sectorMacro)?.distance

    if (dist === undefined || dist > prefJumpRange) continue

    const newOpt: AssignmentOption = {
      type: 'absorb' as const,
      targetGroupId: groupId,
      distance: dist,
      extendsRange: false,
      resultingGroupSize: 1
    }

    if (a.status === 'uncertain_tie' || a.status === 'uncertain_extend') {
      if (a.selectedOptionIndex !== null) continue
      const opts = [...a.options]
      const si = opts.findIndex((o) => o.type === 'standalone')
      if (si >= 0) opts.splice(si, 0, newOpt)
      else opts.push(newOpt)
      const bestIdx = findBestOptionIndex(opts)
      assignments[i] = { ...a, options: opts, selectedOptionIndex: bestIdx }
    }
  }

  console.log('[applyStandalone] FINAL groups:',
    groups.map(g => g.name + ' cover=[' + g.coverageSectorMacros.slice(0,3).join(',') + '...] count=' + g.coverageSectorMacros.length))

  return { groups, assignments: assignments as SectorAssignment[], playerSectorMacros: result.playerSectorMacros }
}

function findBestOptionIndex(options: AssignmentOption[]): number | null {
  let bestIdx: number | null = null
  let bestDist = Infinity
  for (let i = 0; i < options.length; i++) {
    const o = options[i]!
    if (o.type !== 'absorb') continue
    if (o.distance < bestDist && !o.extendsRange) {
      bestDist = o.distance
      bestIdx = i
    }
  }
  return bestIdx
}
