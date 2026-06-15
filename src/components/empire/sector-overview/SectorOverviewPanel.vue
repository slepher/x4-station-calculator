<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { groupCleanSlate, groupIncremental, DEFAULT_JUMP_RANGE, DEFAULT_BRIDGE_SEARCH_JUMP_RANGE, applyAbsorbToResult, applyStandaloneToResult, applyBridgePlanToDraft, type AutoGroupResult, type GroupDraftInfo } from '@/store/logic/autoGroup'
import { DEFAULT_HUB_CONFIG } from '@/store/logic/autoGroupHub'
import { buildSectorGraphFromMaps, getCoverageSectors } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import type { BindingSectorGroup } from '@/types/x4'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorConfirmBar from './SectorConfirmBar.vue'
import SectorGroupList from './SectorGroupList.vue'
import SectorAllocationList from './SectorAllocationList.vue'
import AllocationConfirmBar from './AllocationConfirmBar.vue'
import SectorHubAddMenu from './SectorHubAddMenu.vue'

const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()
const activeViewStore = useActiveViewStore()
const saveBindingStore = useSaveBindingStore()
const liveStore = useLiveProductionStore()
const { t, te } = useI18n()

const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
const nodeEnabled = ref(true)
const bridgeRetainEnabled = ref(true)
const coverageRetainEnabled = ref(true)
const showHubAddMenu = ref(false)
const autoGroupResult = ref<AutoGroupResult | null>(null)
const postBridgeBaseline = ref<AutoGroupResult | null>(null)
const autoGroupConfirmed = ref(false)
const calculationMode = ref<'result' | 'edit'>('result')
const editSnapshot = ref<{
  result: AutoGroupResult | null
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
  coverageByGroupId: Record<string, string[]>
  connectedGroupIdsByGroupId: Record<string, string[]>
} | null>(null)

const calcBaselinePillState = ref<{
  coverageByGroupId: Record<string, string[]>
  connectedGroupIdsByGroupId: Record<string, string[]>
} | null>(null)

const gameDataMaps = computed(() => gameDataStore.maps)

function getSectorDisplayName(macro: string): string {
  const maps = gameDataStore.maps
  if (maps) {
    const resolved = resolveMapSectorByMacro(maps, macro)
    if (resolved) {
      const nameId = (resolved.sector as any).nameId
      if (nameId && te(nameId)) return t(nameId)
      const name = (resolved.sector as any).name
      if (name) return name
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
  postBridgeBaseline.value = result && !hasPendingBridgeDecisionInResult(result)
    ? cloneAutoGroupResult(result)
    : null
  // Populate calcBaselinePillState from persisted groups if not already set (e.g., page refresh)
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
    hubScore: undefined
  }))
  return { groups: storeGroups, assignments: [], bridgePlans: [], playerSectorMacros }
}

function getPlayerSectorMacrosFromArchive(): string[] {
  const archive = saveStore.selectedArchive
  if (!archive) return []
  return Object.entries(archive.sectors)
    .filter(([, sector]) => sector.player_stations && Object.keys(sector.player_stations).length > 0)
    .map(([sectorMacro]) => sectorMacro)
}

function hasUngroupedPlayerSectors(groups: BindingSectorGroup[], playerSectorMacros: string[]): boolean {
  const covered = new Set<string>()
  for (const group of groups) {
    if (group.sectorMacro) covered.add(group.sectorMacro)
    for (const entry of group.coverageSectorMacros) covered.add(entry.ref)
  }
  return playerSectorMacros.some((sectorMacro) => !covered.has(sectorMacro))
}

