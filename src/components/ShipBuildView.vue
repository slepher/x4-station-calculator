<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type {
  X4Ship,
  X4ShipRace,
  X4ShipType,
  X4EquipmentType,
  X4Equipment,
  X4Ware,
  EquipmentType,
  ShipEquipmentSize
} from '@/types/x4'
import ShipBuildPanelFit from '@/components/ship-build/ShipBuildPanelFit.vue'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import ShipBuildPanelMaterials from '@/components/ship-build/ShipBuildPanelMaterials.vue'
import type { FitMode } from '@/components/ship-build/fitTypes'

import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import shipRacesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'
import consumablesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'

const { t } = useI18n()
const { translateShip, translateShipType, translateEquipmentType, translateEquipment } = useX4I18n()

const ships = shipsRaw as unknown as X4Ship[]
const shipTypes = shipTypesRaw as X4ShipType[]
const shipRaces = shipRacesRaw as X4ShipRace[]
const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]
const equipments = equipmentsRaw as X4Equipment[]
const bullets = bulletsRaw as any[]
const missiles = missilesRaw as any[]
const consumables = consumablesRaw as any[]
const wares = waresRaw as X4Ware[]
const wareMap = new Map<string, X4Ware>()
wares.forEach((ware) => {
  wareMap.set(ware.id, ware)
})
const shipMap = new Map<string, X4Ship>()
ships.forEach((ship) => {
  shipMap.set(ship.id, ship)
})
const equipmentMap = new Map<string, X4Equipment>()
equipments.forEach((eq) => {
  equipmentMap.set(eq.id, eq)
})
const bulletMap = new Map<string, any>()
bullets.forEach((b) => {
  bulletMap.set(b.id, b)
})
const missileMap = new Map<string, any>()
missiles.forEach((m) => {
  missileMap.set(m.id, m)
})
const consumableMap = new Map<string, any>()
consumables.forEach((c) => {
  consumableMap.set(c.id, c)
})
const shipBuildStore = useShipBuildStore()
const {
  selectedClass,
  selectedRaces,
  selectedTypes,
  selectedShipId,
  statsViewMode,
  fitMode,
  selectedByConnection,
  selectedShip,
  connectionRows,
  groupRows,
  hasFitModeConflict,
  canSwitchToGroupMode,
  shipBuildMaterialAnalysis
} = storeToRefs(shipBuildStore)
const {
  setSelectedShipId,
  setSelectedClass,
  toggleRace,
  toggleType,
  setSelectedTypes,
  setFitMode: setFitModeStore,
  applyConnectionAssignment: applyConnectionAssignmentStore,
  applyGroupAssignment: applyGroupAssignmentStore,
  setStatsViewMode,
  setMaterialMethod,
  setMaterialPriceMultiplier,
  setDisplayResolvers
} = shipBuildStore
setDisplayResolvers({
  translateEquipment,
  translateEquipmentType
})

const classOptions = [
  { id: 'ship_s', label: 'S' },
  { id: 'ship_m', label: 'M' },
  { id: 'ship_l', label: 'L' },
  { id: 'ship_xl', label: 'XL' }
]

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
      .map(size => counts[size] ? `${equipmentSizeLabelMap[size] || ''}${counts[size]}` : '')
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
  setSelectedTypes(selectedTypes.value.filter(typeId => allowed.has(typeId)))
})

watch(filteredShips, (next) => {
  if (!selectedShipId.value) return
  if (!next.some(ship => ship.id === selectedShipId.value)) {
    setSelectedShipId(null)
  }
})
const fitModeConflictReason = computed(() => hasFitModeConflict.value ? t('ship_build.fit_mode_disabled_reason') : '')

const setFitMode = (mode: FitMode) => {
  if (mode === 'group' && !canSwitchToGroupMode.value) return
  setFitModeStore(mode)
}

const applyConnectionAssignment = (payload: { connectionKey: string; equipmentId: string | null }) => {
  applyConnectionAssignmentStore(payload)
}

const applyGroupAssignment = (payload: { groupKey: string; equipmentId: string | null }) => {
  const target = groupRows.value.find(item => item.groupKey === payload.groupKey)
  if (!target) return
  applyGroupAssignmentStore({
    connectionKeys: target.connectionKeys,
    equipmentId: payload.equipmentId
  })
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

      <div v-if="!selectedShip" class="panel-body grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
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
                @click="setSelectedShipId(ship.id)"
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

      <div v-else class="panel-body">
        <div
          class="selection-expanded"
          data-testid="ship-build-selection"
        >
          <div class="selection-expanded-header">
            <div class="selection-title">
              <span class="selection-title-label">{{ t('ship_build.selected_ship') }}</span>
              <span class="selection-title-name">{{ translateShip(selectedShip) }}</span>
            </div>
            <button class="selection-change-btn" @click="setSelectedShipId(null)">
              {{ t('ship_build.change_ship') }}
            </button>
          </div>
          <div class="selection-expanded-body">
            <div class="selection-expanded-line equipment-line">
              {{ getEquipmentSummary(selectedShip, 'full') }}
            </div>
            <div class="selection-expanded-line text-xs text-slate-400">
              {{ typeLabelMap.get(selectedShip.type) || selectedShip.type }} · {{ selectedShip.race }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedShip" class="grid grid-cols-12 gap-8" data-testid="ship-build-panels">
      <ShipBuildPanelFit
        :mode="fitMode"
        :can-switch-to-group="canSwitchToGroupMode"
        :conflict-reason="fitModeConflictReason"
        :connection-rows="connectionRows"
        :group-rows="groupRows"
        :selected-by-connection="selectedByConnection"
        @update:mode="setFitMode"
        @assign-connection="applyConnectionAssignment"
        @assign-group="applyGroupAssignment"
      />
      <ShipBuildPanelStats
        :selected-ship="selectedShip"
        :connection-rows="connectionRows"
        :selected-by-connection="selectedByConnection"
        :ships="ships"
        :equipments="equipments"
        :wares="wares"
        :stats-view-mode="statsViewMode"
        @set-stats-view-mode="setStatsViewMode"
      />
      <ShipBuildPanelMaterials
        :ship-build-material-analysis="shipBuildMaterialAnalysis"
        :selected-ship="selectedShip"
        :wares="wares"
        :ships="ships"
        @set-material-method="setMaterialMethod"
        @set-material-price-multiplier="setMaterialPriceMultiplier"
      />
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
  @apply bg-slate-900/30 border border-dashed border-slate-700 rounded-lg m-4;
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

.selection-expanded {
  @apply bg-slate-900/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 flex flex-col gap-1.5;
}

.selection-expanded-header {
  @apply flex items-center justify-between gap-4;
}

.selection-title {
  @apply flex flex-col gap-1;
}

.selection-title-label {
  @apply text-xs uppercase tracking-wide text-emerald-300 font-semibold;
}

.selection-title-name {
  @apply text-sm font-semibold text-slate-100;
}

.selection-change-btn {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10 transition-colors;
}

.selection-expanded-body {
  @apply flex flex-col gap-1 text-xs text-slate-200;
}

.selection-expanded-line {
  @apply text-slate-200;
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
