import type { GroupedFlows } from '@/types/x4'
import type { DerivedProductionFlow } from '@/types/production-flow'
import { groupDerivedProductionFlows } from '@/store/logic/calculateWareFlowDerived'

export interface WareFlowGroupingInput {
  productionFlows: DerivedProductionFlow[]
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

export function computeGroupedFlows(input: WareFlowGroupingInput): GroupedFlows {
  if (input.productionFlows.length === 0) {
    return createEmptyGroupedFlows()
  }

  return groupDerivedProductionFlows(input.productionFlows)
}

export function useWareFlowGrouping() {
  return { computeGroupedFlows }
}
