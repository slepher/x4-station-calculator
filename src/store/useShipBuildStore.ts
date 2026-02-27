import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { ConnectionValue, EquipmentType, ShipBlueprint, ShipBlueprintConnection, ShipEquipmentSize, X4Equipment, X4EquipmentType, X4Ship, X4Ware } from '@/types/x4'
import type { FitConnectionRow, FitGroupRow, FitMode } from '@/components/ship-build/fitTypes'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'

const STORAGE_KEY = 'x4_ship_blueprints'

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

export type ShipBuildMaterialItem = {
  wareId: string
  count: number
  value: number
}

export type ShipBuildMaterialShipGroup = {
  shipId: string
  value: number
  items: ShipBuildMaterialItem[]
}

export type ShipBuildMaterialHullGroup = {
  shipId: string
  value: number
  items: ShipBuildMaterialItem[]
}

export type ShipBuildMaterialEquipmentGroup = {
  equipmentId: string
  equipmentName: string
  quantity: number
  value: number
  items: ShipBuildMaterialItem[]
}

export type ShipBuildMaterialAnalysis = {
  methodOptions: string[]
  selectedMethod: string
  priceMultiplier: number
  totalValue: number
  summaryItems: ShipBuildMaterialItem[]
  shipGroup: ShipBuildMaterialShipGroup | null
  equipmentGroups: ShipBuildMaterialEquipmentGroup[]
}

