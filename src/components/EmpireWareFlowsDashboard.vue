<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import type { EmpireGroupedFlows, SupplyStorageFlow } from '@/types/x4'
import EmpireWareFlowGroup from './EmpireWareFlowGroup.vue'
import SupplyStorageFlowItem from './SupplyStorageFlow.vue'
import SupplyTransportFlowItem from './SupplyTransportFlow.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'

const props = withDefaults(defineProps<{
  groupedFlows?: EmpireGroupedFlows | null
  enableStorageView?: boolean
  enableTransportView?: boolean
  supplyStorageFlows?: SupplyStorageFlow[]
}>(), {
  groupedFlows: null,
  enableStorageView: false,
  enableTransportView: false,
  supplyStorageFlows: () => []
})

const empireStore = useEmpireStore()
const gameData = useGameDataStore()
const { t } = useI18n()
const { translateWare } = useX4I18n()

type ViewMode = 'quantity' | 'economy' | 'storage' | 'transport'

const viewMode = ref<ViewMode>('quantity')

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const empireGroupedFlows = computed(() => props.groupedFlows || empireStore.empireGroupedFlows)

const wrapFlow = (flow: any) => {
  const wareInfo = gameData.waresMap?.[flow.wareId]
  return {
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId,
    ...flow
  }
}

const totalProfit = computed(() => {
  return empireGroupedFlows.value.flows.reduce((sum, flow) => sum + flow.netValue, 0)
})
const hasFlowData = computed(() => empireGroupedFlows.value.flows.length > 0)

const getGroupSymboledValue = (group: any[]) => {
  const value = group.reduce((sum, item) => sum + Math.abs(item.netValue || 0), 0)
  const symbol = value >= 0 ? '+' : '-'
  return symbol + formatNum(Math.abs(value))
}

const title = () => {
  if (viewMode.value === 'quantity') {
    return t('wareflow.resource_view')
  } else if (viewMode.value === 'storage') {
    return t('wareflow.volume_view')
  } else if (viewMode.value === 'transport') {
    return t('wareflow.transport_view')
  } else {
    return t('wareflow.economy_view')
  }
}

const views = computed<{key: ViewMode; label: string}[]>(() => {
  const base: {key: ViewMode; label: string}[] = [
    { key: 'quantity', label: t('wareflow.quantity_view') },
    { key: 'economy', label: t('wareflow.economy_view') }
  ]
  if (props.enableStorageView) {
    base.push({ key: 'storage', label: t('wareflow.volume_view') })
  }
  if (props.enableTransportView) {
    base.push({ key: 'transport', label: t('wareflow.transport_view') })
  }
  return base
})

const empireGroups = computed(() => {
  const groups = empireGroupedFlows.value.empireGroups
  const products = groups.operations.filter(item => item.netRate > 0)
  const operations = groups.operations.filter(item => item.netRate <= 0)
  
  const getSupplyTitle = () => {
    const supplyValue = groups.supply.reduce((sum, item) => sum + item.netValue, 0)
    return viewMode.value === 'economy' 
      ? (supplyValue >= 0 ? t('wareflow.supply_income_group') : t('wareflow.supply_expense_group'))
      : t('wareflow.supply_group')
  }
  
  return [
    {
      key: 'products',
      symbolClass: 'positive',
      title: viewMode.value === 'economy' ? t('wareflow.products_income_group') : t('wareflow.products_group'),
      items: products.map(wrapFlow)
    },
    {
      key: 'operations',
      symbolClass: 'negative',
      title: viewMode.value === 'economy' ? t('wareflow.operations_expense_group') : t('wareflow.operations_group'),
      items: operations.map(wrapFlow)
    },
    {
      key: 'supply',
      symbolClass: groups.supply.reduce((sum, item) => sum + item.netValue, 0) >= 0 ? 'positive' : 'negative',
      title: getSupplyTitle(),
      items: groups.supply.map(wrapFlow)
    }
  ]
})

const storageFlows = computed(() => props.supplyStorageFlows || [])
const hasStorageData = computed(() => storageFlows.value.length > 0)
const storageTotalVolume = computed(() =>
  storageFlows.value.reduce((sum, item) => sum + item.totalRequiredStorageVolume, 0)
)
const formatVolume = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

const getWareName = (wareId: string) => {
  const ware = gameData.waresMap?.[wareId]
  return ware ? translateWare(ware) : wareId
}

