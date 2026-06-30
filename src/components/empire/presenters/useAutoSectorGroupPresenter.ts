import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { groupCleanSlate, groupIncremental, applyAbsorbToResult, applyStandaloneToResult, applyBridgePlanToDraft, buildAssignmentResult, setGroupPinnedInResult, normalizeReappearedUnpinnedHubs, rebuildAssignmentsForJumpRangeChange, preserveEditAssignmentSelections, type AutoGroupResult, type GroupDraftInfo, type SectorAssignment } from '@/store/logic/autoGroup'
import { buildSectorGraphFromMaps, getCoverageSectors, getPlayerStationsInSector, getReachableCoverageSectors } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getSectorZoneBoundingCenter } from '@/components/map/utils/coordinates'
import { stabilizeHubColors, stabilizeEditedHubColor, type HubColorContext } from '@/store/logic/hubColor'
import { selectTradeStationCandidates, determineDefaultTradeStation, type TradeStationCandidate, type TradeStationSelection } from '@/store/logic/tradeStationSelection'
import { detectStationHub } from '@/store/logic/autoGroupHub'
import type { BindingSectorGroup, BindingStationPlan, StationPlan, X4MapSector } from '@/types/x4'


export function useAutoSectorGroupPresenter() {
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()
const blueprintStore = useBlueprintProductionStore()
const activeViewStore = useActiveViewStore()
const saveBindingStore = useSaveBindingStore()
const { activeBinding } = storeToRefs(saveBindingStore)
const liveStore = useLiveProductionStore()
const { autoGroupResult, virtualStationDrafts, calculationMode, prefJumpRange, bridgeSearchJumpRange, prefThreshold, needsAutoGroupRecalc, calcBaselinePillState } = storeToRefs(liveStore)
const { t, te } = useI18n()
const nodeEnabled = ref(true)
const liveMode = ref<'display' | 'calculate'>('display')

function buildHubColorContext(): HubColorContext {
  const maps = gameDataStore.maps

  return {
    getFactionColor: (sectorMacro: string) => {
      if (!maps) return undefined
      const resolved = resolveMapSectorByMacro(maps, sectorMacro)
      if (!resolved) return undefined
      if (resolved.sector?.owner_color) return resolved.sector.owner_color
      if (maps.clusters && resolved.clusterId) {
        const cluster = maps.clusters[resolved.clusterId]
        if (cluster?.owner_color) return cluster.owner_color
      }
      return undefined
    },
    getDistance: (from: string, to: string) => {
      return gameDataStore.sectorReachability[from]?.[to] ?? null
    },
    maxHop: 5
  }
}
const showHubAddMenu = ref(false)
const virtualStationDragState = ref<{
  key: string
  payload: {
    stationId: string
    gameGuid: string
    sectorGroupId: string
    name: string
    icon: 'factory' | 'shipyard'
    coverageSectorMacros: { ref: string; jump: number }[]
    blueprintStation?: StationPlan
    virtualStationDraftId?: string
    blankVirtualStation?: boolean
  }
  startX: number
  startY: number
} | null>(null)
const activeVirtualStationDragKey = ref<string | null>(null)

const gameDataMaps = computed(() => gameDataStore.maps)
const sectorReachability = computed(() => gameDataStore.sectorReachability)

const canDragGroups = computed(() => {
  if (!autoGroupResult.value) return false
  if (calculationMode.value === 'edit') return true
  return calculationMode.value === 'result'
})

function getSectorDisplayName(macro: string): string {
  const maps = gameDataStore.maps
  if (maps) {
    const resolved = resolveMapSectorByMacro<X4MapSector>(maps, macro)
    if (resolved) {
      if (resolved.sector.nameId && te(resolved.sector.nameId)) return t(resolved.sector.nameId)
    }
  }
  return macro
}

function formatCoordKm(value: number): string {
  return `${(value / 1000).toFixed(1)}km`
}

function getVirtualTradeStationDefaultPosition(sectorMacro: string): { x: number; y: number; z: number } {
  const resolved = resolveMapSectorByMacro<X4MapSector>(gameDataStore.maps, sectorMacro)
  if (!resolved) return { x: 0, y: 0, z: 0 }
  const center = getSectorZoneBoundingCenter(resolved.sector)
  return { x: center.x, y: 0, z: center.z }
}

const sectorGraphInfo = computed(() => {
  if (!gameDataStore.maps) return { sectorGraph: {} as Record<string, string[]>, sectorClusterMap: {} as Record<string, string> }
  return buildSectorGraphFromMaps(
    gameDataStore.maps.clusters || {},
    gameDataStore.maps.sectors || {}
  )
})

type RetainKey = 'connectionRetainEnabled' | 'coverageRetainEnabled' | 'tradeStationRetainEnabled'

function getRetainSummary(groups: GroupDraftInfo[], key: RetainKey): { checked: boolean; indeterminate: boolean; defaultValue: boolean } {
  if (groups.length === 0) {
    return { checked: false, indeterminate: false, defaultValue: false }
  }
  const allOn = groups.every((group) => Boolean(group[key]))
  const allOff = groups.every((group) => !group[key])
  return {
    checked: allOn,
    indeterminate: !allOn && !allOff,
    defaultValue: allOn
  }
}

function applyRetainStateFromDraft(
  groups: GroupDraftInfo[],
  currentDraftGroups: GroupDraftInfo[] = []
): GroupDraftInfo[] {
  const currentById = new Map(currentDraftGroups.map((group) => [group.id, group]))
  const currentBySectorMacro = new Map(
    currentDraftGroups
      .filter((group) => !!group.sectorMacro)
      .map((group) => [group.sectorMacro!, group])
  )
  const defaultConnectionRetain = getRetainSummary(currentDraftGroups, 'connectionRetainEnabled').defaultValue
  const defaultCoverageRetain = getRetainSummary(currentDraftGroups, 'coverageRetainEnabled').defaultValue
  const defaultTradeStationRetain = getRetainSummary(currentDraftGroups, 'tradeStationRetainEnabled').defaultValue

  return groups.map((group) => {
    const source = currentById.get(group.id) ?? (group.sectorMacro ? currentBySectorMacro.get(group.sectorMacro) : undefined)
    return {
      ...group,
      connectionRetainEnabled: source?.connectionRetainEnabled ?? defaultConnectionRetain,
      coverageRetainEnabled: source?.coverageRetainEnabled ?? defaultCoverageRetain,
      tradeStationRetainEnabled: source?.tradeStationRetainEnabled ?? defaultTradeStationRetain,
      savedTradeStationCode: source?.savedTradeStationCode ?? group.savedTradeStationCode
    }
  })
}

function hasPendingBridgeDecisionInResult(result: AutoGroupResult | null): boolean {
  const plans = result?.bridgePlans ?? []
  return plans.length > 1 && !plans.some((p) => p.selected)
}

function setAutoGroupResult(result: AutoGroupResult | null) {
  liveStore.setAutoGroupResult(result)
  if (!calcBaselinePillState.value) liveStore.refreshCalcBaselinePillStateFromBinding()
  applyTradeStationDefaultsToResult()
}

function buildStoreGroups(groups: BindingSectorGroup[], playerSectorMacros: string[]): AutoGroupResult {
  const storeGroups: GroupDraftInfo[] = groups.map((g) => ({
    id: g.sectorMacro || '',
    name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
    sectorMacro: g.sectorMacro,
    jumpRange: g.jumpRange,
    originalJumpRange: g.jumpRange,
    coverageSectorMacros: g.coverageSectorMacros.map((c) => c.ref),
    connectedGroupIds: [...(g.connectedGroupIds || [])],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true,
    tradeStationRetainEnabled: true,
    hubScore: undefined,
    savedTradeStationCode: g.tradeStation?.saveStationCode,
    selectedTradeStation: g.tradeStation
      ? (g.tradeStation.saveStationCode
          ? { type: 'player' as const, stationCode: g.tradeStation.saveStationCode }
          : { type: 'virtual' as const, stationCode: '__virtual__' })
      : undefined,
    color: g.color,
    baseline: true
  }))
  return { groups: storeGroups, assignments: [], bridgePlans: [], playerSectorMacros }
}

function runAutoGroup(options: { force?: boolean } = {}) {
  const archive = saveStore.selectedArchive
  const guid = activeViewStore.activeBinding
  if (!archive || !archive.isValid || !guid) {
    setAutoGroupResult(null)
    return
  }
  const binding = saveBindingStore.getBindingByGameGuid(guid)
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value

  const archiveTime = archive.meta?.time ?? 0

  // Skip if archive time unchanged and we already have a result
  if (!options.force && binding?.appliedAutoGroupArchiveTime === archiveTime && liveStore.autoGroupResult) {
    return
  }

  if (binding && binding.groups.length > 0) {
    const result = groupIncremental(
      archive, binding.groups, gameDataStore.modulesByMacroId,
      sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value,
      [], true, gameDataStore.sectorReachability
    )
    if (result.assignments.length === 0) {
      setAutoGroupResult(buildStoreGroups(binding.groups, result.playerSectorMacros))
      setResultModeDefaults()
      return
    }
    stabilizeHubColors(result.groups, buildHubColorContext())
    setAutoGroupResult(result)
    setResultModeDefaults()
  } else {
    const result = groupCleanSlate(
      archive, gameDataStore.modulesByMacroId, sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value,
      [], true, gameDataStore.sectorReachability
    )
    const namedGroups = result.groups.map((g) => ({
      ...g, name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
    }))
    stabilizeHubColors(namedGroups, buildHubColorContext())
    setAutoGroupResult({ ...result, groups: namedGroups })
    setResultModeDefaults()
  }

  // Record applied time
  if (binding) {
    binding.appliedAutoGroupArchiveTime = archiveTime
  }
}

function buildRecalculateBaseGroups(): { baseGroups: BindingSectorGroup[]; excludedSectorMacros: string[] } | null {
  if (!autoGroupResult.value) return null
  const pinnedGroups = autoGroupResult.value.groups.filter((group) => group.isPinned && group.sectorMacro)
  const baseGroups = pinnedGroups
    .map((group, index) => ({
      id: group.id,
      name: group.name,
      order: index,
      sectorMacro: group.sectorMacro,
      jumpRange: group.jumpRange,
      color: group.color,
      connectedGroupIds: group.connectedGroupIds.filter((connId) => {
        const other = pinnedGroups.find((g) => g.id === connId)
        if (!other) return false
        return group.connectionRetainEnabled || other.connectionRetainEnabled
      }),
      coverageSectorMacros: (group.coverageRetainEnabled ? group.coverageSectorMacros : [])
        .map((ref) => ({ ref, jump: 0 }))
    }))
  return { baseGroups, excludedSectorMacros: [] }
}

function runCalculationFromEditInput() {
  const archive = saveStore.selectedArchive
  const guid = activeViewStore.activeBinding
  const recalculateInput = buildRecalculateBaseGroups()
  if (!archive || !archive.isValid || !guid) return

  // Capture user-edited state from current edit draft (by anchor sector)
  const currentDraft = autoGroupResult.value
  const previouslyUnpinnedSectorMacros = new Set(
    currentDraft?.groups
      .filter((group) => !group.isPinned && group.sectorMacro)
      .map((group) => group.sectorMacro!) ?? []
  )

  let result: AutoGroupResult
  if (!recalculateInput || recalculateInput.baseGroups.length === 0) {
    const excludedSectorMacros = recalculateInput?.excludedSectorMacros ?? []
    const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
    result = groupCleanSlate(
      archive, gameDataStore.modulesByMacroId, sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value,
      excludedSectorMacros, nodeEnabled.value, gameDataStore.sectorReachability
    )
    result = {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
      }))
    }
  } else {
    const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
    result = groupIncremental(
      archive, recalculateInput.baseGroups, gameDataStore.modulesByMacroId,
      sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value,
      recalculateInput.excludedSectorMacros, nodeEnabled.value, gameDataStore.sectorReachability
    )
    result = {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
      }))
    }
  }

  // Preserve trade station retain info from previous groups (matched by ID)
  const prevTradeStationByGroupId: Record<string, { savedTradeStationCode?: string; tradeStationRetainEnabled?: boolean }> = {}
  if (currentDraft) {
    for (const g of currentDraft.groups) {
      prevTradeStationByGroupId[g.id] = {
        savedTradeStationCode: g.savedTradeStationCode,
        tradeStationRetainEnabled: g.tradeStationRetainEnabled
      }
    }
  }
  const groupsWithPrevTrade = applyRetainStateFromDraft(
    result.groups.map((g) => ({
      ...g,
      ...prevTradeStationByGroupId[g.id]
    })),
    currentDraft?.groups ?? []
  )

  const normalizedResult = normalizeReappearedUnpinnedHubs(
    { ...result, groups: groupsWithPrevTrade },
    previouslyUnpinnedSectorMacros
  )

  stabilizeHubColors(normalizedResult.groups, buildHubColorContext())
  setAutoGroupResult(normalizedResult)
  calculationMode.value = 'result'
}

