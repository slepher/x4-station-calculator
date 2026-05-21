<script setup lang="tsx">
import { computed } from 'vue'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useWareFlowGrouping } from './composables/useWareFlowGrouping'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { DerivedProductionFlow } from '@/types/production-flow'
import type { LiveCargoOnlyItem, LiveVolumeAllocationGroup } from '@/types/production-workbench-contract'

import PriceSlider from '@/components/common/PriceSlider.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'
import StationWareFlowGroup from './StationWareFlowGroup.vue'
import EmpireWareFlowGroup from './EmpireWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'
import LiveStationAllocationView from './LiveStationAllocationView.vue'

const props = defineProps<{
  visualMode?: 'planning' | 'live'
  viewMode: WareFlowViewMode
  useAllocationVolumeView?: boolean
  productionFlows: DerivedProductionFlow[]
  liveVolumeAllocationGroups?: LiveVolumeAllocationGroup[]
  liveCargoOnlyItems?: LiveCargoOnlyItem[]
  warePriorityLevels: Record<string, number>
  settings: {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }
  empireGaps: {
    operations: EmpireGapItem[]
    supply: EmpireGapItem[]
  }
  isWareLocked?: (wareId: string) => boolean
  getResolvedLevel?: (wareId: string) => number
  isWareOperable?: (wareId: string) => boolean
  isPlannedWare?: (wareId: string) => boolean
  onToggleWareLock?: (wareId: string) => void
  onToggleWarePriority?: (wareId: string) => void
}>()

const emit = defineEmits<{
  updateViewMode: [value: WareFlowViewMode]
  updateResourceBufferHours: [value: number]
  updatePrimaryProductBufferHours: [value: number]
  updateSecondaryProductBufferHours: [value: number]
  updateBuyMultiplier: [value: number]
  updateSellMultiplier: [value: number]
  addGapModule: [wareId: string]
  removeGapModule: [wareId: string]
}>()

const gameDataStore = useGameDataStore()
const { t, locale } = useI18n()
const { translateWare } = useX4I18n()
const { computeGroupedFlows } = useWareFlowGrouping()

const groupedFlows = computed(() => computeGroupedFlows({
  productionFlows: props.productionFlows
}))

const viewMode = computed<WareFlowViewMode>({
  get: () => props.viewMode,
  set: (value) => emit('updateViewMode', value)
})

const resourceBufferHours = computed({
  get: () => props.settings.resourceBufferHours,
  set: (val: number) => emit('updateResourceBufferHours', val)
})
const primaryProductBufferHours = computed({
  get: () => props.settings.primaryProductBufferHours,
  set: (val: number) => emit('updatePrimaryProductBufferHours', val)
})
const secondaryProductBufferHours = computed({
  get: () => props.settings.secondaryProductBufferHours,
  set: (val: number) => emit('updateSecondaryProductBufferHours', val)
})
const buyMultiplier = computed({
  get: () => props.settings.buyMultiplier,
  set: (val: number) => emit('updateBuyMultiplier', val)
})
const sellMultiplier = computed({
  get: () => props.settings.sellMultiplier,
  set: (val: number) => emit('updateSellMultiplier', val)
})

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const wrapFlow = (flow: any) => {
  const wareInfo = gameDataStore.waresMap[flow.wareId]
  return {
    ...flow,
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId
  }
}

const hasEmpireGapItems = computed(() =>
  props.empireGaps.operations.length > 0 || props.empireGaps.supply.length > 0
)

const empireGapProducts = computed(() =>
  props.empireGaps.operations.filter(f => f.netRate > 0).map(wrapFlow)
)
const empireGapOperations = computed(() =>
  props.empireGaps.operations.filter(f => f.netRate <= 0).map(wrapFlow)
)
const empireGapSupply = computed(() =>
  props.empireGaps.supply.map(wrapFlow)
)

const totalProfit = computed(() => {
  return groupedFlows.value.flows.reduce((sum, flow) => sum + flow.netValue, 0)
})

