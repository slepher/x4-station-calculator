import type {
  StationPlan,
  EmpireWareFlow,
  EmpireGroupedFlows,
  StationFlowAtom,
  X4Ware
} from '../../types/x4'
import type { WareProductionFlow } from '../../types/production-flow'

interface StationFlowData {
  station: StationPlan;
  flows: WareProductionFlow[];
}

function multiplyProductionFlow(flow: WareProductionFlow, multiplier: number): WareProductionFlow {
  return {
    ...flow,
    production: flow.production * multiplier,
    consumption: flow.consumption * multiplier,
    workforceConsumption: flow.workforceConsumption * multiplier,
    netRate: flow.netRate * multiplier,
    contributions: flow.contributions.map(c => ({
      ...c,
      amount: c.amount * multiplier,
      volumeFlow: c.volumeFlow * multiplier,
      valueFlow: c.valueFlow * multiplier,
      transportFlow: c.transportFlow ? c.transportFlow * multiplier : undefined
    }))
  }
}

function classifyProductionFlow(flow: WareProductionFlow): 'positive' | 'supply' | 'operations' | 'resources' {
  if (flow.netRate >= 0) return 'positive'
  if (flow.workforceConsumption > 0) return 'supply'
  if (flow.transportType === 'container') return 'operations'
  return 'resources'
}

function aggregateProductionFlows(
  flowsByWareId: Map<string, { flow: WareProductionFlow; station: StationPlan }[]>,
  waresMap: Record<string, X4Ware>
): EmpireWareFlow[] {
  const result: EmpireWareFlow[] = []
  
  flowsByWareId.forEach((items, wareId) => {
    if (items.length === 0) return
    
    const firstItem = items[0]
    if (!firstItem) return
    
    const firstFlow = firstItem.flow
    const ware = waresMap[wareId]
    let totalProduction = 0
    let totalConsumption = 0
    let totalWorkforceConsumption = 0
    let totalNetRate = 0
    const contributions: StationFlowAtom[] = []
    
    items.forEach(({ flow, station }) => {
      totalProduction += flow.production
      totalConsumption += flow.consumption
      totalWorkforceConsumption += flow.workforceConsumption
      totalNetRate += flow.netRate
      
      contributions.push({
        stationId: station.id,
        stationName: station.name,
        stationCount: station.count ?? 1,
        production: flow.production,
        consumption: flow.consumption,
        workforceConsumption: flow.workforceConsumption,
        netRate: flow.netRate
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
      minPrice: ware?.minPrice || 0,
      avgPrice: ware?.price || 0,
      maxPrice: ware?.maxPrice || 0,
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
    contributions: [...target.contributions, ...source.contributions]
  }
}

export function analyzeEmpireWareFlow(
  stations: StationPlan[],
  getStationProductionFlows: (stationId: string) => WareProductionFlow[] | null,
  waresMap: Record<string, X4Ware>
): EmpireGroupedFlows {
  const stationFlowData: StationFlowData[] = []
  
  stations.forEach(station => {
    const count = station.count ?? 1
    if (count === 0) return
    
    const flows = getStationProductionFlows(station.id)
    if (!flows || flows.length === 0) return
    
    stationFlowData.push({ station, flows })
  })
  
  const supplyByWareId = new Map<string, { flow: WareProductionFlow; station: StationPlan }[]>()
  const candidatesByWareId = new Map<string, { flow: WareProductionFlow; station: StationPlan }[]>()
  
  stationFlowData.forEach(({ station, flows }) => {
    const count = station.count ?? 1
    
    flows.forEach(flow => {
      const multiplied = multiplyProductionFlow(flow, count)
      const category = classifyProductionFlow(flow)
      
      if (category === 'supply') {
        if (!supplyByWareId.has(flow.wareId)) {
          supplyByWareId.set(flow.wareId, [])
        }
        supplyByWareId.get(flow.wareId)!.push({ flow: multiplied, station })
      } else if (category === 'positive' || category === 'operations') {
        if (!candidatesByWareId.has(flow.wareId)) {
          candidatesByWareId.set(flow.wareId, [])
        }
        candidatesByWareId.get(flow.wareId)!.push({ flow: multiplied, station })
      }
    })
  })
  
  const supplyFlows = aggregateProductionFlows(supplyByWareId, waresMap)
  const supplyByWareIdMap = new Map<string, EmpireWareFlow>()
  supplyFlows.forEach(flow => {
    supplyByWareIdMap.set(flow.wareId, flow)
  })
  const supplyWareIdSet = new Set(supplyByWareIdMap.keys())
  
  const operations: EmpireWareFlow[] = []
  
  const candidateFlows = aggregateProductionFlows(candidatesByWareId, waresMap)
  candidateFlows.forEach(flow => {
    if (supplyWareIdSet.has(flow.wareId)) {
      const existingSupply = supplyByWareIdMap.get(flow.wareId)
      if (existingSupply) {
        supplyByWareIdMap.set(flow.wareId, mergeEmpireFlow(existingSupply, flow))
      } else {
        supplyByWareIdMap.set(flow.wareId, flow)
      }
    } else {
      operations.push(flow)
    }
  })
  
  const mergedSupplyFlows = Array.from(supplyByWareIdMap.values()).sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
  
  const allFlows = [...operations, ...mergedSupplyFlows].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
  
  return {
    flows: allFlows,
    empireGroups: {
      operations,
      supply: mergedSupplyFlows
    }
  }
}