function runAutoGroup() {
  const archive = saveStore.selectedArchive
  if (!archive || !archive.isValid) {
    setAutoGroupResult(null)
    return
  }
  const guid = activeViewStore.activeBinding
  if (!guid) {
    setAutoGroupResult(null)
    return
  }
  const binding = saveBindingStore.getBindingByGameGuid(guid)
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value

  if (binding && binding.groups.length > 0) {
    const playerSectorMacros = getPlayerSectorMacrosFromArchive()
    if (!hasUngroupedPlayerSectors(binding.groups, playerSectorMacros)) {
      autoGroupConfirmed.value = true
      setAutoGroupResult(buildStoreGroups(binding.groups, playerSectorMacros))
      return
    }
    const result = groupIncremental(
      archive, binding.groups, gameDataStore.modulesByMacroId,
      sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value
    )
    if (result.assignments.length === 0) {
      autoGroupConfirmed.value = true
      setAutoGroupResult(buildStoreGroups(binding.groups, result.playerSectorMacros))
      return
    }
    setAutoGroupResult(result)
  } else {
    const result = groupCleanSlate(
      archive, gameDataStore.modulesByMacroId, sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value, bridgeSearchJumpRange.value
    )
    const namedGroups = result.groups.map((g) => ({
      ...g, name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
    }))
    setAutoGroupResult({ ...result, groups: namedGroups })
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
  autoGroupConfirmed.value = false

  // Capture E2 baseline from submitted data (respects retain toggles)
  const preCalcBaseline = recalculateInput
    ? recalculateInput.baseGroups.map((bg) => ({
        id: bg.id,
        connectedGroupIds: [...(bg.connectedGroupIds || [])],
        coverageSectorMacros: bg.coverageSectorMacros.map((c) => c.ref)
      }))
    : []

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
      archive,
      gameDataStore.modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: prefThreshold.value },
      prefJumpRange.value,
      bridgeSearchJumpRange.value,
      excludedSectorMacros,
      nodeEnabled.value
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
      archive,
      recalculateInput.baseGroups,
      gameDataStore.modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: prefThreshold.value },
      prefJumpRange.value,
      bridgeSearchJumpRange.value,
      recalculateInput.excludedSectorMacros,
      nodeEnabled.value
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
    return {
      ...group,
      excludedDefaultAssignmentSectorMacros: covExcluded
    }
  })

  // Inject E2 baseline markers into result groups
  const preCalcIdSet = new Set(preCalcBaseline.map((pc) => pc.id))
  const groupsWithBaseline = restoredGroups.map((g) => ({
    ...g,
    baseline: preCalcIdSet.has(g.id),
    isPinned: true
  }))

  // Save E2 baseline pill data for result-mode display
  calcBaselinePillState.value = {
    coverageByGroupId: Object.fromEntries(
      preCalcBaseline.map((pc) => [pc.id, pc.coverageSectorMacros])
    ),
    connectedGroupIdsByGroupId: Object.fromEntries(
      preCalcBaseline.map((pc) => [pc.id, pc.connectedGroupIds])
    )
  }

  setAutoGroupResult({ ...result, groups: groupsWithBaseline })
  calculationMode.value = 'result'
  editSnapshot.value = null
}

function handleEnterEdit() {
  const result = autoGroupResult.value
  editSnapshot.value = {
    result: result ? cloneAutoGroupResult(result) : null,
    prefJumpRange: prefJumpRange.value,
    bridgeSearchJumpRange: bridgeSearchJumpRange.value,
    prefThreshold: prefThreshold.value,
    coverageByGroupId: Object.fromEntries(
      (result?.groups ?? []).map((g) => [g.id, [...g.coverageSectorMacros]])
    ),
    connectedGroupIdsByGroupId: Object.fromEntries(
      (result?.groups ?? []).map((g) => [g.id, [...g.connectedGroupIds]])
    )
  }
  if (result) {
    const groupsWithBaseline = result.groups.map((g) => ({ ...g, baseline: true, isPinned: true }))
    autoGroupResult.value = { ...result, groups: groupsWithBaseline }
  }
  // Reset retain to defaults
  bridgeRetainEnabled.value = true
  coverageRetainEnabled.value = true
  calculationMode.value = 'edit'
}

function handleCancelEdit() {
  if (!editSnapshot.value) {
    calculationMode.value = 'result'
    return
  }
  prefJumpRange.value = editSnapshot.value.prefJumpRange
  bridgeSearchJumpRange.value = editSnapshot.value.bridgeSearchJumpRange
  prefThreshold.value = editSnapshot.value.prefThreshold
  nodeEnabled.value = true
  setAutoGroupResult(editSnapshot.value.result ? cloneAutoGroupResult(editSnapshot.value.result) : null)
  calculationMode.value = 'result'
  editSnapshot.value = null
}

function handleUpdatePrefJumpRange(range: number) {
  prefJumpRange.value = range
  if (bridgeSearchJumpRange.value < range) {
    bridgeSearchJumpRange.value = range
  }
}

