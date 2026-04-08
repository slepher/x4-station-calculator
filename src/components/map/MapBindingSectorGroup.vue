<script setup lang="ts">
import draggable from 'vuedraggable'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSectorNameFilter } from '@/composables/useSectorNameFilter'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import { getCoverageSectors, buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from './mapSectorMacro'
import { getStationPoiLabel } from './savePoiLabel'
import JumpInput from '@/components/common/JumpInput.vue'
import type { SaveBindingPlan, SectorPlan, CoverageSectorEntry } from '@/types/x4'
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
const sectorItemEls = ref<Record<string, HTMLElement | null>>({})

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

interface CoverageDraftEntry {
  ref: string
  jump: number
}

interface BindingDraftState {
  sectorGroupId: string | null
  isNew: boolean
  name: string
  anchorSectorMacro: string | null
  jumpRange: number
  coverage: CoverageDraftEntry[]
  connectedSectorGroupIds: string[]
}

const initialDraftState = (): BindingDraftState => ({
  sectorGroupId: null,
  isNew: false,
  name: '',
  anchorSectorMacro: null,
  jumpRange: 2,
  coverage: [],
  connectedSectorGroupIds: []
})

const draft = ref<BindingDraftState>(initialDraftState())
const deleteConfirmOpen = ref(false)

// Helper functions for draft management
function closeDraft() {
  draft.value = initialDraftState()
}

function isDraftOpen(): boolean {
  return draft.value.sectorGroupId !== null
}

function setSectorItemEl(sectorId: string, el: Element | null) {
  sectorItemEls.value[sectorId] = el instanceof HTMLElement ? el : null
}

function resolveSectorItemEl(el: Element | ComponentPublicInstance | null) {
  return el instanceof globalThis.HTMLElement ? el : null
}

function focusDraftItemIntoView() {
  const sectorId = draft.value.sectorGroupId
  if (!sectorId) return
  const el = sectorItemEls.value[sectorId]
  if (!el || typeof el.scrollIntoView !== 'function') return
  el.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'smooth'
  })
}

interface SectorWithStations {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  stations: PlayerStationEntry[]
}

interface AggregatedStationName {
  name: string
  count: number
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
  const items = empireSectors.value.map(sector => {
    const groupBinding = activeBindingPlan.value?.groupBindings.find(
      (b) => b.sectorGroupId === sector.id
    )
    
    // 如果当前正在编辑此星区，使用 draft 数据
    if (draft.value.sectorGroupId === sector.id) {
      return {
        id: sector.id,
        name: sector.name,
        isBound: !!groupBinding,
        sectorMacro: draft.value.anchorSectorMacro,
        coverageMacros: draft.value.coverage,
        connectedSectorGroupIds: draft.value.connectedSectorGroupIds,
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
      connectedSectorGroupIds: groupBinding?.connectedSectorGroupIds || [],
      jumpRange: groupBinding?.jumpRange || 2,
      expanded: false
    }
  })

  if (draft.value.isNew && draft.value.sectorGroupId) {
    items.push({
      id: draft.value.sectorGroupId,
      name: draft.value.name || t('map.binding_new_sector_name'),
      isBound: false,
      sectorMacro: draft.value.anchorSectorMacro,
      coverageMacros: draft.value.coverage,
      connectedSectorGroupIds: draft.value.connectedSectorGroupIds,
      jumpRange: draft.value.jumpRange,
      expanded: true
    })
  }

  return items
})

// TODO: 实现地图可见面积超过50%的星区计算
const visibleMapSectors = computed<string[]>(() => {
  return []
})

// 检查星区是否已归属其他 group（作为定位或覆盖）
function isSectorBoundToOtherGroup(sectorMacro: string, currentGroupId: string): boolean {
  if (!activeBindingPlan.value) return false

  return activeBindingPlan.value.groupBindings.some(b => {
    if (b.sectorGroupId === currentGroupId) return false
    if (b.sectorMacro === sectorMacro) return true
    return b.coverageSectorMacros?.some(entry => entry.ref === sectorMacro)
  })
}

function isSaveSectorBound(sectorMacro: string): boolean {
  if (!activeBindingPlan.value) return false
  const isAnchor = activeBindingPlan.value.groupBindings.some(
    b => b.sectorMacro === sectorMacro
  )
  if (isAnchor) return true

  const isCoverage = activeBindingPlan.value.groupBindings.some(
    b => b.coverageSectorMacros?.some(entry => entry.ref === sectorMacro)
  )
  return isCoverage
}

