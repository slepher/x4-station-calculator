<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getSavePoiIconUrl } from '@/components/map/utils/style'
import { getSectorZoneBoundingCenter } from '@/components/map/utils/coordinates'
import { resolveGroupSaveBinding, resolveStationSaveBinding } from '@/store/logic/saveBindingUtils'
import { buildAggregatedModulesFromStationPlan, classifyPlayerStationPoi } from '@/store/logic/stationPoiSemantics'
import { compareModulesByPickerOrder } from '@/store/logic/searchModule'
import type { BindingStationPlan, GroupSaveBinding, SavedModule, StationSaveBinding, StationPlan } from '@/types/x4'
import type { PlayerStationEntry, SavePoiOverlayItem } from '@/types/saveArchive'
import factoryIconUrl from '@/components/icons/factory.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'

const props = defineProps<{
  gameGuid: string
  sectorGroupId: string
}>()

const emit = defineEmits<{
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean; blueprintStation?: StationPlan }): void
  (e: 'drag-station-end'): void
}>()

const { t, te } = useI18n()
const blueprintStore = useBlueprintProductionStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()
const saveBindingStore = useSaveBindingStore()

function getSectorCenterPositionForBinding(sectorMacro: string | null | undefined): { x: number; y: number; z: number } | undefined {
  if (!sectorMacro) return undefined
  const resolved = resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, sectorMacro)
  if (!resolved) return undefined
  const center = getSectorZoneBoundingCenter(resolved.sector)
  return { x: center.x, y: 0, z: center.z }
}

const importStationName = ref('')

const bindMenuOpen = ref(false)
const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})
const bindMenuSaveStation = ref<PlayerStationEntry | null>(null)
const bindMenuSectorMacro = ref<string | null>(null)
const bindMenuTriggerEl = ref<HTMLElement | null>(null)
const bindMenuAnchorEl = ref<HTMLElement | null>(null)
const blueprintEmpireMenuOpen = ref(false)
const blueprintEmpireMenuRef = ref<HTMLElement | null>(null)
const blueprintEmpireMenuTriggerEl = ref<HTMLElement | null>(null)
const blueprintEmpireMenuStyle = ref<Record<string, string>>({})

const pendingDrag = ref<{
  key: string
  payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean; blueprintStation?: StationPlan }
  startX: number
  startY: number
} | null>(null)
const activeDragKey = ref<string | null>(null)
const DRAG_START_THRESHOLD_PX = 4
const suppressNextSectorFocus = ref(false)

const activeBindingPlan = computed(() => {
  if (saveBindingStore.activeBinding?.gameGuid === props.gameGuid) return saveBindingStore.activeBinding
  return saveBindingStore.getBindingByGameGuid(props.gameGuid)
})
const blueprintEmpires = computed(() => blueprintStore.savedEmpires?.list || [])
const selectedBlueprintEmpireId = computed(() => (
  activeBindingPlan.value?.blueprintEmpireId ||
  blueprintStore.activeEmpire?.id ||
  blueprintEmpires.value[0]?.id ||
  null
))
const blueprintEmpire = computed(() => {
  const id = selectedBlueprintEmpireId.value
  if (!id) return null
  if (blueprintStore.activeEmpire?.id === id) return blueprintStore.activeEmpire
  return blueprintEmpires.value.find((empire) => empire.id === id) || null
})

function getSaveStationPlan(saveStationCode: string) {
  return activeBindingPlan.value?.stationPlans.find((plan) => plan.saveStationCode === saveStationCode) || null
}

const currentGroupBinding = computed<GroupSaveBinding | null>(() => {
  const group = activeBindingPlan.value?.groups.find((b) => b.id === props.sectorGroupId)
  if (!group) return null
  const stationBindings: StationSaveBinding[] = (activeBindingPlan.value?.stationPlans || [])
    .filter((plan) => plan.groupId === props.sectorGroupId)
    .map((plan) => ({
      stationId: plan.id,
      saveStationCode: plan.saveStationCode,
      sectorMacro: plan.sectorMacro,
      position: plan.position
    }))
  return {
    sectorGroupId: group.id,
    sectorMacro: group.sectorMacro,
    jumpRange: group.jumpRange,
    coverageSectorMacros: group.coverageSectorMacros,
    connectedSectorGroupIds: group.connectedGroupIds || [],
    tradestationBinding: group.tradeStation
      ? {
          stationId: group.tradeStation.id,
          saveStationCode: group.tradeStation.saveStationCode,
          sectorMacro: group.tradeStation.sectorMacro,
          position: group.tradeStation.position
        }
      : undefined,
    stationBindings
  }
})

const activeArchive = computed(() => {
  const binding = activeBindingPlan.value
  if (!binding) return null

  const guid = binding.gameGuid
  const selected = saveStore.selectedArchive

  // 优先使用已选中的存档
  if (selected && selected.meta.guid === guid) {
    const time = binding.selectedArchiveTime
    if (time === null || selected.meta.time === time) {
      return selected
    }
  }

  const group = saveStore.archives.get(guid)
  if (!group) return null

  const time = binding.selectedArchiveTime
  if (time === null || time === undefined) {
    return group.saves[0] || null
  }
  return group.saves.find((s) => s.meta.time === time) || group.saves[0] || null
})

function recordValues<T>(record: Record<string, T> | undefined): T[] {
  return record ? Object.values(record) : []
}

const freeStations = computed(() => {
  if (!blueprintEmpire.value) return []

  return (blueprintEmpire.value.stations || [])
    .map((station) => ({
      station,
      sectorGroupId: '',
      sectorGroupName: '',
      sectorMacro: undefined
    }))
})

