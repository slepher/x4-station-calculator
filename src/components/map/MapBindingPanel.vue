<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
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
  (e: 'drag-station-start', payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard'; coverageSectorMacros: string[] }): void
  (e: 'drag-station-end'): void
}>()

const { t } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()

const stage = ref<PanelStage>('select-binding')
const selectedGameGuid = ref<string | null>(null)
const selectedSectorGroupId = ref<string | null>(null)

function onSelectArchive(payload: { gameGuid: string; time: number | null }) {
  const existingBinding = empireStore.activeEmpire?.saveBindings?.find(
    (p) => p.gameGuid === payload.gameGuid
  )

  if (!existingBinding) {
    empireStore.createBinding(payload.gameGuid)
  }

  if (payload.time !== null) {
    empireStore.setSelectedArchiveTime(payload.gameGuid, payload.time)
    saveStore.selectArchive(payload.gameGuid, payload.time)
  } else {
    const group = saveStore.archives.get(payload.gameGuid)
    if (group && group.saves[0]) {
      saveStore.selectArchive(payload.gameGuid, group.saves[0].meta.time)
    }
  }

  selectedGameGuid.value = payload.gameGuid
  stage.value = 'select-sector'
}

function onSelectGroup(sectorGroupId: string) {
  selectedSectorGroupId.value = sectorGroupId
  stage.value = 'select-station'
}

function goBack() {
  if (stage.value === 'select-station') {
    stage.value = 'select-sector'
    selectedSectorGroupId.value = null
  } else if (stage.value === 'select-sector') {
    stage.value = 'select-binding'
    selectedGameGuid.value = null
  }
}

function close() {
  emit('close')
}

watch(() => props.open, (open) => {
  if (!open) {
    stage.value = 'select-binding'
    selectedGameGuid.value = null
    selectedSectorGroupId.value = null
  }
})
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
             stage === 'select-sector' ? t('map.binding_sector_group') :
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
      <!-- Stage 1: Select Archive -->
      <MapBindingSelectArchive
        v-if="stage === 'select-binding'"
        @select="onSelectArchive"
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
  @apply rounded-lg px-2 py-1 text-lg text-amber-100/60 transition-colors hover:bg-amber-200/10 hover:text-amber-50;
}

.map-binding-panel__title {
  @apply text-sm font-semibold text-amber-50;
}

.map-binding-panel__close {
  @apply rounded-lg border border-amber-300/20 px-2 py-1 text-xs text-amber-100/60 transition-colors hover:border-amber-200/40 hover:text-amber-50;
}

.map-binding-panel__body {
  @apply flex-1 overflow-y-auto;
}

.map-binding-panel__footer {
  @apply mt-3 shrink-0 border-t border-amber-300/15 pt-3;
}

.map-binding-panel__hint {
  @apply text-xs text-amber-100/40;
}
</style>