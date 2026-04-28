import type { TransportType, WareFlow } from './x4'

export interface FlowContribution {
  id: string
  class: 'module' | 'workforce' | 'station' | 'sector'
  type: 'production' | 'consumption'
  count: number
  amount: number
  bonusPercent: number
}

export interface DerivedFlowContribution extends FlowContribution {
  name: string
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
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
