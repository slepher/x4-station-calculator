import type {
  StationType,
  SavedModule,
  StationSettings
} from './x4'
import type { WareAmount } from './saveArchive'
import type { WareProductionFlow, DerivedProductionFlow } from './production-flow'
import type { EmpireGapItem, WareFlowViewMode, ProductionTabItem as UiProductionTabItem } from './production-ui'

export interface ProductionWorkbenchCapabilities {
  uniqueWorkbench: boolean
  uniqueStation: boolean
  hasSectors: boolean
}

export type ProductionTabItem = UiProductionTabItem

export interface ProductionSessionState {
  workbenchMode: 'overview' | 'station' | 'transit'
  entityType: 'overview' | 'station' | 'transit'
  mode: 'planning' | 'live'
  visualMode: 'planning' | 'live'
  activeStationId: string | null
  activeTransitSectorId: string | null
  activeBinding: string | null
  canToggle: boolean
  wareflowViewMode: WareFlowViewMode
}

export interface ProductionContextState {
  stationCode: string
  sectorId: string | null
  sectorName: string
  sectorNameId?: string
  position?: { x: number; y: number; z: number }
  sectorResources: string[]
  sectorSunlight: number
  hasBinding: boolean
  hasArchive: boolean
}

export interface LiveVolumeAllocationItem {
  wareId: string
  name: string
  transportType: 'container' | 'solid' | 'liquid'
  orderIndex: number
  tier: number
  currentCount: number
  targetCount: number
  recommendedCount: number
  scaleMaxCount: number
  detailSections: LiveVolumeAllocationDetailSection[]
}

export interface LiveVolumeAllocationGroup {
  key: 'container' | 'solid' | 'liquid'
  items: LiveVolumeAllocationItem[]
  currentTotalVolume: number
  targetTotalVolume: number
  recommendedTotalVolume: number
}

export interface LiveVolumeAllocationDetailRow {
  key: string
  label: string
  ratePerHour?: number
  currentMinutes?: number
  targetMinutes?: number
  recommendedMinutes?: number
}

export interface LiveVolumeAllocationDetailSection {
  key: string
  title: string
  includeCurrentColumn: boolean
  rows: LiveVolumeAllocationDetailRow[]
}

export interface LiveCargoOnlyItem {
  wareId: string
  name: string
  tier: number
  currentCount: number
  targetCount: number
}

export interface ProductionStationState {
  entityType: 'station' | 'transit'
  id: string
  name: string
  stationType?: StationType
  count?: number
  minerals?: string[]
  plannedModules: SavedModule[]
  resolvedModules: SavedModule[]
  modules: SavedModule[]
  buildingModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  derivedProductionFlows: DerivedProductionFlow[]
  warePriorityLevels: Record<string, number>
  settings: StationSettings
  enforceDlcActivation: boolean
  empireGaps: { operations: EmpireGapItem[]; supply: EmpireGapItem[] }
  currentEfficiency: number
  actualWorkforce: number
  buildPriceMultiplier: number
  buildingCargo: WareAmount[]
  buildingReservation: WareAmount[]
  buildingInProgress?: SavedModule
}

export type ProductionWorkbenchSessionState = ProductionSessionState
export type ProductionWorkbenchContextState = ProductionContextState

export type ProductionRemoveModuleTarget =
  | { index: number }
