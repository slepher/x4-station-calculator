import type { TransportType, WareFlow } from './x4'

export interface FlowContribution {
  id: string
  class: string
  type: 'production' | 'consumption'
  count: number
  amount: number
  bonusPercent: number
  volumeFlow?: number
  valueFlow?: number
  transportFlow?: number
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

export interface DerivedStationFlowAtom extends FlowContribution {
  stationName: string
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
}

export interface DerivedProductionFlow extends WareFlow {
}
