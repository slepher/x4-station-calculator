<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSectorNameFilter } from '@/composables/useSectorNameFilter'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import { getCoverageSectors, buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from './mapSectorMacro'
import JumpInput from '@/components/common/JumpInput.vue'
import type { SaveBindingPlan, SectorPlan } from '@/types/x4'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'

const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
}>()

const { t, te, locale } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const sectorSearchQuery = ref('')
const { getSectorDisplayName, normalizedQuery } = useSectorNameFilter(sectorSearchQuery)

const bindMenuOpen = ref(false)
const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})
const bindMenuTargetSectorId = ref<string | null>(null)
const bindMenuTriggerEl = ref<HTMLElement | null>(null)

const activeEmpire = computed(() => empireStore.activeEmpire)

const activeBindingPlan = computed<SaveBindingPlan | null>(() => {
  return empireStore.activeEmpire?.saveBindings?.find((b) => b.gameGuid === props.gameGuid) || null
})

const activeArchive = computed<SaveArchive | null>(() => {
  const binding = activeBindingPlan.value
  if (!binding) return null

  const guid = binding.gameGuid
  const selected = saveStore.selectedArchive

  if (selected && selected.meta.guid === guid) {
    const time = binding.selectedArchiveTime
    if (time === null || selected.meta.time === time) {
      return selected
    }
  }

  const group = saveStore.archives.get(guid)
  if (!group) return null

  const time = binding.selectedArchiveTime
  if (time === null) {
    return group.saves[0] || null
  }

  const archive = group.saves.find((s) => s.meta.time === time)
  return archive ?? group.saves[0] ?? null
})

interface BindingDraftState {
  sectorGroupId: string | null
  anchorSectorMacro: string | null
  jumpRange: number
  coverage: string[]
}

const initialDraftState = (): BindingDraftState => ({
  sectorGroupId: null,
  anchorSectorMacro: null,
  jumpRange: 2,
  coverage: []
})

const draft = ref<BindingDraftState>(initialDraftState())

// Helper functions for draft management
function closeDraft() {
  draft.value = initialDraftState()
}

function isDraftOpen(): boolean {
  return draft.value.sectorGroupId !== null
}

interface SectorWithStations {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  stations: PlayerStationEntry[]
}

const saveSectors = computed<SectorWithStations[]>(() => {
  if (!activeArchive.value) return []

  const sectorsMap = new Map<string, PlayerStationEntry[]>()

  for (const [sectorMacro, sector] of Object.entries(activeArchive.value.sectors)) {
    const stations = sector.playerStations || []
    if (stations.length > 0) {
      sectorsMap.set(sectorMacro, stations)
    }
  }

  const results: SectorWithStations[] = []

  for (const [sectorMacro, stations] of sectorsMap) {
    const fallbackName = activeArchive.value.sectors[sectorMacro]?.name || sectorMacro
    const names = getSectorDisplayName(sectorMacro, fallbackName)

    results.push({
      ...names,
      stations
    })
  }

  return results.sort((a, b) => a.sectorName.localeCompare(b.sectorName))
})

const filteredSaveSectors = computed<SectorWithStations[]>(() => {
  if (!normalizedQuery.value) {
    return saveSectors.value.map((sector) => ({
      ...sector,
      showRawSectorName: false
    }))
  }

  return saveSectors.value
    .filter((sector) =>
      getLocalizedSectorQueryMatch({
        rawName: sector.rawSectorName,
        displayName: sector.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      }).matched
    )
    .map((sector) => {
      const match = getLocalizedSectorQueryMatch({
        rawName: sector.rawSectorName,
        displayName: sector.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      })

      const showRawSectorName =
        locale.value !== 'en' &&
        sector.rawSectorName !== sector.sectorName &&
        match.matchedRawName &&
        !match.matchedDisplayName

      return {
        ...sector,
        showRawSectorName
      }
    })
})