function runResetCalculationFromBinding() {
  const archive = saveStore.selectedArchive
  const guid = activeViewStore.activeBinding
  if (!archive || !archive.isValid || !guid) return
  const binding = saveBindingStore.getBindingByGameGuid(guid)
  if (!binding) return

  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  let result: AutoGroupResult
  if (binding.groups.length > 0) {
    result = groupIncremental(
      archive,
      binding.groups,
      gameDataStore.modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: prefThreshold.value },
      prefJumpRange.value,
      bridgeSearchJumpRange.value,
      [],
      nodeEnabled.value,
      gameDataStore.sectorReachability
    )
    if (result.assignments.length === 0) {
      result = buildStoreGroups(binding.groups, result.playerSectorMacros)
    }
  } else {
    result = groupCleanSlate(
      archive,
      gameDataStore.modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: prefThreshold.value },
      prefJumpRange.value,
      bridgeSearchJumpRange.value,
      [],
      nodeEnabled.value,
      gameDataStore.sectorReachability
    )
  }

  result = {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
    }))
  }
  stabilizeHubColors(result.groups, buildHubColorContext())
  liveStore.setAutoGroupResultFromBindingReset(result)
  if (!calcBaselinePillState.value) liveStore.refreshCalcBaselinePillStateFromBinding()
  applyTradeStationDefaultsToResult()
  calculationMode.value = 'result'
}