export const useShipBuildStore = defineStore('ship-build', () => {
  const ships = shipsRaw as unknown as X4Ship[]
  const equipments = equipmentsRaw as X4Equipment[]
  const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]
  const wares = waresRaw as X4Ware[]
  const activeView = ref<StationActiveView>(
    (localStorage.getItem('x4_station_active_view') as StationActiveView) || 'production'
  )
  const selectedClass = ref<ShipBuildClass | null>(null)
  const selectedRaces = ref<string[]>([])
  const selectedTypes = ref<string[]>([])
  const selectedShipId = ref<string | null>(null)
  const statsViewMode = ref<ShipBuildStatsViewMode>('summary')
  const fitMode = ref<FitMode>('connection')
  // Blueprint persistence state
  const blueprint = ref<ShipBlueprint | null>(null)
  const savedBlueprints = ref<{ version: 1; activeId: string | null; list: ShipBlueprint[] }>({
    version: 1,
    activeId: null,
    list: []
  })
  const lastSavedSnapshot = ref<string | null>(null)

  const selectedByConnection = ref<Record<string, string | null>>({})
  const mockTagPatch = ref<ShipBuildMockTagPatch | null>(null)
  const translateEquipmentFn = ref<(equipment: X4Equipment) => string>((equipment) => equipment.name || equipment.id)
  const translateEquipmentTypeFn = ref<(type: X4EquipmentType) => string>((type) => type.name || type.id)
  const equipmentTypeMap = new Map<EquipmentType, X4EquipmentType>()
  const equipmentMap = new Map<string, X4Equipment>()
  const waresMap = new Map<string, X4Ware>()
  equipmentTypes.forEach((type) => {
    equipmentTypeMap.set(type.id, type)
  })
  equipments.forEach((equipment) => {
    equipmentMap.set(equipment.id, equipment)
  })
  wares.forEach((ware) => {
    waresMap.set(ware.id, ware)
  })

  watch(activeView, (val) => {
    localStorage.setItem('x4_station_active_view', val)
  })

  // Load blueprints from localStorage
  const loadBlueprintsFromStorage = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        savedBlueprints.value = JSON.parse(data)
      }
    } catch (e) {
      console.error('Failed to load blueprints from storage:', e)
    }
  }

  // Save blueprints to localStorage
  const saveBlueprintsToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBlueprints.value))
    } catch (e) {
      console.error('Failed to save blueprints to storage:', e)
    }
  }

  // Initialize: load from storage
  loadBlueprintsFromStorage()

  // Take snapshot for dirty check
  const takeSnapshot = () => {
    lastSavedSnapshot.value = JSON.stringify({
      shipId: selectedShipId.value,
      blueprint: blueprint.value
    })
  }

  // If activeId exists, auto-load the corresponding blueprint after a tick
  if (savedBlueprints.value.activeId) {
    const activeBlueprint = savedBlueprints.value.list.find(b => b.id === savedBlueprints.value.activeId)
    if (activeBlueprint) {
      // Use queueMicrotask to defer the update until after current execution context
      queueMicrotask(() => {
        // Find ship to get race and type info
        const ship = ships.find(s => s.id === activeBlueprint.shipId)

        // Determine class from ship ID pattern (same logic as loadBlueprint)
        let shipClass: ShipBuildClass | null = null
        if (activeBlueprint.shipId.includes('_s_')) shipClass = 'ship_s'
        else if (activeBlueprint.shipId.includes('_m_')) shipClass = 'ship_m'
        else if (activeBlueprint.shipId.includes('_l_')) shipClass = 'ship_l'
        else if (activeBlueprint.shipId.includes('_xl_')) shipClass = 'ship_xl'

        // Set filters (same as loadBlueprint)
        selectedClass.value = shipClass
        selectedRaces.value = ship?.race ? [ship.race] : []
        selectedTypes.value = ship?.type ? [ship.type] : []
        selectedShipId.value = activeBlueprint.shipId
        blueprint.value = { ...activeBlueprint }

        // Set dirty to false by directly setting lastSavedSnapshot
        lastSavedSnapshot.value = JSON.stringify({
          shipId: activeBlueprint.shipId,
          blueprint: activeBlueprint
        })
      })
    }
  }

  // isDirty computed
  const isDirty = computed(() => {
    if (!lastSavedSnapshot.value) return false
    const current = JSON.stringify({
      shipId: selectedShipId.value,
      blueprint: blueprint.value
    })
    return current !== lastSavedSnapshot.value
  })

  // Find connection in blueprint, create if not exists
  const findOrCreateConnection = (slotType: string): ShipBlueprintConnection => {
    if (!blueprint.value) {
      blueprint.value = {
        id: '',
        name: '',
        shipId: selectedShipId.value || '',
        connections: [],
        lastUpdated: Date.now()
      }
    }
    let connection = blueprint.value.connections.find(c => c.slot_type === slotType)
    if (!connection) {
      connection = { slot_type: slotType, group: [] }
      blueprint.value.connections.push(connection)
    }
    return connection
  }

  // Find group in connection
  const findGroup = (connection: ShipBlueprintConnection, groupName: string) => {
    return connection.group.find(g => g.group === groupName)
  }

  // setEquipment: set equipment for a single group
  const setEquipment = (
    slotType: string,
    groupName: string,
    equipmentId: string | null,
    count: number
  ) => {
    const connection = findOrCreateConnection(slotType)
    const groupData = findGroup(connection, groupName)

    if (equipmentId === null) {
      // Remove the group entry entirely
      connection.group = connection.group.filter(g => g.group !== groupName)
      // If connection.group is empty, remove the connection
      if (connection.group.length === 0) {
        blueprint.value!.connections = blueprint.value!.connections.filter(c => c.slot_type !== slotType)
      }
    } else {
      // Set or update equipment
      if (groupData) {
        groupData.equipment_id = equipmentId
        groupData.count = count
      } else {
        connection.group.push({ group: groupName, equipment_id: equipmentId, count })
      }
    }

    // Update shipId if changed
    if (blueprint.value && selectedShipId.value) {
      blueprint.value.shipId = selectedShipId.value
    }
  }

  // setShield: set shield for a group
  const setShield = (
    slotType: string,
    groupName: string,
    equipmentId: string | null,
    count: number
  ) => {
    const connection = findOrCreateConnection(slotType)
    let groupData = findGroup(connection, groupName)

    // Create group if it doesn't exist (similar to setEquipment)
    if (!groupData && equipmentId !== null) {
      // Create a new group with the shield - main equipment can be added later
      // Required fields: group, equipment_id, count
      connection.group.push({
        group: groupName,
        equipment_id: '', // Placeholder - main equipment not set yet
        count: 0, // Placeholder - will be updated when main equipment is set
        shield: { equipment_id: equipmentId, count }
      })
      return
    }

    if (groupData) {
      if (equipmentId === null) {
        // Remove shield
        delete groupData.shield
      } else {
        groupData.shield = { equipment_id: equipmentId, count }
      }
    }
  }

  // setGroupEquipment: batch set equipment for multiple connections (for group mode)
  const setGroupEquipment = (
    slotType: string,
    groupName: string,
    equipmentId: string | null,
    count: number
  ) => {
    // In group mode, we apply to all connections with matching group name
    if (!selectedShip.value) return

    selectedShip.value.slots.forEach((slot) => {
      if (slot.type !== slotType) return
      slot.groups.forEach((group) => {
        if (group.group === groupName) {
          setEquipment(slotType, groupName, equipmentId, count)
        }
      })
    })
  }

  // setGroupShield: batch set shield for multiple connections
  const setGroupShield = (
    slotType: string,
    groupName: string,
    equipmentId: string | null,
    count: number
  ) => {
    if (!selectedShip.value) return

    selectedShip.value.slots.forEach((slot) => {
      if (slot.type !== slotType) return
      slot.groups.forEach((group) => {
        if (group.group === groupName) {
          setShield(slotType, groupName, equipmentId, count)
        }
      })
    })
  }

  // Build connectionKey from ship data
  const buildConnectionKey = (shipId: string, slotType: string, slotIndex: number, groupIndex: number, isShield: boolean = false) => {
    return isShield
      ? `${shipId}::${slotType}::${slotIndex}::${groupIndex}::shield`
      : `${shipId}::${slotType}::${slotIndex}::${groupIndex}`
  }

  // computed selectedByConnection from blueprint
  const selectedByConnectionComputed = computed(() => {
    const result: Record<string, ConnectionValue> = {}
    if (!blueprint.value || !selectedShip.value) return result

    const ship = selectedShip.value
    ship.slots.forEach((slot, slotIndex) => {
      slot.groups.forEach((group, groupIndex) => {
        const groupData = blueprint.value!.connections
          .find(c => c.slot_type === slot.type)
          ?.group.find(g => g.group === group.group)

        const baseKey = buildConnectionKey(ship.id, slot.type, slotIndex, groupIndex)

        if (groupData) {
          result[baseKey] = {
            equipmentId: groupData.equipment_id,
            count: groupData.count
          }

          // Handle shield
          if (groupData.shield) {
            const shieldKey = buildConnectionKey(ship.id, slot.type, slotIndex, groupIndex, true)
            result[shieldKey] = {
              equipmentId: groupData.shield.equipment_id,
              count: groupData.shield.count
            }
          }
        } else {
          result[baseKey] = {
            equipmentId: null,
            count: group.connection?.count || 0
          }

          // Handle shield even when no main equipment
          if (group.connection?.shield) {
            const shieldKey = buildConnectionKey(ship.id, slot.type, slotIndex, groupIndex, true)
            result[shieldKey] = {
              equipmentId: null,
              count: group.connection.shield.count || 0
            }
          }
        }
      })
    })

    return result
  })

  // CRUD Operations
  const saveBlueprint = () => {
    if (!blueprint.value || !selectedShipId.value) return

    const idx = savedBlueprints.value.list.findIndex(b => b.id === blueprint.value!.id)
    blueprint.value.shipId = selectedShipId.value
    blueprint.value.lastUpdated = Date.now()

    if (idx !== -1) {
      savedBlueprints.value.list[idx] = JSON.parse(JSON.stringify(blueprint.value))
    } else {
      // No active blueprint, create new one
      blueprint.value.id = crypto.randomUUID()
      blueprint.value.name = blueprint.value.name || 'Unnamed Blueprint'
      savedBlueprints.value.list.push(JSON.parse(JSON.stringify(blueprint.value)))
    }

    savedBlueprints.value.activeId = blueprint.value.id
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  const saveAsBlueprint = (name: string) => {
    if (!selectedShipId.value) return

    const newBlueprint: ShipBlueprint = {
      id: crypto.randomUUID(),
      name,
      shipId: selectedShipId.value,
      connections: blueprint.value ? JSON.parse(JSON.stringify(blueprint.value.connections)) : [],
      lastUpdated: Date.now()
    }

    savedBlueprints.value.list.push(newBlueprint)
    savedBlueprints.value.activeId = newBlueprint.id
    blueprint.value = newBlueprint
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  const loadBlueprint = (id: string) => {
    const bp = savedBlueprints.value.list.find(b => b.id === id)
    if (!bp) return

    const ship = ships.find(s => s.id === bp.shipId)
    if (!ship) {
      console.error('Ship not found for blueprint:', bp.shipId)
      return
    }

    // Auto-set filters based on ship
    // Determine class from ship ID pattern
    let shipClass: ShipBuildClass | null = null
    if (bp.shipId.includes('_s_')) shipClass = 'ship_s'
    else if (bp.shipId.includes('_m_')) shipClass = 'ship_m'
    else if (bp.shipId.includes('_l_')) shipClass = 'ship_l'
    else if (bp.shipId.includes('_xl_')) shipClass = 'ship_xl'

    selectedClass.value = shipClass
    selectedRaces.value = ship.race ? [ship.race] : []
    selectedTypes.value = ship.type ? [ship.type] : []
    selectedShipId.value = bp.shipId

    // Load blueprint
    blueprint.value = JSON.parse(JSON.stringify(bp))
    savedBlueprints.value.activeId = id
    takeSnapshot()
  }

  const deleteBlueprint = (id: string) => {
    const idx = savedBlueprints.value.list.findIndex(b => b.id === id)
    if (idx === -1) return

    savedBlueprints.value.list.splice(idx, 1)

    // If deleted was active, clear active
    if (savedBlueprints.value.activeId === id) {
      savedBlueprints.value.activeId = null
      if (blueprint.value?.id === id) {
        blueprint.value = null
      }
    }

    saveBlueprintsToStorage()
    takeSnapshot()
  }

  // Sync selectedByConnection with computed
  watch(selectedByConnectionComputed, (newVal) => {
    selectedByConnection.value = Object.fromEntries(
      Object.entries(newVal).map(([k, v]) => [k, v.equipmentId])
    )
  }, { immediate: true, deep: true })

  const setSelectedShipId = (shipId: string | null) => {
    if (selectedShipId.value === shipId) return
    // When changing ship (setting to null), clear the blueprint
    if (shipId === null) {
      blueprint.value = null
      lastSavedSnapshot.value = null
    } else {
      // Create blueprint immediately when ship is selected
      blueprint.value = {
        id: '',
        name: '',
        shipId: shipId,
        connections: [],
        lastUpdated: Date.now()
      }
    }
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
    // Use connectionKeyMap to get slotType and groupName, then update blueprint via setEquipment/setShield
    const info = connectionKeyMap.value.get(payload.connectionKey)
    if (!info) return

    if (info.isShield) {
      // For shield slots, there are two cases:
      // 1. Direct shield slot (ship has dedicated shield slots): 4 parts - shipId::shield::slotIndex::groupIndex
      // 2. Shield attached to other slot (engine/weapon): 5 parts - shipId::parentSlotType::slotIndex::groupIndex::shield
      const parts = payload.connectionKey.split('::')

      // Case 1: Direct shield slot (slotType = 'shield' and parentSlotType = 'shield')
      if (parts.length === 4 && parts[1] === 'shield') {
        // For direct shield slot, use setEquipment with slotType='shield'
        setEquipment(info.slotType, info.groupName, payload.equipmentId, info.count)
        return
      }

      // Case 2: Shield attached to another slot (5 parts with 'shield' suffix)
      if (parts.length >= 5 && parts[4] === 'shield') {
        const shipId = parts[0]
        const parentSlotType = parts[1]
        const slotIndex = parts[2]
        const groupIndex = parts[3]
        if (!shipId || !parentSlotType || !slotIndex || !groupIndex) return
        // Find the parent slot (the slot that has this shield)
        const parentRows = connectionRows.value.filter(r =>
          r.slotType === parentSlotType &&
          r.connectionKey === `${shipId}::${parentSlotType}::${slotIndex}::${groupIndex}`
        )
        const firstParentRow = parentRows[0]
        if (firstParentRow) {
          setShield(parentSlotType, firstParentRow.groupName, payload.equipmentId, info.count)
        }
      }
    } else {
      setEquipment(info.slotType, info.groupName, payload.equipmentId, info.count)
    }
  }

  const applyGroupAssignment = (payload: { connectionKeys: string[]; equipmentId: string | null }) => {
    // Group assignment updates multiple connections at once
    // For simplicity, call applyConnectionAssignment for each key
    payload.connectionKeys.forEach((connectionKey) => {
      applyConnectionAssignment({ connectionKey, equipmentId: payload.equipmentId })
    })
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
      .sort((a, b) => a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
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

        // Always generate shield rows for ships with shield slots, even if no shield configured yet
        // This ensures the UI can display shield slots for user to configure
        const shieldConnection = connection?.shield
        const shieldKey = `${baseKey}::shield`
        const shieldPatchItem = patch?.targetShipId === selectedShip.value!.id ? patch.connections[shieldKey] : null
        // Use shield from blueprint if exists, otherwise use ship's default shield definition
        const shieldDef = shieldConnection || group.connection?.shield
        const shieldTags = shieldPatchItem
          ? normalizeTagList(shieldPatchItem.tags)
          : (shieldDef ? normalizeTagList(shieldDef.tags) : [])
        const shieldSize = shieldPatchItem
          ? resolveSize(shieldPatchItem.size, shieldDef?.size)
          : resolveSize(undefined, shieldDef?.size)
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
          count: shieldDef?.count || 0,
          options: getEquipmentCandidates(
            'shield',
            shieldSize,
            shieldTags
          )
        })
      })
    })

    return rows
  })

  // Map connectionKey to slotType and groupName for applyConnectionAssignment
  const connectionKeyMap = computed(() => {
    const map = new Map<string, { slotType: string; groupName: string; isShield: boolean; count: number }>()
    connectionRows.value.forEach((row) => {
      map.set(row.connectionKey, {
        slotType: row.slotType,
        groupName: row.groupName,
        isShield: row.slotType === 'shield',
        count: row.count
      })
    })
    return map
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
      existing.options = Array.from(optionMap.values()).sort((a, b) => a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
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

  // Reset all filters and blueprint (for New action)
  const resetAll = () => {
    blueprint.value = null
    selectedShipId.value = null
    selectedClass.value = null
    selectedRaces.value = []
    selectedTypes.value = []
    lastSavedSnapshot.value = null
  }

  return {
    // 全局字典数据
    ships,
    wares,
    equipments,
    equipmentTypes,
    // 状态
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
    // Blueprint persistence
    blueprint,
    savedBlueprints,
    isDirty,
    setEquipment,
    setShield,
    setGroupEquipment,
    setGroupShield,
    saveBlueprint,
    saveAsBlueprint,
    loadBlueprint,
    deleteBlueprint,
    loadBlueprintsFromStorage,
    resetAll,
    // Legacy methods (keep for backward compatibility)
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
