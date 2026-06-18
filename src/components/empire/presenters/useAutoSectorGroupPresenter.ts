import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { groupCleanSlate, groupIncremental, applyAbsorbToResult, applyStandaloneToResult, applyBridgePlanToDraft, buildAssignmentResult, type AutoGroupResult, type GroupDraftInfo, getDistance } from '@/store/logic/autoGroup'
import { buildSectorGraphFromMaps, getCoverageSectors, getPlayerStationsInSector } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { stabilizeHubColors, stabilizeEditedHubColor, type HubColorContext } from '@/store/logic/hubColor'
import { selectTradeStationCandidates, determineDefaultTradeStation, type TradeStationCandidate, type TradeStationSelection } from '@/store/logic/tradeStationSelection'
import { detectStationHub } from '@/store/logic/autoGroupHub'
import type { BindingSectorGroup, X4MapSector } from '@/types/x4'


export function useAutoSectorGroupPresenter() {
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()
const activeViewStore = useActiveViewStore()
const saveBindingStore = useSaveBindingStore()
const { activeBinding } = storeToRefs(saveBindingStore)
const liveStore = useLiveProductionStore()
const { autoGroupResult, calculationMode, prefJumpRange, bridgeSearchJumpRange, prefThreshold, needsAutoGroupRecalc, calcBaselinePillState } = storeToRefs(liveStore)
const { t, te } = useI18n()
const nodeEnabled = ref(true)
const liveMode = ref<'display' | 'calculate'>('display')

function buildHubColorContext(): HubColorContext {
  const maps = gameDataStore.maps
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value

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
      return getDistance(from, to, sectorGraph, sectorClusterMap)
    },
    maxHop: 5
  }
}
const bridgeRetainEnabled = ref(true)
const coverageRetainEnabled = ref(true)
const tradeStationRetainEnabled = ref(true)
const showHubAddMenu = ref(false)
const calculationBaseline = ref<AutoGroupResult | null>(null)

const gameDataMaps = computed(() => gameDataStore.maps)

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

const sectorGraphInfo = computed(() => {
  if (!gameDataStore.maps) return { sectorGraph: {} as Record<string, string[]>, sectorClusterMap: {} as Record<string, string> }
  return buildSectorGraphFromMaps(
    gameDataStore.maps.clusters || {},
    gameDataStore.maps.sectors || {}
  )
})

function cloneAutoGroupResult(result: AutoGroupResult): AutoGroupResult {
  return JSON.parse(JSON.stringify(result))
}

function hasPendingBridgeDecisionInResult(result: AutoGroupResult | null): boolean {
  const plans = result?.bridgePlans ?? []
  return plans.length > 1 && !plans.some((p) => p.selected)
}

function setAutoGroupResult(result: AutoGroupResult | null) {
  autoGroupResult.value = result
  calculationBaseline.value = result ? cloneAutoGroupResult(result) : null
  if (result && !calcBaselinePillState.value) {
    calcBaselinePillState.value = {
      coverageByGroupId: Object.fromEntries(
        result.groups.map((g) => [g.id, [...g.coverageSectorMacros]])
      ),
      connectedGroupIdsByGroupId: Object.fromEntries(
        result.groups.map((g) => [g.id, [...g.connectedGroupIds]])
      )
    }
  }
  applyTradeStationDefaultsToResult()
}

