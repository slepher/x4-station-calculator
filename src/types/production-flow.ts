import type { TransportType, ModuleFlowAtom } from './x4'

export interface WareProductionFlow {
  wareId: string
  orderIndex: number
  tier: number
  transportType: TransportType
  unitVolume: number

  minPrice: number
  price: number
  maxPrice: number

  production: number
  consumption: number
  workforceConsumption: number
  netRate: number

  contributions: ModuleFlowAtom[]
}