function handleUpdatePrefJumpRange(range: number) {
  prefJumpRange.value = range
  if (bridgeSearchJumpRange.value < range) {
    bridgeSearchJumpRange.value = range
  }
}

function handleEnterEdit() {
  if (hasPendingBridgeDecision.value) return
  calculationMode.value = 'edit'
}

function handleExitEdit() {
  calculationMode.value = 'result'
}

function rebuildAssignmentsFromGroups() {
  const result = autoGroupResult.value
  if (!result) return
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value

  const assignedSectors = new Map<string, string>()
  for (const group of result.groups) {
    if (group.sectorMacro) assignedSectors.set(group.sectorMacro, group.id)
    for (const macro of group.coverageSectorMacros) {
      if (!assignedSectors.has(macro)) assignedSectors.set(macro, group.id)
    }
  }

  const unassigned = result.playerSectorMacros.filter((m) => !assignedSectors.has(m))
  const newAssignments = preserveEditAssignmentSelections(
    result.assignments,
    buildAssignmentResult(unassigned, assignedSectors, result.groups, sectorGraph, sectorClusterMap, gameDataStore.sectorReachability)
  )

  autoGroupResult.value = { ...result, assignments: newAssignments }
}

function handleUpdateBridgeSearchJumpRange(range: number) {
  bridgeSearchJumpRange.value = Math.max(range, prefJumpRange.value)
}

function getAssignmentOptionSelectedSectorMacro(
  assignmentSectorMacro: string,
  option: SectorAssignment['options'][number] | undefined
): string | null {
  if (!option) return null
  if (option.type === 'standalone') return assignmentSectorMacro
  return option.targetGroupId ?? null
}

function handleSelectOption(sectorMacro: string, selectedSectorMacro: string) {
  if (!autoGroupResult.value) return
  const assignment = autoGroupResult.value.assignments.find((a) => a.sectorMacro === sectorMacro)
  if (!assignment) return
  if (assignment.selectedSectorMacro === selectedSectorMacro) return
  const optionIndex = assignment.options.findIndex((option) =>
    getAssignmentOptionSelectedSectorMacro(assignment.sectorMacro, option) === selectedSectorMacro
  )
  if (optionIndex < 0) return
  const opt = assignment.options[optionIndex]
  if (!opt) return
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  if (opt.type === 'absorb' && opt.targetGroupId) {
    autoGroupResult.value = applyAbsorbToResult(autoGroupResult.value, sectorMacro, optionIndex, sectorGraph, sectorClusterMap, prefJumpRange.value, bridgeSearchJumpRange.value, gameDataStore.sectorReachability)
  }
  if (opt.type === 'standalone') {
    autoGroupResult.value = applyStandaloneToResult(autoGroupResult.value, sectorMacro, sectorGraph, sectorClusterMap, prefJumpRange.value, getSectorDisplayName, bridgeSearchJumpRange.value, buildHubColorContext(), gameDataStore.sectorReachability)
  }
  applyTradeStationDefaultsToResult()
}

function handleCycleRecalcState(groupId: string) {
  if (!autoGroupResult.value) return
  if (hasPendingBridgeDecision.value) return
  const result = autoGroupResult.value
  const group = result.groups.find((g) => g.id === groupId)
  if (!group) return
  if (group.enteredOtherGroupCoverage) return
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  autoGroupResult.value = setGroupPinnedInResult(result, groupId, !group.isPinned, sectorGraph, sectorClusterMap, gameDataStore.sectorReachability)
}

function handleUpdateJumpRange(groupId: string, range: number) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const idx = result.groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = result.groups[idx]!
  const prevRange = group.jumpRange

  if (range === prevRange) return

  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  if (!sectorGraph) return

  // First update coverage based on new jumpRange
  const groups = [...result.groups]
  if (group.sectorMacro) {
    const effectiveRange = Math.max(0, Math.min(5, range))
    const distances = getReachableCoverageSectors(gameDataStore.sectorReachability, group.sectorMacro, effectiveRange)
      || getCoverageSectors(group.sectorMacro, effectiveRange, sectorGraph, sectorClusterMap)
    const newRangeMacros = new Set(distances.map((d) => d.sectorMacro))

    const allAnchorSectors = new Set(groups.filter((g) => g.sectorMacro).map((g) => g.sectorMacro!))

    let newCoverage: string[]
    if (range > prevRange) {
      const otherCoverage = new Set<string>()
      for (let i = 0; i < groups.length; i++) {
        if (i === idx) continue
        for (const m of groups[i]!.coverageSectorMacros) {
          otherCoverage.add(m)
        }
      }

      const existing = new Set(group.coverageSectorMacros)
      for (const d of distances) {
        if (d.distance <= prevRange) continue
        if (d.distance > range) continue
        if (d.sectorMacro === group.sectorMacro) continue
        if (!result.playerSectorMacros.includes(d.sectorMacro)) continue
        if (allAnchorSectors.has(d.sectorMacro)) continue
        if (otherCoverage.has(d.sectorMacro)) continue
        if (!existing.has(d.sectorMacro)) {
          existing.add(d.sectorMacro)
        }
      }
      newCoverage = [...existing]
    } else {
      newCoverage = group.coverageSectorMacros.filter((m) => newRangeMacros.has(m))
    }

    groups[idx] = { ...group, jumpRange: effectiveRange, coverageSectorMacros: newCoverage }
  } else {
    groups[idx] = { ...group, jumpRange: Math.max(0, Math.min(5, range)) }
  }

  const withCoverage = { ...result, groups, assignments: result.assignments }
  // Then incrementally rebuild affected assignments
  autoGroupResult.value = rebuildAssignmentsForJumpRangeChange(
    withCoverage, groupId, Math.max(0, Math.min(5, range)), sectorGraph, sectorClusterMap, undefined, false, gameDataStore.sectorReachability
  )
}


function handleToggleCoverageInput(groupId: string, sectorMacro: string) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  // Remove from active coverage (becomes candidate in unified pill view)
  groups[idx] = {
    ...group,
    coverageSectorMacros: group.coverageSectorMacros.filter((m) => m !== sectorMacro)
  }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  rebuildAssignmentsFromGroups()
}

