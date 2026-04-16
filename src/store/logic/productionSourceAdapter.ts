import { analyzeEmpireWareFlow } from './analyzeEmpireWareFlow'
import { isSectorMacroInBindingScope, resolveBindingSectorScope } from './saveBindingSectorScope'
import { migrateStationSettings } from '@/store/state/StationStateMap'
import { stationProductionFlowMap } from '@/store/state/StationProductionFlowMap'
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
import type { PlayerStationEntry, PlayerStationRecord } from '@/types/saveArchive'

export type ProductionSourceKind = 'empire' | 'save-binding'

export type ParsedBindingStationId =
  | { kind: 'plan'; gameGuid: string; planId: string }
  | { kind: 'derived'; gameGuid: string; saveStationCode: string }

export function createBindingPlanStationId(gameGuid: string, planId: string): string {
  return `__save_binding__${gameGuid}__${planId}`
}

export function createDerivedSaveStationId(gameGuid: string, saveStationCode: string): string {
  return `__save_binding_derived__${gameGuid}__${saveStationCode}`
}

export function parseBindingStationId(stationId: string | null | undefined): ParsedBindingStationId | null {
  if (!stationId) return null
  const planPrefix = '__save_binding__'
  if (stationId.startsWith(planPrefix)) {
    const rest = stationId.slice(planPrefix.length)
    const separator = rest.indexOf('__')
    if (separator <= 0) return null
    const gameGuid = rest.slice(0, separator)
    const planId = rest.slice(separator + 2)
    if (!gameGuid || !planId) return null
    return { kind: 'plan', gameGuid, planId }
  }

  const derivedPrefix = '__save_binding_derived__'
  if (stationId.startsWith(derivedPrefix)) {
    const rest = stationId.slice(derivedPrefix.length)
    const separator = rest.indexOf('__')
    if (separator <= 0) return null
    const gameGuid = rest.slice(0, separator)
    const saveStationCode = rest.slice(separator + 2)
    if (!gameGuid || !saveStationCode) return null
    return { kind: 'derived', gameGuid, saveStationCode }
  }

  return null
}

export interface ProductionSourceDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export interface SaveBindingProductionDeps extends ProductionSourceDeps {
  playerStationRecords: PlayerStationRecord[]
}

function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}

export function toProductionStation(gameGuid: string, plan: BindingStationPlan): StationPlan {
  return {
    id: createBindingPlanStationId(gameGuid, plan.id),
    name: plan.name || plan.saveStationCode || 'Station',
    type: plan.type,
    modules: plan.modules || [],
    settings: migrateStationSettings(plan.settings),
    lastUpdated: 0,
    lockedWares: plan.lockedWares || [],
    warePriority: plan.warePriority || {}
  }
}

function toDerivedSaveStation(
  gameGuid: string,
  saveStation: PlayerStationEntry,
  plan: BindingStationPlan | undefined
): StationPlan {
  const id = plan
    ? createBindingPlanStationId(gameGuid, plan.id)
    : createDerivedSaveStationId(gameGuid, saveStation.code)
  return {
    id,
    name: plan?.name || saveStation.code || 'Save Station',
    type: plan?.type || 'industrial',
    modules: plan?.modules || [],
    settings: migrateStationSettings(plan?.settings || {}),
    lastUpdated: 0,
    lockedWares: plan?.lockedWares || [],
    warePriority: plan?.warePriority || {}
  }
}

