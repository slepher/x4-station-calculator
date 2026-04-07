<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { resolveStationSaveBinding } from '@/store/logic/saveBindingUtils'
import type { StationSaveBinding, StationPlan } from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'
import factoryIconUrl from '@/components/icons/factory.svg'
import shipyardIconUrl from '@/components/icons/shipyard.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'

const props = defineProps<{
  gameGuid: string
  sectorGroupId: string
}>()

const emit = defineEmits<{
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean }): void
  (e: 'drag-station-end'): void
}>()

const { t, te } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const importStationName = ref('')

const bindMenuOpen = ref(false)
const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})
const bindMenuSaveStation = ref<PlayerStationEntry | null>(null)
const bindMenuSectorMacro = ref<string | null>(null)
const bindMenuTriggerEl = ref<HTMLElement | null>(null)

const pendingDrag = ref<{
  key: string
  payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean }
  startX: number
  startY: number
} | null>(null)
const activeDragKey = ref<string | null>(null)
const DRAG_START_THRESHOLD_PX = 4
const suppressNextSectorFocus = ref(false)

const iconUrlByType = {
  factory: factoryIconUrl,
  shipyard: shipyardIconUrl
}

const activeEmpire = computed(() => empireStore.activeEmpire)
const activeBindingPlan = computed(() => {
  return empireStore.activeEmpire?.saveBindings?.find((p) => p.gameGuid === props.gameGuid) || null
})

