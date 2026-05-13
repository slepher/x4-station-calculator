import type {
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  EmpireGroupedFlows,
  SectorPlan,
  StationPlan
} from './x4'
import type { WareFlowViewMode, EmpireGapItem } from './production-ui'

export interface ProductionTabBarContext {
  sectors: SectorPlan[]
  orderedStationsBySector: StationPlan[]
  activeStationId: string | null
  isBindingMode: boolean
  getLinkedSectors: (sectorId: string) => string[]
  selectOverview: () => void
  selectTransit: (sectorId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => void
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => void
  deleteStation: (stationId: string) => void
}

export interface ProductionToolbarContext {
  mode: 'overview' | 'station' | 'transit'
  isBindingMode: boolean
  title: { value: string; placeholder: string }
  station: {
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null
  settings: StationSettings | null
  races: Array<{ value: string; label: string }>
  stationTypes: Array<{ value: StationType; label: string }>
  availableMinerals: string[]
  singleBerthThroughput: number
  updateTitle: (value: string) => void
  updateStationName: (value: string) => void
  updateStationType: (value: StationType) => void
  updateStationCount: (value: number) => void
  toggleMineral: (mineral: string) => void
  updateSunlight: (value: number) => void
  updateTransportMinutes: (value: number) => void
  updateRacePreference: (value: string) => void
  updateWorkforce: (value: boolean) => void
  updateShowEmpireGaps: (value: boolean) => void
  openImport: () => void
}

export interface ProductionPlanningContext {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  filteredModulesGrouped: any[]
  searchQuery: string
  enforceDlcActivation: boolean
  flashingModuleIds: string[]
  highlightedModuleIds: string[]
  updateSearchQuery: (value: string) => void
  addModule: (moduleId: string) => void
  removeModule: (index: number) => void
  updateModuleCount: (index: number, count: number) => void
  reorderModules: (modules: SavedModule[]) => void
  applyScale: (scale: number) => void
  transferAutoModule: (module: SavedModule) => void
}

export interface ProductionWareFlowsContext {
  viewMode: WareFlowViewMode
  groupedFlows: GroupedFlows
  settings: {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
  }
  empireGaps: {
    operations: EmpireGapItem[]
    supply: EmpireGapItem[]
  }
  plannedModules: SavedModule[]
  wares: Record<string, any>
  updateViewMode: (value: WareFlowViewMode) => void
  updateResourceBufferHours: (value: number) => void
  updatePrimaryProductBufferHours: (value: number) => void
  updateSecondaryProductBufferHours: (value: number) => void
  updateBuyMultiplier: (value: number) => void
  updateSellMultiplier: (value: number) => void
  addGapModule: (wareId: string) => void
  removeGapModule: (wareId: string) => void
}

export interface ProductionDashboardContext {
  plannedModules: SavedModule[]
  stationAnalysis: {
    totalCost: number
    totalVolume: number
    totalNeeded: number
    totalCapacity: number
    totalTime: number
    playerHQNeeded: number
    totalWorkerDiff: number
    moduleGroups: any[]
    summaryItems: any[]
  }
  settings: {
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }
  currentEfficiency: number
  actualWorkforce: number
  buildPriceMultiplier: number
  hideWorkersView?: boolean
  updateTransportShipCapacity: (value: number) => void
  updateBuildPriceMultiplier: (value: number) => void
  updateManualWorkforce: (value: number) => void
  updateWorkforceAuto: (value: boolean) => void
  updateUseHQ: (value: boolean) => void
}

export interface ProductionTransitHubContext {
  sectorId: string
  groupedFlows: EmpireGroupedFlows
  storageFlows: any[]
  storageModulePlans: any[]
  supplyBuildModules: SavedModule[]
  viewMode: WareFlowViewMode
  buildPriceMultiplier: number
  useHQ: boolean
  updateViewMode: (value: WareFlowViewMode) => void
  updateBuildPriceMultiplier: (value: number) => void
  updateUseHQ: (value: boolean) => void
}

export interface ProductionImportContext {
  isOpen: boolean
  initialTab: 'logic-flow' | 'game-blueprint' | 'x4-station'
  isOverview: boolean
  activeStationId: string | null
  activeStation: { id: string; modules: SavedModule[] } | null
  createStation: (name: string, type?: StationType) => { id: string; modules: SavedModule[] } | null
  applyImportedStationPayload: (stationId: string, payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }) => void
  updateStationModules: (stationId: string, modules: SavedModule[]) => void
  getStationById: (stationId: string) => { id: string; modules: SavedModule[] } | null
  openImport: () => void
  closeImport: () => void
}

export interface ProductionOverviewContext {
  groupedFlows: EmpireGroupedFlows
  viewMode: WareFlowViewMode
  updateViewMode: (value: WareFlowViewMode) => void
}

export interface ProductionSessionContext {
  isDirty: boolean
  save: () => void
  discard: () => void
  canSave: boolean
  canDiscard: boolean
}