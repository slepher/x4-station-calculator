<script setup lang="ts">
import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import type { SupplyStorageFlow } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
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

function getPriceByMultiplier(minPrice: number, avgPrice: number, maxPrice: number, multiplier: number): number {
  if (multiplier <= 0.5) {
    const t = multiplier * 2
    return minPrice + (avgPrice - minPrice) * t
  }
  const t = (multiplier - 0.5) * 2
  return avgPrice + (maxPrice - avgPrice) * t
}

function buildStorageFlowsFromProductionFlows(
  productionFlows: WareProductionFlow[],
  bufferHours: number
): SupplyStorageFlow[] {
  const safeBufferHours = Number.isFinite(bufferHours) && bufferHours > 0 ? bufferHours : 12
  const byWare = new Map<string, SupplyStorageFlow>()

  productionFlows
    .filter((flow) => flow.transportType === 'container')
    .forEach((flow) => {
      const row = byWare.get(flow.wareId) || {
        wareId: flow.wareId,
        orderIndex: flow.orderIndex,
        tier: flow.tier,
        transportType: flow.transportType,
        unitVolume: flow.unitVolume || 1,
        totalProductionStorageVolume: 0,
        totalConsumptionStorageVolume: 0,
        totalRequiredStorageVolume: 0,
        details: []
      }

      const details = flow.stationContributions || []
      details.forEach((detail, index) => {
        const amount = Math.abs(detail.netRate || 0)
        if (amount === 0) return
        row.details.push({
          stationId: detail.stationId,
          stationName: detail.stationName,
          stationCount: detail.stationCount || 1,
          kind: detail.netRate >= 0 ? 'production' : 'consumption',
          staticRate: amount,
          storageVolume: amount * (flow.unitVolume || 1) * safeBufferHours,
          sortOrder: index
        })
      })

      byWare.set(flow.wareId, row)
    })

  return Array.from(byWare.values())
    .map((row) => {
      const totalProductionStorageVolume = row.details
        .filter((detail) => detail.kind === 'production')
        .reduce((sum, detail) => sum + detail.storageVolume, 0)
      const totalConsumptionStorageVolume = row.details
        .filter((detail) => detail.kind === 'consumption')
        .reduce((sum, detail) => sum + detail.storageVolume, 0)
      return {
        ...row,
        totalProductionStorageVolume,
        totalConsumptionStorageVolume,
        totalRequiredStorageVolume: Math.max(totalProductionStorageVolume, totalConsumptionStorageVolume),
        details: [...row.details].sort((a, b) => {
          const orderA = Number(a.sortOrder)
          const orderB = Number(b.sortOrder)
          if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) return orderA - orderB
          return b.storageVolume - a.storageVolume
        })
      }
    })
    .filter((item) => item.totalRequiredStorageVolume > 0)
    .sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
      if (a.tier !== b.tier) return b.tier - a.tier
      return a.wareId.localeCompare(b.wareId)
    })
}

const props = withDefaults(defineProps<{
  productionFlows: WareProductionFlow[]
  viewMode?: SharedViewMode
  buyMultiplier?: number
  sellMultiplier?: number
  productBufferHours?: number
}>(), {
  viewMode: 'quantity',
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  productBufferHours: 12
})

const emit = defineEmits<{
  (e: 'update:viewMode', value: SharedViewMode): void
  (e: 'update:buyMultiplier', value: number): void
  (e: 'update:sellMultiplier', value: number): void
  (e: 'update:productBufferHours', value: number): void
}>()

const viewMode = computed<SharedViewMode>({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
})

const localBuyMultiplier = computed({
  get: () => props.buyMultiplier,
  set: (value) => emit('update:buyMultiplier', value)
})

const localSellMultiplier = computed({
  get: () => props.sellMultiplier,
  set: (value) => emit('update:sellMultiplier', value)
})

const localProductBufferHours = computed({
  get: () => props.productBufferHours,
  set: (value) => emit('update:productBufferHours', value)
})

const groupedFlows = computed(() => {
  const buyMultiplier = localBuyMultiplier.value
  const sellMultiplier = localSellMultiplier.value
  const flows = props.productionFlows.map((flow) => {
    const ware = gameData.waresMap?.[flow.wareId]
    const isSurplus = flow.netRate >= 0
    const unitPrice = getPriceByMultiplier(
      ware?.minPrice || 0,
      ware?.price || 0,
      ware?.maxPrice || 0,
      isSurplus ? sellMultiplier : buyMultiplier
    )
    return {
      ...flow,
      unitPrice,
      netValue: flow.netRate * unitPrice,
      contributions: (flow.stationContributions || []).map((detail, index) => ({
        ...detail,
        sortOrder: index,
        netValue: detail.netRate * unitPrice
      }))
    }
  })

  const products = flows.filter((flow) => flow.netRate > 0)
  const operations = flows.filter((flow) => flow.netRate <= 0 && flow.workforceConsumption <= 0 && flow.transportType === 'container')
  const supply = flows.filter((flow) => flow.workforceConsumption > 0 || flow.transportType !== 'container')

  return { flows, products, operations, supply }
})
const storageFlows = computed(() => buildStorageFlowsFromProductionFlows(props.productionFlows, localProductBufferHours.value))

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
  const products = groupedFlows.value.products
  const operations = groupedFlows.value.operations
  const supply = groupedFlows.value.supply
  const supplyValue = supply.reduce((sum, item) => sum + item.netValue, 0)

  return {
    quantity: [
      { key: 'products', title: t('wareflow.products_group'), items: products.map(wrapFlow) },
      { key: 'operations', title: t('wareflow.operations_group'), items: operations.map(wrapFlow) },
      { key: 'supply', title: t('wareflow.supply_group'), items: supply.map(wrapFlow) }
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
        items: supply.map(wrapFlow),
        sumText: formatSignedAbs(supplyValue),
        sumClass: supplyValue >= 0 ? 'positive' : 'negative'
      }
    ]
  }
})

const hasFlowData = computed(() => groupedFlows.value.flows.length > 0)

const storageItems = computed(() =>
  storageFlows.value.map((flow) => ({
    ...flow,
    name: wrapFlow({ wareId: flow.wareId }).name
  })).filter((item) => item.totalRequiredStorageVolume > 0)
)
const storageTotalVolume = computed(() =>
  storageItems.value.reduce((sum, item) => sum + item.totalRequiredStorageVolume, 0)
)
const hasStorageData = computed(() => storageItems.value.length > 0)

const transportItems = computed(() =>
  storageFlows.value.map((storageFlow) => {
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
  <div class="list-wrapper" data-testid="transit-hub-center-dashboard">
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
        <PriceSlider v-model="localBuyMultiplier" :label="t('wareflow.buy_multiplier')" type="buy" />
        <PriceSlider v-model="localSellMultiplier" :label="t('wareflow.sell_multiplier')" type="sell" />
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
