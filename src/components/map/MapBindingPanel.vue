<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import MapSaveBreadcrumb from './MapSaveBreadcrumb.vue'
import MapBindingSelectArchive from './MapBindingSelectArchive.vue'
import MapBindingSectorGroup from './MapBindingSectorGroup.vue'
import MapBindingStation from './MapBindingStation.vue'

type PanelStage = 'select-binding' | 'select-sector' | 'select-station'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'context-change', payload: { stage: PanelStage; gameGuid: string | null; sectorGroupId: string | null }): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean }): void
  (e: 'drag-station-end'): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()

const stage = ref<PanelStage>('select-binding')
const selectedGameGuid = ref<string | null>(null)
const selectedSectorGroupId = ref<string | null>(null)
const previewGameGuid = ref<string | null>(null)
const previewTime = ref<number | null>(null)
const initialArchiveSelection = ref<{ guid: string; time: number } | null>(null)

interface BreadcrumbItem {
  key: string
  label: string
  clickable?: boolean
}

const empireSectorName = computed(() => {
  if (!selectedSectorGroupId.value) return null
  const sector = saveBindingStore.activeBinding?.groups.find(s => s.id === selectedSectorGroupId.value)
  return sector?.name || null
})

const selectedPlayerName = computed(() => {
  if (!selectedGameGuid.value) return null
  const group = (saveStore.archiveGroups || []).find((item) => item.guid === selectedGameGuid.value)
  return group?.playerName || null
})

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    { key: 'root', label: t('map.binding_title') }
  ]

  if (stage.value !== 'select-binding' && selectedPlayerName.value) {
    items.push({
      key: 'player',
      label: selectedPlayerName.value,
      clickable: stage.value === 'select-station'
    })
  }

  if (stage.value === 'select-station' && empireSectorName.value) {
    items.push({
      key: 'sector',
      label: empireSectorName.value,
      clickable: false
    })
  }

  return items
})

function getLatestTime(gameGuid: string): number | null {
  const group = saveStore.archives.get(gameGuid)
  return group?.saves[0]?.meta.time ?? null
}

async function restoreArchiveAfterPreviewExit() {
  const binding = saveBindingStore.activeBinding || null
  if (binding?.gameGuid) {
    const time = binding.selectedArchiveTime ?? getLatestTime(binding.gameGuid)
    if (time !== null) {
      await saveStore.selectArchive(binding.gameGuid, time)
      return
    }
  }

  const initial = initialArchiveSelection.value
  if (initial) {
    await saveStore.selectArchive(initial.guid, initial.time)
  }
}

async function onPreviewArchive(payload: { gameGuid: string; time: number }) {
  previewGameGuid.value = payload.gameGuid
  previewTime.value = payload.time
  await saveStore.selectArchive(payload.gameGuid, payload.time)
}

async function onBindArchive(payload: { gameGuid: string; time: number | null }) {
  saveBindingStore.createOrOpenBinding(payload.gameGuid, payload.time)

  if (payload.time !== null) {
    await saveStore.selectArchive(payload.gameGuid, payload.time)
  } else {
    const latestTime = getLatestTime(payload.gameGuid)
    if (latestTime !== null) {
      await saveStore.selectArchive(payload.gameGuid, latestTime)
    }
  }

  previewGameGuid.value = null
  previewTime.value = null
  selectedGameGuid.value = payload.gameGuid
  stage.value = 'select-sector'
}

function onSelectGroup(sectorGroupId: string) {
  selectedSectorGroupId.value = sectorGroupId
  stage.value = 'select-station'
}

function close() {
  emit('close')
}

async function onBreadcrumbNavigate(key: string) {
  if (key === 'root') {
    stage.value = 'select-binding'
    selectedGameGuid.value = null
    selectedSectorGroupId.value = null
    await restoreArchiveAfterPreviewExit()
  } else if (key === 'player') {
    stage.value = 'select-sector'
    selectedSectorGroupId.value = null
  }
}