function getBoundSectorGroupName(sectorMacro: string): string | null {
  if (!activeBindingPlan.value) return null
  const anchorBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.sectorMacro === sectorMacro
  )
  if (anchorBinding) {
    const sector = empireSectors.value.find((s) => s.id === anchorBinding.sectorGroupId)
    return sector?.name || null
  }

  const groupBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(entry => entry.ref === sectorMacro)
  )
  if (groupBinding) {
    const sector = empireSectors.value.find((s) => s.id === groupBinding.sectorGroupId)
    return sector?.name || null
  }
  
  return null
}

function getStationDisplayName(station: PlayerStationEntry): string {
  return getStationPoiLabel({
    key: `playerStation:${station.code}`,
    code: station.code,
    category: 'playerStation',
    owner: 'player',
    sectorMacro: '',
    sectorName: '',
    position: station.position,
    tag: station.tag,
    factoryGroup: station.factoryGroup,
    productionProfile: station.productionProfile,
    profileName: station.profileName,
    is_headquarter: station.is_headquarter
  }, {
    t,
    localizedModulesMap: gameDataStore.localizedModulesMap || {},
    localizedModuleGroupsMap: gameDataStore.localizedModuleGroupsMap || {}
  })
}

function getSectorMacroDisplayName(sectorMacro: string): string {
  const maps = gameDataStore.maps
  const resolved = resolveMapSectorByMacro(maps || { clusters: {}, sectors: {} }, sectorMacro)
  if (resolved?.sectorId) {
    const sector = maps?.sectors?.[resolved.sectorId]
    if (sector?.nameId && te(sector.nameId)) {
      return t(sector.nameId)
    }
    return sector?.name || sectorMacro
  }
  return sectorMacro
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

function openAnchorSelector(event: MouseEvent, sectorId: string) {
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

  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})

  // Build coverage entries with jump distance
  const sectorJumpMap = new Map<string, number>()
  for (let jump = 1; jump <= draft.value.jumpRange; jump++) {
    const result = getCoverageSectors(sectorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    for (const s of result) {
      if (s.sectorMacro !== sectorMacro && !sectorJumpMap.has(s.sectorMacro)) {
        sectorJumpMap.set(s.sectorMacro, jump)
      }
    }
  }
  
  draft.value.coverage = Array.from(sectorJumpMap.entries()).map(([ref, jump]) => ({ ref, jump }))
  draft.value.sectorGroupId = bindMenuTargetSectorId.value
  draft.value.anchorSectorMacro = sectorMacro

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
  return groupBinding?.sectorMacro === sectorMacro
}

function isDraftBoundSector(sectorMacro: string): boolean {
  return draft.value.anchorSectorMacro === sectorMacro
}

function onMenuSectorClick(sectorMacro: string) {
  if (!bindMenuTargetSectorId.value) return
  if (isDraftBoundSector(sectorMacro)) return
  const currentSector = empireSectors.value.find((item) => item.id === bindMenuTargetSectorId.value)
  const currentBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === bindMenuTargetSectorId.value
  )
  
  if (currentBinding?.sectorMacro === sectorMacro) {
    // 点击已选星区，继承之前的跳数和覆盖配置
    draft.value.jumpRange = currentBinding.jumpRange
    draft.value.coverage = [...(currentBinding.coverageSectorMacros || [])]
  } else {
    // 点击新星区，继承之前的跳数，重新计算 coverage
    // 覆盖星区 = 跳数范围内所有 save sector（不包括 anchor）
    const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})
    
    // Build coverage entries with jump distance
    const sectorJumpMap = new Map<string, number>()
    for (let jump = 1; jump <= draft.value.jumpRange; jump++) {
      const result = getCoverageSectors(sectorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
      for (const s of result) {
        if (s.sectorMacro !== sectorMacro && !sectorJumpMap.has(s.sectorMacro)) {
          sectorJumpMap.set(s.sectorMacro, jump)
        }
      }
    }
    
    // 筛选 save sector
    const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro))
    draft.value.coverage = Array.from(sectorJumpMap.entries())
      .filter(([ref]) => saveSectorMacros.has(ref))
      .map(([ref, jump]) => ({ ref, jump }))
  }
  
  draft.value.sectorGroupId = bindMenuTargetSectorId.value
  draft.value.isNew = !currentSector
  draft.value.name = currentSector?.name || draft.value.name
  draft.value.anchorSectorMacro = sectorMacro
  draft.value.connectedSectorGroupIds = [...(currentBinding?.connectedSectorGroupIds || [])]
  
  // 编辑时不写入 store，只在 draft 中操作
  closeBindMenu()
}

