import type { EmpireWareFlow, SectorInternalData, SectorPlan, StationFlowAtom, StationPlan } from '@/types/x4'
import { getSectorNetworkComponent, type SectorLinkInput } from './sectorLinkFlow'
import { parseSectorLinkKey } from './sectorLinks'

export interface StationComponentGapFlows {
  operations: EmpireWareFlow[]
  supply: EmpireWareFlow[]
}

interface BuildStationComponentGapFlowsInput {
  currentSectorId: string
  sectors: SectorPlan[]
  sectorLinks: string[]
  orderedStations: StationPlan[]
  sectorInternalDataMap: Map<string, SectorInternalData>
}

function createEmptyStationComponentGapFlows(): StationComponentGapFlows {
  return {
    operations: [],
    supply: []
  }
}

function buildSectorLinksInput(sectorLinks: string[]): SectorLinkInput[] {
  return (sectorLinks || [])
    .map((key) => parseSectorLinkKey(key))
    .filter((item): item is { a: string; b: string } => !!item)
    .map((item) => ({
      linkId: `${item.a}|${item.b}`,
      a: item.a,
      b: item.b,
      distance: 1
    }))
}

function sortFlows(list: EmpireWareFlow[]): EmpireWareFlow[] {
  return list.sort((a, b) => {
    if ((a.orderIndex ?? 0) !== (b.orderIndex ?? 0)) return (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    if ((a.tier ?? 0) !== (b.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0)
    return Math.abs(b.netRate || 0) - Math.abs(a.netRate || 0)
  })
}

function cloneContribution(detail: StationFlowAtom & { sortOrder?: number }): StationFlowAtom & { sortOrder?: number } {
  return { ...detail }
}

export function buildStationComponentGapFlows(input: BuildStationComponentGapFlowsInput): StationComponentGapFlows {
  const { currentSectorId, sectors, sectorLinks, orderedStations, sectorInternalDataMap } = input
  if (!currentSectorId) return createEmptyStationComponentGapFlows()

  const sectorIds = sectors.map((sector) => sector.id)
  const links = buildSectorLinksInput(sectorLinks)
  const component = getSectorNetworkComponent(currentSectorId, sectorIds, links)
  const componentSectorIds = component?.sectorIds || []
  if (componentSectorIds.length === 0) return createEmptyStationComponentGapFlows()

  const sectorNameMap = new Map(sectors.map((sector) => [sector.id, sector.name]))
  const sectorOrderMap = new Map(sectors.map((sector, index) => [sector.id, index]))
  const currentSectorStationOrderMap = new Map(
    orderedStations
      .filter((station) => station.sectorId === currentSectorId)
      .map((station, index) => [station.id, index])
  )

  const operationsByWare = new Map<string, EmpireWareFlow>()
  const supplyByWare = new Map<string, EmpireWareFlow>()

  const appendFlow = (
    bucket: Map<string, EmpireWareFlow>,
    flow: EmpireWareFlow,
    contributions: Array<StationFlowAtom & { sortOrder?: number }>
  ) => {
    const current = bucket.get(flow.wareId)
    if (!current) {
      bucket.set(flow.wareId, {
        ...flow,
        contributions: contributions.map(cloneContribution)
      })
      return
    }
    current.production += flow.production || 0
    current.consumption += flow.consumption || 0
    current.workforceConsumption += flow.workforceConsumption || 0
    current.netRate += flow.netRate || 0
    current.contributions.push(...contributions.map(cloneContribution))
  }

  componentSectorIds.forEach((sectorId) => {
    const internal = sectorInternalDataMap.get(sectorId)
    if (!internal) return

    const localFlows = internal.localGroupedFlows
    const sectorName = sectorNameMap.get(sectorId) || sectorId
    const isCurrentSector = sectorId === currentSectorId
    const externalSortOrder = 100000 + (sectorOrderMap.get(sectorId) ?? Number.MAX_SAFE_INTEGER / 2)

    localFlows.empireGroups.operations
      .filter((flow) => flow.transportType === 'container')
      .forEach((flow) => {
        const contributions = isCurrentSector
          ? (flow.contributions || []).map((detail) => ({
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
              sortOrder: externalSortOrder
            }]
        appendFlow(operationsByWare, flow, contributions)
      })

    localFlows.empireGroups.supply
      .filter((flow) => flow.transportType === 'container')
      .forEach((flow) => {
        const contributions = isCurrentSector
          ? (flow.contributions || []).map((detail) => ({
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
              sortOrder: externalSortOrder
            }]
        appendFlow(supplyByWare, flow, contributions)
      })
  })

  // Keep previous behavior: if a ware exists in supply, merge same ware from operations into supply.
  const mergedSupplyByWare = new Map<string, EmpireWareFlow>(Array.from(supplyByWare.entries()))
  const mergedOperationsByWare = new Map<string, EmpireWareFlow>()
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
    supplyFlow.contributions.push(...(opFlow.contributions || []))
  })

  return {
    operations: sortFlows(Array.from(mergedOperationsByWare.values())),
    supply: sortFlows(Array.from(mergedSupplyByWare.values()))
  }
}
