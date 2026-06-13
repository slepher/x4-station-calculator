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

export const DEFAULT_JUMP_RANGE = 2
export const DEFAULT_BRIDGE_SEARCH_JUMP_RANGE = 5
export const MAX_UNCERTAIN_JUMP = 5
export const SCORE_TIE_THRESHOLD = 0.3

export interface AssignmentOption {
  type: 'absorb' | 'standalone'
  targetGroupId?: string
  distance: number
  extendsRange: boolean
  resultingGroupSize: number
  source?: 'derived_standalone'
  sourceGroupId?: string
}

export interface SectorAssignment {
  sectorMacro: string
  status: 'auto' | 'uncertain_tie' | 'uncertain_extend' | 'standalone' | 'exception'
  displayBucket: 'resolved' | 'unresolved'
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
  disabledCoverageSectorMacros: string[]
  disabledConnectedGroupIds: string[]
  isNew: boolean
  recalcState: 'normal' | 'pin' | 'exclude'
  hubScore?: number
  hubStationCode?: string
  role?: 'normal' | 'bridge'
}

export interface BridgeReach {
  nodeId: string
  label: string
  sectorMacro: string
  jump: number
}

export interface BridgeSectorCandidate {
  sectorMacro: string
  score: number
}

export interface BridgePlanUnit {
  unitId: string
  label: string
  reaches: BridgeReach[]
  candidates: BridgeSectorCandidate[]
  selectedSectorMacro: string
}

export interface BridgePlanOption {
  id: string
  recommended: boolean
  selected: boolean
  units: BridgePlanUnit[]
  connectedComponentCount: number
  planScore: number
  totalJump: number
  maxJump: number
  stableKey: string
}

export interface AutoGroupResult {
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  bridgePlans: BridgePlanOption[]
  selectedBridgePlanId?: string
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

function resolveBridgeSearchJumpRange(groupCoverageJumpRange: number, bridgeSearchJumpRange: number): number {
  return Math.max(groupCoverageJumpRange, bridgeSearchJumpRange)
}

function getDisplayBucket(selectedOptionIndex: number | null): 'resolved' | 'unresolved' {
  return selectedOptionIndex === null ? 'unresolved' : 'resolved'
}

function withDisplayBucket<T extends { selectedOptionIndex: number | null }>(
  assignment: T
): T & { displayBucket: 'resolved' | 'unresolved' } {
  return {
    ...assignment,
    displayBucket: getDisplayBucket(assignment.selectedOptionIndex)
  }
}

class UnionFind {
  private parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(x: number): number {
    const parent = this.parent[x]!
    if (parent === x) return x
    const root = this.find(parent)
    this.parent[x] = root
    return root
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    this.parent[rb] = ra
    return true
  }
}

export function collectConnectedComponents(groups: GroupDraftInfo[]): number[][] {
  const idToIndex = new Map(groups.map((g, i) => [g.id, i]))
  const visited = new Set<number>()
  const components: number[][] = []

  for (let i = 0; i < groups.length; i++) {
    if (visited.has(i)) continue
    const component: number[] = []
    const queue = [i]
    visited.add(i)
    while (queue.length > 0) {
      const idx = queue.shift()!
      component.push(idx)
      for (const connectedId of groups[idx]!.connectedGroupIds || []) {
        const next = idToIndex.get(connectedId)
        if (next === undefined || visited.has(next)) continue
        visited.add(next)
        queue.push(next)
      }
    }
    components.push(component)
  }

  return components
}

export function computeGroupGraph(
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  maxDistance: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE
): void {
  for (const group of groups) {
    group.connectedGroupIds = []
  }

  const anchors = groups
    .map((group, index) => ({ group, index }))
    .filter((entry) => Boolean(entry.group.sectorMacro))

  if (anchors.length <= 1) return

  const edges: Array<{ a: number; b: number; weight: number; key: string }> = []
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i]!
      const b = anchors[j]!
      const dist = getDistance(a.group.sectorMacro!, b.group.sectorMacro!, sectorGraph, sectorClusterMap)
      if (dist === null || dist > maxDistance) continue
      const ids = [a.group.id, b.group.id].sort()
      edges.push({ a: a.index, b: b.index, weight: dist, key: `${ids[0]}:${ids[1]}` })
    }
  }

  edges.sort((a, b) => a.weight - b.weight || a.key.localeCompare(b.key))
  const uf = new UnionFind(groups.length)
  for (const edge of edges) {
    if (!uf.union(edge.a, edge.b)) continue
    const ga = groups[edge.a]!
    const gb = groups[edge.b]!
    ga.connectedGroupIds = [...new Set([...ga.connectedGroupIds, gb.id])]
    gb.connectedGroupIds = [...new Set([...gb.connectedGroupIds, ga.id])]
  }
}

