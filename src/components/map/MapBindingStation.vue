<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getCoverageSectors, buildSectorGraphFromMaps, resolveStationSaveBinding } from '@/store/logic/saveBindingUtils'
import JumpInput from '@/components/common/JumpInput.vue'
import type { StationSaveBinding, StationPlan } from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'
import factoryIconUrl from '@/components/icons/factory.svg'
import shipyardIconUrl from '@/components/icons/shipyard.svg'

type SectorWithStations = {
  sectorMacro: string
  sectorName: string
  distance: number
  stations: PlayerStationEntry[]
}

const props = defineProps<{
  gameGuid: string
  sectorGroupId: string
}>()

const emit = defineEmits<{
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard'; coverageSectorMacros: string[] }): void
  (e: 'drag-station-end'): void
}>()

const { t, te } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const selectedJumpRange = ref(3)
const importStationName = ref('')

const bindMenuOpen = ref(false)
const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})
const bindMenuSaveStation = ref<PlayerStationEntry | null>(null)
const bindMenuSectorMacro = ref<string | null>(null)
const bindMenuTriggerEl = ref<HTMLElement | null>(null)

const pendingDrag = ref<{
  item: { station: StationPlan; sectorGroupId: string; sectorGroupName: string }
  startX: number
  startY: number
} | null>(null)
const activeDragStationId = ref<string | null>(null)
const DRAG_START_THRESHOLD_PX = 4

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
  if (!activeBindingPlan.value) return null
  const guid = activeBindingPlan.value.gameGuid
  const time = activeBindingPlan.value.selectedArchiveTime
  const group = saveStore.archives.get(guid)
  if (!group) return null
  if (time === null || time === undefined) {
    return group.saves[0] || null
  }
  return group.saves.find((s) => s.meta.time === time) || group.saves[0] || null
})

const sectorGraphData = computed(() => {
  return buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
})

const coverageSectors = computed(() => {
  if (!currentGroupBinding.value?.sectorMacro) return []
  return getCoverageSectors(currentGroupBinding.value.sectorMacro, selectedJumpRange.value, sectorGraphData.value.sectorGraph, sectorGraphData.value.sectorClusterMap)
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
    const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, sectorMacro)
    let sectorName = sector.name || sectorMacro
    if (resolved?.sectorId) {
      const cluster = gameDataStore.maps?.clusters?.[resolved.clusterId]
      const mapSector = cluster?.sectors?.[resolved.sectorId]
      if (mapSector?.nameId && te(mapSector.nameId)) {
        sectorName = t(mapSector.nameId)
      }
    }

    results.push({
      sectorMacro,
      sectorName,
      distance,
      stations
    })
  }

  return results.sort((a, b) => a.distance - b.distance)
})

const idleStations = computed(() => {
  if (!activeEmpire.value || !props.sectorGroupId) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  const sectorStations = activeEmpire.value.stations.filter((s) => s.sectorId === props.sectorGroupId)

  return sectorStations
    .filter((station) => {
      const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
      return !binding?.saveStationCode
    })
    .map((station) => {
      const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)
      return {
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding?.sectorMacro
      }
    })
})

