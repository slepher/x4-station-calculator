<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { groupCleanSlate, groupIncremental, DEFAULT_JUMP_RANGE, applyAbsorbToResult, applyStandaloneToResult, type AutoGroupResult, type GroupDraftInfo } from '@/store/logic/autoGroup'
import { DEFAULT_HUB_CONFIG } from '@/store/logic/autoGroupHub'
import { buildSectorGraphFromMaps, getCoverageSectors } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
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
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
const autoGroupResult = ref<AutoGroupResult | null>(null)
const autoGroupConfirmed = ref(false)

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

function runAutoGroup() {
  const archive = saveStore.selectedArchive
  if (!archive || !archive.isValid) {
    autoGroupResult.value = null
    return
  }
  const guid = activeViewStore.activeBinding
  if (!guid) {
    autoGroupResult.value = null
    return
  }
  const binding = saveBindingStore.getBindingByGameGuid(guid)
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value

  if (binding && binding.groups.length > 0) {
    const result = groupIncremental(
      archive, binding.groups, gameDataStore.modulesByMacroId,
      sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value
    )
    if (result.assignments.length === 0) {
      autoGroupConfirmed.value = true
      const storeGroups: GroupDraftInfo[] = binding.groups.map((g) => ({
        id: g.id, name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
        sectorMacro: g.sectorMacro, jumpRange: g.jumpRange, originalJumpRange: g.jumpRange,
        coverageSectorMacros: g.coverageSectorMacros.map((c) => c.ref),
        connectedGroupIds: [...(g.connectedGroupIds || [])],
        isNew: false, isPinned: true, hubScore: undefined
      }))
      autoGroupResult.value = { groups: storeGroups, assignments: [], playerSectorMacros: result.playerSectorMacros }
      return
    }
    autoGroupResult.value = result
  } else {
    const result = groupCleanSlate(
      archive, gameDataStore.modulesByMacroId, sectorGraph, sectorClusterMap,
      { containerThreshold: prefThreshold.value }, prefJumpRange.value
    )
    const namedGroups = result.groups.map((g) => ({
      ...g, name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
    }))
    autoGroupResult.value = { ...result, groups: namedGroups }
  }
}

function handleRecalculate() { runAutoGroup() }

function handleSelectOption(sectorMacro: string, optionIndex: number) {
  if (!autoGroupResult.value) return
  const assignment = autoGroupResult.value.assignments.find((a) => a.sectorMacro === sectorMacro)
  if (!assignment) return
  const opt = assignment.options[optionIndex]
  if (!opt) return
  const { sectorGraph, sectorClusterMap } = sectorGraphInfo.value
  if (opt.type === 'absorb' && opt.targetGroupId) {
    autoGroupResult.value = applyAbsorbToResult(autoGroupResult.value, sectorMacro, optionIndex, sectorGraph, sectorClusterMap, prefJumpRange.value)
  }
  if (opt.type === 'standalone') {
    autoGroupResult.value = applyStandaloneToResult(autoGroupResult.value, sectorMacro, sectorGraph, sectorClusterMap, prefJumpRange.value, getSectorDisplayName)
  }
}

function handleTogglePin(groupId: string) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  groups[idx] = { ...groups[idx]!, isPinned: !groups[idx]!.isPinned }
  autoGroupResult.value = { groups, assignments: result.assignments, playerSectorMacros: result.playerSectorMacros }
}

function handleUpdateJumpRange(groupId: string, range: number) {
  if (!autoGroupResult.value) return
  const result = autoGroupResult.value
  const groups = [...result.groups]
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) return
  const group = groups[idx]!
  const occupiedByOthers = new Set<string>()
  for (let i = 0; i < groups.length; i++) {
    if (i === idx) continue
    groups[i]!.coverageSectorMacros.forEach((m) => occupiedByOthers.add(m))
    if (groups[i]!.sectorMacro) occupiedByOthers.add(groups[i]!.sectorMacro!)
  }
  const newCoverage = group.sectorMacro
    ? getCoverageSectors(group.sectorMacro, range, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap)
        .map((c) => c.sectorMacro)
        .filter((m) => result.playerSectorMacros.includes(m) && !occupiedByOthers.has(m) && m !== group.sectorMacro)
    : group.coverageSectorMacros
  groups[idx] = { ...group, jumpRange: range, coverageSectorMacros: newCoverage }
  autoGroupResult.value = { groups, assignments: result.assignments, playerSectorMacros: result.playerSectorMacros }
}