function openDraft(sectorId: string) {
  if (isDraftOpen() && draft.value.sectorGroupId !== sectorId) return
  const sector = empireSectors.value.find((item) => item.id === sectorId)
  const currentBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === sectorId
  )
  draft.value = {
    sectorGroupId: sectorId,
    isNew: false,
    name: sector?.name || '',
    anchorSectorMacro: currentBinding?.sectorMacro || null,
    jumpRange: currentBinding?.jumpRange || 2,
    coverage: [...(currentBinding?.coverageSectorMacros || [])],
    connectedSectorGroupIds: [...(currentBinding?.connectedSectorGroupIds || [])]
  }
}

function cancelBinding(_sectorId: string) {
  // 直接关闭编辑状态，丢弃 draft 数据
  deleteConfirmOpen.value = false
  closeDraft()
  closeBindMenu()
}

function confirmBinding(sectorId: string) {
  if (!draft.value.anchorSectorMacro) {
    closeDraft()
    return
  }

  const resolvedName = (draft.value.name || '').trim()
  let resolvedSectorId = sectorId

  if (draft.value.isNew) {
    const created = empireStore.createSector(resolvedName)
    if (!created) {
      closeDraft()
      return
    }
    resolvedSectorId = created.id
  } else {
    empireStore.renameSector(sectorId, resolvedName || draft.value.name)
  }

  const previousBinding = activeBindingPlan.value?.groupBindings.find((binding) => binding.sectorGroupId === resolvedSectorId)
  const previousConnections = new Set(previousBinding?.connectedSectorGroupIds || [])
  const nextConnections = new Set(draft.value.connectedSectorGroupIds)

  empireStore.bindSectorGroup({
    gameGuid: props.gameGuid,
    sectorGroupId: resolvedSectorId,
    sectorMacro: draft.value.anchorSectorMacro,
    jumpRange: draft.value.jumpRange,
    coverageSectorMacros: draft.value.coverage
  })

  const relatedSectorIds = new Set([...previousConnections, ...nextConnections])
  relatedSectorIds.forEach((relatedSectorId) => {
    empireStore.setGroupConnection(props.gameGuid, resolvedSectorId, relatedSectorId, nextConnections.has(relatedSectorId))
  })

  deleteConfirmOpen.value = false
  closeDraft()
}

function updateDraftJumpRange(newValue: number, _oldValue?: number) {
  const oldValue = _oldValue ?? draft.value.jumpRange
  
  if (!draft.value.anchorSectorMacro) return
  
  const anchorMacro = draft.value.anchorSectorMacro
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})
  
  // 获取每个星区的实际跳数
  const sectorJumpMap = new Map<string, number>()
  for (let jump = 1; jump <= Math.max(oldValue, newValue, 5); jump++) {
    const result = getCoverageSectors(anchorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    for (const s of result) {
      if (s.sectorMacro !== anchorMacro && !sectorJumpMap.has(s.sectorMacro)) {
        sectorJumpMap.set(s.sectorMacro, jump)
      }
    }
  }
  
  // 获取 save sector 列表（用于自动添加）
  const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro))
  
  draft.value.jumpRange = newValue
  
  if (newValue > oldValue) {
    // 跳数增加：添加新跳数范围内但不在旧跳数范围内的 save sector
    for (const [sectorMacro, jump] of sectorJumpMap) {
      if (jump > oldValue && jump <= newValue && saveSectorMacros.has(sectorMacro)) {
        if (!draft.value.coverage.some(c => c.ref === sectorMacro)) {
          draft.value.coverage.push({ ref: sectorMacro, jump })
        }
      }
    }
  } else if (newValue < oldValue) {
    // 跳数减少：移除超出跳数的星区
    draft.value.coverage = draft.value.coverage.filter(c => c.jump <= newValue)
  }
}

// 获取指定跳数的覆盖星区
function getCoverageSectorsAtJump(jump: number): string[] {
  return draft.value.coverage
    .filter(c => c.jump === jump)
    .map(c => c.ref)
}

