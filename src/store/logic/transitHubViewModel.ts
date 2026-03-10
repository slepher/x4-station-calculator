import type {
  EmpireGroupedFlows,
  SectorPlan,
  StationPlan,
  SupplyStorageFlow,
  TransitHubStorageModulePlan,
  TransitHubViewModel,
  X4Module,
  X4Ware
} from '@/types/x4'
import type { SolveMultiWareByLinkOutput } from './sectorLinkFlow'

export const DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS = 12

interface BuildTransitHubViewModelInput {
  sectorId: string | null
  sectors: SectorPlan[]
  stations: StationPlan[]
  localGroupedFlows: EmpireGroupedFlows
  solverOutput: SolveMultiWareByLinkOutput | null
  waresMap?: Record<string, X4Ware>
  modulesMap?: Record<string, X4Module>
  racePreference: string
  transportShipCapacity: number
  storageBufferHours?: number
}

interface BuildTransitHubStorageFlowsInput {
  sectorId: string
  sectors: SectorPlan[]
  stations: StationPlan[]
  groupedFlows: EmpireGroupedFlows
  solverOutput: SolveMultiWareByLinkOutput | null
  waresMap?: Record<string, X4Ware>
  storageBufferHours: number
}

function createEmptyGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
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

export function buildTransitHubStorageFlows(input: BuildTransitHubStorageFlowsInput): SupplyStorageFlow[] {
  const {
    sectorId,
    sectors,
    stations,
    groupedFlows,
    solverOutput,
    waresMap,
    storageBufferHours
  } = input

  const sectorNameMap = new Map(sectors.map((sector) => [sector.id, sector.name]))
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
        if (netRate === 0) return
        const amount = Math.abs(netRate)
        row.details.push({
          stationId: detail.stationId,
          stationName: detail.stationName,
          stationCount: detail.stationCount || 1,
          kind: netRate > 0 ? 'production' : 'consumption',
          staticRate: amount,
          storageVolume: amount * (row.unitVolume || 1) * storageBufferHours,
          sortOrder: localStationOrderMap.get(detail.stationId) ?? Number.MAX_SAFE_INTEGER / 2
        })
      })
    })

  const safeSolverOutput = solverOutput || createEmptySolverOutput()
  safeSolverOutput.linkWareFlows.forEach((flow) => {
    const isOutbound = flow.from === sectorId
    const isInbound = flow.to === sectorId
    if (!isOutbound && !isInbound) return

    const peerSectorId = isOutbound ? flow.to : flow.from
    const peerSectorName = sectorNameMap.get(peerSectorId) || peerSectorId
    const wareInfo = waresMap?.[flow.wareId]
    const row = ensureWare(flow.wareId, {
      tier: Number(wareInfo?.tier || 0),
      unitVolume: Number(wareInfo?.volume || 1)
    })

    const amount = Math.abs(flow.amount || 0)
    if (amount <= 0) return

    row.details.push({
      stationId: `external:${peerSectorId}:${isOutbound ? 'out' : 'in'}`,
      stationName: peerSectorName,
      stationCount: 1,
      kind: isOutbound ? 'production' : 'consumption',
      staticRate: amount,
      storageVolume: amount * (row.unitVolume || 1) * storageBufferHours,
      sortOrder: 100000 + (sectorOrderMap.get(peerSectorId) ?? Number.MAX_SAFE_INTEGER / 2)
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

export function buildTransitHubStorageModulePlans(input: {
  storageFlows: SupplyStorageFlow[]
  modulesMap?: Record<string, X4Module>
  racePreference: string
  transportShipCapacity: number
}): TransitHubStorageModulePlan[] {
  const { storageFlows, modulesMap, racePreference, transportShipCapacity } = input
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

export function buildTransitHubViewModel(input: BuildTransitHubViewModelInput): TransitHubViewModel {
  if (!input.sectorId) {
    return {
      groupedFlows: createEmptyGroupedFlows(),
      storageFlows: [],
      storageModulePlans: [],
      supplyBuildModules: []
    }
  }

  const storageBufferHours = Number.isFinite(input.storageBufferHours)
    ? Number(input.storageBufferHours)
    : DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS

  const storageFlows = buildTransitHubStorageFlows({
    sectorId: input.sectorId,
    sectors: input.sectors,
    stations: input.stations,
    groupedFlows: input.localGroupedFlows,
    solverOutput: input.solverOutput,
    waresMap: input.waresMap,
    storageBufferHours: storageBufferHours > 0 ? storageBufferHours : DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS
  })

  const storageModulePlans = buildTransitHubStorageModulePlans({
    storageFlows,
    modulesMap: input.modulesMap,
    racePreference: input.racePreference,
    transportShipCapacity: input.transportShipCapacity
  })

  return {
    groupedFlows: input.localGroupedFlows,
    storageFlows,
    storageModulePlans,
    supplyBuildModules: storageModulePlans.map((item) => ({ ...item.item }))
  }
}
