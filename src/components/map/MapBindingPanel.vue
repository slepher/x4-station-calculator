<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import factoryIconUrl from '@/components/icons/factory.svg'
import shipyardIconUrl from '@/components/icons/shipyard.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'
import { useSectorNameFilter } from '@/composables/useSectorNameFilter'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import type { SaveBindingPlan, StationPlan, SectorPlan, StationSaveBinding, SavedModule } from '@/types/x4'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'
import {
  getCoverageSectors,
  buildSectorGraphFromMaps,
  resolveStationSaveBinding,
  type SectorCoverageResult
} from '@/store/logic/saveBindingUtils'
import { resolveModuleId } from '@/store/logic/blueprintParser'
import { sortModulesBySearchPriority } from '@/store/logic/searchModule'
import { resolveMapSectorByMacro } from './mapSectorMacro'

type PanelStage = 'select-binding' | 'select-sector' | 'select-station'
type PlacementIcon = 'factory' | 'shipyard' | 'tradestation'

const DRAG_START_THRESHOLD_PX = 5

export interface SaveSectorItem {
  sectorMacro: string
  sectorName: string
  playerStationCount: number
  tradeStationCount: number
}

export interface FilteredStationItem {
  station: PlayerStationEntry
  sectorMacro: string
  sectorName: string
  distance: number
  isAlreadyBound: boolean
}

export interface IdleStationItem {
  station: StationPlan
  sectorGroupId: string
  sectorGroupName: string
  sectorMacro?: string
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard'; coverageSectorMacros: string[] }): void
  (e: 'drag-station-end'): void
  (e: 'drag-free-sector-start', payload: { sectorGroupId: string; name: string; gameGuid: string }): void
  (e: 'drag-free-sector-end'): void
}>()

const { t, te, locale } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const stage = ref<PanelStage>('select-binding')
const selectedGameGuid = ref<string | null>(null)
const selectedSaveSectorMacro = ref<string | null>(null)
const selectedJumpRange = ref(3)
const selectedSectorGroupId = ref<string | null>(null)
const importStationName = ref('')
const sectorSearchQuery = ref('')
const newSectorName = ref('')
const showNewSectorInput = ref(false)
const bindingSaveStation = ref<PlayerStationEntry | null>(null)
const bindingSectorMacro = ref<string | null>(null)
const selectedEmpireStationId = ref<string | null>(null)

const pendingDrag = ref<{
  item: IdleStationItem
  startX: number
  startY: number
} | null>(null)
const activeDragStationId = ref<string | null>(null)

const pendingFreeSectorDrag = ref<{
  sector: { id: string; name: string }
  startX: number
  startY: number
} | null>(null)
const activeDragFreeSectorId = ref<string | null>(null)

const { getSectorDisplayName, normalizedQuery } = useSectorNameFilter(sectorSearchQuery)

const iconUrlByType: Record<PlacementIcon, string> = {
  factory: factoryIconUrl,
  shipyard: shipyardIconUrl,
  tradestation: tradestationIconUrl
}

const activeEmpire = computed(() => empireStore.activeEmpire)

watch(activeEmpire, async (empire) => {
  if (empire?.saveBindings) {
    const activeBinding = empire.saveBindings.find((b) => b.active)
    if (activeBinding && !selectedGameGuid.value) {
      selectedGameGuid.value = activeBinding.gameGuid
      const selected = saveStore.selectedArchive
      if (!selected || selected.meta.guid !== activeBinding.gameGuid) {
        const group = saveStore.archives.get(activeBinding.gameGuid)
        if (group && group.saves[0]) {
          const time = activeBinding.selectedArchiveTime ?? group.saves[0].meta.time
          await saveStore.selectArchive(activeBinding.gameGuid, time)
        }
      }
      stage.value = 'select-sector'
    }
  }
}, { immediate: true })

const bindingPlans = computed<SaveBindingPlan[]>(() => {
  return activeEmpire.value?.saveBindings || []
})