function handleToggleConnectedInput(groupId: string, connectedGroupId: string) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  const has = group.connectedGroupIds.includes(connectedGroupId)
  groups[idx] = {
    ...group,
    connectedGroupIds: has
      ? group.connectedGroupIds.filter((id) => id !== connectedGroupId)
      : [...group.connectedGroupIds, connectedGroupId]
  }
  // Sync bidirectional: also update the other group's connectedGroupIds
  const otherIdx = groups.findIndex((g) => g.id === connectedGroupId)
  if (otherIdx >= 0) {
    const other = groups[otherIdx]!
    const otherHas = other.connectedGroupIds.includes(groupId)
    if (otherHas !== !has) {
      groups[otherIdx] = {
        ...other,
        connectedGroupIds: otherHas
          ? other.connectedGroupIds.filter((id) => id !== groupId)
          : [...other.connectedGroupIds, groupId]
      }
    }
  }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleAddCandidateCoverage(groupId: string, sectorMacro: string) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!

  // Add sector to this group's coverage
  if (!group.coverageSectorMacros.includes(sectorMacro)) {
    groups[idx] = {
      ...group,
      coverageSectorMacros: [...group.coverageSectorMacros, sectorMacro]
    }
  }

  // Handle other groups that have this sector in their coverage
  for (let i = 0; i < groups.length; i++) {
    if (i === idx) continue
    const other = groups[i]!
    if (!other.coverageSectorMacros.includes(sectorMacro)) continue

    if (other.baseline) {
      // Baseline coverage → remove from active coverage, becomes recoverable candidate
      groups[i] = {
        ...other,
        coverageSectorMacros: other.coverageSectorMacros.filter((m) => m !== sectorMacro)
      }
      // Track if unpinned baseline hub's anchor entered other coverage
      if (!other.isPinned && other.sectorMacro === sectorMacro) {
        groups[i] = { ...groups[i]!, enteredOtherGroupCoverage: true }
      }
    } else {
      // Edit-added coverage → remove from other group
      groups[i] = {
        ...other,
        coverageSectorMacros: other.coverageSectorMacros.filter((m) => m !== sectorMacro),
        excludedDefaultAssignmentSectorMacros: other.excludedDefaultAssignmentSectorMacros.filter((m) => m !== sectorMacro)
      }
    }
  }

  // Stabilize color for the affected group after coverage change
  stabilizeEditedHubColor(groups[idx]!, groups, buildHubColorContext())
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  rebuildAssignmentsFromGroups()
}

function handleDeleteGroup(groupId: string) {
  if (calculationMode.value !== 'edit') return
  if (hasPendingBridgeDecision.value) return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const idx = result.groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = result.groups[idx]!
  // Only allow deleting new non-baseline groups
  if (!group.isNew || group.baseline) return

  const groups = [...result.groups]
  const deletedMacro = groups[idx]!.sectorMacro!
  groups.splice(idx, 1)

  // Remove connections to deleted group
  for (let i = 0; i < groups.length; i++) {
    groups[i] = {
      ...groups[i]!,
      connectedGroupIds: groups[i]!.connectedGroupIds.filter((id) => id !== groupId)
    }
  }

  // Restore deleted hub's sector in baseline groups that had it excluded
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    if (g.baseline && g.excludedDefaultAssignmentSectorMacros.includes(deletedMacro)) {
      groups[i] = {
        ...g,
        excludedDefaultAssignmentSectorMacros: g.excludedDefaultAssignmentSectorMacros.filter((m) => m !== deletedMacro)
      }
    }
  }

  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  rebuildAssignmentsFromGroups()
}

function handleSelectBridgeCenter(planId: string, unitId: string, sectorMacro: string) {
  if (calculationMode.value === 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const bridgePlans = result.bridgePlans.map((plan) => {
    if (plan.id !== planId) return plan
    return {
      ...plan,
      units: plan.units.map((unit) =>
        unit.unitId === unitId ? { ...unit, selectedSectorMacro: sectorMacro } : unit
      )
    }
  })
  autoGroupResult.value = { ...result, bridgePlans }
}

function handleSelectBridgePlan(planId: string) {
  if (calculationMode.value === 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const plan = result.bridgePlans.find((p) => p.id === planId)
  if (!plan) return
  autoGroupResult.value = applyBridgePlanToDraft(
    result,
    plan,
    prefJumpRange.value,
    getSectorDisplayName,
    sectorGraphInfo.value.sectorGraph,
    sectorGraphInfo.value.sectorClusterMap,
    bridgeSearchJumpRange.value,
    buildHubColorContext(),
    gameDataStore.sectorReachability
  )
}

function handleResetAssignments() {
  runResetCalculationFromBinding()
}

function handleAddHubClick() {
  if (calculationMode.value !== 'edit') return
  if (hasPendingBridgeDecision.value) return
  showHubAddMenu.value = !showHubAddMenu.value
}

function handleAddHubDraft(sectorMacro: string) {
  if (hasPendingBridgeDecision.value) return
  if (!autoGroupResult.value) return
  showHubAddMenu.value = false
  const result = autoGroupResult.value
  const groups = [...result.groups]

  // Remove sector from other groups' coverage (it's now a hub anchor)
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    if (!group.coverageSectorMacros.includes(sectorMacro)) continue
    groups[i] = {
      ...group,
      coverageSectorMacros: group.coverageSectorMacros.filter((m) => m !== sectorMacro)
    }
  }

  // Compute default trade station code for retain support
  const archive = saveStore.selectedArchive
  let savedTradeStationCode: string | undefined
  if (archive) {
    const stations = getPlayerStationsInSector(archive, sectorMacro)
    if (stations.length > 0) {
      const hasQualified = stations.some((s) => {
        const info = detectStationHub(s, gameDataStore.modulesByMacroId, { containerThreshold: prefThreshold.value })
        return info.qualified
      })
      const requireQualified = hasQualified
      const candidates = selectTradeStationCandidates(
        stations, gameDataStore.modulesByMacroId, requireQualified,
        { containerThreshold: prefThreshold.value }
      )
      const aDefault = determineDefaultTradeStation(candidates)
      if (aDefault && aDefault.type === 'player') {
        savedTradeStationCode = aDefault.stationCode
      }
    }
  }

  const newGroup: GroupDraftInfo = {
    id: sectorMacro,
    name: getSectorDisplayName(sectorMacro),
    sectorMacro,
    jumpRange: prefJumpRange.value,
    originalJumpRange: prefJumpRange.value,
    coverageSectorMacros: [],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: true,
    isPinned: true,
    coverageRetainEnabled: getRetainSummary(groups, 'coverageRetainEnabled').defaultValue,
    connectionRetainEnabled: getRetainSummary(groups, 'connectionRetainEnabled').defaultValue,
    tradeStationRetainEnabled: getRetainSummary(groups, 'tradeStationRetainEnabled').defaultValue,
    source: 'manual',
    savedTradeStationCode
  }
  groups.push(newGroup)
  stabilizeEditedHubColor(newGroup, groups, buildHubColorContext())
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  rebuildAssignmentsFromGroups()
  applyTradeStationDefaultsToResult()
}

function getExistingAnchorSectors(): Set<string> {
  if (!autoGroupResult.value) return new Set()
  return new Set(
    autoGroupResult.value.groups
      .filter((g) => g.sectorMacro)
      .map((g) => g.sectorMacro!)
  )
}

function handleToggleRetainCoverage(groupId: string) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, coverageRetainEnabled: !groups[idx]!.coverageRetainEnabled }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleColorChange(groupId: string, color: string | undefined) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, color }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleToggleRetainConnection(groupId: string) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, connectionRetainEnabled: !groups[idx]!.connectionRetainEnabled }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleMasterBridgeRetain(enabled: boolean) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((g) => ({ ...g, connectionRetainEnabled: enabled }))
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleMasterCoverageRetain(enabled: boolean) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((g) => ({ ...g, coverageRetainEnabled: enabled }))
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function canReorderGroups(): boolean {
  return canDragGroups.value
}