function getBestSectorHubScore(sectorMacro: string, sectorHubMap: Map<string, StationHubInfo[]>): number {
  const hubs = sectorHubMap.get(sectorMacro) || []
  if (hubs.length === 0) return 0
  return Math.max(...hubs.map((h) => h.score))
}

function buildBridgeUnits(
  groups: GroupDraftInfo[],
  playerSectorMacros: string[],
  sectorHubMap: Map<string, StationHubInfo[]>,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  excludedSectorMacros: Set<string> = new Set()
): BridgePlanUnit[] {
  const anchorSectors = new Set(groups.map((g) => g.sectorMacro).filter(Boolean) as string[])
  const candidates = playerSectorMacros.filter((sector) => !anchorSectors.has(sector) && !excludedSectorMacros.has(sector))
  const candidateSet = new Set(candidates)
  const visited = new Set<string>()
  const units: BridgePlanUnit[] = []

  for (const sector of candidates) {
    if (visited.has(sector)) continue
    const clusterId = sectorClusterMap[sector] || sector
    const queue = [sector]
    const component: string[] = []
    visited.add(sector)

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)
      for (const next of sectorGraph[current] || []) {
        if (!candidateSet.has(next) || visited.has(next)) continue
        if ((sectorClusterMap[next] || next) !== clusterId) continue
        visited.add(next)
        queue.push(next)
      }
    }

    const sectorCandidates = component
      .map((sectorMacro) => ({ sectorMacro, score: getBestSectorHubScore(sectorMacro, sectorHubMap) }))
      .sort((a, b) => b.score - a.score || a.sectorMacro.localeCompare(b.sectorMacro))

    if (sectorCandidates.length === 0) continue

    units.push({
      unitId: `unit_${clusterId}_${sectorCandidates.map((c) => c.sectorMacro).sort().join('_')}`,
      label: sectorCandidates.length === 1 ? sectorCandidates[0]!.sectorMacro : clusterId,
      reaches: [],
      candidates: sectorCandidates,
      selectedSectorMacro: sectorCandidates[0]!.sectorMacro
    })
  }

  return units.sort((a, b) =>
    b.candidates[0]!.score - a.candidates[0]!.score ||
    a.unitId.localeCompare(b.unitId)
  )
}

function selectedUnitScore(unit: BridgePlanUnit): number {
  const selected = unit.candidates.find((c) => c.sectorMacro === unit.selectedSectorMacro)
  return selected?.score ?? 0
}

function planStableKey(units: BridgePlanUnit[]): string {
  return units.map((u) => u.unitId).sort().join('|')
}

function enumerateUnitCombos(units: BridgePlanUnit[], maxSize: number): BridgePlanUnit[][] {
  const results: BridgePlanUnit[][] = []
  const limit = Math.min(units.length, 12)
  const pool = units.slice(0, limit)

  function walk(start: number, size: number, acc: BridgePlanUnit[]) {
    if (acc.length === size) {
      results.push([...acc])
      return
    }
    for (let i = start; i < pool.length; i++) {
      acc.push(pool[i]!)
      walk(i + 1, size, acc)
      acc.pop()
    }
  }

  for (let size = 1; size <= Math.min(maxSize, pool.length); size++) {
    walk(0, size, [])
  }

  return results
}

