import type {
  StationType,
  SavedModule,
  StationSettings
} from './x4'
import type { WareProductionFlow } from './production-flow'
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
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
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
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  settings: StationSettings
  enforceDlcActivation: boolean
  empireGaps: { operations: EmpireGapItem[]; supply: EmpireGapItem[] }
  currentEfficiency: number
  actualWorkforce: number
  buildPriceMultiplier: number
}

export type ProductionWorkbenchSessionState = ProductionSessionState
export type ProductionWorkbenchContextState = ProductionContextState

export type ProductionRemoveModuleTarget =
  | { index: number }
