<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import factoryIconUrl from '@/components/icons/factory.svg'
import shipyardIconUrl from '@/components/icons/shipyard.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'

type StationPanelFilter = 'all' | 'station' | 'sector' | 'unplaced' | 'placed'
type PlacementIcon = 'factory' | 'shipyard' | 'tradestation'

export type MapStationPanelItem = {
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: PlacementIcon
  groupId: string
  groupName: string
  targetSectorName?: string
  isAddressInactive?: boolean
  location?: {
    cluster_id: string
    sector_id: string
    pos: {
      x: number
      z: number
    }
  }
}

const props = defineProps<{
  items: MapStationPanelItem[]
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'drag-start', item: MapStationPanelItem): void
  (e: 'drag-end'): void
  (e: 'clear-location', item: MapStationPanelItem): void
  (e: 'focus-item', item: MapStationPanelItem): void
}>()

const { t } = useI18n()

const searchQuery = ref('')
const activeFilter = ref<StationPanelFilter>('all')

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

const filteredItems = computed(() => {
  return props.items.filter((item) => {
    const matchesQuery = !normalizedQuery.value || item.name.toLowerCase().includes(normalizedQuery.value)
    if (!matchesQuery) return false
    if (activeFilter.value === 'station') return item.kind === 'station'
    if (activeFilter.value === 'sector') return item.kind === 'sector'
    if (activeFilter.value === 'placed') return Boolean(item.location)
    if (activeFilter.value === 'unplaced') return !item.location
    return true
  })
})
const groupedItems = computed(() => {
  const groups = new Map<string, { id: string; name: string; items: MapStationPanelItem[] }>()
  filteredItems.value.forEach((item) => {
    const existing = groups.get(item.groupId)
    if (existing) {
      existing.items.push(item)
      return
    }
    groups.set(item.groupId, {
      id: item.groupId,
      name: item.groupName,
      items: [item]
    })
  })
  return Array.from(groups.values())
})

const filterTabs = computed<Array<{ id: StationPanelFilter; label: string }>>(() => [
  { id: 'all', label: t('map.station_panel_filter_all') },
  { id: 'station', label: t('map.station_panel_filter_station') },
  { id: 'sector', label: t('map.station_panel_filter_sector') },
  { id: 'unplaced', label: t('map.station_panel_filter_unplaced') },
  { id: 'placed', label: t('map.station_panel_filter_placed') }
])

const iconUrlByType: Record<PlacementIcon, string> = {
  factory: factoryIconUrl,
  shipyard: shipyardIconUrl,
  tradestation: tradestationIconUrl
}

const DRAG_START_THRESHOLD_PX = 4

const pendingDrag = ref<{
  item: MapStationPanelItem
  startX: number
  startY: number
} | null>(null)
const activeDragItemId = ref<string | null>(null)

const clearPendingDrag = () => {
  pendingDrag.value = null
}

const finishActiveDrag = () => {
  if (!activeDragItemId.value) return
  activeDragItemId.value = null
  emit('drag-end')
}

const onWindowMouseMove = (event: MouseEvent) => {
  if (!pendingDrag.value || activeDragItemId.value) return
  const dx = event.clientX - pendingDrag.value.startX
  const dy = event.clientY - pendingDrag.value.startY
  if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return
  activeDragItemId.value = pendingDrag.value.item.id
  emit('drag-start', pendingDrag.value.item)
}

const onWindowMouseUp = () => {
  clearPendingDrag()
  finishActiveDrag()
}

