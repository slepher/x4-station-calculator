<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { extractShipCandidates, filterTypesByClass } from '@/store/logic/shipEquipmentPicker'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import ShipBuildPanelShip from '@/components/ship-build/ShipBuildPanelShip.vue'
import type { X4Ship, EquipmentType, ShipEquipmentSize } from '@/types/x4'

const { t } = useI18n()
const { translateShip, translateShipType } = useX4I18n()
const gameData = useGameDataStore()
const shipBuildStore = useShipBuildStore()
const { selectedShipId } = storeToRefs(shipBuildStore)
const { setSelectedShipId, cancelShipSelector } = shipBuildStore

const pendingShipId = ref<string | null>(null)
const selectedClass = ref<X4Ship['class'] | null>(null)
const selectedRaces = ref<string[]>([])
const selectedTypes = ref<string[]>([])

const classOptions = [
  { id: 'ship_s', label: 'S' },
  { id: 'ship_m', label: 'M' },
  { id: 'ship_l', label: 'L' },
  { id: 'ship_xl', label: 'XL' }
]

const currentShip = computed<X4Ship | null>(() => {
  const shipId = selectedShipId.value
  if (!shipId) return null
  return shipBuildStore.shipMap.get(shipId) || null
})

const pendingShip = computed<X4Ship | null>(() => {
  if (!pendingShipId.value) return null
  return shipBuildStore.shipMap.get(pendingShipId.value) || null
})

const confirmShipId = computed<string | null>(() => pendingShipId.value || selectedShipId.value || null)
const pageSize = 10
const currentPage = ref(1)

const raceOptions = computed(() => shipBuildStore.shipRaces.map(race => ({ id: race.id, label: race.id })))

const availableTypes = computed(() => filterTypesByClass(shipBuildStore.shipTypes, selectedClass.value))
const isTypeSingleRow = computed(() => availableTypes.value.length > 0 && availableTypes.value.length <= 5)

const typeLabelMap = computed(() => {
  const map = new Map<string, string>()
  shipBuildStore.shipTypes.forEach(type => {
    map.set(type.id, translateShipType(type))
  })
  return map
})

const equipmentSizeOrder: ShipEquipmentSize[] = ['extralarge', 'large', 'medium', 'small']
const equipmentSizeLabelMap: Partial<Record<ShipEquipmentSize, string>> = {
  extralarge: 'XL',
  large: 'L',
  medium: 'M',
  small: 'S'
}

const equipmentTypeShortMap: Record<EquipmentType, string> = {
  engine: 'E',
  shield: 'S',
  weapon: 'W',
  turret: 'T',
  thruster: '',
  consumables: '',
  units: ''
}

const getEquipmentSummary = (ship: X4Ship, mode: 'short' | 'full') => {
  if (!ship.slots || ship.slots.length === 0) return ''
  const typeCounts = new Map<EquipmentType, Record<ShipEquipmentSize, number>>()
  ship.slots.forEach(slot => {
    const entry = typeCounts.get(slot.type) || {
      extralarge: 0,
      large: 0,
      medium: 0,
      small: 0
    }
    equipmentSizeOrder.forEach(size => {
      const value = slot.count?.[size]
      if (value) entry[size] += value
    })
    typeCounts.set(slot.type, entry)
  })

  const parts: string[] = []
  typeCounts.forEach((counts, type) => {
    if (type === 'thruster') return
    const sizeText = equipmentSizeOrder
      .map(size => counts[size] ? `${equipmentSizeLabelMap[size] || ''}${counts[size]}` : '')
      .filter(Boolean)
      .join('')
    if (!sizeText) return
    const shortName = equipmentTypeShortMap[type] || type
    const typeName = mode === 'short' ? shortName : type
    parts.push(`${typeName}:${sizeText}`)
  })

  return parts.join(', ')
}

const canShowList = computed(() => Boolean(selectedClass.value) && (selectedRaces.value.length > 0 || selectedTypes.value.length > 0))

const shipCandidateResult = computed(() => extractShipCandidates({
  shipMap: shipBuildStore.shipMap,
  filters: {
    shipClass: selectedClass.value,
    races: selectedRaces.value,
    types: selectedTypes.value
  },
  includeShip: (ship) => shipBuildStore.isShipDlcUsable(ship)
}))

const raceCountMap = computed(() => shipCandidateResult.value.raceCountMap)
const typeCountMap = computed(() => shipCandidateResult.value.typeCountMap)

const filteredShips = computed(() => {
  if (!canShowList.value || !selectedClass.value) return []
  return shipCandidateResult.value.items
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredShips.value.length / pageSize)))
const showPager = computed(() => filteredShips.value.length > pageSize)
const pagedShips = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredShips.value.slice(start, start + pageSize)
})

watch(selectedClass, () => {
  const allowed = new Set(availableTypes.value.map(type => type.id))
  selectedTypes.value = selectedTypes.value.filter(typeId => allowed.has(typeId))
})

