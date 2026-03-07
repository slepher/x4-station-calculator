import type { FitEquipmentOption } from '../../components/ship-build/fitTypes'
import type { EquipmentType, ShipEquipmentSize, X4Equipment, X4Ship, X4ShipType } from '../../types/x4'

export type EquipmentPickerFilters = {
  races: string[]
  mks: string[]
  tags: string[]
}

type ShipLookup = Map<string, X4Ship> | Record<string, X4Ship>
type EquipmentLookup = Map<string, X4Equipment> | Record<string, X4Equipment>

export type ShipCandidateFilters = {
  shipClass: X4Ship['class'] | null
  races: string[]
  types: string[]
  query?: string
}
export type ShipCandidateResult = {
  items: X4Ship[]
  raceCountMap: Map<string, number>
  typeCountMap: Map<string, number>
}

export type EquipmentSlotSelector =
  | { mode: 'slotTypeSizeNth'; slotType: EquipmentType; size: ShipEquipmentSize; nth: number }
  | { mode: 'slotTypeGroupName'; slotType: EquipmentType; groupName: string }
  | { mode: 'slotTypeSizeN'; slotType: EquipmentType; sizeN: string }
export type EquipmentCandidateResult = {
  items: FitEquipmentOption[]
  raceCountMap: Map<string, number>
  mkCountMap: Map<string, number>
  tagCountMap: Map<string, number>
}

const normalizeRace = (option: FitEquipmentOption) => option.race || 'gen'
const normalizeMk = (option: FitEquipmentOption) => option.mk || ''
const normalizeTags = (option: FitEquipmentOption) => option.tags || []

const byIdSorted = (a: FitEquipmentOption, b: FitEquipmentOption) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)

const matchesTags = (optionTags: string[], tags: string[]) => {
  if (tags.length === 0) return true
  return tags.some((tagId) => optionTags.includes(tagId))
}

const normalizeTagList = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === 'string')
}

const readLookup = <T>(lookup: Map<string, T> | Record<string, T>, key: string): T | undefined => {
  if (lookup instanceof Map) return lookup.get(key)
  return lookup[key]
}

const listLookupValues = <T>(lookup: Map<string, T> | Record<string, T>): T[] => {
  if (lookup instanceof Map) return Array.from(lookup.values())
  return Object.values(lookup)
}

type ShipConnectionRef = {
  slotType: EquipmentType
  groupName: string
  size: ShipEquipmentSize
  tags: string[]
}

const collectShipConnectionRefs = (ship: X4Ship, slotType: EquipmentType): ShipConnectionRef[] => {
  const refs: ShipConnectionRef[] = []
  ship.slots.forEach((slot) => {
    slot.groups.forEach((group) => {
      let connection = null as { size: ShipEquipmentSize; tags: string[] } | null
      if (slotType === 'shield') {
        connection = slot.type === 'shield'
          ? group.connection
          : (group.connection.shield || null)
      } else if (slot.type === slotType) {
        connection = group.connection
      }
      if (!connection) return
      refs.push({
        slotType,
        groupName: group.group,
        size: connection.size,
        tags: normalizeTagList(connection.tags)
      })
    })
  })
  return refs
}

const matchesTagsAllSubset = (equipmentTags: string[], tagsAll: string[]) => equipmentTags.every((tag) => tagsAll.includes(tag))

const parseSizeShort = (short: string): ShipEquipmentSize | null => {
  if (short === 'S') return 'small'
  if (short === 'M') return 'medium'
  if (short === 'L') return 'large'
  if (short === 'XL') return 'extralarge'
  return null
}

export const parseSizeNToSizeNth = (sizeN: string): { size: ShipEquipmentSize; nth: number } | null => {
  const match = /^([sSmMlL]|[xX][lL])(\d+)?$/.exec(sizeN.trim())
  if (!match) return null
  const rawSize = match[1]!.toUpperCase()
  const size = parseSizeShort(rawSize)
  if (!size) return null
  const userIndex = match[2] ? Number.parseInt(match[2], 10) : 1
  if (!Number.isFinite(userIndex) || userIndex < 1) return null
  return { size, nth: userIndex - 1 }
}