function findGroupBySectorMacro(
  groups: BindingSectorGroup[],
  sectorMacro: string
): BindingSectorGroup | null {
  for (const group of groups) {
    if (isSectorMacroInBindingScope(group, sectorMacro)) {
      return group
    }
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

  const coveredCodes = getCoveredCodesFromRecords(deps.playerStationRecords, binding.groups)
  const stationPlansByCode = new Map<string, BindingStationPlan>()
  const virtualPlans: BindingStationPlan[] = []
  const emittedPlanIds = new Set<string>()

  binding.stationPlans.forEach((plan) => {
    if (plan.saveStationCode) {
      stationPlansByCode.set(plan.saveStationCode, plan)
    } else {
      virtualPlans.push(plan)
    }
  })

  const derivedStations: StationPlan[] = []

  coveredCodes.forEach((code) => {
    const record = getStationRecordByCode(deps.playerStationRecords, code)
    if (!record) return
    const plan = stationPlansByCode.get(code)
    const groupId = plan?.groupId || findGroupBySectorMacro(binding.groups, record.sectorMacro)?.id || null
    const station = toDerivedSaveStation(binding.gameGuid, record.data as PlayerStationEntry, plan)
    station.sectorId = groupId
    derivedStations.push(station)
    if (plan) emittedPlanIds.add(plan.id)
  })

  binding.stationPlans.forEach((plan) => {
    if (!plan.saveStationCode || emittedPlanIds.has(plan.id)) return
    const station = toProductionStation(binding.gameGuid, plan)
    station.sectorId = plan.groupId || null
    derivedStations.push(station)
    emittedPlanIds.add(plan.id)
  })

  virtualPlans.forEach((plan) => {
    const station = toProductionStation(binding.gameGuid, plan)
    station.sectorId = plan.groupId || null
    derivedStations.push(station)
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
    stationProductionFlowMap.compute(station.id, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, {
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      medicalConsumptionMap: deps.medicalConsumptionMap,
      buildPriceMultiplier: 0.5,
      enforceDlcActivation: deps.enforceDlcActivation,
      isModuleDlcActive: deps.isModuleDlcActive
    })
  })

  const groupedFlows = analyzeEmpireWareFlow(
    derivedStations,
    (stationId) => {
      const cache = stationProductionFlowMap.getCache(stationId)
      if (!cache) return []
      return cache.productionFlows.filter(f => {
        if (f.netRate <= 0) return true
        return (cache.warePriorityLevels[f.wareId] ?? 0) > 0
      })
    },
    deps.waresMap
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

export interface DerivedBindingStation {
  station: StationPlan
  groupId: string | null
}

function getCoveredCodesFromRecords(
  records: PlayerStationRecord[],
  groups: BindingSectorGroup[]
): Set<string> {
  if (!records || records.length === 0) return new Set()

  const coverageMacros = new Set<string>()
  groups.forEach((group) => {
    resolveBindingSectorScope(group).sectorMacros.forEach((sectorMacro) => coverageMacros.add(sectorMacro))
  })

  const coveredCodes = new Set<string>()
  records.forEach((record) => {
    if (coverageMacros.has(record.sectorMacro) && record.type === 'station') {
      coveredCodes.add(record.code)
    }
  })

  return coveredCodes
}

function getStationRecordByCode(
  records: PlayerStationRecord[],
  code: string
): PlayerStationRecord | null {
  return records.find((r) => r.code === code && r.type === 'station') || null
}

export function deriveBindingStationsFromRecords(
  binding: SaveBindingPlan | null | undefined,
  stationRecords: PlayerStationRecord[]
): DerivedBindingStation[] {
  if (!binding) return []
  if (!stationRecords || stationRecords.length === 0) return []

  const result: DerivedBindingStation[] = []
  const coveredCodes = getCoveredCodesFromRecords(stationRecords, binding.groups)
  const stationPlansByCode = new Map<string, BindingStationPlan>()
  const emittedPlanIds = new Set<string>()

  binding.stationPlans.forEach((plan) => {
    if (plan.saveStationCode) {
      stationPlansByCode.set(plan.saveStationCode, plan)
    }
  })

  coveredCodes.forEach((code) => {
    const record = getStationRecordByCode(stationRecords, code)
    if (!record) return
    const plan = stationPlansByCode.get(code)
    const groupId = plan?.groupId || findGroupBySectorMacro(binding.groups, record.sectorMacro)?.id || null
    const station = toDerivedSaveStation(binding.gameGuid, record.data as PlayerStationEntry, plan)
    station.sectorId = groupId
    result.push({
      station,
      groupId
    })
    if (plan) emittedPlanIds.add(plan.id)
  })

  binding.stationPlans.forEach((plan) => {
    if (emittedPlanIds.has(plan.id)) return
    const station = toProductionStation(binding.gameGuid, plan)
    station.sectorId = plan.groupId || null
    result.push({
      station,
      groupId: plan.groupId || null
    })
  })

  return result
}


