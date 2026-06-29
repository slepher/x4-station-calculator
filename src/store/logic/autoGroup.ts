import type { SectorReachability, X4Module } from '@/types/x4'
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
  getReachableCoverageSectors,
  getReachableDistance,
  getSaveSectorsWithPlayerStations,
  getPlayerStationsInSector
} from './saveBindingUtils'
import { stabilizeHubColors, stabilizeEditedHubColor, type HubColorContext } from './hubColor'
import { selectTradeStationCandidates, determineDefaultTradeStation, type TradeStationCandidate } from './tradeStationSelection'

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
  status: 'auto' | 'uncertain_tie' | 'uncertain_extend' | 'unresolved_no_candidate' | 'standalone' | 'exception'
  displayBucket: 'resolved' | 'unresolved' | 'unpin'
  defaultGroupId?: string
  options: AssignmentOption[]
  selectedSectorMacro?: string | null
  selectedOptionIndex: number | null
  unpinOrder?: number
}

export interface GroupDraftInfo {
  id: string
  name: string
  sectorMacro?: string
  jumpRange: number
  originalJumpRange: number
  coverageSectorMacros: string[]
  connectedGroupIds: string[]
  excludedDefaultAssignmentSectorMacros: string[]
  isNew: boolean
  isPinned: boolean
  coverageRetainEnabled: boolean
  connectionRetainEnabled: boolean
  hubScore?: number
  hubStationCode?: string
  savedTradeStationCode?: string
  tradeStationRetainEnabled?: boolean
  selectedTradeStation?: { type: 'player' | 'virtual'; stationCode: string } | null
  virtualTradeStationPosition?: { x: number; y: number; z: number }
  source?: 'auto' | 'manual' | 'bridge'
  color?: string
  baseline?: boolean
  enteredOtherGroupCoverage?: boolean
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
  sectorStationCandidates?: Record<string, TradeStationCandidate[]>
}

