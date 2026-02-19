import type {
  StationPlan,
  GroupedFlows,
  WareFlow,
  EmpireWareFlow,
  EmpireGroupedFlows,
  StationFlowAtom
} from '../../types/x4'

interface StationFlowData {
  station: StationPlan;
  flows: GroupedFlows;
}

function multiplyFlow(flow: WareFlow, multiplier: number): WareFlow {
  return {
    ...flow,
    production: flow.production * multiplier,
    consumption: flow.consumption * multiplier,
    workforceConsumption: flow.workforceConsumption * multiplier,
    netRate: flow.netRate * multiplier,
    productionVolume: flow.productionVolume * multiplier,
    consumptionVolume: flow.consumptionVolume * multiplier,
    netVolume: flow.netVolume * multiplier,
    totalOccupiedCount: flow.totalOccupiedCount * multiplier,
    totalOccupiedConsumptionCount: flow.totalOccupiedConsumptionCount * multiplier,
    totalOccupiedVolume: flow.totalOccupiedVolume * multiplier,
    netValue: flow.netValue * multiplier,
    contributions: flow.contributions.map(c => ({
      ...c,
      amount: c.amount * multiplier
    }))
  }
}

function aggregateFlows(
  flowsByWareId: Map<string, { flow: WareFlow; station: StationPlan }[]>
): EmpireWareFlow[] {
  const result: EmpireWareFlow[] = []
  
  flowsByWareId.forEach((items, wareId) => {
    if (items.length === 0) return
    
    const firstItem = items[0]
    if (!firstItem) return
    
    const firstFlow = firstItem.flow
    let totalProduction = 0
    let totalConsumption = 0
    let totalWorkforceConsumption = 0
    let totalNetRate = 0
    let totalNetValue = 0
    const contributions: StationFlowAtom[] = []
    
    items.forEach(({ flow, station }) => {
      totalProduction += flow.production
      totalConsumption += flow.consumption
      totalWorkforceConsumption += flow.workforceConsumption
      totalNetRate += flow.netRate
      totalNetValue += flow.netValue
      
      contributions.push({
        stationId: station.id,
        stationName: station.name,
        stationCount: station.count ?? 1,
        production: flow.production,
        consumption: flow.consumption,
        workforceConsumption: flow.workforceConsumption,
        netRate: flow.netRate,
        netValue: flow.netValue
      })
    })
    
    result.push({
      wareId,
      orderIndex: firstFlow.orderIndex,
      tier: firstFlow.tier,
      transportType: firstFlow.transportType,
      unitVolume: firstFlow.unitVolume,
      production: totalProduction,
      consumption: totalConsumption,
      workforceConsumption: totalWorkforceConsumption,
      netRate: totalNetRate,
      unitPrice: firstFlow.unitPrice,
      netValue: totalNetValue,
      contributions
    })
  })
  
  return result.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
}

function mergeEmpireFlow(target: EmpireWareFlow, source: EmpireWareFlow): EmpireWareFlow {
  return {
    ...target,
    production: target.production + source.production,
    consumption: target.consumption + source.consumption,
    workforceConsumption: target.workforceConsumption + source.workforceConsumption,
    netRate: target.netRate + source.netRate,
    netValue: target.netValue + source.netValue,
    contributions: [...target.contributions, ...source.contributions]
  }
}

export function analyzeEmpireWareFlow(
  stations: StationPlan[],
  getStationFlowCache: (stationId: string) => GroupedFlows | null
): EmpireGroupedFlows {
  const stationFlowData: StationFlowData[] = []
  
  stations.forEach(station => {
    const count = station.count ?? 1
    if (count === 0) return
    
    const flows = getStationFlowCache(station.id)
    if (!flows) return
    
    stationFlowData.push({ station, flows })
  })
  
  const supplyByWareId = new Map<string, { flow: WareFlow; station: StationPlan }[]>()
  const candidatesByWareId = new Map<string, { flow: WareFlow; station: StationPlan }[]>()
  
  stationFlowData.forEach(({ station, flows }) => {
    const count = station.count ?? 1
    
    flows.rateGroups.supply.forEach(flow => {
      const multiplied = multiplyFlow(flow, count)
      if (!supplyByWareId.has(flow.wareId)) {
        supplyByWareId.set(flow.wareId, [])
      }
      supplyByWareId.get(flow.wareId)!.push({ flow: multiplied, station })
    })
    
    flows.rateGroups.operations.forEach(flow => {
      const multiplied = multiplyFlow(flow, count)
      if (!candidatesByWareId.has(flow.wareId)) {
        candidatesByWareId.set(flow.wareId, [])
      }
      candidatesByWareId.get(flow.wareId)!.push({ flow: multiplied, station })
    })
    
    flows.rateGroups.positive.forEach(flow => {
      const multiplied = multiplyFlow(flow, count)
      if (!candidatesByWareId.has(flow.wareId)) {
        candidatesByWareId.set(flow.wareId, [])
      }
      candidatesByWareId.get(flow.wareId)!.push({ flow: multiplied, station })
    })
  })
  
  const supplyFlows = aggregateFlows(supplyByWareId)
  const supplyByWareIdMap = new Map<string, EmpireWareFlow>()
  supplyFlows.forEach(flow => {
    supplyByWareIdMap.set(flow.wareId, flow)
  })
  const supplyWareIdSet = new Set(supplyByWareIdMap.keys())
  
  const products: EmpireWareFlow[] = []
  const operations: EmpireWareFlow[] = []
  
  const candidateFlows = aggregateFlows(candidatesByWareId)
  candidateFlows.forEach(flow => {
    if (supplyWareIdSet.has(flow.wareId)) {
      const existingSupply = supplyByWareIdMap.get(flow.wareId)
      if (existingSupply) {
        supplyByWareIdMap.set(flow.wareId, mergeEmpireFlow(existingSupply, flow))
      } else {
        supplyByWareIdMap.set(flow.wareId, flow)
      }
    } else if (flow.netRate > 0) {
      products.push(flow)
    } else if (flow.netRate < 0) {
      operations.push(flow)
    }
  })
  const mergedSupplyFlows = Array.from(supplyByWareIdMap.values()).sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
  
  const allFlows = [...products, ...operations, ...mergedSupplyFlows].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
  
  return {
    flows: allFlows,
    empireGroups: {
      products,
      operations,
      supply: mergedSupplyFlows
    }
  }
}
