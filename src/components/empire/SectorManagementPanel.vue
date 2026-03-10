<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import draggable from 'vuedraggable'

const empireStore = useEmpireStore()
const { t } = useI18n()
const newSectorName = ref('')
const newUnassignedStationName = ref('')
const hoveredStationDropZone = ref<string | null>(null)
const hoveredLinkDropZone = ref<string | null>(null)
const draggingType = ref<'station' | 'link' | null>(null)
const isDraggingSector = ref(false)
const linkDragSourceSectorId = ref<string | null>(null)
const linkFeedback = ref('')
const linkZoneEnterCount = ref<Record<string, number>>({})
const showDeleteConfirm = ref(false)
const stationToDelete = ref<string | null>(null)

const sectors = computed(() => empireStore.sectors)
const stations = computed(() => empireStore.activeEmpire?.stations || [])

const stationsBySector = computed(() => {
  const map = new Map<string, typeof stations.value>()
  sectors.value.forEach((sector) => map.set(sector.id, []))
  stations.value.forEach((station) => {
    if (!station.sectorId || !map.has(station.sectorId)) return
    map.get(station.sectorId)!.push(station)
  })
  return map
})

const linkedSectorIdsBySector = computed(() => {
  const map = new Map<string, string[]>()
  sectors.value.forEach((sector) => map.set(sector.id, empireStore.getLinkedSectors(sector.id)))
  return map
})

const sectorNameMap = computed(() => {
  const map = new Map<string, string>()
  sectors.value.forEach((sector) => map.set(sector.id, sector.name))
  return map
})
const sectorOrderMap = computed(() => {
  const map = new Map<string, number>()
  sectors.value.forEach((sector, index) => map.set(sector.id, index))
  return map
})

const linkDisplayBySector = computed(() => {
  const map = new Map<string, Array<{ id: string; preview: boolean }>>()
  sectors.value.forEach((sector) => {
    const linked = [...(linkedSectorIdsBySector.value.get(sector.id) || [])]
    const shouldShowPreview =
      draggingType.value === 'link' &&
      hoveredLinkDropZone.value === sector.id &&
      !!linkDragSourceSectorId.value &&
      canDropLink(sector.id)

    if (shouldShowPreview && linkDragSourceSectorId.value && !linked.includes(linkDragSourceSectorId.value)) {
      linked.push(linkDragSourceSectorId.value)
    }

    linked.sort((a, b) => {
      const aOrder = sectorOrderMap.value.get(a) ?? Number.MAX_SAFE_INTEGER
      const bOrder = sectorOrderMap.value.get(b) ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.localeCompare(b)
    })

    const list = linked.map((id) => ({
      id,
      preview: !!shouldShowPreview && id === linkDragSourceSectorId.value
    }))

    map.set(sector.id, list)
  })
  return map
})

const unassignedStations = computed(() =>
  stations.value.filter((station) => !station.sectorId || !sectors.value.some((sector) => sector.id === station.sectorId))
)

function resolveUniqueStationName(baseName: string): string {
  const normalized = baseName.trim()
  if (!normalized) return normalized
  const existing = new Set(
    stations.value
      .map((station) => (station.name || '').trim())
      .filter((name) => name.length > 0)
  )
  if (!existing.has(normalized)) return normalized

  let index = 2
  while (existing.has(`${normalized} ${index}`)) {
    index += 1
  }
  return `${normalized} ${index}`
}

function resolveUniqueSectorName(baseName: string): string {
  const normalized = baseName.trim()
  if (!normalized) return normalized
  const existing = new Set(
    sectors.value
      .map((sector) => (sector.name || '').trim())
      .filter((name) => name.length > 0)
  )
  if (!existing.has(normalized)) return normalized

  let index = 2
  while (existing.has(`${normalized} ${index}`)) {
    index += 1
  }
  return `${normalized} ${index}`
}

function createSector() {
  const requestedName = newSectorName.value.trim()
  const nextName = resolveUniqueSectorName(requestedName)
  empireStore.createSector(nextName)
}

function createUnassignedStation() {
  const requestedName = newUnassignedStationName.value.trim() || t('sector.new_station_name')
  const nextName = resolveUniqueStationName(requestedName)
  empireStore.createStation(nextName, 'industrial', false)
}

function hasStationModules(stationId: string): boolean {
  const station = stations.value.find((item) => item.id === stationId)
  if (!station) return false
  const modules = Array.isArray(station.modules) ? station.modules : []
  return modules.some((item) => Number(item.count) > 0)
}