function getCoverageJumps() {
  return Array.from(new Set(draft.value.coverage.map((entry) => entry.jump))).sort((a, b) => a - b)
}

function getCollapsedCoverageByJump(coverageEntries: CoverageSectorEntry[]): Map<number, string[]> {
  const result = new Map<number, string[]>()

  for (const entry of coverageEntries) {
    const macros = result.get(entry.jump) || []
    macros.push(entry.ref)
    result.set(entry.jump, macros)
  }

  return result
}

// 获取指定跳数的候选星区
function getCandidateSectorsAtJump(jump: number): string[] {
  if (!draft.value.anchorSectorMacro) return []
  
  const anchorMacro = draft.value.anchorSectorMacro
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})
  
  // 获取当前跳数的结果
  const result = getCoverageSectors(anchorMacro, jump, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
  
  // 获取前一跳的结果
  const prevResult = jump > 1 
    ? getCoverageSectors(anchorMacro, jump - 1, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    : []
  
  const prevMacros = new Set(prevResult.map(s => s.sectorMacro))
  
  // 筛选：在当前跳但不在前一跳的地图星区（不包括 anchor）
  const sectorsAtJump = result
    .map(s => s.sectorMacro)
    .filter(m => m !== anchorMacro && !prevMacros.has(m))
  
  // 返回不在 coverage 中的星区
  const coverageRefs = new Set(draft.value.coverage.map(c => c.ref))
  return sectorsAtJump.filter(m => !coverageRefs.has(m))
}

function getCandidateJumps() {
  const jumps: number[] = []
  for (let jump = 1; jump <= draft.value.jumpRange; jump++) {
    if (getCandidateSectorsAtJump(jump).length > 0) {
      jumps.push(jump)
    }
  }
  return jumps
}

function excludeFromCoverage(sectorMacro: string) {
  const index = draft.value.coverage.findIndex(c => c.ref === sectorMacro)
  if (index >= 0) {
    draft.value.coverage.splice(index, 1)
  }
}

function addToCoverage(sectorMacro: string, jump: number) {
  if (!draft.value.coverage.some(c => c.ref === sectorMacro)) {
    draft.value.coverage.push({ ref: sectorMacro, jump })
  }
}

function createSectorAndEdit() {
  if (isDraftOpen()) return
  draft.value = {
    sectorGroupId: `draft:${crypto.randomUUID()}`,
    isNew: true,
    name: '',
    anchorSectorMacro: null,
    jumpRange: 2,
    coverage: [],
    connectedSectorGroupIds: []
  }
}

function applySectorOrder(items: Array<{ id: string }>) {
  empireStore.reorderSectors(items.map((item) => item.id))
}

function getConnectedSectorCandidates() {
  if (!draft.value.anchorSectorMacro || !draft.value.sectorGroupId) return []

  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})
  const coverage = getCoverageSectors(draft.value.anchorSectorMacro, 5, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
  const distanceMap = new Map(coverage.map((entry) => [entry.sectorMacro, entry.distance]))

  return empireSectors.value
    .filter((sector) => sector.id !== draft.value.sectorGroupId)
    .map((sector) => {
      const binding = activeBindingPlan.value?.groupBindings.find((item) => item.sectorGroupId === sector.id)
      const anchorMacro = binding?.sectorMacro
      if (!anchorMacro) return null
      const jump = distanceMap.get(anchorMacro)
      if (jump === undefined || jump <= 0 || jump > 5) return null
      return {
        sectorId: sector.id,
        name: sector.name,
        sectorMacro: anchorMacro,
        jump,
        isConnected: draft.value.connectedSectorGroupIds.includes(sector.id)
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left!.jump !== right!.jump) return left!.jump - right!.jump
      return left!.name.localeCompare(right!.name)
    }) as Array<{ sectorId: string; name: string; sectorMacro: string; jump: number; isConnected: boolean }>
}

function getConnectedCandidatesAtJump(jump: number) {
  return getConnectedSectorCandidates().filter((item) => item.jump === jump)
}

function getConnectedCandidateJumps() {
  return Array.from(new Set(getConnectedSectorCandidates().map((item) => item.jump))).sort((a, b) => a - b)
}

function toggleDraftConnection(sectorId: string, connected: boolean) {
  if (connected) {
    if (!draft.value.connectedSectorGroupIds.includes(sectorId)) {
      draft.value.connectedSectorGroupIds.push(sectorId)
    }
    return
  }
  draft.value.connectedSectorGroupIds = draft.value.connectedSectorGroupIds.filter((id) => id !== sectorId)
}

