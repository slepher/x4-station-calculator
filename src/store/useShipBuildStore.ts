import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { EquipmentType, ShipEquipmentSize, X4Equipment, X4EquipmentType, X4Ship } from '@/types/x4'
import type { FitConnectionRow, FitGroupRow, FitMode } from '@/components/ship-build/fitTypes'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'

export type StationActiveView = 'production' | 'flow' | 'ship-build'
export type ShipBuildClass = 'ship_s' | 'ship_m' | 'ship_l' | 'ship_xl'
export type ShipBuildStatsViewMode = 'summary' | 'detail'
export type ShipBuildMockTagPatch = {
  targetShipId: string
  slotType?: EquipmentType
  connections: Record<string, {
    groupName?: string
    size?: ShipEquipmentSize
    tags: string[]
  }>
}

export const useShipBuildStore = defineStore('ship-build', () => {
  const ships = shipsRaw as unknown as X4Ship[]
  const equipments = equipmentsRaw as X4Equipment[]
  const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]
  const activeView = ref<StationActiveView>(
    (localStorage.getItem('x4_station_active_view') as StationActiveView) || 'production'
  )
  const selectedClass = ref<ShipBuildClass | null>(null)
  const selectedRaces = ref<string[]>([])
  const selectedTypes = ref<string[]>([])
  const selectedShipId = ref<string | null>(null)
  const statsViewMode = ref<ShipBuildStatsViewMode>('summary')
  const fitMode = ref<FitMode>('connection')
  const selectedByConnection = ref<Record<string, string | null>>({})
  const mockTagPatch = ref<ShipBuildMockTagPatch | null>(null)
  const translateEquipmentFn = ref<(equipment: X4Equipment) => string>((equipment) => equipment.name || equipment.id)
  const translateEquipmentTypeFn = ref<(type: X4EquipmentType) => string>((type) => type.name || type.id)
  const equipmentTypeMap = new Map<EquipmentType, X4EquipmentType>()
  equipmentTypes.forEach((type) => {
    equipmentTypeMap.set(type.id, type)
  })

  watch(activeView, (val) => {
    localStorage.setItem('x4_station_active_view', val)
  })

  const setSelectedShipId = (shipId: string | null) => {
    if (selectedShipId.value === shipId) return
    selectedShipId.value = shipId
    selectedByConnection.value = {}
    fitMode.value = 'connection'
  }

  const setSelectedClass = (shipClass: ShipBuildClass | null) => {
    selectedClass.value = shipClass
  }

  const toggleRace = (raceId: string) => {
    if (selectedRaces.value.includes(raceId)) {
      selectedRaces.value = selectedRaces.value.filter((id) => id !== raceId)
    } else {
      selectedRaces.value = [...selectedRaces.value, raceId]
    }
  }

  const toggleType = (typeId: string) => {
    if (selectedTypes.value.includes(typeId)) {
      selectedTypes.value = selectedTypes.value.filter((id) => id !== typeId)
    } else {
      selectedTypes.value = [...selectedTypes.value, typeId]
    }
  }

  const setSelectedTypes = (types: string[]) => {
    selectedTypes.value = types
  }

  const setFitMode = (mode: FitMode) => {
    if (mode === 'group' && hasFitModeConflict.value) return
    fitMode.value = mode
  }

  const applyConnectionAssignment = (payload: { connectionKey: string; equipmentId: string | null }) => {
    selectedByConnection.value = {
      ...selectedByConnection.value,
      [payload.connectionKey]: payload.equipmentId
    }
  }

  const applyGroupAssignment = (payload: { connectionKeys: string[]; equipmentId: string | null }) => {
    const nextState = { ...selectedByConnection.value }
    payload.connectionKeys.forEach((connectionKey) => {
      nextState[connectionKey] = payload.equipmentId
    })
    selectedByConnection.value = nextState
  }

  const setStatsViewMode = (mode: ShipBuildStatsViewMode) => {
    statsViewMode.value = mode
  }

  const setMockTagPatch = (patch: ShipBuildMockTagPatch | null) => {
    mockTagPatch.value = patch
  }

  const setDisplayResolvers = (payload: {
    translateEquipment?: (equipment: X4Equipment) => string
    translateEquipmentType?: (type: X4EquipmentType) => string
  }) => {
    if (payload.translateEquipment) {
      translateEquipmentFn.value = payload.translateEquipment
    }
    if (payload.translateEquipmentType) {
      translateEquipmentTypeFn.value = payload.translateEquipmentType
    }
  }

  const normalizeTagList = (tags: unknown): string[] => {
    if (!Array.isArray(tags)) return []
    return tags.filter((tag): tag is string => typeof tag === 'string')
  }

  const resolveSize = (
    primary?: ShipEquipmentSize,
    fallback?: ShipEquipmentSize
  ): ShipEquipmentSize | null => primary ?? fallback ?? null

  const getEquipmentCandidates = (
    slotType: EquipmentType,
    size: ShipEquipmentSize,
    connectionTags: string[]
  ) => {
    return equipments
      .filter((equipment) => !equipment.noplayerblueprint)
      .filter((equipment) => equipment.type === slotType && equipment.size === size)
      .filter((equipment) => {
        if (connectionTags.length === 0) return true
        const equipmentTags = normalizeTagList(equipment.slotTags)
        const connectionSet = new Set(connectionTags)
        return equipmentTags.every((tag) => connectionSet.has(tag))
      })
      .map((equipment) => ({
        id: equipment.id,
        name: translateEquipmentFn.value(equipment),
        mk: equipment.mk || null,
        race: equipment.race || null,
        tags: normalizeTagList(equipment.slotTags)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const selectedShip = computed(() => {
    if (!selectedShipId.value) return null
    return ships.find((ship) => ship.id === selectedShipId.value) || null
  })

  const connectionRows = computed<FitConnectionRow[]>(() => {
    if (!selectedShip.value) return []

    const rows: FitConnectionRow[] = []
    selectedShip.value.slots.forEach((slot, slotIndex) => {
      slot.groups.forEach((group, groupIndex) => {
        const baseKey = `${selectedShip.value!.id}::${slot.type}::${slotIndex}::${groupIndex}`
        const patch = mockTagPatch.value
        const patchItem = patch?.targetShipId === selectedShip.value!.id ? patch.connections[baseKey] : null
        const connection = group.connection
        const connectionSize = resolveSize(patchItem?.size, connection?.size)
        if (!connectionSize) return
        const sourceTags = patchItem?.tags || connection?.tags || []
        const tags = normalizeTagList(sourceTags)
        const typeDef = equipmentTypeMap.get(slot.type)

        rows.push({
          connectionKey: baseKey,
          slotType: slot.type,
          parentSlotType: slot.type,
          parentConnectionSize: connectionSize,
          parentConnectionTags: [...tags],
          slotTypeLabel: typeDef ? translateEquipmentTypeFn.value(typeDef) : slot.type,
          groupName: patchItem?.groupName || group.group,
          size: connectionSize,
          tags,
          count: connection?.count || 0,
          options: getEquipmentCandidates(
            slot.type,
            connectionSize,
            tags
          )
        })

        if (connection?.shield) {
          const shieldKey = `${baseKey}::shield`
          const shieldPatchItem = patch?.targetShipId === selectedShip.value!.id ? patch.connections[shieldKey] : null
          const shieldTags = normalizeTagList(shieldPatchItem?.tags || connection.shield.tags)
          const shieldSize = resolveSize(shieldPatchItem?.size, connection.shield.size)
          if (!shieldSize) return
          const shieldTypeDef = equipmentTypeMap.get('shield')
          const shieldTypeLabel = shieldTypeDef ? translateEquipmentTypeFn.value(shieldTypeDef) : 'shield'
          rows.push({
            connectionKey: shieldKey,
            slotType: 'shield',
            parentSlotType: slot.type,
            parentConnectionSize: connectionSize,
            parentConnectionTags: [...tags],
            slotTypeLabel: shieldTypeLabel,
            groupName: shieldPatchItem?.groupName || group.group,
            size: shieldSize,
            tags: shieldTags,
            count: connection.shield.count || 0,
            options: getEquipmentCandidates(
              'shield',
              shieldSize,
              shieldTags
            )
          })
        }
      })
    })

    return rows
  })

  const buildTagSignature = (tags: string[]) => [...tags].sort().join('&')

  const groupRows = computed<FitGroupRow[]>(() => {
    const grouped = new Map<string, FitGroupRow>()
    connectionRows.value.forEach((row) => {
      const tagSignature = buildTagSignature(row.tags)
      const parentTagSignature = buildTagSignature(row.parentConnectionTags || [])
      const groupKey = row.slotType === 'shield'
        ? `${row.parentSlotType}|shield|${row.parentConnectionSize}|${parentTagSignature}|${row.size}|${tagSignature}`
        : `${row.parentSlotType}|${row.slotType}|${row.size}|${tagSignature}`
      const existing = grouped.get(groupKey)
      if (!existing) {
        grouped.set(groupKey, {
          groupKey,
          slotType: row.slotType,
          parentSlotType: row.parentSlotType,
          parentConnectionSize: row.parentConnectionSize,
          parentConnectionTags: [...row.parentConnectionTags],
          slotTypeLabel: row.slotTypeLabel,
          groupName: tagSignature || 'default-tags',
          size: row.size,
          totalCount: row.count,
          tags: [...row.tags],
          options: [...row.options],
          connectionKeys: [row.connectionKey]
        })
        return
      }

      existing.totalCount += row.count
      existing.connectionKeys.push(row.connectionKey)
      const tagSet = new Set([...existing.tags, ...row.tags])
      existing.tags = Array.from(tagSet)

      const optionMap = new Map(existing.options.map((item) => [item.id, item]))
      row.options.forEach((item) => optionMap.set(item.id, item))
      existing.options = Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    })

    return Array.from(grouped.values())
  })

  const hasFitModeConflict = computed(() => {
    return groupRows.value.some((group) => {
      const selectedSet = new Set(
        group.connectionKeys
          .map((key) => selectedByConnection.value[key])
          .filter((value): value is string => Boolean(value))
      )
      return selectedSet.size > 1
    })
  })

  const canSwitchToGroupMode = computed(() => !hasFitModeConflict.value)

  return {
    activeView,
    selectedClass,
    selectedRaces,
    selectedTypes,
    selectedShipId,
    statsViewMode,
    fitMode,
    selectedByConnection,
    mockTagPatch,
    selectedShip,
    connectionRows,
    groupRows,
    hasFitModeConflict,
    canSwitchToGroupMode,
    setSelectedShipId,
    setSelectedClass,
    toggleRace,
    toggleType,
    setSelectedTypes,
    setFitMode,
    applyConnectionAssignment,
    applyGroupAssignment,
    setStatsViewMode,
    setMockTagPatch,
    setDisplayResolvers
  }
})
