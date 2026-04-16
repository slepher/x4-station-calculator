import type {
  SavedModule,
  EmpireGroupedFlows,
  SupplyStorageFlow,
  TransitHubStorageModulePlan
} from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { SolveMultiWareByLinkOutput } from '@/store/logic/sectorLinkFlow'

export interface ProductionPanelModeSource {
  modules: SavedModule[]
  buildingModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  localGroupedFlows: EmpireGroupedFlows | null
  solverOutput: SolveMultiWareByLinkOutput | null
  supplyStorageFlows: SupplyStorageFlow[]
  storageModulePlans: TransitHubStorageModulePlan[]
}

export interface ProductionPanelSource {
  id: string
  entityType: 'station' | 'transit'
  planning: ProductionPanelModeSource
  live: ProductionPanelModeSource
  liveVisualState: 'planning' | 'live'
  canUseLiveModules: boolean
}

export function createEmptyProductionPanelModeSource(): ProductionPanelModeSource {
  return {
    modules: [],
    buildingModules: [],
    autoIndustryModules: [],
    autoHabitationModules: [],
    autoInfrastructureModules: [],
    productionFlows: [],
    localGroupedFlows: null,
    solverOutput: null,
    supplyStorageFlows: [],
    storageModulePlans: []
  }
}

export function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}