function buildPlanFromUnits(
  planIndex: number,
  groups: GroupDraftInfo[],
  components: number[][],
  units: BridgePlanUnit[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  bridgeSearchJumpRange: number
): BridgePlanOption | null {
  const nodes: Array<{ id: string; kind: 'component' | 'unit'; label: string; sectorMacro: string; componentIndex?: number; unit?: BridgePlanUnit }> = []

  for (let i = 0; i < components.length; i++) {
    const firstGroup = groups[components[i]![0]!]!
    if (!firstGroup.sectorMacro) continue
    nodes.push({
      id: `component_${i}`,
      kind: 'component',
      label: firstGroup.name,
      sectorMacro: firstGroup.sectorMacro,
      componentIndex: i
    })
  }

  for (const unit of units) {
    nodes.push({
      id: unit.unitId,
      kind: 'unit',
      label: unit.label,
      sectorMacro: unit.selectedSectorMacro,
      unit
    })
  }

  const edges: Array<{ a: number; b: number; weight: number; key: string }> = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = getDistance(nodes[i]!.sectorMacro, nodes[j]!.sectorMacro, sectorGraph, sectorClusterMap)
      if (dist === null || dist > bridgeSearchJumpRange) continue
      const ids = [nodes[i]!.id, nodes[j]!.id].sort()
      edges.push({ a: i, b: j, weight: dist, key: `${ids[0]}:${ids[1]}` })
    }
  }

  edges.sort((a, b) => a.weight - b.weight || a.key.localeCompare(b.key))
  const uf = new UnionFind(nodes.length)
  const selectedEdges: typeof edges = []
  for (const edge of edges) {
    if (uf.union(edge.a, edge.b)) selectedEdges.push(edge)
  }

  const componentNodeIndexes = nodes
    .map((node, index) => node.kind === 'component' ? index : -1)
    .filter((index) => index >= 0)
  if (componentNodeIndexes.length <= 1) return null
  const componentCountByRoot = new Map<number, number>()
  for (const index of componentNodeIndexes) {
    const root = uf.find(index)
    componentCountByRoot.set(root, (componentCountByRoot.get(root) || 0) + 1)
  }
  const connectedComponentCount = Math.max(...componentCountByRoot.values())
  if (connectedComponentCount < 2) return null

  const nextUnits = units.map((unit) => ({ ...unit, reaches: [] as BridgeReach[] }))
  const unitMap = new Map(nextUnits.map((unit) => [unit.unitId, unit]))
  let totalJump = 0
  let maxJump = 0
  for (const edge of selectedEdges) {
    const a = nodes[edge.a]!
    const b = nodes[edge.b]!
    totalJump += edge.weight
    maxJump = Math.max(maxJump, edge.weight)

    if (a.kind === 'unit') {
      unitMap.get(a.id)?.reaches.push({ nodeId: b.id, label: b.label, sectorMacro: b.sectorMacro, jump: edge.weight })
    }
    if (b.kind === 'unit') {
      unitMap.get(b.id)?.reaches.push({ nodeId: a.id, label: a.label, sectorMacro: a.sectorMacro, jump: edge.weight })
    }
  }

  const planScore = Math.min(...nextUnits.map(selectedUnitScore))
  const stableKey = planStableKey(nextUnits)
  return {
    id: `bridge_plan_${planIndex}_${stableKey}`,
    recommended: false,
    selected: false,
    units: nextUnits,
    connectedComponentCount,
    planScore,
    totalJump,
    maxJump,
    stableKey
  }
}

export function buildBridgePlanOptions(
  groups: GroupDraftInfo[],
  playerSectorMacros: string[],
  sectorHubMap: Map<string, StationHubInfo[]>,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  excludedSectorMacros: string[] = []
): BridgePlanOption[] {
  const components = collectConnectedComponents(groups)
  if (components.length <= 1) return []

  const units = buildBridgeUnits(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, new Set(excludedSectorMacros))
  if (units.length === 0) return []

  const combos = enumerateUnitCombos(units, Math.min(components.length, 4))
  const plans: BridgePlanOption[] = []
  const seen = new Set<string>()

  for (const combo of combos) {
    const stableKey = planStableKey(combo)
    if (seen.has(stableKey)) continue
    const plan = buildPlanFromUnits(plans.length, groups, components, combo, sectorGraph, sectorClusterMap, bridgeSearchJumpRange)
    if (!plan) continue
    seen.add(stableKey)
    plans.push(plan)
  }

  if (plans.length === 0) return []

  const maxConnectedComponentCount = Math.max(...plans.map((plan) => plan.connectedComponentCount))
  const bestCoveragePlans = plans.filter((plan) => plan.connectedComponentCount === maxConnectedComponentCount)

  bestCoveragePlans.sort((a, b) =>
    b.planScore - a.planScore ||
    a.totalJump - b.totalJump ||
    a.maxJump - b.maxJump ||
    a.units.length - b.units.length ||
    a.stableKey.localeCompare(b.stableKey)
  )

  return bestCoveragePlans.slice(0, 5).map((plan, index) => ({
    ...plan,
    recommended: index === 0
  }))
}

