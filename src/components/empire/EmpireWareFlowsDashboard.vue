<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import type { DerivedProductionFlow } from '@/types/production-flow'
import { classifyAndEnrichFlows } from '@/store/logic/empireFlowFacade'
import { deriveEmpireWareFlows } from '@/store/logic/deriveEmpireWareFlowView'
import EmpireWareFlowGroup from './EmpireWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'
import PriceSlider from '@/components/common/PriceSlider.vue'

const props = withDefaults(defineProps<{
  productionFlows: DerivedProductionFlow[]
  buyMultiplier?: number
  sellMultiplier?: number
}>(), {
  productionFlows: () => [],
  buyMultiplier: 0.5,
  sellMultiplier: 0.5
})

const emit = defineEmits<{
  (e: 'update:buyMultiplier', value: number): void
  (e: 'update:sellMultiplier', value: number): void
}>()

const gameData = useGameDataStore()
const { t } = useI18n()
const { translateWare } = useX4I18n()

type ViewMode = 'quantity' | 'economy'

const viewMode = ref<ViewMode>('quantity')

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const empireGroupedFlows = computed(() =>
  classifyAndEnrichFlows(props.productionFlows, gameData.waresMap)
)

const derivedEmpireGroupedFlows = computed(() => deriveEmpireWareFlows({
  groupedFlows: empireGroupedFlows.value,
  waresMap: gameData.waresMap,
  buyMultiplier: props.buyMultiplier,
  sellMultiplier: props.sellMultiplier
}))

const localBuyMultiplier = computed({
  get: () => props.buyMultiplier,
  set: (val) => emit('update:buyMultiplier', val)
})

const localSellMultiplier = computed({
  get: () => props.sellMultiplier,
  set: (val) => emit('update:sellMultiplier', val)
})

function wrapFlowWithPrice(flow: any) {
  const wareInfo = gameData.waresMap?.[flow.wareId]
  return {
    ...flow,
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId
  }
}

const totalProfit = computed(() => {
  return derivedEmpireGroupedFlows.value.flows.reduce((sum, flow) => sum + flow.netValue, 0)
})
const hasFlowData = computed(() => empireGroupedFlows.value.flows.length > 0)

const getGroupSymboledValue = (group: Array<{ netValue: number }>) => {
  const value = group.reduce((sum, item) => sum + Math.abs(item.netValue), 0)
  const symbol = value >= 0 ? '+' : '-'
  return symbol + formatNum(Math.abs(value))
}

const views = computed(() => [
  { key: 'quantity' as const, label: t('wareflow.quantity_view') },
  { key: 'economy' as const, label: t('wareflow.economy_view') }
])

const empireGroups = computed(() => {
  const groups = derivedEmpireGroupedFlows.value.empireGroups
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
      items: products.map(wrapFlowWithPrice)
    },
    {
      key: 'operations',
      symbolClass: 'negative',
      title: viewMode.value === 'economy' ? t('wareflow.operations_expense_group') : t('wareflow.operations_group'),
      items: operations.map(wrapFlowWithPrice)
    },
    {
      key: 'supply',
      symbolClass: groups.supply.reduce((sum, item) => sum + item.netValue, 0) >= 0 ? 'positive' : 'negative',
      title: getSupplyTitle(),
      items: groups.supply.map(wrapFlowWithPrice)
    }
  ]
})
</script>

<template>
  <div class="list-wrapper" data-testid="empire-wareflow-dashboard">
    <div class="list-header">
      <h3 class="header-title">
        {{ viewMode === 'quantity' ? t('wareflow.resource_view') : t('wareflow.economy_view') }}
      </h3>

      <div class="header-right-group">
        <ViewTabUi v-model="viewMode" :views="views" color-style="sky" ui-key="empire-wareflow" />
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <div class="volume-groups-container">
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
        <EmptyState v-if="empireGroupedFlows.flows.length === 0" />
      </div>
    </div>

    <div class="profit-section" v-if="hasFlowData && viewMode === 'economy'">
      <div class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="localBuyMultiplier" :label="t('wareflow.buy_multiplier')" type="buy" />
        <PriceSlider v-model="localSellMultiplier" :label="t('wareflow.sell_multiplier')" type="sell" />
      </div>

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

.simulation-controls {
  @apply px-4 py-3 bg-slate-800/30 border-b border-slate-700/50;
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
