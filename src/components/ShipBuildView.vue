<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { X4Ship, X4ShipRace, X4ShipType, X4EquipmentType, EquipmentType, ShipEquipmentSize } from '@/types/x4'

import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import shipRacesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'

const { t } = useI18n()
const { translateShip, translateShipType, translateEquipmentType } = useX4I18n()

const ships = shipsRaw as unknown as X4Ship[]
const shipTypes = shipTypesRaw as X4ShipType[]
const shipRaces = shipRacesRaw as X4ShipRace[]
const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]

const classOptions = [
  { id: 'ship_s', label: 'S' },
  { id: 'ship_m', label: 'M' },
  { id: 'ship_l', label: 'L' },
  { id: 'ship_xl', label: 'XL' }
]

const selectedClass = ref<'ship_s' | 'ship_m' | 'ship_l' | 'ship_xl' | null>(null)
const selectedRaces = ref<string[]>([])
const selectedTypes = ref<string[]>([])
const selectedShipId = ref<string | null>(null)

const raceOptions = computed(() => {
  return shipRaces.map(race => ({
    id: race.id,
    label: race.id
  }))
})

const availableTypes = computed(() => {
  if (!selectedClass.value) return []
  return shipTypes.filter(type => type.class.includes(selectedClass.value!))
})

const isTypeSingleRow = computed(() => availableTypes.value.length > 0 && availableTypes.value.length <= 5)

const typeLabelMap = computed(() => {
  const map = new Map<string, string>()
  shipTypes.forEach(type => {
    map.set(type.id, translateShipType(type))
  })
  return map
})

const equipmentTypeMap = computed(() => {
  const map = new Map<EquipmentType, X4EquipmentType>()
  equipmentTypes.forEach(type => {
    map.set(type.id, type)
  })
  return map
})

const equipmentSizeOrder: ShipEquipmentSize[] = ['extralarge', 'large', 'medium', 'small']
const equipmentSizeLabelMap: Record<ShipEquipmentSize, string> = {
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
  thruster: ''
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
      .map(size => counts[size] ? `${equipmentSizeLabelMap[size]}${counts[size]}` : '')
      .filter(Boolean)
      .join('')
    if (!sizeText) return
    const typeDef = equipmentTypeMap.value.get(type)
    const fullName = typeDef ? translateEquipmentType(typeDef) : type
    const shortName = equipmentTypeShortMap[type] || type
    const typeName = mode === 'short' ? shortName : fullName
    parts.push(`${typeName}:${sizeText}`)
  })

  return parts.join(', ')
}

const canShowList = computed(() => {
  return Boolean(selectedClass.value) && (selectedRaces.value.length > 0 || selectedTypes.value.length > 0)
})

const shipsByClass = computed(() => {
  if (!selectedClass.value) return []
  return ships.filter(ship => ship.class === selectedClass.value)
})

const raceCountMap = computed(() => {
  const counts = new Map<string, number>()
  const base = shipsByClass.value
  const filtered = selectedTypes.value.length > 0
    ? base.filter(ship => selectedTypes.value.includes(ship.type))
    : base
  filtered.forEach(ship => {
    counts.set(ship.race, (counts.get(ship.race) || 0) + 1)
  })
  return counts
})

const typeCountMap = computed(() => {
  const counts = new Map<string, number>()
  const base = shipsByClass.value
  const filtered = selectedRaces.value.length > 0
    ? base.filter(ship => selectedRaces.value.includes(ship.race))
    : base
  filtered.forEach(ship => {
    counts.set(ship.type, (counts.get(ship.type) || 0) + 1)
  })
  return counts
})

const filteredShips = computed(() => {
  if (!canShowList.value || !selectedClass.value) return []

  let result = shipsByClass.value
  if (selectedRaces.value.length > 0) {
    result = result.filter(ship => selectedRaces.value.includes(ship.race))
  }
  if (selectedTypes.value.length > 0) {
    result = result.filter(ship => selectedTypes.value.includes(ship.type))
  }

  return result
    .slice()
    .sort((a, b) => translateShip(a).localeCompare(translateShip(b)))
})

watch(selectedClass, () => {
  const allowed = new Set(availableTypes.value.map(type => type.id))
  selectedTypes.value = selectedTypes.value.filter(typeId => allowed.has(typeId))
})

const selectedShip = computed(() => {
  if (!selectedShipId.value) return null
  return ships.find(ship => ship.id === selectedShipId.value) || null
})

watch(filteredShips, (next) => {
  if (!selectedShipId.value) return
  if (!next.some(ship => ship.id === selectedShipId.value)) {
    selectedShipId.value = null
  }
})

const toggleRace = (raceId: string) => {
  if (selectedRaces.value.includes(raceId)) {
    selectedRaces.value = selectedRaces.value.filter(id => id !== raceId)
  } else {
    selectedRaces.value = [...selectedRaces.value, raceId]
  }
}