function handleConfirm() {
  if (!autoGroupResult.value) return
  const guid = activeViewStore.activeBinding
  if (!guid) return
  const result = autoGroupResult.value
  saveBindingStore.createAutoGroups(guid, result.groups, sectorGraphInfo.value.sectorGraph, sectorGraphInfo.value.sectorClusterMap)
  saveBindingStore.saveBinding()
  autoGroupConfirmed.value = true
  const binding = saveBindingStore.activeBinding
  if (binding && binding.groups.length > 0) {
    const storeGroups: GroupDraftInfo[] = binding.groups.map((g) => ({
      id: g.id, name: g.sectorMacro ? getSectorDisplayName(g.sectorMacro) : g.name,
      sectorMacro: g.sectorMacro, jumpRange: g.jumpRange, originalJumpRange: g.jumpRange,
      coverageSectorMacros: g.coverageSectorMacros.map((c) => c.ref),
      connectedGroupIds: [...(g.connectedGroupIds || [])],
      isNew: false, isPinned: true, hubScore: undefined
    }))
    autoGroupResult.value = { groups: storeGroups, assignments: [], playerSectorMacros: result.playerSectorMacros }
  }
}

function triggerAutoGroup() {
  autoGroupConfirmed.value = false
  runAutoGroup()
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
  return autoGroupResult.value.assignments.some(
    (a) => a.selectedOptionIndex === null && (a.status === 'uncertain_tie' || a.status === 'uncertain_extend')
  )
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
        v-if="!autoGroupConfirmed"
        :pref-jump-range="prefJumpRange"
        :pref-threshold="prefThreshold"
        @update:pref-jump-range="prefJumpRange = $event"
        @update:pref-threshold="prefThreshold = $event"
        @recalculate="handleRecalculate"
      />
      <SectorGroupList
        :groups="autoGroupResult?.groups ?? []"
        :assignments="autoGroupResult?.assignments ?? []"
        :maps="gameDataMaps"
        :sector-graph="sectorGraphInfo.sectorGraph"
        :sector-cluster-map="sectorGraphInfo.sectorClusterMap"
        :player-sector-macros="autoGroupResult?.playerSectorMacros ?? []"
        :editable="!autoGroupConfirmed"
        @toggle-pin="handleTogglePin"
        @update-jump-range="handleUpdateJumpRange"
      />
    </div>

    <div class="col-span-12 lg:col-span-4">
      <AllocationConfirmBar
        v-if="hasAutoResult && !autoGroupConfirmed"
        :has-uncertain="hasUncertainAssignments"
        @confirm="handleConfirm"
      />
      <SectorAllocationList
        v-if="hasAutoResult && !autoGroupConfirmed"
        :assignments="autoGroupResult?.assignments ?? []"
        :groups="autoGroupResult?.groups ?? []"
        :maps="gameDataMaps"
        :station-counts="stationCounts"
        @select-option="handleSelectOption"
      />
      <EmpireWareFlowsDashboard
        v-if="!hasAutoResult || autoGroupConfirmed"
        :production-flows="liveStore.empireDerivedProductionFlows"
        :buy-multiplier="liveStore.overviewBuyMultiplier"
        :sell-multiplier="liveStore.overviewSellMultiplier"
        @update:buy-multiplier="liveStore.overviewBuyMultiplier = $event"
        @update:sell-multiplier="liveStore.overviewSellMultiplier = $event"
      />
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
</style>
