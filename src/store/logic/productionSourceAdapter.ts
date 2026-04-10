import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { stationStateMap, migrateStationSettings } from '@/store/state/StationStateMap'
import type {
  BindingStationPlan,
  EmpireGroupedFlows,
  SaveBindingPlan,
  StationPlan,
  X4Module,
  X4Ware,
  RaceMedicalConsumption,
  BindingSectorGroup
} from '@/types/x4'
import type { SaveArchive, PlayerStationEntry } from '@/types/saveArchive'

export type ProductionSourceKind = 'empire' | 'save-binding'

export interface ProductionSourceDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export interface SaveBindingProductionDeps extends ProductionSourceDeps {
  archive: SaveArchive | null
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

function toProductionStation(gameGuid: string, plan: BindingStationPlan): StationPlan {
  return {
    id: `__save_binding__${gameGuid}__${plan.id}`,
    name: plan.name || plan.saveStationCode || 'Station',
    type: plan.type,
    modules: plan.modules || [],
    settings: migrateStationSettings(plan.settings),
    lastUpdated: 0,
    lockedWares: [],
    warePriority: {}
  }
}

function toDerivedSaveStation(
  gameGuid: string,
  saveStation: PlayerStationEntry,
  plan: BindingStationPlan | undefined
): StationPlan {
  const id = plan
    ? `__save_binding__${gameGuid}__${plan.id}`
    : `__save_binding_derived__${gameGuid}__${saveStation.code}`
  return {
    id,
    name: plan?.name || saveStation.code || 'Save Station',
    type: plan?.type || 'industrial',
    modules: plan?.modules || [],
    settings: migrateStationSettings(plan?.settings || {}),
    lastUpdated: 0,
    lockedWares: [],
    warePriority: {}
  }
}

function getCoveredSaveStationCodes(
  archive: SaveArchive | null,
  groups: BindingSectorGroup[]
): Set<string> {
  if (!archive || !archive.sectors) return new Set()

  const coverageMacros = new Set<string>()
  groups.forEach((group) => {
    group.coverageSectorMacros.forEach((entry) => {
      coverageMacros.add(entry.ref)
    })
  })

  const coveredCodes = new Set<string>()
  Object.entries(archive.sectors).forEach(([sectorMacro, sector]) => {
    if (!coverageMacros.has(sectorMacro)) return
    const stations = sector.player_stations || {}
    Object.keys(stations).forEach((code) => coveredCodes.add(code))
  })

  return coveredCodes
}

function getSaveStationByCode(
  archive: SaveArchive | null,
  code: string
): PlayerStationEntry | null {
  if (!archive || !archive.sectors) return null
  for (const sector of Object.values(archive.sectors)) {
    const station = sector.player_stations?.[code]
    if (station) return station
  }
  return null
}

export interface SaveBindingProductionResult {
  groupedFlows: EmpireGroupedFlows
  transitHubs: Array<{
    groupId: string
    groupName: string
    tradeStation: BindingSectorGroup['tradeStation']
  }>
}

export function buildSaveBindingProductionFlows(
  binding: SaveBindingPlan | null | undefined,
  deps: SaveBindingProductionDeps | null | undefined
): SaveBindingProductionResult {
  const emptyResult: SaveBindingProductionResult = {
    groupedFlows: createEmptyEmpireGroupedFlows(),
    transitHubs: []
  }

  if (!binding || !deps || !deps.modulesMap || !deps.waresMap || !deps.medicalConsumptionMap) {
    return emptyResult
  }

  const coveredCodes = getCoveredSaveStationCodes(deps.archive, binding.groups)
  const stationPlansByCode = new Map<string, BindingStationPlan>()
  const virtualPlans: BindingStationPlan[] = []

  binding.stationPlans.forEach((plan) => {
    if (plan.saveStationCode) {
      stationPlansByCode.set(plan.saveStationCode, plan)
    } else {
      virtualPlans.push(plan)
    }
  })

  const derivedStations: StationPlan[] = []

  coveredCodes.forEach((code) => {
    const saveStation = getSaveStationByCode(deps.archive, code)
    if (!saveStation) return
    const plan = stationPlansByCode.get(code)
    derivedStations.push(toDerivedSaveStation(binding.gameGuid, saveStation, plan))
  })

  virtualPlans.forEach((plan) => {
    derivedStations.push(toProductionStation(binding.gameGuid, plan))
  })

  if (derivedStations.length === 0) {
    return {
      groupedFlows: createEmptyEmpireGroupedFlows(),
      transitHubs: binding.groups
        .filter((g) => g.tradeStation)
        .map((g) => ({
          groupId: g.id,
          groupName: g.name,
          tradeStation: g.tradeStation
        }))
    }
  }

  derivedStations.forEach((station) => {
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

  const groupedFlows = analyzeEmpireWareFlow(
    derivedStations,
    (stationId) => stationStateMap.getFilteredGroupedFlows(stationId)
  )

  return {
    groupedFlows,
    transitHubs: binding.groups
      .filter((g) => g.tradeStation)
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        tradeStation: g.tradeStation
      }))
  }
}

export function buildSaveBindingProductionFlowsLegacy(
  binding: SaveBindingPlan | null | undefined,
  deps: ProductionSourceDeps | null | undefined
): EmpireGroupedFlows {
  if (!binding || !deps || !deps.modulesMap || !deps.waresMap || !deps.medicalConsumptionMap) {
    return createEmptyEmpireGroupedFlows()
  }

  const plans: BindingStationPlan[] = binding.stationPlans
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