const toggleType = (typeId: string) => {
  if (selectedTypes.value.includes(typeId)) {
    selectedTypes.value = selectedTypes.value.filter(id => id !== typeId)
  } else {
    selectedTypes.value = [...selectedTypes.value, typeId]
  }
}
</script>

<template>
  <div class="ship-build-view flex flex-col gap-6">
    <div class="panel-card" data-testid="ship-build-filters">
      <div class="panel-header">
        <div class="flex items-center gap-2">
          <span class="text-emerald-300 text-xs font-semibold">{{ t('ship_build.title') }}</span>
          <span class="text-slate-400 text-xs">{{ t('ship_build.select_ship') }}</span>
        </div>
        <div class="text-xs text-slate-500">{{ t('ship_build.filters') }}</div>
      </div>

      <div class="panel-body grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
        <div class="flex flex-col gap-5">
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
                  class="filter-chip"
                  :class="selectedClass === option.id ? 'filter-chip-active' : 'filter-chip-idle'"
                  @click="selectedClass = option.id as any"
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

          <div class="selection-card">
            <div class="selection-label">{{ t('ship_build.selected_ship') }}</div>
            <div v-if="selectedShip" class="selection-value">
              <div class="font-semibold text-slate-100 truncate">{{ translateShip(selectedShip) }}</div>
              <div class="text-xs text-slate-300/90 equipment-line">
                {{ getEquipmentSummary(selectedShip, 'full') }}
              </div>
              <div class="text-xs text-slate-400">
                {{ typeLabelMap.get(selectedShip.type) || selectedShip.type }} · {{ selectedShip.race }}
              </div>
            </div>
            <div v-else class="selection-empty">{{ t('ship_build.no_selection') }}</div>
          </div>
        </div>

        <div data-testid="ship-build-list">
          <div class="list-card">
            <div class="list-header">
              <span>{{ t('ship_build.list_title') }}</span>
              <span v-if="canShowList" class="text-xs text-slate-500">{{ filteredShips.length }}</span>
            </div>
            <div v-if="!canShowList" class="list-empty" data-testid="ship-build-list-empty">
              {{ t('ship_build.list_hint') }}
            </div>
            <div v-else-if="filteredShips.length === 0" class="list-empty" data-testid="ship-build-list-empty">
              {{ t('ship_build.empty_list') }}
            </div>
            <ul v-else class="list-body list-grid custom-scrollbar">
              <li
                v-for="ship in filteredShips"
                :key="ship.id"
                class="list-item"
                :class="selectedShipId === ship.id ? 'list-item-active' : ''"
                @click="selectedShipId = ship.id"
              >
                <div class="font-semibold text-slate-100 truncate" data-testid="ship-build-ship-name">{{ translateShip(ship) }}</div>
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
      </div>
    </div>

    <div class="grid grid-cols-12 gap-8" data-testid="ship-build-panels">
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-fit">
        <div class="panel-header">{{ t('ship_build.panel_fit') }}</div>
        <div class="panel-placeholder"></div>
      </div>
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-stats">
        <div class="panel-header">{{ t('ship_build.panel_stats') }}</div>
        <div class="panel-placeholder"></div>
      </div>
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-materials">
        <div class="panel-header">{{ t('ship_build.panel_materials') }}</div>
        <div class="panel-placeholder"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.panel-body {
  @apply p-4;
}

.filter-block {
  @apply flex flex-col gap-2;
}

.filter-label {
  @apply text-xs uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-2;
}

.filter-required {
  @apply text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30;
}

.filter-chip {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold transition-all border;
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

.filter-chip-idle {
  @apply bg-slate-800/70 text-slate-300 border-slate-700 hover:border-emerald-400/60 hover:text-emerald-200;
}

.filter-chip-active {
  @apply bg-emerald-600/80 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)];
}

.list-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg h-full flex flex-col min-h-[320px];
}

.list-header {
  @apply px-3 py-2 text-xs uppercase tracking-wide text-slate-300 border-b border-slate-800 flex items-center justify-between;
}

.list-body {
  @apply flex-1 overflow-y-auto px-3 py-3;
  align-content: start;
}

.list-grid {
  @apply grid gap-2;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-content: start;
}

.list-item {
  @apply bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 cursor-pointer transition-all;
  min-height: 72px;
}

.list-item-active {
  @apply border-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.35)] bg-emerald-500/10;
}

.list-empty {
  @apply text-xs text-slate-500 px-3 py-6 text-center;
}

.panel-placeholder {
  @apply h-48 bg-slate-900/30 border border-dashed border-slate-700 rounded-lg m-4;
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

.selection-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg p-3;
}

.selection-label {
  @apply text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1;
}

.selection-value {
  @apply flex flex-col gap-1;
}

.selection-empty {
  @apply text-xs text-slate-500;
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
  .list-grid {
    grid-template-columns: 1fr;
  }
  .list-item {
    min-height: 64px;
  }
}
</style>
