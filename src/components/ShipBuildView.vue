<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { FitMode } from '@/components/ship-build/fitTypes'
import type {
  X4Ship,
  X4ShipRace,
  X4ShipType,
  X4EquipmentType,
  X4Equipment,
  X4Ware,
  ShipBlueprint
} from '@/types/x4'
import ShipBuildPanelFit from '@/components/ship-build/ShipBuildPanelFit.vue'
import ShipBuildPanelEquipment from '@/components/ship-build/ShipBuildPanelEquipment.vue'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import ShipBuildPanelMaterials from '@/components/ship-build/ShipBuildPanelMaterials.vue'
import ShipBuildSelector from '@/components/ship-build/ShipBuildSelector.vue'
import type { ShipBuildClass } from '@/store/useShipBuildStore'

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
const { translateEquipmentType, translateEquipment } = useX4I18n()

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
  missileMap.set(m.macro, m)
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
  selectedShip,
  blueprint
} = storeToRefs(shipBuildStore)
const {
  setSelectedShipId,
  setSelectedClass,
  toggleRace,
  toggleType,
  setSelectedTypes,
  setDisplayResolvers,
  buildPreviewBlueprint
} = shipBuildStore
setDisplayResolvers({
  translateEquipment,
  translateEquipmentType
})

// Wrapper functions to cast types for ShipBuildSelector
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

const showMaterial = ref(true)

// Picker 状态
const isPickerOpen = ref(false)
const pickerTarget = ref<{
  key: string
  count: number
  totalCount: number
  connectionKeys: string[]
  options: { id: string; name: string; mk: string | null; race: string | null; tags: string[] }[]
} | null>(null)
const highlightedEquipmentId = ref<string | null>(null)
const pickerMode = ref<FitMode>('connection')
const targetBlueprint = ref<ShipBlueprint | null>(null)

// picker-open 事件参数
const currentSlotType = ref('')
const currentEquipmentId = ref<string | null>(null)
const currentIsShield = ref(false)

// Picker 事件处理
const handlePickerOpen = (slotType: string, equipmentId: string | null, isShield: boolean) => {
  isPickerOpen.value = true
  showMaterial.value = false
  currentSlotType.value = slotType
  currentEquipmentId.value = equipmentId
  currentIsShield.value = isShield
}

const handlePickerClose = () => {
  isPickerOpen.value = false
  showMaterial.value = true
  targetBlueprint.value = null
}

const handleHighlightedEquipmentIdChange = (id: string | null) => {
  highlightedEquipmentId.value = id
}

const handlePickerTargetChange = (target: typeof pickerTarget.value) => {
  pickerTarget.value = target
}

const handlePickerModeChange = (mode: FitMode) => {
  pickerMode.value = mode
}

watch(
  [isPickerOpen, highlightedEquipmentId, pickerTarget, blueprint, pickerMode],
  ([open, highlightedId, target, currentBlueprint, mode]) => {
    if (!open || !highlightedId || !target || !currentBlueprint) {
      targetBlueprint.value = null
      return
    }
    targetBlueprint.value = buildPreviewBlueprint({
      connectionKeys: target.connectionKeys,
      equipmentId: highlightedId,
      mode,
      targetCount: mode === 'group' ? target.totalCount : undefined
    })
  },
  { deep: true }
)

// 更换飞船时强制回到未展开布局，避免旧 picker 状态残留导致 Fit 面板仍保持宽布局
watch(selectedShipId, (next, prev) => {
  if (next === prev) return
  isPickerOpen.value = false
  showMaterial.value = true
  pickerTarget.value = null
  highlightedEquipmentId.value = null
  currentSlotType.value = ''
  currentEquipmentId.value = null
  currentIsShield.value = false
  pickerMode.value = 'connection'
  targetBlueprint.value = null
})
</script>

<template>
  <div class="ship-build-view flex flex-col gap-6">
    <div v-if="!selectedShip" class="panel-card" data-testid="ship-build-filters">
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

    <div v-if="selectedShip" class="grid grid-cols-12 gap-8 items-start" data-testid="ship-build-panels">
      <!-- Left: Fit (Picker) - 根据 wide prop 控制 col-span-8 或 col-span-4 -->
      <ShipBuildPanelFit
        :key="selectedShipId || 'no-ship'"
        :wide="!showMaterial"
        @picker-open="handlePickerOpen"
        @picker-close="handlePickerClose"
        @update:highlightedEquipmentId="handleHighlightedEquipmentIdChange"
        @update:pickerTarget="handlePickerTargetChange"
        @update:pickerMode="handlePickerModeChange"
      />

      <!-- Right Column -->
      <!-- 展开时: Equipment(上) + Stats(下), 材料隐藏 -->
      <!-- 收起时: Stats + Materials 并排 -->
      <template v-if="isPickerOpen">
        <!-- 展开后: Equipment 在上，Stats 在下 -->
        <div class="col-span-4 flex flex-col gap-4">
          <ShipBuildPanelEquipment
            :is-picker-open="isPickerOpen"
            :picker-target="pickerTarget"
            :highlighted-equipment-id="highlightedEquipmentId"
            :selected-ship="selectedShip"
            :slot-type="currentSlotType"
            :current-equipment-id="currentEquipmentId"
            :is-shield="currentIsShield"
          />
          <ShipBuildPanelStats
            :ship-blueprint="blueprint"
            :target-blueprint="targetBlueprint"
          />
        </div>
      </template>
      <template v-else>
        <!-- 展开前: Stats 和 Materials 并排 -->
        <ShipBuildPanelStats
          :ship-blueprint="blueprint"
          :target-blueprint="targetBlueprint"
        />
        <ShipBuildPanelMaterials
          :ship-blueprint="blueprint"
        />
      </template>
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
