import {
  extractEquipmentCandidatesBySelector,
  extractShipCandidates,
  filterEquipmentCandidates,
  type EquipmentPickerFilters,
  type EquipmentSlotSelector,
  type ShipCandidateFilters
} from '../store/logic/shipEquipmentPicker'
import type { EquipmentType, ShipEquipmentSize } from '../types/x4'
import { buildShipBuildDatas } from '../store/logic/useGameData'

const { shipMap, equipmentMap } = buildShipBuildDatas()

export const getShipCandidates = (
  filters: ShipCandidateFilters
) => {
  return extractShipCandidates({
    shipMap,
    filters
  })
}

export const getEquipmentCandidatesBySlot = (
  slotType: EquipmentType,
  size: ShipEquipmentSize,
  tagsAll: string[],
  filters: EquipmentPickerFilters
) => {
  const base = Array.from(equipmentMap.values())
    .filter((equipment) => !equipment.noplayerblueprint)
    .filter((equipment) => equipment.type === slotType && equipment.size === size)
    .filter((equipment) => (equipment.slotTags || []).every((tag) => tagsAll.includes(tag)))
    .map((equipment) => ({
      id: equipment.id,
      name: equipment.name || equipment.id,
      mk: equipment.mk || null,
      race: equipment.race || null,
      tags: Array.isArray(equipment.slotTags) ? equipment.slotTags.filter((tag): tag is string => typeof tag === 'string') : []
    }))
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))

  const items = filterEquipmentCandidates(base, filters)
  const racePool = filterEquipmentCandidates(base, { races: [], mks: filters.mks, tags: filters.tags })
  const mkPool = filterEquipmentCandidates(base, { races: filters.races, mks: [], tags: filters.tags })
  const tagPool = filterEquipmentCandidates(base, { races: filters.races, mks: filters.mks, tags: [] })

  const raceCountMap = new Map<string, number>()
  racePool.forEach((item) => {
    const race = item.race || 'gen'
    raceCountMap.set(race, (raceCountMap.get(race) || 0) + 1)
  })

  const mkCountMap = new Map<string, number>()
  mkPool.forEach((item) => {
    if (!item.mk) return
    mkCountMap.set(item.mk, (mkCountMap.get(item.mk) || 0) + 1)
  })

  const tagCountMap = new Map<string, number>()
  tagPool.forEach((item) => {
    item.tags.forEach((tag) => tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1))
  })

  return {
    items,
    raceCountMap,
    mkCountMap,
    tagCountMap
  }
}

export const getEquipmentCandidatesBySelector = (
  shipId: string,
  selector: EquipmentSlotSelector,
  filters: EquipmentPickerFilters
) => {
  return extractEquipmentCandidatesBySelector({
    shipMap,
    equipmentMap,
    shipId,
    selector,
    filters
  })
}