const tradeStationsInSelectedSector = computed(() => {
  if (!activeArchive.value || !currentGroupBinding.value?.sectorMacro) return []
  
  const sectorData = activeArchive.value.sectors[currentGroupBinding.value.sectorMacro]
  if (!sectorData) return []
  
  return (sectorData.npcStations || []).filter((s) => s.isTradestation)
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

function updateJumpLimit(value: number) {
  selectedJumpRange.value = value
  empireStore.updateSectorGroupJumpRange(props.gameGuid, props.sectorGroupId, selectedJumpRange.value)
}

// @ts-ignore - Used in template
function stepJumpLimit(delta: number) {
  updateJumpLimit(selectedJumpRange.value + delta)
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

function bindTradeStation(code: string) {
  if (!currentGroupBinding.value) return
  empireStore.setTradestationBinding({
    gameGuid: props.gameGuid,
    sectorGroupId: props.sectorGroupId,
    saveStationCode: code
  })
}

function clearFreeStationBinding(stationId: string) {
  empireStore.clearStationBinding(props.gameGuid, props.sectorGroupId, stationId)
}

function getStationBindingStatus(stationId: string): 'ok' | 'missing' | 'none' {
  const binding = currentGroupBinding.value?.stationBindings.find((b: StationSaveBinding) => b.stationId === stationId)
  if (!binding) return 'none'
  const resolved = resolveStationSaveBinding(binding, activeArchive.value)
  return resolved.status === 'ok' ? 'ok' : 'missing'
}

function getSectorMacroDisplayName(sectorMacro: string): string {
  const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, sectorMacro)
  if (resolved?.sectorId) {
    const cluster = gameDataStore.maps?.clusters?.[resolved.clusterId]
    const sector = cluster?.sectors?.[resolved.sectorId]
    if (sector?.nameId && te(sector.nameId)) return t(sector.nameId)
    return sector?.name || sectorMacro
  }
  return sectorMacro
}

const allStationsForMenu = computed(() => {
  if (!activeEmpire.value || !props.sectorGroupId) return []

  const stationBindings = currentGroupBinding.value?.stationBindings || []
  const sectorStations = activeEmpire.value.stations.filter((s) => s.sectorId === props.sectorGroupId)

  const boundStationId = bindMenuSaveStation.value
    ? stationBindings.find((b: StationSaveBinding) => b.saveStationCode === bindMenuSaveStation.value?.code)?.stationId
    : null

  const items: { station: StationPlan; sectorGroupId: string; sectorGroupName: string; sectorMacro?: string }[] = []

  for (const station of sectorStations) {
    const binding = stationBindings.find((b: StationSaveBinding) => b.stationId === station.id)

    if (station.id === boundStationId) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding?.sectorMacro
      })
    } else if (!binding?.saveStationCode) {
      items.push({
        station,
        sectorGroupId: station.sectorId || '',
        sectorGroupName: '',
        sectorMacro: binding?.sectorMacro
      })
    }
  }

  return items
})

function onIdleStationMouseDown(event: MouseEvent, item: { station: StationPlan; sectorGroupId: string }) {
  pendingDrag.value = {
    item: { ...item, sectorGroupName: '' },
    startX: event.clientX,
    startY: event.clientY
  }
}

watch(() => props.sectorGroupId, () => {
  closeBindMenu()
})

onMounted(() => {
  document.addEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.addEventListener('resize', onBindMenuViewportChange)
  window.addEventListener('scroll', onBindMenuViewportChange, true)

  const onWindowMouseMove = (event: MouseEvent) => {
    if (pendingDrag.value && !activeDragStationId.value) {
      const dx = event.clientX - pendingDrag.value.startX
      const dy = event.clientY - pendingDrag.value.startY
      if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return
      activeDragStationId.value = pendingDrag.value.item.station.id
      emit('drag-station-start', {
        stationId: pendingDrag.value.item.station.id,
        gameGuid: props.gameGuid,
        sectorGroupId: props.sectorGroupId,
        name: pendingDrag.value.item.station.name,
        icon: pendingDrag.value.item.station.type === 'shipyard' ? 'shipyard' : 'factory',
        coverageSectorMacros: currentGroupBinding.value?.coverageSectorMacros || []
      })
    }
  }

  const onWindowMouseUp = () => {
    if (activeDragStationId.value) {
      emit('drag-station-end')
    }
    pendingDrag.value = null
    activeDragStationId.value = null
  }

  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', onBindMenuGlobalPointerDown)
    window.removeEventListener('resize', onBindMenuViewportChange)
    window.removeEventListener('scroll', onBindMenuViewportChange, true)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  })
})
</script>

