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

  const sectorNameMap = new Map(empireStore.sectors.map((sector) => [sector.id, sector.name]))
  const sectorOrderMap = new Map(empireStore.sectors.map((sector, index) => [sector.id, index]))
  const localStationOrderMap = new Map(
    empireStore.orderedStationsBySector
      .filter((station) => station.sectorId === props.sectorId)
      .map((station, index) => [station.id, index])
  )
  const localByWare = new Map<string, any>()
  const upsertWare = (flow: any) => {
    if (flow.transportType !== 'container') return
    if (!localByWare.has(flow.wareId)) {
      localByWare.set(flow.wareId, {
        wareId: flow.wareId,
        orderIndex: flow.orderIndex,
        tier: flow.tier,
        transportType: 'container',
        unitVolume: flow.unitVolume || 1,
        details: [] as Array<{
          stationId: string
          stationName: string
          stationCount: number
          kind: 'production' | 'consumption'
          staticRate: number
          storageVolume: number
          sortOrder?: number
        }>
      })
    }
    return localByWare.get(flow.wareId)
  }

  const pushDetail = (wareId: string, detail: {
    stationId: string
    stationName: string
    stationCount: number
    kind: 'production' | 'consumption'
    staticRate: number
    storageVolume: number
    sortOrder?: number
  }) => {
    const row = localByWare.get(wareId)
    if (!row) return
    row.details.push(detail)
  }

  // Local sector station contributions with fixed 12h buffer.
  sectorGroupedFlows.value.flows
    .filter((flow) => flow.transportType === 'container')
    .forEach((flow) => {
      const row = upsertWare(flow)
      if (!row) return
      ;(flow.contributions || []).forEach((detail: any) => {
        const netRate = Number(detail.netRate || 0)
        if (netRate > 0) {
          pushDetail(flow.wareId, {
            stationId: detail.stationId,
            stationName: detail.stationName,
            stationCount: detail.stationCount || 1,
            kind: 'production',
            staticRate: netRate,
            storageVolume: netRate * row.unitVolume * 12,
            sortOrder: localStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2
          })
        } else if (netRate < 0) {
          const amount = Math.abs(netRate)
          pushDetail(flow.wareId, {
            stationId: detail.stationId,
            stationName: detail.stationName,
            stationCount: detail.stationCount || 1,
            kind: 'consumption',
            staticRate: amount,
            storageVolume: amount * row.unitVolume * 12,
            sortOrder: localStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2
          })
        }
      })
    })

  // Build one-hop external contributions from pure solver.
  const solverOutput = empireStore.getSectorLinkCalc(props.sectorId)?.solverOutput || {
    linkWareFlows: [],
    allocatedDemandBySector: [],
    deficitSummary: {
      totalDeficit: 0,
      deficitByNode: [],
      producerNodes: []
    }
  }

  solverOutput.linkWareFlows.forEach((flow) => {
    if (!props.sectorId) return
    const isOutbound = flow.from === props.sectorId
    const isInbound = flow.to === props.sectorId
    if (!isOutbound && !isInbound) return

    const peerSectorId = isOutbound ? flow.to : flow.from
    const peerSectorName = sectorNameMap.get(peerSectorId) || peerSectorId

    if (!localByWare.has(flow.wareId)) {
      const wareInfo = gameDataStore.waresMap?.[flow.wareId]
      localByWare.set(flow.wareId, {
        wareId: flow.wareId,
        orderIndex: Number.MAX_SAFE_INTEGER,
        tier: Number(wareInfo?.tier || 0),
        transportType: 'container',
        unitVolume: Number(wareInfo?.volume || 1),
        details: []
      })
    }
    const row = localByWare.get(flow.wareId)
    const unitVolume = row?.unitVolume || 1
    const amount = Math.abs(flow.amount || 0)
    if (amount <= 0) return

    row.details.push({
      stationId: `external:${peerSectorId}:${isOutbound ? 'out' : 'in'}`,
      stationName: peerSectorName,
      stationCount: 1,
      kind: isOutbound ? 'production' : 'consumption',
      staticRate: amount,
      storageVolume: amount * unitVolume * 12,
      sortOrder: 100000 + (sectorOrderMap.get(peerSectorId) ?? Number.MAX_SAFE_INTEGER / 2)
    })
  })

  const orderByWare = new Map(
    sectorGroupedFlows.value.flows
      .filter((flow) => flow.transportType === 'container')
      .map((flow) => [flow.wareId, { orderIndex: flow.orderIndex, tier: flow.tier, unitVolume: flow.unitVolume || 1 }])
  )

  return Array.from(localByWare.values())
    .map((row) => {
      const orderRef = orderByWare.get(row.wareId)
      if (orderRef) {
        row.orderIndex = orderRef.orderIndex
        row.tier = orderRef.tier
        row.unitVolume = orderRef.unitVolume
      }
      const totalProductionStorageVolume = row.details
        .filter((detail: any) => detail.kind === 'production')
        .reduce((sum: number, detail: any) => sum + detail.storageVolume, 0)
      const totalConsumptionStorageVolume = row.details
        .filter((detail: any) => detail.kind === 'consumption')
        .reduce((sum: number, detail: any) => sum + detail.storageVolume, 0)
      return {
        wareId: row.wareId,
        orderIndex: row.orderIndex,
        tier: row.tier,
        transportType: 'container',
        unitVolume: row.unitVolume,
        totalProductionStorageVolume,
        totalConsumptionStorageVolume,
        totalRequiredStorageVolume: Math.max(totalProductionStorageVolume, totalConsumptionStorageVolume),
        details: row.details.sort((a: any, b: any) => {
          const orderA = Number(a.sortOrder)
          const orderB = Number(b.sortOrder)
          const hasOrderA = Number.isFinite(orderA)
          const hasOrderB = Number.isFinite(orderB)
          if (hasOrderA || hasOrderB) {
            if (hasOrderA && hasOrderB && orderA !== orderB) return orderA - orderB
            if (hasOrderA && !hasOrderB) return -1
            if (!hasOrderA && hasOrderB) return 1
          }
          return b.storageVolume - a.storageVolume
        })
      } satisfies SupplyStorageFlow
    })
    .filter((item) => item.totalRequiredStorageVolume > 0)
    .sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
      if (a.tier !== b.tier) return b.tier - a.tier
      return a.wareId.localeCompare(b.wareId)
    })
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

  const totalBerthDemand = sectorStorageFlows.value.reduce((sum, flow) => {
    const wareStationDemand = flow.details.reduce((detailSum, detail) => {
      return detailSum + ((Math.abs(detail.staticRate) || 0) / (shipCapacity * 15))
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