export const extractShipCandidates = (payload: {
  shipMap: ShipLookup
  filters: ShipCandidateFilters
}): ShipCandidateResult => {
  const { shipMap, filters } = payload
  const { shipClass, races, types, query } = filters
  if (!shipClass) {
    return {
      items: [],
      raceCountMap: new Map<string, number>(),
      typeCountMap: new Map<string, number>()
    }
  }

  const normalizedQuery = (query || '').trim().toLowerCase()
  const base = listLookupValues(shipMap)
    .filter((ship) => ship.class === shipClass)
    .filter((ship) => {
      if (!normalizedQuery) return true
      return ship.id.toLowerCase().includes(normalizedQuery)
        || (ship.name || '').toLowerCase().includes(normalizedQuery)
        || (ship.nameId || '').toLowerCase().includes(normalizedQuery)
    })

  const byType = base.filter((ship) => types.length === 0 || types.includes(ship.type))
  const byRace = base.filter((ship) => races.length === 0 || races.includes(ship.race))
  const items = byType
    .filter((ship) => races.length === 0 || races.includes(ship.race))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  const raceCountMap = new Map<string, number>()
  byType.forEach((ship) => raceCountMap.set(ship.race, (raceCountMap.get(ship.race) || 0) + 1))

  const typeCountMap = new Map<string, number>()
  byRace.forEach((ship) => typeCountMap.set(ship.type, (typeCountMap.get(ship.type) || 0) + 1))

  return { items, raceCountMap, typeCountMap }
}

export const filterTypesByClass = (
  shipTypes: X4ShipType[],
  shipClass: X4Ship['class'] | null
): X4ShipType[] => {
  if (!shipClass) return []
  return shipTypes.filter((type) => type.class.includes(shipClass))
}

export const filterEquipmentCandidates = (
  candidates: FitEquipmentOption[],
  filters: EquipmentPickerFilters
): FitEquipmentOption[] => {
  const { races, mks, tags } = filters

  return candidates
    .filter((item) => races.length === 0 || races.includes(normalizeRace(item)))
    .filter((item) => mks.length === 0 || mks.includes(normalizeMk(item)))
    .filter((item) => matchesTags(normalizeTags(item), tags))
}

export const extractEquipmentSlotCandidates = (payload: {
  shipMap: ShipLookup
  equipmentMap: EquipmentLookup
  shipId: string
  slotType: EquipmentType
  size: ShipEquipmentSize
  filters: EquipmentPickerFilters
  tagsAll?: string[]
}): FitEquipmentOption[] => {
  const {
    shipMap,
    equipmentMap,
    shipId,
    slotType,
    size,
    filters,
    tagsAll = []
  } = payload

  const ship = readLookup(shipMap, shipId)
  if (!ship) return []

  const refs = collectShipConnectionRefs(ship, slotType).filter((ref) => ref.size === size)
  if (refs.length === 0) return []

  const candidates = listLookupValues(equipmentMap)
    .filter((equipment) => !equipment.noplayerblueprint)
    .filter((equipment) => equipment.type === slotType && equipment.size === size)
    .filter((equipment) => {
      const equipmentTags = normalizeTagList(equipment.slotTags)
      if (tagsAll.length > 0 && !matchesTagsAllSubset(equipmentTags, tagsAll)) return false
      return refs.some((ref) => matchesTagsAllSubset(equipmentTags, ref.tags))
    })
    .map((equipment) => ({
      id: equipment.id,
      name: equipment.name || equipment.id,
      mk: equipment.mk || null,
      race: equipment.race || null,
      tags: normalizeTagList(equipment.slotTags)
    }))
    .sort(byIdSorted)

  return filterEquipmentCandidates(candidates, filters)
}