function setResultModeDefaults() {
  const guid = activeViewStore.activeBinding
  const binding = guid ? saveBindingStore.getBindingByGameGuid(guid) : null
  nodeEnabled.value = !(binding && binding.groups.length > 0)
}

function handleQuickCalculate() {
  runCalculationFromEditInput()
}

const tradeStationCandidates = computed(() => {
  const result = autoGroupResult.value
  if (!result?.sectorStationCandidates) return {} as Record<string, TradeStationCandidate[]>

  const candidates: Record<string, TradeStationCandidate[]> = {}
  for (const group of result.groups) {
    if (!group.sectorMacro) continue
    const allCandidates = result.sectorStationCandidates[group.sectorMacro] ?? []

    if (allCandidates.length === 0) {
      candidates[group.id] = []
      continue
    }

    if (group.source !== 'auto') {
      const hasQualified = allCandidates.some((c) => c.qualified)
      if (hasQualified) {
        candidates[group.id] = allCandidates.filter((c) => c.qualified)
      } else {
        candidates[group.id] = allCandidates
      }
    } else {
      candidates[group.id] = allCandidates
    }
  }
  return candidates
})

function applyTradeStationDefaultsToResult() {
  const result = autoGroupResult.value
  if (!result) return
  const groups = [...result.groups]
  let changed = false
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    if (!group.sectorMacro) continue
    const cands = tradeStationCandidates.value[group.id]
    if (cands === undefined) {
      groups[i] = { ...group, selectedTradeStation: { type: 'virtual' as const, stationCode: '__virtual__' } }
      changed = true
      continue
    }

    if (group.selectedTradeStation) continue
    if (group.tradeStationRetainEnabled && group.savedTradeStationCode) {
      groups[i] = { ...group, selectedTradeStation: { type: 'player' as const, stationCode: group.savedTradeStationCode } }
      changed = true
      continue
    }
    if (cands.length === 0) continue
    const aDefault = determineDefaultTradeStation(cands)
    if (aDefault) {
      groups[i] = { ...group, selectedTradeStation: aDefault }
      changed = true
    }
  }
  if (changed) {
    autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  }
}

const selectedTradeStations = computed<Record<string, TradeStationSelection>>(() => {
  const sel: Record<string, TradeStationSelection> = {}
  for (const group of autoGroupResult.value?.groups ?? []) {
    if (group.selectedTradeStation) {
      sel[group.id] = group.selectedTradeStation
    }
  }
  return sel
})

const blueprintEmpires = computed(() => blueprintStore.savedEmpires?.list ?? [])

const selectedBlueprintEmpireId = computed({
  get: () => {
    const binding = activeBinding.value
    return binding?.blueprintEmpireId ||
      blueprintStore.activeEmpire?.id ||
      blueprintEmpires.value[0]?.id ||
      ''
  },
  set: (empireId: string) => {
    const binding = activeBinding.value
    if (!binding) return
    saveBindingStore.setBlueprintEmpire(binding.gameGuid, empireId || undefined)
  }
})

const selectedBlueprintEmpire = computed(() => {
  const id = selectedBlueprintEmpireId.value
  if (!id) return null
  if (blueprintStore.activeEmpire?.id === id) return blueprintStore.activeEmpire
  return blueprintEmpires.value.find((empire) => empire.id === id) || null
})

const blueprintStationSources = computed(() => selectedBlueprintEmpire.value?.stations ?? [])

const virtualStationGroups = computed(() => {
  const draftsByGroupId = new Map<string, BindingStationPlan[]>()
  const ungrouped: BindingStationPlan[] = []
  for (const draft of virtualStationDrafts.value) {
    if (draft.groupId) {
      const bucket = draftsByGroupId.get(draft.groupId) ?? []
      bucket.push(draft)
      draftsByGroupId.set(draft.groupId, bucket)
    } else {
      ungrouped.push(draft)
    }
  }
  const groups = (autoGroupResult.value?.groups ?? []).map((group) => ({
    group,
    stations: [...(draftsByGroupId.get(group.id) ?? [])].sort((a, b) => {
      const nameA = getSectorDisplayName(a.sectorMacro ?? '')
      const nameB = getSectorDisplayName(b.sectorMacro ?? '')
      return nameA.localeCompare(nameB)
    })
  }))
  return {
    groups,
    ungrouped: [...ungrouped].sort((a, b) => {
      const nameA = getSectorDisplayName(a.sectorMacro ?? '')
      const nameB = getSectorDisplayName(b.sectorMacro ?? '')
      return nameA.localeCompare(nameB)
    })
  }
})

function getGroupCoverageEntries(groupId: string): { ref: string; jump: number }[] {
  const group = autoGroupResult.value?.groups.find((item) => item.id === groupId)
  if (!group) return []
  return [
    ...(group.sectorMacro ? [{ ref: group.sectorMacro, jump: 0 }] : []),
    ...group.coverageSectorMacros.map((ref) => ({ ref, jump: 0 }))
  ]
}

function getAllGroupCoverageEntries(): { ref: string; jump: number }[] {
  const refs = new Set<string>()
  for (const group of autoGroupResult.value?.groups ?? []) {
    if (group.sectorMacro) refs.add(group.sectorMacro)
    for (const ref of group.coverageSectorMacros) refs.add(ref)
  }
  return [...refs].map((ref) => ({ ref, jump: 0 }))
}

function getFirstVirtualStationGroupId(): string {
  return autoGroupResult.value?.groups.find((group) => group.sectorMacro)?.id ?? ''
}

function buildVirtualStationDragPayload(input: {
  key: string
  name: string
  icon: 'factory' | 'shipyard'
  blueprintStation?: StationPlan
  virtualStationDraftId?: string
  blankVirtualStation?: boolean
  groupId?: string | null
}) {
  const binding = activeBinding.value
  const groupId = input.groupId || getFirstVirtualStationGroupId()
  if (!binding || !groupId) return null
  return {
    stationId: input.virtualStationDraftId || input.blueprintStation?.id || input.key,
    gameGuid: binding.gameGuid,
    sectorGroupId: groupId,
    name: input.name,
    icon: input.icon,
    coverageSectorMacros: input.blankVirtualStation || input.blueprintStation || input.virtualStationDraftId
      ? getAllGroupCoverageEntries()
      : getGroupCoverageEntries(groupId),
    blueprintStation: input.blueprintStation,
    virtualStationDraftId: input.virtualStationDraftId,
    blankVirtualStation: input.blankVirtualStation
  }
}

