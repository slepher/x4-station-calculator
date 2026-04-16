import type { TransportType, ModuleFlowAtom, StationFlowAtom } from './x4'

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

  productionVolume: number
  consumptionVolume: number
  netVolume: number

  contributions: ModuleFlowAtom[]
  stationContributions?: StationFlowAtom[]
}