function buildStoreGroups(groups: BindingSectorGroup[], playerSectorMacros: string[]): AutoGroupResult {
  const storeGroups: GroupDraftInfo[] = groups.map((g) => ({
    id: g.id,
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

function runAutoGroup() {
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
  if (binding?.appliedAutoGroupArchiveTime === archiveTime && liveStore.autoGroupResult) {
    return
  }

  if (binding && binding.groups.length > 0) {
    const result = groupIncremental(
      archive, binding.groups, gameDataStore.modulesByMacroId,
      sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value
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
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value
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
      connectedGroupIds: group.connectedGroupIds.filter((connId) => {
        const other = pinnedGroups.find((g) => g.id === connId)
        if (!other) return false
        return group.connectionRetainEnabled || other.connectionRetainEnabled
      }),
      coverageSectorMacros: (group.coverageRetainEnabled ? group.coverageSectorMacros : [])
        .filter((ref) => {
          if (!group.excludedDefaultAssignmentSectorMacros.includes(ref)) return true
          return !autoGroupResult.value!.playerSectorMacros.includes(ref)
        })
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
  const excludedCoverageByAnchor: Record<string, string[]> = {}
  if (currentDraft) {
    for (const group of currentDraft.groups) {
      if (group.sectorMacro && group.excludedDefaultAssignmentSectorMacros.length > 0) {
        excludedCoverageByAnchor[group.sectorMacro] = [...group.excludedDefaultAssignmentSectorMacros]
      }
    }
  }

  let result: AutoGroupResult
  if (!recalculateInput || recalculateInput.baseGroups.length === 0) {
    const excludedSectorMacros = recalculateInput?.excludedSectorMacros ?? []
    const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
    result = groupCleanSlate(
      archive, gameDataStore.modulesByMacroId, sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value,
      excludedSectorMacros, nodeEnabled.value
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
      recalculateInput.excludedSectorMacros, nodeEnabled.value
    )
    result = {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
      }))
    }
  }

  // Re-apply excluded defaults to groups with matching anchors
  const restoredGroups = result.groups.map((group) => {
    if (!group.sectorMacro) return group
    const covExcluded = excludedCoverageByAnchor[group.sectorMacro] ?? []
    if (covExcluded.length === 0) return group
    return { ...group, excludedDefaultAssignmentSectorMacros: covExcluded }
  })

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
  const groupsWithPrevTrade = restoredGroups.map((g) => ({
    ...g,
    ...prevTradeStationByGroupId[g.id]
  }))

  stabilizeHubColors(groupsWithPrevTrade, buildHubColorContext())
  setAutoGroupResult({ ...result, groups: groupsWithPrevTrade })
  calculationMode.value = 'result'
}

function handleUpdatePrefJumpRange(range: number) {
  prefJumpRange.value = range
  if (bridgeSearchJumpRange.value < range) {
    bridgeSearchJumpRange.value = range
  }
}

function handleEnterEdit() {
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
  const newAssignments = buildAssignmentResult(unassigned, assignedSectors, result.groups, sectorGraph, sectorClusterMap)

  const prevSelected = new Map(result.assignments.map((a) => [a.sectorMacro, a.selectedOptionIndex]))
  for (const a of newAssignments) {
    const prev = prevSelected.get(a.sectorMacro)
    if (prev !== undefined && prev !== null && prev < a.options.length) {
      a.selectedOptionIndex = prev
      a.displayBucket = 'resolved'
    }
  }

  autoGroupResult.value = { ...result, assignments: newAssignments }
}

function handleUpdateBridgeSearchJumpRange(range: number) {
  bridgeSearchJumpRange.value = Math.max(range, prefJumpRange.value)
}

function handleSelectOption(sectorMacro: string, optionIndex: number) {
  if (!autoGroupResult.value) return
  const assignment = autoGroupResult.value.assignments.find((a) => a.sectorMacro === sectorMacro)
  if (!assignment) return
  const opt = assignment.options[optionIndex]
  if (!opt) return
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  if (opt.type === 'absorb' && opt.targetGroupId) {
    autoGroupResult.value = applyAbsorbToResult(autoGroupResult.value, sectorMacro, optionIndex, sectorGraph, sectorClusterMap, prefJumpRange.value, bridgeSearchJumpRange.value)
  }
  if (opt.type === 'standalone') {
    autoGroupResult.value = applyStandaloneToResult(autoGroupResult.value, sectorMacro, sectorGraph, sectorClusterMap, prefJumpRange.value, getSectorDisplayName, bridgeSearchJumpRange.value)
  }
  applyTradeStationDefaultsToResult()
}

function handleCycleRecalcState(groupId: string) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  if (group.enteredOtherGroupCoverage) return
  groups[idx] = { ...group, isPinned: !group.isPinned }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleUpdateJumpRange(groupId: string, range: number) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  const prevRange = group.jumpRange

  if (range === prevRange) return

  // Recompute coverage based on new jumpRange
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  if (group.sectorMacro && sectorGraph) {
    const distances = getCoverageSectors(group.sectorMacro, range, sectorGraph, sectorClusterMap)
    const newRangeMacros = new Set(distances.map((d) => d.sectorMacro))

    const allAnchorSectors = new Set(groups.filter((g) => g.sectorMacro).map((g) => g.sectorMacro!))

    let newCoverage: string[]
    if (range > prevRange) {
      // Build set of sectors already in other groups' active coverage
      const otherCoverage = new Set<string>()
      for (let i = 0; i < groups.length; i++) {
        if (i === idx) continue
        for (const m of groups[i]!.coverageSectorMacros) {
          otherCoverage.add(m)
        }
      }

      // Increase: only add sectors at NEW jump levels (prevRange < distance <= range)
      // Existing coverage and candidates at prior ranges are unchanged.
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
      // Decrease: remove out-of-range sectors
      newCoverage = group.coverageSectorMacros.filter((m) => newRangeMacros.has(m))
    }

    groups[idx] = { ...group, jumpRange: range, coverageSectorMacros: newCoverage }
  } else {
    groups[idx] = { ...group, jumpRange: range }
  }

  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
  rebuildAssignmentsFromGroups()
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
  setAutoGroupResult(applyBridgePlanToDraft(
    result,
    plan,
    prefJumpRange.value,
    getSectorDisplayName,
    sectorGraphInfo.value.sectorGraph,
    sectorGraphInfo.value.sectorClusterMap,
    bridgeSearchJumpRange.value
  ))
}

function handleResetAssignments() {
  if (calculationMode.value === 'edit') return
  if (!calculationBaseline.value) return
  autoGroupResult.value = cloneAutoGroupResult(calculationBaseline.value)
}

function handleAddHubClick() {
  if (calculationMode.value !== 'edit') return
  showHubAddMenu.value = !showHubAddMenu.value
}

function handleAddHubDraft(sectorMacro: string) {
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
    id: `auto_${crypto.randomUUID()}`,
    name: getSectorDisplayName(sectorMacro),
    sectorMacro,
    jumpRange: prefJumpRange.value,
    originalJumpRange: prefJumpRange.value,
    coverageSectorMacros: [],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: true,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true,
    tradeStationRetainEnabled: true,
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
  if (calculationMode.value !== 'edit') return
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
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, connectionRetainEnabled: !groups[idx]!.connectionRetainEnabled }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleMasterBridgeRetain(enabled: boolean) {
  bridgeRetainEnabled.value = enabled
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((g) => ({ ...g, connectionRetainEnabled: enabled }))
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function handleMasterCoverageRetain(enabled: boolean) {
  coverageRetainEnabled.value = enabled
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = result.groups.map((g) => ({ ...g, coverageRetainEnabled: enabled }))
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function canReorderGroups(): boolean {
  return canDragGroups.value
}

function setResultModeDefaults() {
  handleMasterBridgeRetain(false)
  handleMasterCoverageRetain(true)
  handleMasterTradeStationRetain(false)
  const guid = activeViewStore.activeBinding
  const binding = guid ? saveBindingStore.getBindingByGameGuid(guid) : null
  nodeEnabled.value = !(binding && binding.groups.length > 0)
}

function handleQuickCalculate() {
  runCalculationFromEditInput()
}

const tradeStationCandidates = computed(() => {
  const archive = saveStore.selectedArchive
  const result = autoGroupResult.value
  if (!archive || !result) return {} as Record<string, TradeStationCandidate[]>

  const candidates: Record<string, TradeStationCandidate[]> = {}
  for (const group of result.groups) {
    if (!group.sectorMacro) continue
    const stations = getPlayerStationsInSector(archive, group.sectorMacro)

    const skipQualifiedThreshold = group.source !== 'auto'
    let requireQualified = false
    if (skipQualifiedThreshold && stations.length > 0) {
      const hasQualified = stations.some((s) => {
        const info = detectStationHub(s, gameDataStore.modulesByMacroId, { containerThreshold: prefThreshold.value })
        return info.qualified
      })
      requireQualified = hasQualified
    }

    if (stations.length === 0) {
      candidates[group.id] = []
      continue
    }

    candidates[group.id] = selectTradeStationCandidates(
      stations, gameDataStore.modulesByMacroId, requireQualified,
      { containerThreshold: prefThreshold.value }
    )
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

const hasUnresolvedTradeStations = computed(() => {
  if (!autoGroupResult.value) return false
  const groupsWithCandidates = Object.keys(tradeStationCandidates.value)
  if (groupsWithCandidates.length === 0) return false
  return groupsWithCandidates.some((id) => !selectedTradeStations.value[id])
})

const hasChanges = ref(false)
watch([autoGroupResult, activeBinding], () => {
  const result = autoGroupResult.value
  const binding = activeBinding.value
  if (!result || !binding) { hasChanges.value = result !== null; return }
  if (result.groups.length !== binding.groups.length) { hasChanges.value = true; return }
  const bindingById = new Map(binding.groups.map((g) => [g.id, g]))
  for (const g of result.groups) {
    const bg = bindingById.get(g.id)
    if (!bg) { hasChanges.value = true; return }
    if (g.jumpRange !== bg.jumpRange) { hasChanges.value = true; return }
    if (g.color !== bg.color) { hasChanges.value = true; return }
    const bgCov = bg.coverageSectorMacros.map((c) => c.ref).sort()
    const gCov = [...g.coverageSectorMacros].sort()
    if (gCov.length !== bgCov.length || gCov.some((m, i) => m !== bgCov[i])) { hasChanges.value = true; return }
    const bgConns = [...(bg.connectedGroupIds ?? [])].sort()
    const gConns = [...g.connectedGroupIds].sort()
    if (gConns.length !== bgConns.length || gConns.some((c, i) => c !== bgConns[i])) { hasChanges.value = true; return }
    const savedTS = bg.tradeStation?.saveStationCode ?? ''
    const currentTS = g.selectedTradeStation?.stationCode ?? ''
    if (savedTS !== currentTS) { hasChanges.value = true; return }
  }
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

const unresolvedTradeStationGroups = computed<string[]>(() => {
  if (!hasUnresolvedTradeStations.value) return []
  return ['sector.trade_station_unresolved']
})

const unresolvedAllocationGroups = computed<string[]>(() => {
  if (hasUncertainAssignments.value || hasPendingBridgeDecision.value) {
    return ['sector.allocation_unresolved']
  }
  return []
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
  groups[idx] = { ...groups[idx]!, selectedTradeStation: selection }
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
  tradeStationRetainEnabled.value = enabled
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

function handleConfirm() {
  if (calculationMode.value === 'edit') return
  if (!autoGroupResult.value) return
  if (hasUnresolvedTradeStations.value) return
  if (hasUncertainAssignments.value && !showConfirmPopup.value) {
    showConfirmPopup.value = true
    return
  }
  showConfirmPopup.value = false
  doConfirm()
}

function doConfirm() {
  const guid = activeViewStore.activeBinding
  if (!guid) return
  const result = autoGroupResult.value!
  saveBindingStore.createAutoGroups(guid, result.groups, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap, prefJumpRange.value, bridgeSearchJumpRange.value, prefThreshold.value)
  const activeBinding = saveBindingStore.activeBinding
  if (activeBinding) {
    for (const group of result.groups) {
      const sel = group.selectedTradeStation
      if (!sel) continue
      const bindingGroup = activeBinding.groups.find((g) =>
        g.id === group.id || (group.sectorMacro && g.sectorMacro === group.sectorMacro)
      )
      if (!bindingGroup) continue
      if (sel.type === 'virtual') {
        saveBindingStore.unbindTradeStation(guid, bindingGroup.id)
      } else {
        const archive = saveStore.selectedArchive
        const station = archive?.sectors?.[group.sectorMacro!]?.player_stations?.[sel.stationCode]
        saveBindingStore.upsertTradeStation({
          gameGuid: guid,
          groupId: bindingGroup.id,
          saveStationCode: sel.stationCode,
          name: group.name,
          sectorMacro: group.sectorMacro,
          position: station?.position
        })
      }
    }
  }
  const binding = saveBindingStore.activeBinding
  if (binding) {
    const archiveTime = saveStore.selectedArchive?.meta?.time ?? 0
    binding.appliedAutoGroupArchiveTime = archiveTime
  }
  saveBindingStore.saveBinding()
  liveStore.syncAllBindingStationsToStateMap()
  liveStore.syncLiveFlowMap()
  // Update baseline to confirmed state
  const confirmedGroups = result.groups.map((g) => ({ ...g, baseline: true }))
  autoGroupResult.value = { ...result, groups: confirmedGroups }
  liveStore.calcBaselinePillState = {
    coverageByGroupId: Object.fromEntries(
      confirmedGroups.map((g) => [g.id, [...g.coverageSectorMacros]])
    ),
    connectedGroupIdsByGroupId: Object.fromEntries(
      confirmedGroups.map((g) => [g.id, [...g.connectedGroupIds]])
    )
  }
}

function triggerAutoGroup() {
  const binding = saveBindingStore.activeBinding
  if (binding) {
    if (binding.prefJumpRange !== undefined) prefJumpRange.value = binding.prefJumpRange
    if (binding.bridgeSearchJumpRange !== undefined) bridgeSearchJumpRange.value = binding.bridgeSearchJumpRange
    if (binding.prefThreshold !== undefined) prefThreshold.value = binding.prefThreshold
  }
  if (binding && binding.groups.length > 0) {
    setAutoGroupResult(buildStoreGroups(binding.groups, []))
  } else {
    setAutoGroupResult(null)
  }
  calculationMode.value = 'result'
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
  return autoGroupResult.value.assignments.some(
    (a) => a.selectedOptionIndex === null && (a.status === 'uncertain_tie' || a.status === 'uncertain_extend')
  )
})

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

let baselineInitialized = false
watch(autoGroupResult, (result) => {
  if (baselineInitialized) return
  if (result && result.groups.length > 0) {
    calculationBaseline.value = cloneAutoGroupResult(result)
    baselineInitialized = true
  }
})

watch(activeBinding, () => { baselineInitialized = false })

const bridgeRetainIndeterminate = computed(() => {
  if (!autoGroupResult.value) return false
  const groups = autoGroupResult.value.groups
  if (groups.length === 0) return false
  const allOn = groups.every((g) => g.connectionRetainEnabled)
  const allOff = groups.every((g) => !g.connectionRetainEnabled)
  return !allOn && !allOff
})

const coverageRetainIndeterminate = computed(() => {
  if (!autoGroupResult.value) return false
  const groups = autoGroupResult.value.groups
  if (groups.length === 0) return false
  const allOn = groups.every((g) => g.coverageRetainEnabled)
  const allOff = groups.every((g) => !g.coverageRetainEnabled)
  return !allOn && !allOff
})

const tradeStationRetainIndeterminate = computed(() => {
  if (!autoGroupResult.value) return false
  const groups = autoGroupResult.value.groups
  if (groups.length === 0) return false
  const allOn = groups.every((g) => !!g.tradeStationRetainEnabled)
  const allOff = groups.every((g) => !g.tradeStationRetainEnabled)
  return !allOn && !allOff
})

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
  hasUnresolvedTradeStations,
  showConfirmPopup,
  hasChanges,
  unresolvedTradeStationGroups,
  unresolvedAllocationGroups,
  handleSelectTradeStation,
  handleResetTradeStations,
  handleMasterTradeStationRetain,
  handleToggleTradeStationRetain
}
}
