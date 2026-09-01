import type { StationType, SavedModule, ModuleGroupResult, GroupedFlows, StationSettings, EmpireGroupedFlows } from './x4'

export type WareFlowViewMode = 'quantity' | 'volume' | 'economy' | 'transport'

export interface ProductionTabItem {
  id: string
  type: 'station' | 'transit' | 'overview' | 'npc-trade' | 'terraforming' | 'tech-tree' | 'research' | 'blueprint-recipe' | 'auto-sector-group'
  name: string
  sectorId?: string
  stationType?: StationType
  tag?: string
  factoryGroup?: string
  temperatureState?: number
}

export interface StationTabBarProps {
  tabs: ProductionTabItem[]
  activeTabId: string | null
  expandedSectorId: string | null
  canCreateStation: boolean
  canOpenContextMenu: boolean
}

export interface StationTabBarEmits {
  selectOverview: () => void
  selectTransit: (sectorId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => void
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => void
  deleteStation: (stationId: string) => void
  expandSector: (sectorId: string | null) => void
}

export interface ContextToolbarProps {
  mode: 'overview' | 'station' | 'transit'
  isBindingMode: boolean
  titleModel: {
    value: string
    placeholder: string
  }
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
}

export interface ContextToolbarEmits {
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

export interface StationPlanningPanelProps {
  plannedModules: SavedModule[]
  recommendedModules?: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules?: SavedModule[]
  enforceDlcActivation: boolean
}

export interface StationPlanningPanelEmits {
  updatePlannedModules: (modules: SavedModule[]) => void
}

export interface StationModulePickerProps {
  searchQuery: string
  filteredModulesGrouped: ModuleGroupResult[]
}

export interface StationModulePickerEmits {
  updateSearchQuery: (value: string) => void
  selectModule: (moduleId: string) => void
}

export interface EmpireGapItem {
  id: string
  wareId: string
  netRate: number
  netValue: number
  tier: number
  contributions?: any[]
  disableAdd: boolean
  disableRemove: boolean
}

export interface StationWareFlowsDashboardProps {
  viewMode: WareFlowViewMode
  groupedFlows: GroupedFlows
  autoModules: SavedModule[]
  settings: {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }
  empireGaps: {
    operations: EmpireGapItem[]
    supply: EmpireGapItem[]
  }
  plannedModules: SavedModule[]
  wares: Record<string, any>
  modulesMap?: Record<string, any>
  isWareLocked?: (wareId: string) => boolean
  getResolvedLevel?: (wareId: string) => number
  isWareOperable?: (wareId: string) => boolean
  isPlannedWare?: (wareId: string) => boolean
  onToggleWareLock?: (wareId: string) => void
  onToggleWarePriority?: (wareId: string) => void
}

export interface StationWareFlowsDashboardEmits {
  updateViewMode: (value: WareFlowViewMode) => void
  updateResourceBufferHours: (value: number) => void
  updatePrimaryProductBufferHours: (value: number) => void
  updateSecondaryProductBufferHours: (value: number) => void
  updateBuyMultiplier: (value: number) => void
  updateSellMultiplier: (value: number) => void
  addGapModule: (wareId: string) => void
  removeGapModule: (wareId: string) => void
}

export interface StationDashboardProps {
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
  plannedModulesOverride?: SavedModule[] | null
  hideWorkersView?: boolean
  buildPriceMultiplier: number
}

export interface StationDashboardEmits {
  updateTransportShipCapacity: (value: number) => void
  updateBuildPriceMultiplier: (value: number) => void
  updateManualWorkforce: (value: number) => void
  updateWorkforceAuto: (value: boolean) => void
  updateUseHQ: (value: boolean) => void
}

export interface TransitHubWorkbenchProps {
  sectorId: string
  groupedFlows: EmpireGroupedFlows
  storageFlows: any[]
  storageModulePlans: any[]
  supplyBuildModules: SavedModule[]
  viewMode: WareFlowViewMode
}

export interface TransitHubWorkbenchEmits {
  updateViewMode: (value: WareFlowViewMode) => void
}

export interface ProductionWorkbenchViewProps {
  isOverview: boolean
  activeTransitSectorId: string | null
  activeStationId: string | null
  tabBar: StationTabBarProps
  toolbar: ContextToolbarProps
  overviewGroupedFlows: EmpireGroupedFlows | null
  stationPlanning: StationPlanningPanelProps | null
  stationWareFlows: StationWareFlowsDashboardProps | null
  stationDashboard: StationDashboardProps | null
  transitHub: TransitHubWorkbenchProps | null
}

export interface ImportPayload {
  modules: SavedModule[]
  lockedWares: string[]
  warePriority: Record<string, number>
}

export interface ImportPlanModalProps {
  isOpen: boolean
  initialTab?: 'logic-flow' | 'game-blueprint' | 'x4-station'
  isOverview: boolean
  productionSource: 'empire' | 'save-binding'
  activeStationId: string | null
  activeStation: { id: string; modules: SavedModule[] } | null
  createStation: (name: string, type?: StationType) => { id: string; modules: SavedModule[] } | null
  applyImportedStationPayload: (stationId: string, payload: ImportPayload) => void
  updateStationModules: (stationId: string, modules: SavedModule[]) => void
  getStationById: (stationId: string) => { id: string; modules: SavedModule[] } | null
}

export interface ImportPlanModalEmits {
  close: () => void
}

export interface ProductionWorkbenchViewEmits {
  selectOverview: () => void
  selectTransit: (sectorId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => void
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => void
  deleteStation: (stationId: string) => void
  expandSector: (sectorId: string | null) => void
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
  updateWareFlowViewMode: (value: WareFlowViewMode) => void
  addModule: (moduleId: string) => void
  removeModule: (index: number) => void
  updateModuleCount: (index: number, count: number) => void
  updateSearchQuery: (value: string) => void
  addGapModule: (wareId: string) => void
  removeGapModule: (wareId: string) => void
}
