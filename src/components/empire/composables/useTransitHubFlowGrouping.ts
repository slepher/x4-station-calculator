import type {
  EmpireGroupedFlows,
  SectorPlan,
  StationPlan,
  SupplyStorageFlow,
  TransitHubGroupedFlows,
  TransitHubWareFlow,
  X4Module,
  X4Ware,
  TransitHubStorageModulePlan
} from '@/types/x4'
import type { SolveMultiWareByLinkOutput } from '@/store/logic/sectorLinkFlow'
import { getPriceByMultiplier } from '@/store/logic/calculatorUtils'

const DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS = 12

interface PendingFlow {
  wareId: string
  orderIndex: number
  tier: number
  transportType: 'container' | 'solid' | 'liquid'
  unitVolume: number
  minPrice: number
  avgPrice: number
  maxPrice: number
  production: number
  consumption: number
  workforceConsumption: number
  netRate: number
  contributions: Array<{
    stationId: string
    stationName: string
    stationCount: number
    production: number
    consumption: number
    workforceConsumption: number
    netRate: number
  }>
}

function createEmptySolverOutput(): SolveMultiWareByLinkOutput {
  return {
    linkWareFlows: [],
    allocatedDemandBySector: [],
    deficitSummary: {
      totalDeficit: 0,
      deficitByNode: [],
      producerNodes: []
    }
  }
}

function createEmptyGroupedFlows(): TransitHubGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}

function mergeLinkFlows(
  groupedFlows: EmpireGroupedFlows,
  solverOutput: SolveMultiWareByLinkOutput | null,
  sectorId: string,
  sectors: SectorPlan[],
  waresMap: Record<string, X4Ware>
): Map<string, PendingFlow> {
  const safeSolverOutput = solverOutput || createEmptySolverOutput()
  const sectorNameMap = new Map(sectors.map((sector) => [sector.id, sector.name]))
  const pendingFlowsByWareId = new Map<string, PendingFlow>()

  groupedFlows.flows.forEach((flow) => {
    const contributions = (flow.contributions || []).map((contrib) => ({
      stationId: contrib.stationId,
      stationName: contrib.stationName,
      stationCount: contrib.stationCount,
      production: contrib.production,
      consumption: contrib.consumption,
      workforceConsumption: contrib.workforceConsumption,
      netRate: contrib.netRate
    }))

    pendingFlowsByWareId.set(flow.wareId, {
      wareId: flow.wareId,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      minPrice: flow.minPrice,
      avgPrice: flow.avgPrice,
      maxPrice: flow.maxPrice,
      production: flow.production,
      consumption: flow.consumption,
      workforceConsumption: flow.workforceConsumption,
      netRate: flow.netRate,
      contributions
    })
  })

  safeSolverOutput.linkWareFlows.forEach((linkFlow) => {
    const isFromHere = linkFlow.from === sectorId
    const isToHere = linkFlow.to === sectorId
    if (!isFromHere && !isToHere) return

    const peerSectorId = isFromHere ? linkFlow.to : linkFlow.from
    const peerSectorName = sectorNameMap.get(peerSectorId) || peerSectorId
    const amount = Math.abs(linkFlow.amount || 0)
    const netRate = isToHere ? amount : -amount

    const contribution = {
      stationId: `external:${peerSectorId}`,
      stationName: peerSectorName,
      stationCount: 1,
      production: isToHere ? amount : 0,
      consumption: isFromHere ? amount : 0,
      workforceConsumption: 0,
      netRate
    }

    const existingFlow = pendingFlowsByWareId.get(linkFlow.wareId)
    if (existingFlow) {
      existingFlow.contributions.push(contribution)
      existingFlow.production += contribution.production
      existingFlow.consumption += contribution.consumption
      existingFlow.netRate += contribution.netRate
    } else {
      const ware = waresMap?.[linkFlow.wareId]
      pendingFlowsByWareId.set(linkFlow.wareId, {
        wareId: linkFlow.wareId,
        orderIndex: Number.MAX_SAFE_INTEGER,
        tier: ware?.tier || 0,
        transportType: 'container',
        unitVolume: ware?.volume || 1,
        minPrice: ware?.minPrice || 0,
        avgPrice: ware?.price || 0,
        maxPrice: ware?.maxPrice || 0,
        production: contribution.production,
        consumption: contribution.consumption,
        workforceConsumption: 0,
        netRate: contribution.netRate,
        contributions: [contribution]
      })
    }
  })

  return pendingFlowsByWareId
}

