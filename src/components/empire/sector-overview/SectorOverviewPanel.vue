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
import { buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import type { BindingSectorGroup } from '@/types/x4'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import SaveList from '@/components/save/SaveList.vue'
import EmpireWareFlowsDashboard from '@/components/empire/EmpireWareFlowsDashboard.vue'
import SectorConfirmBar from './SectorConfirmBar.vue'
import SectorGroupList from './SectorGroupList.vue'
import SectorAllocationList from './SectorAllocationList.vue'
import AllocationConfirmBar from './AllocationConfirmBar.vue'

const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()
const activeViewStore = useActiveViewStore()
const saveBindingStore = useSaveBindingStore()
const liveStore = useLiveProductionStore()
const { t, te } = useI18n()

const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
const autoGroupResult = ref<AutoGroupResult | null>(null)
const postBridgeBaseline = ref<AutoGroupResult | null>(null)
const autoGroupConfirmed = ref(false)
const calculationMode = ref<'result' | 'edit'>('result')
const editSnapshot = ref<{
  result: AutoGroupResult | null
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
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
    disabledCoverageSectorMacros: [],
    disabledConnectedGroupIds: [],
    isNew: false,
    recalcState: 'pin',
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
  const excludedSectorMacros = autoGroupResult.value.groups
    .filter((group) => group.recalcState === 'exclude' && group.sectorMacro)
    .map((group) => group.sectorMacro!)
  const baseGroups = autoGroupResult.value.groups
    .filter((group) => group.recalcState !== 'exclude' && (!group.isNew || group.recalcState === 'pin'))
    .map((group, index) => ({
      id: group.id,
      name: group.name,
      order: index,
      sectorMacro: group.sectorMacro,
      jumpRange: group.jumpRange,
      connectedGroupIds: [...group.connectedGroupIds]
        .filter((id) => !group.disabledConnectedGroupIds.includes(id)),
      coverageSectorMacros: group.coverageSectorMacros
        .filter((ref) => !group.disabledCoverageSectorMacros.includes(ref))
        .map((ref) => ({ ref, jump: 0 }))
    }))
  return baseGroups.length > 0 || excludedSectorMacros.length > 0
    ? { baseGroups, excludedSectorMacros }
    : null
}

function runCalculationFromEditInput() {
  const archive = saveStore.selectedArchive
  const guid = activeViewStore.activeBinding
  const recalculateInput = buildRecalculateBaseGroups()
  if (!archive || !archive.isValid || !guid) return
  autoGroupConfirmed.value = false

  if (!recalculateInput || recalculateInput.baseGroups.length === 0) {
    const excludedSectorMacros = recalculateInput?.excludedSectorMacros ?? []
    const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
    const result = groupCleanSlate(
      archive,
      gameDataStore.modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: prefThreshold.value },
      prefJumpRange.value,
      bridgeSearchJumpRange.value,
      excludedSectorMacros
    )
    const namedGroups = result.groups.map((group) => ({
      ...group,
      name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
    }))
    setAutoGroupResult({ ...result, groups: namedGroups })
    calculationMode.value = 'result'
    editSnapshot.value = null
    return
  }
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  const result = groupIncremental(
    archive,
    recalculateInput.baseGroups,
    gameDataStore.modulesByMacroId,
    sectorGraph,
    sectorClusterMap,
    { containerThreshold: prefThreshold.value },
    prefJumpRange.value,
    bridgeSearchJumpRange.value,
    recalculateInput.excludedSectorMacros
  )
  const namedGroups = result.groups.map((group) => ({
    ...group,
    name: group.sectorMacro ? getSectorDisplayName(group.sectorMacro) : group.name
  }))
  setAutoGroupResult({ ...result, groups: namedGroups })
  calculationMode.value = 'result'
  editSnapshot.value = null
}

function handleEnterEdit() {
  editSnapshot.value = {
    result: autoGroupResult.value ? cloneAutoGroupResult(autoGroupResult.value) : null,
    prefJumpRange: prefJumpRange.value,
    bridgeSearchJumpRange: bridgeSearchJumpRange.value,
    prefThreshold: prefThreshold.value
  }
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
  const current = groups[idx]!.recalcState
  const next = current === 'normal' ? 'pin' : current === 'pin' ? 'exclude' : 'normal'
  groups[idx] = { ...groups[idx]!, recalcState: next }
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
  groups[idx] = { ...group, jumpRange: range }
  autoGroupResult.value = { ...result, groups, assignments: result.assignments }
}

function toggleArrayValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function handleToggleCoverageInput(groupId: string, sectorMacro: string) {
  if (calculationMode.value !== 'edit') return
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  groups[idx] = {
    ...group,
    disabledCoverageSectorMacros: toggleArrayValue(group.disabledCoverageSectorMacros, sectorMacro)
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
  groups[idx] = {
    ...group,
    disabledConnectedGroupIds: toggleArrayValue(group.disabledConnectedGroupIds, connectedGroupId)
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

function handleConfirm() {
  if (calculationMode.value === 'edit') return
  if (!autoGroupResult.value) return
  const guid = activeViewStore.activeBinding
  if (!guid) return
  const result = autoGroupResult.value
  saveBindingStore.createAutoGroups(guid, result.groups, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap)
  saveBindingStore.saveBinding()
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
        @update:pref-jump-range="handleUpdatePrefJumpRange"
        @update:bridge-search-jump-range="handleUpdateBridgeSearchJumpRange"
        @update:pref-threshold="prefThreshold = $event"
        @edit="handleEnterEdit"
        @cancel="handleCancelEdit"
        @calculate="runCalculationFromEditInput"
      />
      <SectorGroupList
        :groups="autoGroupResult?.groups ?? []"
        :assignments="autoGroupResult?.assignments ?? []"
        :maps="gameDataMaps"
        :sector-graph="sectorGraphInfo.sectorGraph"
        :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
        :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
        :editable="calculationMode === 'edit'"
        @cycle-recalc-state="handleCycleRecalcState"
        @update-jump-range="handleUpdateJumpRange"
        @toggle-coverage-input="handleToggleCoverageInput"
        @toggle-connected-input="handleToggleConnectedInput"
      />
    </div>

    <div class="col-span-12 lg:col-span-4">
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