const activeBindingPlan = computed<SaveBindingPlan | null>(() => {
  if (!selectedGameGuid.value) return null
  return activeEmpire.value?.saveBindings?.find((b) => b.gameGuid === selectedGameGuid.value) || null
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

interface SectorWithStations {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  stations: PlayerStationEntry[]
  distance?: number
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

const sectorGraphData = computed(() => {
  const clusters = gameDataStore.maps?.clusters || {}
  return buildSectorGraphFromMaps(clusters)
})

const coverageSectors = computed<SectorCoverageResult[]>(() => {
  if (!selectedSaveSectorMacro.value) return []
  const { sectorGraph, sectorClusterMap } = sectorGraphData.value

  const normalizedStart = selectedSaveSectorMacro.value.toLowerCase()

  return getCoverageSectors(normalizedStart, selectedJumpRange.value, sectorGraph, sectorClusterMap)
})

const coverageSectorsWithStations = computed<SectorWithStations[]>(() => {
  if (!activeArchive.value || coverageSectors.value.length === 0) return []

  const coverageSet = new Set(coverageSectors.value.map(s => s.sectorMacro.toLowerCase()))
  const distanceMap = new Map(coverageSectors.value.map(s => [s.sectorMacro.toLowerCase(), s.distance]))

  const results: SectorWithStations[] = []

  for (const [sectorMacro, sector] of Object.entries(activeArchive.value.sectors)) {
    const normalizedMacro = sectorMacro.toLowerCase()
    if (!coverageSet.has(normalizedMacro)) continue

    const stations = sector.playerStations || []
    if (stations.length === 0) continue

    const distance = distanceMap.get(normalizedMacro) ?? 0
    const fallbackName = sector.name || sectorMacro
    const names = getSectorDisplayName(sectorMacro, fallbackName)

    results.push({
      ...names,
      stations,
      distance
    })
  }

  const sorted = results.sort((a, b) => {
    if ((a.distance ?? 0) !== (b.distance ?? 0)) return (a.distance ?? 0) - (b.distance ?? 0)
    return a.sectorName.localeCompare(b.sectorName)
  })

  return sorted
})

const empireSectors = computed<SectorPlan[]>(() => {
  if (!activeEmpire.value) return []
  return [...(activeEmpire.value.sectors || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
})

const freeEmpireSectors = computed<{ id: string; name: string; sectorMacro?: string }[]>(() => {
  if (!activeEmpire.value || !activeBindingPlan.value) return []
  
  return (activeEmpire.value.sectors || [])
    .map((s) => {
      const groupBinding = activeBindingPlan.value?.groupBindings.find(
        (b) => b.sectorGroupId === s.id
      )
      return {
        id: s.id,
        name: s.name,
        sectorMacro: groupBinding?.sectorMacro
      }
    })
})

const sortedArchiveGroups = computed(() => {
  return [...saveStore.archiveGroups].sort((a, b) => {
    return a.playerName.localeCompare(b.playerName)
  })
})

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getExistingBindingPlan(gameGuid: string): SaveBindingPlan | null {
  return bindingPlans.value.find((p) => p.gameGuid === gameGuid) || null
}

function hasExistingBinding(gameGuid: string): boolean {
  return bindingPlans.value.some((p) => p.gameGuid === gameGuid)
}

const idleStations = computed<IdleStationItem[]>(() => {
  if (!activeEmpire.value || !selectedSectorGroupId.value) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  const sectorStations = activeEmpire.value.stations.filter((s) => s.sectorId === selectedSectorGroupId.value)

  return sectorStations
    .filter((station) => {
      const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
      return !binding?.saveStationCode
    })
    .map((station) => {
      const sector = empireSectors.value.find((s) => s.id === station.sectorId)
      const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
      return {
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: sector?.name || '',
        sectorMacro: binding?.sectorMacro
      }
    })
})

const currentGroupBinding = computed(() => {
  if (!activeBindingPlan.value || !selectedSectorGroupId.value) return null
  return activeBindingPlan.value.groupBindings.find((b) => b.sectorGroupId === selectedSectorGroupId.value) || null
})

const isSectorBound = computed(() => {
  return currentGroupBinding.value !== null
})

function isSaveSectorBound(sectorMacro: string): boolean {
  if (!activeBindingPlan.value) return false
  return activeBindingPlan.value.groupBindings.some((b) => b.sectorMacro === sectorMacro)
}

function getBoundSectorGroupName(sectorMacro: string): string | null {
  if (!activeBindingPlan.value) return null
  const binding = activeBindingPlan.value.groupBindings.find((b) => b.sectorMacro === sectorMacro)
  if (!binding) return null
  const sector = empireSectors.value.find((s) => s.id === binding.sectorGroupId)
  return sector?.name || null
}

const tradeStationsInSelectedSector = computed(() => {
  if (!activeArchive.value || !selectedSaveSectorMacro.value) return []
  
  const sector = activeArchive.value.sectors[selectedSaveSectorMacro.value]
  if (!sector) return []
  
  return (sector.npcStations || []).filter((s) => s.isTradestation)
})

const availableArchiveTimes = computed(() => {
  if (!activeBindingPlan.value) return []
  
  const guid = activeBindingPlan.value.gameGuid
  const group = saveStore.archives.get(guid)
  if (!group) return []
  
  return group.saves.map((s) => ({
    time: s.meta.time,
    label: new Date(s.meta.time * 1000).toLocaleString()
  })).sort((a, b) => b.time - a.time)
})

const stationBindingsInGroup = computed(() => {
  if (!currentGroupBinding.value) return []
  return currentGroupBinding.value.stationBindings
})

function getStationLabel(station: PlayerStationEntry): string {
  if (station.is_headquarter) {
    return t('map.save_station_headquarter')
  }

  if (station.tag === 'factory') {
    const profile = station.productionProfile
    if (!profile) return t('map.save_npc_tag_factory')

    if (profile === 'mixed') return t('map.save_npc_profile_mixed')

    const localizedModule = gameDataStore.localizedModulesMap?.[profile]
    if (localizedModule?.localeName) return localizedModule.localeName

    const localizedGroup = gameDataStore.localizedModuleGroupsMap?.[profile]
    if (localizedGroup?.localeName) return localizedGroup.localeName

    return station.profileName || profile
  }

  const tagLabelKeys: Record<string, string> = {
    shipyard: 'map.save_npc_tag_shipyard',
    wharf: 'map.save_npc_tag_wharf',
    equipmentdock: 'map.save_npc_tag_equipmentdock',
    tradestation: 'map.save_npc_tag_tradestation',
    piratebase: 'map.save_npc_tag_piratebase',
    defencemodule: 'map.save_npc_tag_defencemodule'
  }

  const labelKey = station.tag ? tagLabelKeys[station.tag] : undefined
  if (labelKey) return t(labelKey)

  return t('map.save_category_player_station')
}

async function selectBindingPlan(plan: SaveBindingPlan | null) {
  selectedGameGuid.value = plan?.gameGuid || null
  if (plan) {
    empireStore.setActiveBinding(plan.gameGuid)
    
    const selected = saveStore.selectedArchive
    if (!selected || selected.meta.guid !== plan.gameGuid) {
      const group = saveStore.archives.get(plan.gameGuid)
      if (group && group.saves[0]) {
        const time = plan.selectedArchiveTime ?? group.saves[0].meta.time
        await saveStore.selectArchive(plan.gameGuid, time)
      }
    }
    
    stage.value = 'select-sector'
  } else {
    stage.value = 'select-binding'
  }
}

function selectSaveSector(sectorMacro: string) {
  selectedSaveSectorMacro.value = sectorMacro
  stage.value = 'select-station'

  if (activeBindingPlan.value) {
    const existingBinding = activeBindingPlan.value.groupBindings.find(
      (b) => b.sectorMacro === sectorMacro
    )
    if (existingBinding) {
      selectedSectorGroupId.value = existingBinding.sectorGroupId
      selectedJumpRange.value = existingBinding.jumpRange
    } else {
      selectedSectorGroupId.value = null
      selectedJumpRange.value = 3
    }
  }

  emit('focus-sector', sectorMacro)
}

function selectFreeSector(sectorGroupId: string) {
  selectedSectorGroupId.value = sectorGroupId
  selectedSaveSectorMacro.value = null
  stage.value = 'select-station'
}

const onFreeSectorMouseDown = (event: MouseEvent, sector: { id: string; name: string }) => {
  if (event.button !== 0) return
  if (!selectedGameGuid.value) return
  pendingFreeSectorDrag.value = {
    sector,
    startX: event.clientX,
    startY: event.clientY
  }
}

function showCreateNewSector() {
  showNewSectorInput.value = true
  newSectorName.value = ''
}

function createAndBindNewSector() {
  if (!activeEmpire.value || !newSectorName.value.trim()) return

  const sectorName = newSectorName.value.trim()
  const newSector = empireStore.createSector(sectorName)
  
  if (newSector) {
    bindSectorToGroup(newSector.id)
    newSectorName.value = ''
    showNewSectorInput.value = false
  }
}

function bindSectorToGroup(sectorGroupId: string) {
  if (!selectedGameGuid.value || !selectedSaveSectorMacro.value) return

  selectedSectorGroupId.value = sectorGroupId
  showNewSectorInput.value = false

  empireStore.bindSectorGroup({
    gameGuid: selectedGameGuid.value,
    sectorGroupId,
    sectorMacro: selectedSaveSectorMacro.value,
    jumpRange: selectedJumpRange.value,
    coverageSectorMacros: coverageSectors.value.map((s) => s.sectorMacro)
  })
}

function bindTradeStation(tradestationCode: string) {
  if (!selectedGameGuid.value || !selectedSectorGroupId.value || !selectedSaveSectorMacro.value) return

  empireStore.setTradestationBinding({
    gameGuid: selectedGameGuid.value,
    sectorGroupId: selectedSectorGroupId.value,
    saveStationCode: tradestationCode
  })
}

function clearGroupBinding() {
  if (!selectedGameGuid.value || !selectedSectorGroupId.value) return

  empireStore.clearSectorGroupBinding(selectedGameGuid.value, selectedSectorGroupId.value)
}

async function selectArchiveTime(time: number | null) {
  if (!selectedGameGuid.value || !activeBindingPlan.value) return

  empireStore.setSelectedArchiveTime(selectedGameGuid.value, time)
  
  const guid = activeBindingPlan.value.gameGuid
  const group = saveStore.archives.get(guid)
  if (group && group.saves[0]) {
    const targetTime = time ?? group.saves[0].meta.time
    await saveStore.selectArchive(guid, targetTime)
  }
}

const clearPendingDrag = () => {
  pendingDrag.value = null
  pendingFreeSectorDrag.value = null
}

const finishActiveDrag = () => {
  if (activeDragStationId.value) {
    activeDragStationId.value = null
    emit('drag-station-end')
  }
  if (activeDragFreeSectorId.value) {
    activeDragFreeSectorId.value = null
    emit('drag-free-sector-end')
  }
}

const onWindowMouseMove = (event: MouseEvent) => {
  if (pendingDrag.value && !activeDragStationId.value) {
    const dx = event.clientX - pendingDrag.value.startX
    const dy = event.clientY - pendingDrag.value.startY
    if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return
    activeDragStationId.value = pendingDrag.value.item.station.id
    const groupBinding = currentGroupBinding.value
    emit('drag-station-start', {
      stationId: pendingDrag.value.item.station.id,
      gameGuid: selectedGameGuid.value!,
      sectorGroupId: pendingDrag.value.item.sectorGroupId,
      name: pendingDrag.value.item.station.name,
      icon: pendingDrag.value.item.station.type === 'shipyard' ? 'shipyard' : 'factory',
      coverageSectorMacros: groupBinding?.coverageSectorMacros || []
    })
  }
  
  if (pendingFreeSectorDrag.value && !activeDragFreeSectorId.value) {
    const dx = event.clientX - pendingFreeSectorDrag.value.startX
    const dy = event.clientY - pendingFreeSectorDrag.value.startY
    if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return
    activeDragFreeSectorId.value = pendingFreeSectorDrag.value.sector.id
    emit('drag-free-sector-start', {
      sectorGroupId: pendingFreeSectorDrag.value.sector.id,
      name: pendingFreeSectorDrag.value.sector.name,
      gameGuid: selectedGameGuid.value!
    })
  }
}

const onWindowMouseUp = () => {
  clearPendingDrag()
  finishActiveDrag()
}

const onIdleStationMouseDown = (event: MouseEvent, item: IdleStationItem) => {
  if (event.button !== 0) return
  if (!selectedGameGuid.value) return
  pendingDrag.value = {
    item,
    startX: event.clientX,
    startY: event.clientY
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})

const clampJumpLimit = (value: number) => Math.min(5, Math.max(0, Math.round(value)))

function updateJumpLimit(nextValue: number) {
  selectedJumpRange.value = clampJumpLimit(nextValue)
}

function stepJumpLimit(delta: number) {
  updateJumpLimit(selectedJumpRange.value + delta)
}

async function selectOrCreateBinding(gameGuid: string, time: number | null) {
  let plan = getExistingBindingPlan(gameGuid)
  
  if (!plan) {
    plan = empireStore.createBinding(gameGuid)
  }
  
  if (time !== null && plan.selectedArchiveTime !== time) {
    empireStore.setSelectedArchiveTime(plan.gameGuid, time)
  }
  
  await selectBindingPlan(plan)
}

function importSaveStation(saveStation: PlayerStationEntry, sectorMacro: string) {
  if (!selectedGameGuid.value || !activeEmpire.value || !selectedSectorGroupId.value) return

  const name = importStationName.value || saveStation.code
  const newStation = empireStore.createStation(name, 'industrial')

  if (!newStation) return

  empireStore.moveStationToSector(newStation.id, selectedSectorGroupId.value)

  if (saveStation.modules && saveStation.modules.length > 0) {
    const moduleInfos: { id: string; count: number; group?: string; tier?: number; name?: string }[] = []
    for (const mod of saveStation.modules) {
      const resolvedId = resolveModuleId(
        mod.ref,
        gameDataStore.modulesMap,
        gameDataStore.modulesByMacroId
      )
      if (resolvedId) {
        const moduleData = gameDataStore.modulesMap[resolvedId]
        moduleInfos.push({
          id: resolvedId,
          count: mod.amount,
          group: moduleData?.group,
          tier: moduleData?.tier,
          name: moduleData?.name
        })
      }
    }
    
    if (moduleInfos.length > 0) {
      sortModulesBySearchPriority(moduleInfos, gameDataStore.localizedModuleGroupsMap || {})
      
      const modules: SavedModule[] = moduleInfos.map(m => ({
        id: m.id,
        count: m.count
      }))
      empireStore.updateStationModules(newStation.id, modules)
    }
  }

  empireStore.importSaveStationAsBinding({
    gameGuid: selectedGameGuid.value,
    sectorGroupId: selectedSectorGroupId.value,
    stationId: newStation.id,
    saveStation,
    sectorMacro
  })

  importStationName.value = ''
}

function clearStationBinding(stationId: string) {
  if (!selectedGameGuid.value || !selectedSectorGroupId.value) return

  empireStore.clearStationBinding(selectedGameGuid.value, selectedSectorGroupId.value, stationId)
}

function getStationBinding(stationId: string) {
  return currentGroupBinding.value?.stationBindings.find((b: StationSaveBinding) => b.stationId === stationId)
}

function getStationBindingStatus(stationId: string): 'ok' | 'missing' | 'none' {
  const binding = getStationBinding(stationId)
  if (!binding) return 'none'

  const resolved = resolveStationSaveBinding(binding, activeArchive.value)
  return resolved.status === 'ok' ? 'ok' : 'missing'
}

function isSaveStationBound(saveStationCode: string): boolean {
  const gameGuid = activeBindingPlan.value?.gameGuid
  const sectorGroupId = selectedSectorGroupId.value
  if (!gameGuid || !sectorGroupId) return false
  return empireStore.isSaveStationAlreadyBound(gameGuid, sectorGroupId, saveStationCode)
}

function startBindSaveStation(station: PlayerStationEntry, sectorMacro: string) {
  bindingSaveStation.value = station
  bindingSectorMacro.value = sectorMacro
  selectedEmpireStationId.value = null
}

function cancelBindSaveStation() {
  bindingSaveStation.value = null
  bindingSectorMacro.value = null
  selectedEmpireStationId.value = null
}

function confirmBindSaveStation() {
  if (!bindingSaveStation.value || !selectedEmpireStationId.value || !selectedGameGuid.value || !selectedSectorGroupId.value) return
  
  const success = empireStore.bindStationToSaveStation({
    gameGuid: selectedGameGuid.value,
    sectorGroupId: selectedSectorGroupId.value,
    stationId: selectedEmpireStationId.value,
    saveStationCode: bindingSaveStation.value.code,
    sectorMacro: bindingSectorMacro.value || undefined,
    position: {
      x: bindingSaveStation.value.position.x,
      y: bindingSaveStation.value.position.y,
      z: bindingSaveStation.value.position.z
    }
  })
  
  if (success) {
    cancelBindSaveStation()
  }
}

function goBack() {
  if (stage.value === 'select-station') {
    stage.value = 'select-sector'
    selectedSaveSectorMacro.value = null
    selectedSectorGroupId.value = null
  } else if (stage.value === 'select-sector') {
    stage.value = 'select-binding'
    selectedGameGuid.value = null
  }
}

function close() {
  emit('close')
}

function getSectorMacroDisplayName(sectorMacro: string): string {
  const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, sectorMacro)
  if (resolved?.sectorId) {
    const cluster = gameDataStore.maps?.clusters?.[resolved.clusterId]
    const sector = cluster?.sectors?.[resolved.sectorId]
    if (sector) {
      const nameId = sector.nameId
      if (nameId && te(nameId)) return t(nameId)
      return sector.name || sector.id
    }
  }
  return sectorMacro
}

function clearFreeSectorBinding(sectorGroupId: string) {
  if (!selectedGameGuid.value) return
  empireStore.clearSectorGroupBinding(selectedGameGuid.value, sectorGroupId)
}

function clearFreeStationBinding(stationId: string) {
  if (!selectedGameGuid.value || !selectedSectorGroupId.value) return
  empireStore.clearStationBinding(selectedGameGuid.value, selectedSectorGroupId.value, stationId)
}

watch(() => props.open, (open) => {
  if (!open) {
    stage.value = 'select-binding'
    selectedGameGuid.value = null
    selectedSaveSectorMacro.value = null
    selectedJumpRange.value = 3
    selectedSectorGroupId.value = null
    importStationName.value = ''
  }
})

watch(coverageSectorsWithStations, (sectors) => {
  if (stage.value === 'select-station' && sectors.length > 0) {
    emit('fit-sectors', sectors.map(s => s.sectorMacro))
  }
}, { flush: 'post' })
</script>

<template>
  <aside v-show="open" class="map-binding-panel" data-testid="map-binding-panel">
    <div class="map-binding-panel__header">
      <div class="map-binding-panel__nav">
        <button
          v-if="stage !== 'select-binding'"
          class="map-binding-panel__back"
          type="button"
          @click="goBack"
        >
          ←
        </button>
        <div class="map-binding-panel__title">
          {{ stage === 'select-binding' ? t('map.binding_title') :
             stage === 'select-sector' ? t('map.binding_select_sector') :
             t('map.binding_select_station') }}
        </div>
      </div>
      <button
        class="map-binding-panel__close"
        data-testid="map-binding-panel-close"
        type="button"
        @click="close"
      >
        {{ t('map.binding_close') }}
      </button>
    </div>

    <div class="map-binding-panel__body scrollbar-thin">
      <!-- Stage 1: Select Save Archive -->
      <div v-if="stage === 'select-binding'" class="map-binding-panel__section">
        <div v-if="sortedArchiveGroups.length === 0" class="map-binding-panel__empty">
          {{ t('map.binding_no_saves') }}
        </div>
        
        <div v-else class="archive-groups">
          <div
            v-for="group in sortedArchiveGroups"
            :key="group.guid"
            class="archive-group"
          >
            <button
              class="archive-group-header"
              type="button"
              @click="selectOrCreateBinding(group.guid, null)"
            >
              <span class="player-name">{{ group.playerName }}</span>
              <span class="archive-count">{{ group.saves.length }} {{ t('map.binding_station_count', { count: group.saves.length }) }}</span>
              <span v-if="hasExistingBinding(group.guid)" class="bound-badge">{{ t('map.binding_sector_bound') }}</span>
            </button>

            <div class="archive-items">
              <button
                v-for="archive in group.saves"
                :key="archive.meta.time"
                class="archive-item"
                :class="{ 'archive-item--bound': getExistingBindingPlan(group.guid)?.selectedArchiveTime === archive.meta.time }"
                type="button"
                @click="selectOrCreateBinding(group.guid, archive.meta.time)"
              >
                <div class="archive-info">
                  <div class="archive-time">{{ formatTime(archive.meta.time) }}</div>
                  <div class="archive-meta">{{ archive.meta.filename }}</div>
                </div>
                <span v-if="getExistingBindingPlan(group.guid)?.selectedArchiveTime === archive.meta.time" class="bound-tag">
                  {{ t('map.binding_sector_bound') }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 2: Select Save Sector -->
      <div v-else-if="stage === 'select-sector'" class="map-binding-panel__section">
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

        <div v-if="filteredSaveSectors.length === 0" class="map-binding-panel__empty">
          {{ t('map.binding_no_sectors') }}
        </div>

        <div v-else class="sector-groups">
          <div
            v-for="sector in filteredSaveSectors"
            :key="sector.sectorMacro"
            class="sector-group"
          >
            <button
              class="sector-card"
              type="button"
              @click="selectSaveSector(sector.sectorMacro)"
            >
              <div class="sector-header">
                <span class="sector-name">
                  {{ sector.sectorName }}
                  <span v-if="sector.showRawSectorName" class="sector-header-raw">({{ sector.rawSectorName }})</span>
                  <span v-if="isSaveSectorBound(sector.sectorMacro)" class="sector-bound-badge">{{ t('map.binding_sector_bound') }}</span>
                </span>
                <span class="sector-count">{{ sector.stations.length }}</span>
              </div>
              <div v-if="isSaveSectorBound(sector.sectorMacro)" class="sector-bound-info">
                {{ t('map.binding_bound_to') }}: {{ getBoundSectorGroupName(sector.sectorMacro) }}
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
            </button>
          </div>
        </div>

        <!-- Free Empire Sectors -->
        <div v-if="freeEmpireSectors.length > 0" class="free-sectors">
          <div class="free-sectors-header">{{ t('map.binding_free_sectors') }}</div>
          <div class="free-sectors-list">
            <div
              v-for="sector in freeEmpireSectors"
              :key="sector.id"
              class="free-sector-card"
              :class="{ 'free-sector-card--dragging': activeDragFreeSectorId === sector.id, 'free-sector-card--bound': !!sector.sectorMacro }"
              @mousedown="onFreeSectorMouseDown($event, sector)"
              @click="selectFreeSector(sector.id)"
            >
              <div class="free-sector-content">
                <div class="free-sector-name">{{ sector.name }}</div>
                <div v-if="sector.sectorMacro" class="free-sector-target">
                  <span class="free-sector-target-tag">{{ getSectorMacroDisplayName(sector.sectorMacro) }}</span>
                  <button
                    class="free-sector-clear"
                    type="button"
                    :title="t('map.station_panel_clear_action')"
                    :aria-label="t('map.station_panel_clear_action')"
                    @click.stop="clearFreeSectorBinding(sector.id)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6.5 6.5l11 11M17.5 6.5l-11 11"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-width="2"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="free-sector-handle" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 3: Bind Stations -->
      <div v-else-if="stage === 'select-station'" class="map-binding-panel__section">
        <!-- Archive Time Selector -->
        <div v-if="availableArchiveTimes.length > 1" class="archive-time">
          <label class="label">{{ t('map.binding_archive_time') }}</label>
          <select
            class="archive-select"
            :value="activeBindingPlan?.selectedArchiveTime || ''"
            @change="selectArchiveTime(Number(($event.target as HTMLSelectElement).value) || null)"
          >
            <option value="">最新</option>
            <option
              v-for="item in availableArchiveTimes"
              :key="item.time"
              :value="item.time"
            >
              {{ item.label }}
            </option>
          </select>
        </div>

        <!-- Jump Range Selector -->
        <div class="jump-range">
          <label class="label">{{ t('map.binding_jump_range') }}</label>
          <div class="jump-input-wrap">
            <input
              class="jump-input"
              type="number"
              min="0"
              max="5"
              step="1"
              :value="selectedJumpRange"
              data-testid="map-binding-jump-limit"
              @input="updateJumpLimit(Number(($event.target as HTMLInputElement).value || 0))"
            />
            <span class="jump-suffix">{{ t('map.resource_filter_jump_suffix') }}</span>
            <div class="jump-stepper">
              <button type="button" class="jump-step" @click="stepJumpLimit(1)">▲</button>
              <button type="button" class="jump-step" @click="stepJumpLimit(-1)">▼</button>
            </div>
          </div>
        </div>

        <!-- Step 1: Bind Sector Group -->
        <div class="bind-step">
          <div class="bind-step-header">
            <span class="bind-step-number">1</span>
            <span class="bind-step-title">{{ t('map.binding_sector_group') }}</span>
            <span v-if="isSectorBound" class="bind-step-status bind-step-status--done">{{ t('map.binding_sector_bound') }}</span>
          </div>
          
          <div v-if="!isSectorBound" class="bind-step-content">
            <div class="map-binding-panel__sector-options">
              <button
                v-for="sector in empireSectors"
                :key="sector.id"
                class="map-binding-panel__sector-btn"
                type="button"
                @click="bindSectorToGroup(sector.id)"
              >
                {{ sector.name }}
              </button>
            </div>
            <div class="bind-new-sector">
              <button
                v-if="!showNewSectorInput"
                class="map-binding-panel__sector-btn map-binding-panel__sector-btn--new"
                type="button"
                @click="showCreateNewSector"
              >
                + {{ t('map.binding_new_sector') }}
              </button>
              <div v-else class="new-sector-form">
                <input
                  v-model="newSectorName"
                  class="new-sector-input"
                  type="text"
                  :placeholder="t('map.binding_new_sector_name')"
                />
                <button
                  class="new-sector-create"
                  type="button"
                  :disabled="!newSectorName.trim()"
                  @click="createAndBindNewSector"
                >
                  {{ t('map.binding_bind_sector') }}
                </button>
              </div>
            </div>
          </div>
          <div v-else class="bind-step-content">
            <span class="sector-bound-name">{{ empireSectors.find(s => s.id === selectedSectorGroupId)?.name }}</span>
            <button class="bind-step-clear" type="button" @click="clearGroupBinding">×</button>
          </div>
        </div>

        <!-- Step 2: Coverage Sectors with Stations (POI Style) -->
        <div class="bind-step" :class="{ 'bind-step--disabled': !isSectorBound }">
          <div class="bind-step-header">
            <span class="bind-step-number">2</span>
            <span class="bind-step-title">{{ t('map.binding_save_stations') }}</span>
          </div>

          <div v-if="!isSectorBound" class="bind-step-hint">
            {{ t('map.binding_sector_not_bound') }}
          </div>

          <div v-else class="poi-groups">
            <div class="poi-stats">
              {{ coverageSectorsWithStations.reduce((sum, s) => sum + s.stations.length, 0) }} {{ t('map.save_coord_count') }}
            </div>
            
            <div v-if="coverageSectorsWithStations.length === 0" class="map-binding-panel__empty">
              {{ t('map.binding_no_stations') }}
            </div>

            <div
              v-for="sector in coverageSectorsWithStations"
              :key="sector.sectorMacro"
              class="poi-group"
            >
              <div class="poi-header">
                <span class="poi-name">
                  {{ sector.sectorName }}
                  <span v-if="sector.showRawSectorName" class="poi-header-raw">({{ sector.rawSectorName }})</span>
                </span>
                <span class="poi-distance">{{ sector.distance }}j</span>
              </div>
              <div class="poi-list">
                <div
                  v-for="station in sector.stations"
                  :key="station.code"
                  class="poi-item"
                  :class="{ 'poi-item--bound': isSaveStationBound(station.code) }"
                >
                  <div class="poi-text">
                    <div class="poi-title-row">
                      <span class="poi-code">{{ getStationLabel(station) }}</span>
                      <span v-if="station.is_headquarter" class="poi-badge">
                        {{ t('map.save_station_headquarter') }}
                      </span>
                    </div>
                    <span class="poi-subcode">{{ station.code }}</span>
                  </div>
                  <div class="poi-actions">
                    <button
                      v-if="!isSaveStationBound(station.code)"
                      class="poi-action"
                      type="button"
                      @click="startBindSaveStation(station, sector.sectorMacro)"
                    >
                      {{ t('map.binding_bind') }}
                    </button>
                    <button
                      v-if="!isSaveStationBound(station.code)"
                      class="poi-action poi-action--secondary"
                      type="button"
                      @click="importSaveStation(station, sector.sectorMacro)"
                    >
                      {{ t('map.binding_import') }}
                    </button>
                    <span v-else class="poi-bound-tag">
                      {{ t('map.binding_already_bound') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bind Save Station Dialog -->
        <div v-if="bindingSaveStation" class="bind-dialog">
          <div class="bind-dialog-header">
            <span class="bind-dialog-title">{{ t('map.binding_select_empire_station') }}</span>
            <span class="bind-dialog-save-name">{{ bindingSaveStation.code }}</span>
          </div>
          <div class="bind-dialog-content">
            <select v-model="selectedEmpireStationId" class="bind-dialog-select">
              <option :value="null" disabled>{{ t('map.binding_select_station_placeholder') }}</option>
              <option v-for="item in idleStations" :key="item.station.id" :value="item.station.id">
                {{ item.station.name }}
              </option>
            </select>
            <div class="bind-dialog-actions">
              <button type="button" class="bind-dialog-btn bind-dialog-btn--cancel" @click="cancelBindSaveStation">
                {{ t('map.binding_cancel') }}
              </button>
              <button
                type="button"
                class="bind-dialog-btn bind-dialog-btn--confirm"
                :disabled="!selectedEmpireStationId"
                @click="confirmBindSaveStation"
              >
                {{ t('map.binding_confirm') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Step 3: Trade Station Binding -->
        <div v-if="isSectorBound && tradeStationsInSelectedSector.length > 0" class="bind-step">
          <div class="bind-step-header">
            <span class="bind-step-number">3</span>
            <span class="bind-step-title">{{ t('map.binding_bind_tradestation') }}</span>
            <span v-if="currentGroupBinding?.tradestationCode" class="bind-step-status bind-step-status--done">{{ t('map.binding_tradestation_bound') }}</span>
          </div>
          
          <div v-if="!currentGroupBinding?.tradestationCode" class="bind-step-content">
            <div class="tradestation-options">
              <button
                v-for="ts in tradeStationsInSelectedSector"
                :key="ts.code"
                class="tradestation-btn"
                type="button"
                @click="bindTradeStation(ts.code)"
              >
                {{ ts.code }}
              </button>
            </div>
          </div>
        </div>

        <!-- Idle Stations -->
        <div v-if="isSectorBound && idleStations.length > 0" class="map-binding-panel__idle">
          <div class="map-binding-panel__subsection">{{ t('map.binding_idle_stations') }}</div>
          <div class="map-binding-panel__list map-binding-panel__list--compact">
            <div
              v-for="item in idleStations"
              :key="item.station.id"
              class="map-binding-panel__station-item"
              :class="{ 'map-binding-panel__station-item--dragging': activeDragStationId === item.station.id, 'map-binding-panel__station-item--bound': !!item.sectorMacro }"
              @mousedown="onIdleStationMouseDown($event, item)"
            >
              <div class="map-binding-panel__station-info">
                <img
                  class="map-binding-panel__icon"
                  :src="iconUrlByType[item.station.type === 'shipyard' ? 'shipyard' : 'factory']"
                  alt=""
                />
                <div class="map-binding-panel__station-main">
                  <div class="map-binding-panel__station-name">{{ item.station.name }}</div>
                  <div v-if="item.sectorMacro" class="map-binding-panel__station-target">
                    <span class="map-binding-panel__station-target-tag">{{ getSectorMacroDisplayName(item.sectorMacro) }}</span>
                    <button
                      class="map-binding-panel__station-target-clear"
                      type="button"
                      :title="t('map.station_panel_clear_action')"
                      :aria-label="t('map.station_panel_clear_action')"
                      @click.stop="clearFreeStationBinding(item.station.id)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M6.5 6.5l11 11M17.5 6.5l-11 11"
                          fill="none"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-width="2"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div class="map-binding-panel__station-actions">
                <div class="map-binding-panel__handle" aria-hidden="true">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Existing Bindings -->
        <div v-if="isSectorBound && stationBindingsInGroup.length > 0" class="map-binding-panel__bindings">
          <div class="map-binding-panel__subsection">{{ t('map.binding_existing_bindings') }}</div>
          <div class="map-binding-panel__list map-binding-panel__list--compact">
            <div
              v-for="binding in stationBindingsInGroup"
              :key="binding.stationId"
              class="map-binding-panel__station-item"
            >
              <div class="map-binding-panel__station-info">
                <div class="map-binding-panel__station-name">{{ binding.stationId }}</div>
                <div class="map-binding-panel__station-meta">
                  {{ binding.saveStationCode }}
                  <span v-if="getStationBindingStatus(binding.stationId) === 'missing'" class="map-binding-panel__status-missing">
                    {{ t('map.binding_status_missing') }}
                  </span>
                </div>
              </div>
              <button
                class="map-binding-panel__clear-btn"
                type="button"
                @click="clearStationBinding(binding.stationId)"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="map-binding-panel__footer">
      <div class="map-binding-panel__hint">{{ t('map.binding_footer_hint') }}</div>
    </div>
  </aside>
</template>

<style scoped>
.map-binding-panel {
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/80 p-4 text-amber-50;
  backdrop-filter: blur(10px);
}

.map-binding-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3;
}

.map-binding-panel__nav {
  @apply flex items-center gap-2;
}

.map-binding-panel__back {
  @apply rounded px-2 py-1 text-amber-100 transition-colors duration-150 hover:bg-amber-200/10 hover:text-amber-50;
}

.map-binding-panel__title {
  @apply text-base font-semibold;
}

.map-binding-panel__close {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-binding-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto pr-1;
  scrollbar-color: rgba(251, 191, 36, 0.5) rgba(255, 255, 255, 0.06);
  scrollbar-width: thin;
}

.map-binding-panel__section {
  @apply flex flex-col gap-4;
}

.search-wrap {
  @apply relative;
}

.search-input {
  @apply h-10 w-full rounded border border-amber-300/30 bg-black/60 px-3 pr-10 text-sm text-amber-50 outline-none;
}

.search-clear {
  @apply absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-amber-100/60 transition-colors duration-150 hover:text-amber-50;
}

.sector-stats {
  @apply text-xs text-amber-100/55;
}

.sector-groups {
  @apply flex flex-col gap-3;
}

.sector-group {
  @apply flex flex-col;
}

.sector-card {
  @apply flex flex-col gap-2 p-3 rounded border border-amber-300/15 bg-black/45 text-left w-full transition-colors duration-150 hover:border-amber-200/45 hover:bg-amber-200/5;
}

.sector-header {
  @apply flex items-center justify-between gap-2;
}

.sector-name {
  @apply text-sm font-medium text-amber-50 flex items-center gap-2;
}

.sector-bound-badge {
  @apply px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-300 border border-green-400/30;
}

.sector-bound-info {
  @apply text-xs text-green-300/70 mt-1;
}

.sector-header-raw {
  @apply text-amber-100/60 font-normal;
}

.sector-count {
  @apply text-xs text-amber-100/55 shrink-0;
}

.station-tags {
  @apply flex flex-wrap gap-1.5;
}

.station-tag {
  @apply rounded-full border border-amber-300/20 bg-amber-200/10 px-2 py-0.5 text-xs text-amber-100;
}

.map-binding-panel__subsection {
  @apply text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/80;
}

.map-binding-panel__label {
  @apply text-xs font-medium text-amber-200/90;
}

.map-binding-panel__hint {
  @apply text-xs text-amber-100/60;
}

.map-binding-panel__list {
  @apply flex flex-col gap-2;
}

.map-binding-panel__list--compact {
  @apply gap-1;
}

.map-binding-panel__item {
  @apply flex flex-col gap-1 rounded border border-amber-300/15 bg-black/45 px-3 py-3 text-left transition-colors duration-150 hover:border-amber-200/45 hover:bg-amber-200/5;
}

.map-binding-panel__item-name {
  @apply text-sm font-medium text-amber-50;
}

.map-binding-panel__item-meta {
  @apply text-xs text-amber-100/60;
}

.map-binding-panel__divider {
  @apply relative my-4 text-center text-xs text-amber-100/40;
}

.map-binding-panel__divider::before,
.map-binding-panel__divider::after {
  content: '';
  @apply absolute top-1/2 w-[calc(50%-2rem)] border-t border-amber-300/20;
}

.map-binding-panel__divider::before {
  @apply left-0;
}

.map-binding-panel__divider::after {
  @apply right-0;
}

.map-binding-panel__create-section {
  @apply flex flex-col gap-2;
}

.map-binding-panel__item--create {
  @apply border-dashed;
}

.map-binding-panel__empty {
  @apply py-4 text-center text-xs text-amber-100/50;
}

.jump-range {
  @apply flex flex-col gap-2;
}

.jump-range .label {
  @apply text-xs font-medium text-amber-200/90;
}

.jump-input-wrap {
  @apply relative;
  width: 78px;
}

.jump-input {
  @apply w-full rounded-md border border-amber-300/30 bg-black/70 px-3 py-1 text-sm text-amber-50 outline-none;
  min-width: 0;
  padding-right: 2.55rem;
  text-indent: 0;
  text-align: center;
  appearance: textfield;
}

.jump-input::-webkit-outer-spin-button,
.jump-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.jump-suffix {
  @apply pointer-events-none absolute right-[1.3rem] top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-100/90;
}

.jump-stepper {
  @apply absolute right-0 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-md rounded-l-sm border border-amber-300/25 bg-black/80;
  width: 0.95rem;
}

.jump-step {
  @apply flex h-3.5 w-full items-center justify-center bg-amber-200/10 text-[9px] leading-none text-amber-100/85 transition-colors duration-150 hover:bg-amber-200/20 hover:text-amber-50;
}

.jump-step + .jump-step {
  @apply border-t border-amber-300/20;
}

.map-binding-panel__sector-group {
  @apply flex flex-col gap-2;
}

.map-binding-panel__sector-options {
  @apply flex flex-wrap gap-1;
}

.map-binding-panel__sector-btn {
  @apply rounded border border-amber-300/20 px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/50 hover:bg-amber-200/10;
}

.map-binding-panel__sector-btn.active {
  @apply border-amber-200/70 bg-amber-200/20 text-amber-50;
}

.map-binding-panel__stations {
  @apply flex flex-col gap-2;
}

.map-binding-panel__station-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/30 px-3 py-2;
}

.map-binding-panel__station-item--bound {
  @apply opacity-50;
}

.map-binding-panel__station-info {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.map-binding-panel__icon {
  @apply h-4 w-4 shrink-0 object-contain;
}

.map-binding-panel__station-name {
  @apply truncate text-sm text-amber-50;
}

.map-binding-panel__station-meta {
  @apply text-xs text-amber-100/60;
}

.map-binding-panel__station-actions {
  @apply flex shrink-0 items-center gap-2;
}

.map-binding-panel__action-btn {
  @apply rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:bg-amber-200/20 hover:text-amber-50;
}

.map-binding-panel__bound-tag {
  @apply rounded bg-amber-200/10 px-2 py-1 text-xs text-amber-100/60;
}

.map-binding-panel__hint-tag {
  @apply text-xs text-amber-100/40;
}

.map-binding-panel__status-missing {
  @apply ml-1 rounded bg-red-500/20 px-1 text-xs text-red-300;
}

.map-binding-panel__clear-btn {
  @apply h-5 w-5 rounded text-amber-100/50 transition-colors duration-150 hover:bg-amber-200/20 hover:text-amber-50;
}

.map-binding-panel__idle {
  @apply flex flex-col gap-2;
}

.map-binding-panel__bindings {
  @apply flex flex-col gap-2;
}

.map-binding-panel__footer {
  @apply mt-3 shrink-0 border-t border-amber-300/15 pt-2;
}

.poi-groups {
  @apply flex flex-col gap-3;
}

.poi-group {
  @apply flex flex-col gap-1;
}

.poi-header {
  @apply flex items-center justify-between px-2;
}

.poi-name {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-200/80;
}

.poi-header-raw {
  @apply text-amber-100/60 font-normal normal-case;
}

.poi-distance {
  @apply text-xs text-amber-100/55 shrink-0;
}

.poi-stats {
  @apply text-xs text-amber-100/55;
}

.poi-list {
  @apply flex flex-col gap-1;
}

.poi-item {
  @apply flex items-center justify-between gap-2 p-2 rounded border border-amber-300/15 bg-black/45 transition-colors;
}

.poi-item:hover {
  @apply bg-amber-200/5 border-amber-200/45;
}

.poi-item--bound {
  @apply opacity-50;
}

.poi-text {
  @apply flex min-w-0 flex-col;
}

.poi-title-row {
  @apply flex min-w-0 items-center gap-2;
}

.poi-code {
  @apply truncate text-sm text-amber-50;
}

.poi-badge {
  @apply shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300;
}

.poi-subcode {
  @apply text-xs text-amber-100/55;
}

.poi-actions {
  @apply flex shrink-0 items-center gap-2;
}

.poi-action {
  @apply rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:bg-amber-200/20 hover:text-amber-50;
}

.poi-bound-tag {
  @apply rounded bg-amber-200/10 px-2 py-1 text-xs text-amber-100/60;
}

.bind-step {
  @apply flex flex-col gap-2;
}

.bind-step--disabled {
  @apply opacity-50 pointer-events-none;
}

.bind-step-header {
  @apply flex items-center gap-2;
}

.bind-step-number {
  @apply flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/20 text-xs font-semibold text-amber-100;
}

.bind-step-title {
  @apply text-sm font-medium text-amber-50;
}

.bind-step-status {
  @apply text-xs;
}

.bind-step-status--done {
  @apply text-emerald-400;
}

.bind-step-content {
  @apply flex flex-col gap-2;
}

.bind-step-hint {
  @apply text-xs text-amber-100/50;
}

.bind-step-clear {
  @apply h-5 w-5 rounded text-amber-100/50 transition-colors duration-150 hover:bg-amber-200/20 hover:text-amber-50;
}

.sector-bound-name {
  @apply text-sm text-amber-100;
}

.bind-new-sector {
  @apply flex flex-col gap-2;
}

.new-sector-form {
  @apply flex gap-2;
}

.new-sector-input {
  @apply flex-1 rounded border border-amber-300/30 bg-black/60 px-2 py-1 text-sm text-amber-50 outline-none;
}

.new-sector-create {
  @apply rounded border border-amber-300/30 bg-amber-200/10 px-3 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:bg-amber-200/20;
}

.new-sector-create:disabled {
  @apply opacity-50 pointer-events-none;
}

.tradestation-options {
  @apply flex flex-wrap gap-1;
}

.tradestation-btn {
  @apply rounded border border-amber-300/20 px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/50 hover:bg-amber-200/10;
}

.map-binding-panel__sector-btn--new {
  @apply border-dashed;
}

.archive-time {
  @apply flex flex-col gap-1;
}

.archive-select {
  @apply h-8 rounded border border-amber-300/30 bg-black/60 px-2 text-sm text-amber-50 outline-none;
}

.archive-groups {
  @apply flex flex-col gap-3;
}

.archive-group {
  @apply flex flex-col gap-1;
}

.archive-group-header {
  @apply flex items-center gap-2 rounded border border-amber-300/20 bg-amber-200/10 px-3 py-2 text-left transition-colors hover:border-amber-200/40 hover:bg-amber-200/15;
}

.player-name {
  @apply text-sm font-medium text-amber-50;
}

.archive-count {
  @apply text-xs text-amber-100/60;
}

.bound-badge {
  @apply ml-auto rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300;
}

.archive-items {
  @apply ml-2 flex flex-col gap-1 border-l border-amber-300/20 pl-2;
}

.archive-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/30 px-3 py-1.5 text-left transition-colors hover:border-amber-200/30 hover:bg-amber-200/5;
}

.archive-item--bound {
  @apply border-emerald-400/30 bg-emerald-500/5;
}

.archive-info {
  @apply flex min-w-0 flex-col;
}

.archive-time {
  @apply text-sm text-amber-50;
}

.archive-meta {
  @apply truncate text-xs text-amber-100/50;
}

.bound-tag {
  @apply shrink-0 rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300;
}

.map-binding-panel__station-item--dragging {
  @apply opacity-50;
}

.map-binding-panel__handle {
  @apply flex flex-col gap-0.5;
}

.map-binding-panel__handle span {
  @apply block h-0.5 w-4 rounded-full bg-amber-100/40;
}

.bind-dialog {
  @apply mb-4 rounded-lg border border-amber-300/30 bg-black/60 p-4;
}

.bind-dialog-header {
  @apply mb-3 flex items-center justify-between;
}

.bind-dialog-title {
  @apply text-sm font-medium text-amber-100;
}

.bind-dialog-save-name {
  @apply text-xs text-amber-100/60;
}

.bind-dialog-content {
  @apply flex flex-col gap-3;
}

.bind-dialog-select {
  @apply w-full rounded border border-amber-300/30 bg-black/70 px-3 py-2 text-sm text-amber-50 outline-none;
}

.bind-dialog-actions {
  @apply flex justify-end gap-2;
}

.bind-dialog-btn {
  @apply rounded px-3 py-1.5 text-sm font-medium transition-colors;
}

.bind-dialog-btn--cancel {
  @apply border border-amber-300/30 bg-transparent text-amber-100 hover:bg-amber-200/10;
}

.bind-dialog-btn--confirm {
  @apply bg-amber-200/20 text-amber-50 hover:bg-amber-200/30;
}

.bind-dialog-btn--confirm:disabled {
  @apply cursor-not-allowed opacity-50;
}

.poi-action--secondary {
  @apply border border-amber-300/20 bg-transparent text-amber-100/80;
}

.poi-action--secondary:hover {
  @apply border-amber-200/40 bg-amber-200/10 text-amber-50;
}

.free-sectors {
  @apply mt-4 border-t border-amber-300/20 pt-4;
}

.free-sectors-header {
  @apply mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/80;
}

.free-sectors-list {
  @apply flex flex-col gap-2;
}

.free-sector-card {
  @apply cursor-grab flex items-center justify-between gap-2 rounded border border-amber-300/20 bg-black/40 p-3 transition-colors hover:border-amber-200/40 hover:bg-black/60;
}

.free-sector-card--dragging {
  @apply opacity-50 border-amber-200/60 bg-amber-200/10;
}

.free-sector-content {
  @apply flex flex-col gap-1 min-w-0;
}

.free-sector-name {
  @apply text-sm font-medium text-amber-50;
}

.free-sector-position {
  @apply text-xs text-emerald-300/70;
}

.free-sector-handle {
  @apply flex flex-col gap-0.5 shrink-0;
}

.free-sector-handle span {
  @apply block h-0.5 w-4 rounded-full bg-amber-100/40;
}

.free-sector-card--bound {
  @apply border-amber-300/30 bg-amber-200/5;
}

.free-sector-target {
  @apply flex items-center gap-1.5 mt-1;
}

.free-sector-target-tag {
  @apply inline-flex items-center rounded-full border border-amber-300/20 bg-amber-200/10 px-2 py-0.5 text-[11px] leading-4 text-amber-100/75;
}

.free-sector-clear {
  @apply inline-flex h-4 w-4 shrink-0 items-center justify-center self-center rounded text-amber-100/55 transition-colors duration-150 hover:text-amber-50;
}

.free-sector-clear svg {
  @apply h-3 w-3;
}

.map-binding-panel__station-item--bound {
  @apply border-amber-300/30 bg-amber-200/5;
}

.map-binding-panel__station-main {
  @apply min-w-0 flex-1;
}

.map-binding-panel__station-target {
  @apply flex items-center gap-1.5 mt-0.5;
}

.map-binding-panel__station-target-tag {
  @apply inline-flex items-center rounded-full border border-amber-300/20 bg-amber-200/10 px-2 py-0.5 text-[11px] leading-4 text-amber-100/75;
}

.map-binding-panel__station-target-clear {
  @apply inline-flex h-4 w-4 shrink-0 items-center justify-center self-center rounded text-amber-100/55 transition-colors duration-150 hover:text-amber-50;
}

.map-binding-panel__station-target-clear svg {
  @apply h-3 w-3;
}
</style>