<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import CollapsibleDetailList from '@/components/common/CollapsibleDetailList.vue'
import PriceSlider from '@/components/common/PriceSlider.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'
import type { ShipBlueprint } from '@/types/x4'
import { useShipBuildMaterialsPresenter } from '@/components/ship-build/presenters/useShipBuildMaterialsPresenter'

const props = defineProps<{
  shipBlueprint: ShipBlueprint | null
}>()

const { t } = useI18n()
const { translateShip, translateWare, translateEquipment, translate } = useX4I18n()
const store = useShipBuildStore()

const materialPriceMultiplier = ref(0.5)
const shipBlueprintRef = computed(() => props.shipBlueprint)

const presenter = useShipBuildMaterialsPresenter({
  shipBlueprint: shipBlueprintRef,
  materialPriceMultiplier,
  store,
  t,
  translateShip,
  translateWare,
  translateEquipment,
  translate
})

const {
  viewMode,
  views,
  analysis,
  materialMethodOptions,
  materialMethod,
  cards,
  visibleCards
} = presenter

watch(
  () => ({
    blueprintMethod: props.shipBlueprint?.materialMethod || null,
    selectedMethod: analysis.value.selectedMethod
  }),
  ({ blueprintMethod, selectedMethod }) => {
    if (!props.shipBlueprint) return
    if (blueprintMethod === selectedMethod) return
    store.setMaterialMethod(selectedMethod)
  },
  { immediate: true }
)

const formatCrValue = (value: number) => `${new Intl.NumberFormat('en-US').format(Math.round(value))} Cr`
const formatMaterialCount = (count: number) => new Intl.NumberFormat('en-US').format(Math.round(count))
const getMaterialName = (wareId: string) => {
  const ware = store.findWare(wareId)
  return ware ? translateWare(ware) : wareId
}

const formatTime = (seconds: number) => {
  if (!seconds) return '00:00:00'
  const d = Math.floor(seconds / (24 * 3600))
  const h = Math.floor((seconds % (24 * 3600)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (d >= 2) {
    return `${d}D ${timeStr}`
  }
  const totalHours = Math.floor(seconds / 3600)
  return `${String(totalHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const hasData = computed(() => {
  if (viewMode.value === 'materials') {
    return cards.value.length > 0 || analysis.value.summaryItems.length > 0
  }
  return visibleCards.value.length > 0 || analysis.value.totalBuildTime > 0
})
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-materials">
    <div class="panel-header">
      <span>{{ t('ship_build.panel_materials') }}</span>
      <ViewTabUi
        v-model="viewMode"
        :views="views"
        color-style="sky"
        ui-key="ship-build-materials"
      />
    </div>

    <div class="material-panel" data-testid="ship-build-materials-panel">
      <div v-if="hasData" class="material-groups custom-scrollbar">
        <CollapsibleDetailList
          v-if="viewMode === 'materials'"
          :data="analysis.summaryItems"
          main-row-testid="ship-build-material-summary"
          list-testid="ship-build-material-summary-list"
        >
          <template #title>
            <span class="material-summary-title">
              {{ t('ship_build.material_total') }}
            </span>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(analysis.totalValue) }}</span>
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
          v-else
          :data="[]"
          :is-expandable="false"
          main-row-testid="ship-build-material-summary"
          list-testid="ship-build-material-summary-list"
        >
          <template #title>
            <span class="material-summary-title">
              {{ t('ship_build.material_total') }}
            </span>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatTime(analysis.totalBuildTime) }}</span>
          </template>
        </CollapsibleDetailList>

        <CollapsibleDetailList
          v-for="card in (viewMode === 'materials' ? cards : visibleCards)"
          :key="card.key"
          :data="viewMode === 'materials'
            ? card.materialItems
            : [{ id: 'build_time', value: card.totalBuildTime }]"
          :main-row-testid="card.key.startsWith('ship:')
            ? 'ship-build-material-ship-group'
            : card.key.startsWith('equipment:')
              ? `ship-build-material-equipment-group-${card.key.slice('equipment:'.length)}`
              : `ship-build-material-storage-group-${card.key.replace(':', '_')}`"
          :list-testid="card.key.startsWith('ship:')
            ? 'ship-build-material-ship-list'
            : card.key.startsWith('equipment:')
              ? `ship-build-material-equipment-list-${card.key.slice('equipment:'.length)}`
              : `ship-build-material-storage-list-${card.key.replace(':', '_')}`"
        >
          <template #title>
            <div class="material-equipment-title">
              <span class="material-equipment-name">{{ card.title }}</span>
              <span class="material-equipment-count">x {{ card.quantity }}</span>
            </div>
          </template>
          <template #header>
            <span class="material-summary-value">
              {{ viewMode === 'materials' ? formatCrValue(card.totalValue) : formatTime(card.totalBuildTime) }}
            </span>
          </template>
          <template #row="{ item }">
            <template v-if="viewMode === 'materials'">
              <div class="material-item-row">
                <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
                <span class="material-item-symbol">x</span>
                <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
              </div>
              <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
            </template>
            <template v-else>
              <div class="material-item-row">
                <span class="material-item-name">{{ t('station.item_build_time') }}</span>
              </div>
              <span class="material-item-value">{{ formatTime(item.value) }}</span>
            </template>
          </template>
        </CollapsibleDetailList>
      </div>

      <div class="material-footer" data-testid="ship-build-material-price-slider">
        <div class="material-footer-controls">
          <PriceSlider
            v-if="viewMode === 'materials'"
            v-model="materialPriceMultiplier"
            :label="t('ship_build.material_price')"
            type="sell"
          />
          <select
            id="ship-build-material-method-select"
            v-model="materialMethod"
            class="material-method-select"
            data-testid="ship-build-material-method-select"
          >
            <option
              v-for="method in materialMethodOptions"
              :key="method"
              :value="method"
            >
              {{ method }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 py-0 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.material-panel {
  @apply p-4 flex flex-col gap-3;
}

.material-method-select {
  @apply bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-300;
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
  @apply text-[11px] text-slate-500 font-mono;
}

.material-footer {
  @apply border-t border-slate-800/70 pt-3;
}

.material-footer-controls {
  @apply flex items-center justify-between gap-3;
}
</style>
