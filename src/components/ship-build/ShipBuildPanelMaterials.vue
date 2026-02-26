<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import CollapsibleDetailList from '@/components/common/CollapsibleDetailList.vue'
import PriceSlider from '@/components/common/PriceSlider.vue'
import type { X4Ship, X4Ware } from '@/types/x4'

const props = defineProps<{
  shipBuildMaterialAnalysis: {
    selectedMethod: string
    priceMultiplier: number
    methodOptions: string[]
    summaryItems: Array<{ wareId: string; count: number; value: number }>
    totalValue: number
    hullGroup: {
      shipId: string
      items: Array<{ wareId: string; count: number; value: number }>
      value: number
    } | null
    equipmentGroups: Array<{
      equipmentId: string
      equipmentName: string
      quantity: number
      items: Array<{ wareId: string; count: number; value: number }>
      value: number
    }>
  }
  selectedShip: X4Ship | null
  wares: X4Ware[]
  ships: X4Ship[]
}>()

const emit = defineEmits<{
  setMaterialMethod: [method: string]
  setMaterialPriceMultiplier: [multiplier: number]
}>()

const { t } = useI18n()
const { translateShip, translateWare } = useX4I18n()

const wareMap = new Map<string, X4Ware>()
props.wares.forEach((ware) => {
  wareMap.set(ware.id, ware)
})

const shipMap = new Map<string, X4Ship>()
props.ships.forEach((ship) => {
  shipMap.set(ship.id, ship)
})

const materialMethodModel = computed({
  get: () => props.shipBuildMaterialAnalysis.selectedMethod,
  set: (method: string) => emit('setMaterialMethod', method)
})

const materialPriceMultiplierModel = computed({
  get: () => props.shipBuildMaterialAnalysis.priceMultiplier,
  set: (multiplier: number) => emit('setMaterialPriceMultiplier', multiplier)
})

const formatCrValue = (value: number) => `${new Intl.NumberFormat('en-US').format(Math.round(value))} Cr`
const formatMaterialCount = (count: number) => new Intl.NumberFormat('en-US').format(Math.round(count))

const getMaterialName = (wareId: string) => {
  const ware = wareMap.get(wareId)
  return ware ? translateWare(ware) : wareId
}

const getShipName = (shipId: string | undefined) => {
  if (!shipId) return ''
  const ship = shipMap.get(shipId)
  return ship ? translateShip(ship) : shipId
}
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-materials">
    <div class="panel-header">{{ t('ship_build.panel_materials') }}</div>
    <div class="material-panel" data-testid="ship-build-materials-panel">
      <div class="material-method-row">
        <label class="material-method-label" for="ship-build-material-method-select">
          {{ t('ship_build.material_method') }}
        </label>
        <select
          id="ship-build-material-method-select"
          v-model="materialMethodModel"
          class="material-method-select"
          data-testid="ship-build-material-method-select"
        >
          <option
            v-for="method in shipBuildMaterialAnalysis.methodOptions"
            :key="method"
            :value="method"
          >
            {{ method }}
          </option>
        </select>
      </div>

      <div class="material-groups custom-scrollbar">
        <CollapsibleDetailList
          :data="shipBuildMaterialAnalysis.summaryItems"
          main-row-testid="ship-build-material-summary"
          list-testid="ship-build-material-summary-list"
        >
          <template #title>
            <span class="material-summary-title">
              {{ t('ship_build.material_total') }}
            </span>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(shipBuildMaterialAnalysis.totalValue) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>

        <!-- Hull group as separate item -->
        <CollapsibleDetailList
          v-if="shipBuildMaterialAnalysis.hullGroup"
          :data="shipBuildMaterialAnalysis.hullGroup.items"
          :main-row-testid="'ship-build-material-hull-group'"
          :list-testid="'ship-build-material-hull-list'"
        >
          <template #title>
            <div class="material-equipment-title">
              <span class="material-equipment-name">{{ getShipName(shipBuildMaterialAnalysis.hullGroup?.shipId) }}</span>
              <span class="material-equipment-count">x 1</span>
            </div>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(shipBuildMaterialAnalysis.hullGroup?.value || 0) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>

        <CollapsibleDetailList
          v-for="group in shipBuildMaterialAnalysis.equipmentGroups"
          :key="group.equipmentId"
          :data="group.items"
          :main-row-testid="`ship-build-material-equipment-group-${group.equipmentId}`"
          :list-testid="`ship-build-material-equipment-list-${group.equipmentId}`"
        >
          <template #title>
            <div class="material-equipment-title">
              <span class="material-equipment-name">{{ group.equipmentName }}</span>
              <span class="material-equipment-count">x {{ group.quantity }}</span>
            </div>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(group.value) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>
      </div>

      <div class="material-footer" data-testid="ship-build-material-price-slider">
        <PriceSlider
          v-model="materialPriceMultiplierModel"
          :label="t('ship_build.material_price')"
          type="buy"
        />
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

.material-panel {
  @apply p-4 flex flex-col gap-3;
}

.material-method-row {
  @apply flex items-center justify-between gap-3;
}

.material-method-label {
  @apply text-[11px] uppercase tracking-wide text-slate-400 font-semibold;
}

.material-method-select {
  @apply bg-slate-900/70 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-400;
}

.material-groups {
  @apply flex-1 overflow-y-auto pr-1;
}

.material-summary-title {
  @apply text-sm text-slate-200 font-semibold;
}

.material-summary-value {
  @apply text-xs text-red-300 font-mono font-semibold;
}

.material-item-row {
  @apply flex items-center gap-1 min-w-0;
}

.material-item-count {
  @apply text-xs text-slate-400 font-mono;
}

.material-item-symbol {
  @apply text-[10px] text-slate-500;
}

.material-item-name {
  @apply text-xs text-slate-300 truncate;
}

.material-item-value {
  @apply text-xs text-red-300/90 font-mono;
}

.material-equipment-title {
  @apply flex items-center gap-1 min-w-0;
}

.material-equipment-name {
  @apply text-xs text-slate-200 truncate;
}

.material-equipment-count {
  @apply text-xs text-slate-400 font-mono;
}

.material-footer {
  @apply mt-auto pt-2 border-t border-slate-800/80;
}
</style>