function startVirtualStationDrag(event: MouseEvent, input: {
  key: string
  name: string
  icon: 'factory' | 'shipyard'
  blueprintStation?: StationPlan
  virtualStationDraftId?: string
  blankVirtualStation?: boolean
  groupId?: string | null
}) {
  if (event.button !== 0) return null
  const payload = buildVirtualStationDragPayload(input)
  if (!payload) return null
  event.preventDefault()
  virtualStationDragState.value = {
    key: input.key,
    payload,
    startX: event.clientX,
    startY: event.clientY
  }
  return payload
}

function updateVirtualStationDrag(event: MouseEvent) {
  const state = virtualStationDragState.value
  if (!state || activeVirtualStationDragKey.value) return null
  const dx = event.clientX - state.startX
  const dy = event.clientY - state.startY
  if (Math.hypot(dx, dy) < 4) return null
  activeVirtualStationDragKey.value = state.key
  return state.payload
}

function finishVirtualStationDrag() {
  const wasDragging = activeVirtualStationDragKey.value !== null
  virtualStationDragState.value = null
  activeVirtualStationDragKey.value = null
  return wasDragging
}

function handleDeleteVirtualStationDraft(draftId: string) {
  liveStore.deleteVirtualStationDraft(draftId)
}

const hasUnresolvedTradeStations = computed(() => {
  if (!autoGroupResult.value) return false
  const groupsWithCandidates = Object.keys(tradeStationCandidates.value)
  if (groupsWithCandidates.length === 0) return false
  return groupsWithCandidates.some((id) => !selectedTradeStations.value[id])
})

const hasChanges = ref(false)

function hasVirtualStationDraftChanges(): boolean {
  const binding = activeBinding.value
  if (!binding) return virtualStationDrafts.value.length > 0
  const bindingDrafts = binding.stationPlans.filter((plan) => plan.saveStationCode === undefined)
  if (bindingDrafts.length !== virtualStationDrafts.value.length) return true
  const bindingById = new Map(bindingDrafts.map((plan) => [plan.id, plan]))
  for (const draft of virtualStationDrafts.value) {
    const existing = bindingById.get(draft.id)
    if (!existing) return true
    if (existing.groupId !== draft.groupId) return true
    if (existing.name !== draft.name) return true
    if (existing.type !== draft.type) return true
    if (existing.sectorMacro !== draft.sectorMacro) return true
    if (JSON.stringify(existing.position) !== JSON.stringify(draft.position)) return true
    if (JSON.stringify(existing.modules) !== JSON.stringify(draft.modules)) return true
    if (JSON.stringify(existing.settings) !== JSON.stringify(draft.settings)) return true
    if (JSON.stringify(existing.lockedWares ?? []) !== JSON.stringify(draft.lockedWares ?? [])) return true
    if (JSON.stringify(existing.warePriority ?? {}) !== JSON.stringify(draft.warePriority ?? {})) return true
  }
  return false
}

function logAutoSectorDirty(reason: string, detail: Record<string, unknown> = {}) {
  console.log('[auto-sector-confirm][hasChanges]', reason, JSON.stringify(detail))
}

watch([autoGroupResult, activeBinding, virtualStationDrafts], () => {
  const result = autoGroupResult.value
  const binding = activeBinding.value
  if (!result || !binding) {
    hasChanges.value = result !== null
    if (hasChanges.value) logAutoSectorDirty('missing-binding', { hasResult: !!result, hasBinding: !!binding })
    return
  }
  if (hasVirtualStationDraftChanges()) {
    logAutoSectorDirty('virtual-station-drafts-differ', {
      bindingDrafts: binding.stationPlans.filter((plan) => plan.saveStationCode === undefined).map((plan) => ({
        id: plan.id,
        groupId: plan.groupId,
        sectorMacro: plan.sectorMacro
      })),
      draftState: virtualStationDrafts.value.map((draft) => ({
        id: draft.id,
        groupId: draft.groupId,
        sectorMacro: draft.sectorMacro
      }))
    })
    hasChanges.value = true
    return
  }
  if (result.groups.length !== binding.groups.length) {
    logAutoSectorDirty('group-length-differ', {
      resultGroupIds: result.groups.map((group) => group.id),
      bindingGroupIds: binding.groups.map((group) => group.sectorMacro)
    })
    hasChanges.value = true
    return
  }
  const bindingById = new Map(
    binding.groups
      .filter((g) => g.sectorMacro !== undefined)
      .map((g) => [g.sectorMacro!, g])
  )
  for (const g of result.groups) {
    const bg = bindingById.get(g.id)
    if (!bg) {
      logAutoSectorDirty('binding-group-missing', { groupId: g.id, groupName: g.name })
      hasChanges.value = true
      return
    }
    if (g.jumpRange !== bg.jumpRange) {
      logAutoSectorDirty('jump-range-differ', { groupId: g.id, result: g.jumpRange, binding: bg.jumpRange })
      hasChanges.value = true
      return
    }
    if (g.color !== bg.color) {
      logAutoSectorDirty('color-differ', { groupId: g.id, result: g.color, binding: bg.color })
      hasChanges.value = true
      return
    }
    const bgCov = bg.coverageSectorMacros.map((c) => c.ref).sort()
    const gCov = [...g.coverageSectorMacros].sort()
    if (gCov.length !== bgCov.length || gCov.some((m, i) => m !== bgCov[i])) {
      logAutoSectorDirty('coverage-differ', { groupId: g.id, result: gCov, binding: bgCov })
      hasChanges.value = true
      return
    }
    const bgConns = [...(bg.connectedGroupIds ?? [])].sort()
    const gConns = [...g.connectedGroupIds].sort()
    if (gConns.length !== bgConns.length || gConns.some((c, i) => c !== bgConns[i])) {
      logAutoSectorDirty('connections-differ', { groupId: g.id, result: gConns, binding: bgConns })
      hasChanges.value = true
      return
    }
    const currentTradeStation = g.selectedTradeStation
    if (!currentTradeStation) {
      if (bg.tradeStation) {
        logAutoSectorDirty('trade-station-differ', { groupId: g.id, result: null, binding: bg.tradeStation })
        hasChanges.value = true
        return
      }
    } else if (currentTradeStation.type === 'player') {
      if (bg.tradeStation?.saveStationCode !== currentTradeStation.stationCode) {
        logAutoSectorDirty('trade-station-player-differ', {
          groupId: g.id,
          result: currentTradeStation,
          binding: bg.tradeStation
        })
        hasChanges.value = true
        return
      }
    } else if (!bg.tradeStation || bg.tradeStation.saveStationCode !== undefined) {
      logAutoSectorDirty('trade-station-virtual-differ', {
        groupId: g.id,
        result: currentTradeStation,
        binding: bg.tradeStation
      })
      hasChanges.value = true
      return
    }
  }
  logAutoSectorDirty('clean', {
    groupCount: result.groups.length,
    virtualDraftCount: virtualStationDrafts.value.length
  })
  hasChanges.value = false
}, { immediate: true })

