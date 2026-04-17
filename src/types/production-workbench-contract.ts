import type {
  StationType,
  SavedModule,
  StationSettings
} from './x4'
import type { WareFlowViewMode, EmpireGapItem } from './production-ui'
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

export interface ImportPayload {
  modules: SavedModule[]
  lockedWares: string[]
  warePriority: Record<string, number>
}

export interface ProductionAddModuleOptions {
  wareId?: string
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

export interface ProductionWorkbenchStoreContract {
  mode: 'blueprint' | 'live'
  capabilities: ProductionWorkbenchCapabilities

  session: ProductionSessionState
  context: ProductionContextState
  stationState: ProductionStationState | null

  getTabs(): ProductionTabItem[]
  getActiveTabId(): string | null
  getExpandedSectorId(): string | null
  getWorkbenchMode(): 'overview' | 'station' | 'transit'
  getActiveStationId(): string | null
  getActiveTransitSectorId(): string | null
  getSessionState(): ProductionWorkbenchSessionState
  getContextState(): ProductionWorkbenchContextState

  getTitleModel(): { value: string; placeholder: string }
  getToolbarStation(): { id: string; name: string; type: StationType; count: number; minerals: string[] } | null
  getToolbarSettings(): StationSettings | null
  getToolbarRaces(): Array<{ value: string; label: string }>
  getToolbarStationTypes(): Array<{ value: StationType; label: string }>
  getAvailableMinerals(): string[]
  getSingleBerthThroughput(): number

  getToolbarStationCode(): string
  getToolbarSectorName(): string
  getToolbarSectorNameId(): string | undefined
  getToolbarStationPosition(): { x: number; y: number; z: number } | undefined
  getToolbarSectorResources(): string[]
  getToolbarSectorSunlight(): number

  getPlannedModules(): SavedModule[]
  getAutoModules(): SavedModule[]
  getAutoHabitationModules(): SavedModule[]
  getAutoInfrastructureModules(): SavedModule[]
  getResolvedModules(): SavedModule[]
  getEnforceDlcActivation(): boolean

  getWareflowViewMode(): WareFlowViewMode
  getProductionFlows(): WareProductionFlow[]
  getWarePriorityLevels(): Record<string, number>
  getWareflowSettings(): {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }
  getEmpireGaps(): { operations: EmpireGapItem[]; supply: EmpireGapItem[] }

  getStationAnalysis(): StationAnalysis
  getDashboardSettings(): {
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }
  getCurrentEfficiency(): number
  getActualWorkforce(): number
  getBuildPriceMultiplier(): number

  isOverview(): boolean
  getProductionSource(): 'empire' | 'save-binding'
  getImportActiveStationId(): string | null
  getImportActiveStation(): { id: string; modules: SavedModule[] } | null

  selectOverview(): void
  selectTransit(sectorId: string): void
  selectStation(stationId: string): void
  expandSector(sectorId: string | null): void

  createStation(name?: string, type?: StationType): string | null
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): string | null
  deleteStation(stationId: string): void

  updateTitle(value: string): void
  updateStationName(value: string): void
  updateStationType(value: StationType): void
  updateStationCount(value: number): void
  toggleMineral(mineral: string): void
  updateSunlight(value: number): void
  updateTransportMinutes(value: number): void
  updateRacePreference(value: string): void
  updateWorkforce(value: boolean): void
  updateShowEmpireGaps(value: boolean): void

  updatePlannedModules(modules: SavedModule[]): void
  addModule(moduleId: string, count?: number): void
  addWareModule(wareId: string): void
  removeWareModule(wareId: string): void
  removeModule(index: number): void
  updateModuleCount(index: number, count: number): void

  updateWareflowViewMode(value: WareFlowViewMode): void
  updateResourceBufferHours(value: number): void
  updatePrimaryProductBufferHours(value: number): void
  updateSecondaryProductBufferHours(value: number): void
  updateBuyMultiplier(value: number): void
  updateSellMultiplier(value: number): void
  toggleWareLock(wareId: string): void
  toggleWarePriority(wareId: string): void

  updateTransportShipCapacity(value: number): void
  updateBuildPriceMultiplier(value: number): void
  updateManualWorkforce(value: number): void
  updateWorkforceAuto(value: boolean): void
  updateUseHQ(value: boolean): void
  updateTransitHubSettings(patch: Partial<StationSettings>): void

  openImport(): void
  applyImportedStationPayload(stationId: string, payload: ImportPayload): void
  updateStationModules(stationId: string, modules: SavedModule[]): void
  getStationById(stationId: string): { id: string; modules: SavedModule[] } | null

  isWareLocked(wareId: string): boolean
  getResolvedLevel(wareId: string): number
  isWareOperable(wareId: string): boolean
  isPlannedWare(wareId: string): boolean
}