const currentGroupBinding = computed(() => {
  return activeBindingPlan.value?.groupBindings.find((b) => b.sectorGroupId === props.sectorGroupId) || null
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

const freeStations = computed(() => {
  if (!activeEmpire.value) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  
  // 所有没有 stationBinding 的 empire station 都是自由空间站
  const freeEmpireStations = activeEmpire.value.stations
    .filter((station) => {
      const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
      return !binding
    })
    .map((station) => ({
      station,
      sectorGroupId: station.sectorId || '',
      sectorGroupName: '',
      sectorMacro: undefined,
      type: station.sectorId ? 'empire' as const : 'orphan' as const
    }))

  return freeEmpireStations
})

const virtualTradestation = computed(() => {
  if (!currentGroupBinding.value) return null
  
  // 未放置 = 无 tradestationBinding
  if (!currentGroupBinding.value.tradestationBinding) {
    return {
      type: 'virtual' as const,
      name: t('map.binding_tradestation_virtual')
    }
  }
  return null
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
      if (sectorData?.playerStations) {
        saveStations.push(...sectorData.playerStations)
      }
    }

    const placedFreeStations: Array<{ stationId: string; stationName: string; sectorMacro: string; position: { x: number; y: number; z: number } }> = []
    const missingBoundStations: Array<{ stationId: string; stationName: string }> = []
    const stationBindings = currentGroupBinding.value.stationBindings || []
    for (const binding of stationBindings) {
      if (binding.sectorMacro === sectorMacro && binding.position) {
        const station = activeEmpire.value?.stations.find(s => s.id === binding.stationId)
        const resolved = resolveStationSaveBinding(binding, activeArchive.value)
        if (station && !binding.saveStationCode) {
          placedFreeStations.push({
            stationId: station.id,
            stationName: station.name,
            sectorMacro: binding.sectorMacro,
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
    const hasPlacedVirtualTradestation = !!(tb?.position && tb.sectorMacro === sectorMacro)

    results.push({
      sectorMacro,
      sectorName,
      isAnchor,
      distance,
      saveStations,
      placedFreeStations,
      missingBoundStations,
      hasPlacedVirtualTradestation
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

function isSaveStationBound(saveStationCode: string): boolean {
  return empireStore.isSaveStationAlreadyBound(props.gameGuid, props.sectorGroupId, saveStationCode)
}

function getBoundEmpireStation(saveStationCode: string): StationPlan | null {
  const binding = currentGroupBinding.value?.stationBindings.find(
    (b: StationSaveBinding) => b.saveStationCode === saveStationCode
  )
  if (!binding) return null
  return activeEmpire.value?.stations?.find((s) => s.id === binding.stationId) || null
}

function getBindButtonLabel(saveStationCode: string): string {
  if (isSaveStationBound(saveStationCode)) {
    const station = getBoundEmpireStation(saveStationCode)
    return station?.name || t('map.binding_bind')
  }
  return t('map.binding_bind')
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

function toggleBindMenu(event: MouseEvent, station: PlayerStationEntry, sectorMacro: string) {
  bindMenuSaveStation.value = station
  bindMenuSectorMacro.value = sectorMacro
  bindMenuTriggerEl.value = event.currentTarget as HTMLElement
  bindMenuOpen.value = !bindMenuOpen.value
  if (bindMenuOpen.value) {
    nextTick(() => updateBindMenuPosition())
  }
}

function closeBindMenu() {
  bindMenuOpen.value = false
  bindMenuSaveStation.value = null
  bindMenuSectorMacro.value = null
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

function bindToStation(stationId: string) {
  if (!bindMenuSaveStation.value || !bindMenuSectorMacro.value) return

  empireStore.bindStationToSaveStation({
    gameGuid: props.gameGuid,
    sectorGroupId: props.sectorGroupId,
    stationId,
    saveStationCode: bindMenuSaveStation.value.code,
    sectorMacro: bindMenuSectorMacro.value,
    position: {
      x: bindMenuSaveStation.value.position.x,
      y: bindMenuSaveStation.value.position.y,
      z: bindMenuSaveStation.value.position.z
    }
  })

  closeBindMenu()
}

function bindToVirtualTradestation() {
  if (!bindMenuSaveStation.value) return

  const tb = currentGroupBinding.value?.tradestationBinding
  const sectorMacro = tb?.sectorMacro || bindMenuSectorMacro.value || currentGroupBinding.value?.sectorMacro
  
  empireStore.bindTradestationToSaveStation({
    gameGuid: props.gameGuid,
    sectorGroupId: props.sectorGroupId,
    saveStationCode: bindMenuSaveStation.value.code,
    sectorMacro: sectorMacro || undefined,
    position: tb?.position || {
      x: bindMenuSaveStation.value.position.x,
      y: bindMenuSaveStation.value.position.y,
      z: bindMenuSaveStation.value.position.z
    }
  })

  closeBindMenu()
}

function unbindStation(stationId: string) {
  empireStore.clearStationBinding(props.gameGuid, props.sectorGroupId, stationId)
}

function importSaveStation(station: PlayerStationEntry, sectorMacro: string) {
  const stationName = importStationName.value || station.code.split('_').pop() || station.code
  const newStation = empireStore.createStation(stationName, 'industrial', false)

  if (!newStation) return

  newStation.sectorId = props.sectorGroupId

  empireStore.importSaveStationAsBinding({
    gameGuid: props.gameGuid,
    sectorGroupId: props.sectorGroupId,
    stationId: newStation.id,
    saveStation: station,
    sectorMacro
  })

  importStationName.value = ''
  closeBindMenu()
}

function importSaveStationFromMenu() {
  if (!bindMenuSaveStation.value || !bindMenuSectorMacro.value) return
  importSaveStation(bindMenuSaveStation.value, bindMenuSectorMacro.value)
}

function clearFreeStationBinding(stationId: string) {
  empireStore.clearStationBinding(props.gameGuid, props.sectorGroupId, stationId)
}

function clearVirtualTradestationBinding() {
  empireStore.clearTradestationBinding(props.gameGuid, props.sectorGroupId)
}

function formatCoordKm(value: number): string {
  return `${(value / 1000).toFixed(1)}km`
}

const allStationsForMenu = computed(() => {
  if (!activeEmpire.value || !props.sectorGroupId) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  
  // 所有 empire station
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
    type: 'virtualTradestation'
    name: string
    sectorGroupId: string
    sectorMacro?: string
    disabled?: boolean
    placed?: boolean
  }> = []

  for (const station of activeEmpire.value.stations) {
    const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
    
    if (station.id === boundStationId) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding?.sectorMacro,
        placed: Boolean(binding?.position)
      })
    } else if (binding && !binding.saveStationCode) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding?.sectorMacro,
        placed: Boolean(binding?.position)
      })
    } else if (binding?.saveStationCode) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding.sectorMacro,
        disabled: true,
        placed: Boolean(binding.position)
      })
    } else if (!binding) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: undefined
      })
    }
  }

  // 3. 已放置未绑定的虚拟补给站（有 position，无 tradestationCode）
  // 4. 未放置的虚拟补给站（无 tradestationBinding）
  // 只有定位星区的 save station 可以绑定虚拟补给站
  const anchorMacro = currentGroupBinding.value?.sectorMacro
  const tb = currentGroupBinding.value?.tradestationBinding
  const tradestationCode = currentGroupBinding.value?.tradestationCode
  const isAnchorSector = bindMenuSectorMacro.value === anchorMacro
  
  if (isAnchorSector) {
    if (tb?.position && !tradestationCode) {
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_tradestation_virtual'),
        sectorGroupId: props.sectorGroupId,
        sectorMacro: tb.sectorMacro,
        placed: true
      })
    } else if (tb?.position && tradestationCode) {
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_tradestation_virtual'),
        sectorGroupId: props.sectorGroupId,
        sectorMacro: tb.sectorMacro,
        disabled: true,
        placed: true
      })
    } else if (!tb) {
      items.push({
        type: 'virtualTradestation',
        name: t('map.binding_tradestation_virtual'),
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
      name: t('map.binding_tradestation_virtual'),
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
      coverageSectorMacros: buildStationDragCoverage()
    },
    startX: event.clientX,
    startY: event.clientY
  }
}