function requestDeleteStation(stationId: string) {
  if (!stationId) return
  if (hasStationModules(stationId)) {
    stationToDelete.value = stationId
    showDeleteConfirm.value = true
    return
  }
  empireStore.deleteStation(stationId)
}

function confirmDeleteStation() {
  if (!stationToDelete.value) return
  empireStore.deleteStation(stationToDelete.value)
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

function cancelDeleteStation() {
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

const applyBucketStations = (sectorId: string | null, nextList: Array<{ id: string }>) => {
  nextList.forEach((item) => {
    empireStore.moveStationToSector(item.id, sectorId)
  })
  empireStore.setSectorStationOrder(sectorId, nextList.map((item) => item.id))
}

const applySectorOrder = (nextList: Array<{ id: string }>) => {
  empireStore.reorderSectors(nextList.map((item) => item.id))
}

function moveToUnassigned(stationId: string) {
  empireStore.moveStationToSector(stationId, null)
}

const onStationListStart = () => {
  draggingType.value = 'station'
}

const onStationListEnd = () => {
  draggingType.value = null
  hoveredStationDropZone.value = null
}

function onStationZoneDragOver(event: DragEvent, zoneId: string) {
  if (draggingType.value !== 'station') return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  hoveredStationDropZone.value = zoneId
}

function onStationZoneDragLeave(zoneId: string) {
  if (hoveredStationDropZone.value === zoneId) {
    hoveredStationDropZone.value = null
  }
}

function onSectorListStart(event: { originalEvent?: DragEvent }) {
  isDraggingSector.value = true
  const dt = event.originalEvent?.dataTransfer
  if (dt) dt.effectAllowed = 'move'
}

function onSectorListEnd() {
  isDraggingSector.value = false
}

function onLinkDragStart(event: DragEvent, sourceSectorId: string) {
  draggingType.value = 'link'
  linkDragSourceSectorId.value = sourceSectorId
  const dt = event.dataTransfer
  if (dt) {
    dt.effectAllowed = 'link'
    dt.setData('text/plain', sourceSectorId)
  }
  linkFeedback.value = ''
}

function onLinkDragEnd() {
  draggingType.value = null
  hoveredLinkDropZone.value = null
  linkDragSourceSectorId.value = null
  linkZoneEnterCount.value = {}
}

function onLinkZoneDragEnter(event: DragEvent, targetSectorId: string) {
  if (draggingType.value !== 'link' || !linkDragSourceSectorId.value) return
  if (!canDropLink(targetSectorId)) return
  event.preventDefault()
  linkZoneEnterCount.value[targetSectorId] = (linkZoneEnterCount.value[targetSectorId] || 0) + 1
  hoveredLinkDropZone.value = targetSectorId
}

function onLinkZoneDragOver(event: DragEvent, targetSectorId: string) {
  if (draggingType.value !== 'link' || !linkDragSourceSectorId.value) return
  if (!canDropLink(targetSectorId)) {
    if (hoveredLinkDropZone.value === targetSectorId) hoveredLinkDropZone.value = null
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'link'
  hoveredLinkDropZone.value = targetSectorId
}

function onLinkZoneDragLeave(zoneId: string) {
  const next = (linkZoneEnterCount.value[zoneId] || 1) - 1
  linkZoneEnterCount.value[zoneId] = Math.max(0, next)
  if (next <= 0 && hoveredLinkDropZone.value === zoneId) {
    hoveredLinkDropZone.value = null
  }
}

function onLinkZoneDrop(event: DragEvent, targetSectorId: string) {
  if (draggingType.value !== 'link') return
  event.preventDefault()
  const source = linkDragSourceSectorId.value || event.dataTransfer?.getData('text/plain') || ''
  const result = empireStore.createSectorLink(source, targetSectorId)
  if (result.ok) {
    linkFeedback.value = ''
  } else if (result.reason === 'self-link') {
    linkFeedback.value = t('sectorManagement.link_self_blocked')
  } else if (result.reason === 'duplicate-link') {
    linkFeedback.value = t('sectorManagement.link_duplicate_blocked')
  } else {
    linkFeedback.value = t('sectorManagement.link_invalid_target')
  }
  linkZoneEnterCount.value[targetSectorId] = 0
  onLinkDragEnd()
}

function removeLink(a: string, b: string) {
  empireStore.removeSectorLink(a, b)
}

function canDropLink(targetSectorId: string) {
  const sourceSectorId = linkDragSourceSectorId.value
  if (!sourceSectorId) return false
  if (sourceSectorId === targetSectorId) return false
  const linked = linkedSectorIdsBySector.value.get(targetSectorId) || []
  return !linked.includes(sourceSectorId)
}
</script>

<template>
  <div
    class="sector-panel"
    :class="{
      'dragging-station-mode': draggingType === 'station',
      'dragging-link-mode': draggingType === 'link',
      'dragging-sector-mode': isDraggingSector
    }"
  >
    <div class="sector-panel-header">
      <h3 class="sector-panel-title">{{ $t('sectorManagement.title') }}</h3>
      <input
        v-model="newSectorName"
        class="sector-input"
        :placeholder="$t('sectorManagement.new_sector_placeholder')"
        @keyup.enter="createSector"
      />
      <button class="sector-create-btn" @click="createSector" aria-label="create-sector">+</button>
    </div>

    <div
      class="sector-unassigned"
      :class="{
        'drop-highlight': hoveredStationDropZone === '__unassigned__',
        'drag-blocked': isDraggingSector
      }"
      @dragover="onStationZoneDragOver($event, '__unassigned__')"
      @dragleave="onStationZoneDragLeave('__unassigned__')"
    >
      <div class="unassigned-header-row">
        <div class="zone-title zone-title-inline">{{ $t('sectorManagement.unassigned') }}</div>
        <input
          v-model="newUnassignedStationName"
          class="unassigned-station-input"
          :placeholder="$t('sector.new_station_name')"
          @keyup.enter="createUnassignedStation"
        />
        <button
          class="sector-create-btn unassigned-create-btn"
          aria-label="create-unassigned-station"
          @click="createUnassignedStation"
        >+</button>
      </div>
      <draggable
        :model-value="unassignedStations"
        item-key="id"
        class="zone-list"
        :group="{ name: 'sector-station-list', pull: true, put: true }"
        ghost-class="station-ghost"
        chosen-class="station-chosen"
        drag-class="station-dragging"
        :animation="160"
        @start="onStationListStart"
        @end="onStationListEnd"
        @update:model-value="applyBucketStations(null, $event)"
      >
        <template #item="{ element: station }">
          <div class="station-chip">
            <span>{{ station.name }}</span>
            <button
              type="button"
              class="icon-btn subtle-delete"
              :title="$t('sector.delete_station')"
              @mousedown.stop
              @click.stop="requestDeleteStation(station.id)"
            >×</button>
          </div>
        </template>
      </draggable>
    </div>

    <draggable
      :model-value="sectors"
      item-key="id"
      class="sector-list"
      :class="{ 'sector-list-dragging': isDraggingSector }"
      :sort="true"
      handle=".sector-drag-handle"
      ghost-class="sector-ghost"
      chosen-class="sector-chosen"
      drag-class="sector-dragging"
      :animation="160"
      @start="onSectorListStart"
      @end="onSectorListEnd"
      @update:model-value="applySectorOrder($event)"
    >
      <template #item="{ element: sector }">
        <div
          class="sector-card"
          :class="{ 'link-drop-active': draggingType === 'link' && hoveredLinkDropZone === sector.id }"
        >
          <div class="sector-card-header">
            <div class="sector-handle-group">
              <button
                class="sector-tool-btn sector-drag-handle"
                :title="$t('sectorManagement.drag_sector')"
              >
                <svg viewBox="0 0 24 24" class="header-icon" aria-hidden="true">
                  <circle cx="8" cy="6" r="1.5" />
                  <circle cx="8" cy="12" r="1.5" />
                  <circle cx="8" cy="18" r="1.5" />
                  <circle cx="16" cy="6" r="1.5" />
                  <circle cx="16" cy="12" r="1.5" />
                  <circle cx="16" cy="18" r="1.5" />
                </svg>
              </button>
              <button
                class="sector-tool-btn"
                draggable="true"
                :title="$t('sectorManagement.drag_link')"
                @dragstart="onLinkDragStart($event, sector.id)"
                @dragend="onLinkDragEnd"
              >
                <svg viewBox="0 0 24 24" class="header-icon" aria-hidden="true">
                  <path d="M10.5 13.5l3-3" />
                  <path d="M7.5 16.5l-2.2 2.2a3 3 0 0 1-4.3-4.3L3.2 12" />
                  <path d="M16.5 7.5l2.2-2.2a3 3 0 0 1 4.3 4.3L20.8 12" />
                </svg>
              </button>
            </div>
            <input
              :value="sector.name"
              class="sector-name-input"
              @change="empireStore.renameSector(sector.id, (($event.target as HTMLInputElement).value || '').trim())"
            />
            <div class="sector-actions">
              <button class="icon-btn subtle-delete" @click="empireStore.deleteSector(sector.id)">×</button>
            </div>
          </div>

          <div
            class="sector-stations"
            :class="{ 'drop-highlight': hoveredStationDropZone === sector.id }"
            @dragover="onStationZoneDragOver($event, sector.id)"
            @dragleave="onStationZoneDragLeave(sector.id)"
          >
            <div class="zone-row">
              <div class="zone-title zone-title-inline">{{ $t('sectorManagement.stations') }}</div>
              <draggable
                :model-value="stationsBySector.get(sector.id) || []"
                item-key="id"
                class="zone-list zone-list-inline"
                :group="{ name: 'sector-station-list', pull: true, put: true }"
                ghost-class="station-ghost"
                chosen-class="station-chosen"
                drag-class="station-dragging"
                :animation="160"
                @start="onStationListStart"
                @end="onStationListEnd"
                @update:model-value="applyBucketStations(sector.id, $event)"
              >
                <template #item="{ element: station }">
                  <div class="station-chip">
                    <span>{{ station.name }}</span>
                    <button
                      type="button"
                      class="icon-btn subtle-delete"
                      :title="$t('sectorManagement.unassigned')"
                      @mousedown.stop
                      @click.stop="moveToUnassigned(station.id)"
                    >×</button>
                  </div>
                </template>
              </draggable>
            </div>
          </div>

          <div
            class="sector-links"
            :class="{ 'drop-highlight': hoveredLinkDropZone === sector.id }"
            @dragenter="onLinkZoneDragEnter($event, sector.id)"
            @dragover="onLinkZoneDragOver($event, sector.id)"
            @dragleave="onLinkZoneDragLeave(sector.id)"
            @drop="onLinkZoneDrop($event, sector.id)"
          >
            <div class="zone-row">
              <div class="zone-title zone-title-inline">{{ $t('sectorManagement.links') }}</div>
              <div class="link-list link-list-inline">
                <div
                  v-for="item in (linkDisplayBySector.get(sector.id) || [])"
                  :key="`${sector.id}-${item.id}-${item.preview ? 'preview' : 'real'}`"
                  class="link-chip"
                  :class="{ 'link-chip-preview': item.preview }"
                >
                  <span v-if="item.preview" class="link-drop-dot" />
                  <span>{{ sectorNameMap.get(item.id) || item.id }}</span>
                  <button
                    v-if="!item.preview"
                    class="icon-btn subtle-delete"
                    :title="$t('sectorManagement.remove_link')"
                    @click="removeLink(sector.id, item.id)"
                  >×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </draggable>

    <div v-if="linkFeedback" class="link-feedback">{{ linkFeedback }}</div>

    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="modal-backdrop" @click="cancelDeleteStation">
        <div class="modal-card" @click.stop>
          <div class="modal-header">
            <span class="text-amber-400 text-lg">⚠️</span>
            <h3>{{ t('sector.confirm_delete') }}</h3>
          </div>
          <p class="text-slate-400 text-sm mb-6 ml-1">{{ t('sector.delete_warning') }}</p>
          <div class="flex justify-end gap-3">
            <button class="btn-cancel" @click="cancelDeleteStation">{{ t('ui.cancel') }}</button>
            <button class="btn-danger" @click="confirmDeleteStation">{{ t('ui.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sector-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl p-3 min-h-[400px] flex flex-col gap-3;
}
.sector-panel.dragging-station-mode .sector-links {
  display: none;
}
.sector-panel.dragging-link-mode .sector-stations {
  display: none;
}
.sector-panel.dragging-sector-mode .sector-stations,
.sector-panel.dragging-sector-mode .sector-links {
  display: none;
}
.sector-panel-header {
  @apply flex items-center gap-2 border border-slate-700 rounded p-2;
}
.sector-panel-title {
  @apply text-sm font-bold text-sky-300 shrink-0;
}
.sector-input {
  @apply h-5 w-28 sm:w-32 shrink-0 bg-transparent border-0 border-b border-slate-600 rounded-none px-1 text-sm leading-5 text-slate-100 outline-none;
}
.sector-create-btn {
  @apply w-5 h-5 rounded bg-sky-700 text-white hover:bg-sky-600 inline-flex items-center justify-center text-sm leading-5 shrink-0 ml-auto;
}
.sector-unassigned, .sector-card {
  @apply bg-slate-800/40 border border-slate-700 rounded p-2;
}
.unassigned-header-row {
  @apply flex items-center gap-2 mb-2;
}
.unassigned-station-input {
  @apply h-5 w-28 sm:w-32 shrink-0 bg-transparent border-0 border-b border-slate-600 rounded-none px-1 text-xs leading-5 text-slate-100 outline-none;
}
.unassigned-create-btn {
  @apply text-xs;
}
.drag-blocked {
  @apply pointer-events-none;
}
.sector-list {
  @apply flex flex-col gap-2 overflow-y-auto;
}
.sector-list.sector-list-dragging {
  @apply cursor-grabbing;
}
.sector-card-header {
  @apply flex items-center gap-2 mb-2;
}
.sector-handle-group {
  @apply flex items-center gap-1;
}
.sector-tool-btn {
  @apply text-slate-400 hover:text-sky-300 cursor-pointer px-1 inline-flex items-center justify-center w-6 h-6 bg-transparent;
}
.sector-tool-btn:active {
  @apply cursor-grabbing;
}
.header-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sector-name-input {
  @apply h-5 w-28 sm:w-32 shrink-0 bg-transparent border-0 border-b border-slate-600 rounded-none px-1 text-sm leading-5 text-slate-100 outline-none;
}
.sector-actions {
  @apply flex items-center gap-1 ml-auto;
}
.icon-btn {
  @apply inline-flex items-center justify-center rounded text-[10px] leading-none disabled:opacity-40;
  width: 0.75rem;
  height: 0.75rem;
}
.icon-btn.subtle-delete {
  @apply bg-slate-700/90 text-blue-200 border border-blue-400/25 hover:bg-slate-600/90;
}
.sector-stations {
  @apply border border-slate-700/70 rounded p-2 mt-2;
}
.sector-links {
  @apply border border-slate-700/70 rounded p-2 mt-2;
}
.sector-card.link-drop-active {
  @apply border-emerald-500/70 shadow-lg shadow-emerald-900/30;
}
.drop-highlight {
  @apply border-sky-500 bg-sky-900/20;
}
.zone-title {
  @apply text-[10px] uppercase tracking-wider text-slate-400 mb-1;
}
.zone-row {
  @apply flex items-start gap-2;
}
.zone-title-inline {
  @apply mb-0 mt-0.5 shrink-0;
  min-width: 3.25rem;
}
.zone-list {
  @apply flex flex-wrap gap-1;
  min-height: 1.5rem;
  align-content: flex-start;
}
.zone-list-inline,
.link-list-inline {
  @apply flex-1;
}
.station-chip {
  @apply inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700/70 text-slate-100;
}
.station-chip {
  @apply cursor-grab;
}
.link-drop-hint {
  @apply text-[10px] text-slate-500 mb-1;
}
.link-empty {
  @apply text-xs text-slate-500;
}
.link-drop-point {
  @apply inline-flex items-center gap-2 text-xs text-emerald-200 bg-emerald-900/25 border border-emerald-500/50 rounded px-2 py-1 mb-2;
}
.link-drop-dot {
  @apply inline-block w-2 h-2 rounded-full bg-emerald-300;
  box-shadow: 0 0 0 0 rgba(110, 231, 183, 0.6);
  animation: link-drop-pulse 1.2s ease-out infinite;
}
.link-list {
  @apply flex flex-wrap gap-1;
  min-height: 1.5rem;
  align-content: flex-start;
}
.link-chip {
  @apply inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700 text-slate-100 text-xs;
}
.link-chip-preview {
  @apply border border-emerald-400/70 bg-emerald-900/35 text-emerald-100;
}
.link-feedback {
  @apply text-xs text-emerald-300;
}

.modal-backdrop {
  @apply fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4;
}

.modal-card {
  @apply bg-slate-800 border border-slate-600 rounded-lg p-5 w-full max-w-sm shadow-2xl;
}

.modal-header {
  @apply flex items-center gap-3 mb-3;
}

.modal-header h3 {
  @apply text-lg font-semibold text-slate-100;
}

.btn-cancel {
  @apply px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors;
}

.btn-danger {
  @apply px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors;
}
.station-ghost {
  @apply border border-dashed border-sky-400 bg-sky-900/20 text-sky-100;
}
.station-chosen {
  @apply shadow-lg shadow-sky-900/30;
}
.station-dragging {
  @apply opacity-90;
}
.sector-ghost {
  @apply border border-dashed border-amber-400 bg-amber-900/20 opacity-80;
}
.sector-chosen {
  @apply opacity-35;
}
.sector-dragging {
  @apply opacity-95;
}

@keyframes link-drop-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(110, 231, 183, 0.6);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(110, 231, 183, 0);
  }
}
</style>