const anchorAndCoverageSectors = computed(() => {
  if (!currentGroupBinding.value) return []

  const anchorMacro = currentGroupBinding.value.sectorMacro
  const coverageEntries = currentGroupBinding.value.coverageSectorMacros || []
  
  // Build unique sector macros from anchor and coverage entries
  const allMacros: string[] = []
  if (anchorMacro) allMacros.push(anchorMacro)
  coverageEntries.forEach(entry => {
    if (!allMacros.includes(entry.ref)) {
      allMacros.push(entry.ref)
    }
  })
  
  // Build a map from macro to jump distance
  const macroJumpMap = new Map<string, number>()
  coverageEntries.forEach(entry => {
    macroJumpMap.set(entry.ref, entry.jump)
  })
  
  const results: Array<{
    sectorMacro: string
    sectorName: string
    isAnchor: boolean
    distance: number
    saveStations: PlayerStationEntry[]
    placedFreeStations: Array<{ stationId: string; stationName: string; sectorMacro: string; position: { x: number; y: number; z: number } }>
    missingBoundStations: Array<{ stationId: string; stationName: string }>
    hasPlacedVirtualTradestation: boolean
    hasMissingVirtualTradestation: boolean
    placedVirtualTradestationPosition?: { x: number; y: number; z: number }
  }> = []

  for (const sectorMacro of allMacros) {
    const isAnchor = !!(anchorMacro && sectorMacro === anchorMacro)
    
    const maps = gameDataStore.maps
    const resolved = resolveMapSectorByMacro(maps || { clusters: {}, sectors: {} }, sectorMacro)
    let sectorName = sectorMacro
    if (resolved?.sectorId) {
      const mapSector = maps?.sectors?.[resolved.sectorId]
      if (mapSector?.nameId && te(mapSector.nameId)) {
        sectorName = t(mapSector.nameId)
      } else if (mapSector?.name) {
        sectorName = mapSector.name
      }
    }

    // Use jump from coverage entry, or 0 for anchor
    const distance = isAnchor ? 0 : (macroJumpMap.get(sectorMacro) || 0)

    const saveStations: PlayerStationEntry[] = []
    if (activeArchive.value) {
      const sectorData = activeArchive.value.sectors[sectorMacro]
      if (sectorData?.player_stations) {
        saveStations.push(...recordValues(sectorData.player_stations))
      }
    }

	    const placedFreeStations: Array<{ stationId: string; stationName: string; sectorMacro: string; position: { x: number; y: number; z: number } }> = []
	    const missingBoundStations: Array<{ stationId: string; stationName: string }> = []
	    const stationBindings = currentGroupBinding.value.stationBindings || []
	    for (const binding of stationBindings) {
	      if (binding.sectorMacro === sectorMacro && binding.position) {
	        const station = blueprintEmpire.value?.stations.find(s => s.id === binding.stationId)
	        const stationPlan = activeBindingPlan.value?.stationPlans.find((plan) => plan.id === binding.stationId)
	        const resolved = resolveStationSaveBinding(binding, activeArchive.value)
	        if (!binding.saveStationCode && (station || stationPlan)) {
	          placedFreeStations.push({
	            stationId: station?.id || stationPlan!.id,
	            stationName: station?.name || stationPlan?.name || binding.stationId,
	            sectorMacro: binding.sectorMacro!,
	            position: binding.position
	          })
        } else if (station && binding.saveStationCode && resolved.status === 'missing_at_selected_time') {
          missingBoundStations.push({
            stationId: station.id,
            stationName: station.name
          })
        }
      }
    }

    // Check if virtual tradestation is placed in this sector
    const tb = currentGroupBinding.value.tradestationBinding
    const resolvedTradestation = currentGroupBinding.value
      ? resolveGroupSaveBinding(currentGroupBinding.value, activeArchive.value)
      : null
    const hasPlacedVirtualTradestation = !!(
      tb?.position &&
      tb.sectorMacro === sectorMacro &&
      !tb.saveStationCode
    )
    const hasMissingVirtualTradestation = !!(
      tb?.position &&
      tb.sectorMacro === sectorMacro &&
      tb.saveStationCode &&
      resolvedTradestation?.status === 'missing_at_selected_time'
    )

    results.push({
      sectorMacro,
      sectorName,
      isAnchor,
      distance,
      saveStations,
      placedFreeStations,
      missingBoundStations,
      hasPlacedVirtualTradestation,
      hasMissingVirtualTradestation,
      placedVirtualTradestationPosition: hasPlacedVirtualTradestation ? tb?.position : undefined
    })
  }

  return results.sort((a, b) => {
    if (a.isAnchor) return -1
    if (b.isAnchor) return 1
    return a.distance - b.distance
  })
})

function buildStationDragCoverage(): { ref: string; jump: number }[] {
  const entries = currentGroupBinding.value?.coverageSectorMacros || []
  const anchorMacro = currentGroupBinding.value?.sectorMacro
  const next: { ref: string; jump: number }[] = []
  const seen = new Set<string>()

  if (anchorMacro) {
    next.push({ ref: anchorMacro, jump: 0 })
    seen.add(anchorMacro)
  }

  entries.forEach((entry) => {
    if (seen.has(entry.ref)) return
    seen.add(entry.ref)
    next.push(entry)
  })

  return next
}

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

