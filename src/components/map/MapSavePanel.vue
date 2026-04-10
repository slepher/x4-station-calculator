<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import MapSaveBreadcrumb from './MapSaveBreadcrumb.vue'
import MapSaveArchiveList from './MapSaveArchiveList.vue'
import MapSaveCategoryMenu from './MapSaveCategoryMenu.vue'
import MapSaveCoordList from './MapSaveCoordList.vue'
import MapBindingSectorGroup from './MapBindingSectorGroup.vue'
import MapBindingStation from './MapBindingStation.vue'
import SmartSaveDialog from '@/components/common/SmartSaveDialog.vue'
import type { SaveArchive, SavePoiCategory, SavePoiOverlayItem } from '@/types/saveArchive'
import type { StationPlan } from '@/types/x4'

type BindingStage = 'select-binding' | 'select-sector' | 'select-station'
type PanelLayer = 'list' | 'category' | 'coord' | 'binding-sector' | 'binding-station'

const props = defineProps<{
  open: boolean
  archive: SaveArchive | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-archive', payload: { guid: string; time: number } | null): void
  (e: 'active-category-change', category: SavePoiCategory | null): void
  (e: 'focus-poi', poi: SavePoiOverlayItem): void
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'context-change', payload: { stage: BindingStage; gameGuid: string | null; sectorGroupId: string | null }): void
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean; blueprintStation?: StationPlan }): void
  (e: 'drag-station-end'): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()
const empireStore = useEmpireStore()

const layer = ref<PanelLayer>('list')
const selectedCategory = ref<SavePoiCategory | null>(null)
const selectedBindingGameGuid = ref<string | null>(null)
const selectedSectorGroupId = ref<string | null>(null)
const smartSaveDialog = reactive({
  isOpen: false,
  pendingBindPayload: null as { guid: string; time: number | null } | null
})
interface BreadcrumbItem {
  key: string
  label: string
  clickable?: boolean
}

const bindingPlayerName = computed(() => {
  if (!selectedBindingGameGuid.value) return null
  return saveStore.archiveGroups.find((item) => item.guid === selectedBindingGameGuid.value)?.playerName || null
})

const bindingSectorName = computed(() => {
  if (!selectedSectorGroupId.value) return null
  return saveBindingStore.activeBinding?.groups.find((item) => item.id === selectedSectorGroupId.value)?.name || null
})
const isBindingLayer = computed(() => layer.value === 'binding-sector' || layer.value === 'binding-station')

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ key: 'root', label: t('map.save_breadcrumb_root') }]

  if (layer.value === 'category' && props.archive) {
    items.push({ key: 'archive', label: props.archive.meta.playerName, clickable: true })
  }

  if ((layer.value === 'binding-sector' || layer.value === 'binding-station') && bindingPlayerName.value) {
    items.push({
      key: 'binding',
      label: `${bindingPlayerName.value} ${t('map.binding_title')}`,
      clickable: layer.value === 'binding-station'
    })
  }

  if (selectedCategory.value && layer.value === 'coord') {
    items.push({
      key: 'category',
      label: getCategoryLabel(selectedCategory.value),
      clickable: true
    })
  }

  if (layer.value === 'binding-station' && bindingSectorName.value) {
    items.push({ key: 'sector', label: bindingSectorName.value })
  }

  return items
})

function getCategoryLabel(category: SavePoiCategory): string {
  const labels: Record<SavePoiCategory, string> = {
    playerStation: t('map.save_category_player_station'),
    npcStation: t('map.save_category_npc_station'),
    xenonStation: t('map.save_category_xenon_station'),
    khaakStation: t('map.save_category_khaak_station'),
    abandonedShip: t('map.save_category_abandoned_ship'),
    datavault: t('map.save_category_datavault'),
    erlkingVault: t('map.save_category_erlking_vault')
  }
  return labels[category]
}

function getLatestTime(gameGuid: string): number | null {
  const group = saveStore.archives.get(gameGuid)
  return group?.saves[0]?.meta.time ?? null
}

function resetToList() {
  layer.value = 'list'
  selectedCategory.value = null
  selectedBindingGameGuid.value = null
  selectedSectorGroupId.value = null
  emit('active-category-change', null)
}

function onBreadcrumbNavigate(key: string) {
  if (key === 'root') {
    resetToList()
  } else if (key === 'archive') {
    layer.value = 'category'
    selectedCategory.value = null
    emit('active-category-change', null)
  } else if (key === 'binding') {
    layer.value = 'binding-sector'
    selectedSectorGroupId.value = null
  }
}