function onPlacedFreeStationMouseDown(event: MouseEvent, placed: { stationId: string }) {
  if (event.button !== 0) return
  const station = activeEmpire.value?.stations.find((item) => item.id === placed.stationId)
  if (!station) return
  onFreeStationMouseDown(event, {
    station,
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
    <!-- Free Stations (Top) -->
    <div class="section-header">{{ t('map.binding_free_stations') }}</div>
    <div v-if="freeStations.length === 0 && !virtualTradestation" class="empty-hint">
      {{ t('map.binding_no_stations') }}
    </div>
    <div v-else class="free-stations">
      <!-- Virtual Trade Station -->
      <div
        v-if="virtualTradestation"
        class="free-station-item free-station-item--virtual"
        :class="{ 'free-station-item--dragging': activeDragKey === '__virtual_tradestation__' }"
        @mousedown="onVirtualTradestationMouseDown($event)"
      >
        <div class="station-icon-wrap">
          <img class="station-icon" :src="tradestationIconUrl" alt="" />
        </div>
        <div class="station-info">
          <div class="station-name">{{ virtualTradestation.name }}</div>
          <div class="station-type">{{ t('map.binding_tradestation_virtual') }}</div>
        </div>
        <div class="station-handle">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Empire Free Stations -->
      <div
        v-for="item in freeStations"
        :key="item.station.id"
        class="free-station-item"
        :class="{
          'free-station-item--dragging': activeDragKey === item.station.id,
          'free-station-item--orphan': item.type === 'orphan'
        }"
        @mousedown="onFreeStationMouseDown($event, item)"
      >
        <img
          class="station-icon"
          :src="iconUrlByType[item.station.type === 'shipyard' ? 'shipyard' : 'factory']"
          alt=""
        />
        <div class="station-info">
          <div class="station-name">{{ item.station.name }}</div>
          <div v-if="item.type === 'orphan'" class="station-type">
            {{ t('map.binding_sector_not_bound') }}
          </div>
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

        <div v-if="sector.saveStations.length > 0 || sector.placedFreeStations.length > 0 || sector.missingBoundStations.length > 0 || sector.hasPlacedVirtualTradestation" class="sector-stations">
          <!-- Save Stations -->
          <div
            v-for="station in sector.saveStations"
            :key="station.code"
            class="station-item"
            :class="{ 'station-item--bound': isSaveStationBound(station.code) }"
            @click="onSectorItemClick(sector.sectorMacro)"
          >
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
                :class="{ 'station-action--bound': isSaveStationBound(station.code) }"
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
            <img class="placed-icon" :src="factoryIconUrl" alt="" />
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
            <img class="placed-icon" :src="factoryIconUrl" alt="" />
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
            <img class="placed-icon" :src="tradestationIconUrl" alt="" />
            <div class="station-text">
              <span class="station-label">{{ t('map.binding_tradestation_virtual') }}</span>
            </div>
            <button class="placed-clear" type="button" @click.stop="clearVirtualTradestationBinding()">×</button>
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
          <div class="bind-menu-group-title">{{ t('map.binding_free_stations') }}</div>
          <template v-for="item in allStationsForMenu" :key="'station' in item ? item.station.id : 'virtual-ts'">
            <!-- Empire Station -->
            <button
              v-if="'station' in item"
              type="button"
              class="bind-menu-item"
              :class="{
                active: bindMenuSaveStation && getBoundEmpireStation(bindMenuSaveStation.code)?.id === item.station.id,
                'bind-menu-item--placed': item.placed,
                'bind-menu-item--disabled': item.disabled
              }"
              :disabled="item.disabled"
              @click="bindToStation(item.station.id)"
            >
              <span class="bind-menu-item-name">{{ item.station.name }}</span>
              <span v-if="item.placed" class="bind-menu-item-type">{{ t('map.binding_position_set') }}</span>
            </button>
            <!-- Virtual Tradestation -->
            <button
              v-else
              type="button"
              class="bind-menu-item bind-menu-item--tradestation"
              :class="{
                active: bindMenuSaveStation && currentGroupBinding?.tradestationCode === bindMenuSaveStation.code,
                'bind-menu-item--placed': item.placed,
                'bind-menu-item--disabled': item.disabled
              }"
              :disabled="item.disabled"
              @click="bindToVirtualTradestation()"
            >
              <span class="bind-menu-item-name">{{ item.name }}</span>
              <span class="bind-menu-item-type">{{ t('map.binding_tradestation_virtual') }}</span>
            </button>
          </template>
          <div v-if="allStationsForMenu.length === 0" class="bind-menu-empty">
            {{ t('map.binding_no_idle_stations') }}
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