function getSaveStationIcon(station: PlayerStationEntry): string {
  const poiLike: SavePoiOverlayItem = {
    key: `binding-save-station:${station.code}`,
    code: station.code,
    category: 'playerStation',
    owner: 'player',
    sectorMacro: '',
    sectorName: '',
    position: {
      x: station.position.x,
      y: station.position.y,
      z: station.position.z
    },
    tag: station.tag,
    factoryGroup: station.factoryGroup,
    productionProfile: station.productionProfile,
    profileName: station.profileName,
    is_headquarter: station.is_headquarter
  }
  return getSavePoiIconUrl(poiLike) || factoryIconUrl
}

function getEmpireStationIcon(station: StationPlan | undefined | null): string {
  if (!station) return factoryIconUrl

  const aggregatedModules = buildAggregatedModulesFromStationPlan(
    station,
    gameDataStore.modulesMap || {}
  )
  const modulesByMacroId = Object.fromEntries(
    Object.values(aggregatedModules)
      .map((module) => {
        const matched = gameDataStore.modulesByMacroId?.[module.ref]
        return matched ? [module.ref, matched] : null
      })
      .filter((entry): entry is [string, NonNullable<typeof gameDataStore.modulesByMacroId>[string]] => Boolean(entry))
  )
  const classification = classifyPlayerStationPoi({
    modules: aggregatedModules,
    modulesByMacroId,
    isHeadquarter: false
  })

  const poiLike: SavePoiOverlayItem = {
    key: `binding-empire-station:${station.id}`,
    code: station.name,
    category: 'playerStation',
    owner: 'player',
    sectorMacro: '',
    sectorName: '',
    position: { x: 0, y: 0, z: 0 },
    tag: classification.tag,
    factoryGroup: classification.factoryGroup,
    productionProfile: classification.productionProfile,
    profileName: classification.profileName,
    is_headquarter: classification.is_headquarter
  }
  return getSavePoiIconUrl(poiLike) || factoryIconUrl
}

function bindingPlanToStationPlan(plan: BindingStationPlan): StationPlan {
  return {
    id: plan.id,
    name: plan.name,
    type: plan.type,
    modules: plan.modules,
    settings: plan.settings,
    lastUpdated: Date.now(),
    sectorId: plan.groupId || null
  }
}

function getEmpireStationIconById(stationId: string): string {
  const station = blueprintEmpire.value?.stations.find((item) => item.id === stationId)
  const stationPlan = activeBindingPlan.value?.stationPlans.find((item) => item.id === stationId)
  return getEmpireStationIcon(station || (stationPlan ? bindingPlanToStationPlan(stationPlan) : null))
}

function isSaveStationBound(saveStationCode: string): boolean {
  return Boolean(getSaveStationPlan(saveStationCode))
}

function getBoundStationBinding(saveStationCode: string): StationSaveBinding | null {
  return currentGroupBinding.value?.stationBindings.find(
    (b: StationSaveBinding) => b.saveStationCode === saveStationCode
  ) || null
}

function getBoundEmpireStation(saveStationCode: string): StationPlan | null {
  const binding = getBoundStationBinding(saveStationCode)
  if (!binding) return null
  const plan = getSaveStationPlan(saveStationCode)
  if (plan) {
    return {
      id: plan.id,
      name: plan.name || saveStationCode,
      type: 'industrial',
      modules: plan.modules,
      settings: plan.settings,
      lastUpdated: activeBindingPlan.value?.updatedAt || Date.now()
    }
  }
  return blueprintEmpire.value?.stations?.find((s) => s.id === binding.stationId) || null
}

function hasDanglingBoundStation(saveStationCode: string): boolean {
  const binding = getBoundStationBinding(saveStationCode)
  if (!binding) return false
  return !getSaveStationPlan(saveStationCode)
}

function getBindButtonLabel(saveStationCode: string): string {
  if (currentGroupBinding.value?.tradestationBinding?.saveStationCode === saveStationCode) {
    return t('map.binding_sector_tradestation')
  }
  if (hasDanglingBoundStation(saveStationCode)) {
    return t('map.binding_status_error')
  }
  if (isSaveStationBound(saveStationCode)) {
    const station = getBoundEmpireStation(saveStationCode)
    return station?.name || t('map.binding_bind')
  }
  return t('map.binding_bind')
}