async function onArchiveSelect(payload: { guid: string; time: number } | null) {
  if (payload) {
    await saveStore.selectArchive(payload.guid, payload.time)
  }
  emit('select-archive', payload)
}

async function onArchiveSelectGroup(payload: { guid: string }) {
  await saveStore.selectArchiveGroup(payload.guid)
}

async function onArchiveNavigate(payload: { guid: string; time: number | null }) {
  if (payload.time === null) {
    await saveStore.selectArchiveGroup(payload.guid)
  } else {
    await saveStore.selectArchive(payload.guid, payload.time)
    emit('select-archive', { guid: payload.guid, time: payload.time })
  }

  layer.value = 'category'
  selectedCategory.value = null
  emit('active-category-change', null)
}

async function onArchiveBind(payload: { guid: string; time: number | null }) {
    const result = empireStore.switchToBinding(payload.guid)
    if (result.needsConfirm) {
      smartSaveDialog.isOpen = true
      smartSaveDialog.pendingBindPayload = payload
      return
    }

    await proceedToBinding(payload)
  }

  async function proceedToBinding(payload: { guid: string; time: number | null }) {
    saveBindingStore.createOrOpenBinding(payload.guid, payload.time)

    const effectiveTime = payload.time ?? getLatestTime(payload.guid)
    if (payload.time === null) {
      await saveStore.selectArchiveGroup(payload.guid)
      if (effectiveTime !== null) {
        emit('select-archive', { guid: payload.guid, time: effectiveTime })
      }
    } else if (effectiveTime !== null) {
      await saveStore.selectArchive(payload.guid, effectiveTime)
      emit('select-archive', { guid: payload.guid, time: effectiveTime })
    }

    selectedBindingGameGuid.value = payload.guid
    selectedSectorGroupId.value = null
    layer.value = 'binding-sector'
  }

  function handleSmartSaveDialogClose() {
    smartSaveDialog.isOpen = false
    smartSaveDialog.pendingBindPayload = null
  }

  function handleSmartSaveDialogSubmitImport(payload: { choice: 'SAVE_AND_IMPORT' | 'DISCARD_AND_IMPORT' }) {
    if (payload.choice === 'SAVE_AND_IMPORT') {
      empireStore.saveEmpire()
    }

    const pending = smartSaveDialog.pendingBindPayload
    smartSaveDialog.isOpen = false
    smartSaveDialog.pendingBindPayload = null

    if (pending) {
      empireStore.confirmSwitchToBinding(pending.guid)
      proceedToBinding(pending)
    }
  }

function onCategorySelect(category: SavePoiCategory) {
  selectedCategory.value = category
  layer.value = 'coord'
  emit('active-category-change', category)
}

function onPoiFocus(poi: SavePoiOverlayItem) {
  emit('focus-poi', poi)
}

function onSelectBindingGroup(sectorGroupId: string) {
  selectedSectorGroupId.value = sectorGroupId
  layer.value = 'binding-station'
}

function onCancelBindingChanges() {
  saveBindingStore.discardChanges()

  if (layer.value !== 'binding-station' || !selectedSectorGroupId.value) return

  const sectorExists = Boolean(saveBindingStore.activeBinding?.groups.some((item) => item.id === selectedSectorGroupId.value))
  if (!sectorExists) {
    selectedSectorGroupId.value = null
    layer.value = 'binding-sector'
  }
}

function onSaveBindingChanges() {
  saveBindingStore.saveBinding()
}

function onClose() {
  emit('active-category-change', null)
  emit('close')
}

watch(() => props.open, (open) => {
  if (open) {
    resetToList()
    return
  }

  resetToList()
})

watch(() => props.archive, (archive) => {
  if (!archive && (layer.value === 'category' || layer.value === 'coord')) {
    resetToList()
  }
})

watch([layer, selectedBindingGameGuid, selectedSectorGroupId, () => props.open], () => {
  const stage: BindingStage = !props.open || (layer.value !== 'binding-sector' && layer.value !== 'binding-station')
    ? 'select-binding'
    : layer.value === 'binding-station'
      ? 'select-station'
      : 'select-sector'

  emit('context-change', {
    stage,
    gameGuid: props.open ? selectedBindingGameGuid.value : null,
    sectorGroupId: props.open ? selectedSectorGroupId.value : null
  })
}, { immediate: true })
</script>