const syncPendingShip = (candidates: X4Ship[]) => {
  const pendingId = pendingShipId.value
  if (pendingId && candidates.some(ship => ship.id === pendingId)) return

  const currentShipId = selectedShipId.value || null
  if (currentShipId && candidates.some(ship => ship.id === currentShipId)) {
    pendingShipId.value = currentShipId
    return
  }

  pendingShipId.value = null
}

watch([filteredShips, selectedShipId], ([next]) => {
  syncPendingShip(next)
}, { immediate: true })

watch(selectedShipId, (shipId) => {
  const ship = shipId ? shipBuildStore.findShip(shipId) : null
  if (!ship) {
    selectedClass.value = null
    selectedRaces.value = []
    selectedTypes.value = []
    return
  }
  selectedClass.value = ship.class
  selectedRaces.value = ship.race ? [ship.race] : []
  selectedTypes.value = ship.type ? [ship.type] : []
}, { immediate: true })

watch(filteredShips, (next) => {
  if (next.length <= pageSize) {
    currentPage.value = 1
    return
  }
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

const setSelectedClass = (value: string | null) => {
  selectedClass.value = value as X4Ship['class'] | null
}

const toggleRace = (value: string) => {
  if (selectedRaces.value.includes(value)) {
    selectedRaces.value = selectedRaces.value.filter((id) => id !== value)
    return
  }
  selectedRaces.value = [...selectedRaces.value, value]
}

const toggleType = (value: string) => {
  if (selectedTypes.value.includes(value)) {
    selectedTypes.value = selectedTypes.value.filter((id) => id !== value)
    return
  }
  selectedTypes.value = [...selectedTypes.value, value]
}

const setPendingShipId = (value: string | null) => {
  pendingShipId.value = value
}

const confirmPendingShip = () => {
  if (!confirmShipId.value) return
  setSelectedShipId(confirmShipId.value)
}

const handleCancelShipChange = () => {
  cancelShipSelector()
}

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
}
</script>

<template>
  <div class="panel-body grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="ship-build-selector-grid">
    <div class="flex flex-col gap-4" data-testid="ship-build-filter-column">
        <div class="filter-card" data-testid="ship-build-filter-class">
          <div class="filter-card-header">
            <span>{{ t('ship_build.filter_class') }}</span>
            <span class="filter-required">{{ t('ship_build.required') }}</span>
          </div>
          <div class="filter-card-body">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in classOptions"
                :key="option.id"
                :data-testid="`ship-build-filter-class-btn-${option.id}`"
                class="filter-chip"
                :class="selectedClass === option.id ? 'filter-chip-active' : 'filter-chip-idle'"
                @click="setSelectedClass(option.id as any)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="filter-card" data-testid="ship-build-filter-race">
          <div class="filter-card-header">{{ t('ship_build.filter_race') }}</div>
          <div class="filter-card-body">
            <div class="race-grid">
              <button
                v-for="option in raceOptions"
                :key="option.id"
                :data-testid="`ship-build-filter-race-btn-${option.id}`"
                class="filter-chip"
                :class="selectedRaces.includes(option.id) ? 'filter-chip-active' : 'filter-chip-idle'"
                @click="toggleRace(option.id)"
              >
                <span>{{ option.label }}</span>
                <span class="filter-count" data-testid="ship-build-race-count">({{ raceCountMap.get(option.id) || 0 }})</span>
              </button>
            </div>
          </div>
        </div>

        <div class="filter-card" data-testid="ship-build-filter-type">
          <div class="filter-card-header">{{ t('ship_build.filter_type') }}</div>
          <div class="filter-card-body">
            <div v-if="!selectedClass" class="text-xs text-slate-500">
              {{ t('ship_build.type_hint') }}
            </div>
            <div v-else :class="['type-grid', isTypeSingleRow ? 'type-grid-single' : '']">
              <button
                v-for="type in availableTypes"
                :key="type.id"
                :data-testid="`ship-build-filter-type-btn-${type.id}`"
                class="filter-chip"
                :class="selectedTypes.includes(type.id) ? 'filter-chip-active' : 'filter-chip-idle'"
                @click="toggleType(type.id)"
              >
                <span>{{ typeLabelMap.get(type.id) || type.id }}</span>
                <span class="filter-count" data-testid="ship-build-type-count">({{ typeCountMap.get(type.id) || 0 }})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div data-testid="ship-build-list-column" class="min-w-0">
        <div class="list-card">
          <div class="list-header">
            <div class="list-header-main">
              <span>{{ t('ship_build.list_title') }}</span>
              <span v-if="canShowList" class="text-xs text-slate-500">{{ filteredShips.length }}</span>
            </div>
            <div class="list-header-actions">
              <div v-if="showPager" class="pager" data-testid="ship-build-list-pager">
                <button class="pager-btn" :disabled="currentPage <= 1" @click="goPrevPage">&lt;</button>
                <button
                  v-for="page in totalPages"
                  :key="page"
                  class="pager-btn"
                  :class="currentPage === page ? 'pager-btn-active' : ''"
                  :data-testid="`ship-build-page-${page}`"
                  @click="currentPage = page"
                >
                  {{ page }}
                </button>
                <button class="pager-btn" :disabled="currentPage >= totalPages" @click="goNextPage">&gt;</button>
              </div>
              <button
                class="confirm-btn cancel-btn"
                data-testid="ship-build-cancel-ship-change"
                :disabled="!selectedShipId"
                @click="handleCancelShipChange"
              >
                {{ t('ui.cancel') }}
              </button>
              <button
                class="confirm-btn"
                data-testid="ship-build-confirm-ship"
                :disabled="!confirmShipId"
                @click="confirmPendingShip"
              >
                {{ t('ship_build.fit_picker_confirm') }}
              </button>
            </div>
          </div>
          <div v-if="!canShowList" class="list-empty" data-testid="ship-build-list-empty">
            {{ t('ship_build.list_hint') }}
          </div>
          <div v-else-if="filteredShips.length === 0" class="list-empty" data-testid="ship-build-list-empty">
            {{ t('ship_build.empty_list') }}
          </div>
          <ul v-else class="list-body list-grid custom-scrollbar">
            <li
              v-for="ship in pagedShips"
              :key="ship.id"
              class="list-item"
              :class="pendingShipId === ship.id ? 'list-item-pending' : ''"
              @click="setPendingShipId(ship.id)"
            >
              <div class="ship-name-row">
                <div class="font-semibold text-slate-100 truncate" data-testid="ship-build-ship-name">{{ translateShip(ship) }}</div>
                <span
                  v-if="ship.dlc_tag !== 'base'"
                  class="dlc-tag"
                  :class="gameData.isDlcActive(ship.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
                >
                  {{ gameData.getDlcDisplayName(ship.dlc_tag) }}
                </span>
              </div>
              <div class="text-xs text-slate-300/90 equipment-line">
                {{ getEquipmentSummary(ship, 'short') }}
              </div>
              <div class="text-xs text-slate-400">
                {{ typeLabelMap.get(ship.type) || ship.type }} · {{ ship.race }}
              </div>
            </li>
          </ul>
        </div>
      </div>

    <ShipBuildPanelShip
      :target-ship="pendingShip"
      :current-ship="currentShip"
    />
  </div>
</template>

<style scoped>
.panel-body {
  @apply p-4;
}

.filter-required {
  @apply text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30;
}

.filter-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg;
}