.free-station-item--orphan {
  @apply border-orange-300/20;
}

.station-icon-wrap {
  @apply flex items-center justify-center;
}

.station-icon {
  @apply h-5 w-5;
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
  @apply flex flex-col gap-0.5;
}

.station-title-row {
  @apply flex items-center gap-1;
}

.station-label {
  @apply text-sm text-amber-50;
}

.station-badge {
  @apply rounded-full border border-emerald-400/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300;
}

.station-code {
  @apply text-xs text-amber-100/50;
}

.station-actions {
  @apply flex items-center gap-1;
}

.station-action {
  @apply inline-flex items-center whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.station-action--bound {
  @apply border-amber-200/50 bg-amber-200/15 text-amber-50;
}

.action-chevron {
  @apply ml-1 h-3 w-3;
}

.placed-icon {
  @apply h-4 w-4;
}

.placed-clear {
  @apply text-amber-100/40 hover:text-amber-50;
}

/* Bind Menu */
.bind-menu {
  @apply fixed z-[100] min-w-[40px] overflow-y-auto rounded-lg border-2 border-amber-400 bg-black/95 py-2 shadow-2xl;
  backdrop-filter: blur(12px);
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

.bind-menu-item--placed {
  @apply bg-sky-900/25;
}

.bind-menu-item-name {
  @apply flex-1;
}

.bind-menu-item--disabled {
  @apply cursor-not-allowed opacity-45 hover:bg-transparent;
}

.bind-menu-item-type {
  @apply text-xs text-amber-100/55;
}

.bind-menu-item--import {
  @apply text-amber-200/80;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}
</style>