const transportFlows = computed(() => {
  const flowByWareId = new Map(empireGroupedFlows.value.flows.map((flow) => [flow.wareId, flow]))
  return storageFlows.value.map((storageFlow) => {
    const source = flowByWareId.get(storageFlow.wareId)
    if (!source) {
      return {
        wareId: storageFlow.wareId,
        totalTransportVolume: 0,
        details: []
      }
    }
    const details = source.contributions
      .map((detail) => ({
        stationId: detail.stationId,
        stationName: detail.stationName,
        stationCount: detail.stationCount,
        transportVolume: Math.abs(detail.netRate) * source.unitVolume
      }))
      .filter((detail) => detail.transportVolume > 0)
    const totalTransportVolume = details.reduce((sum, detail) => sum + detail.transportVolume, 0)
    return {
      wareId: storageFlow.wareId,
      totalTransportVolume,
      details
    }
  })
})

const hasTransportData = computed(() =>
  transportFlows.value.some((item) => item.totalTransportVolume > 0)
)
const transportTotalVolume = computed(() =>
  transportFlows.value.reduce((sum, item) => sum + item.totalTransportVolume, 0)
)
</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ title() }}
      </h3>

      <div class="header-right-group">
        <ViewTabUi v-model="viewMode" :views="views" color-style="sky" ui-key="empire-wareflow" />
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <div v-if="viewMode === 'quantity' || viewMode === 'economy'" class="volume-groups-container">
        <EmpireWareFlowGroup 
          v-for="group in empireGroups" 
          :key="group.key"
          :title="group.title" 
          :items="group.items" 
          :viewMode="viewMode" 
        >
          <span v-if="viewMode === 'economy'" :class="['economy-group-sum', group.symbolClass]">
            {{ getGroupSymboledValue(group.items) }} Cr
          </span>
        </EmpireWareFlowGroup>
        <EmptyState v-if="viewMode === 'economy' && empireGroupedFlows.flows.length === 0" />
      </div>

      <div v-if="viewMode === 'storage'" class="volume-groups-container">
        <div class="storage-group-header">
          <h4 class="storage-group-title">{{ t('wareflow.volume_view') }}</h4>
          <span class="storage-group-value">
            {{ formatVolume(storageTotalVolume) }}m³
            <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
          </span>
        </div>
        <SupplyStorageFlowItem
          v-for="item in storageFlows"
          :key="item.wareId"
          :resource-id="item.wareId"
          :name="getWareName(item.wareId)"
          :unit-volume="item.unitVolume"
          :total-required-storage-volume="item.totalRequiredStorageVolume"
          :details="item.details"
        />
      </div>

      <div v-if="viewMode === 'transport'" class="volume-groups-container">
        <div class="storage-group-header">
          <h4 class="storage-group-title">{{ t('wareflow.transport_view') }}</h4>
          <span class="storage-group-value">
            {{ formatVolume(transportTotalVolume) }}m³
            <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <path d="M16 8h4l3 3v5h-7z"></path>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </span>
        </div>
        <SupplyTransportFlowItem
          v-for="item in transportFlows"
          :key="item.wareId"
          :resource-id="item.wareId"
          :name="getWareName(item.wareId)"
          :total-transport-volume="item.totalTransportVolume"
          :details="item.details"
        />
      </div>

      <EmptyState v-if="viewMode === 'quantity' && empireGroupedFlows.flows.length === 0" />
      <EmptyState v-if="viewMode === 'storage' && !hasStorageData" />
      <EmptyState v-if="viewMode === 'transport' && !hasTransportData" />
    </div>

    <div class="profit-section" v-if="hasFlowData && viewMode === 'economy'">
      <div class="profit-footer">
        <span class="profit-label">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
          {{ t('wareflow.profit_footer') }}
        </span>
        <span class="profit-val" :class="totalProfit >= 0 ? 'positive' : 'negative'">
          {{ formatNum(totalProfit) }} Cr
        </span>
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

.header-badge {
  @apply px-2 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400 font-bold uppercase tracking-tighter;
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

.profit-section {
  @apply border-t border-slate-700/50;
}

.profit-footer {
  @apply flex justify-between px-4 py-4 bg-slate-900 border-t border-slate-600;
}

.profit-label {
  @apply text-emerald-400 flex items-center gap-2 font-black uppercase text-xs italic;
}

.profit-val {
  @apply font-mono text-emerald-400 text-lg font-black;
}

.profit-val.positive {
  @apply text-emerald-400;
}

.profit-val.negative {
  @apply text-red-400;
}

.volume-groups-container {
  @apply space-y-1;
}

.storage-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.storage-group-title {
  @apply text-sm font-bold text-slate-300;
}

.storage-group-value {
  @apply text-sm font-mono text-blue-300 flex items-center gap-2;
}

.economy-group-sum {
  @apply text-sm font-mono font-bold;
}

.economy-group-sum.positive {
  @apply text-emerald-400;
}

.economy-group-sum.negative {
  @apply text-red-400;
}
</style>