.filter-card-header {
  @apply px-3 py-2 text-xs uppercase tracking-wide text-slate-300 border-b border-slate-800 font-semibold;
}

.filter-card-body {
  @apply p-3;
}

.filter-chip {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold transition-all border;
}

.filter-chip-idle {
  @apply bg-slate-800/70 text-slate-300 border-slate-700 hover:border-emerald-400/60 hover:text-emerald-200;
}

.filter-chip-active {
  @apply bg-emerald-600/80 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)];
}

.filter-count {
  @apply text-[11px] text-slate-300 ml-1;
}

.race-grid {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 0.5rem;
}

.list-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col;
}

.list-header {
  @apply px-3 py-2 text-xs uppercase tracking-wide text-slate-300 border-b border-slate-800 flex items-center justify-between gap-2;
}

.list-header-main {
  @apply flex items-center gap-2 min-w-0;
}

.list-header-actions {
  @apply inline-flex items-center gap-2;
}

.ship-name-row {
  @apply flex items-center gap-2 min-w-0;
}

.dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.pager {
  @apply inline-flex items-center gap-1;
}

.pager-btn {
  @apply h-[25.6px] rounded border border-slate-600 px-1.5 py-0 text-[10px] text-slate-200 inline-flex items-center;
}

.pager-btn:disabled {
  @apply opacity-40 cursor-not-allowed;
}

.pager-btn-active {
  @apply border-emerald-300 text-emerald-100;
}

.confirm-btn {
  @apply px-2.5 py-1 rounded border border-emerald-300 text-emerald-100 text-[11px] font-semibold transition-colors;
}

.cancel-btn {
  @apply border-slate-600 text-slate-200;
}

.confirm-btn:disabled {
  @apply opacity-40 cursor-not-allowed border-slate-600 text-slate-400;
}

.list-body {
  @apply overflow-y-auto px-3 py-3;
  align-content: start;
}

.list-grid {
  @apply grid gap-2;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-content: start;
}

.list-item {
  @apply bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 cursor-pointer transition-all;
  min-height: 72px;
}

.list-item-pending {
  @apply border-emerald-200 ring-1 ring-emerald-300 bg-emerald-500/10;
}

.list-empty {
  @apply text-xs text-slate-500 px-3 py-6 text-center;
}

.type-grid {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 0.5rem;
}

.type-grid-single {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
}

.equipment-line {
  min-height: 18px;
}

@media (max-width: 1024px) {
  .list-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .panel-body {
    @apply grid-cols-1;
  }

  .list-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
