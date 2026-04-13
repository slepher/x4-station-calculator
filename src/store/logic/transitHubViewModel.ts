import type {
  EmpireGroupedFlows,
  EmpireWareFlow,
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
  buyMultiplier?: number
  sellMultiplier?: number
}

interface BuildTransitHubStorageFlowsInput {
  sectorId: string
  sectors: SectorPlan[]
  stations: StationPlan[]
  groupedFlows: EmpireGroupedFlows
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

function mergeLinkFlowsIntoGroupedFlows(
  groupedFlows: EmpireGroupedFlows,
  solverOutput: SolveMultiWareByLinkOutput,
  sectorId: string,
  sectors: SectorPlan[],
  waresMap?: Record<string, X4Ware>,
  buyMultiplier?: number,
  sellMultiplier?: number
): EmpireGroupedFlows {
  const safeSolverOutput = solverOutput || createEmptySolverOutput()
  const sectorNameMap = new Map(sectors.map((sector) => [sector.id, sector.name]))
  const effectiveBuyMultiplier = buyMultiplier ?? 0.5
  const effectiveSellMultiplier = sellMultiplier ?? 0.5

  const flowsByWareId = new Map<string, EmpireWareFlow>()
  groupedFlows.flows.forEach((flow) => {
    flowsByWareId.set(flow.wareId, { ...flow, contributions: [...(flow.contributions || [])] })
  })

  safeSolverOutput.linkWareFlows.forEach((linkFlow) => {
    const isFromHere = linkFlow.from === sectorId
    const isToHere = linkFlow.to === sectorId
    if (!isFromHere && !isToHere) return

    const peerSectorId = isFromHere ? linkFlow.to : linkFlow.from
    const peerSectorName = sectorNameMap.get(peerSectorId) || peerSectorId
    const amount = Math.abs(linkFlow.amount || 0)

    const existingFlow = flowsByWareId.get(linkFlow.wareId)
    const unitPrice = existingFlow?.unitPrice || waresMap?.[linkFlow.wareId]?.price || 0
    const unitVolume = existingFlow?.unitVolume || waresMap?.[linkFlow.wareId]?.volume || 1
    const tier = existingFlow?.tier || waresMap?.[linkFlow.wareId]?.tier || 0
    const orderIndex = existingFlow?.orderIndex || Number.MAX_SAFE_INTEGER

    const contribution = {
      stationId: `external:${peerSectorId}`,
      stationName: peerSectorName,
      stationCount: 1,
      production: isToHere ? amount : 0,
      consumption: isFromHere ? amount : 0,
      workforceConsumption: 0,
      netRate: isToHere ? amount : -amount,
      netValue: isToHere
        ? amount * unitPrice * effectiveBuyMultiplier
        : -amount * unitPrice * effectiveSellMultiplier
    }

    if (existingFlow) {
      existingFlow.contributions.push(contribution)
      existingFlow.production += contribution.production
      existingFlow.consumption += contribution.consumption
      existingFlow.netRate += contribution.netRate
      existingFlow.netValue += contribution.netValue
    } else {
      flowsByWareId.set(linkFlow.wareId, {
        wareId: linkFlow.wareId,
        orderIndex,
        tier,
        transportType: 'container',
        unitVolume,
        production: contribution.production,
        consumption: contribution.consumption,
        workforceConsumption: 0,
        netRate: contribution.netRate,
        unitPrice,
        netValue: contribution.netValue,
        contributions: [contribution]
      })
    }
  })

  const mergedFlows = Array.from(flowsByWareId.values())
  const operations = mergedFlows.filter((flow) => flow.transportType === 'container' && flow.workforceConsumption <= 0)
  const supply = mergedFlows.filter((flow) => flow.workforceConsumption > 0 || flow.transportType !== 'container')

  return {
    flows: mergedFlows,
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

export function buildTransitHubStorageFlows(input: BuildTransitHubStorageFlowsInput): SupplyStorageFlow[] {
  const {
    sectorId,
    sectors,
    stations,
    groupedFlows,
    storageBufferHours
  } = input

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

  const mergedGroupedFlows = mergeLinkFlowsIntoGroupedFlows(
    input.localGroupedFlows,
    input.solverOutput || createEmptySolverOutput(),
    input.sectorId,
    input.sectors,
    input.waresMap,
    input.buyMultiplier,
    input.sellMultiplier
  )

  const storageFlows = buildTransitHubStorageFlows({
    sectorId: input.sectorId,
    sectors: input.sectors,
    stations: input.stations,
    groupedFlows: mergedGroupedFlows,
    storageBufferHours: storageBufferHours > 0 ? storageBufferHours : DEFAULT_TRANSIT_STORAGE_BUFFER_HOURS
  })

  const storageModulePlans = buildTransitHubStorageModulePlans({
    storageFlows,
    modulesMap: input.modulesMap,
    racePreference: input.racePreference,
    transportShipCapacity: input.transportShipCapacity
  })

  return {
    groupedFlows: mergedGroupedFlows,
    storageFlows,
    storageModulePlans,
    supplyBuildModules: storageModulePlans.map((item) => ({ ...item.item }))
  }
}