function handleUpdateBridgeSearchJumpRange(range: number) {
  bridgeSearchJumpRange.value = Math.max(range, prefJumpRange.value)
}

function handleSelectOption(sectorMacro: string, optionIndex: number) {
  if (calculationMode.value === 'edit') return
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

  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
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
  if (!postBridgeBaseline.value) return
  autoGroupResult.value = cloneAutoGroupResult(postBridgeBaseline.value)
}

function handleAddHubClick() {
  if (calculationMode.value !== 'edit') return
  showHubAddMenu.value = true
}

function handleAddHubDraft(sectorMacro: string) {
  if (!autoGroupResult.value) return
  showHubAddMenu.value = false
  const result = autoGroupResult.value
  const groups = [...result.groups]

  // Check conflict: if anchor is baseline coverage of another group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    if (group.baseline && group.coverageSectorMacros.includes(sectorMacro)) {
      if (result.playerSectorMacros.includes(sectorMacro)) {
        groups[i] = {
          ...group,
          excludedDefaultAssignmentSectorMacros: [...group.excludedDefaultAssignmentSectorMacros, sectorMacro]
        }
      }
    } else if (!group.baseline && group.coverageSectorMacros.includes(sectorMacro)) {
      groups[i] = {
        ...group,
        coverageSectorMacros: group.coverageSectorMacros.filter((m) => m !== sectorMacro)
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
    hubScore: undefined
  }
  groups.push(newGroup)
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
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

function handleConfirm() {
  if (calculationMode.value === 'edit') return
  if (!autoGroupResult.value) return
  const guid = activeViewStore.activeBinding
  if (!guid) return
  const result = autoGroupResult.value
  saveBindingStore.createAutoGroups(guid, result.groups, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap)
  saveBindingStore.saveBinding()
  liveStore.syncAllBindingStationsToStateMap()
  liveStore.syncLiveFlowMap()
  autoGroupConfirmed.value = true
  const binding = saveBindingStore.activeBinding
  if (binding && binding.groups.length > 0) {
    setAutoGroupResult(buildStoreGroups(binding.groups, result.playerSectorMacros))
  }
}

function triggerAutoGroup() {
  autoGroupConfirmed.value = false
  runAutoGroup()
  calculationMode.value = 'result'
  editSnapshot.value = null
}

defineExpose({ triggerAutoGroup })

watch(() => activeViewStore.activeBinding, (newGuid) => {
  if (newGuid) {
    liveStore.activateBinding(newGuid)
    runAutoGroup()
  }
})

watch(() => saveStore.selectedArchive, (archive) => {
  if (archive && activeViewStore.activeBinding) {
    runAutoGroup()
  }
})

onMounted(() => {
  const gameGuid = activeViewStore.activeBinding
  if (gameGuid) {
    liveStore.activateBinding(gameGuid)
    runAutoGroup()
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
</script>

<template>
  <div class="main-layout">
    <div class="col-span-12 lg:col-span-3">
      <div class="overview-left-panel panel-card">
        <div class="panel-header">{{ t('save_import.title') }}</div>
        <div class="panel-content">
          <SaveUploadPanel @upload-complete="() => { const archive = saveStore.selectedArchive; if (archive) { const guid = archive.meta.guid; if (!activeViewStore.activeBinding || guid === activeViewStore.activeBinding) { saveBindingStore.createOrOpenBinding(guid); activeViewStore.switchToBinding(guid); triggerAutoGroup() } } }" />
          <SaveList @bind-complete="triggerAutoGroup" />
        </div>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-5">
      <SectorConfirmBar
        v-if="hasAutoResult"
        :pref-jump-range="prefJumpRange"
        :bridge-search-jump-range="bridgeSearchJumpRange"
        :pref-threshold="prefThreshold"
        :mode="calculationMode"
        :node-enabled="nodeEnabled"
        :can-disable-node="canDisableNode"
        :bridge-retain-enabled="bridgeRetainEnabled"
        :coverage-retain-enabled="coverageRetainEnabled"
        :bridge-retain-indeterminate="bridgeRetainIndeterminate"
        :coverage-retain-indeterminate="coverageRetainIndeterminate"
        @update:pref-jump-range="handleUpdatePrefJumpRange"
        @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
        @update:pref-threshold="prefThreshold = $event"
        @update:node-enabled="nodeEnabled = $event"
        @update:bridge-retain-enabled="handleMasterBridgeRetain"
        @update:coverage-retain-enabled="handleMasterCoverageRetain"
        @edit="handleEnterEdit"
        @cancel="handleCancelEdit"
        @calculate="runCalculationFromEditInput"
        @add-hub="handleAddHubClick"
      />
      <SectorGroupList
        :groups="autoGroupResult?.groups ?? []"
        :assignments="autoGroupResult?.assignments ?? []"
        :maps="gameDataMaps"
        :sector-graph="sectorGraphInfo.sectorGraph"
        :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
        :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
        :editable="calculationMode === 'edit'"
        :baseline-coverage-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.coverageByGroupId : calcBaselinePillState?.coverageByGroupId
        "
        :baseline-connected-group-ids-by-group-id="
          calculationMode === 'edit' ? editSnapshot?.connectedGroupIdsByGroupId : calcBaselinePillState?.connectedGroupIdsByGroupId
        "
        @cycle-recalc-state="handleCycleRecalcState"
        @update-jump-range="handleUpdateJumpRange"
        @toggle-coverage-input="handleToggleCoverageInput"
        @toggle-connected-input="handleToggleConnectedInput"
        @add-candidate-coverage="handleAddCandidateCoverage"
        @delete-group="handleDeleteGroup"
        @toggle-retain-coverage="handleToggleRetainCoverage"
        @toggle-retain-connection="handleToggleRetainConnection"
      />
    </div>

    <div class="col-span-12 lg:col-span-4 pb-4">
      <div class="col3-workspace" :class="{ 'col3-workspace--editing': calculationMode === 'edit' }">
        <AllocationConfirmBar
          v-if="hasAutoResult && !autoGroupConfirmed && !hasPendingBridgeDecision"
          :has-uncertain="hasUncertainAssignments"
          :disabled="calculationMode === 'edit'"
          @reset="handleResetAssignments"
          @confirm="handleConfirm"
        />
        <SectorAllocationList
          v-if="hasAutoResult && !autoGroupConfirmed"
          :assignments="autoGroupResult?.assignments ?? []"
          :bridge-plans="autoGroupResult?.bridgePlans ?? []"
          :groups="autoGroupResult?.groups ?? []"
          :maps="gameDataMaps"
          :station-counts="stationCounts"
          :disabled="calculationMode === 'edit'"
          @select-option="handleSelectOption"
          @select-bridge-plan="handleSelectBridgePlan"
          @select-bridge-center="handleSelectBridgeCenter"
        />
        <EmpireWareFlowsDashboard
          v-if="!hasAutoResult || autoGroupConfirmed"
          :production-flows="liveStore.empireDerivedProductionFlows"
          :buy-multiplier="liveStore.overviewBuyMultiplier"
          :sell-multiplier="liveStore.overviewSellMultiplier"
          @update:buy-multiplier="liveStore.overviewBuyMultiplier = $event"
          @update:sell-multiplier="liveStore.overviewSellMultiplier = $event"
        />
        <div v-if="calculationMode === 'edit' && !autoGroupConfirmed" class="col3-overlay">
          <div class="col3-overlay-text">{{ t('sector.editing_input_overlay') }}</div>
        </div>
      </div>
    </div>
  </div>
  <SectorHubAddMenu
    v-if="showHubAddMenu"
    :maps="gameDataMaps"
    :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
    :existing-anchor-sector-macros="getExistingAnchorSectors()"
    :station-counts="stationCounts"
    @add-hub="handleAddHubDraft"
    @close="showHubAddMenu = false"
  />
</template>

<style scoped>
.main-layout {
  @apply grid grid-cols-12 gap-8 items-start px-4 pt-4;
}

.overview-left-panel {
  @apply flex flex-col;
}

.overview-left-panel.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.overview-left-panel .panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.overview-left-panel .panel-content {
  @apply p-4 flex flex-col gap-4 max-h-none overflow-visible;
}

.col3-workspace {
  @apply relative;
}

.col3-workspace--editing {
  @apply min-h-32;
}

.col3-overlay {
  @apply absolute inset-0 z-10 flex items-start justify-center rounded bg-slate-950/55 backdrop-blur-[1px] pt-14;
}

.col3-overlay-text {
  @apply rounded border border-slate-600/60 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 shadow-lg;
}
</style>