const getGroupVolume = (group: any[]) => 
  formatNum(group.reduce((sum, item) => sum + Math.abs(item.totalOccupiedVolume || 0), 0))

const getGroupTransport = (group: any[]) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(group.reduce((sum, item) => sum + Math.abs(item.transportDemand || 0), 0))

const getGroupSymboledValue = (group: any[]) => {
  const value = group.reduce((sum, item) => sum + Math.abs(item.netValue || 0), 0)
  const symbol = value >= 0 ? '+' : '-'
  return symbol + formatNum(Math.abs(value))
}

const handleAddModule = (wareId: string) => {
  emit('addGapModule', wareId)
}

const handleRemoveModule = (wareId: string) => {
  emit('removeGapModule', wareId)
}

const title = () => {
  if (viewMode.value === 'quantity') {
    return t('wareflow.resource_view')
  } else if (viewMode.value === 'economy') {
    return t('wareflow.economy_view')
  } else if (viewMode.value === 'transport') {
    return t('wareflow.transport_view')
  } else {
    return t('station.header_volume')
  }
}

const views = computed<{key: WareFlowViewMode; label: string}[]>(() => {
  locale.value
  return [
    {key: 'quantity', label: t('wareflow.quantity_view')},
    {key: 'economy', label: t('wareflow.economy_view')},
    {key: 'volume', label: t('wareflow.volume_view')},
    {key: 'transport', label: t('wareflow.transport_view')}
  ]
})

const volumeGroups = computed(() => [
  {key: 'container', title: t('wareflow.container_group'),
   items: groupedFlows.value.volumeGroups.container.map(wrapFlow)},
  {key: 'solid', title: t('wareflow.solid_group'),
   items: groupedFlows.value.volumeGroups.solid.map(wrapFlow)},
  {key: 'liquid', title: t('wareflow.liquid_group'),
   items: groupedFlows.value.volumeGroups.liquid.map(wrapFlow)}
])

const transportGroups = computed(() => [
  {key: 'container', title: t('wareflow.container_group'),
   items: groupedFlows.value.volumeGroups.container.filter(f => (f.transportDemand || 0) > 0).map(wrapFlow)},
  {key: 'solid', title: t('wareflow.solid_group'),
   items: groupedFlows.value.volumeGroups.solid.filter(f => (f.transportDemand || 0) > 0).map(wrapFlow)},
  {key: 'liquid', title: t('wareflow.liquid_group'),
   items: groupedFlows.value.volumeGroups.liquid.filter(f => (f.transportDemand || 0) > 0).map(wrapFlow)}
])

const rateGroups = computed(() => ([
  {key: 'positive',
   symbolClass: "positive",
   title: viewMode.value === 'economy'
     ? t('wareflow.income_group')
     : t('wareflow.products_group'),
   items: groupedFlows.value.rateGroups.positive.map(wrapFlow)},
  {key: 'operations',
   symbolClass: "negative",
   title: viewMode.value === 'economy'
     ? t('wareflow.expenses_operations_group')
     : t('wareflow.operations_group'),
   items: groupedFlows.value.rateGroups.operations.map(wrapFlow)},
  {key: 'supply',
   symbolClass: "negative",
   title: viewMode.value === 'economy'
     ? t('wareflow.expenses_supply_group')
     : t('wareflow.supply_group'),
   items: groupedFlows.value.rateGroups.supply.map(wrapFlow)},
  {key: 'resources', 
   symbolClass: "negative",
   title: viewMode.value === 'economy'
     ? t('wareflow.expenses_resources_group')
     : t('wareflow.resources_group'),
   items: groupedFlows.value.rateGroups.resources.map(wrapFlow)}
]))