function computeTransitHubFlows(
  pendingFlowsByWareId: Map<string, PendingFlow>,
  buyMultiplier: number,
  sellMultiplier: number
): TransitHubGroupedFlows {
  const effectiveBuyMultiplier = buyMultiplier ?? 0.5
  const effectiveSellMultiplier = sellMultiplier ?? 0.5

  const resultFlows: TransitHubWareFlow[] = []

  pendingFlowsByWareId.forEach((pending) => {
    const isSurplus = pending.netRate >= 0
    const multiplier = isSurplus ? effectiveSellMultiplier : effectiveBuyMultiplier
    const ware = { minPrice: pending.minPrice, price: pending.avgPrice, maxPrice: pending.maxPrice }
    const unitPrice = getPriceByMultiplier(ware as X4Ware, multiplier)
    const netValue = pending.netRate * unitPrice

    const contributionsWithPrice = pending.contributions.map((contrib) => ({
      ...contrib,
      netValue: contrib.netRate * unitPrice
    }))

    resultFlows.push({
      wareId: pending.wareId,
      orderIndex: pending.orderIndex,
      tier: pending.tier,
      transportType: pending.transportType,
      unitVolume: pending.unitVolume,
      production: pending.production,
      consumption: pending.consumption,
      workforceConsumption: pending.workforceConsumption,
      netRate: pending.netRate,
      minPrice: pending.minPrice,
      avgPrice: pending.avgPrice,
      maxPrice: pending.maxPrice,
      unitPrice,
      netValue,
      contributions: contributionsWithPrice
    })
  })

  const operations = resultFlows.filter((flow) => flow.transportType === 'container' && flow.workforceConsumption <= 0)
  const supply = resultFlows.filter((flow) => flow.workforceConsumption > 0 || flow.transportType !== 'container')

  return {
    flows: resultFlows,
    empireGroups: {
      operations,
      supply
    }
  }
}

function sortStorageFlowDetails(a: SupplyStorageFlow['details'][number], b: SupplyStorageFlow['details'][number]) {
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
}

function sortStorageFlows(a: SupplyStorageFlow, b: SupplyStorageFlow) {
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  if (a.tier !== b.tier) return b.tier - a.tier
  return a.wareId.localeCompare(b.wareId)
}

function computeStorageFlows(
  sectorId: string,
  sectors: SectorPlan[],
  stations: StationPlan[],
  groupedFlows: TransitHubGroupedFlows,
  storageBufferHours: number
): SupplyStorageFlow[] {
  const sectorOrderMap = new Map(sectors.map((sector, index) => [sector.id, index]))
  const localStationOrderMap = new Map(
    stations
      .filter((station) => station.sectorId === sectorId)
      .map((station, index) => [station.id, index])
  )

  const byWare = new Map<string, SupplyStorageFlow>()
  const ensureWare = (wareId: string, fallback: Partial<SupplyStorageFlow> = {}) => {
    if (!byWare.has(wareId)) {
      byWare.set(wareId, {
        wareId,
        orderIndex: Number.MAX_SAFE_INTEGER,
        tier: 0,
        transportType: 'container',
        unitVolume: 1,
        totalProductionStorageVolume: 0,
        totalConsumptionStorageVolume: 0,
        totalRequiredStorageVolume: 0,
        details: [],
        ...fallback
      })
    }
    return byWare.get(wareId)!
  }

  groupedFlows.flows
    .filter((flow) => flow.transportType === 'container')
    .forEach((flow) => {
      const row = ensureWare(flow.wareId, {
        orderIndex: flow.orderIndex,
        tier: flow.tier,
        unitVolume: flow.unitVolume || 1
      })

      ;(flow.contributions || []).forEach((detail) => {
        const netRate = Number(detail.netRate || 0)
        const amount = Math.abs(netRate)
        if (amount === 0) return

        const isExternal = detail.stationId.startsWith('external:')
        const peerSectorId = isExternal ? detail.stationId.slice(9) : null

        row.details.push({
          stationId: detail.stationId,
          stationName: detail.stationName,
          stationCount: detail.stationCount || 1,
          kind: netRate > 0 ? 'production' : 'consumption',
          staticRate: amount,
          storageVolume: amount * (row.unitVolume || 1) * storageBufferHours,
          sortOrder: isExternal
            ? 100000 + (sectorOrderMap.get(peerSectorId!) ?? Number.MAX_SAFE_INTEGER / 2)
            : (localStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2)
        })
      })
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
        details: [...row.details].sort(sortStorageFlowDetails)
      } satisfies SupplyStorageFlow
    })
    .filter((item) => item.totalRequiredStorageVolume > 0)
    .sort(sortStorageFlows)
}

