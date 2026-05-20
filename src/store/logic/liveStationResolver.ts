import { isSectorMacroInBindingScope, resolveBindingSectorScope } from './saveBindingSectorScope'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'
import type {
  BindingStationPlan,
  StationPlan,
  BindingSectorGroup
} from '@/types/x4'
import type { PlayerStationEntry, PlayerStationRecord } from '@/types/saveArchive'

export interface SectorSunlightMap {
  [sectorMacro: string]: { area?: { sunlight?: number } }
}

export function toProductionStation(
  plan: BindingStationPlan,
  sectorsMap?: SectorSunlightMap
): StationPlan {
  const settings = ({ ...DEFAULT_STATION_SETTINGS, ...plan.settings })
  
  if (plan.sectorMacro && sectorsMap) {
    const sector = sectorsMap[plan.sectorMacro]
    if (sector?.area?.sunlight !== undefined) {
      settings.sunlight = Math.round(sector.area.sunlight * 100)
    }
  }
  
  return {
    id: plan.id,
    name: plan.name || plan.saveStationCode || 'Station',
    sectorId: plan.groupId || null,
    type: plan.type,
    modules: plan.modules || [],
    settings,
    lastUpdated: 0,
    lockedWares: plan.lockedWares || [],
    warePriority: plan.warePriority || {}
  }
}

function toDerivedSaveStation(
  saveStation: PlayerStationEntry,
  plan: BindingStationPlan | undefined
): StationPlan {
  const id = plan ? plan.id : saveStation.code
  const archiveModules = (saveStation.modules || []).map((mod) => ({
    id: mod.module_id || '',
    count: mod.amount || 1
  })).filter((mod) => Boolean(mod.id))
  return {
    id,
    name: plan?.name || saveStation.code || 'Save Station',
    type: plan?.type || 'industrial',
    modules: plan?.modules || archiveModules,
    settings: ({ ...DEFAULT_STATION_SETTINGS, ...plan?.settings || {} }),
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

export interface DerivedBindingStation {
  station: StationPlan
  groupId: string | null
}

export function deriveBindingStationsFromRecords(
  groups: BindingSectorGroup[],
  stationPlans: BindingStationPlan[],
  stationRecords: PlayerStationRecord[],
  sectorsMap?: SectorSunlightMap
): DerivedBindingStation[] {
  if (!stationRecords || stationRecords.length === 0) return []

  const result: DerivedBindingStation[] = []
  const coveredCodes = getCoveredCodesFromRecords(stationRecords, groups)
  const stationPlansByCode = new Map<string, BindingStationPlan>()
  const emittedPlanIds = new Set<string>()

  const tradestationCodes = new Set<string>()
  groups.forEach((group) => {
    if (group.tradeStation?.saveStationCode) {
      tradestationCodes.add(group.tradeStation.saveStationCode)
    }
  })

  stationPlans.forEach((plan) => {
    if (plan.saveStationCode) {
      stationPlansByCode.set(plan.saveStationCode, plan)
    }
  })

  coveredCodes.forEach((code) => {
    if (tradestationCodes.has(code)) return
    const record = getStationRecordByCode(stationRecords, code)
    if (!record) return
    const plan = stationPlansByCode.get(code)
    const groupId = plan?.groupId || findGroupBySectorMacro(groups, record.sectorMacro)?.id || null
    const station = toDerivedSaveStation(record.data as PlayerStationEntry, plan)
    station.sectorId = groupId
    result.push({
      station,
      groupId
    })
    if (plan) emittedPlanIds.add(plan.id)
  })

  stationPlans.forEach((plan) => {
    if (emittedPlanIds.has(plan.id)) return
    const station = toProductionStation(plan, sectorsMap)
    result.push({
      station,
      groupId: plan.groupId || null
    })
  })

  return result
}
