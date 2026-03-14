import {
  extractEquipmentCandidatesBySelector,
  extractShipCandidates,
  type EquipmentPickerFilters,
  type EquipmentSlotSelector,
  type ShipCandidateFilters
} from '../store/logic/shipEquipmentPicker'
import type { EquipmentType, ShipEquipmentSize } from '../types/x4'
import { buildShipBuildDatas } from '../store/logic/useGameData'
import { useGameDataStore } from '../store/useGameDataStore'

/**
 * This module provides ship build query functions.
 * Note: These functions require the gameDataStore to be initialized first.
 */

function getShipBuildData() {
  const gameData = useGameDataStore()
  const data = gameData.gameData
  if (!data) {
    throw new Error('Game data not initialized. Call gameDataStore.initialize() first.')
  }
  return buildShipBuildDatas({
    ships: data.ships,
    races: data.shipRaces,
    types: data.shipTypes,
    equipments: data.equipments,
    equipmentTypes: data.equipmentTypes,
    slotTags: data.slotTags,
    wares: data.wares
  })
}

export const getShipCandidates = (
  filters: ShipCandidateFilters
) => {
  const { shipMap } = getShipBuildData()
  return extractShipCandidates({
    shipMap,
    filters
  })
}

export const getEquipmentCandidatesBySlot = (
  slotType: EquipmentType,
  size: ShipEquipmentSize,
  _tagsAll: string[],
  filters: EquipmentPickerFilters
) => {
  const { equipmentMap } = getShipBuildData()

  const selector: EquipmentSlotSelector = {
    mode: 'slotTypeSizeN',
    slotType,
    sizeN: size
  }

  return extractEquipmentCandidatesBySelector({
    shipMap: new Map(),
    equipmentMap,
    shipId: '',
    selector,
    filters
  })
}

export const getEquipmentCandidatesBySelector = (
  selector: EquipmentSlotSelector,
  filters: EquipmentPickerFilters
) => {
  const { equipmentMap } = getShipBuildData()
  return extractEquipmentCandidatesBySelector({
    shipMap: new Map(),
    equipmentMap,
    shipId: '',
    selector,
    filters
  })
}