function updateBindMenuPosition() {
  const panel = document.querySelector('.map-save-panel, .map-binding-panel')
  const trigger = bindMenuTriggerEl.value
  const anchor = bindMenuAnchorEl.value || (trigger?.closest('.station-item') as HTMLElement | null)
  if (!panel || !trigger || !anchor) {
    bindMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const menuHeight = bindMenuRef.value?.offsetHeight || 300
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const spaceBelow = viewportHeight - anchorRect.bottom
  const spaceAbove = anchorRect.top
  const preferUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow
  const rawTop = preferUpward
    ? anchorRect.bottom - menuHeight
    : anchorRect.top
  const top = Math.max(8, Math.min(rawTop, Math.max(8, viewportHeight - menuHeight - 8)))

  bindMenuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function toggleBindMenu(event: MouseEvent, station: PlayerStationEntry, sectorMacro: string) {
  bindMenuSaveStation.value = station
  bindMenuSectorMacro.value = sectorMacro
  bindMenuTriggerEl.value = event.currentTarget as HTMLElement
  bindMenuAnchorEl.value = (event.currentTarget as HTMLElement)?.closest('.station-item') as HTMLElement | null
  bindMenuOpen.value = !bindMenuOpen.value
  if (bindMenuOpen.value) {
    nextTick(() => updateBindMenuPosition())
  }
}

function closeBindMenu() {
  bindMenuOpen.value = false
  bindMenuSaveStation.value = null
  bindMenuSectorMacro.value = null
  bindMenuTriggerEl.value = null
  bindMenuAnchorEl.value = null
}

function updateBlueprintEmpireMenuPosition() {
  const panel = document.querySelector('.map-save-panel, .map-binding-panel')
  const trigger = blueprintEmpireMenuTriggerEl.value
  if (!panel || !trigger) {
    blueprintEmpireMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  const menuHeight = blueprintEmpireMenuRef.value?.offsetHeight || 260
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const rawTop = Math.min(triggerRect.top, Math.max(8, viewportHeight - menuHeight - 8))
  const top = Math.max(8, rawTop)

  blueprintEmpireMenuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function toggleBlueprintEmpireMenu(event: MouseEvent) {
  blueprintEmpireMenuTriggerEl.value = event.currentTarget as HTMLElement
  blueprintEmpireMenuOpen.value = !blueprintEmpireMenuOpen.value
  if (blueprintEmpireMenuOpen.value) {
    closeBindMenu()
    nextTick(() => updateBlueprintEmpireMenuPosition())
  }
}

function closeBlueprintEmpireMenu() {
  blueprintEmpireMenuOpen.value = false
  blueprintEmpireMenuTriggerEl.value = null
}

function selectBlueprintEmpire(empireId: string) {
  saveBindingStore.setBlueprintEmpire(props.gameGuid, empireId)
  closeBlueprintEmpireMenu()
}

function onBindMenuGlobalPointerDown(event: MouseEvent) {
  if (!bindMenuOpen.value && !blueprintEmpireMenuOpen.value) return
  if (!(event.target instanceof Node)) return

  const menuRoot = bindMenuRef.value
  const trigger = bindMenuTriggerEl.value
  if (bindMenuOpen.value) {
    if (menuRoot?.contains(event.target)) return
    if (trigger?.contains(event.target)) return
    closeBindMenu()
  }

  const empireMenuRoot = blueprintEmpireMenuRef.value
  const empireTrigger = blueprintEmpireMenuTriggerEl.value
  if (blueprintEmpireMenuOpen.value) {
    if (empireMenuRoot?.contains(event.target)) return
    if (empireTrigger?.contains(event.target)) return
    closeBlueprintEmpireMenu()
  }
}

function onBindMenuViewportChange() {
  if (bindMenuOpen.value) updateBindMenuPosition()
  if (blueprintEmpireMenuOpen.value) updateBlueprintEmpireMenuPosition()
}

function bindToStation(stationId: string) {
  if (!bindMenuSaveStation.value || !bindMenuSectorMacro.value) return
  const station = blueprintEmpire.value?.stations.find((item) => item.id === stationId)
  if (!station) return

  saveBindingStore.importEmpireStationToSaveStation(props.gameGuid, bindMenuSaveStation.value.code, station, props.sectorGroupId)

  closeBindMenu()
}

function bindToSectorTradestation() {
  if (!bindMenuSaveStation.value) return

  saveBindingStore.upsertTradeStation({
    gameGuid: props.gameGuid,
    groupId: props.sectorGroupId,
    saveStationCode: bindMenuSaveStation.value.code,
    name: t('map.binding_sector_tradestation')
  })

  closeBindMenu()
}

function clearCurrentSaveStationBinding() {
  const saveStationCode = bindMenuSaveStation.value?.code
  if (!saveStationCode) return

  if (currentGroupBinding.value?.tradestationBinding?.saveStationCode === saveStationCode) {
    saveBindingStore.unbindTradeStation(props.gameGuid, props.sectorGroupId)
    closeBindMenu()
    return
  }

  saveBindingStore.clearStationPlan(props.gameGuid, saveStationCode)
  closeBindMenu()
}

function unbindStation(stationId: string) {
  saveBindingStore.deleteStationPlan(props.gameGuid, stationId)
}

function importSaveStation(station: PlayerStationEntry, sectorMacro: string) {
  const stationName = importStationName.value || station.code.split('_').pop() || station.code
  const importedModules: SavedModule[] = Object.values(station.modules || {})
    .filter((module) => Boolean(module?.module_id) && Number(module.amount) > 0)
    .map((module) => {
      const id = module.module_id as string
      return {
        id,
        count: module.amount
      }
    })
  importedModules.sort((a, b) => {
    const moduleA = gameDataStore.localizedModulesMap?.[a.id]
    const moduleB = gameDataStore.localizedModulesMap?.[b.id]
    if (!moduleA || !moduleB) return a.id.localeCompare(b.id)
    return compareModulesByPickerOrder(
      moduleA,
      moduleB,
      gameDataStore.localizedModuleGroupsMap || {}
    )
  })

  void sectorMacro
  saveBindingStore.upsertStationPlan({
    gameGuid: props.gameGuid,
    saveStationCode: station.code,
    groupId: props.sectorGroupId,
    name: stationName,
    modules: importedModules
  })

  importStationName.value = ''
  closeBindMenu()
}

function importSaveStationFromMenu() {
  if (!bindMenuSaveStation.value || !bindMenuSectorMacro.value) return
  importSaveStation(bindMenuSaveStation.value, bindMenuSectorMacro.value)
}

function clearFreeStationBinding(stationId: string) {
  saveBindingStore.deleteStationPlan(props.gameGuid, stationId)
}

function clearSectorTradestationBinding() {
  const ts = currentGroupBinding.value?.tradestationBinding
  if (ts?.saveStationCode) {
    // If bound to a save station, unbind it
    saveBindingStore.unbindTradeStation(props.gameGuid, props.sectorGroupId)
  } else {
    // If virtual tradestation (no saveStationCode), keep it (auto-created)
    // Just reset position to sector center
    const sectorMacro = currentGroupBinding.value?.sectorMacro || ts?.sectorMacro || ''
    const position = getSectorCenterPositionForBinding(sectorMacro)
    if (position) {
      saveBindingStore.setTradeStationPosition({
        gameGuid: props.gameGuid,
        groupId: props.sectorGroupId,
        sectorMacro,
        position
      })
    }
  }
}

function formatCoordKm(value: number): string {
  return `${(value / 1000).toFixed(1)}km`
}

const allStationsForMenu = computed(() => {
  if (!blueprintEmpire.value || !props.sectorGroupId) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  const boundStationId = bindMenuSaveStation.value
    ? stationBindings.find((b: StationSaveBinding) => b.saveStationCode === bindMenuSaveStation.value?.code)?.stationId
    : null

  const items: Array<{ 
    station: StationPlan
    sectorGroupId: string
    sectorGroupName: string
    sectorMacro?: string
    disabled?: boolean
    placed?: boolean
	  } | {
	    type: 'stationPlan'
	    planId: string
	    name: string
	    placed?: boolean
	  } | {
	    type: 'virtualTradestation'
	    name: string
    sectorGroupId: string
    sectorMacro?: string
    disabled?: boolean
    placed?: boolean
	  }> = []

	  const boundPlan = bindMenuSaveStation.value ? getSaveStationPlan(bindMenuSaveStation.value.code) : null
	  if (boundPlan && currentGroupBinding.value?.tradestationBinding?.saveStationCode !== bindMenuSaveStation.value?.code) {
	    items.push({
	      type: 'stationPlan',
	      planId: boundPlan.id,
	      name: boundPlan.name || bindMenuSaveStation.value?.code || boundPlan.id,
	      placed: Boolean(boundPlan.position)
	    })
	  }

  for (const station of blueprintEmpire.value.stations || []) {
    const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
    items.push({
      station,
      sectorGroupId: station.sectorId || '',
      sectorGroupName: '',
      sectorMacro: binding?.sectorMacro,
      placed: station.id === boundStationId ? Boolean(binding?.position) : false
    })
  }

  // 3. 已放置未绑定的虚拟补给站（有 position，无 saveStationCode）
  // 4. 未放置的虚拟补给站（无 tradestationBinding）
  // 只有定位星区的 save station 可以绑定虚拟补给站
  const anchorMacro = currentGroupBinding.value?.sectorMacro
  const tb = currentGroupBinding.value?.tradestationBinding
  const tradestationSaveStationCode = currentGroupBinding.value?.tradestationBinding?.saveStationCode
  const isAnchorSector = bindMenuSectorMacro.value === anchorMacro
  
  if (isAnchorSector) {
    if (tb?.position && !tradestationSaveStationCode) {
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_sector_tradestation'),
        sectorGroupId: props.sectorGroupId,
        sectorMacro: tb.sectorMacro,
        disabled: true,
        placed: true
      })
    } else if (tb && tradestationSaveStationCode) {
      const isCurrentSaveStation = bindMenuSaveStation.value?.code === tradestationSaveStationCode
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_sector_tradestation'),
        sectorGroupId: props.sectorGroupId,
        sectorMacro: tb.sectorMacro,
        disabled: !isCurrentSaveStation,
        placed: Boolean(tb.position)
      })
    } else if (!tb) {
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_sector_tradestation'),
        sectorGroupId: props.sectorGroupId,
        sectorMacro: undefined
      })
    }
  }

  return items
})

function onVirtualTradestationMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  pendingDrag.value = {
    key: '__virtual_tradestation__',
    payload: {
      stationId: '__virtual_tradestation__',
      gameGuid: props.gameGuid,
      sectorGroupId: props.sectorGroupId,
      name: t('map.binding_sector_tradestation'),
      icon: 'tradestation',
      coverageSectorMacros: currentGroupBinding.value?.sectorMacro
        ? [{ ref: currentGroupBinding.value.sectorMacro, jump: 0 }]
        : [],
      isVirtualTradestation: true
    },
    startX: event.clientX,
    startY: event.clientY
  }
}

function onFreeStationMouseDown(event: MouseEvent, item: { station: StationPlan; sectorGroupId: string }) {
  if (event.button !== 0) return
  event.preventDefault()
  pendingDrag.value = {
    key: item.station.id,
    payload: {
      stationId: item.station.id,
      gameGuid: props.gameGuid,
      sectorGroupId: props.sectorGroupId,
      name: item.station.name,
      icon: item.station.type === 'shipyard' ? 'shipyard' : 'factory',
      coverageSectorMacros: buildStationDragCoverage(),
      blueprintStation: item.station
    },
    startX: event.clientX,
    startY: event.clientY
  }
}

function onPlacedFreeStationMouseDown(event: MouseEvent, placed: { stationId: string }) {
  if (event.button !== 0) return
  const station = blueprintEmpire.value?.stations.find((item) => item.id === placed.stationId)
  const stationPlan = activeBindingPlan.value?.stationPlans.find((item) => item.id === placed.stationId)
  const dragStation = station || (stationPlan ? bindingPlanToStationPlan(stationPlan) : null)
  if (!dragStation) return
  onFreeStationMouseDown(event, {
    station: dragStation,
    sectorGroupId: props.sectorGroupId
  })
}

const clearPendingDrag = () => {
  pendingDrag.value = null
}