<template>
  <div class="binding-station">
    <!-- Jump Range Selector -->
    <div class="jump-range">
      <label class="label">{{ t('map.binding_jump_range') }}</label>
      <JumpInput
        v-model="selectedJumpRange"
        :min="0"
        :max="5"
        @update:model-value="updateJumpLimit"
      />
    </div>

    <!-- Current Group Info -->
    <div class="current-group">
      <span class="group-label">{{ t('map.binding_sector_group') }}:</span>
      <span class="group-name">{{ activeEmpire?.sectors?.find(s => s.id === props.sectorGroupId)?.name }}</span>
    </div>

    <!-- Save Stations -->
    <div class="section-header">{{ t('map.binding_save_stations') }}</div>
    <div class="poi-groups">
      <div class="poi-stats">
        {{ coverageSectorsWithStations.reduce((sum, s) => sum + s.stations.length, 0) }} {{ t('map.save_coord_count') }}
      </div>

      <div v-if="coverageSectorsWithStations.length === 0" class="empty-hint">
        {{ t('map.binding_no_stations') }}
      </div>

      <div
        v-for="sector in coverageSectorsWithStations"
        :key="sector.sectorMacro"
        class="poi-group"
      >
        <div class="poi-header">
          <span class="poi-name">{{ sector.sectorName }}</span>
          <span class="poi-distance">{{ sector.distance }}j</span>
        </div>
        <div class="poi-list">
          <div
            v-for="station in sector.stations"
            :key="station.code"
            class="poi-item"
            :class="{ 'poi-item--bound': isSaveStationBound(station.code) }"
            @click="emit('focus-sector', sector.sectorMacro)"
          >
            <div class="poi-text">
              <div class="poi-title-row">
                <span class="poi-code">{{ getStationLabel(station) }}</span>
                <span v-if="station.is_headquarter" class="poi-badge">HQ</span>
              </div>
              <span class="poi-subcode">{{ station.code }}</span>
            </div>
            <div class="poi-actions">
              <button
                class="poi-action"
                :class="{ 'poi-action--bound': isSaveStationBound(station.code) }"
                type="button"
                @click.stop="toggleBindMenu($event, station, sector.sectorMacro)"
              >
                {{ getBindButtonLabel(station.code) }}
                <svg class="poi-action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Trade Station Binding -->
    <div v-if="tradeStationsInSelectedSector.length > 0" class="section">
      <div class="section-header">{{ t('map.binding_bind_tradestation') }}</div>
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

    <!-- Idle Stations -->
    <div v-if="idleStations.length > 0" class="section">
      <div class="section-header">{{ t('map.binding_idle_stations') }}</div>
      <div class="idle-stations">
        <div
          v-for="item in idleStations"
          :key="item.station.id"
          class="idle-station-item"
          :class="{ 'idle-station-item--dragging': activeDragStationId === item.station.id, 'idle-station-item--bound': !!item.sectorMacro }"
          @mousedown="onIdleStationMouseDown($event, item)"
        >
          <img
            class="station-icon"
            :src="iconUrlByType[item.station.type === 'shipyard' ? 'shipyard' : 'factory']"
            alt=""
          />
          <div class="station-info">
            <div class="station-name">{{ item.station.name }}</div>
            <div v-if="item.sectorMacro" class="station-tag">
              {{ getSectorMacroDisplayName(item.sectorMacro) }}
              <button class="tag-clear" type="button" @click.stop="clearFreeStationBinding(item.station.id)">×</button>
            </div>
          </div>
          <div class="station-handle">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Existing Bindings -->
    <div v-if="stationBindingsInGroup.length > 0" class="section">
      <div class="section-header">{{ t('map.binding_existing_bindings') }}</div>
      <div class="existing-bindings">
        <div
          v-for="binding in stationBindingsInGroup"
          :key="binding.stationId"
          class="binding-item"
        >
          <div class="binding-info">
            <div class="binding-name">{{ binding.stationId }}</div>
            <div class="binding-meta">
              {{ binding.saveStationCode }}
              <span v-if="getStationBindingStatus(binding.stationId) === 'missing'" class="missing-tag">
                {{ t('map.binding_status_missing') }}
              </span>
            </div>
          </div>
          <button class="binding-clear" type="button" @click="unbindStation(binding.stationId)">×</button>
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
          <div class="bind-menu-group-title">{{ t('map.binding_idle_stations') }}</div>
          <button
            v-for="item in allStationsForMenu"
            :key="item.station.id"
            type="button"
            class="bind-menu-item"
            :class="{ active: bindMenuSaveStation && getBoundEmpireStation(bindMenuSaveStation.code)?.id === item.station.id }"
            @click="bindToStation(item.station.id)"
          >
            <span class="bind-menu-item-name">{{ item.station.name }}</span>
            <button
              v-if="bindMenuSaveStation && getBoundEmpireStation(bindMenuSaveStation.code)?.id === item.station.id"
              class="bind-menu-item-unbind"
              type="button"
              @click.stop="unbindStation(item.station.id)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
              </svg>
            </button>
          </button>
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

