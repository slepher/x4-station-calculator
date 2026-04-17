import type {
  StationType,
  SavedModule,
  StationSettings
} from './x4'
import type { WareProductionFlow } from './production-flow'
import type { StationAnalysis } from '../store/logic/analyzeStation'

export interface ProductionWorkbenchCapabilities {
  uniqueWorkbench: boolean
  uniqueStation: boolean
  hasSectors: boolean
}

export interface ProductionTabItem {
  id: string
  type: 'station' | 'transit' | 'overview'
  name: string
  sectorId?: string
  stationType?: StationType
}

export interface ProductionSessionState {
  workbenchMode: 'overview' | 'station' | 'transit'
  entityType: 'overview' | 'station' | 'transit'
  mode: 'planning' | 'live'
  visualMode: 'planning' | 'live'
  activeStationId: string | null
  activeTransitSectorId: string | null
  activeBinding: string | null
  canToggle: boolean
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
  plannedModules: SavedModule[]
  resolvedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  stationAnalysis: StationAnalysis
  settings: StationSettings
}

export type ProductionWorkbenchSessionState = ProductionSessionState
export type ProductionWorkbenchContextState = ProductionContextState

export type ProductionRemoveModuleTarget =
  | { index: number }