const finishActiveDrag = () => {
  if (!activeDragKey.value) return
  suppressNextSectorFocus.value = true
  window.setTimeout(() => {
    suppressNextSectorFocus.value = false
  }, 0)
  activeDragKey.value = null
  emit('drag-station-end')
}

function onSectorItemClick(sectorMacro: string) {
  if (suppressNextSectorFocus.value) {
    suppressNextSectorFocus.value = false
    return
  }
  emit('focus-sector', sectorMacro)
}

watch(() => props.sectorGroupId, () => {
  closeBindMenu()
  clearPendingDrag()
  finishActiveDrag()
})

const onWindowMouseMove = (event: MouseEvent) => {
  if (!pendingDrag.value || activeDragKey.value) return
  const dx = event.clientX - pendingDrag.value.startX
  const dy = event.clientY - pendingDrag.value.startY
  if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return
  activeDragKey.value = pendingDrag.value.key
  emit('drag-station-start', pendingDrag.value.payload)
}

const onWindowMouseUp = () => {
  clearPendingDrag()
  finishActiveDrag()
}

onMounted(() => {
  document.addEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.addEventListener('resize', onBindMenuViewportChange)
  window.addEventListener('scroll', onBindMenuViewportChange, true)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.removeEventListener('resize', onBindMenuViewportChange)
  window.removeEventListener('scroll', onBindMenuViewportChange, true)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})
</script>