const empireSectors = computed<SectorPlan[]>(() => {
  if (!activeEmpire.value) return []
  return [...(activeEmpire.value.sectors || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
})

const empireSectorItems = computed(() => {
  return empireSectors.value.map(sector => {
    const groupBinding = activeBindingPlan.value?.groupBindings.find(
      (b) => b.sectorGroupId === sector.id
    )
    
    // 如果当前正在编辑此星区，使用 draft 数据
    if (draft.value.sectorGroupId === sector.id) {
      return {
        id: sector.id,
        name: sector.name,
        isBound: !!groupBinding,
        sectorMacro: groupBinding?.sectorMacro || null,
        coverageMacros: draft.value.coverage,
        jumpRange: draft.value.jumpRange,
        expanded: true
      }
    }
    
    return {
      id: sector.id,
      name: sector.name,
      isBound: !!groupBinding,
      sectorMacro: groupBinding?.sectorMacro || null,
      coverageMacros: groupBinding?.coverageSectorMacros || [],
      jumpRange: groupBinding?.jumpRange || 2,
      expanded: false
    }
  })
})

// TODO: 实现地图可见面积超过50%的星区计算
const visibleMapSectors = computed<string[]>(() => {
  return []
})

// 检查星区是否已归属其他 group（作为定位或覆盖）
function isSectorBoundToOtherGroup(sectorMacro: string, currentGroupId: string): boolean {
  if (!activeBindingPlan.value) return false
  const macroLower = sectorMacro.toLowerCase()
  
  return activeBindingPlan.value.groupBindings.some(b => {
    if (b.sectorGroupId === currentGroupId) return false
    // 检查是否是其他 group 的定位星区
    if (b.sectorMacro?.toLowerCase() === macroLower) return true
    // 检查是否是其他 group 的覆盖星区
    return b.coverageSectorMacros?.some(m => m.toLowerCase() === macroLower)
  })
}

function isSaveSectorBound(sectorMacro: string): boolean {
  if (!activeBindingPlan.value) return false
  const macroLower = sectorMacro.toLowerCase()
  
  // 检查是否是定位星区（anchor）
  const isAnchor = activeBindingPlan.value.groupBindings.some(
    b => b.sectorMacro?.toLowerCase() === macroLower
  )
  if (isAnchor) return true
  
  // 检查是否是覆盖星区
  const isCoverage = activeBindingPlan.value.groupBindings.some(
    b => b.coverageSectorMacros?.some(m => m.toLowerCase() === macroLower)
  )
  return isCoverage
}

function getBoundSectorGroupName(sectorMacro: string): string | null {
  if (!activeBindingPlan.value) return null
  const macroLower = sectorMacro.toLowerCase()
  
  // 先检查是否是某 group 的定位星区
  const anchorBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.sectorMacro?.toLowerCase() === macroLower
  )
  if (anchorBinding) {
    const sector = empireSectors.value.find((s) => s.id === anchorBinding.sectorGroupId)
    return sector?.name || null
  }
  
  // 再检查是否是某 group 的覆盖星区
  const groupBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(m => m.toLowerCase() === macroLower)
  )
  if (groupBinding) {
    const sector = empireSectors.value.find((s) => s.id === groupBinding.sectorGroupId)
    return sector?.name || null
  }
  
  return null
}

function getStationLabel(station: PlayerStationEntry): string {
  if (station.is_headquarter) {
    return t('map.save_station_headquarter')
  }
  return station.code.split('_').pop() || station.code
}

function getSectorMacroDisplayName(sectorMacro: string): string {
  const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, sectorMacro)
  if (resolved?.sectorId) {
    const cluster = gameDataStore.maps?.clusters?.[resolved.clusterId]
    const sector = cluster?.sectors?.[resolved.sectorId]
    if (sector?.nameId && te(sector.nameId)) {
      return t(sector.nameId)
    }
    return sector?.name || sectorMacro
  }
  return sectorMacro
}

function selectSaveSector(sectorMacro: string) {
  const groupBinding = activeBindingPlan.value?.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(m => m.toLowerCase() === sectorMacro.toLowerCase())
  )
  if (groupBinding) {
    emit('select-group', groupBinding.sectorGroupId)
  }
}