export function applyBridgePlanToDraft(
  result: AutoGroupResult,
  plan: BridgePlanOption,
  prefJumpRange: number,
  getSectorName: (macro: string) => string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE
): AutoGroupResult {
  const existingAnchors = new Set(result.groups.map((g) => g.sectorMacro).filter(Boolean) as string[])
  const bridgeGroups: GroupDraftInfo[] = []

  for (const unit of plan.units) {
    if (existingAnchors.has(unit.selectedSectorMacro)) continue
    existingAnchors.add(unit.selectedSectorMacro)
    bridgeGroups.push({
      id: `auto_${crypto.randomUUID()}`,
      name: getSectorName(unit.selectedSectorMacro),
      sectorMacro: unit.selectedSectorMacro,
      jumpRange: prefJumpRange,
      originalJumpRange: prefJumpRange,
      coverageSectorMacros: [],
      connectedGroupIds: [],
      disabledCoverageSectorMacros: [],
      disabledConnectedGroupIds: [],
      isNew: true,
      recalcState: 'normal',
      hubScore: selectedUnitScore(unit),
      role: 'bridge'
    })
  }

  const groups = [...result.groups, ...bridgeGroups]
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange))
  const assignedSectors = new Map<string, string>()
  for (const group of groups) {
    if (group.sectorMacro) assignedSectors.set(group.sectorMacro, group.id)
  }
  const assignments = buildAssignmentResult(
    result.playerSectorMacros,
    assignedSectors,
    groups,
    sectorGraph,
    sectorClusterMap
  )
  const syncedGroups = syncSelectedAbsorptionsToCoverage(groups, assignments)

  return {
    ...result,
    groups: syncedGroups,
    assignments,
    bridgePlans: result.bridgePlans.map((p) => ({ ...p, selected: p.id === plan.id })),
    selectedBridgePlanId: plan.id
  }
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
  prefJumpRange: number = DEFAULT_JUMP_RANGE,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  excludedSectorMacros: string[] = []
): AutoGroupResult {
  const resolvedBridgeSearchJumpRange = resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange)
  const excludedSectorSet = new Set(excludedSectorMacros)
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
    if (hub && !excludedSectorSet.has(sectorMacro)) {
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
      disabledCoverageSectorMacros: [],
      disabledConnectedGroupIds: [],
      isNew: true,
      recalcState: 'normal',
      hubScore: hub.score,
      hubStationCode: hub.stationCode
    }
    groups.push(group)
    groupMap.set(groupId, group)
    assignedSectors.set(sectorMacro, groupId)
    // Anchor is always occupied by its own group
    occupiedSectors.add(sectorMacro)
    coverage.forEach((m) => occupiedSectors.add(m))
  }

  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange)
  let bridgePlans = buildBridgePlanOptions(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, excludedSectorMacros)
  if (bridgePlans.length === 1) {
    const applied = applyBridgePlanToDraft(
      { groups, assignments: [], bridgePlans, playerSectorMacros },
      bridgePlans[0]!,
      prefJumpRange,
      (m) => m,
      sectorGraph,
      sectorClusterMap,
      resolvedBridgeSearchJumpRange
    )
    groups.splice(0, groups.length, ...applied.groups)
    bridgePlans = applied.bridgePlans
    for (const group of groups) {
      if (group.role === 'bridge' && group.sectorMacro) {
        assignedSectors.set(group.sectorMacro, group.id)
      }
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
  const syncedGroups = syncSelectedAbsorptionsToCoverage(groups, assignments)

  return { groups: syncedGroups, assignments, bridgePlans, playerSectorMacros }
}

export function groupIncremental(
  archive: SaveArchive,
  existingGroups: BindingSectorGroup[],
  modulesByMacroId: Record<string, X4Module>,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG,
  prefJumpRange: number = DEFAULT_JUMP_RANGE,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  excludedSectorMacros: string[] = []
): AutoGroupResult {
  const resolvedBridgeSearchJumpRange = resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange)
  const sectorsWithStations = getSaveSectorsWithPlayerStations(archive)
    .filter((s) => s.playerStations.length > 0)
  const playerSectorMacros = sectorsWithStations.map((s) => s.sectorMacro)

  const excludedSectorSet = new Set(excludedSectorMacros)
  const existingAnchors = new Set<string>()
  for (const group of existingGroups) {
    if (group.sectorMacro && !excludedSectorSet.has(group.sectorMacro)) existingAnchors.add(group.sectorMacro)
  }

  const unassignedSectors = playerSectorMacros.filter((s) => !existingAnchors.has(s))

  const sectorStationMap = new Map<string, PlayerStationEntry[]>()
  for (const s of sectorsWithStations) {
    sectorStationMap.set(s.sectorMacro, s.playerStations)
  }

  const sectorHubMap = new Map<string, StationHubInfo[]>()
  for (const s of sectorsWithStations) {
    sectorHubMap.set(s.sectorMacro, s.playerStations.map((station) => detectStationHub(station, modulesByMacroId, config)))
  }

  const groups: GroupDraftInfo[] = existingGroups.map((group) => ({
    id: group.id,
    name: group.name,
    sectorMacro: group.sectorMacro,
    jumpRange: group.jumpRange,
    originalJumpRange: group.jumpRange,
    coverageSectorMacros: group.coverageSectorMacros.map((c) => c.ref),
    connectedGroupIds: [...(group.connectedGroupIds || [])],
    disabledCoverageSectorMacros: [],
    disabledConnectedGroupIds: [],
    isNew: false,
    recalcState: 'pin',
    hubScore: undefined
  }))

  let assignedSectors = new Map<string, string>()
  function rebuildAssignedSectorsFromGroups() {
    assignedSectors = new Map<string, string>()
    for (const group of groups) {
      if (group.sectorMacro && !excludedSectorSet.has(group.sectorMacro)) {
        assignedSectors.set(group.sectorMacro, group.id)
      }
      for (const sectorMacro of group.coverageSectorMacros) {
        if (excludedSectorSet.has(sectorMacro)) continue
        assignedSectors.set(sectorMacro, group.id)
      }
    }
  }
  rebuildAssignedSectorsFromGroups()

  const pureHubs: SectorPureHub[] = []
  for (const sectorMacro of playerSectorMacros) {
    if (excludedSectorSet.has(sectorMacro)) continue
    if (existingAnchors.has(sectorMacro)) continue
    if (assignedSectors.has(sectorMacro)) continue
    const hub = getSectorPureHub(sectorMacro, sectorStationMap.get(sectorMacro) || [], modulesByMacroId, config)
    if (hub) pureHubs.push(hub)
  }
  pureHubs.sort((a, b) => b.score - a.score)

  const pureHubAnchors = new Set(pureHubs.map((h) => h.sectorMacro))
  const occupiedSectors = new Set(assignedSectors.keys())
  let groupCounter = groups.length
  for (const hub of pureHubs) {
    if (assignedSectors.has(hub.sectorMacro)) continue
    const groupId = `auto_${crypto.randomUUID()}`
    const allCoverage = getSectorCoverageMacros(hub.sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap)
    const coverage = allCoverage.filter((m) =>
      playerSectorMacros.includes(m) &&
      !occupiedSectors.has(m) &&
      m !== hub.sectorMacro &&
      !pureHubAnchors.has(m)
    )
    groups.push({
      id: groupId,
      name: `Sector ${++groupCounter}`,
      sectorMacro: hub.sectorMacro,
      jumpRange: prefJumpRange,
      originalJumpRange: prefJumpRange,
      coverageSectorMacros: coverage,
      connectedGroupIds: [],
      disabledCoverageSectorMacros: [],
      disabledConnectedGroupIds: [],
      isNew: true,
      recalcState: 'normal',
      hubScore: hub.score,
      hubStationCode: hub.stationCode
    })
    assignedSectors.set(hub.sectorMacro, groupId)
    occupiedSectors.add(hub.sectorMacro)
    coverage.forEach((m) => occupiedSectors.add(m))
  }

  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange)
  let bridgePlans = buildBridgePlanOptions(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, excludedSectorMacros)
  if (bridgePlans.length === 1) {
    const applied = applyBridgePlanToDraft(
      { groups, assignments: [], bridgePlans, playerSectorMacros },
      bridgePlans[0]!,
      prefJumpRange,
      (m) => m,
      sectorGraph,
      sectorClusterMap,
      resolvedBridgeSearchJumpRange
    )
    groups.splice(0, groups.length, ...applied.groups)
    bridgePlans = applied.bridgePlans
  }
  rebuildAssignedSectorsFromGroups()

  for (const sectorMacro of unassignedSectors) {
    if (assignedSectors.has(sectorMacro)) continue
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
    unassignedSectors,
    assignedSectors,
    groups,
    sectorGraph,
    sectorClusterMap
  )
  const syncedGroups = syncSelectedAbsorptionsToCoverage(groups, assignments)

  return { groups: syncedGroups, assignments, bridgePlans, playerSectorMacros }
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
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'exception',
        options: [],
        selectedOptionIndex: null
      }))
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
        assignments.push(withDisplayBucket({
          sectorMacro,
          status: 'uncertain_tie',
          options,
          selectedOptionIndex: null
        }))
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
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'uncertain_extend',
        defaultGroupId: best.groupId,
        options,
        selectedOptionIndex: null
      }))
      continue
    }

    if (extendsRange && best.distance > MAX_UNCERTAIN_JUMP) {
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'standalone',
        options: [{
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        }],
        selectedOptionIndex: 0
      }))
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
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'auto',
        defaultGroupId: alreadyAssignedTo,
        options,
        selectedOptionIndex: 0
      }))
    } else {
      const options: AssignmentOption[] = [{
        type: 'absorb' as const,
        targetGroupId: best.groupId,
        distance: best.distance,
        extendsRange: false,
        resultingGroupSize: uniqueSectors.length
      }]
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'auto',
        defaultGroupId: best.groupId,
        options,
        selectedOptionIndex: 0
      }))
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