function computeStorageModulePlans(
  storageFlows: SupplyStorageFlow[],
  modulesMap: Record<string, X4Module>,
  racePreference: string,
  transportShipCapacity: number
): TransitHubStorageModulePlan[] {
  const allModules = Object.values(modulesMap || {})
  const transportNeeds = {
    container: 0,
    solid: 0,
    liquid: 0
  }

  storageFlows.forEach((flow) => {
    if (flow.transportType === 'container') transportNeeds.container += flow.totalRequiredStorageVolume
    else if (flow.transportType === 'solid') transportNeeds.solid += flow.totalRequiredStorageVolume
    else if (flow.transportType === 'liquid') transportNeeds.liquid += flow.totalRequiredStorageVolume
  })

  const findBestStorage = (type: 'container' | 'solid' | 'liquid') => {
    const sameRaceL = allModules.find((module) =>
      module.type === 'storage' &&
      module.race === racePreference &&
      module.cargo?.type === type &&
      module.cargo?.capacity > 500000
    )
    if (sameRaceL) return sameRaceL

    const genericL = allModules.find((module) =>
      module.type === 'storage' &&
      module.cargo?.type === type &&
      module.cargo?.capacity > 500000
    )
    if (genericL) return genericL

    const allStorages = allModules
      .filter((module) => module.type === 'storage' && module.cargo?.type === type)
      .sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0))
    return allStorages[0] || null
  }

  const plans: TransitHubStorageModulePlan[] = []
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

  const shipCapacity = Math.max(1, transportShipCapacity || 1)
  const totalBerthDemand = storageFlows.reduce((sum, flow) => {
    const wareStationDemand = flow.details.reduce((detailSum, detail) => {
      return detailSum + ((Math.abs(detail.staticRate) || 0) / (shipCapacity * 15))
    }, 0)
    return sum + wareStationDemand
  }, 0)

  const finalLargeBerthDemand = Math.ceil((totalBerthDemand / 3) * 2)
  if (finalLargeBerthDemand > 0) {
    const eLargePier = allModules.find((module) =>
      module.type === 'pier' &&
      module.race === racePreference &&
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
}

export interface TransitHubFlowGroupingInput {
  sectorId: string | null
  sectors: SectorPlan[]
  stations: StationPlan[]
  localGroupedFlows: EmpireGroupedFlows
  solverOutput: SolveMultiWareByLinkOutput | null
  waresMap: Record<string, X4Ware>
  modulesMap: Record<string, X4Module>
  racePreference: string
  transportShipCapacity: number
  storageBufferHours?: number
  buyMultiplier?: number
  sellMultiplier?: number
}

export interface TransitHubFlowGroupingOutput {
  groupedFlows: TransitHubGroupedFlows
  storageFlows: SupplyStorageFlow[]
  storageModulePlans: TransitHubStorageModulePlan[]
}

export function computeTransitHubGrouping(input: TransitHubFlowGroupingInput): TransitHubFlowGroupingOutput {
  if (!input.sectorId) {
    return {
      groupedFlows: createEmptyGroupedFlows(),
      storageFlows: [],
      storageModulePlans: []
    }
  }

  const storageBufferHours = Number.isFinite(input.storageBufferHours)
    ? Number(input.storageBufferHours)
    : DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS

  const pendingFlowsByWareId = mergeLinkFlows(
    input.localGroupedFlows,
    input.solverOutput,
    input.sectorId,
    input.sectors,
    input.waresMap
  )

  const groupedFlows = computeTransitHubFlows(
    pendingFlowsByWareId,
    input.buyMultiplier ?? 0.5,
    input.sellMultiplier ?? 0.5
  )

  const storageFlows = computeStorageFlows(
    input.sectorId,
    input.sectors,
    input.stations,
    groupedFlows,
    storageBufferHours > 0 ? storageBufferHours : DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS
  )

  const storageModulePlans = computeStorageModulePlans(
    storageFlows,
    input.modulesMap,
    input.racePreference,
    input.transportShipCapacity
  )

  return {
    groupedFlows,
    storageFlows,
    storageModulePlans
  }
}

export function useTransitHubFlowGrouping() {
  return { computeTransitHubGrouping }
}