<script setup lang="ts">
import { computed } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useStationStore } from '@/store/useStationStore'
import type { EmpireGroupedFlows, SupplyStorageFlow } from '@/types/x4'
import TransitHubBuildPanel from './TransitHubBuildPanel.vue'
import TransitHubCenterDashboard from './TransitHubCenterDashboard.vue'
import TransitHubMaterialsPanel from './TransitHubMaterialsPanel.vue'

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
        <TransitHubBuildPanel :storage-module-plans="storageModulePlans" />
      </div>

      <div class="col-span-12 lg:col-span-5">
        <section class="resource-col">
          <TransitHubCenterDashboard
            :grouped-flows="sectorGroupedFlows"
            :storage-flows="sectorStorageFlows"
          />
        </section>
      </div>

      <div class="col-span-12 lg:col-span-4">
        <TransitHubMaterialsPanel :planned-modules-override="supplyBuildModules" />
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
.resource-col :deep(.list-wrapper) {
  @apply border-slate-700/60;
}
</style>
