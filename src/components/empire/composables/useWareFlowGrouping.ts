import type { GroupedFlows, WareFlow } from '@/types/x4'
import type { DerivedProductionFlow } from '@/types/production-flow'

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

function groupProductionFlows(productionFlows: DerivedProductionFlow[]): GroupedFlows {
  const wareFlows: WareFlow[] = [...productionFlows]
  const groupedFlows: GroupedFlows = {
    flows: wareFlows,
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
  wareFlows.forEach(flow => {
    if (flow.netRate > 0) groupedFlows.rateGroups.positive.push(flow)
    else if (flow.contributions.some(c => c.class === 'workforce')) groupedFlows.rateGroups.supply.push(flow)
    else if (flow.transportType === 'container') groupedFlows.rateGroups.operations.push(flow)
    else groupedFlows.rateGroups.resources.push(flow)
    if (flow.transportType === 'solid') groupedFlows.volumeGroups.solid.push(flow)
    else if (flow.transportType === 'liquid') groupedFlows.volumeGroups.liquid.push(flow)
    else groupedFlows.volumeGroups.container.push(flow)
  })
  return groupedFlows
}

export interface WareFlowGroupingInput {
  productionFlows: DerivedProductionFlow[]
}

export function computeGroupedFlows(input: WareFlowGroupingInput): GroupedFlows {
  if (input.productionFlows.length === 0) {
    return createEmptyGroupedFlows()
  }
  return groupProductionFlows(input.productionFlows)
}

export function useWareFlowGrouping() {
  return { computeGroupedFlows }
}