<template>
  <div class="binding-station">
    <!-- Station Blueprints (Top) -->
    <div class="section-title-row">
      <div class="section-header">{{ t('map.binding_station_blueprints') }}</div>
      <button
        type="button"
        class="station-action blueprint-empire-button"
        ref="blueprintEmpireMenuTriggerEl"
        @click="toggleBlueprintEmpireMenu"
      >
        {{ blueprintEmpire?.name || t('map.binding_select_blueprint_empire') }}
        <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
    <div v-if="freeStations.length === 0" class="empty-hint">
      {{ t('map.binding_no_blueprint_stations') }}
    </div>
    <div v-else class="free-stations">
      <!-- Station Blueprints -->
      <div
        v-for="item in freeStations"
        :key="item.station.id"
        class="free-station-item"
        :class="{ 'free-station-item--dragging': activeDragKey === item.station.id }"
        @mousedown="onFreeStationMouseDown($event, item)"
      >
        <img
          class="entry-icon"
          :src="getEmpireStationIcon(item.station)"
          alt=""
        />
        <div class="station-info">
          <div class="station-name">{{ item.station.name }}</div>
        </div>
        <div class="station-handle">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- Anchor & Coverage Sectors (Bottom) -->
    <div class="section-header">{{ t('map.binding_anchor_and_coverage_sectors') }}</div>
    <div v-if="anchorAndCoverageSectors.length === 0" class="empty-hint">
      {{ t('map.binding_no_stations') }}
    </div>
    <div v-else class="sector-groups">
      <div
        v-for="sector in anchorAndCoverageSectors"
        :key="sector.sectorMacro"
        class="sector-group"
      >
        <div class="sector-header">
          <span
            class="sector-pill"
            :class="{ 'sector-pill--anchor': sector.isAnchor }"
            @click="emit('focus-sector', sector.sectorMacro)"
          >
            {{ sector.sectorName }}
          </span>
          <span v-if="!sector.isAnchor" class="sector-distance">{{ sector.distance }}j</span>
        </div>

        <div v-if="sector.saveStations.length > 0 || sector.placedFreeStations.length > 0 || sector.missingBoundStations.length > 0 || sector.hasPlacedVirtualTradestation || sector.hasMissingVirtualTradestation" class="sector-stations">
          <!-- Save Stations -->
          <div
            v-for="station in sector.saveStations"
            :key="station.code"
            class="station-item"
            :class="{ 'station-item--bound': isSaveStationBound(station.code) }"
            @click="onSectorItemClick(sector.sectorMacro)"
          >
            <img class="entry-icon" :src="getSaveStationIcon(station)" alt="" />
            <div class="station-text">
              <div class="station-title-row">
                <span class="station-label">{{ getStationLabel(station) }}</span>
                <span v-if="station.is_headquarter" class="station-badge">HQ</span>
              </div>
              <span class="station-code">{{ station.code }}</span>
            </div>
            <div class="station-actions">
              <button
                class="station-action"
                :class="{ 'station-action--bound': isSaveStationBound(station.code), 'station-action--error': hasDanglingBoundStation(station.code) }"
                type="button"
                @click.stop="toggleBindMenu($event, station, sector.sectorMacro)"
              >
                {{ getBindButtonLabel(station.code) }}
                <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Placed Free Stations -->
          <div
            v-for="placed in sector.placedFreeStations"
            :key="placed.stationId"
            class="station-item station-item--placed"
            :class="{ 'station-item--dragging': activeDragKey === placed.stationId }"
            @mousedown="onPlacedFreeStationMouseDown($event, placed)"
            @click="onSectorItemClick(sector.sectorMacro)"
          >
            <img class="entry-icon" :src="getEmpireStationIconById(placed.stationId)" alt="" />
            <div class="station-text">
              <span class="station-label">{{ placed.stationName }}</span>
              <span class="station-code">x: {{ formatCoordKm(placed.position.x) }} / z: {{ formatCoordKm(placed.position.z) }}</span>
            </div>
            <button class="placed-clear" type="button" @click.stop="clearFreeStationBinding(placed.stationId)">×</button>
          </div>

          <div
            v-for="missing in sector.missingBoundStations"
            :key="`missing-${missing.stationId}`"
            class="station-item station-item--missing"
          >
            <img class="entry-icon" :src="getEmpireStationIconById(missing.stationId)" alt="" />
            <div class="station-text">
              <span class="station-label">{{ missing.stationName }}</span>
              <span class="station-code">{{ t('map.binding_status_missing') }}</span>
            </div>
            <button class="placed-clear" type="button" @click.stop="unbindStation(missing.stationId)">×</button>
          </div>

          <!-- Placed Virtual Tradestation -->
          <div
            v-if="sector.hasPlacedVirtualTradestation"
            class="station-item station-item--placed station-item--tradestation"
            :class="{ 'station-item--dragging': activeDragKey === '__virtual_tradestation__' }"
            @mousedown="onVirtualTradestationMouseDown($event)"
            @click="onSectorItemClick(sector.sectorMacro)"
          >
            <img class="entry-icon" :src="tradestationIconUrl" alt="" />
            <div class="station-text">
              <span class="station-label">{{ t('map.binding_sector_tradestation') }}</span>
              <span v-if="sector.placedVirtualTradestationPosition" class="station-code">
                x: {{ formatCoordKm(sector.placedVirtualTradestationPosition.x) }} / z:
                {{ formatCoordKm(sector.placedVirtualTradestationPosition.z) }}
              </span>
            </div>
            <button class="placed-clear" type="button" @click.stop="clearSectorTradestationBinding()">×</button>
          </div>

          <div
            v-if="sector.hasMissingVirtualTradestation"
            class="station-item station-item--missing station-item--tradestation"
          >
            <img class="entry-icon" :src="tradestationIconUrl" alt="" />
            <div class="station-text">
              <span class="station-label">{{ t('map.binding_sector_tradestation') }}</span>
              <span class="station-code">{{ t('map.binding_status_missing') }}</span>
            </div>
            <button class="placed-clear" type="button" @click.stop="clearSectorTradestationBinding">×</button>
          </div>
        </div>
        <div v-else class="sector-empty">
          <span class="empty-text">{{ t('map.binding_no_stations') }}</span>
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
          <div class="bind-menu-group-title">{{ t('map.binding_station_blueprints') }}</div>
          <button
            v-if="bindMenuSaveStation && hasDanglingBoundStation(bindMenuSaveStation.code)"
            type="button"
            class="bind-menu-item bind-menu-item--error"
            @click.prevent
          >
            <span class="bind-menu-item-name">{{ t('map.binding_abnormal_station') }}</span>
            <span class="bind-menu-item-side">
              <button
                type="button"
                class="bind-menu-item-clear"
                @click.stop="clearCurrentSaveStationBinding"
              >×</button>
            </span>
          </button>
	          <template v-for="item in allStationsForMenu" :key="'station' in item ? item.station.id : item.type === 'stationPlan' ? `plan-${item.planId}` : 'virtual-ts'">
	            <!-- Empire Station -->
	            <button
	              v-if="'station' in item"
	              type="button"
	              class="bind-menu-item"
	              :class="{
	                active: bindMenuSaveStation && getSaveStationPlan(bindMenuSaveStation.code)?.id === item.station.id,
	                'bind-menu-item--placed': item.placed,
	                'bind-menu-item--disabled': item.disabled
	              }"
	              :disabled="item.disabled"
              @click="bindToStation(item.station.id)"
            >
              <span class="bind-menu-item-name">{{ item.station.name }}</span>
	              <span class="bind-menu-item-side">
	                <button
	                  v-if="bindMenuSaveStation && getSaveStationPlan(bindMenuSaveStation.code)?.id === item.station.id"
	                  type="button"
	                  class="bind-menu-item-clear"
	                  @click.stop="clearCurrentSaveStationBinding"
	                >×</button>
	              </span>
	            </button>
	            <!-- Bound copied station plan -->
	            <button
	              v-else-if="item.type === 'stationPlan'"
	              type="button"
	              class="bind-menu-item active"
	              :class="{ 'bind-menu-item--placed': item.placed }"
	              @click.prevent
	            >
	              <span class="bind-menu-item-name">{{ item.name }}</span>
	              <span class="bind-menu-item-side">
	                <button
	                  type="button"
	                  class="bind-menu-item-clear"
	                  @click.stop="clearCurrentSaveStationBinding"
	                >×</button>
	              </span>
	            </button>
	            <!-- Virtual Tradestation -->
	            <button
	              v-else
              type="button"
              class="bind-menu-item bind-menu-item--tradestation"
              :class="{
                active: bindMenuSaveStation && currentGroupBinding?.tradestationBinding?.saveStationCode === bindMenuSaveStation.code,
                'bind-menu-item--placed': item.placed,
                'bind-menu-item--disabled': item.disabled
              }"
              :disabled="item.disabled"
              @click="bindToSectorTradestation()"
            >
              <span class="bind-menu-item-name">{{ item.name }}</span>
              <span class="bind-menu-item-side">
                <button
                  v-if="bindMenuSaveStation && currentGroupBinding?.tradestationBinding?.saveStationCode === bindMenuSaveStation.code"
                  type="button"
                  class="bind-menu-item-clear"
                  @click.stop="clearCurrentSaveStationBinding"
                >×</button>
              </span>
            </button>
          </template>
          <div v-if="allStationsForMenu.length === 0" class="bind-menu-empty">
            {{ t('map.binding_no_blueprint_stations') }}
          </div>
        </div>

        <div class="bind-menu-group">
          <div class="bind-menu-group-title">{{ t('map.binding_import') }}</div>
          <button
            type="button"
            class="bind-menu-item bind-menu-item--import"
            @click="importSaveStationFromMenu"
          >
            {{ t('map.binding_import_as_new') }}
          </button>
        </div>
      </div>

      <div
        v-if="blueprintEmpireMenuOpen"
        class="bind-menu"
        ref="blueprintEmpireMenuRef"
        :style="blueprintEmpireMenuStyle"
      >
        <div class="bind-menu-group">
          <div class="bind-menu-group-title">{{ t('map.binding_blueprint_empire') }}</div>
          <button
            v-for="empire in blueprintEmpires"
            :key="empire.id"
            type="button"
            class="bind-menu-item"
            :class="{ active: empire.id === selectedBlueprintEmpireId }"
            @click="selectBlueprintEmpire(empire.id)"
          >
            <span class="bind-menu-item-name">{{ empire.name }}</span>
            <span class="bind-menu-item-side">{{ empire.stations?.length || 0 }}</span>
          </button>
          <div v-if="blueprintEmpires.length === 0" class="bind-menu-empty">
            {{ t('map.binding_no_blueprint_empires') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.binding-station {
  @apply flex flex-col gap-3;
}

.section-header {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.section-title-row {
  @apply flex items-center justify-between gap-2;
}

.blueprint-empire-button {
  @apply max-w-[12rem] overflow-hidden text-ellipsis;
}

.empty-hint {
  @apply text-center text-sm text-amber-100/40;
}

/* Free Stations */
.free-stations {
  @apply flex flex-col gap-1;
}

.free-station-item {
  @apply flex items-center gap-2 rounded border border-amber-300/15 bg-black/30 p-2 cursor-grab transition-colors hover:border-amber-200/30;
  user-select: none;
}

.free-station-item--dragging {
  @apply opacity-50 cursor-grabbing;
}

.free-station-item--virtual {
  @apply border-amber-400/30 bg-amber-200/5;
}

.entry-icon {
  @apply h-8 w-8 shrink-0;
}

.station-info {
  @apply flex-1;
}

.station-name {
  @apply text-sm text-amber-100;
}

.station-type {
  @apply mt-0.5 text-xs text-amber-100/50;
}

.station-handle {
  @apply flex flex-col gap-0.5 opacity-40;
}

.station-handle span {
  @apply block h-0.5 w-4 rounded-full bg-amber-100;
}

/* Sector Groups */
.sector-groups {
  @apply flex flex-col gap-2;
}

.sector-group {
  @apply rounded border border-amber-300/15 bg-black/30 p-2;
}

.sector-header {
  @apply flex items-center justify-between gap-2 mb-2;
}

.sector-pill {
  @apply inline-flex items-center rounded-full border border-amber-300/25 bg-amber-200/10 px-2.5 py-1 text-sm text-amber-100 cursor-pointer transition-colors hover:bg-amber-200/20 hover:text-amber-50;
}

.sector-pill--anchor {
  @apply border-amber-400/40 bg-amber-300/15 text-amber-50 font-medium;
}

.sector-distance {
  @apply text-xs text-amber-100/50;
}

.sector-stations {
  @apply flex flex-col gap-1;
}

.sector-empty {
  @apply py-2 text-center;
}

.empty-text {
  @apply text-xs text-amber-100/40;
}

/* Station Items */
.station-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/10 bg-black/25 p-2 cursor-pointer transition-colors hover:border-amber-200/25;
  user-select: none;
}

.station-item--bound {
  @apply border-amber-200/30;
}

.station-item--placed {
  @apply border-emerald-300/20 bg-emerald-900/10;
}

.station-item--missing {
  @apply border-rose-300/20 bg-rose-950/15;
}

.station-text {
  @apply flex min-w-0 flex-1 flex-col justify-center gap-0.5;
}

.station-title-row {
  @apply flex items-center gap-1;
}

.station-label {
  @apply truncate text-sm text-amber-50;
}

.station-badge {
  @apply rounded-full border border-emerald-400/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300;
}

.station-code {
  @apply text-xs text-amber-100/50;
}

.station-actions {
  @apply ml-2 flex items-center gap-1;
}

.station-action {
  @apply inline-flex items-center whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.station-action--bound {
  @apply border-amber-200/50 bg-amber-200/15 text-amber-50;
}

.station-action--error {
  @apply border-rose-400/45 bg-rose-500/15 text-rose-200;
}

.action-chevron {
  @apply ml-1 h-3 w-3;
}

.placed-clear {
  @apply ml-2 inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-amber-100/40 transition-colors hover:border-amber-200/15 hover:bg-amber-200/5 hover:text-amber-50;
}

/* Bind Menu */
.bind-menu {
  @apply fixed z-[100] min-w-[40px] overflow-y-auto rounded-lg border-2 border-amber-400 bg-black/95 py-2 shadow-2xl;
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
  @apply flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-amber-100 transition-colors hover:bg-amber-200/10;
}

.bind-menu-item.active {
  @apply bg-amber-200/15 text-amber-50;
}

.bind-menu-item--error {
  @apply bg-rose-500/10 text-rose-200 hover:bg-rose-500/10;
}

.bind-menu-item--placed {
  @apply bg-sky-900/25;
}

.bind-menu-item-name {
  @apply flex-1;
}

.bind-menu-item--disabled {
  @apply cursor-pointer opacity-45 hover:bg-transparent;
}

.bind-menu-item--import {
  @apply text-amber-200/80;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}

.bind-menu-item-side {
  @apply ml-2 flex items-center gap-2;
}

.bind-menu-item-clear {
  @apply inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-base leading-none text-amber-100/55 transition-colors hover:bg-amber-200/10 hover:text-amber-50;
}
</style>