.jump-range {
  @apply flex items-center gap-2;
}

.label {
  @apply text-xs text-amber-100/60;
}

.current-group {
  @apply text-sm text-amber-100/60;
}

.group-label {
  @apply text-amber-100/40;
}

.group-name {
  @apply text-amber-50;
}

.section-header {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.poi-groups {
  @apply flex flex-col gap-2;
}

.poi-stats {
  @apply text-xs text-amber-100/50;
}

.empty-hint {
  @apply text-center text-sm text-amber-100/40;
}

.poi-group {
  @apply flex flex-col gap-1;
}

.poi-header {
  @apply flex items-center justify-between text-xs;
}

.poi-name {
  @apply text-amber-100;
}

.poi-distance {
  @apply text-amber-100/50;
}

.poi-list {
  @apply flex flex-col gap-1;
}

.poi-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/45 p-2 cursor-pointer transition-colors hover:border-amber-200/30;
}

.poi-item--bound {
  @apply border-amber-200/30;
}

.poi-text {
  @apply flex flex-col gap-0.5;
}

.poi-title-row {
  @apply flex items-center gap-1;
}

.poi-code {
  @apply text-sm text-amber-50;
}

.poi-badge {
  @apply rounded-full border border-emerald-400/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300;
}

.poi-subcode {
  @apply text-xs text-amber-100/50;
}

.poi-actions {
  @apply flex items-center gap-1;
}

.poi-action {
  @apply inline-flex items-center whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.poi-action--bound {
  @apply border-amber-200/50 bg-amber-200/15 text-amber-50;
}

.poi-action-chevron {
  @apply ml-1 h-3 w-3;
}

.section {
  @apply flex flex-col gap-2;
}

.tradestation-options {
  @apply flex flex-wrap gap-1;
}

.tradestation-btn {
  @apply rounded border border-amber-300/20 bg-black/30 px-2 py-1 text-xs text-amber-100;
}

.idle-stations {
  @apply flex flex-col gap-1;
}

.idle-station-item {
  @apply flex items-center gap-2 rounded border border-amber-300/15 bg-black/30 p-2;
}

.idle-station-item--bound {
  @apply border-amber-300/30 bg-amber-200/5;
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

.station-tag {
  @apply mt-0.5 flex items-center gap-1 text-xs text-amber-100/60;
}

.tag-clear {
  @apply text-amber-100/40 hover:text-amber-50;
}

.station-handle {
  @apply flex flex-col gap-0.5 opacity-40;
}

.station-handle span {
  @apply block h-0.5 w-4 rounded-full bg-amber-100;
}

.existing-bindings {
  @apply flex flex-col gap-1;
}

.binding-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/30 p-2;
}

.binding-info {
  @apply flex flex-col;
}

.binding-name {
  @apply text-sm text-amber-100;
}

.binding-meta {
  @apply text-xs text-amber-100/50;
}

.missing-tag {
  @apply ml-1 text-red-300;
}

.binding-clear {
  @apply text-amber-100/40 hover:text-amber-50;
}

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

.bind-menu-item-name {
  @apply flex-1;
}

.bind-menu-item-unbind {
  @apply inline-flex h-5 w-5 items-center justify-center rounded text-amber-100/55 hover:text-amber-50;
}

.bind-menu-item-unbind svg {
  @apply h-3.5 w-3.5;
}

.bind-menu-item--import {
  @apply text-amber-200/80;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}
</style>