function syncSelectedAbsorptionsToCoverage(
  groups: GroupDraftInfo[],
  assignments: SectorAssignment[]
): GroupDraftInfo[] {
  const nextGroups = groups.map((group) => ({ ...group, coverageSectorMacros: [...group.coverageSectorMacros] }))
  const groupById = new Map(nextGroups.map((group) => [group.id, group]))

  for (const assignment of assignments) {
    if (assignment.selectedOptionIndex === null) continue
    const selected = assignment.options[assignment.selectedOptionIndex]
    if (!selected || selected.type !== 'absorb' || !selected.targetGroupId) continue

    for (const group of nextGroups) {
      if (group.id !== selected.targetGroupId) {
        group.coverageSectorMacros = group.coverageSectorMacros.filter((macro) => macro !== assignment.sectorMacro)
      }
    }

    const target = groupById.get(selected.targetGroupId)
    if (!target || target.sectorMacro === assignment.sectorMacro) continue
    if (!target.coverageSectorMacros.includes(assignment.sectorMacro)) {
      target.coverageSectorMacros.push(assignment.sectorMacro)
    }
  }

  return nextGroups
}

function normalizeGroupJumpRanges(
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): GroupDraftInfo[] {
  return groups.map((group) => {
    if (!group.sectorMacro) return group
    let jumpRange = group.originalJumpRange
    for (const sectorMacro of group.coverageSectorMacros) {
      const dist = getDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap)
      if (dist !== null) jumpRange = Math.max(jumpRange, dist)
    }
    return { ...group, jumpRange }
  })
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
  prefJumpRange: number = DEFAULT_JUMP_RANGE,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE
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
  if (targetGroupIdx < 0) return { ...result, groups, assignments: assignments as SectorAssignment[] }

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

  // If standalone group was removed, remove only candidates derived from that standalone group.
  if (removedGroupId) {
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i]!
      if (a.sectorMacro === sectorMacro) continue
      const filteredOptions = a.options.filter((o) => o.sourceGroupId !== removedGroupId)
      if (filteredOptions.length === a.options.length) continue

      let selectedOptionIndex = a.selectedOptionIndex
      if (selectedOptionIndex !== null) {
        const selectedOption = a.options[selectedOptionIndex]
        if (selectedOption?.sourceGroupId === removedGroupId) {
          selectedOptionIndex = findBestOptionIndex(filteredOptions)
        } else {
          const remappedIndex = filteredOptions.findIndex((option) => option === selectedOption)
          selectedOptionIndex = remappedIndex >= 0 ? remappedIndex : findBestOptionIndex(filteredOptions)
        }
      }

      assignments[i] = {
        ...a,
        options: filteredOptions,
        selectedOptionIndex
      }
    }
  }

  groups = normalizeGroupJumpRanges(
    syncSelectedAbsorptionsToCoverage(groups, assignments as SectorAssignment[]),
    sectorGraph,
    sectorClusterMap
  )
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange))

  return { ...result, groups, assignments: assignments as SectorAssignment[] }
}

