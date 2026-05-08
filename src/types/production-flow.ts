import type { TransportType, WareFlow } from './x4'

export type WorkforceContributionClass = 'workforce' | 'workforce_idle'

export function isWorkforceContributionClass(cls: string): cls is WorkforceContributionClass {
  return cls === 'workforce' || cls === 'workforce_idle'
}

export interface FlowContribution {
  id: string
  class: 'module' | WorkforceContributionClass | 'station' | 'sector'
  type: 'production' | 'consumption'
  count: number
  amount: number
  bonusPercent: number
}

export interface DerivedFlowContribution extends FlowContribution {
  name: string
  valueContribution: number
  volumeContribution: number
  transportContribution: number
  sortOrder?: number
}

export interface WareProductionFlow {
  wareId: string
  orderIndex: number
  tier: number
  transportType: TransportType
  unitVolume: number

  production: number
  consumption: number
  netRate: number

  contributions: FlowContribution[]
}

export interface DerivedProductionFlow extends WareFlow {
}
