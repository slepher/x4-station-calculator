<script setup lang="ts">
import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import type { EmpireGroupedFlows, SupplyStorageFlow } from '@/types/x4'
import ViewTabUi from '@/components/common/ViewTabUI.vue'
import PriceSlider from '@/components/common/PriceSlider.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'
import TransitHubQuantityView from './TransitHubQuantityView.vue'
import TransitHubEconomyView from './TransitHubEconomyView.vue'
import TransitHubStorageView from './TransitHubStorageView.vue'
import TransitHubTransportView from './TransitHubTransportView.vue'

const gameData = useGameDataStore()
const { t } = useI18n()
const { translateWare } = useX4I18n()

type SharedViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

const props = withDefaults(defineProps<{
  groupedFlows: EmpireGroupedFlows
  storageFlows: SupplyStorageFlow[]
  viewMode?: SharedViewMode
  priceMultiplier?: number
  productBufferHours?: number
}>(), {
  viewMode: 'quantity',
  priceMultiplier: 0.5,
  productBufferHours: 12
})

const emit = defineEmits<{
  (e: 'update:viewMode', value: SharedViewMode): void
  (e: 'update:priceMultiplier', value: number): void
  (e: 'update:productBufferHours', value: number): void
}>()

const viewMode = computed<SharedViewMode>({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
})

const localPriceMultiplier = computed({
  get: () => props.priceMultiplier,
  set: (value) => emit('update:priceMultiplier', value)
})

const localProductBufferHours = computed({
  get: () => props.productBufferHours,
  set: (value) => emit('update:productBufferHours', value)
})

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const formatSignedAbs = (n: number) => `${n >= 0 ? '+' : '-'}${formatNum(Math.abs(n))}`

const wrapFlow = (flow: any) => {
  const wareInfo = gameData.waresMap?.[flow.wareId]
  return {
    ...flow,
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId
  }
}

const views = computed(() => [
  { key: 'quantity', label: t('wareflow.quantity_view') },
  { key: 'economy', label: t('wareflow.economy_view') },
  { key: 'volume', label: t('wareflow.volume_view') },
  { key: 'transport', label: t('wareflow.transport_view') }
])

const title = computed(() => {
  if (viewMode.value === 'quantity') return t('wareflow.resource_view')
  if (viewMode.value === 'economy') return t('wareflow.economy_view')
  if (viewMode.value === 'volume') return t('wareflow.volume_view')
  return t('wareflow.transport_view')
})

const grouped = computed(() => {
  const groups = props.groupedFlows.empireGroups
  const products = groups.operations.filter(item => item.netRate > 0)
  const operations = groups.operations.filter(item => item.netRate <= 0)
  const supplyValue = groups.supply.reduce((sum, item) => sum + item.netValue, 0)

  return {
    quantity: [
      { key: 'products', title: t('wareflow.products_group'), items: products.map(wrapFlow) },
      { key: 'operations', title: t('wareflow.operations_group'), items: operations.map(wrapFlow) },
      { key: 'supply', title: t('wareflow.supply_group'), items: groups.supply.map(wrapFlow) }
    ],
    economy: [
      {
        key: 'products',
        title: t('wareflow.products_income_group'),
        items: products.map(wrapFlow),
        sumText: formatSignedAbs(products.reduce((sum, item) => sum + (item.netValue || 0), 0)),
        sumClass: 'positive'
      },
      {
        key: 'operations',
        title: t('wareflow.operations_expense_group'),
        items: operations.map(wrapFlow),
        sumText: formatSignedAbs(operations.reduce((sum, item) => sum + (item.netValue || 0), 0)),
        sumClass: 'negative'
      },
      {
        key: 'supply',
        title: supplyValue >= 0 ? t('wareflow.supply_income_group') : t('wareflow.supply_expense_group'),
        items: groups.supply.map(wrapFlow),
        sumText: formatSignedAbs(supplyValue),
        sumClass: supplyValue >= 0 ? 'positive' : 'negative'
      }
    ]
  }
})

const hasFlowData = computed(() => props.groupedFlows.flows.length > 0)

const storageItems = computed(() =>
  props.storageFlows.map((flow) => ({
    ...flow,
    name: wrapFlow({ wareId: flow.wareId }).name
  })).filter((item) => item.totalRequiredStorageVolume > 0)
)
const storageTotalVolume = computed(() =>
  storageItems.value.reduce((sum, item) => sum + item.totalRequiredStorageVolume, 0)
)
const hasStorageData = computed(() => storageItems.value.length > 0)

const transportItems = computed(() =>
  props.storageFlows.map((storageFlow) => {
    const details = (storageFlow.details || [])
      .map((detail: any) => ({
        stationId: detail.stationId,
        stationName: detail.stationName,
        stationCount: detail.stationCount,
        kind: detail.kind,
        transportVolume: Math.abs(detail.staticRate || 0) * (storageFlow.unitVolume || 0),
        sortOrder: detail.sortOrder
      }))
      .filter((detail: any) => detail.transportVolume > 0)
    const totalTransportVolume = details.reduce((sum: number, detail: any) => sum + detail.transportVolume, 0)

    return {
      wareId: storageFlow.wareId,
      name: wrapFlow({ wareId: storageFlow.wareId }).name,
      totalTransportVolume,
      details
    }
  }).filter((item) => item.totalTransportVolume > 0)
)
const transportTotalVolume = computed(() =>
  transportItems.value.reduce((sum, item) => sum + item.totalTransportVolume, 0)
)
const hasTransportData = computed(() =>
  transportItems.value.some((item) => item.totalTransportVolume > 0)
)
</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">{{ title }}</h3>
      <div class="header-right-group">
        <ViewTabUi v-model="viewMode" :views="views" color-style="sky" ui-key="transit-hub-wareflow" />
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <TransitHubQuantityView
        v-if="viewMode === 'quantity'"
        :groups="grouped.quantity"
        :has-data="hasFlowData"
      />
      <TransitHubEconomyView
        v-else-if="viewMode === 'economy'"
        :groups="grouped.economy"
        :has-data="hasFlowData"
      />
      <TransitHubStorageView
        v-else-if="viewMode === 'volume'"
        :items="storageItems"
        :total-volume="storageTotalVolume"
        :has-data="hasStorageData"
      />
      <TransitHubTransportView
        v-else
        :items="transportItems"
        :total-volume="transportTotalVolume"
        :has-data="hasTransportData"
      />
    </div>

    <div class="controls-section" v-if="hasFlowData">
      <div v-if="viewMode === 'economy'" class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="localPriceMultiplier" :label="t('wareflow.price_multiplier')" type="buy" />
      </div>
      <div v-if="viewMode === 'volume'" class="simulation-controls flex flex-row gap-4">
        <VolumeControlSlider
          v-model="localProductBufferHours"
          :label="t('wareflow.product_buffer_hours')"
          type="product"
          :max="24"
          :step="1" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-wrapper {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}
.list-header {
  @apply flex justify-between items-center p-4 bg-slate-800/30 border-b border-slate-700/50;
}
.header-title {
  @apply text-base font-bold text-slate-100 tracking-wider uppercase;
}
.header-right-group {
  @apply flex items-center gap-3;
}
.list-body {
  @apply p-2 overflow-y-auto;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.3);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}
.controls-section {
  @apply border-t border-slate-700/50;
}
.simulation-controls {
  @apply px-4 py-3 bg-slate-800/30 border-b border-slate-700/50;
}
</style>
