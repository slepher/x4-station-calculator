import type { TransportType, ModuleFlowAtom, StationFlowAtom, WareFlow } from './x4'

export interface BaseModuleFlowAtom {
  moduleId: string
  count: number
  type: 'production' | 'consumption'
  amount: number
  bonusPercent: number
}

export interface WareProductionFlow {
  wareId: string
  orderIndex: number
  tier: number
  transportType: TransportType
  unitVolume: number

  production: number
  consumption: number
  workforceConsumption: number
  netRate: number

  contributions: BaseModuleFlowAtom[]
  stationContributions?: StationFlowAtom[]
}

export interface DerivedStationFlowAtom extends StationFlowAtom {
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
}

export interface DerivedProductionFlow extends WareFlow {
  stationContributions?: DerivedStationFlowAtom[]
  contributions: ModuleFlowAtom[]
}
