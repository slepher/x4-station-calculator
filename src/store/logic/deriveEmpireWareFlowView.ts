import type { EmpireGroupedFlows, EmpireWareFlow, X4Ware } from '@/types/x4'
import type { DerivedFlowContribution } from '@/types/production-flow'
import { getPriceByMultiplier } from '@/store/logic/calculatorUtils'

export interface DerivedEmpireWareFlow extends EmpireWareFlow {
  unitPrice: number
  netValue: number
  contributions: DerivedFlowContribution[]
}

export interface DerivedEmpireGroupedFlows {
  flows: DerivedEmpireWareFlow[]
  empireGroups: {
    operations: DerivedEmpireWareFlow[]
    supply: DerivedEmpireWareFlow[]
  }
}

export function deriveEmpireWareFlows(input: {
  groupedFlows: EmpireGroupedFlows
  waresMap: Record<string, X4Ware>
  buyMultiplier: number
  sellMultiplier: number
}): DerivedEmpireGroupedFlows {
  const deriveFlow = (flow: EmpireWareFlow): DerivedEmpireWareFlow => {
    const isSurplus = flow.netRate >= 0
    const multiplier = isSurplus ? input.sellMultiplier : input.buyMultiplier
    const ware = input.waresMap[flow.wareId]
    const unitPrice = getPriceByMultiplier(ware || {
      minPrice: flow.minPrice,
      price: flow.avgPrice,
      maxPrice: flow.maxPrice
    } as X4Ware, multiplier)

    return {
      ...flow,
      unitPrice,
      netValue: flow.netRate * unitPrice,
      contributions: flow.contributions.map((contrib) => ({
        ...contrib,
        name: (contrib as unknown as Record<string, string>).name || '',
        netValue: contrib.amount * unitPrice
      }))
    }
  }

  const flows = input.groupedFlows.flows.map(deriveFlow)
  const operationsById = new Set(input.groupedFlows.empireGroups.operations.map((flow) => flow.wareId))
  const supplyById = new Set(input.groupedFlows.empireGroups.supply.map((flow) => flow.wareId))

  return {
    flows,
    empireGroups: {
      operations: flows.filter((flow) => operationsById.has(flow.wareId)),
      supply: flows.filter((flow) => supplyById.has(flow.wareId))
    }
  }
}
