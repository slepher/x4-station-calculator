import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { stationStateMap, migrateStationSettings } from '@/store/state/StationStateMap'
import type {
  EmpireGroupedFlows,
  SaveBindingPlan,
  SaveStationPlan,
  StationPlan,
  VirtualStationPlan,
  X4Module,
  X4Ware,
  RaceMedicalConsumption
} from '@/types/x4'

export type ProductionSourceKind = 'empire' | 'save-binding'

export interface ProductionSourceDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
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

type SaveBindingProductionPlan = SaveStationPlan | VirtualStationPlan

function toProductionStation(gameGuid: string, plan: SaveBindingProductionPlan): StationPlan {
  return {
    id: `__save_binding__${gameGuid}__${plan.id}`,
    name: plan.kind === 'save-station' ? (plan.name || plan.saveStationCode) : plan.name,
    type: plan.kind === 'virtual-station' ? plan.type : 'industrial',
    modules: plan.modules || [],
    settings: migrateStationSettings(plan.settings),
    lastUpdated: 0,
    lockedWares: [],
    warePriority: {}
  }
}

export function buildSaveBindingProductionFlows(
  binding: SaveBindingPlan | null | undefined,
  deps: ProductionSourceDeps | null | undefined
): EmpireGroupedFlows {
  if (!binding || !deps || !deps.modulesMap || !deps.waresMap || !deps.medicalConsumptionMap) {
    return createEmptyEmpireGroupedFlows()
  }

  const plans: SaveBindingProductionPlan[] = [
    ...binding.stationPlans,
    ...binding.groups.map((group) => group.virtualStation).filter((plan): plan is VirtualStationPlan => Boolean(plan))
  ]
  const stations = plans.map((plan) => toProductionStation(binding.gameGuid, plan))
  if (stations.length === 0) return createEmptyEmpireGroupedFlows()

  stations.forEach((station) => {
    stationStateMap.patch(station.id, {
      plannedModules: station.modules,
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {},
      settings: station.settings
    })
    stationStateMap.recompute(station.id, {
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      medicalConsumptionMap: deps.medicalConsumptionMap,
      enforceDlcActivation: deps.enforceDlcActivation,
      isModuleDlcActive: deps.isModuleDlcActive
    })
  })

  return analyzeEmpireWareFlow(
    stations,
    (stationId) => stationStateMap.getFilteredGroupedFlows(stationId)
  )
}
