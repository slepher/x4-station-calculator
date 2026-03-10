<script setup lang="tsx">
import { computed, ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { getSectorNetworkComponent, type SectorLinkInput } from '@/store/logic/sectorLinkFlow'
import { parseSectorLinkKey } from '@/store/logic/sectorLinks'
import { useI18n } from 'vue-i18n';

import PriceSlider from '@/components/common/PriceSlider.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'
import StationWareFlowGroup from './StationWareFlowGroup.vue'
import EmpireWareFlowGroup from './EmpireWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ViewTabUi from '@/components/common/ViewTabUI.vue'

const store = useStationStore()
const empireStore = useEmpireStore()
const gameData = useGameDataStore()
const { t, locale } = useI18n();
const { translateWare } = useX4I18n()

type ViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

// 视图模式状态管理
const viewMode = ref<ViewMode>('quantity')

// 格式化函数
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

// 从store获取已排序和分组好的数据
const groupedFlows = computed(() => store.groupedFlows)
const resourceBufferHours = computed({
  get: () => store.settings.resourceBufferHours,
  set: (val: number) => store.updateSetting('resourceBufferHours', val)
})
const primaryProductBufferHours = computed({
  get: () => store.settings.primaryProductBufferHours,
  set: (val: number) => store.updateSetting('primaryProductBufferHours', val)
})
const secondaryProductBufferHours = computed({
  get: () => store.settings.secondaryProductBufferHours,
  set: (val: number) => store.updateSetting('secondaryProductBufferHours', val)
})
const buyMultiplier = computed({
  get: () => store.settings.buyMultiplier,
  set: (val: number) => store.updateSetting('buyMultiplier', val)
})
const sellMultiplier = computed({
  get: () => store.settings.sellMultiplier,
  set: (val: number) => store.updateSetting('sellMultiplier', val)
})

// 辅助函数：为UI提供名称翻译后的包装对象
const wrapFlow = (flow: any) => {
  const wareInfo = store.wares[flow.wareId]
  return {
    id: flow.wareId,
    name: wareInfo ? translateWare(wareInfo) : flow.wareId,
    ...flow
  }
}

const getModuleForWare = (wareId: string) =>
  gameData.findModuleForWare(wareId, store.settings.racePreference)

const getPlannedModuleIndex = (moduleId: string) =>
  store.plannedModules.findIndex(module => module.id === moduleId)

const empireFlowByWareId = computed(() => {
  const map = new Map<string, any>()
  const groups = empireStore.empireGroupedFlows.empireGroups
  groups.operations.forEach(flow => map.set(flow.wareId, flow))
  groups.supply.forEach(flow => map.set(flow.wareId, flow))
  return map
})

const componentGapFlows = computed(() => {
  const activeStation = empireStore.activeStation
  const currentSectorId = activeStation?.sectorId || ''
  if (!currentSectorId) {
    return {
      operations: [] as any[],
      supply: [] as any[]
    }
  }

  const sectorIds = empireStore.sectors.map((sector) => sector.id)
  const links: SectorLinkInput[] = (empireStore.sectorLinks || [])
    .map((key) => parseSectorLinkKey(key))
    .filter((item): item is { a: string; b: string } => !!item)
    .map((item) => ({
      linkId: `${item.a}|${item.b}`,
      a: item.a,
      b: item.b,
      distance: 1
    }))
  const component = getSectorNetworkComponent(currentSectorId, sectorIds, links)
  if (!component) {
    return {
      operations: [] as any[],
      supply: [] as any[]
    }
  }

  const sectorNameMap = new Map(empireStore.sectors.map((sector) => [sector.id, sector.name]))
  const sectorOrderMap = new Map(empireStore.sectors.map((sector, index) => [sector.id, index]))
  const currentSectorStationOrderMap = new Map(
    empireStore.orderedStationsBySector
      .filter((station) => station.sectorId === currentSectorId)
      .map((station, index) => [station.id, index])
  )
  const operationsByWare = new Map<string, any>()
  const supplyByWare = new Map<string, any>()

  const appendFlow = (bucket: Map<string, any>, flow: any, contributions: any[]) => {
    const current = bucket.get(flow.wareId)
    if (!current) {
      bucket.set(flow.wareId, {
        ...flow,
        contributions: [...contributions]
      })
      return
    }
    current.production += flow.production || 0
    current.consumption += flow.consumption || 0
    current.workforceConsumption += flow.workforceConsumption || 0
    current.netRate += flow.netRate || 0
    current.netValue += flow.netValue || 0
    current.contributions.push(...contributions)
  }

  component.sectorIds.forEach((sectorId) => {
    const internal = empireStore.getSectorInternalData(sectorId)
    const localFlows = internal.localGroupedFlows
    const sectorName = sectorNameMap.get(sectorId) || sectorId
    const isCurrentSector = sectorId === currentSectorId

    localFlows.empireGroups.operations
      .filter((flow: any) => flow.transportType === 'container')
      .forEach((flow: any) => {
        const contributions = isCurrentSector
          ? (flow.contributions || []).map((detail: any) => ({
              ...detail,
              sortOrder: currentSectorStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2
            }))
          : [{
              stationId: `sector:${sectorId}`,
              stationName: sectorName,
              stationCount: 1,
              production: Math.max(flow.netRate || 0, 0),
              consumption: Math.max(-(flow.netRate || 0), 0),
              workforceConsumption: flow.workforceConsumption || 0,
              netRate: flow.netRate || 0,
              netValue: flow.netValue || 0,
              sortOrder: 100000 + (sectorOrderMap.get(sectorId) ?? Number.MAX_SAFE_INTEGER / 2)
            }]
        appendFlow(operationsByWare, flow, contributions)
      })

    localFlows.empireGroups.supply
      .filter((flow: any) => flow.transportType === 'container')
      .forEach((flow: any) => {
        const contributions = isCurrentSector
          ? (flow.contributions || []).map((detail: any) => ({
              ...detail,
              sortOrder: currentSectorStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2
            }))
          : [{
              stationId: `sector:${sectorId}`,
              stationName: sectorName,
              stationCount: 1,
              production: Math.max(flow.netRate || 0, 0),
              consumption: Math.max(-(flow.netRate || 0), 0),
              workforceConsumption: flow.workforceConsumption || 0,
              netRate: flow.netRate || 0,
              netValue: flow.netValue || 0,
              sortOrder: 100000 + (sectorOrderMap.get(sectorId) ?? Number.MAX_SAFE_INTEGER / 2)
            }]
        appendFlow(supplyByWare, flow, contributions)
      })
  })

  const sortFlows = (list: any[]) =>
    list.sort((a, b) => {
      if ((a.orderIndex ?? 0) !== (b.orderIndex ?? 0)) return (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      if ((a.tier ?? 0) !== (b.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0)
      return Math.abs(b.netRate || 0) - Math.abs(a.netRate || 0)
    })

  // Keep previous behavior: if a ware exists in supply, merge same ware from operations into supply.
  const mergedSupplyByWare = new Map<string, any>(Array.from(supplyByWare.entries()))
  const mergedOperationsByWare = new Map<string, any>()
  Array.from(operationsByWare.entries()).forEach(([wareId, opFlow]) => {
    const supplyFlow = mergedSupplyByWare.get(wareId)
    if (!supplyFlow) {
      mergedOperationsByWare.set(wareId, opFlow)
      return
    }
    supplyFlow.production += opFlow.production || 0
    supplyFlow.consumption += opFlow.consumption || 0
    supplyFlow.workforceConsumption += opFlow.workforceConsumption || 0
    supplyFlow.netRate += opFlow.netRate || 0
    supplyFlow.netValue += opFlow.netValue || 0
    supplyFlow.contributions.push(...(opFlow.contributions || []))
  })

  return {
    operations: sortFlows(Array.from(mergedOperationsByWare.values())),
    supply: sortFlows(Array.from(mergedSupplyByWare.values()))
  }
})

const empireGaps = computed(() => {
  const flows = componentGapFlows.value
  const stationNetByWare = new Map<string, number>()
  ;(groupedFlows.value.flows || []).forEach((flow: any) => {
    if (flow.transportType !== 'container') return
    stationNetByWare.set(flow.wareId, Number(flow.netRate || 0))
  })
  store.plannedModules
  locale.value
  const byTierThenName = (a: any, b: any) => {
    const tierA = Number(a.tier ?? 0)
    const tierB = Number(b.tier ?? 0)
    if (tierA !== tierB) return tierB - tierA
    const nameA = String(a.name || '')
    const nameB = String(b.name || '')
    const nameCmp = nameA.localeCompare(nameB, 'en')
    if (nameCmp !== 0) return nameCmp
    return String(a.id || '').localeCompare(String(b.id || ''), 'en')
  }
  const operations = flows.operations
    .filter((flow: any) => (stationNetByWare.get(flow.wareId) ?? 0) < 0 || store.getResolvedLevel(flow.wareId) > 0)
    .map((flow: any) => {
      const module = getModuleForWare(flow.wareId)
      const plannedIndex = module ? getPlannedModuleIndex(module.id) : -1
      return {
        ...wrapFlow(flow),
        disableAdd: !module || flow.netRate > 0,
        disableRemove: !module || plannedIndex === -1
      }
    })
    .sort(byTierThenName)
  return {
    operations,
    supply: flows.supply
      .map((flow: any) => {
        const module = getModuleForWare(flow.wareId)
        const plannedIndex = module ? getPlannedModuleIndex(module.id) : -1
        return {
          ...wrapFlow(flow),
          disableAdd: !module || flow.netRate > 0,
          disableRemove: !module || plannedIndex === -1
        }
      })
      .filter((flow: any) => (stationNetByWare.get(flow.wareId) ?? 0) <= 0 || !flow.disableRemove)
      .sort(byTierThenName)
  }
})
const hasEmpireGapItems = computed(() =>
  empireGaps.value.operations.length > 0 || empireGaps.value.supply.length > 0
)

// 总利润计算
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

const views = computed<{key: ViewMode; label: string}[]>(() => {
  locale.value
  return [
  {key: 'quantity', label: t('wareflow.quantity_view')},
  {key: 'economy', label: t('wareflow.economy_view')},
  {key: 'volume', label: t('wareflow.volume_view')},
  {key: 'transport', label: t('wareflow.transport_view')}
]})

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
   items: groupedFlows.value.volumeGroups.container.map(wrapFlow)},
  {key: 'solid', title: t('wareflow.solid_group'),
   items: groupedFlows.value.volumeGroups.solid.map(wrapFlow)},
  {key: 'liquid', title: t('wareflow.liquid_group'),
   items: groupedFlows.value.volumeGroups.liquid.map(wrapFlow)}
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

const handleAddModule = (wareId: string) => {
  const module = getModuleForWare(wareId)
  if (!module) return
  const flow = empireFlowByWareId.value.get(wareId)
  if (flow && flow.netRate > 0) return
  store.addModule(module.id, 1)
}

const handleRemoveModule = (wareId: string) => {
  const module = getModuleForWare(wareId)
  if (!module) return
  const plannedIndex = getPlannedModuleIndex(module.id)
  if (plannedIndex === -1) return
  const current = store.plannedModules[plannedIndex]?.count ?? 0
  if (current <= 1) {
    store.removeModule(plannedIndex)
  } else {
    store.updateModuleCount(plannedIndex, current - 1)
  }
}

const hasFlowData = computed(() => groupedFlows.value.flows.length > 0)
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
      <!-- 体积视图：显示分组数据 -->
      <div v-if="viewMode === 'volume'" class="volume-groups-container">
        <StationWareFlowGroup v-for="(group, index) in volumeGroups" :key="index"
            :title="group.title"
            :items="group.items"
            :viewMode="viewMode"
        >
          <span class="volume-group-planning">
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
        >
          <div class="transport-group-value">
            <span class="transport-group-sum">
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

      <!-- 通用分组视图：根据当前视图模式显示对应的数据 -->
      <div v-if="viewMode === 'economy' || viewMode === 'quantity'" class="volume-groups-container">
          <div v-if="store.settings.showEmpireGaps && viewMode === 'quantity' && hasEmpireGapItems" class="empire-gap-groups">
            <div v-if="empireGaps.operations.length > 0" class="empire-gap-group">
              <EmpireWareFlowGroup
                :title="t('wareflow.sector_operations')"
                :items="empireGaps.operations"
                :viewMode="viewMode"
                :showAddButton="true"
                :showRemoveButton="true"
                @add="handleAddModule"
                @remove="handleRemoveModule"
              />
            </div>
            <div v-if="empireGaps.supply.length > 0" class="empire-gap-group">
              <EmpireWareFlowGroup
                :title="t('wareflow.sector_supply')"
                :items="empireGaps.supply"
                :viewMode="viewMode"
                :showAddButton="true"
                :showRemoveButton="true"
                @add="handleAddModule"
                @remove="handleRemoveModule"
              />
            </div>
          </div>
          <!-- 产品/收入组 -->
          <StationWareFlowGroup v-for="group in rateGroups" :key="group.key"
            :title="group.title" 
            :items="group.items" 
            :viewMode="viewMode" 
          > 
            <span v-if="viewMode === 'economy'" :class="['economy-group-sum', group.symbolClass]"> 
              {{ getGroupSymboledValue(group.items) }} Cr 
            </span> 
          </StationWareFlowGroup>
        <!-- 经济视图空状态 -->
        <EmptyState v-if="viewMode === 'economy' && groupedFlows.flows.length === 0" />
      </div>

      <EmptyState v-if="groupedFlows.flows.length === 0 && viewMode !== 'economy'" />
    </div>

    <!-- 体积控件部分 -->
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

    <!-- 利润分析部分 -->
    <div class="profit-section" v-if="hasFlowData && viewMode === 'economy'">
      <div class="simulation-controls flex flex-row gap-4">
        <PriceSlider v-model="buyMultiplier" :label="t('wareflow.res_price')" type="buy" />
        <PriceSlider v-model="sellMultiplier" :label="t('wareflow.prod_price')" type="sell" />
      </div>

      <!-- 总利润 -->
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

/* Custom Scrollbar Style */
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

/* 体积控件和利润分析样式 */
.volume-controls-section, .profit-section {
  @apply border-t border-slate-700/50;
}

.simulation-controls {
  @apply p-4 bg-slate-900/50 border-b border-slate-700/50;
}

.profit-details {
  @apply p-4;
}

.profit-item, .profit-total {
  @apply flex justify-between items-center py-2 border-b border-slate-700/30 last:border-0;
}

.profit-economy-label {
  @apply text-sm font-medium text-slate-400;
}

.profit-economy-value {
  @apply font-mono font-bold;
}

.profit-economy-value.positive {
  @apply text-emerald-400;
}

.profit-economy-value.negative {
  @apply text-red-400;
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

/* 体积视图样式 */
.volume-groups-container {
  @apply space-y-1;
}

.volume-group {
  @apply bg-transparent rounded-lg;
}

.volume-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.volume-group-title {
  @apply text-sm font-bold text-slate-300;
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

.volume-item {
  @apply flex justify-between items-center py-2 border-b border-slate-700/20 last:border-0;
}

.volume-item-name {
  @apply text-sm text-slate-400;
}

.volume-item-value {
  @apply font-mono font-bold text-slate-300;
}

/* 经济视图样式 */
.economy-group {
  @apply mb-1;
}

.economy-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.economy-group-title {
  @apply text-sm font-bold text-slate-300;
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

.economy-items {
  @apply pl-3 pr-1 py-1 bg-slate-800/20 rounded mb-1;
}

.economy-item {
  @apply flex justify-between items-center py-1 border-b border-slate-700/20 last:border-0;
}

.economy-item-name {
  @apply text-sm text-slate-400;
}

.economy-item-value {
  @apply text-sm font-mono font-bold;
}

.economy-item-value.positive {
  @apply text-green-400;
}

.economy-item-value.negative {
  @apply text-red-400;
}

/* 资源视图样式 */
.resource-groups-container {
  @apply space-y-1;
}

.resource-group {
  @apply mb-1;
}

.resource-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}

.resource-group-title {
  @apply text-sm font-bold text-slate-300;
}
</style>
