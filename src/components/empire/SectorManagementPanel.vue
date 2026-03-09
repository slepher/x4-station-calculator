<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import draggable from 'vuedraggable'

const empireStore = useEmpireStore()
const newSectorName = ref('')
const hoveredStationDropZone = ref<string | null>(null)
const draggingType = ref<'station' | null>(null)
const isDraggingSector = ref(false)

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

const unassignedStations = computed(() =>
  stations.value.filter((station) => !station.sectorId || !sectors.value.some((sector) => sector.id === station.sectorId))
)

function createSector() {
  empireStore.createSector(newSectorName.value.trim())
  newSectorName.value = ''
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
</script>

<template>
  <div class="sector-panel">
    <div class="sector-panel-header">
      <h3 class="sector-panel-title">{{ $t('sectorManagement.title') }}</h3>
      <div class="sector-create-row">
        <input
          v-model="newSectorName"
          class="sector-input"
          :placeholder="$t('sectorManagement.new_sector_placeholder')"
          @keyup.enter="createSector"
        />
        <button class="sector-create-btn" @click="createSector">{{ $t('sectorManagement.create') }}</button>
      </div>
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
      <div class="zone-title">{{ $t('sectorManagement.unassigned') }}</div>
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
            {{ station.name }}
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
        <div class="sector-card">
          <div class="sector-card-header">
            <div class="sector-handle-group">
              <button
                class="sector-drag-handle"
                :title="$t('sectorManagement.drag_sector')"
              >
                ⋮⋮
              </button>
            </div>
            <input
              :value="sector.name"
              class="sector-name-input"
              @change="empireStore.renameSector(sector.id, (($event.target as HTMLInputElement).value || '').trim())"
            />
            <div class="sector-actions">
              <button class="icon-btn danger" @click="empireStore.deleteSector(sector.id)">×</button>
            </div>
          </div>

          <div
            class="sector-stations"
            :class="{ 'drop-highlight': hoveredStationDropZone === sector.id }"
            @dragover="onStationZoneDragOver($event, sector.id)"
            @dragleave="onStationZoneDragLeave(sector.id)"
          >
            <div class="zone-title">{{ $t('sectorManagement.stations') }}</div>
            <draggable
              :model-value="stationsBySector.get(sector.id) || []"
              item-key="id"
              class="zone-list"
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
                  {{ station.name }}
                </div>
              </template>
            </draggable>
          </div>

        </div>
      </template>
    </draggable>
  </div>
</template>

<style scoped>
.sector-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl p-3 min-h-[400px] flex flex-col gap-3;
}
.sector-panel-header {
  @apply flex flex-col gap-2;
}
.sector-panel-title {
  @apply text-sm font-bold text-sky-300;
}
.sector-create-row {
  @apply flex gap-2;
}
.sector-input {
  @apply flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100;
}
.sector-create-btn {
  @apply px-2 py-1 text-xs rounded bg-sky-700 text-white hover:bg-sky-600;
}
.sector-unassigned, .sector-card {
  @apply bg-slate-800/40 border border-slate-700 rounded p-2;
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
  @apply flex items-center justify-between gap-2 mb-2;
}
.sector-handle-group {
  @apply flex items-center gap-1;
}
.sector-drag-handle {
  @apply text-slate-400 hover:text-sky-300 cursor-grab px-1 inline-flex items-center justify-center w-6 h-6;
}
.sector-drag-handle:active {
  @apply cursor-grabbing;
}
.sector-name-input {
  @apply bg-transparent border-b border-slate-600 text-sm text-slate-100 w-full outline-none;
}
.sector-actions {
  @apply flex items-center gap-1;
}
.icon-btn {
  @apply px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-200 disabled:opacity-40;
}
.icon-btn.danger {
  @apply bg-red-800 text-red-100;
}
.sector-stations {
  @apply border border-slate-700/70 rounded p-2 mt-2;
}
.drop-highlight {
  @apply border-sky-500 bg-sky-900/20;
}
.zone-title {
  @apply text-[10px] uppercase tracking-wider text-slate-400 mb-1;
}
.zone-list {
  @apply flex flex-wrap gap-1;
}
.station-chip {
  @apply inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700/70 text-slate-100;
}
.station-chip {
  @apply cursor-grab;
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
</style>