const tradeStationCaps = computed<Record<string, number>>(() => {
  const caps: Record<string, number> = {}
  for (const group of autoGroupResult.value?.groups ?? []) {
    const sel = group.selectedTradeStation
    if (!sel || sel.type !== 'player') continue
    const cands = tradeStationCandidates.value[group.id] ?? []
    const match = cands.find((c) => c.stationCode === sel.stationCode)
    if (match) caps[group.id] = match.containerCap
  }
  return caps
})

const unresolvedTradeStationCount = computed(() => {
  if (!hasUnresolvedTradeStations.value) return 0
  if (!autoGroupResult.value) return 0
  const groupsWithCandidates = Object.keys(tradeStationCandidates.value)
  return groupsWithCandidates.filter((id) => !selectedTradeStations.value[id]).length
})

const unresolvedAllocationCount = computed(() => {
  let count = 0
  if (!autoGroupResult.value) return count
  if (hasPendingBridgeDecision.value) count++
  const uncertainCount = (autoGroupResult.value?.assignments ?? []).filter(isUnresolvedAssignment).length
  return count + uncertainCount
})

const hasGlobalUnresolved = computed(() =>
  hasUncertainAssignments.value ||
  hasPendingBridgeDecision.value ||
  hasUnresolvedTradeStations.value
)

const sectorGroupColorMap = computed<Record<string, string>>(() => {
  if (!autoGroupResult.value) return {}
  const map: Record<string, string> = {}
  for (const group of autoGroupResult.value.groups) {
    if (!group.color) continue
    if (group.sectorMacro && !map[group.sectorMacro]) {
      map[group.sectorMacro] = group.color
    }
    for (const sectorMacro of group.coverageSectorMacros) {
      if (!map[sectorMacro]) map[sectorMacro] = group.color
    }
  }
  return map
})

function handleSelectTradeStation(groupId: string, selection: TradeStationSelection) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  const virtualTradeStationPosition = selection.type === 'virtual' && group.sectorMacro
    ? group.virtualTradeStationPosition ?? getVirtualTradeStationDefaultPosition(group.sectorMacro)
    : group.virtualTradeStationPosition
  groups[idx] = { ...group, selectedTradeStation: selection, virtualTradeStationPosition }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleResetTradeStations() {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((group) => {
    if (!group.sectorMacro) return group
    const cands = tradeStationCandidates.value[group.id]
    if (cands === undefined) return group
    if (group.tradeStationRetainEnabled && group.savedTradeStationCode) {
      return { ...group, selectedTradeStation: { type: 'player' as const, stationCode: group.savedTradeStationCode } }
    }
    if (cands.length === 0) {
      return { ...group, selectedTradeStation: { type: 'virtual' as const, stationCode: '__virtual__' } }
    }
    const aDefault = determineDefaultTradeStation(cands)
    if (aDefault) return { ...group, selectedTradeStation: aDefault }
    return { ...group, selectedTradeStation: undefined }
  })
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleMasterTradeStationRetain(enabled: boolean) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((g) => ({ ...g, tradeStationRetainEnabled: enabled }))
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleToggleTradeStationRetain(groupId: string) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, tradeStationRetainEnabled: !groups[idx]!.tradeStationRetainEnabled }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleReorderGroups(nextGroups: GroupDraftInfo[]) {
  if (!canReorderGroups()) return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  if (nextGroups.length !== result.groups.length) return

  const currentById = new Map(result.groups.map((group) => [group.id, group]))
  const nextIds = nextGroups.map((group) => group.id)
  if (new Set(nextIds).size !== result.groups.length) return
  if (nextIds.some((id) => !currentById.has(id))) return

  const groups = nextIds.map((id) => currentById.get(id)!)
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

const showConfirmPopup = ref(false)

function toConfirmedBaselineGroup(group: GroupDraftInfo): GroupDraftInfo {
  return {
    ...group,
    baseline: true,
    isNew: false,
    isPinned: true
  }
}

function handleConfirm() {
  if (!autoGroupResult.value) return false
  if (hasUnresolvedTradeStations.value) return false
  if (hasUncertainAssignments.value && !showConfirmPopup.value) {
    showConfirmPopup.value = true
    return false
  }
  showConfirmPopup.value = false
  doConfirm()
  return true
}

function doConfirm() {
  const guid = activeViewStore.activeBinding
  if (!guid) return
  const result = autoGroupResult.value!
  saveBindingStore.createAutoGroups(guid, result.groups, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap, prefJumpRange.value, bridgeSearchJumpRange.value, prefThreshold.value, gameDataStore.sectorReachability)
  const activeBinding = saveBindingStore.activeBinding
  if (activeBinding) {
    for (const group of result.groups) {
      const sel = group.selectedTradeStation
      if (!sel) continue
    const bindingGroup = activeBinding.groups.find((g) =>
        group.sectorMacro && g.sectorMacro === group.sectorMacro
      )
      if (!bindingGroup) continue
      if (sel.type === 'virtual') {
        const draftPosition = (group as GroupDraftInfo & { virtualTradeStationPosition?: { x: number; y: number; z: number } }).virtualTradeStationPosition
        saveBindingStore.upsertTradeStation({
          gameGuid: guid,
          groupId: bindingGroup.sectorMacro || group.id,
          name: group.name,
          sectorMacro: group.sectorMacro,
          position: draftPosition ?? bindingGroup.tradeStation?.position
        })
      } else {
        const archive = saveStore.selectedArchive
        const station = archive?.sectors?.[group.sectorMacro!]?.player_stations?.[sel.stationCode]
        saveBindingStore.upsertTradeStation({
          gameGuid: guid,
          groupId: bindingGroup.sectorMacro || group.id,
          saveStationCode: sel.stationCode,
          name: group.name,
          sectorMacro: group.sectorMacro,
          position: station?.position
        })
      }
    }
  }
  liveStore.applyVirtualStationDraftsToBinding()
  const binding = saveBindingStore.activeBinding
  if (binding) {
    const archiveTime = saveStore.selectedArchive?.meta?.time ?? 0
    binding.appliedAutoGroupArchiveTime = archiveTime
  }
  saveBindingStore.saveBinding()
  liveStore.syncAllBindingStationsToStateMap()
  liveStore.syncLiveFlowMap()
  // Update baseline to confirmed state
  const confirmedGroups = result.groups.map(toConfirmedBaselineGroup)
  console.log('[auto-sector-confirm][doConfirm]', 'after-save', JSON.stringify({
    resultGroups: confirmedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      isNew: group.isNew,
      baseline: group.baseline,
      selectedTradeStation: group.selectedTradeStation
    })),
    bindingGroups: saveBindingStore.activeBinding?.groups.map((group) => ({
      id: group.sectorMacro,
      name: group.name,
      tradeStation: group.tradeStation,
      coverage: group.coverageSectorMacros.map((sector) => sector.ref),
      connectedGroupIds: group.connectedGroupIds
    })) ?? []
  }))
  const groupAnchors = new Set(confirmedGroups.map((g) => g.sectorMacro).filter(Boolean) as string[])
  liveStore.setAutoGroupResult({
    ...result,
    groups: confirmedGroups,
    assignments: result.assignments.filter((a) => !groupAnchors.has(a.sectorMacro))
  })
  liveStore.refreshCalcBaselinePillStateFromBinding()
}