<template>
  <aside v-show="open" class="map-save-panel" data-testid="map-save-panel">
    <div class="map-save-panel__header" :class="{ 'map-save-panel__header--binding': isBindingLayer }">
      <div v-if="isBindingLayer" class="map-save-panel__header-top">
        <MapSaveBreadcrumb :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
        <button
          class="map-save-panel__close"
          data-testid="map-save-panel-close"
          type="button"
          @click="onClose"
        >
          {{ t('map.binding_close') }}
        </button>
      </div>
      <MapSaveBreadcrumb v-else :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
      <button
        v-if="!isBindingLayer"
        class="map-save-panel__close"
        data-testid="map-save-panel-close"
        type="button"
        @click="onClose"
      >
        {{ t('map.binding_close') }}
      </button>
      <div v-if="isBindingLayer" class="map-save-panel__header-actions">
        <button
          class="map-save-panel__header-btn subtle"
          type="button"
          :disabled="!saveBindingStore.activeBinding || !saveBindingStore.isDirty"
          @click="onCancelBindingChanges"
        >
          {{ t('map.binding_cancel') }}
        </button>
        <button
          class="map-save-panel__header-btn"
          type="button"
          :disabled="!saveBindingStore.activeBinding || !saveBindingStore.isDirty"
          @click="onSaveBindingChanges"
        >
          {{ t('map.binding_save') }}
        </button>
      </div>
    </div>

    <div class="map-save-panel__body scrollbar-thin">
      <MapSaveArchiveList
        v-if="layer === 'list'"
        @select="onArchiveSelect"
        @select-group="onArchiveSelectGroup"
        @navigate="onArchiveNavigate"
        @bind="onArchiveBind"
      />

      <MapSaveCategoryMenu
        v-else-if="layer === 'category'"
        :archive="archive"
        @select-category="onCategorySelect"
      />

      <MapSaveCoordList
        v-else-if="layer === 'coord'"
        :archive="archive"
        :category="selectedCategory!"
        @focus-poi="onPoiFocus"
      />

      <MapBindingSectorGroup
        v-else-if="layer === 'binding-sector' && selectedBindingGameGuid"
        :game-guid="selectedBindingGameGuid"
        @select-group="onSelectBindingGroup"
        @focus-sector="emit('focus-sector', $event)"
        @fit-sectors="emit('fit-sectors', $event)"
      />

      <MapBindingStation
        v-else-if="layer === 'binding-station' && selectedBindingGameGuid && selectedSectorGroupId"
        :game-guid="selectedBindingGameGuid"
        :sector-group-id="selectedSectorGroupId"
        @focus-sector="emit('focus-sector', $event)"
        @fit-sectors="emit('fit-sectors', $event)"
        @drag-station-start="emit('drag-station-start', $event)"
        @drag-station-end="emit('drag-station-end')"
      />
    </div>

  </aside>

  <SmartSaveDialog
    :is-open="smartSaveDialog.isOpen"
    intent="NEW"
    mode="import"
    @close="handleSmartSaveDialogClose"
    @submit-import="handleSmartSaveDialogSubmitImport"
  />
</template>

<style scoped>
.map-save-panel {
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/60 px-0 py-3 text-amber-50;
  backdrop-filter: blur(8px);
}

.map-save-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-amber-300/15 px-3 pb-3;
}

.map-save-panel__header--binding {
  @apply flex-col items-stretch gap-2;
}

.map-save-panel__header-top {
  @apply flex min-w-0 items-center justify-between gap-3;
}

.map-save-panel__close {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-save-panel__header-actions {
  @apply flex shrink-0 items-center gap-2;
}

.map-save-panel__header--binding .map-save-panel__header-actions {
  @apply justify-end;
}

.map-save-panel__header-btn {
  @apply rounded border border-amber-300/30 bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:bg-amber-500/25 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-45;
}

.map-save-panel__header-btn.subtle {
  @apply bg-transparent;
}

.map-save-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto px-3;
  scrollbar-gutter: stable both-edges;
  scrollbar-color: rgba(251, 191, 36, 0.55) rgba(15, 23, 42, 0.25);
  scrollbar-width: thin;
}

.map-save-panel__body::-webkit-scrollbar {
  width: 6px;
}

.map-save-panel__body::-webkit-scrollbar-track {
  @apply rounded-full bg-slate-900/35;
}

.map-save-panel__body::-webkit-scrollbar-thumb {
  @apply rounded-full bg-amber-300/45;
}

.map-save-panel__body::-webkit-scrollbar-thumb:hover {
  @apply bg-amber-200/60;
}

</style>
