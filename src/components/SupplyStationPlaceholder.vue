<script setup lang="ts">
import { computed } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useStationStore } from '@/store/useStationStore'
import type { EmpireGroupedFlows, SupplyStorageFlow } from '@/types/x4'
import EmpireWareFlowsDashboard from './EmpireWareFlowsDashboard.vue'
import StationPlanningItem from './StationPlanningItem.vue'
import StationDashboard from './StationDashboard.vue'

const props = defineProps<{
  sectorId: string | null
}>()

const empireStore = useEmpireStore()
const gameDataStore = useGameDataStore()
const stationStore = useStationStore()

const sectorGroupedFlows = computed<EmpireGroupedFlows>(() => {
  if (!props.sectorId) {
    return {
      flows: [],
      empireGroups: {
        operations: [],
        supply: []
      }
    }
  }
  return empireStore.getSectorInternalData(props.sectorId).localGroupedFlows
})

const sectorStorageFlows = computed<SupplyStorageFlow[]>(() => {
  if (!props.sectorId) return []
  return empireStore.getSectorInternalData(props.sectorId).supplyStorageFlows
})

const storageModulePlans = computed(() => {
  const modulesMap = gameDataStore.modulesMap
  const race = stationStore.settings.racePreference
  const shipCapacity = Math.max(1, stationStore.settings.transportShipCapacity || 1)
  const transportNeeds = {
    container: 0,
    solid: 0,
    liquid: 0
  }

  sectorStorageFlows.value.forEach((flow) => {
    if (flow.transportType === 'container') transportNeeds.container += flow.totalRequiredStorageVolume
    else if (flow.transportType === 'solid') transportNeeds.solid += flow.totalRequiredStorageVolume
    else if (flow.transportType === 'liquid') transportNeeds.liquid += flow.totalRequiredStorageVolume
  })

  const findBestStorage = (type: 'container' | 'solid' | 'liquid') => {
    const allModules = Object.values(modulesMap || {})
    const sameRaceL = allModules.find((module) =>
      module.type === 'storage' &&
      module.race === race &&
      module.cargo?.type === type &&
      module.cargo.capacity > 500000
    )
    if (sameRaceL) return sameRaceL

    const genericL = allModules.find((module) =>
      module.type === 'storage' &&
      module.cargo?.type === type &&
      module.cargo.capacity > 500000
    )
    if (genericL) return genericL

    const allStorages = allModules
      .filter((module) => module.type === 'storage' && module.cargo?.type === type)
      .sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0))
    return allStorages[0] || null
  }

  const plans: Array<{
    id: string
    item: { id: string; count: number }
    info: any
    count: number
    capacity: number
    required: number
    type: 'container' | 'solid' | 'liquid'
  }> = []

  ;(['container', 'solid', 'liquid'] as const).forEach((type) => {
    const required = transportNeeds[type]
    if (required <= 0) return
    const module = findBestStorage(type)
    if (!module?.cargo?.capacity) return
    plans.push({
      id: module.id,
      item: { id: module.id, count: Math.ceil(required / module.cargo.capacity) },
      info: module,
      count: Math.ceil(required / module.cargo.capacity),
      capacity: module.cargo.capacity,
      required,
      type
    })
  })

  const totalBerthDemand = sectorGroupedFlows.value.flows.reduce((sum, flow) => {
    const wareStationDemand = flow.contributions.reduce((stationSum, detail) => {
      return stationSum + (Math.abs(detail.netRate) / (shipCapacity * 15))
    }, 0)
    return sum + wareStationDemand
  }, 0)

  const finalLargeBerthDemand = Math.ceil((totalBerthDemand / 3) * 2)
  if (finalLargeBerthDemand > 0) {
    const allModules = Object.values(modulesMap || {})
    const eLargePier = allModules.find((module) =>
      module.type === 'pier' &&
      module.race === race &&
      module.macroId?.includes('harbor_03')
    ) || allModules.find((module) =>
      module.type === 'pier' &&
      module.macroId?.includes('harbor_03')
    )

    if (eLargePier) {
      plans.push({
        id: eLargePier.id,
        item: { id: eLargePier.id, count: finalLargeBerthDemand },
        info: eLargePier,
        count: finalLargeBerthDemand,
        capacity: 0,
        required: 0,
        type: 'container'
      })
    }
  }

  return plans
})

const supplyBuildModules = computed(() =>
  storageModulePlans.value.map((item) => ({ ...item.item }))
)

</script>

<template>
  <div>
    <div v-if="!sectorId" class="empty-select">
      {{ $t('sectorManagement.supply_select_sector') }}
    </div>

    <div v-else class="main-layout">
      <div class="col-span-12 lg:col-span-3">
        <section>
          <div class="tier-section tier-auto">
            <div class="tier-header">
              <span class="tier-label">{{ $t('sectorManagement.supply_build_zone') }}</span>
            </div>
            <div class="module-list-scroll">
              <div class="auto-modules-container">
                <StationPlanningItem
                  v-for="(item, index) in storageModulePlans"
                  :key="item.id + '-' + index"
                  :item="item.item"
                  :info="item.info"
                  :readonly="true"
                  :no-click="true"
                />
              </div>
            </div>
          </div>
          <div class="build-list">
            <div v-if="storageModulePlans.length === 0" class="placeholder">
              {{ $t('sectorManagement.supply_build_placeholder') }}
            </div>
          </div>
        </section>
      </div>

      <div class="col-span-12 lg:col-span-5">
        <section class="resource-col">
          <EmpireWareFlowsDashboard
            :grouped-flows="sectorGroupedFlows"
            :enable-storage-view="true"
            :enable-transport-view="true"
            :supply-storage-flows="sectorStorageFlows"
          />
        </section>
      </div>

      <div class="col-span-12 lg:col-span-4">
        <section>
          <StationDashboard
            :planned-modules-override="supplyBuildModules"
            :hide-workers-view="true"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-select {
  @apply p-6 text-sm text-slate-400;
}
.main-layout {
  @apply grid grid-cols-12 gap-8 items-start;
}
.resource-col {
  @apply min-w-0;
}
.col-title {
  @apply text-xs uppercase tracking-wider text-slate-300 font-bold mb-3;
}
.placeholder {
  @apply text-xs text-slate-400 bg-slate-900/40 border border-slate-700/60 rounded p-3 min-h-[180px];
}
.build-list {
  @apply min-h-[180px];
}
.resource-col :deep(.list-wrapper) {
  @apply border-slate-700/60;
}
.module-list-scroll {
  @apply overflow-y-auto pr-1 scrollbar-thin;
}
.auto-modules-container {
  @apply space-y-2;
}
.tier-section {
  @apply space-y-2;
}
.tier-section.tier-auto {
  @apply opacity-90;
}
.tier-section.tier-auto .module-list-scroll {
  @apply border-l-2 border-dashed border-slate-600 pl-2;
}
.tier-header {
  @apply flex items-center justify-between px-3 h-8 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent w-full;
}
.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none;
}
.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>