function triggerAutoGroup() {
  const binding = saveBindingStore.activeBinding
  if (binding) {
    if (binding.prefJumpRange !== undefined) prefJumpRange.value = binding.prefJumpRange
    if (binding.bridgeSearchJumpRange !== undefined) bridgeSearchJumpRange.value = binding.bridgeSearchJumpRange
    if (binding.prefThreshold !== undefined) prefThreshold.value = binding.prefThreshold
  }
  runAutoGroup({ force: true })
}

function handleUploadComplete() {
  const archive = saveStore.selectedArchive
  if (!archive) return
  const guid = archive.meta.guid
  if (activeViewStore.activeBinding && guid !== activeViewStore.activeBinding) return
  saveBindingStore.createOrOpenBinding(guid)
  activeViewStore.switchToBinding(guid)
  triggerAutoGroup()
}

const empireDerivedProductionFlows = computed(() => liveStore.empireDerivedProductionFlows)

const overviewBuyMultiplier = computed({
  get: () => liveStore.overviewBuyMultiplier,
  set: (value: number) => { liveStore.overviewBuyMultiplier = value }
})

const overviewSellMultiplier = computed({
  get: () => liveStore.overviewSellMultiplier,
  set: (value: number) => { liveStore.overviewSellMultiplier = value }
})

watch(() => activeViewStore.activeBinding, async (newGuid) => {
  if (newGuid) {
    await liveStore.activateBinding(newGuid)
  }
})

watch(() => saveStore.selectedArchive, () => {
  // No auto-run; user explicitly triggers calculation
})

onMounted(async () => {
  const gameGuid = activeViewStore.activeBinding
  if (gameGuid) {
    await liveStore.activateBinding(gameGuid)
  }
})

const hasUncertainAssignments = computed(() => {
  if (!autoGroupResult.value) return false
  if (hasPendingBridgeDecision.value) return true
  return autoGroupResult.value.assignments.some(isUnresolvedAssignment)
})

function isUnresolvedAssignment(assignment: SectorAssignment): boolean {
  return assignment.selectedOptionIndex === null &&
    (assignment.status === 'uncertain_tie' || assignment.status === 'uncertain_extend' || assignment.status === 'unresolved_no_candidate')
}

const hasPendingBridgeDecision = computed(() => {
  return hasPendingBridgeDecisionInResult(autoGroupResult.value)
})

const hasAutoResult = computed(() => autoGroupResult.value !== null && autoGroupResult.value.groups.length > 0)

const stationCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  const archive = saveStore.selectedArchive
  if (!archive) return counts
  for (const [macro, sector] of Object.entries(archive.sectors)) {
    const stCount = sector.player_stations ? Object.keys(sector.player_stations).length : 0
    if (stCount > 0) counts[macro] = stCount
  }
  return counts
})

const canDisableNode = computed(() => {
  if (!autoGroupResult.value) return false
  return autoGroupResult.value.groups.some((g) => g.isPinned || g.baseline)
})

const bridgeRetainState = computed(() => getRetainSummary(autoGroupResult.value?.groups ?? [], 'connectionRetainEnabled'))
const coverageRetainState = computed(() => getRetainSummary(autoGroupResult.value?.groups ?? [], 'coverageRetainEnabled'))
const tradeStationRetainState = computed(() => getRetainSummary(autoGroupResult.value?.groups ?? [], 'tradeStationRetainEnabled'))

const bridgeRetainEnabled = computed(() => bridgeRetainState.value.checked)
const coverageRetainEnabled = computed(() => coverageRetainState.value.checked)
const tradeStationRetainEnabled = computed(() => tradeStationRetainState.value.checked)

const bridgeRetainIndeterminate = computed(() => bridgeRetainState.value.indeterminate)
const coverageRetainIndeterminate = computed(() => coverageRetainState.value.indeterminate)
const tradeStationRetainIndeterminate = computed(() => tradeStationRetainState.value.indeterminate)

return {
  t,
  prefJumpRange,
  bridgeSearchJumpRange,
  prefThreshold,
  nodeEnabled,
  bridgeRetainEnabled,
  coverageRetainEnabled,
  showHubAddMenu,
    autoGroupResult,
    canDragGroups,
    calculationMode,
    calcBaselinePillState,
    gameDataMaps,
    sectorReachability,
    sectorGraphInfo,
    liveMode,
    runAutoGroup,
  runCalculationFromEditInput,
  handleEnterEdit,
  handleExitEdit,
  handleUpdatePrefJumpRange,
  handleUpdateBridgeSearchJumpRange,
  handleSelectOption,
  handleCycleRecalcState,
  handleUpdateJumpRange,
  handleToggleCoverageInput,
  handleToggleConnectedInput,
  handleAddCandidateCoverage,
  handleDeleteGroup,
  handleSelectBridgeCenter,
  handleSelectBridgePlan,
  handleResetAssignments,
  handleAddHubClick,
  handleAddHubDraft,
  getExistingAnchorSectors,
  getSectorDisplayName,
  handleToggleRetainCoverage,
  handleColorChange,
  handleToggleRetainConnection,
  handleMasterBridgeRetain,
  handleMasterCoverageRetain,
  handleReorderGroups,
  handleQuickCalculate,
  handleConfirm,
  triggerAutoGroup,
  handleUploadComplete,
  needsAutoGroupRecalc,
  empireDerivedProductionFlows,
  overviewBuyMultiplier,
  overviewSellMultiplier,
  hasUncertainAssignments,
  hasPendingBridgeDecision,
  hasGlobalUnresolved,
  tradeStationCaps,
  sectorGroupColorMap,
  hasAutoResult,
  stationCounts,
  canDisableNode,
  bridgeRetainIndeterminate,
  coverageRetainIndeterminate,
  tradeStationRetainIndeterminate,
  tradeStationRetainEnabled,
  tradeStationCandidates,
  selectedTradeStations,
  blueprintEmpires,
  selectedBlueprintEmpireId,
  blueprintStationSources,
  virtualStationGroups,
  activeVirtualStationDragKey,
  formatCoordKm,
  startVirtualStationDrag,
  updateVirtualStationDrag,
  finishVirtualStationDrag,
  handleDeleteVirtualStationDraft,
  hasUnresolvedTradeStations,
  showConfirmPopup,
  hasChanges,
  unresolvedTradeStationCount,
  unresolvedAllocationCount,
  handleSelectTradeStation,
  handleResetTradeStations,
  handleMasterTradeStationRetain,
  handleToggleTradeStationRetain
}
}
