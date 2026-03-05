<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import ShipBuildSelector from '@/components/ship-build/ShipBuildSelector.vue'
import type { ShipBuildClass } from '@/store/useShipBuildStore'
import type { X4EquipmentType, X4Ship, X4ShipRace, X4ShipType } from '@/types/x4'

import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import shipRacesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'

const { t } = useI18n()

const ships = shipsRaw as unknown as X4Ship[]
const shipTypes = shipTypesRaw as X4ShipType[]
const shipRaces = shipRacesRaw as X4ShipRace[]
const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]

const shipBuildStore = useShipBuildStore()
const { selectedClass, selectedRaces, selectedTypes, selectedShipId, selectedShip } = storeToRefs(shipBuildStore)
const { setSelectedShipId, setSelectedClass, toggleRace, toggleType, setSelectedTypes } = shipBuildStore

const handleSelectedClassChange = (value: string | null) => {
  setSelectedClass(value as ShipBuildClass | null)
}

const handleRaceToggle = (value: string) => {
  toggleRace(value)
}

const handleTypeToggle = (value: string) => {
  toggleType(value)
}

const handleSelectedTypesChange = (value: string[]) => {
  setSelectedTypes(value)
}

const handleSelectedShipIdChange = (value: string | null) => {
  setSelectedShipId(value)
}
</script>

<template>
  <div class="panel-card" data-testid="ship-build-filters">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <span class="text-emerald-300 text-xs font-semibold">{{ t('ship_build.title') }}</span>
        <span class="text-slate-400 text-xs">{{ t('ship_build.select_ship') }}</span>
      </div>
      <div class="text-xs text-slate-500">{{ t('ship_build.filters') }}</div>
    </div>

    <ShipBuildSelector
      :selected-ship-id="selectedShipId"
      :selected-ship="selectedShip"
      :selected-class="selectedClass"
      :selected-races="selectedRaces"
      :selected-types="selectedTypes"
      :ships="ships"
      :ship-types="shipTypes"
      :ship-races="shipRaces"
      :equipment-types="equipmentTypes"
      @update:selected-class="handleSelectedClassChange"
      @toggle-race="handleRaceToggle"
      @toggle-type="handleTypeToggle"
      @update:selected-types="handleSelectedTypesChange"
      @update:selected-ship-id="handleSelectedShipIdChange"
    />
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}
</style>