function getCollapsedConnectedSectors(sectorId: string) {
  const groupBinding = activeBindingPlan.value?.groupBindings.find((binding) => binding.sectorGroupId === sectorId)
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {}, gameDataStore.maps?.sectors || {})
  const anchorMacro = groupBinding?.sectorMacro
  const distanceMap = anchorMacro
    ? new Map(getCoverageSectors(anchorMacro, 5, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap).map((entry) => [entry.sectorMacro, entry.distance]))
    : new Map<string, number>()

  return (groupBinding?.connectedSectorGroupIds || [])
    .map((connectedId) => {
      const sector = empireSectors.value.find((item) => item.id === connectedId)
      const targetBinding = activeBindingPlan.value?.groupBindings.find((item) => item.sectorGroupId === connectedId)
      if (!sector || !targetBinding?.sectorMacro) return null
      return {
        sectorId: connectedId,
        name: sector.name,
        sectorMacro: targetBinding.sectorMacro,
        jump: distanceMap.get(targetBinding.sectorMacro) || 0
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left!.jump !== right!.jump) return left!.jump - right!.jump
      return left!.name.localeCompare(right!.name)
    }) as Array<{ sectorId: string; name: string; sectorMacro: string; jump: number }>
}

function getCollapsedConnectedAtJump(sectorId: string, jump: number) {
  return getCollapsedConnectedSectors(sectorId).filter((item) => item.jump === jump)
}

function getCollapsedConnectedJumps(sectorId: string) {
  return Array.from(new Set(getCollapsedConnectedSectors(sectorId).map((item) => item.jump))).sort((a, b) => a - b)
}

