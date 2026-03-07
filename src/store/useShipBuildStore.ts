import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  ConnectionValue,
  EquipmentType,
  SavedShipBlueprintsState,
  ShipBlueprint,
  ShipBlueprintBucket,
  ShipBlueprintConnection,
  ShipEquipmentSize,
  X4Equipment,
  X4EquipmentType,
  X4Ship,
  X4ShipRace,
  X4ShipType,
  X4SlotTag,
  X4Ware
} from '@/types/x4'
import type { FitConnectionRow, FitMode } from '@/components/ship-build/fitTypes'
import { migrateShipBlueprintStateToCurrent } from './logic/stateMigrations'
import { CURRENT_SHIP_BLUEPRINT_VERSION } from './logic/storageVersions'
import { buildConsumableDatas, buildShipBuildDatas, getShipBuildRawData } from './logic/useGameData'

const STORAGE_KEY = 'x4_ship_blueprints'

export type StationActiveView = 'production' | 'flow' | 'ship-build'
export type ShipBuildClass = 'ship_s' | 'ship_m' | 'ship_l' | 'ship_xl'
export type ShipBuildStatsViewMode = 'summary' | 'detail'
export type ShipBuildViewMode = 'selector' | 'workspace'
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
  const shipBuildRaw = getShipBuildRawData()
  const ships = shipBuildRaw.ships as X4Ship[]
  const equipments = shipBuildRaw.equipments as X4Equipment[]
  const equipmentTypes = shipBuildRaw.equipmentTypes as X4EquipmentType[]
  const slotTags = shipBuildRaw.slotTags as X4SlotTag[]
  const wares = shipBuildRaw.wares as X4Ware[]
  const {
    shipMap,
    raceMap,
    typeMap,
    equipmentMap,
    shipTypes,
    shipRaces
  } = buildShipBuildDatas({
    ships,
    races: shipBuildRaw.races as X4ShipRace[],
    types: shipBuildRaw.types as X4ShipType[],
    equipments
  })
  const {
    consumables,
    drones,
    missiles,
    consumablesMap,
    dronesMap,
    missilesMap
  } = buildConsumableDatas()
  const activeView = ref<StationActiveView>(
    (localStorage.getItem('x4_station_active_view') as StationActiveView) || 'production'
  )
  const selectedClass = ref<ShipBuildClass | null>(null)
  const selectedRaces = ref<string[]>([])
  const selectedTypes = ref<string[]>([])
  const viewMode = ref<ShipBuildViewMode>('selector')
  const statsViewMode = ref<ShipBuildStatsViewMode>('summary')
  const fitMode = ref<FitMode>('connection')
  // Blueprint persistence state
  const blueprint = ref<ShipBlueprint | null>(null)
  const selectedShipId = computed<string | null>(() => blueprint.value?.shipId || null)
  const savedBlueprints = ref<SavedShipBlueprintsState>({
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: null,
    activeBlueprintId: null,
    ships: []
  })
  const lastSavedSnapshot = ref<string | null>(null)

  const selectedByConnection = ref<Record<string, string | null>>({})
  const mockTagPatch = ref<ShipBuildMockTagPatch | null>(null)
  const translateEquipmentFn = ref<(equipment: X4Equipment) => string>((equipment) => equipment.name || equipment.id)
  const translateEquipmentTypeFn = ref<(type: X4EquipmentType) => string>((type) => type.name || type.id)
  const equipmentTypeMap = new Map<EquipmentType, X4EquipmentType>()
  const waresMap = new Map<string, X4Ware>()
  equipmentTypes.forEach((type) => {
    equipmentTypeMap.set(type.id, type)
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
        const parsed = JSON.parse(data)
        const migrated = migrateShipBlueprintStateToCurrent(parsed)
        migrated.warnings.forEach((warning) => console.warn('[ShipBuildStore][Migration]', warning))
        savedBlueprints.value = migrated.state
        saveBlueprintsToStorage()
      } else {
        savedBlueprints.value = {
          version: CURRENT_SHIP_BLUEPRINT_VERSION,
          activeShipId: null,
          activeBlueprintId: null,
          ships: []
        }
      }
    } catch (e) {
      console.error('Failed to load blueprints from storage:', e)
      savedBlueprints.value = {
        version: CURRENT_SHIP_BLUEPRINT_VERSION,
        activeShipId: null,
        activeBlueprintId: null,
        ships: []
      }
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

  const getBucketByShipId = (shipId: string): ShipBlueprintBucket | null => {
    return savedBlueprints.value.ships.find((bucket) => bucket.shipId === shipId) || null
  }

  const getOrCreateBucketByShipId = (shipId: string): ShipBlueprintBucket => {
    const existing = getBucketByShipId(shipId)
    if (existing) return existing
    const created: ShipBlueprintBucket = { shipId, blueprints: [] }
    savedBlueprints.value.ships.push(created)
    return created
  }

  const getAllSavedBlueprints = (): ShipBlueprint[] => {
    return savedBlueprints.value.ships.flatMap((bucket) => bucket.blueprints)
  }

  const findBlueprintById = (id: string): ShipBlueprint | null => {
    for (const bucket of savedBlueprints.value.ships) {
      const found = bucket.blueprints.find((item) => item.id === id)
      if (found) return found
    }
    return null
  }

  const findShip = (shipId: string | null | undefined): X4Ship | null => {
    if (!shipId) return null
    return shipMap.get(shipId) || null
  }

  const findEquipmentType = (typeId: EquipmentType | string | null | undefined): X4EquipmentType | null => {
    if (!typeId) return null
    return equipmentTypeMap.get(typeId as EquipmentType) || null
  }

  const findEquipment = (equipmentId: string | null | undefined): X4Equipment | null => {
    if (!equipmentId) return null
    return equipmentMap.get(equipmentId) || null
  }

  const findWare = (wareId: string | null | undefined): X4Ware | null => {
    if (!wareId) return null
    return waresMap.get(wareId) || null
  }

  const getBlueprintsForShip = (shipId: string | null): ShipBlueprint[] => {
    if (!shipId) return []
    return getBucketByShipId(shipId)?.blueprints || []
  }

  const resolveCurrentShipId = (): string | null => {
    return blueprint.value?.shipId || null
  }

  const createEmptyBlueprintForShip = (shipId: string): ShipBlueprint => ({
    id: '',
    name: '',
    shipId,
    connections: [],
    lastUpdated: Date.now()
  })

  // Take snapshot for dirty check
  const takeSnapshot = () => {
    const shipId = resolveCurrentShipId()
    lastSavedSnapshot.value = JSON.stringify({
      shipId,
      blueprint: blueprint.value
    })
  }

  // If active blueprint exists, auto-load the corresponding blueprint after a tick
  if (savedBlueprints.value.activeBlueprintId) {
    const activeBlueprint = findBlueprintById(savedBlueprints.value.activeBlueprintId)
    if (activeBlueprint) {
      // Use queueMicrotask to defer the update until after current execution context
      queueMicrotask(() => {
        // Find ship to get race and type info
        const ship = findShip(activeBlueprint.shipId)

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
        viewMode.value = 'workspace'
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
    const shipId = resolveCurrentShipId()
    const current = JSON.stringify({
      shipId,
      blueprint: blueprint.value
    })
    return current !== lastSavedSnapshot.value
  })

  const isEditable = () => !resolveCurrentShipId()

  const isEmptyForSave = () => {
    if (!resolveCurrentShipId()) return true
    if (!blueprint.value) return true

    const hasConnectionEquipment = blueprint.value.connections.some((connection) =>
      connection.group.some((group) => Boolean(group.equipment_id) || Boolean(group.shield?.equipment_id))
    )
    if (hasConnectionEquipment) return false

    const storage = blueprint.value.storage
    if (!storage) return true

    const hasDeployables = storage.deployables?.some((item) => item.count > 0) || false
    const hasDrones = storage.drones?.some((item) => item.count > 0) || false
    const hasMissiles = storage.missiles?.some((item) => item.count > 0) || false
    const hasCountermeasure = (storage.countermeasure?.count || 0) > 0
    return !(hasDeployables || hasDrones || hasMissiles || hasCountermeasure)
  }

  // Find connection in blueprint, create if not exists
  const findOrCreateConnection = (slotType: string): ShipBlueprintConnection => {
    if (!blueprint.value) {
      const shipId = resolveCurrentShipId()
      blueprint.value = {
        id: '',
        name: '',
        shipId: shipId || '',
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

  const cleanupEmptyGroups = () => {
    if (!blueprint.value) return
    blueprint.value.connections.forEach((connection) => {
      connection.group = connection.group.filter((group) => {
        const hasEquipment = Boolean(group.equipment_id)
        const hasShield = Boolean(group.shield?.equipment_id)
        return hasEquipment || hasShield
      })
    })
    blueprint.value.connections = blueprint.value.connections.filter((connection) => connection.group.length > 0)
    // Sort connections by fixed order: engine -> thruster -> shield -> weapon -> turret
    const slotOrder = ['engine', 'thruster', 'shield', 'weapon', 'turret']
    blueprint.value.connections.sort((a, b) => {
      const orderA = slotOrder.indexOf(a.slot_type)
      const orderB = slotOrder.indexOf(b.slot_type)
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
    })
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
      if (groupData) {
        groupData.equipment_id = ''
        groupData.count = count
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
    if (blueprint.value) {
      const shipId = resolveCurrentShipId()
      if (shipId) blueprint.value.shipId = shipId
    }
    cleanupEmptyGroups()
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
        groupData.shield = { equipment_id: '', count }
      } else {
        groupData.shield = { equipment_id: equipmentId, count }
      }
    }
    cleanupEmptyGroups()
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
    if (!blueprint.value) return
    const shipId = resolveCurrentShipId()
    if (!shipId) return

    const bucket = getOrCreateBucketByShipId(shipId)
    const idx = bucket.blueprints.findIndex((b) => b.id === blueprint.value!.id)
    blueprint.value.shipId = shipId
    blueprint.value.lastUpdated = Date.now()

    if (idx !== -1) {
      bucket.blueprints[idx] = JSON.parse(JSON.stringify(blueprint.value))
    } else {
      // No active blueprint, create new one
      blueprint.value.id = crypto.randomUUID()
      // name 保持为空，UI 会显示默认名称
      bucket.blueprints.push(JSON.parse(JSON.stringify(blueprint.value)))
    }

    savedBlueprints.value.activeShipId = shipId
    savedBlueprints.value.activeBlueprintId = blueprint.value.id
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  const saveAsBlueprint = (name: string) => {
    const shipId = resolveCurrentShipId()
    if (!shipId) return

    const newBlueprint: ShipBlueprint = {
      id: crypto.randomUUID(),
      name,
      shipId,
      connections: blueprint.value ? JSON.parse(JSON.stringify(blueprint.value.connections)) : [],
      storage: blueprint.value?.storage ? JSON.parse(JSON.stringify(blueprint.value.storage)) : undefined,
      lastUpdated: Date.now()
    }

    const bucket = getOrCreateBucketByShipId(shipId)
    bucket.blueprints.push(newBlueprint)
    savedBlueprints.value.activeShipId = shipId
    savedBlueprints.value.activeBlueprintId = newBlueprint.id
    blueprint.value = newBlueprint
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  const saveBlueprintWithFallbackName = (name: string) => {
    if (blueprint.value && !blueprint.value.name) {
      blueprint.value.name = name
    }
    saveBlueprint()
  }

  const requiresSaveAsOnSave = () => {
    if (!blueprint.value) return true
    if (!blueprint.value.id) return true
    return !savedBlueprints.value.activeBlueprintId
  }

  const loadBlueprint = (id: string) => {
    const bp = findBlueprintById(id)
    if (!bp) return

    const ship = findShip(bp.shipId)
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
    // Load blueprint
    blueprint.value = JSON.parse(JSON.stringify(bp))
    // Sort connections by fixed order: engine -> thruster -> shield -> weapon -> turret
    if (blueprint.value) {
      const slotOrder = ['engine', 'thruster', 'shield', 'weapon', 'turret']
      blueprint.value.connections.sort((a, b) => {
        const orderA = slotOrder.indexOf(a.slot_type)
        const orderB = slotOrder.indexOf(b.slot_type)
        return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
      })
    }
    savedBlueprints.value.activeShipId = bp.shipId
    savedBlueprints.value.activeBlueprintId = id
    takeSnapshot()
  }

  const deleteBlueprint = (id: string) => {
    let deletedFromShipId: string | null = null
    for (const bucket of savedBlueprints.value.ships) {
      const idx = bucket.blueprints.findIndex((item) => item.id === id)
      if (idx !== -1) {
        bucket.blueprints.splice(idx, 1)
        deletedFromShipId = bucket.shipId
        break
      }
    }
    if (!deletedFromShipId) return

    savedBlueprints.value.ships = savedBlueprints.value.ships.filter((bucket) => bucket.blueprints.length > 0)

    // If deleted was active, fallback to first blueprint
    if (savedBlueprints.value.activeBlueprintId === id) {
      const fallback = getAllSavedBlueprints()[0] || null
      savedBlueprints.value.activeBlueprintId = fallback?.id || null
      savedBlueprints.value.activeShipId = fallback?.shipId || null
      if (blueprint.value?.id === id) blueprint.value = null
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
    if (selectedShipId.value === shipId) {
      if (shipId !== null && !blueprint.value) {
        blueprint.value = createEmptyBlueprintForShip(shipId)
      }
      if (shipId !== null && viewMode.value === 'selector') {
        viewMode.value = 'workspace'
      }
      return
    }
    // Keep current selection data and just switch to selector mode.
    if (shipId === null) {
      viewMode.value = 'selector'
      return
    }

    // If selecting the same ship as current blueprint, restore it directly.
    if (blueprint.value?.shipId === shipId) {
      fitMode.value = 'connection'
      viewMode.value = 'workspace'
      return
    }

    // Switching to a different ship: reset blueprint and start fresh.
    blueprint.value = createEmptyBlueprintForShip(shipId)
    // Initialize snapshot for dirty check
    takeSnapshot()
    selectedByConnection.value = {}
    fitMode.value = 'connection'
    viewMode.value = 'workspace'
  }

  const enterShipSelector = () => {
    viewMode.value = 'selector'
  }

  const cancelShipSelector = () => {
    const currentShipEntity = selectedShip.value
    if (currentShipEntity && selectedClass.value !== currentShipEntity.class) {
      selectedClass.value = currentShipEntity.class
      selectedRaces.value = currentShipEntity.race ? [currentShipEntity.race] : []
      selectedTypes.value = currentShipEntity.type ? [currentShipEntity.type] : []
    }
    viewMode.value = 'workspace'
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
    fitMode.value = mode
  }

  const applyConnectionAssignment = (payload: { connectionKey: string; equipmentId: string | null }) => {
    // Use connectionKeyMap to get slotType and groupName, then update blueprint via setEquipment/setShield
    const info = connectionKeyMap.value.get(payload.connectionKey)
    if (!info) return

    const resolvedCount = selectedByConnectionComputed.value[payload.connectionKey]?.count ?? info.count

    if (info.isShield) {
      // For shield slots, there are two cases:
      // 1. Direct shield slot (ship has dedicated shield slots): 4 parts - shipId::shield::slotIndex::groupIndex
      // 2. Shield attached to other slot (engine/weapon): 5 parts - shipId::parentSlotType::slotIndex::groupIndex::shield
      const parts = payload.connectionKey.split('::')

      // Case 1: Direct shield slot (slotType = 'shield' and parentSlotType = 'shield')
      if (parts.length === 4 && parts[1] === 'shield') {
        // For direct shield slot, use setEquipment with slotType='shield'
        setEquipment(info.slotType, info.groupName, payload.equipmentId, resolvedCount)
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
          setShield(parentSlotType, firstParentRow.groupName, payload.equipmentId, resolvedCount)
        }
      }
    } else {
      setEquipment(info.slotType, info.groupName, payload.equipmentId, resolvedCount)
    }
  }

  const setConnectionAssignmentCount = (payload: { connectionKey: string; count: number }) => {
    const info = connectionKeyMap.value.get(payload.connectionKey)
    if (!info) return

    const nextCount = Math.max(0, Math.round(payload.count))
    const currentEquipmentId = selectedByConnectionComputed.value[payload.connectionKey]?.equipmentId || null

    if (info.isShield) {
      const parts = payload.connectionKey.split('::')

      if (parts.length === 4 && parts[1] === 'shield') {
        setEquipment(info.slotType, info.groupName, currentEquipmentId, nextCount)
        return
      }

      if (parts.length >= 5 && parts[4] === 'shield') {
        const shipId = parts[0]
        const parentSlotType = parts[1]
        const slotIndex = parts[2]
        const groupIndex = parts[3]
        if (!shipId || !parentSlotType || !slotIndex || !groupIndex) return
        const parentRows = connectionRows.value.filter(r =>
          r.slotType === parentSlotType &&
          r.connectionKey === `${shipId}::${parentSlotType}::${slotIndex}::${groupIndex}`
        )
        const firstParentRow = parentRows[0]
        if (firstParentRow) {
          setShield(parentSlotType, firstParentRow.groupName, currentEquipmentId, nextCount)
        }
      }
      return
    }

    setEquipment(info.slotType, info.groupName, currentEquipmentId, nextCount)
  }

  const cloneBlueprintForPreview = (source: ShipBlueprint | null): ShipBlueprint => {
    const shipId = resolveCurrentShipId()
    if (!source) {
      return {
        id: '',
        name: '',
        shipId: shipId || '',
        connections: [],
        lastUpdated: Date.now()
      }
    }
    return JSON.parse(JSON.stringify(source)) as ShipBlueprint
  }

  const findOrCreateConnectionInBlueprint = (target: ShipBlueprint, slotType: string): ShipBlueprintConnection => {
    let connection = target.connections.find(c => c.slot_type === slotType)
    if (!connection) {
      connection = { slot_type: slotType, group: [] }
      target.connections.push(connection)
    }
    return connection
  }

  const resolveGroupNameByConnectionKey = (connectionKey: string): string | null => {
    const parts = connectionKey.split('::')
    const slotIndex = Number(parts[2])
    const groupIndex = Number(parts[3])
    if (!selectedShip.value || Number.isNaN(slotIndex) || Number.isNaN(groupIndex)) return null
    const slot = selectedShip.value.slots[slotIndex]
    const group = slot?.groups[groupIndex]
    return group?.group || null
  }

  const resolveConnectionCapacityByKey = (connectionKey: string): number => {
    const parts = connectionKey.split('::')
    const slotIndex = Number(parts[2])
    const groupIndex = Number(parts[3])
    if (!selectedShip.value || Number.isNaN(slotIndex) || Number.isNaN(groupIndex)) return 0
    const slot = selectedShip.value.slots[slotIndex]
    const group = slot?.groups[groupIndex]
    if (!slot || !group) return 0
    if (parts.length >= 5 && parts[4] === 'shield') {
      return group.connection?.shield?.count || 0
    }
    return group.connection?.count || 0
  }

  const applyAssignmentOnBlueprint = (
    target: ShipBlueprint,
    payload: { connectionKey: string; equipmentId: string | null; count: number }
  ) => {
    const parts = payload.connectionKey.split('::')
    if (parts.length < 4) return
    const slotType = parts[1]
    if (!slotType) return
    const groupName = resolveGroupNameByConnectionKey(payload.connectionKey)
    if (!groupName) return

    const setEquipmentOnTarget = (targetSlotType: string) => {
      const connection = findOrCreateConnectionInBlueprint(target, targetSlotType)
      const groupData = connection.group.find(g => g.group === groupName)
      if (payload.equipmentId === null || payload.count <= 0) {
        if (groupData) {
          groupData.equipment_id = ''
          groupData.count = 0
        }
        return
      }
      if (groupData) {
        groupData.equipment_id = payload.equipmentId
        groupData.count = payload.count
      } else {
        connection.group.push({
          group: groupName,
          equipment_id: payload.equipmentId,
          count: payload.count
        })
      }
    }

    const setShieldOnTarget = (parentSlotType: string) => {
      const connection = findOrCreateConnectionInBlueprint(target, parentSlotType)
      let groupData = connection.group.find(g => g.group === groupName)
      if (!groupData) {
        groupData = {
          group: groupName,
          equipment_id: '',
          count: 0
        }
        connection.group.push(groupData)
      }
      if (payload.equipmentId === null || payload.count <= 0) {
        groupData.shield = { equipment_id: '', count: 0 }
        return
      }
      groupData.shield = { equipment_id: payload.equipmentId, count: payload.count }
    }

    if (parts.length >= 5 && parts[4] === 'shield') {
      setShieldOnTarget(slotType)
      return
    }

    if (parts.length === 4 && slotType === 'shield') {
      setEquipmentOnTarget('shield')
      return
    }

    setEquipmentOnTarget(slotType)
  }

  const cleanupPreviewBlueprint = (target: ShipBlueprint) => {
    target.connections.forEach((connection) => {
      connection.group = connection.group.filter((group) => {
        const hasEquipment = Boolean(group.equipment_id)
        const hasShield = Boolean(group.shield?.equipment_id)
        return hasEquipment || hasShield
      })
    })
    target.connections = target.connections.filter((connection) => connection.group.length > 0)
    const slotOrder = ['engine', 'thruster', 'shield', 'weapon', 'turret']
    target.connections.sort((a, b) => {
      const orderA = slotOrder.indexOf(a.slot_type)
      const orderB = slotOrder.indexOf(b.slot_type)
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
    })
  }

  const updateBlueprintStorage = (storage: ShipBlueprint['storage']) => {
    if (!blueprint.value) return
    blueprint.value.storage = storage
    saveBlueprint()
  }

  const distributeCountByCapacity = (connectionKeys: string[], total: number) => {
    const maxByKey = connectionKeys.map((key) => ({
      key,
      max: Math.max(0, resolveConnectionCapacityByKey(key))
    }))
    const sumMax = maxByKey.reduce((sum, item) => sum + item.max, 0)
    const clampedTotal = Math.max(0, Math.min(total, sumMax))

    if (sumMax === 0 || clampedTotal === 0) {
      return Object.fromEntries(connectionKeys.map((key) => [key, 0]))
    }
    if (clampedTotal === sumMax) {
      return Object.fromEntries(maxByKey.map((item) => [item.key, item.max]))
    }

    const allocations = maxByKey.map((item) => {
      const exact = (clampedTotal * item.max) / sumMax
      const base = Math.min(item.max, Math.floor(exact))
      return { ...item, base, frac: exact - Math.floor(exact) }
    })

    let remaining = clampedTotal - allocations.reduce((sum, item) => sum + item.base, 0)
    allocations
      .sort((a, b) => b.frac - a.frac)
      .forEach((item) => {
        if (remaining <= 0) return
        if (item.base >= item.max) return
        item.base += 1
        remaining -= 1
      })

    return Object.fromEntries(allocations.map((item) => [item.key, item.base]))
  }

  const buildPreviewBlueprint = (payload: {
    connectionKeys: string[]
    equipmentId: string | null
    mode: FitMode
    targetCount?: number
  }): ShipBlueprint | null => {
    const shipId = resolveCurrentShipId()
    if (!selectedShip.value || !shipId) return null
    const keys = payload.connectionKeys.filter((key) => typeof key === 'string' && key.length > 0)
    if (keys.length === 0) return cloneBlueprintForPreview(blueprint.value)

    const target = cloneBlueprintForPreview(blueprint.value)
    target.shipId = shipId

    if (payload.mode === 'group') {
      const fallbackCount = keys.reduce((sum, key) => {
        const current = selectedByConnectionComputed.value[key]?.count ?? 0
        return sum + current
      }, 0)
      const requested = payload.targetCount ?? fallbackCount
      const distributed = distributeCountByCapacity(keys, Math.max(0, Math.round(requested)))
      keys.forEach((connectionKey) => {
        const nextCount = distributed[connectionKey] || 0
        applyAssignmentOnBlueprint(target, {
          connectionKey,
          equipmentId: nextCount > 0 ? payload.equipmentId : null,
          count: nextCount
        })
      })
      cleanupPreviewBlueprint(target)
      return target
    }

    keys.forEach((connectionKey) => {
      const currentCount = selectedByConnectionComputed.value[connectionKey]?.count
      const nextCount = currentCount ?? resolveConnectionCapacityByKey(connectionKey)
      applyAssignmentOnBlueprint(target, {
        connectionKey,
        equipmentId: payload.equipmentId,
        count: Math.max(0, nextCount)
      })
    })

    cleanupPreviewBlueprint(target)
    return target
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
    const shipId = resolveCurrentShipId()
    return findShip(shipId)
  })

  const hasSelectedShip = computed(() => Boolean(resolveCurrentShipId()))

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

  // Clear current fitting but keep selected ship (for New action in ship-build view)
  const clearLoadoutForCurrentShip = () => {
    const currentBlueprint = blueprint.value
    if (!currentBlueprint?.shipId) return
    const shipId = currentBlueprint.shipId
    blueprint.value = createEmptyBlueprintForShip(shipId)
    selectedByConnection.value = {}
    fitMode.value = 'connection'
    viewMode.value = 'workspace'
    savedBlueprints.value.activeShipId = shipId
    savedBlueprints.value.activeBlueprintId = null
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  // Reset all filters and blueprint
  const resetAll = () => {
    blueprint.value = null
    viewMode.value = 'selector'
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
    shipTypes,
    shipRaces,
    slotTags,
    consumables,
    drones,
    missiles,
    shipMap,
    raceMap,
    typeMap,
    equipmentMap,
    consumablesMap,
    dronesMap,
    missilesMap,
    // 状态
    activeView,
    selectedClass,
    selectedRaces,
    selectedTypes,
    selectedShipId,
    viewMode,
    statsViewMode,
    fitMode,
    mockTagPatch,
    selectedShip,
    hasSelectedShip,
    findShip,
    findEquipmentType,
    findEquipment,
    findWare,
    // Blueprint persistence
    blueprint,
    savedBlueprints,
    isDirty,
    isEditable,
    isEmptyForSave,
    setEquipment,
    setShield,
    setGroupEquipment,
    setGroupShield,
    saveBlueprint,
    saveBlueprintWithFallbackName,
    saveAsBlueprint,
    requiresSaveAsOnSave,
    loadBlueprint,
    deleteBlueprint,
    getBlueprintsForShip,
    loadBlueprintsFromStorage,
    updateBlueprintStorage,
    clearLoadoutForCurrentShip,
    resetAll,
    // Legacy methods (keep for backward compatibility)
    setSelectedShipId,
    enterShipSelector,
    cancelShipSelector,
    setSelectedClass,
    toggleRace,
    toggleType,
    setSelectedTypes,
    setFitMode,
    applyConnectionAssignment,
    setConnectionAssignmentCount,
    buildPreviewBlueprint,
    applyGroupAssignment,
    setStatsViewMode,
    setMockTagPatch,
    setDisplayResolvers
  }
})