export function buildSectorStationCandidates(
  sectorStationMap: Map<string, PlayerStationEntry[]>,
  modulesByMacroId: Record<string, X4Module>,
  config: HubDetectionConfig
): Record<string, TradeStationCandidate[]> {
  const result: Record<string, TradeStationCandidate[]> = {}
  for (const [sectorMacro, stations] of sectorStationMap) {
    if (stations.length === 0) {
      result[sectorMacro] = []
      continue
    }
    result[sectorMacro] = selectTradeStationCandidates(stations, modulesByMacroId, false, config)
  }
  return result
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

export function getDistance(
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
  return Math.min(MAX_UNCERTAIN_JUMP, Math.max(groupCoverageJumpRange, bridgeSearchJumpRange))
}

function clampTransportJumpRange(value: number): number {
  return Math.max(0, Math.min(MAX_UNCERTAIN_JUMP, value))
}

function getTransportDistance(
  from: string,
  to: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): number | null {
  if (sectorReachability) {
    return getReachableDistance(sectorReachability, from, to)
  }
  const distance = getDistance(from, to, sectorGraph, sectorClusterMap)
  return distance !== null && distance <= MAX_UNCERTAIN_JUMP ? distance : null
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

function getOptionSelectedSectorMacro(assignmentSectorMacro: string, option: AssignmentOption | undefined): string | null {
  if (!option) return null
  if (option.type === 'standalone') return assignmentSectorMacro
  return option.targetGroupId ?? null
}

function findOptionIndexBySelectedSectorMacro(
  assignmentSectorMacro: string,
  options: AssignmentOption[],
  selectedSectorMacro: string | null | undefined
): number | null {
  if (!selectedSectorMacro) return null
  const index = options.findIndex((option) => getOptionSelectedSectorMacro(assignmentSectorMacro, option) === selectedSectorMacro)
  return index >= 0 ? index : null
}

function getAssignmentSelectedSectorMacro(assignment: SectorAssignment): string | null {
  if (assignment.selectedSectorMacro !== undefined) return assignment.selectedSectorMacro
  if (assignment.selectedOptionIndex === null) return null
  return getOptionSelectedSectorMacro(assignment.sectorMacro, assignment.options[assignment.selectedOptionIndex])
}

function getSelectedOption(assignment: SectorAssignment): AssignmentOption | undefined {
  const selectedIndex = findOptionIndexBySelectedSectorMacro(
    assignment.sectorMacro,
    assignment.options,
    getAssignmentSelectedSectorMacro(assignment)
  )
  if (selectedIndex !== null) return assignment.options[selectedIndex]
  if (assignment.selectedOptionIndex === null) return undefined
  return assignment.options[assignment.selectedOptionIndex]
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
  maxDistance: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  sectorReachability?: SectorReachability
): void {
  const effectiveMaxDistance = clampTransportJumpRange(maxDistance)
  // Save existing connections to preserve as fixed edges
  const fixedConnections: Array<{ a: number; b: number }> = []
  const idToIndex = new Map(groups.map((g, i) => [g.id, i]))
  for (const group of groups) {
    for (const connId of group.connectedGroupIds) {
      const ai = idToIndex.get(group.id)
      const bi = idToIndex.get(connId)
      if (ai !== undefined && bi !== undefined && ai < bi) {
        fixedConnections.push({ a: ai, b: bi })
      }
    }
  }

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
      const dist = getTransportDistance(a.group.sectorMacro!, b.group.sectorMacro!, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist === null || dist > effectiveMaxDistance) continue
      const ids = [a.group.id, b.group.id].sort()
      edges.push({ a: a.index, b: b.index, weight: dist, key: `${ids[0]}:${ids[1]}` })
    }
  }

  edges.sort((a, b) => a.weight - b.weight || a.key.localeCompare(b.key))
  const uf = new UnionFind(groups.length)

  // Pre-union fixed connections (user-edited or existing)
  for (const fc of fixedConnections) {
    uf.union(fc.a, fc.b)
  }

  for (const edge of edges) {
    if (!uf.union(edge.a, edge.b)) continue
    const ga = groups[edge.a]!
    const gb = groups[edge.b]!
    ga.connectedGroupIds = [...new Set([...ga.connectedGroupIds, gb.id])]
    gb.connectedGroupIds = [...new Set([...gb.connectedGroupIds, ga.id])]
  }

  // Re-apply fixed connections (user-edited or existing)
  for (const fc of fixedConnections) {
    const ga = groups[fc.a]!
    const gb = groups[fc.b]!
    if (!ga.connectedGroupIds.includes(gb.id)) {
      ga.connectedGroupIds.push(gb.id)
    }
    if (!gb.connectedGroupIds.includes(ga.id)) {
      gb.connectedGroupIds.push(ga.id)
    }
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

  // Build map: cluster → list of hub anchor sectors in that cluster
  const hubAnchorsByCluster = new Map<string, string[]>()
  for (const anchor of anchorSectors) {
    const cid = sectorClusterMap[anchor]
    if (!cid) continue
    if (!hubAnchorsByCluster.has(cid)) hubAnchorsByCluster.set(cid, [])
    hubAnchorsByCluster.get(cid)!.push(anchor)
  }

  // Exclude candidates that are in the same cluster as a hub AND reachable within the cluster
  const candidates = playerSectorMacros.filter((sector) => {
    if (anchorSectors.has(sector)) return false
    if (excludedSectorMacros.has(sector)) return false
    const cid = sectorClusterMap[sector]
    if (!cid) return true
    const hubs = hubAnchorsByCluster.get(cid)
    if (!hubs || hubs.length === 0) return true
    // Check if any hub in same cluster is reachable within the cluster
    for (const hub of hubs) {
      // BFS within same cluster to check reachability
      const visitedBfs = new Set<string>()
      const queue = [sector]
      visitedBfs.add(sector)
      let found = false
      for (let qi = 0; qi < queue.length && !found; qi++) {
        const cur = queue[qi]!
        for (const nxt of sectorGraph[cur] || []) {
          if (visitedBfs.has(nxt)) continue
          // Only traverse within same cluster
          if ((sectorClusterMap[nxt] || nxt) !== cid) continue
          visitedBfs.add(nxt)
          queue.push(nxt)
          if (nxt === hub) {
            found = true
            break
          }
        }
      }
      if (found) return false // Reachable → exclude
    }
    return true // Not reachable (superhighway split) → keep
  })
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
  bridgeSearchJumpRange: number,
  sectorReachability?: SectorReachability
): BridgePlanOption | null {
  const effectiveBridgeSearchJumpRange = clampTransportJumpRange(bridgeSearchJumpRange)
  const nodes: Array<{ id: string; kind: 'component' | 'unit'; label: string; sectorMacros: string[]; componentIndex?: number; unit?: BridgePlanUnit }> = []

  for (let i = 0; i < components.length; i++) {
    const compGroups = components[i]!
    const anchors = compGroups
      .map((gi) => groups[gi]!.sectorMacro)
      .filter(Boolean) as string[]
    if (anchors.length === 0) continue
    nodes.push({
      id: `component_${i}`,
      kind: 'component',
      label: groups[compGroups[0]!]!.name,
      sectorMacros: anchors,
      componentIndex: i
    })
  }

  for (const unit of units) {
    nodes.push({
      id: unit.unitId,
      kind: 'unit',
      label: unit.label,
      sectorMacros: [unit.selectedSectorMacro],
      unit
    })
  }

  const edges: Array<{ a: number; b: number; weight: number; key: string }> = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let minDist: number | null = null
      for (const mi of nodes[i]!.sectorMacros) {
        for (const mj of nodes[j]!.sectorMacros) {
          const dist = getTransportDistance(mi, mj, sectorGraph, sectorClusterMap, sectorReachability)
          if (dist !== null && (minDist === null || dist < minDist)) {
            minDist = dist
          }
        }
      }
      if (minDist === null || minDist > effectiveBridgeSearchJumpRange) continue
      const ids = [nodes[i]!.id, nodes[j]!.id].sort()
      edges.push({ a: i, b: j, weight: minDist, key: `${ids[0]}:${ids[1]}` })
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
      unitMap.get(a.id)?.reaches.push({ nodeId: b.id, label: b.label, sectorMacro: b.sectorMacros[0]!, jump: edge.weight })
    }
    if (b.kind === 'unit') {
      unitMap.get(b.id)?.reaches.push({ nodeId: a.id, label: a.label, sectorMacro: a.sectorMacros[0]!, jump: edge.weight })
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
  excludedSectorMacros: string[] = [],
  sectorReachability?: SectorReachability
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
    const plan = buildPlanFromUnits(plans.length, groups, components, combo, sectorGraph, sectorClusterMap, bridgeSearchJumpRange, sectorReachability)
    if (!plan) continue
    seen.add(stableKey)
    plans.push(plan)
  }

  if (plans.length === 0) return []

  const maxConnectedComponentCount = Math.max(...plans.map((plan) => plan.connectedComponentCount))
  const bestCoveragePlans = plans.filter((plan) => plan.connectedComponentCount === maxConnectedComponentCount)

  // Keep only plans with the minimum unit count at max cc
  const minUnitCount = Math.min(...bestCoveragePlans.map((plan) => plan.units.length))
  const minimalPlans = bestCoveragePlans.filter((plan) => plan.units.length === minUnitCount)

  minimalPlans.sort((a, b) =>
    b.planScore - a.planScore ||
    a.totalJump - b.totalJump ||
    a.maxJump - b.maxJump ||
    a.units.length - b.units.length ||
    a.stableKey.localeCompare(b.stableKey)
  )

  return minimalPlans.slice(0, 5).map((plan, index) => ({
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
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  colorCtx?: HubColorContext,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const existingAnchors = new Set(result.groups.map((g) => g.sectorMacro).filter(Boolean) as string[])
  const bridgeGroups: GroupDraftInfo[] = []

  for (const unit of plan.units) {
    if (existingAnchors.has(unit.selectedSectorMacro)) continue
    existingAnchors.add(unit.selectedSectorMacro)
    bridgeGroups.push({
      id: unit.selectedSectorMacro,
      name: getSectorName(unit.selectedSectorMacro),
      sectorMacro: unit.selectedSectorMacro,
      jumpRange: prefJumpRange,
      originalJumpRange: prefJumpRange,
      coverageSectorMacros: [],
      connectedGroupIds: [],
      excludedDefaultAssignmentSectorMacros: [],
      isNew: true,
      isPinned: true,
      coverageRetainEnabled: true,
      connectionRetainEnabled: true,
      hubScore: selectedUnitScore(unit),
      source: 'bridge'
    })
  }

  const groups = [...result.groups, ...bridgeGroups]
  if (colorCtx) {
    for (const group of bridgeGroups) {
      stabilizeEditedHubColor(group, groups, colorCtx)
    }
  }
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange), sectorReachability)
  const assignedSectors = new Map<string, string>()
  for (const group of groups) {
    if (group.sectorMacro) assignedSectors.set(group.sectorMacro, group.id)
  }
  const assignments = buildAssignmentResult(
    result.playerSectorMacros,
    assignedSectors,
    groups,
    sectorGraph,
    sectorClusterMap,
    sectorReachability
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
  excludedSectorMacros: string[] = [],
  generateHubs: boolean = true,
  sectorReachability?: SectorReachability
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
  if (generateHubs) {
    for (const hub of pureHubs) {
      const sectorMacro = hub.sectorMacro
      if (assignedSectors.has(sectorMacro)) continue

      const groupId = sectorMacro
      const allCoverage = getSectorCoverageMacros(sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap, sectorReachability)
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
        excludedDefaultAssignmentSectorMacros: [],
        isNew: true,
        isPinned: true,
      coverageRetainEnabled: true,
      connectionRetainEnabled: true,
        hubScore: hub.score,
        hubStationCode: hub.stationCode,
        savedTradeStationCode: hub.stationCode,
        source: 'auto'
      }
      groups.push(group)
      groupMap.set(groupId, group)
      assignedSectors.set(sectorMacro, groupId)
      // Anchor is always occupied by its own group
      occupiedSectors.add(sectorMacro)
      coverage.forEach((m) => occupiedSectors.add(m))
    }
  }

  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, sectorReachability)
  let bridgePlans = buildBridgePlanOptions(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, excludedSectorMacros, sectorReachability)
  if (bridgePlans.length === 1) {
    const applied = applyBridgePlanToDraft(
      { groups, assignments: [], bridgePlans, playerSectorMacros },
      bridgePlans[0]!,
      prefJumpRange,
      (m) => m,
      sectorGraph,
      sectorClusterMap,
      resolvedBridgeSearchJumpRange,
      undefined,
      sectorReachability
    )
    groups.splice(0, groups.length, ...applied.groups)
    bridgePlans = applied.bridgePlans
    for (const group of groups) {
      if (group.source === 'bridge' && group.sectorMacro) {
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
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist !== null && dist <= clampTransportJumpRange(group.jumpRange)) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: clampTransportJumpRange(group.jumpRange),
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
        const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
        if (dist !== null && dist <= clampTransportJumpRange(group.jumpRange)) {
          candidates.push({
            groupId: group.id,
            distance: dist,
            jumpRange: clampTransportJumpRange(group.jumpRange),
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
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: clampTransportJumpRange(group.jumpRange),
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
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: clampTransportJumpRange(group.jumpRange),
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
    sectorClusterMap,
    sectorReachability
  )
  const syncedGroups = syncSelectedAbsorptionsToCoverage(groups, assignments)

  const sectorStationCandidates = buildSectorStationCandidates(sectorStationMap, modulesByMacroId, config)

  return { groups: syncedGroups, assignments, bridgePlans, playerSectorMacros, sectorStationCandidates }
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
  excludedSectorMacros: string[] = [],
  generateHubs: boolean = true,
  sectorReachability?: SectorReachability
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
    id: group.sectorMacro || '',
    name: group.name,
    sectorMacro: group.sectorMacro,
    jumpRange: group.jumpRange,
    originalJumpRange: group.jumpRange,
    coverageSectorMacros: group.coverageSectorMacros.map((c) => c.ref),
    connectedGroupIds: [...(group.connectedGroupIds || [])],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
      coverageRetainEnabled: true,
      connectionRetainEnabled: true,
    hubScore: undefined,
    color: group.color
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

  if (generateHubs) {
    const pureHubs: SectorPureHub[] = []
    for (const sectorMacro of playerSectorMacros) {
      if (excludedSectorSet.has(sectorMacro)) continue
      if (existingAnchors.has(sectorMacro)) continue
      const hub = getSectorPureHub(sectorMacro, sectorStationMap.get(sectorMacro) || [], modulesByMacroId, config)
      if (hub) pureHubs.push(hub)
    }
    pureHubs.sort((a, b) => b.score - a.score)

    const pureHubAnchors = new Set(pureHubs.map((h) => h.sectorMacro))
    const occupiedSectors = new Set(existingAnchors)
    let groupCounter = groups.length
    for (const hub of pureHubs) {
      if (occupiedSectors.has(hub.sectorMacro)) continue
      const groupId = hub.sectorMacro
      const allCoverage = getSectorCoverageMacros(hub.sectorMacro, prefJumpRange, sectorGraph, sectorClusterMap, sectorReachability)
      const coverage = allCoverage.filter((m) =>
        playerSectorMacros.includes(m) &&
        !occupiedSectors.has(m) &&
        m !== hub.sectorMacro &&
          !pureHubAnchors.has(m)
      )
      for (let i = 0; i < groups.length; i++) {
        groups[i] = {
          ...groups[i]!,
          coverageSectorMacros: groups[i]!.coverageSectorMacros.filter((sectorMacro) => sectorMacro !== hub.sectorMacro)
        }
      }
      groups.push({
        id: groupId,
        name: `Sector ${++groupCounter}`,
        sectorMacro: hub.sectorMacro,
        jumpRange: prefJumpRange,
        originalJumpRange: prefJumpRange,
        coverageSectorMacros: coverage,
        connectedGroupIds: [],
        excludedDefaultAssignmentSectorMacros: [],
        isNew: true,
        isPinned: true,
      coverageRetainEnabled: true,
      connectionRetainEnabled: true,
        hubScore: hub.score,
        hubStationCode: hub.stationCode,
        savedTradeStationCode: hub.stationCode,
        source: 'auto'
      })
      assignedSectors.set(hub.sectorMacro, groupId)
      occupiedSectors.add(hub.sectorMacro)
      coverage.forEach((m) => occupiedSectors.add(m))
    }
  }

  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, sectorReachability)
  let bridgePlans = buildBridgePlanOptions(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, resolvedBridgeSearchJumpRange, excludedSectorMacros, sectorReachability)
  if (bridgePlans.length === 1) {
    const applied = applyBridgePlanToDraft(
      { groups, assignments: [], bridgePlans, playerSectorMacros },
      bridgePlans[0]!,
      prefJumpRange,
      (m) => m,
      sectorGraph,
      sectorClusterMap,
      resolvedBridgeSearchJumpRange,
      undefined,
      sectorReachability
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
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: clampTransportJumpRange(group.jumpRange)
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
    sectorClusterMap,
    sectorReachability
  )
  const syncedGroups = syncSelectedAbsorptionsToCoverage(groups, assignments)

  const sectorStationCandidates = buildSectorStationCandidates(sectorStationMap, modulesByMacroId, config)

  return { groups: syncedGroups, assignments, bridgePlans, playerSectorMacros, sectorStationCandidates }
}

function getSectorCoverageMacros(
  sectorMacro: string,
  jumpRange: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): string[] {
  const effectiveJumpRange = clampTransportJumpRange(jumpRange)
  const results = getReachableCoverageSectors(sectorReachability, sectorMacro, effectiveJumpRange)
    || getCoverageSectors(sectorMacro, effectiveJumpRange, sectorGraph, sectorClusterMap)
  return results.map((r) => r.sectorMacro)
}

export function buildAssignmentResult(
  unassignedSectors: string[],
  assignedSectors: Map<string, string>,
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): SectorAssignment[] {
  const assignments: SectorAssignment[] = []
  const allSectors = [...unassignedSectors, ...Array.from(assignedSectors.keys())]
  const uniqueSectors = [...new Set(allSectors)]

  const anchorSectors = new Set(groups.map((g) => g.sectorMacro).filter(Boolean) as string[])

  for (const sectorMacro of uniqueSectors) {
    // Hub anchors don't generate assignment cards
    if (anchorSectors.has(sectorMacro)) continue

    const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
    for (const group of groups) {
      if (!group.sectorMacro) continue
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
      if (dist !== null) {
        candidates.push({
          groupId: group.id,
          distance: dist,
          jumpRange: clampTransportJumpRange(group.jumpRange),
          score: group.hubScore
        })
      }
    }

    if (candidates.length === 0) {
      assignments.push(withDisplayBucket({
        sectorMacro,
        status: 'unresolved_no_candidate',
        options: [{
          type: 'standalone' as const,
          distance: 0,
          extendsRange: false,
          resultingGroupSize: 1
        }],
        selectedSectorMacro: null,
        selectedOptionIndex: null
      }))
      continue
    }

    // Split candidates: current-range hits vs extension hits
    const currentRangeHits = candidates.filter((g) => g.distance <= g.jumpRange)
    let optionsSource = currentRangeHits

    if (currentRangeHits.length === 0) {
      // Only minimum extension distance groups become options
      const minDist = Math.min(...candidates.map((g) => g.distance))
      optionsSource = minDist <= MAX_UNCERTAIN_JUMP
        ? candidates.filter((g) => g.distance === minDist)
        : []
    }

    // Build options from all hit groups
    const sortedByDist = [...optionsSource].sort((a, b) => a.distance - b.distance)
    const options: AssignmentOption[] = sortedByDist.map((g) => ({
      type: 'absorb' as const,
      targetGroupId: g.groupId,
      distance: g.distance,
      extendsRange: g.distance > g.jumpRange,
      resultingGroupSize: uniqueSectors.length
    }))

    // Add standalone as last option
    const noStandalone = !options.some((o) => o.type === 'standalone')
    if (noStandalone) {
      options.push({
        type: 'standalone' as const,
        distance: 0,
        extendsRange: false,
        resultingGroupSize: 1
      })
    }

    // Determine default option
    let defaultOptionIndex: number | null = null
    if (currentRangeHits.length > 0) {
      // Find best current-range hit that is NOT excluded default
      const eligibleDefaults = currentRangeHits
        .filter((g) => {
          const group = groups.find((grp) => grp.id === g.groupId)
          return group && !group.excludedDefaultAssignmentSectorMacros.includes(sectorMacro)
        })
      if (eligibleDefaults.length > 0) {
        // Score tie check among same-distance eligible defaults
        const bestEligible = eligibleDefaults.sort((a, b) => a.distance - b.distance)[0]!
        const sameDistEligible = eligibleDefaults.filter((g) => g.distance === bestEligible.distance)

        let hasDefault = true
        if (sameDistEligible.length > 1) {
          const scores = sameDistEligible.filter((g) => g.score !== undefined).map((g) => g.score!)
          if (scores.length === sameDistEligible.length) {
            const maxScore = Math.max(...scores)
            const hasScoreTie = scores.some((s) => s !== maxScore && (maxScore - s) / maxScore < SCORE_TIE_THRESHOLD)
            if (hasScoreTie) hasDefault = false
          }
        }

        if (hasDefault) {
          defaultOptionIndex = options.findIndex((o) => o.targetGroupId === bestEligible.groupId)
          if (defaultOptionIndex < 0) defaultOptionIndex = null
        }
      }
    }

    const isUncertain = defaultOptionIndex === null && optionsSource.length > 0
    const status = isUncertain
      ? (currentRangeHits.length > 0 ? 'uncertain_tie' : 'uncertain_extend')
      : (defaultOptionIndex !== null ? 'auto' : 'unresolved_no_candidate')

    const defaultGroupId = defaultOptionIndex !== null
      ? options[defaultOptionIndex]?.targetGroupId
      : undefined

    assignments.push(withDisplayBucket({
      sectorMacro,
      status: status as SectorAssignment['status'],
      defaultGroupId,
      options,
      selectedSectorMacro: defaultGroupId ?? null,
      selectedOptionIndex: defaultOptionIndex
    }))
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
    const selected = getSelectedOption(assignment)
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
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): GroupDraftInfo[] {
  return groups.map((group) => {
    if (!group.sectorMacro) return group
    let jumpRange = clampTransportJumpRange(group.originalJumpRange)
    for (const sectorMacro of group.coverageSectorMacros) {
      const dist = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
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
  const selectedSectorMacro = getOptionSelectedSectorMacro(assignment.sectorMacro, assignment.options[optionIndex])
  return {
    ...assignment,
    selectedSectorMacro,
    selectedOptionIndex: optionIndex,
    status: 'auto'
  }
}

function buildStandaloneSelectedAssignment(
  sectorMacro: string,
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  unpinOrder?: number,
  sectorReachability?: SectorReachability
): SectorAssignment {
  const candidateGroups = groups.filter((group) => group.sectorMacro !== sectorMacro)
  const candidates: Array<{ groupId: string; distance: number; jumpRange: number; score?: number }> = []
  for (const group of candidateGroups) {
    if (!group.sectorMacro) continue
    const distance = getTransportDistance(group.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
    if (distance === null) continue
    candidates.push({
      groupId: group.id,
      distance,
      jumpRange: clampTransportJumpRange(group.jumpRange),
      score: group.hubScore
    })
  }

  const currentRangeHits = candidates.filter((candidate) => candidate.distance <= candidate.jumpRange)
  let optionsSource = currentRangeHits
  if (optionsSource.length === 0 && candidates.length > 0) {
    const minDistance = Math.min(...candidates.map((candidate) => candidate.distance))
    if (minDistance <= MAX_UNCERTAIN_JUMP) {
      optionsSource = candidates.filter((candidate) => candidate.distance === minDistance)
    }
  }
  const sortedOptionsSource = [...optionsSource].sort((a, b) => a.distance - b.distance)
  const options: AssignmentOption[] = [
    ...sortedOptionsSource.map((candidate) => ({
      type: 'absorb' as const,
      targetGroupId: candidate.groupId,
      distance: candidate.distance,
      extendsRange: candidate.distance > candidate.jumpRange,
      resultingGroupSize: groups.length
    })),
    {
      type: 'standalone',
      distance: 0,
      extendsRange: false,
      resultingGroupSize: 1
    }
  ]
  const standaloneIndex = options.findIndex((option) => option.type === 'standalone')
  return {
    sectorMacro,
    status: 'standalone',
    displayBucket: 'unpin',
    options,
    selectedSectorMacro: sectorMacro,
    selectedOptionIndex: standaloneIndex,
    unpinOrder
  }
}

export function sortAssignmentsForDisplay(
  assignments: SectorAssignment[],
  _groups: GroupDraftInfo[]
): SectorAssignment[] {
  const order: Record<string, number> = {
    unpin: 0,
    unresolved: 1,
    resolved: 2
  }

  return [...assignments]
    .sort((a, b) => {
      const aOrder = order[a.displayBucket] ?? 9
      const bOrder = order[b.displayBucket] ?? 9
      if (aOrder !== bOrder) return aOrder - bOrder
      if (a.displayBucket === 'unpin' && b.displayBucket === 'unpin') {
        return (a.unpinOrder ?? 0) - (b.unpinOrder ?? 0)
      }
      return 0
    })
}

export function normalizeReappearedUnpinnedHubs(
  result: AutoGroupResult,
  previouslyUnpinnedSectorMacros: Set<string>
): AutoGroupResult {
  if (previouslyUnpinnedSectorMacros.size === 0) return result
  const reappearedAnchors = new Set(
    result.groups
      .map((group) => group.sectorMacro)
      .filter((sectorMacro): sectorMacro is string => !!sectorMacro && previouslyUnpinnedSectorMacros.has(sectorMacro))
  )
  if (reappearedAnchors.size === 0) return result

  return {
    ...result,
    groups: result.groups.map((group) =>
      group.sectorMacro && reappearedAnchors.has(group.sectorMacro)
        ? { ...group, isPinned: true }
        : group
    ),
    assignments: result.assignments.filter((assignment) => !reappearedAnchors.has(assignment.sectorMacro))
  }
}

export function setGroupPinnedInResult(
  result: AutoGroupResult,
  groupId: string,
  isPinned: boolean,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const group = result.groups.find((candidate) => candidate.id === groupId)
  if (!group?.sectorMacro) return result

  const sectorMacro = group.sectorMacro
  const groups = result.groups.map((candidate) =>
    candidate.id === groupId ? { ...candidate, isPinned } : candidate
  )

  if (isPinned) {
    return {
      ...result,
      groups,
      assignments: result.assignments.filter((assignment) => assignment.sectorMacro !== sectorMacro)
    }
  }

  if (result.assignments.some((assignment) => assignment.sectorMacro === sectorMacro)) {
    return { ...result, groups }
  }
  const nextUnpinOrder = Math.max(0, ...result.assignments.map((assignment) => assignment.unpinOrder ?? 0)) + 1

  return {
    ...result,
    groups,
    assignments: [
      ...result.assignments,
      buildStandaloneSelectedAssignment(sectorMacro, groups, sectorGraph, sectorClusterMap, nextUnpinOrder, sectorReachability)
    ]
  }
}

export function applyAbsorbToResult(
  result: AutoGroupResult,
  sectorMacro: string,
  optionIndex: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  prefJumpRange: number = DEFAULT_JUMP_RANGE,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const assignments = [...result.assignments]
  const idx = assignments.findIndex((a) => a.sectorMacro === sectorMacro)
  if (idx < 0) return result

  const assignment = assignments[idx]!
  const opt = assignment.options[optionIndex]!
  if (opt.type !== 'absorb' || !opt.targetGroupId) return result

  assignments[idx] = resolveUncertainAssignment(assignment, optionIndex)

  let groups = [...result.groups]

  const removedGroupIds = new Set(
    groups
      .filter((g) => g.sectorMacro === sectorMacro && g.id !== opt.targetGroupId)
      .map((g) => g.id)
  )
  if (removedGroupIds.size > 0) {
    groups = groups
      .filter((g) => !removedGroupIds.has(g.id))
      .map((g) => ({
        ...g,
        connectedGroupIds: g.connectedGroupIds.filter((id) => !removedGroupIds.has(id))
      }))
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
    const dist = getTransportDistance(g.sectorMacro, sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
    if (dist !== null && dist > newJumpRange) {
      newJumpRange = dist
    }
  }

  groups[targetGroupIdx] = { ...g, jumpRange: newJumpRange, coverageSectorMacros: newCoverage }

  if (removedGroupIds.size > 0) {
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i]!
      if (a.sectorMacro === sectorMacro) continue
      const filteredOptions = a.options.filter((o) =>
        (o.sourceGroupId === undefined || !removedGroupIds.has(o.sourceGroupId)) &&
        (o.targetGroupId === undefined || !removedGroupIds.has(o.targetGroupId))
      )
      if (filteredOptions.length === a.options.length) continue

      let selectedOptionIndex = a.selectedOptionIndex
      let selectedSectorMacro = getAssignmentSelectedSectorMacro(a)
      if (selectedOptionIndex !== null) {
        const selectedOption = a.options[selectedOptionIndex]
        if (
          (selectedOption?.sourceGroupId !== undefined && removedGroupIds.has(selectedOption.sourceGroupId)) ||
          (selectedOption?.targetGroupId !== undefined && removedGroupIds.has(selectedOption.targetGroupId))
        ) {
          selectedOptionIndex = findBestOptionIndex(filteredOptions)
          selectedSectorMacro = selectedOptionIndex === null
            ? null
            : getOptionSelectedSectorMacro(a.sectorMacro, filteredOptions[selectedOptionIndex])
        } else {
          const remappedIndex = filteredOptions.findIndex((option) => option === selectedOption)
          selectedOptionIndex = remappedIndex >= 0 ? remappedIndex : findBestOptionIndex(filteredOptions)
          selectedSectorMacro = selectedOptionIndex === null
            ? null
            : getOptionSelectedSectorMacro(a.sectorMacro, filteredOptions[selectedOptionIndex])
        }
      }

      assignments[i] = {
        ...a,
        options: filteredOptions,
        selectedSectorMacro,
        selectedOptionIndex
      }
    }
  }

  groups = normalizeGroupJumpRanges(
    syncSelectedAbsorptionsToCoverage(groups, assignments as SectorAssignment[]),
    sectorGraph,
    sectorClusterMap,
    sectorReachability
  )
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange), sectorReachability)

  if (opt.extendsRange) {
    return rebuildAssignmentsForJumpRangeChange(
      { ...result, groups, assignments: assignments as SectorAssignment[] },
      opt.targetGroupId, newJumpRange, sectorGraph, sectorClusterMap,
      g.jumpRange, true, sectorReachability
    )
  }

  return { ...result, groups, assignments: assignments as SectorAssignment[] }
}

export function applyStandaloneToResult(
  result: AutoGroupResult,
  sectorMacro: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  prefJumpRange: number,
  getSectorName: (macro: string) => string,
  bridgeSearchJumpRange: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE,
  colorCtx?: HubColorContext,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const assignments = [...result.assignments]
  const idx = assignments.findIndex((a) => a.sectorMacro === sectorMacro)
  if (idx < 0) return result

  const assignment = assignments[idx]!

  let groups = [...result.groups]
  const existingGroup = result.groups.find((g) => g.sectorMacro === sectorMacro)
  const standaloneIdx = assignment.options.findIndex((o) => o.type === 'standalone')
  if (
    existingGroup &&
    standaloneIdx >= 0 &&
    assignment.selectedOptionIndex === standaloneIdx &&
    assignment.status === 'standalone'
  ) {
    return result
  }

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


  // Reuse existing standalone group ID if one already exists for this sector
  const groupId = existingGroup ? existingGroup.id : sectorMacro
  const allSectors = getReachableCoverageSectors(sectorReachability, sectorMacro, clampTransportJumpRange(prefJumpRange))
    || getCoverageSectors(sectorMacro, clampTransportJumpRange(prefJumpRange), sectorGraph, sectorClusterMap)

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
    excludedDefaultAssignmentSectorMacros: [],
    isNew: true,
    isPinned: false,
      coverageRetainEnabled: true,
      connectionRetainEnabled: true,
      tradeStationRetainEnabled: true,
      hubScore: undefined
  }

  const existingGroupIndex = groups.findIndex((group) => group.sectorMacro === sectorMacro)
  if (existingGroupIndex >= 0) {
    groups[existingGroupIndex] = {
      ...newGroup,
      connectedGroupIds: groups[existingGroupIndex]!.connectedGroupIds,
      color: groups[existingGroupIndex]!.color,
      savedTradeStationCode: groups[existingGroupIndex]!.savedTradeStationCode,
      selectedTradeStation: groups[existingGroupIndex]!.selectedTradeStation,
      virtualTradeStationPosition: groups[existingGroupIndex]!.virtualTradeStationPosition,
      tradeStationRetainEnabled: groups[existingGroupIndex]!.tradeStationRetainEnabled
    }
    if (colorCtx) stabilizeEditedHubColor(groups[existingGroupIndex]!, groups, colorCtx)
  } else {
    groups.push(newGroup)
    if (colorCtx) stabilizeEditedHubColor(newGroup, groups, colorCtx)
  }
  computeGroupGraph(groups, sectorGraph, sectorClusterMap, resolveBridgeSearchJumpRange(prefJumpRange, bridgeSearchJumpRange), sectorReachability)

  // Select standalone option, keep card visible
  assignments[idx] = {
    ...assignment,
    selectedSectorMacro: sectorMacro,
    selectedOptionIndex: standaloneIdx >= 0 ? standaloneIdx : assignment.options.length,
    status: 'standalone'
  }

  // Remove this sector from other groups' coverage
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.sectorMacro === sectorMacro) continue
    groups[i] = { ...groups[i]!, coverageSectorMacros: groups[i]!.coverageSectorMacros.filter((m) => m !== sectorMacro) }
  }

  // Append derived candidates from the new standalone group without removing initial candidates.
  const newGroupRef = groups.find((g) => g.id === groupId)
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!
    if (a.sectorMacro === sectorMacro) continue
    if (a.status === 'exception') continue

    const dist = getTransportDistance(sectorMacro, a.sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)

    if (dist === null) continue
    if (dist > MAX_UNCERTAIN_JUMP) continue
    if (a.options.some((option) => option.targetGroupId === groupId)) continue
    if (dist > prefJumpRange && a.options.some((o) => o.type === 'absorb' && !o.extendsRange)) continue

    const newOpt: AssignmentOption = {
      type: 'absorb' as const,
      targetGroupId: groupId,
      distance: dist,
      extendsRange: dist > prefJumpRange,
      resultingGroupSize: 1,
      source: 'derived_standalone',
      sourceGroupId: groupId
    }

    const opts = [...a.options]
    const previousSelectedSectorMacro = getAssignmentSelectedSectorMacro(a)
    const si = opts.findIndex((o) => o.type === 'standalone')
    if (si >= 0) opts.splice(si, 0, newOpt)
    else opts.push(newOpt)
    const newOptIdx = opts.indexOf(newOpt)

    let nextSelected = findOptionIndexBySelectedSectorMacro(a.sectorMacro, opts, previousSelectedSectorMacro)
    let nextStatus = a.status

    if (!newOpt.extendsRange) {
      const currentSelected = nextSelected !== null ? opts[nextSelected] : null
      if (currentSelected && currentSelected.type === 'absorb' && !currentSelected.extendsRange) {
        const newIsCloser = newOpt.distance < currentSelected.distance
        const sameDist = newOpt.distance === currentSelected.distance
        const newScore = newGroupRef?.hubScore
        const currentGroup = groups.find((g) => g.id === currentSelected.targetGroupId)
        const currentScore = currentGroup?.hubScore
        const newIsBetterScore = sameDist && newScore !== undefined && currentScore !== undefined && newScore > currentScore * (1 + SCORE_TIE_THRESHOLD)
        const isTie = sameDist && newScore !== undefined && currentScore !== undefined && Math.abs(newScore - currentScore) / Math.max(newScore, currentScore) < SCORE_TIE_THRESHOLD
        if (newIsCloser || newIsBetterScore) {
          nextSelected = newOptIdx
          nextStatus = 'auto'
        } else if (isTie) {
          // 新 hub 加入后与当前选中项平局，保持原选择
        }
      } else if (!currentSelected) {
        const newScore = newGroupRef?.hubScore
        const rangeAbsorbs = opts.filter((o) => o.type === 'absorb' && !o.extendsRange)
        const minDist = Math.min(...rangeAbsorbs.map((o) => o.distance))
        const sameDistAbsorbs = rangeAbsorbs.filter((o) => o.distance === minDist)
        if (newOpt.distance < minDist) {
          nextSelected = newOptIdx
          nextStatus = 'auto'
        } else if (newOpt.distance === minDist && sameDistAbsorbs.length >= 2) {
          if (sameDistAbsorbs.length === 2 && newScore !== undefined) {
            const otherOpt = sameDistAbsorbs.find((o) => o !== newOpt)!
            const otherGroup = groups.find((g) => g.id === otherOpt.targetGroupId)
            const otherScore = otherGroup?.hubScore
            if (otherScore !== undefined) {
              const maxScore = Math.max(newScore, otherScore)
              if (Math.abs(newScore - otherScore) / maxScore < SCORE_TIE_THRESHOLD) {
                // 仍平局，保持 null
              } else if (newScore > otherScore) {
                nextSelected = newOptIdx
                nextStatus = 'auto'
              }
            } else {
              // 无 score 无法判断，保持 null
            }
          } else {
            // 多于 2 个同距离候选，保持 null
          }
        } else if (newOpt.distance === minDist && sameDistAbsorbs.length === 1) {
          nextSelected = newOptIdx
          nextStatus = 'auto'
        }
      }
    } else {
      const hasInRangeHit = opts.some((o) => o.type === 'absorb' && !o.extendsRange)
      if (!hasInRangeHit && previousSelectedSectorMacro === null) {
        nextSelected = null
        nextStatus = a.status === 'uncertain_extend' ? 'uncertain_extend' : a.status
      }
    }

    // When a new range-internal option appears, remove all extension absorb options
    // to match buildAssignmentResult (range hits and extension hits do not coexist)
    if (!newOpt.extendsRange) {
      const filtered = opts.filter((o) => o.type !== 'absorb' || !o.extendsRange)
      if (filtered.length !== opts.length) {
        if (nextSelected !== null) {
          const oldOpt = opts[nextSelected]!
          nextSelected = filtered.findIndex((o) => o === oldOpt || (o.targetGroupId === oldOpt.targetGroupId && o.type === oldOpt.type))
          if (nextSelected < 0) nextSelected = null
        }
        opts.length = 0
        opts.push(...filtered)
      }
    }

    assignments[i] = {
      ...a,
      options: opts,
      selectedSectorMacro: nextSelected === null
        ? null
        : getOptionSelectedSectorMacro(a.sectorMacro, opts[nextSelected]),
      selectedOptionIndex: nextSelected,
      status: nextStatus
    }
  }

  groups = normalizeGroupJumpRanges(
    syncSelectedAbsorptionsToCoverage(groups, assignments as SectorAssignment[]),
    sectorGraph,
    sectorClusterMap
  )

  return { ...result, groups, assignments: assignments as SectorAssignment[] }
}

export function rebuildAssignmentsForJumpRangeChange(
  result: AutoGroupResult,
  groupId: string,
  newRange: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  oldRangeOverride?: number,
  autoSelect: boolean = true,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const group = result.groups.find((g) => g.id === groupId)
  if (!group?.sectorMacro) return result
  const oldRange = clampTransportJumpRange(oldRangeOverride ?? group.jumpRange)
  const effectiveNewRange = clampTransportJumpRange(newRange)
  if (effectiveNewRange === oldRange) return result

  const sectorMacro = group.sectorMacro
  const minRange = Math.min(oldRange, effectiveNewRange)
  const maxRange = Math.max(oldRange, effectiveNewRange)

  const groups = result.groups.map((g) =>
    g.id === groupId ? { ...g, jumpRange: effectiveNewRange } : g
  )

  const assignments = [...result.assignments]
  const anchorSectors = new Set(groups.map((g) => g.sectorMacro).filter(Boolean) as string[])

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!
    if (anchorSectors.has(a.sectorMacro)) continue

    const dist = getTransportDistance(sectorMacro, a.sectorMacro, sectorGraph, sectorClusterMap, sectorReachability)
    if (dist === null) continue
    if (dist <= minRange) continue
    if (dist > maxRange) continue

    const assignedSectors = new Map<string, string>()
    for (const g of groups) {
      if (g.sectorMacro) assignedSectors.set(g.sectorMacro, g.id)
      for (const m of g.coverageSectorMacros) {
        if (!assignedSectors.has(m)) assignedSectors.set(m, g.id)
      }
    }
    const unassigned = result.playerSectorMacros.filter((m) => !assignedSectors.has(m))
    const rebuilt = buildAssignmentResult(unassigned, assignedSectors, groups, sectorGraph, sectorClusterMap, sectorReachability)
    const rebuiltAssignment = rebuilt.find((r) => r.sectorMacro === a.sectorMacro)
    if (!rebuiltAssignment) continue

    const previousSelectedSectorMacro = getAssignmentSelectedSectorMacro(a)
    const previousSelectedOption = getSelectedOption(a)
    const prevSelectedTarget = previousSelectedOption?.targetGroupId
    const prevWasExtension = previousSelectedOption?.extendsRange

    let nextSelected = findOptionIndexBySelectedSectorMacro(
      a.sectorMacro,
      rebuiltAssignment.options,
      previousSelectedSectorMacro
    )
    let nextStatus = a.status

    const hubOpt = rebuiltAssignment.options.find((o) => o.targetGroupId === groupId)
    if (!autoSelect) {
      if (previousSelectedOption) {
        if (previousSelectedOption.type === 'absorb' && previousSelectedOption.targetGroupId === groupId && previousSelectedOption.extendsRange === false && hubOpt?.extendsRange === true) {
          nextSelected = null
          nextStatus = 'uncertain_extend'
        } else if (previousSelectedOption.type === 'standalone') {
          const mappedIdx = rebuiltAssignment.options.findIndex((o) => o.type === 'standalone')
          nextSelected = mappedIdx >= 0 ? mappedIdx : null
        } else {
          const mappedIdx = rebuiltAssignment.options.findIndex((o) =>
            o.type === previousSelectedOption.type && o.targetGroupId === previousSelectedOption.targetGroupId
          )
          nextSelected = mappedIdx >= 0 ? mappedIdx : null
        }
      }

      assignments[i] = {
        ...a,
        options: rebuiltAssignment.options,
        selectedSectorMacro: nextSelected === null
          ? null
          : getOptionSelectedSectorMacro(a.sectorMacro, rebuiltAssignment.options[nextSelected]),
        selectedOptionIndex: nextSelected,
        status: nextStatus as SectorAssignment['status']
      }
      continue
    }

    if (hubOpt) {
      const hubOptIdx = rebuiltAssignment.options.indexOf(hubOpt)
      if (!hubOpt.extendsRange) {
        if (prevSelectedTarget === groupId || prevWasExtension === true) {
          nextSelected = hubOptIdx
          nextStatus = 'auto'
        } else if (previousSelectedSectorMacro === null) {
          const rangeAbsorbs = rebuiltAssignment.options.filter((o) => o.type === 'absorb' && !o.extendsRange)
          const minDist = Math.min(...rangeAbsorbs.map((o) => o.distance))
          if (hubOpt.distance < minDist) {
            nextSelected = hubOptIdx
            nextStatus = 'auto'
          } else if (hubOpt.distance === minDist && rangeAbsorbs.length === 1) {
            nextSelected = hubOptIdx
            nextStatus = 'auto'
          }
        } else {
          const currentSelected = nextSelected !== null ? rebuiltAssignment.options[nextSelected] : null
          if (currentSelected && currentSelected.type === 'absorb' && !currentSelected.extendsRange) {
            const hubIsCloser = hubOpt.distance < currentSelected.distance
            if (hubIsCloser) {
              nextSelected = hubOptIdx
              nextStatus = 'auto'
            }
          }
        }
      } else {
        if (prevSelectedTarget === groupId && !prevWasExtension) {
          const hasInRangeHit = rebuiltAssignment.options.some((o) => o.type === 'absorb' && !o.extendsRange)
          if (!hasInRangeHit) {
            nextSelected = null
            nextStatus = 'uncertain_extend'
          } else {
            const rangeAbsorbs = rebuiltAssignment.options.filter((o) => o.type === 'absorb' && !o.extendsRange)
            const minDist = Math.min(...rangeAbsorbs.map((o) => o.distance))
            const bestOpts = rangeAbsorbs.filter((o) => o.distance === minDist)
            if (bestOpts.length === 1) {
              nextSelected = rebuiltAssignment.options.indexOf(bestOpts[0]!)
              nextStatus = 'auto'
            } else {
              nextSelected = null
              nextStatus = 'uncertain_tie'
            }
          }
        }
      }
    } else if (prevSelectedTarget === groupId && rebuiltAssignment.selectedOptionIndex !== null) {
      nextSelected = rebuiltAssignment.selectedOptionIndex
      nextStatus = rebuiltAssignment.status
    }

    assignments[i] = {
      ...a,
      options: rebuiltAssignment.options,
      selectedSectorMacro: nextSelected === null
        ? null
        : getOptionSelectedSectorMacro(a.sectorMacro, rebuiltAssignment.options[nextSelected]),
      selectedOptionIndex: nextSelected,
      status: nextStatus as SectorAssignment['status']
    }
  }

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

function findMatchingOptionIndex(options: AssignmentOption[], selected: AssignmentOption): number {
  if (selected.type === 'standalone') {
    return options.findIndex((o) => o.type === 'standalone')
  }
  return options.findIndex((o) =>
    o.type === selected.type && o.targetGroupId === selected.targetGroupId
  )
}

export function preserveEditAssignmentSelections(
  previousAssignments: SectorAssignment[],
  nextAssignments: SectorAssignment[]
): SectorAssignment[] {
  const previousBySector = new Map(previousAssignments.map((a) => [a.sectorMacro, a]))
  return nextAssignments.map((assignment) => {
    const previous = previousBySector.get(assignment.sectorMacro)
    const previousSelectedSectorMacro = previous ? getAssignmentSelectedSectorMacro(previous) : null
    if (!previous || previousSelectedSectorMacro === null) return assignment

    const previousSelected = getSelectedOption(previous)
    if (!previousSelected) {
      return { ...assignment, selectedSectorMacro: null, selectedOptionIndex: null }
    }

    const mappedIndex = findMatchingOptionIndex(assignment.options, previousSelected)
    if (mappedIndex < 0) {
      return { ...assignment, selectedSectorMacro: null, selectedOptionIndex: null }
    }

    return {
      ...assignment,
      selectedSectorMacro: getOptionSelectedSectorMacro(assignment.sectorMacro, assignment.options[mappedIndex]),
      selectedOptionIndex: mappedIndex,
      displayBucket: 'resolved'
    }
  })
}

export function enrichAutoGroupResult(
  result: AutoGroupResult,
  deps: {
    getSectorName: (macro: string) => string
    getFactionColor: (macro: string) => string | undefined
    archive: SaveArchive
    modulesByMacroId: Record<string, X4Module>
    containerThreshold: number
    prefJumpRange: number
  },
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  sectorReachability?: SectorReachability
): AutoGroupResult {
  const enrichedGroups = result.groups.map((g) => {
    let name = g.name
    if (g.sectorMacro) name = deps.getSectorName(g.sectorMacro)

    let selectedTradeStation = g.selectedTradeStation
    if (!selectedTradeStation && g.sectorMacro) {
      const stations = getPlayerStationsInSector(deps.archive, g.sectorMacro)
      if (stations.length > 0) {
        const hasQualified = stations.some((s) => {
          const info = detectStationHub(s, deps.modulesByMacroId, { containerThreshold: deps.containerThreshold })
          return info.qualified
        })
        const candidates = selectTradeStationCandidates(
          stations, deps.modulesByMacroId, hasQualified,
          { containerThreshold: deps.containerThreshold }
        )
        if (candidates.length > 0) {
          const aDefault = determineDefaultTradeStation(candidates)
          if (aDefault) {
            selectedTradeStation = aDefault
          }
        }
      }
      if (!selectedTradeStation && stations.length === 0) {
        selectedTradeStation = { type: 'virtual' as const, stationCode: '__virtual__' }
      }
    }

    return { ...g, name, selectedTradeStation }
  })

  const colorCtx: HubColorContext = {
    getFactionColor: deps.getFactionColor,
    getDistance: (from: string, to: string) => {
      return getTransportDistance(from, to, sectorGraph, sectorClusterMap, sectorReachability)
    },
    maxHop: 5
  }

  stabilizeHubColors(enrichedGroups, colorCtx)

  const sectorStationMap = new Map<string, PlayerStationEntry[]>()
  for (const s of getSaveSectorsWithPlayerStations(deps.archive)) {
    sectorStationMap.set(s.sectorMacro, s.playerStations)
  }
  const sectorStationCandidates = buildSectorStationCandidates(
    sectorStationMap, deps.modulesByMacroId,
    { containerThreshold: deps.containerThreshold }
  )

  return { ...result, groups: enrichedGroups, sectorStationCandidates }
}