const onItemMouseDown = (event: MouseEvent, item: MapStationPanelItem) => {
  if (event.button !== 0) return
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

watch(() => props.open, (open) => {
  if (!open) {
    searchQuery.value = ''
    activeFilter.value = 'all'
    clearPendingDrag()
    finishActiveDrag()
  }
})
</script>

<template>
  <aside v-show="open" class="map-station-panel" data-testid="map-station-panel">
    <div class="map-station-panel__header">
      <div class="map-station-panel__title">{{ t('map.station_panel_title') }}</div>
      <button
        class="map-station-panel__close"
        data-testid="map-station-panel-close"
        type="button"
        @click="emit('close')"
      >
        {{ t('map.station_panel_close') }}
      </button>
    </div>

    <div class="map-station-panel__body scrollbar-thin" data-testid="map-station-panel-body">
      <div class="map-station-panel__search-wrap">
        <input
          v-model="searchQuery"
          class="map-station-panel__search"
          data-testid="map-station-panel-search"
          :placeholder="t('map.station_panel_search_placeholder')"
          type="text"
        />
        <button
          v-if="searchQuery"
          class="map-station-panel__search-clear"
          data-testid="map-station-panel-search-clear"
          type="button"
          @click="searchQuery = ''"
        >
          ×
        </button>
      </div>

      <div class="map-station-panel__filters">
        <button
          v-for="filter in filterTabs"
          :key="filter.id"
          class="map-station-panel__chip"
          :class="{ active: activeFilter === filter.id }"
          :data-testid="`filter-${filter.id}`"
          type="button"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
        </button>
      </div>

      <div
        v-for="group in groupedItems"
        :key="group.id"
        class="map-station-panel__section"
      >
        <div class="map-station-panel__section-title">{{ group.name }}</div>
        <div class="map-station-panel__list">
          <div
            v-for="item in group.items"
            :key="`${item.kind}:${item.id}`"
            class="map-station-panel__item"
            :class="{ 'map-station-panel__item--placed': !!item.location, 'map-station-panel__item--dragging': activeDragItemId === item.id }"
            :data-testid="`station-item-${item.id}`"
            @mousedown="onItemMouseDown($event, item)"
            @click="item.location ? emit('focus-item', item) : undefined"
          >
            <div class="map-station-panel__item-main">
              <img
                class="map-station-panel__icon"
                :src="iconUrlByType[item.icon]"
                alt=""
                aria-hidden="true"
              />
              <div v-if="item.location" class="map-station-panel__meta">
                <div class="map-station-panel__name">{{ item.name }}</div>
                <div class="map-station-panel__sub-row">
                  <div class="map-station-panel__sub-tag station-address">
                    <span :class="{ 'text-red-500': item.isAddressInactive }">{{ item.targetSectorName }}</span>
                    <button
                      class="map-station-panel__clear-inline"
                      type="button"
                      :title="t('map.station_panel_clear_action')"
                      :aria-label="t('map.station_panel_clear_action')"
                      @click.stop="emit('clear-location', item)"
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
              <div v-else class="map-station-panel__name">{{ item.name }}</div>
            </div>
            <div class="map-station-panel__handle" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="groupedItems.length === 0" class="map-station-panel__empty">{{ t('map.station_panel_empty') }}</div>

      <div class="map-station-panel__hint">{{ t('map.station_panel_hint') }}</div>
    </div>
  </aside>
</template>

<style scoped>
.map-station-panel {
  @apply flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-amber-300/35 bg-black/80 p-4 text-amber-50;
  backdrop-filter: blur(10px);
}

.map-station-panel__header {
  @apply mb-3 flex shrink-0 items-center justify-between gap-3;
}

.map-station-panel__title {
  @apply text-base font-semibold;
}

.map-station-panel__close,
.map-station-panel__clear,
.map-station-panel__chip {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100 transition-colors duration-150 hover:border-amber-200/60 hover:text-amber-50;
}

.map-station-panel__body {
  @apply min-h-0 flex-1 overflow-y-auto pr-1;
  scrollbar-color: rgba(251, 191, 36, 0.5) rgba(255, 255, 255, 0.06);
  scrollbar-width: thin;
}

.map-station-panel__body::-webkit-scrollbar {
  width: 10px;
}

.map-station-panel__body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
}

.map-station-panel__body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(252, 211, 77, 0.65), rgba(245, 158, 11, 0.55));
  border-radius: 9999px;
  border: 2px solid rgba(0, 0, 0, 0.35);
}

.map-station-panel__search-wrap {
  @apply relative mb-3;
}

.map-station-panel__search {
  @apply h-10 w-full rounded border border-amber-300/30 bg-black/60 px-3 pr-10 text-sm text-amber-50 outline-none;
}

.map-station-panel__search-clear {
  @apply absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-amber-100/60 transition-colors duration-150 hover:text-amber-50;
}

.map-station-panel__filters {
  @apply mb-4 flex flex-wrap gap-2;
}

.map-station-panel__chip.active {
  @apply border-amber-200/70 bg-amber-200/10 text-amber-50;
}

.map-station-panel__section {
  @apply mb-4;
}

.map-station-panel__section-title {
  @apply mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/80;
}

.map-station-panel__list {
  @apply flex flex-col gap-2;
}

.map-station-panel__item {
  @apply flex items-center justify-between gap-3 rounded border border-amber-300/15 bg-black/45 px-3 py-3;
  cursor: grab;
}

.map-station-panel__item--placed {
  @apply cursor-pointer transition-colors duration-150 hover:border-amber-200/45 hover:bg-amber-200/5;
}

.map-station-panel__item--dragging {
  cursor: grabbing;
}

.map-station-panel__item-main {
  @apply flex min-w-0 flex-1 items-center gap-3;
}

.map-station-panel__icon {
  @apply h-[18px] w-[18px] shrink-0 object-contain;
}

.map-station-panel__meta {
  @apply min-w-0;
}

.map-station-panel__name {
  @apply truncate text-sm font-medium text-amber-50;
}

.map-station-panel__sub,
.map-station-panel__empty,
.map-station-panel__hint {
  @apply text-xs text-amber-100/60;
}

.map-station-panel__sub-row {
  @apply flex items-center gap-1.5;
}

.map-station-panel__sub-tag {
  @apply inline-flex items-center rounded-full border border-amber-300/20 bg-amber-200/10 px-2 py-0.5 text-[11px] leading-4 text-amber-100/75;
}

.map-station-panel__handle {
  @apply flex shrink-0 cursor-grab flex-col gap-1 rounded px-2 py-1 text-amber-200/55;
}

.map-station-panel__handle span {
  @apply block h-[2px] w-4 rounded-full bg-current;
}

.map-station-panel__clear-inline {
  @apply inline-flex h-4 w-4 shrink-0 items-center justify-center self-center rounded text-amber-100/55 transition-colors duration-150 hover:text-amber-50;
}

.map-station-panel__clear-inline svg {
  @apply h-3 w-3;
}

.map-station-panel__hint {
  @apply pt-2;
}
</style>