watch(() => props.open, (open) => {
  if (open) {
    initialArchiveSelection.value = saveStore.selectedArchive
      ? { guid: saveStore.selectedArchive.meta.guid, time: saveStore.selectedArchive.meta.time }
      : null
  }
  if (!open) {
    void restoreArchiveAfterPreviewExit()
    stage.value = 'select-binding'
    selectedGameGuid.value = null
    selectedSectorGroupId.value = null
    previewGameGuid.value = null
    previewTime.value = null
  }
})

watch([stage, selectedGameGuid, selectedSectorGroupId, () => props.open], () => {
  emit('context-change', {
    stage: props.open ? stage.value : 'select-binding',
    gameGuid: props.open ? selectedGameGuid.value : null,
    sectorGroupId: props.open ? selectedSectorGroupId.value : null
  })
}, { immediate: true })
</script>

<template>
  <aside v-show="open" class="map-binding-panel" data-testid="map-binding-panel">
    <div class="map-binding-panel__header">
      <MapSaveBreadcrumb :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
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
      <!-- Stage 1: Select Archive -->
      <MapBindingSelectArchive
        v-if="stage === 'select-binding'"
        :preview-game-guid="previewGameGuid"
        :preview-time="previewTime"
        @preview="onPreviewArchive"
        @bind="onBindArchive"
      />

      <!-- Stage 2: Sector Group Management -->
      <MapBindingSectorGroup
        v-else-if="stage === 'select-sector' && selectedGameGuid"
        :game-guid="selectedGameGuid"
        @select-group="onSelectGroup"
        @focus-sector="emit('focus-sector', $event)"
        @fit-sectors="emit('fit-sectors', $event)"
      />

      <!-- Stage 3: Bind Stations -->
      <MapBindingStation
        v-else-if="stage === 'select-station' && selectedGameGuid && selectedSectorGroupId"
        :game-guid="selectedGameGuid"
        :sector-group-id="selectedSectorGroupId"
        @focus-sector="emit('focus-sector', $event)"
        @fit-sectors="emit('fit-sectors', $event)"
        @drag-station-start="emit('drag-station-start', $event)"
        @drag-station-end="emit('drag-station-end')"
      />
    </div>

    <div v-if="stage === 'select-binding'" class="map-binding-panel__footer">
      <div class="map-binding-panel__hint">
        {{ saveBindingStore.isDirty ? t('map.binding_unsaved') : t('map.binding_saved') }}
      </div>
      <div class="map-binding-panel__footer-actions">
        <button
          type="button"
          class="map-binding-panel__footer-btn"
          :disabled="!saveBindingStore.activeBinding || !saveBindingStore.isDirty"
          @click="saveBindingStore.saveBinding()"
        >
          {{ t('map.binding_save') }}
        </button>
        <button
          type="button"
          class="map-binding-panel__footer-btn subtle"
          :disabled="!saveBindingStore.activeBinding || !saveBindingStore.isDirty"
          @click="saveBindingStore.discardChanges()"
        >
          {{ t('map.binding_discard') }}
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.map-binding-panel {
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/60 py-3 px-0 text-amber-50;
  backdrop-filter: blur(8px);
}

.map-binding-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-amber-300/15 px-3 pb-3;
}

.map-binding-panel__close {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-binding-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto px-3;
  scrollbar-gutter: stable both-edges;
  scrollbar-color: rgba(251, 191, 36, 0.55) rgba(15, 23, 42, 0.25);
  scrollbar-width: thin;
}

.map-binding-panel__body::-webkit-scrollbar {
  width: 6px;
}

.map-binding-panel__body::-webkit-scrollbar-track {
  @apply rounded-full bg-slate-900/35;
}

.map-binding-panel__body::-webkit-scrollbar-thumb {
  @apply rounded-full bg-amber-300/45;
}

.map-binding-panel__body::-webkit-scrollbar-thumb:hover {
  @apply bg-amber-200/60;
}

.map-binding-panel__footer {
  @apply px-3 pt-2 text-xs text-amber-100/60;
  border-top: 1px solid rgba(251, 191, 36, 0.15);
  margin-top: auto;
}

.map-binding-panel__footer-actions {
  @apply mt-2 flex items-center gap-2;
}

.map-binding-panel__footer-btn {
  @apply rounded border border-amber-300/30 bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-45;
}

.map-binding-panel__footer-btn.subtle {
  @apply bg-transparent;
}
</style>