function getSaveSectorStationGroups(stations: PlayerStationEntry[]): AggregatedStationName[] {
  const names = new Map<string, number>()
  stations.forEach((station) => {
    const name = getStationDisplayName(station)
    names.set(name, (names.get(name) || 0) + 1)
  })
  return Array.from(names.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function focusSectorByMacro(sectorMacro: string) {
  emit('focus-sector', sectorMacro)
}

function requestDeleteCurrentSector() {
  if (draft.value.isNew) return
  deleteConfirmOpen.value = true
}

function cancelDeleteCurrentSector() {
  deleteConfirmOpen.value = false
}

function confirmDeleteCurrentSector() {
  if (!draft.value.sectorGroupId || draft.value.isNew) return
  empireStore.deleteSector(draft.value.sectorGroupId, props.gameGuid)
  deleteConfirmOpen.value = false
  closeDraft()
  closeBindMenu()
}

watch(() => props.gameGuid, () => {
  closeBindMenu()
})

watch(() => draft.value.sectorGroupId, async (sectorId) => {
  if (!sectorId) return
  await nextTick()
  focusDraftItemIntoView()
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
    <div class="section-header-row">
      <div class="section-header">{{ t('map.binding_empire_sectors') }}</div>
      <button class="create-sector-btn" type="button" :disabled="isDraftOpen()" @click="createSectorAndEdit">
        {{ t('map.binding_new_sector') }}
      </button>
    </div>
    <div v-if="empireSectorItems.length === 0" class="empty-hint">
      {{ t('map.binding_no_empire_sectors') }}
    </div>
    <draggable
      v-else
      :model-value="empireSectorItems"
      item-key="id"
      class="empire-sectors"
      handle=".sector-drag-handle"
      :disabled="isDraftOpen()"
      ghost-class="empire-sector-ghost"
      @update:model-value="applySectorOrder($event)"
    >
      <template #item="{ element: sector }">
      <div
        :ref="(el) => setSectorItemEl(sector.id, resolveSectorItemEl(el))"
        class="empire-sector-item"
        :class="{ expanded: sector.expanded, bound: sector.isBound }"
      >
        <div class="empire-sector-header">
          <div class="sector-title">
            <button v-if="!sector.expanded" class="sector-drag-handle sector-drag-handle--content-width" type="button" :disabled="isDraftOpen()" :title="t('map.binding_reorder_sector')">
              ⋮⋮
            </button>
            <input
              v-if="sector.expanded"
              v-model="draft.name"
              class="sector-name-input"
              type="text"
              :placeholder="t('map.binding_new_sector_name')"
            />
            <span v-else class="empire-sector-name">{{ sector.name }}</span>
          </div>
          <template v-if="sector.expanded">
            <div class="header-actions">
              <button class="anchor-select-btn" type="button" @click.stop="openAnchorSelector($event, sector.id)">
                {{ t('map.binding_bind_sector') }}&gt;
              </button>
            </div>
          </template>
          <div v-else class="header-actions">
            <button
              v-if="sector.sectorMacro"
              class="detail-icon-btn"
              type="button"
              :disabled="isDraftOpen()"
              :title="t('map.binding_view_detail')"
              :aria-label="t('map.binding_view_detail')"
              @click.stop="emit('select-group', sector.id)"
            >
              <svg viewBox="0 0 24 24" class="detail-icon" aria-hidden="true">
                <path
                  d="M5 6.5C5 5.67 5.67 5 6.5 5H17.5C18.33 5 19 5.67 19 6.5V17.5C19 18.33 18.33 19 17.5 19H6.5C5.67 19 5 18.33 5 17.5V6.5Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M8 9H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M8 12H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M8 15H13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
            <button class="bind-btn" type="button" :disabled="isDraftOpen()" @click.stop="openDraft(sector.id)">
              {{ t('map.binding_edit') }}
            </button>
          </div>
        </div>

        <!-- Expanded Configuration -->
        <div v-if="sector.expanded" class="empire-sector-config">
          <div class="config-section">
            <label class="config-label">{{ t('map.binding_anchor_sector') }}</label>
            <div class="anchor-row">
              <span
                v-if="draft.anchorSectorMacro"
                class="pill pill--anchor pill--clickable"
                @click.stop="focusSectorByMacro(draft.anchorSectorMacro)"
              >
                {{ getSectorMacroDisplayName(draft.anchorSectorMacro) }}
              </span>
              <span v-else class="anchor-name">-</span>
              <div class="jump-control-inline">
                <JumpInput
                  v-model="draft.jumpRange"
                  :min="0"
                  :max="5"
                  @update:model-value="updateDraftJumpRange"
                  @change="({ oldValue, newValue }) => updateDraftJumpRange(newValue, oldValue)"
                />
              </div>
            </div>
          </div>

          <!-- Coverage Sectors by Jump -->
          <div class="config-section">
            <label class="config-label">{{ t('map.binding_coverage_sectors') }}</label>
            <div v-for="jump in getCoverageJumps()" :key="jump" class="jump-group">
              <div class="jump-group-grid jump-group-grid--content-label jump-group-grid--pill-height-source jump-group-grid--compact-gap">
                <span class="jump-number jump-number--pill-height">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
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
            <div v-for="jump in getCandidateJumps()" :key="jump" class="jump-group">
              <div class="jump-group-grid jump-group-grid--content-label jump-group-grid--pill-height-source jump-group-grid--compact-gap">
                <span class="jump-number jump-number--pill-height">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
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
                      @click.stop="addToCoverage(macro, jump)"
                    >+</button>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="getConnectedSectorCandidates().length > 0" class="config-section">
            <label class="config-label">{{ t('map.binding_connected_sectors') }}</label>
            <div v-for="jump in getConnectedCandidateJumps()" :key="`link-${jump}`" class="jump-group">
              <div class="jump-group-grid jump-group-grid--content-label jump-group-grid--pill-height-source jump-group-grid--compact-gap">
                <span class="jump-number jump-number--pill-height">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                <div class="pill-list">
                  <span
                    v-for="candidate in getConnectedCandidatesAtJump(jump)"
                    :key="candidate.sectorId"
                    class="pill pill--clickable"
                    :class="candidate.isConnected ? 'pill--connected' : 'pill--disconnected'"
                    @click.stop="focusSectorByMacro(candidate.sectorMacro)"
                  >
                    {{ candidate.name }}:{{ getSectorMacroDisplayName(candidate.sectorMacro) }}
                    <button
                      class="pill-plus"
                      type="button"
                      @click.stop="toggleDraftConnection(candidate.sectorId, !candidate.isConnected)"
                    >
                      {{ candidate.isConnected ? '×' : '+' }}
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="deleteConfirmOpen && !draft.isNew" class="delete-confirm">
            <span class="delete-confirm-text">{{ t('map.binding_delete_sector_confirm') }}</span>
            <div class="delete-confirm-actions">
              <button class="cancel-btn" type="button" @click.stop="cancelDeleteCurrentSector">{{ t('map.binding_cancel') }}</button>
              <button class="delete-confirm-btn" type="button" @click.stop="confirmDeleteCurrentSector">{{ t('map.binding_delete') }}</button>
            </div>
          </div>

          <div class="edit-footer">
            <button
              v-if="!draft.isNew"
              class="delete-btn"
              type="button"
              @click.stop="requestDeleteCurrentSector"
            >
              {{ t('map.binding_delete') }}
            </button>
            <div class="edit-footer-actions">
              <button class="cancel-btn" type="button" @click.stop="cancelBinding(sector.id)">{{ t('map.binding_cancel') }}</button>
              <button class="confirm-btn" type="button" @click.stop="confirmBinding(sector.id)">{{ t('map.binding_confirm') }}</button>
            </div>
          </div>
        </div>

        <!-- Collapsed Binding Pills -->
        <div v-else-if="sector.isBound && sector.sectorMacro" class="collapsed-binding-pills">
          <div class="collapsed-binding-body collapsed-binding-body--flush">
            <div class="collapsed-anchor-row">
              <span class="pill pill--anchor pill--clickable" @click.stop="focusSectorByMacro(sector.sectorMacro)">
                {{ getSectorMacroDisplayName(sector.sectorMacro) }}
              </span>
            </div>
            <template v-if="sector.coverageMacros.length > 0">
              <div
                v-for="jump in sector.jumpRange"
                :key="jump"
                class="collapsed-pill-row"
              >
                <template v-if="getCollapsedCoverageByJump(sector.coverageMacros).get(jump)?.length || getCollapsedConnectedAtJump(sector.id, jump).length">
                  <div class="jump-group-grid jump-group-grid--content-label jump-group-grid--pill-height-source jump-group-grid--compact-gap collapsed-jump-group-grid">
                    <span class="jump-number jump-number--pill-height">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                    <div class="pill-list">
                      <span
                        v-for="macro in getCollapsedCoverageByJump(sector.coverageMacros).get(jump)"
                        :key="macro"
                        class="pill pill--small pill--clickable"
                        @click.stop="focusSectorByMacro(macro)"
                      >
                        {{ getSectorMacroDisplayName(macro) }}
                      </span>
                      <span
                        v-for="connected in getCollapsedConnectedAtJump(sector.id, jump)"
                        :key="connected.sectorId"
                        class="pill pill--small pill--connected pill--clickable"
                        @click.stop="focusSectorByMacro(connected.sectorMacro)"
                      >
                        {{ connected.name }}:{{ getSectorMacroDisplayName(connected.sectorMacro) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <template v-if="getCollapsedConnectedJumps(sector.id).length > 0">
              <div
                v-for="jump in getCollapsedConnectedJumps(sector.id).filter((value) => value > sector.jumpRange)"
                :key="`connected-${jump}`"
                class="collapsed-pill-row"
              >
                <template v-if="getCollapsedConnectedAtJump(sector.id, jump).length">
                  <div class="jump-group-grid jump-group-grid--content-label jump-group-grid--pill-height-source jump-group-grid--compact-gap collapsed-jump-group-grid">
                    <span class="jump-number jump-number--pill-height">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
                    <div class="pill-list">
                      <span
                        v-for="connected in getCollapsedConnectedAtJump(sector.id, jump)"
                        :key="connected.sectorId"
                        class="pill pill--small pill--connected pill--clickable"
                        @click.stop="focusSectorByMacro(connected.sectorMacro)"
                      >
                        {{ connected.name }}:{{ getSectorMacroDisplayName(connected.sectorMacro) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
      </template>
    </draggable>

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
      {{ filteredSaveSectors.length }} {{ t('map.binding_sector_count') }}
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
            v-for="station in getSaveSectorStationGroups(sector.stations)"
            :key="station.name"
            class="station-tag"
          >
            {{ station.name }}<span v-if="station.count > 1"> x{{ station.count }}</span>
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
                'draft-active': isDraftBoundSector(sector.sectorMacro),
                orange: isSectorBoundToOtherGroup(sector.sectorMacro, bindMenuTargetSectorId || '')
              }"
              :disabled="isSectorBoundToOtherGroup(sector.sectorMacro, bindMenuTargetSectorId || '')"
              @click="onMenuSectorClick(sector.sectorMacro)"
            >
              <span>{{ sector.sectorName }}</span>
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

.section-header-row {
  @apply flex items-center justify-between gap-3;
}

.create-sector-btn {
  @apply rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100 transition-colors hover:border-amber-200/50 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40;
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
  @apply rounded border border-amber-300/20 bg-black/40 p-2 transition-colors hover:border-amber-200/40;
}

.empire-sector-item.expanded {
  @apply border-amber-200/50 bg-black/60;
}

.empire-sector-header {
  @apply flex items-center justify-between gap-2;
}

.sector-title {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.empire-sector-name {
  @apply truncate text-sm text-amber-100;
}

.detail-icon-btn {
  @apply inline-flex h-7 w-7 items-center justify-center rounded text-amber-100/65 transition-colors hover:bg-amber-200/10 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40;
}

.detail-icon {
  @apply h-4 w-4;
}

.sector-drag-handle {
  @apply inline-flex items-center justify-center rounded bg-transparent text-xs text-amber-100/70 disabled:cursor-not-allowed disabled:opacity-40;
}

.sector-drag-handle--content-width {
  @apply h-7 px-0.5;
}

.sector-name-input {
  @apply h-8 w-full rounded border border-amber-300/25 bg-black/40 px-2 text-sm text-amber-50 outline-none;
}

.bind-btn {
  @apply inline-flex items-center whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.header-actions {
  @apply flex items-center gap-0.5;
}

.step3-btn,
.anchor-select-btn,
.anchor-pill-btn {
  @apply inline-flex items-center gap-1 whitespace-nowrap rounded border border-amber-300/30 bg-black/35 px-2 py-1 text-xs text-amber-100 transition-colors hover:border-amber-200/50 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40;
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

.anchor-name {
  @apply text-sm text-amber-100;
}

.anchor-row {
  @apply flex items-center justify-between gap-3;
}

.jump-control-inline {
  @apply ml-auto;
}

.config-section {
  @apply flex flex-col gap-2;
}

.jump-group {
  @apply flex flex-col gap-1;
}

.jump-group-grid {
  @apply grid items-start;
}

.jump-group-grid--content-label {
  grid-template-columns: max-content minmax(0, 1fr);
}

.jump-group-grid--pill-height-source {
  --binding-pill-height: 1.375rem;
}

.jump-group-grid--compact-gap {
  column-gap: 0.375rem;
}

.pill-list {
  @apply flex min-w-0 flex-wrap items-center gap-2;
}

.jump-number {
  @apply inline-flex items-center text-xs text-amber-100/50;
}

.jump-number--pill-height {
  height: var(--binding-pill-height);
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

.collapsed-binding-body {
  @apply flex flex-col gap-1;
}

.collapsed-binding-body--flush {
  @apply ml-0;
}

.collapsed-anchor-row {
  @apply flex items-center gap-2;
}

.collapsed-pill-row {
  @apply flex flex-col gap-1;
}

.row-label {
  @apply text-xs text-amber-100/50 mr-1;
}

.jump-label {
  @apply text-xs text-amber-100/50 mr-0.5;
}

.pill {
  @apply inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs;
  min-height: var(--binding-pill-height);
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

.pill--connected {
  @apply border-emerald-300/30 bg-emerald-500/10 text-emerald-200;
}

.pill--disconnected {
  @apply border-rose-300/30 bg-rose-500/10 text-rose-200;
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
  @apply hover:bg-amber-200/5;
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

.bind-menu-item.draft-active {
  @apply border border-amber-200/50 bg-amber-200/10 text-amber-50;
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

.bind-menu-hint {
  @apply px-3 py-2 text-xs text-amber-100/50;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}

.edit-footer {
  @apply mt-2 flex items-center justify-between gap-3 border-t border-amber-300/15 pt-3;
}

.edit-footer-actions {
  @apply ml-auto flex items-center gap-2;
}

.delete-btn {
  @apply inline-flex items-center rounded border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-sm text-rose-200 transition-colors hover:border-rose-200/60 hover:bg-rose-500/15 hover:text-rose-100;
}

.delete-confirm {
  @apply rounded border border-rose-300/35 bg-rose-500/10 p-3 text-sm text-rose-100;
}

.delete-confirm-text {
  @apply block;
}

.delete-confirm-actions {
  @apply mt-2 flex justify-end gap-2;
}

.delete-confirm-btn {
  @apply rounded border border-rose-300/40 bg-rose-500/15 px-3 py-1 text-xs text-rose-100;
}
</style>