function updateBindMenuPosition() {
  const panel = document.querySelector('.map-binding-panel')
  const trigger = bindMenuTriggerEl.value
  if (!panel || !trigger) {
    bindMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()

  bindMenuStyle.value = {
    position: 'fixed',
    top: `${triggerRect.top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function toggleBindMenu(event: MouseEvent, sectorId: string) {
  // 如果有其他星区正在编辑，先取消它
  if (isDraftOpen() && draft.value.sectorGroupId !== sectorId) {
    cancelBinding(draft.value.sectorGroupId!)
  }
  
  if (bindMenuOpen.value && bindMenuTargetSectorId.value === sectorId) {
    closeBindMenu()
  } else {
    bindMenuTargetSectorId.value = sectorId
    bindMenuTriggerEl.value = event.currentTarget as HTMLElement
    bindMenuOpen.value = true
    nextTick(() => updateBindMenuPosition())
  }
}

function closeBindMenu() {
  bindMenuOpen.value = false
  bindMenuTargetSectorId.value = null
}

function onBindMenuGlobalPointerDown(event: MouseEvent) {
  if (!bindMenuOpen.value) return
  const menuRoot = bindMenuRef.value
  const trigger = bindMenuTriggerEl.value
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  if (trigger && trigger.contains(event.target)) return
  closeBindMenu()
}

function onBindMenuViewportChange() {
  if (!bindMenuOpen.value) return
  updateBindMenuPosition()
}

function selectSaveSectorForBinding(sectorMacro: string) {
  if (!bindMenuTargetSectorId.value) return

  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  const coverage = getCoverageSectors(sectorMacro.toLowerCase(), draft.value.jumpRange, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)

  draft.value.coverage = coverage.map(s => s.sectorMacro)
  draft.value.sectorGroupId = bindMenuTargetSectorId.value
  draft.value.anchorSectorMacro = sectorMacro

  empireStore.bindSectorGroup({
    gameGuid: props.gameGuid,
    sectorGroupId: bindMenuTargetSectorId.value,
    sectorMacro,
    jumpRange: draft.value.jumpRange,
    coverageSectorMacros: draft.value.coverage
  })

  closeBindMenu()
}

function selectVisibleSectorForBinding(sectorMacro: string) {
  selectSaveSectorForBinding(sectorMacro)
}

function isCurrentBoundSector(sectorMacro: string): boolean {
  if (!bindMenuTargetSectorId.value) return false
  const groupBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === bindMenuTargetSectorId.value
  )
  return groupBinding?.sectorMacro?.toLowerCase() === sectorMacro.toLowerCase()
}

function unbindCurrentSector() {
  if (bindMenuTargetSectorId.value) {
    empireStore.clearSectorGroupBinding(props.gameGuid, bindMenuTargetSectorId.value)
    closeBindMenu()
  }
}

function onMenuSectorClick(sectorMacro: string) {
  const currentBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === bindMenuTargetSectorId.value
  )
  
  if (currentBinding?.sectorMacro?.toLowerCase() === sectorMacro.toLowerCase()) {
    // 点击已选星区，继承之前的跳数和覆盖配置
    draft.value.jumpRange = currentBinding.jumpRange
    draft.value.coverage = [...(currentBinding.coverageSectorMacros || [])]
  } else {
    // 点击新星区，继承之前的跳数，重新计算 coverage
    // 覆盖星区 = 跳数范围内所有 save sector（不包括 anchor）
    const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
    const coverageResult = getCoverageSectors(sectorMacro.toLowerCase(), draft.value.jumpRange, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    
    // 从跳数范围内的星区中筛选出 save sector，排除 anchor
    const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro.toLowerCase()))
    draft.value.coverage = coverageResult
      .map(s => s.sectorMacro)
      .filter(m => {
        const mLower = m.toLowerCase()
        return saveSectorMacros.has(mLower) && mLower !== sectorMacro.toLowerCase()
      })
  }
  
  draft.value.sectorGroupId = bindMenuTargetSectorId.value
  draft.value.anchorSectorMacro = sectorMacro
  
  // 编辑时不写入 store，只在 draft 中操作
  closeBindMenu()
}

function cancelBinding(_sectorId: string) {
  // 直接关闭编辑状态，丢弃 draft 数据
  closeDraft()
}

function confirmBinding(sectorId: string) {
  if (!draft.value.anchorSectorMacro) {
    closeDraft()
    return
  }
  
  empireStore.bindSectorGroup({
    gameGuid: props.gameGuid,
    sectorGroupId: sectorId,
    sectorMacro: draft.value.anchorSectorMacro,
    jumpRange: draft.value.jumpRange,
    coverageSectorMacros: draft.value.coverage
  })
  closeDraft()
}

function updateDraftJumpRange(newValue: number, _oldValue?: number) {
  const oldValue = _oldValue ?? draft.value.jumpRange
  
  if (!draft.value.anchorSectorMacro) return
  
  const anchorMacro = draft.value.anchorSectorMacro.toLowerCase()
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  
  // 获取按跳数分组的星区
  const coverageByJump = new Map<number, { macro: string; isSaveSector: boolean }[]>()
  for (let jump = 1; jump <= Math.max(oldValue, newValue); jump++) {
    const result = getCoverageSectors(anchorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    
    const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro.toLowerCase()))
    
    // 筛选 save sector 并排除 anchor
    const sectorsAtJump = result
      .map(s => s.sectorMacro)
      .filter(m => {
        const mLower = m.toLowerCase()
        const isSave = saveSectorMacros.has(mLower)
        const isAnchor = mLower === anchorMacro
        return isSave && !isAnchor
      })
      .map(m => ({
        macro: m,
        isSaveSector: saveSectorMacros.has(m.toLowerCase())
      }))
    
    coverageByJump.set(jump, sectorsAtJump)
  }
  
  draft.value.jumpRange = newValue
  
  if (newValue > oldValue) {
    // 跳数增加：添加新跳数范围内但不在旧跳数范围内的 save sector
    const oldCoverageSet = new Set<string>()
    for (let jump = 1; jump <= oldValue; jump++) {
      const sectorsAtJump = coverageByJump.get(jump) || []
      sectorsAtJump.forEach(s => oldCoverageSet.add(s.macro.toLowerCase()))
    }
    
    const newCoverageSet = new Set<string>()
    for (let jump = 1; jump <= newValue; jump++) {
      const sectorsAtJump = coverageByJump.get(jump) || []
      sectorsAtJump.forEach(s => newCoverageSet.add(s.macro.toLowerCase()))
    }
    
    // 添加只在 newCoverage 中但不在 oldCoverage 中的星区
    for (const sectorLower of newCoverageSet) {
      if (!oldCoverageSet.has(sectorLower)) {
        // 找到原始大小写的 sectorMacro
        const originalMacro = Array.from(coverageByJump.values())
          .flat()
          .find(s => s.macro.toLowerCase() === sectorLower)?.macro
        if (originalMacro && !draft.value.coverage.some(m => m.toLowerCase() === sectorLower)) {
          draft.value.coverage.push(originalMacro)
        }
      }
    }
    draft.value.jumpRange = newValue
  } else if (newValue < oldValue) {
    // 跳数减少：移除超出跳数的星区
    const sectorsToKeep = new Set<string>()
    
    // 收集0到newValue跳的所有星区
    for (let jump = 1; jump <= newValue; jump++) {
      const sectorsAtJump = coverageByJump.get(jump) || []
      sectorsAtJump.forEach(s => sectorsToKeep.add(s.macro.toLowerCase()))
    }
    
    // 只保留在范围内的星区
    draft.value.coverage = draft.value.coverage.filter(m => sectorsToKeep.has(m.toLowerCase()))
    draft.value.jumpRange = newValue
  }
}

// 获取指定跳数的覆盖星区
function getCoverageSectorsAtJump(jump: number): string[] {
  if (!draft.value.anchorSectorMacro) return []
  
  const anchorMacro = draft.value.anchorSectorMacro.toLowerCase()
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  
  // 获取当前跳数的结果
  const result = getCoverageSectors(anchorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
  
  // 获取前一跳的结果（用于计算差值）
  const prevResult = jump > 1 
    ? getCoverageSectors(anchorMacro, jump - 1, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    : []
  
  const prevMacros = new Set(prevResult.map(s => s.sectorMacro.toLowerCase()))
  
  // 筛选：在当前跳但不在前一跳的 save sector（不包括 anchor）
  const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro.toLowerCase()))
  const sectorsAtJump = result
    .map(s => s.sectorMacro)
    .filter(m => {
      const mLower = m.toLowerCase()
      return saveSectorMacros.has(mLower) && 
             mLower !== anchorMacro && 
             !prevMacros.has(mLower)
    })
  
  // 返回在当前 coverage 中的星区
  const coverageSet = new Set(draft.value.coverage.map(m => m.toLowerCase()))
  return sectorsAtJump.filter(m => coverageSet.has(m.toLowerCase()))
}

// 获取非展开状态下按跳数分组的覆盖星区
function getCollapsedCoverageByJump(anchorMacro: string, jumpRange: number, coverageMacros: string[]): Map<number, string[]> {
  const result = new Map<number, string[]>()
  if (!anchorMacro) return result
  
  const anchorLower = anchorMacro.toLowerCase()
  const coverageSet = new Set(coverageMacros.map(m => m.toLowerCase()))
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  
  const prevMacros = new Set<string>()
  
  for (let jump = 1; jump <= jumpRange; jump++) {
    const coverageResult = getCoverageSectors(anchorLower, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    
    // 当前跳的星区（不包括前一跳）
    const sectorsAtJump: string[] = []
    for (const s of coverageResult) {
      const macroLower = s.sectorMacro.toLowerCase()
      if (macroLower !== anchorLower && !prevMacros.has(macroLower) && coverageSet.has(macroLower)) {
        sectorsAtJump.push(s.sectorMacro)
        prevMacros.add(macroLower)
      }
    }
    
    if (sectorsAtJump.length > 0) {
      result.set(jump, sectorsAtJump)
    }
  }
  
  return result
}

// 获取指定跳数的候选星区
function getCandidateSectorsAtJump(jump: number): string[] {
  if (!draft.value.anchorSectorMacro) return []
  
  const anchorMacro = draft.value.anchorSectorMacro.toLowerCase()
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  
  // 获取当前跳数的结果
  const result = getCoverageSectors(anchorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
  
  // 获取前一跳的结果
  const prevResult = jump > 1 
    ? getCoverageSectors(anchorMacro, jump - 1, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    : []
  
  const prevMacros = new Set(prevResult.map(s => s.sectorMacro.toLowerCase()))
  
  // 筛选：在当前跳但不在前一跳的地图星区（不包括 anchor）
  const sectorsAtJump = result
    .map(s => s.sectorMacro)
    .filter(m => {
      const mLower = m.toLowerCase()
      return mLower !== anchorMacro && !prevMacros.has(mLower)
    })
  
  // 返回不在 coverage 中的星区
  const coverageSet = new Set(draft.value.coverage.map(m => m.toLowerCase()))
  return sectorsAtJump.filter(m => !coverageSet.has(m.toLowerCase()))
}

function excludeFromCoverage(sectorMacro: string) {
  const index = draft.value.coverage.indexOf(sectorMacro)
  if (index >= 0) {
    draft.value.coverage.splice(index, 1)
  }
}

function addToCoverage(sectorMacro: string) {
  if (!draft.value.coverage.includes(sectorMacro)) {
    draft.value.coverage.push(sectorMacro)
  }
}

function focusSectorByMacro(sectorMacro: string) {
  emit('focus-sector', sectorMacro)
}

watch(() => props.gameGuid, () => {
  closeBindMenu()
})

onMounted(() => {
  document.addEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.addEventListener('resize', onBindMenuViewportChange)
  window.addEventListener('scroll', onBindMenuViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.removeEventListener('resize', onBindMenuViewportChange)
  window.removeEventListener('scroll', onBindMenuViewportChange, true)
})
</script>

<template>
  <div class="binding-sector-group">
    <!-- Empire Sectors -->
    <div class="section-header">{{ t('map.binding_empire_sectors') }}</div>
    <div v-if="empireSectors.length === 0" class="empty-hint">
      {{ t('map.binding_no_empire_sectors') }}
    </div>
    <div v-else class="empire-sectors">
      <div
        v-for="sector in empireSectorItems"
        :key="sector.id"
        class="empire-sector-item"
        :class="{ expanded: sector.expanded, bound: sector.isBound }"
        @click="sector.isBound && !sector.expanded && emit('select-group', sector.id)"
      >
        <div class="empire-sector-header">
          <span class="empire-sector-name">{{ sector.name }}</span>
          <template v-if="sector.expanded">
            <div class="header-actions">
              <button class="cancel-btn" type="button" @click.stop="cancelBinding(sector.id)">{{ t('map.binding_cancel') }}</button>
              <button class="confirm-btn" type="button" @click.stop="confirmBinding(sector.id)">{{ t('map.binding_confirm') }}</button>
            </div>
          </template>
          <button
            v-else-if="!sector.isBound"
            class="bind-btn"
            type="button"
            @click.stop="toggleBindMenu($event, sector.id)"
          >
            {{ t('map.binding_bind') }}
            <svg class="bind-btn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button
            v-else
            class="bound-sector-btn"
            type="button"
            @click.stop="toggleBindMenu($event, sector.id)"
          >
            {{ t('map.binding_already_bound') }}
            <svg class="bound-btn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <!-- Expanded Configuration -->
        <div v-if="sector.expanded" class="empire-sector-config">
          <!-- Anchor Sector and Jump Range -->
          <div class="config-header-row">
            <div class="anchor-sector">
              <label class="config-label">{{ t('map.binding_anchor_sector') }}</label>
              <span
                v-if="draft.anchorSectorMacro"
                class="pill pill--anchor pill--clickable"
                @click.stop="focusSectorByMacro(draft.anchorSectorMacro)"
              >
                {{ getSectorMacroDisplayName(draft.anchorSectorMacro) }}
              </span>
              <span v-else class="anchor-name">-</span>
            </div>
            <div class="jump-control">
              <label class="config-label">{{ t('map.binding_jump_range') }}</label>
              <JumpInput
                v-model="draft.jumpRange"
                :min="0"
                :max="5"
                @update:model-value="updateDraftJumpRange"
                @change="({ oldValue, newValue }) => updateDraftJumpRange(newValue, oldValue)"
              />
            </div>
          </div>

          <!-- Coverage Sectors by Jump -->
          <div class="config-section">
            <label class="config-label">{{ t('map.binding_coverage_sectors') }}</label>
            <div v-for="jump in draft.jumpRange" :key="jump" class="jump-group">
              <div v-if="getCoverageSectorsAtJump(jump).length > 0" class="jump-group-header">
                <span class="jump-number">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                <div class="pill-list">
                  <span
                    v-for="macro in getCoverageSectorsAtJump(jump)"
                    :key="macro"
                    class="pill pill--coverage pill--clickable"
                    @click.stop="focusSectorByMacro(macro)"
                  >
                    {{ getSectorMacroDisplayName(macro) }}
                    <button class="pill-x" type="button" @click.stop="excludeFromCoverage(macro)">×</button>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Candidate Sectors by Jump -->
          <div class="config-section">
            <label class="config-label">{{ t('map.binding_candidate_sectors') }}</label>
            <div v-for="jump in draft.jumpRange" :key="jump" class="jump-group">
              <div v-if="getCandidateSectorsAtJump(jump).length > 0" class="jump-group-header">
                <span class="jump-number">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                <div class="pill-list">
                  <span
                    v-for="macro in getCandidateSectorsAtJump(jump)"
                    :key="macro"
                    class="pill pill--clickable"
                    :class="{ 
                      'pill--candidate': !isSectorBoundToOtherGroup(macro, sector.id),
                      'pill--orange': isSectorBoundToOtherGroup(macro, sector.id)
                    }"
                    @click.stop="focusSectorByMacro(macro)"
                  >
                    {{ getSectorMacroDisplayName(macro) }}
                    <button 
                      v-if="!isSectorBoundToOtherGroup(macro, sector.id)"
                      class="pill-plus" 
                      type="button" 
                      @click.stop="addToCoverage(macro)"
                    >+</button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsed Binding Pills -->
        <div v-else-if="sector.isBound && sector.sectorMacro" class="collapsed-binding-pills">
          <!-- Anchor Sector -->
          <div class="collapsed-pill-row">
            <span
              class="pill pill--anchor pill--clickable"
              @click.stop="focusSectorByMacro(sector.sectorMacro!)"
            >
              {{ getSectorMacroDisplayName(sector.sectorMacro) }}
            </span>
          </div>
          <!-- Coverage Sectors -->
          <template v-if="sector.coverageMacros.length > 0">
            <div
              v-for="jump in sector.jumpRange"
              :key="jump"
              class="collapsed-pill-row"
            >
              <template v-if="getCollapsedCoverageByJump(sector.sectorMacro!, sector.jumpRange, sector.coverageMacros).get(jump)?.length">
                <span class="jump-label">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                <span
                  v-for="macro in getCollapsedCoverageByJump(sector.sectorMacro!, sector.jumpRange, sector.coverageMacros).get(jump)"
                  :key="macro"
                  class="pill pill--small pill--clickable"
                  @click.stop="focusSectorByMacro(macro)"
                >
                  {{ getSectorMacroDisplayName(macro) }}
                </span>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Save Sectors -->
    <div class="section-header">{{ t('map.binding_save_sectors') }}</div>
    <div class="search-wrap">
      <input
        v-model="sectorSearchQuery"
        class="search-input"
        :placeholder="t('map.save_coord_search_placeholder')"
        type="text"
      />
      <button
        v-if="sectorSearchQuery"
        class="search-clear"
        type="button"
        @click="sectorSearchQuery = ''"
      >
        ×
      </button>
    </div>
    <div class="sector-stats">
      {{ filteredSaveSectors.reduce((sum, s) => sum + s.stations.length, 0) }} {{ t('map.save_coord_count') }}
    </div>

    <div v-if="filteredSaveSectors.length === 0" class="empty-hint">
      {{ t('map.binding_no_sectors') }}
    </div>

    <div v-else class="save-sectors">
      <div
        v-for="sector in filteredSaveSectors"
        :key="sector.sectorMacro"
        class="save-sector-item"
        :class="{ bound: isSaveSectorBound(sector.sectorMacro) }"
        @click="selectSaveSector(sector.sectorMacro)"
      >
        <div class="save-sector-header">
          <span class="save-sector-name">
            {{ sector.sectorName }}
            <span v-if="sector.showRawSectorName" class="sector-raw">({{ sector.rawSectorName }})</span>
          </span>
          <span class="save-sector-count">{{ sector.stations.length }}</span>
        </div>
        <div v-if="isSaveSectorBound(sector.sectorMacro)" class="save-sector-pills">
          <span class="pill pill--small pill--bound-tag pill--clickable" @click.stop="focusSectorByMacro(sector.sectorMacro)">
            {{ getBoundSectorGroupName(sector.sectorMacro) }}
          </span>
        </div>
        <div class="station-tags">
          <span
            v-for="station in sector.stations"
            :key="station.code"
            class="station-tag"
          >
            {{ getStationLabel(station) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bind Menu -->
    <Teleport to="body">
      <div
        v-if="bindMenuOpen"
        class="bind-menu"
        ref="bindMenuRef"
        :style="bindMenuStyle"
      >
        <div class="bind-menu-group">
          <div class="bind-menu-group-title">{{ t('map.binding_save_sector_candidates') }}</div>
          <template v-if="filteredSaveSectors.length <= 10">
            <button
              v-for="sector in filteredSaveSectors"
              :key="sector.sectorMacro"
              type="button"
              class="bind-menu-item"
              :class="{ 
                active: isCurrentBoundSector(sector.sectorMacro),
                orange: isSectorBoundToOtherGroup(sector.sectorMacro, bindMenuTargetSectorId || '')
              }"
              :disabled="isSectorBoundToOtherGroup(sector.sectorMacro, bindMenuTargetSectorId || '')"
              @click="onMenuSectorClick(sector.sectorMacro)"
            >
              <span>{{ sector.sectorName }}</span>
              <button
                v-if="isCurrentBoundSector(sector.sectorMacro)"
                class="bind-menu-item-unbind"
                type="button"
                @click.stop="unbindCurrentSector()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          </template>
          <div v-else class="bind-menu-hint">
            {{ t('map.binding_filter_hint_search') }}
          </div>
          <div v-if="filteredSaveSectors.length === 0" class="bind-menu-empty">
            {{ t('map.binding_no_unbound_sectors') }}
          </div>
        </div>

        <div class="bind-menu-group">
          <div class="bind-menu-group-title">{{ t('map.binding_visible_sector_candidates') }}</div>
          <template v-if="visibleMapSectors.length > 0 && visibleMapSectors.length <= 10">
            <button
              v-for="macro in visibleMapSectors"
              :key="macro"
              type="button"
              class="bind-menu-item"
              @click="selectVisibleSectorForBinding(macro)"
            >
              {{ getSectorMacroDisplayName(macro) }}
            </button>
          </template>
          <div v-else-if="visibleMapSectors.length > 10" class="bind-menu-hint">
            {{ t('map.binding_filter_hint_zoom') }}
          </div>
          <div v-else class="bind-menu-empty">
            {{ t('map.binding_no_visible_sectors') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.binding-sector-group {
  @apply flex flex-col gap-3;
}

.search-wrap {
  @apply relative;
}

.search-input {
  @apply w-full rounded-lg border border-amber-300/30 bg-black/50 px-3 py-2 text-sm text-amber-50 outline-none placeholder:text-amber-100/40;
}

.search-clear {
  @apply absolute right-2 top-1/2 -translate-y-1/2 text-amber-100/60 hover:text-amber-50;
}

.section-header {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.sector-stats {
  @apply text-xs text-amber-100/50;
}

.empty-hint {
  @apply text-center text-sm text-amber-100/40;
}

.empire-sectors {
  @apply flex flex-col gap-2;
}

.empire-sector-item {
  @apply rounded border border-amber-300/20 bg-black/40 p-2 transition-colors cursor-pointer hover:border-amber-200/40;
}

.empire-sector-item.bound {
  @apply cursor-pointer;
}

.empire-sector-item.expanded {
  @apply border-amber-200/50 bg-black/60;
}

.empire-sector-header {
  @apply flex items-center justify-between gap-2;
}

.empire-sector-name {
  @apply text-sm text-amber-100;
}

.bind-btn {
  @apply inline-flex items-center gap-1 whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.bind-btn-chevron {
  @apply h-3 w-3;
}

.bound-sector-btn {
  @apply inline-flex items-center gap-1 whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.bound-btn-chevron {
  @apply h-3 w-3;
}

.header-actions {
  @apply flex items-center gap-0.5;
}

.cancel-btn {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100;
}

.confirm-btn {
  @apply rounded bg-amber-200/20 px-2 py-1 text-xs text-amber-50;
}

.empire-sector-config {
  @apply mt-3 flex flex-col gap-3 border-t border-amber-300/15 pt-3;
}

.config-header-row {
  @apply flex items-center justify-between gap-4;
}

.anchor-sector {
  @apply flex flex-col gap-1;
}

.anchor-name {
  @apply text-sm text-amber-100;
}

.jump-control {
  @apply flex flex-col gap-1 items-end;
}

.config-section {
  @apply flex flex-col gap-2;
}

.jump-group {
  @apply flex flex-col gap-1;
}

.jump-group-header {
  @apply flex items-start gap-2;
}

.jump-number {
  @apply shrink-0 text-xs text-amber-100/50 w-8;
}

.config-label {
  @apply text-xs text-amber-100/60;
}

.coverage-pills {
  @apply mt-2 flex flex-wrap gap-1 items-center;
}

.collapsed-binding-pills {
  @apply mt-2 flex flex-col gap-1;
}

.collapsed-pill-row {
  @apply flex flex-wrap gap-1 items-center;
}

.row-label {
  @apply text-xs text-amber-100/50 mr-1;
}

.jump-label {
  @apply text-xs text-amber-100/50 mr-0.5;
}

.pill {
  @apply inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs;
}

.pill--clickable {
  @apply cursor-pointer transition-colors hover:bg-amber-200/20 hover:text-amber-50;
}

.pill--coverage {
  @apply border-amber-300/30 bg-amber-200/10 text-amber-100;
}

.pill--anchor {
  @apply border-amber-200/40 bg-amber-200/15 text-amber-50 text-sm;
}

.pill--candidate {
  @apply border-amber-300/20 bg-transparent text-amber-100/60;
}

.pill--orange {
  @apply border-orange-300/30 bg-orange-200/10 text-orange-200;
}

.pill--small {
  @apply border-amber-300/20 bg-amber-200/5 text-amber-100/75;
}

.pill--bound-tag {
  @apply border-amber-200/30 bg-amber-200/10 text-amber-100;
}

.pill--more {
  @apply bg-transparent text-amber-100/50;
}

.pill-x,
.pill-plus {
  @apply text-amber-100/60 hover:text-amber-50;
}

.save-sectors {
  @apply flex flex-col gap-2;
}

.save-sector-item {
  @apply rounded border border-amber-300/15 bg-black/30 p-2 transition-colors hover:border-amber-200/30;
}

.save-sector-item.bound {
  @apply cursor-pointer hover:bg-amber-200/5;
}

.save-sector-header {
  @apply flex items-center justify-between gap-2;
}

.save-sector-name {
  @apply text-sm text-amber-100;
}

.sector-raw {
  @apply text-xs text-amber-100/50;
}

.save-sector-count {
  @apply text-xs text-amber-100/50;
}

.save-sector-pills {
  @apply mt-1 flex flex-wrap gap-1;
}

.station-tags {
  @apply mt-1 flex flex-wrap gap-1;
}

.station-tag {
  @apply rounded-full bg-amber-200/10 px-2 py-0.5 text-xs text-amber-100/70;
}

.bind-menu {
  @apply fixed z-[100] min-w-[40px] w-auto max-h-[300px] overflow-y-auto rounded-lg border-2 border-amber-400 bg-black/95 py-2 shadow-2xl;
  backdrop-filter: blur(12px);
  scrollbar-width: thin;
  scrollbar-color: rgba(251, 191, 36, 0.55) transparent;
}

.bind-menu::-webkit-scrollbar {
  width: 6px;
}

.bind-menu::-webkit-scrollbar-track {
  @apply rounded-full bg-slate-900/35;
}

.bind-menu::-webkit-scrollbar-thumb {
  @apply rounded-full bg-amber-300/45;
}

.bind-menu::-webkit-scrollbar-thumb:hover {
  @apply bg-amber-200/60;
}

.bind-menu-group {
  @apply px-1;
}

.bind-menu-group-title {
  @apply px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.bind-menu-item {
  @apply flex items-center justify-between whitespace-nowrap rounded px-3 py-2 text-left text-sm text-amber-100 transition-colors hover:bg-amber-200/10;
}

.bind-menu-item.active {
  @apply bg-amber-200/15 text-amber-50;
}

.bind-menu-item.orange {
  @apply text-orange-200;
}

.bind-menu-item.orange:hover {
  @apply bg-transparent;
}

.bind-menu-item:disabled {
  @apply cursor-not-allowed opacity-50;
}

.bind-menu-item-unbind {
  @apply ml-2 inline-flex h-4 w-4 items-center justify-center rounded text-amber-100/55 hover:text-amber-50;
}

.bind-menu-hint {
  @apply px-3 py-2 text-xs text-amber-100/50;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}
</style>