export function applyStandaloneToResult(
  result: AutoGroupResult,
  sectorMacro: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  prefJumpRange: number,
  getSectorName: (macro: string) => string,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE
): AutoGroupResult {
  const assignments = [...result.assignments]
  const idx = assignments.findIndex((a) => a.sectorMacro === sectorMacro)
  if (idx < 0) return result

  const assignment = assignments[idx]!

  let groups = [...result.groups]

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


  const groupId = `auto_${crypto.randomUUID()}`
  const allSectors = getCoverageSectors(sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap)

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
    disabledCoverageSectorMacros: [],
    disabledConnectedGroupIds: [],
    isNew: true,
    recalcState: 'normal',
    hubScore: undefined
  }

  groups.push(newGroup)
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange))

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

  // Append derived candidates from the new standalone group without removing initial candidates.
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!
    if (a.sectorMacro === sectorMacro) continue
    if (a.status === 'exception') continue

    const dist = getCoverageSectors(sectorMacro, 99, sectorGraph, sectorClusterMap)
      .find((d) => d.sectorMacro === a.sectorMacro)?.distance

    if (dist === undefined || dist > prefJumpRange) continue
    if (a.options.some((option) => option.targetGroupId === groupId)) continue

    const newOpt: AssignmentOption = {
      type: 'absorb' as const,
      targetGroupId: groupId,
      distance: dist,
      extendsRange: false,
      resultingGroupSize: 1,
      source: 'derived_standalone',
      sourceGroupId: groupId
    }

    const opts = [...a.options]
    const si = opts.findIndex((o) => o.type === 'standalone')
    if (si >= 0) opts.splice(si, 0, newOpt)
    else opts.push(newOpt)
    const bestIdx = findBestOptionIndex(opts)
    assignments[i] = { ...a, options: opts, selectedOptionIndex: bestIdx }
  }

  groups = normalizeGroupJumpRanges(
    syncSelectedAbsorptionsToCoverage(groups, assignments as SectorAssignment[]),
    sectorGraph,
    sectorClusterMap
  )

  return { ...result, groups, assignments: assignments as SectorAssignment[] }
}

function findBestOptionIndex(options: AssignmentOption[]): number | null {
  let bestIdx: number | null = null
  let bestDist = Infinity
  let bestExtendsRange = true
  for (let i = 0; i < options.length; i++) {
    const o = options[i]!
    if (o.type !== 'absorb') continue
    if (o.extendsRange && !bestExtendsRange) continue
    if (!o.extendsRange && bestExtendsRange) {
      bestDist = o.distance
      bestExtendsRange = false
      bestIdx = i
      continue
    }
    if (o.distance < bestDist) {
      bestDist = o.distance
      bestIdx = i
    }
  }
  if (bestIdx !== null) return bestIdx
  const standaloneIdx = options.findIndex((o) => o.type === 'standalone')
  return standaloneIdx >= 0 ? standaloneIdx : null
}