export const extractEquipmentSlotCandidatesWithFacets = (payload: {
  shipMap: ShipLookup
  equipmentMap: EquipmentLookup
  shipId: string
  slotType: EquipmentType
  size: ShipEquipmentSize
  filters: EquipmentPickerFilters
  tagsAll?: string[]
}): EquipmentCandidateResult => {
  const { shipMap, equipmentMap, shipId, slotType, size, filters, tagsAll = [] } = payload

  const items = extractEquipmentSlotCandidates({
    shipMap,
    equipmentMap,
    shipId,
    slotType,
    size,
    filters,
    tagsAll
  })

  const racePool = extractEquipmentSlotCandidates({
    shipMap,
    equipmentMap,
    shipId,
    slotType,
    size,
    filters: { races: [], mks: filters.mks, tags: filters.tags },
    tagsAll
  })
  const mkPool = extractEquipmentSlotCandidates({
    shipMap,
    equipmentMap,
    shipId,
    slotType,
    size,
    filters: { races: filters.races, mks: [], tags: filters.tags },
    tagsAll
  })
  const tagPool = extractEquipmentSlotCandidates({
    shipMap,
    equipmentMap,
    shipId,
    slotType,
    size,
    filters: { races: filters.races, mks: filters.mks, tags: [] },
    tagsAll
  })

  const raceCountMap = new Map<string, number>()
  racePool.forEach((item) => raceCountMap.set(normalizeRace(item), (raceCountMap.get(normalizeRace(item)) || 0) + 1))

  const mkCountMap = new Map<string, number>()
  mkPool.forEach((item) => {
    const mk = normalizeMk(item)
    if (!mk) return
    mkCountMap.set(mk, (mkCountMap.get(mk) || 0) + 1)
  })

  const tagCountMap = new Map<string, number>()
  tagPool.forEach((item) => {
    normalizeTags(item).forEach((tag) => tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1))
  })

  return { items, raceCountMap, mkCountMap, tagCountMap }
}

export const extractEquipmentCandidatesBySelector = (payload: {
  shipMap: ShipLookup
  equipmentMap: EquipmentLookup
  shipId: string
  selector: EquipmentSlotSelector
  filters: EquipmentPickerFilters
}): FitEquipmentOption[] => {
  const { shipMap, equipmentMap, shipId, selector, filters } = payload
  const ship = readLookup(shipMap, shipId)
  if (!ship) return []

  const mergeById = (items: FitEquipmentOption[]) => {
    const map = new Map<string, FitEquipmentOption>()
    items.forEach((item) => map.set(item.id, item))
    return Array.from(map.values()).sort(byIdSorted)
  }

  if (selector.mode === 'slotTypeSizeN') {
    const parsed = parseSizeNToSizeNth(selector.sizeN)
    if (!parsed) return []
    return extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap,
      shipId,
      selector: {
        mode: 'slotTypeSizeNth',
        slotType: selector.slotType,
        size: parsed.size,
        nth: parsed.nth
      },
      filters
    })
  }

  if (selector.mode === 'slotTypeSizeNth') {
    const refs = collectShipConnectionRefs(ship, selector.slotType).filter((ref) => ref.size === selector.size)
    const target = refs[selector.nth]
    if (!target) return []
    return extractEquipmentSlotCandidates({
      shipMap,
      equipmentMap,
      shipId,
      slotType: selector.slotType,
      size: selector.size,
      tagsAll: target.tags,
      filters
    })
  }

  const refs = collectShipConnectionRefs(ship, selector.slotType).filter((ref) => ref.groupName === selector.groupName)
  if (refs.length === 0) return []

  return mergeById(refs.flatMap((ref) => extractEquipmentSlotCandidates({
    shipMap,
    equipmentMap,
    shipId,
    slotType: selector.slotType,
    size: ref.size,
    tagsAll: ref.tags,
    filters
  })))
}