const hasFlowData = computed(() => groupedFlows.value.flows.length > 0)
const isAllocationVolumeMode = computed(() =>
  viewMode.value === 'volume' && (props.useAllocationVolumeView ?? props.visualMode === 'live')
)
const hasLiveAllocationData = computed(() =>
  (props.liveVolumeAllocationGroups?.some((group) => group.items.length > 0) || false)
  || (props.liveCargoOnlyItems?.length || 0) > 0
)
</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ title() }}
      </h3>

      <div class="header-right-group">
        <ViewTabUi v-model="viewMode" :views="views" color-style="sky" ui-key="station-wareflow" />
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <LiveStationAllocationView
        v-if="isAllocationVolumeMode"
        :groups="props.liveVolumeAllocationGroups || []"
        :cargo-only-items="props.liveCargoOnlyItems || []"
        :is-ware-locked="props.isWareLocked"
        :get-resolved-level="props.getResolvedLevel"
        :is-ware-operable="props.isWareOperable"
        :is-planned-ware="props.isPlannedWare"
        :on-toggle-ware-lock="props.onToggleWareLock"
        :on-toggle-ware-priority="props.onToggleWarePriority"
        :resource-buffer-hours="props.settings.resourceBufferHours"
        :primary-product-buffer-hours="props.settings.primaryProductBufferHours"
        :secondary-product-buffer-hours="props.settings.secondaryProductBufferHours"
      />

      <div v-else-if="viewMode === 'volume'" class="volume-groups-container" data-testid="volume-groups">
        <StationWareFlowGroup v-for="(group, index) in volumeGroups" :key="index"
            :title="group.title"
            :items="group.items"
            :viewMode="viewMode"
            :isWareLocked="props.isWareLocked"
            :getResolvedLevel="props.getResolvedLevel"
            :isWareOperable="props.isWareOperable"
            :isPlannedWare="props.isPlannedWare"
            :transportMinutes="props.settings.transportMinutes"
            :resourceBufferHours="props.settings.resourceBufferHours"
            :primaryProductBufferHours="props.settings.primaryProductBufferHours"
            :secondaryProductBufferHours="props.settings.secondaryProductBufferHours"
            :onToggleWareLock="props.onToggleWareLock"
            :onToggleWarePriority="props.onToggleWarePriority"
        >
          <span class="volume-group-planning" data-testid="volume-group-planning">
            {{ getGroupVolume(group.items) }}m³
          </span>
          <svg class="w-3.5 h-3.5 text-blue-300/60" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        </StationWareFlowGroup>
      </div>
      
      <div v-if="viewMode === 'transport'" class="volume-groups-container">
        <StationWareFlowGroup v-for="group in transportGroups" :key="group.key"
          :title="group.title"
          :items="group.items"
          :viewMode="viewMode"
          :isWareLocked="props.isWareLocked"
          :getResolvedLevel="props.getResolvedLevel"
          :isWareOperable="props.isWareOperable"
          :isPlannedWare="props.isPlannedWare"
          :transportMinutes="props.settings.transportMinutes"
          :resourceBufferHours="props.settings.resourceBufferHours"
          :primaryProductBufferHours="props.settings.primaryProductBufferHours"
          :secondaryProductBufferHours="props.settings.secondaryProductBufferHours"
          :onToggleWareLock="props.onToggleWareLock"
          :onToggleWarePriority="props.onToggleWarePriority"
        >
            <div class="transport-group-value" data-testid="transport-group-value">
            <span class="transport-group-sum" data-testid="transport-group-sum">
              {{ getGroupTransport(group.items) }}m³
            </span>
            <svg
              class="w-3.5 h-3.5 text-blue-300/70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="1" y="3" width="15" height="13"></rect>
              <path d="M16 8h4l3 3v5h-7z"></path>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
        </StationWareFlowGroup>
      </div>

      <div v-if="viewMode === 'economy' || viewMode === 'quantity'" class="volume-groups-container">
          <div v-if="props.settings.showEmpireGaps && viewMode === 'quantity' && hasEmpireGapItems" class="empire-gap-groups">
            <div v-if="empireGapProducts.length > 0" class="empire-gap-group">
              <EmpireWareFlowGroup
                :title="t('wareflow.sector_products')"
                :items="empireGapProducts"
                :viewMode="viewMode"
                :showAddButton="true"
                :showRemoveButton="true"
                @add="handleAddModule"
                @remove="handleRemoveModule"
              />
            </div>
            <div v-if="empireGapOperations.length > 0" class="empire-gap-group">
              <EmpireWareFlowGroup
                :title="t('wareflow.sector_operations')"
                :items="empireGapOperations"
                :viewMode="viewMode"
                :showAddButton="true"
                :showRemoveButton="true"
                @add="handleAddModule"
                @remove="handleRemoveModule"
              />
            </div>
            <div v-if="empireGapSupply.length > 0" class="empire-gap-group">
              <EmpireWareFlowGroup
                :title="t('wareflow.sector_supply')"
                :items="empireGapSupply"
                :viewMode="viewMode"
                :showAddButton="true"
                :showRemoveButton="true"
                @add="handleAddModule"
                @remove="handleRemoveModule"
              />
            </div>
          </div>
          <StationWareFlowGroup v-for="group in rateGroups" :key="group.key"
            :title="group.title" 
            :items="group.items" 
            :viewMode="viewMode"
            :isWareLocked="props.isWareLocked"
            :getResolvedLevel="props.getResolvedLevel"
            :isWareOperable="props.isWareOperable"
            :isPlannedWare="props.isPlannedWare"
            :transportMinutes="props.settings.transportMinutes"
            :resourceBufferHours="props.settings.resourceBufferHours"
            :primaryProductBufferHours="props.settings.primaryProductBufferHours"
            :secondaryProductBufferHours="props.settings.secondaryProductBufferHours"
            :onToggleWareLock="props.onToggleWareLock"
            :onToggleWarePriority="props.onToggleWarePriority"
          > 
            <span v-if="viewMode === 'economy'" :class="['economy-group-sum', group.symbolClass]" data-testid="economy-group-sum"> 
              {{ getGroupSymboledValue(group.items) }} Cr 
            </span> 
          </StationWareFlowGroup>
        <EmptyState v-if="viewMode === 'economy' && groupedFlows.flows.length === 0" />
      </div>

      <EmptyState v-if="groupedFlows.flows.length === 0 && viewMode !== 'economy' && !isAllocationVolumeMode" />
      <EmptyState v-if="isAllocationVolumeMode && !hasLiveAllocationData" />
    </div>

    <div class="volume-controls-section" v-if="hasFlowData && viewMode === 'volume'">
      <div class="simulation-controls flex flex-row gap-4">
        <VolumeControlSlider
          v-model="resourceBufferHours"
          :label="t('wareflow.resource_buffer_hours')"
          type="resource"
          :max="24"
          :step="1" />
        <VolumeControlSlider
          v-model="primaryProductBufferHours"
          :label="t('wareflow.primary_product_buffer_hours')"
          type="product"
          :max="24"
          :step="1" />
        <VolumeControlSlider
          v-model="secondaryProductBufferHours"
          :label="t('wareflow.secondary_product_buffer_hours')"
          type="product"
          :max="24"
          :step="1" />
      </div>
    </div>

    <div class="profit-section" v-if="hasFlowData && viewMode === 'economy'" data-testid="profit-section">
      <div class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="buyMultiplier" :label="t('wareflow.res_price')" type="buy" />
        <PriceSlider v-model="sellMultiplier" :label="t('wareflow.prod_price')" type="sell" />
      </div>

      <div class="profit-footer">
        <span class="profit-label">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
          {{ t('wareflow.profit_footer') }}
        </span>
        <span class="profit-val" :class="totalProfit >= 0 ? 'positive' : 'negative'" data-testid="profit-val">
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

.volume-controls-section, .profit-section {
  @apply border-t border-slate-700/50;
}

.simulation-controls {
  @apply p-4 bg-slate-900/50 border-b border-slate-700/50;
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

.volume-group-planning {
  @apply text-sm font-mono text-blue-400;
}

.transport-group-sum {
  @apply text-sm font-mono font-bold text-blue-300;
}

.transport-group-value {
  @apply flex items-center gap-2;
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

.empire-gap-groups {
  @apply space-y-1;
}

.empire-gap-group {
  @apply contents;
}
</style>
