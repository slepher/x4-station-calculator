import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useActiveViewStore } from './useActiveViewStore'
import type {
  ConnectionValue,
  EquipmentType,
  SavedShipBlueprintsState,
  ShipBlueprint,
  ShipBlueprintBuildAnalysis,
  ShipBlueprintStorage,
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
import { buildConsumableDatas, buildShipBuildDatas } from './logic/useGameData'
import { analyzeShipBlueprintBuild, DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER } from './logic/analyzeShipBlueprintBuild'

const BUILT_IN_BLUEPRINT_ID_PREFIX = '__built_in_ship_blueprint__'
const EMPTY_SHIP_STORAGE: ShipBlueprintStorage = {
  deployables: [],
  countermeasure: null,
  drones: [],
  missiles: []
}

export type StationActiveView = 'blueprint-production' | 'live-production' | 'flow' | 'ship-build' | 'maps'
export type ShipBuildStatsViewMode = 'summary' | 'detail'
export type ShipBuildViewMode = 'selector' | 'workbench'
export type ShipBuildMockTagPatch = {
  targetShipId: string
  slotType?: EquipmentType
  connections: Record<string, {
    groupName?: string
    size?: ShipEquipmentSize
    tags: string[]
  }>
}

type BuiltInPresetKey = 'empty' | 'low' | 'mid' | 'high'

const BUILT_IN_PRESETS: Array<{ key: BuiltInPresetKey; labelKey: string }> = [
  { key: 'empty', labelKey: 'shipBuild.built_in_empty' },
  { key: 'low', labelKey: 'shipBuild.built_in_low' },
  { key: 'mid', labelKey: 'shipBuild.built_in_mid' },
  { key: 'high', labelKey: 'shipBuild.built_in_high' }
]

export const useShipBuildStore = defineStore('ship-build', () => {
  const gameData = useGameDataStore()
  const activeViewStore = useActiveViewStore()

  const canUseDlcTag = (dlcTag: string | null | undefined) => {
    if (!gameData.enforceDlcActivation) return true
    return gameData.isDlcActive(dlcTag)
  }

  function getStorageKey(): string {
    return gameData.getStorageKey('ship_blueprints')
  }

  // Get data from gameData store
  const ships = computed<X4Ship[]>(() => gameData.gameData?.ships || [])
  const shipRaces = computed<X4ShipRace[]>(() => gameData.gameData?.shipRaces || [])
  const shipTypes = computed<X4ShipType[]>(() => gameData.gameData?.shipTypes || [])
  const equipments = computed<X4Equipment[]>(() => gameData.gameData?.equipments || [])
  const equipmentTypes = computed<X4EquipmentType[]>(() => gameData.gameData?.equipmentTypes || [])
  const slotTags = computed<X4SlotTag[]>(() => gameData.gameData?.slotTags || [])
  const wares = computed<X4Ware[]>(() => gameData.gameData?.wares || [])

  const shipBuildDatas = computed(() => buildShipBuildDatas({
    ships: ships.value,
    races: shipRaces.value,
    types: shipTypes.value,
    equipments: equipments.value,
    equipmentTypes: equipmentTypes.value,
    slotTags: slotTags.value,
    wares: wares.value
  }))

  const shipMap = computed(() => shipBuildDatas.value.shipMap)
  const shipByMacroMap = computed(() => shipBuildDatas.value.shipByMacroMap)
  const raceMap = computed(() => shipBuildDatas.value.raceMap)
  const typeMap = computed(() => shipBuildDatas.value.typeMap)
  const equipmentMap = computed(() => shipBuildDatas.value.equipmentMap)

  const consumableDatas = computed(() => buildConsumableDatas(gameData.gameData!))
  const consumables = computed(() => consumableDatas.value.consumables)
  const drones = computed(() => consumableDatas.value.drones)
  const missiles = computed(() => consumableDatas.value.missiles)
  const consumablesMap = computed(() => consumableDatas.value.consumablesMap)
  const dronesMap = computed(() => consumableDatas.value.dronesMap)
  const missilesMap = computed(() => consumableDatas.value.missilesMap)

  const activeView = computed({
    get: () => activeViewStore.activeView,
    set: (val: StationActiveView) => { activeViewStore.setActiveView(val) }
  })
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
  const forceDirty = ref(false)
  const loadedBuiltInPreset = ref<BuiltInPresetKey | null>(null)
  const loadedBuiltInConnectionsSnapshot = ref<string | null>(null)

  const selectedByConnection = ref<Record<string, string | null>>({})
  const mockTagPatch = ref<ShipBuildMockTagPatch | null>(null)
  const translateEquipmentFn = ref<(equipment: X4Equipment) => string>((equipment) => equipment.name || equipment.id)
  const translateEquipmentTypeFn = ref<(type: X4EquipmentType) => string>((type) => type.name || type.id)
  const equipmentTypeMap = computed(() => {
    const map = new Map<EquipmentType, X4EquipmentType>()
    equipmentTypes.value.forEach((type) => {
      map.set(type.id, type)
    })
    return map
  })
  const waresMap = computed(() => {
    const map = new Map<string, X4Ware>()
    wares.value.forEach((ware) => {
      map.set(ware.id, ware)
    })
    return map
  })

  const getBuildAnalysis = (
    targetBlueprint: ShipBlueprint | null | undefined = blueprint.value,
    priceMultiplier = DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER
  ): ShipBlueprintBuildAnalysis => {
    const effectiveBlueprint = targetBlueprint || null
    return analyzeShipBlueprintBuild({
      blueprint: effectiveBlueprint,
      ship: findShip(effectiveBlueprint?.shipId),
      equipments: equipmentMap.value,
      wares: waresMap.value,
      consumables: consumablesMap.value,
      drones: dronesMap.value,
      missiles: missilesMap.value,
      priceMultiplier
    })
  }

  const currentBuildAnalysis = computed(() => getBuildAnalysis(blueprint.value))

  // Load blueprints from localStorage
  const loadBlueprintsFromStorage = () => {
    try {
      const data = localStorage.getItem(getStorageKey())
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
      localStorage.setItem(getStorageKey(), JSON.stringify(savedBlueprints.value))
    } catch (e) {
      console.error('Failed to save blueprints to storage:', e)
    }
  }

  // Initialize: must be called after gameData is ready
  async function initialize() {
    if (!gameData.isReady) {
      await gameData.initialize()
    }
    loadBlueprintsFromStorage()

    // Restore blueprint from saved active state
    if (savedBlueprints.value.activeBlueprintId) {
      const bp = findBlueprintById(savedBlueprints.value.activeBlueprintId)
      if (bp) {
        const restored = JSON.parse(JSON.stringify(bp)) as ShipBlueprint
        restored.storage = restored.storage
          ? JSON.parse(JSON.stringify(restored.storage))
          : JSON.parse(JSON.stringify(EMPTY_SHIP_STORAGE))
        blueprint.value = restored
        viewMode.value = 'workbench'
        takeSnapshot()
      }
    }
  }

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
    return shipMap.value.get(shipId) || null
  }

  const isShipDlcUsable = (shipOrId: X4Ship | string | null | undefined): boolean => {
    const ship = typeof shipOrId === 'string' ? findShip(shipOrId) : shipOrId
    if (!ship) return false
    return canUseDlcTag(ship.dlc_tag)
  }

  const findEquipmentType = (typeId: EquipmentType | string | null | undefined): X4EquipmentType | null => {
    if (!typeId) return null
    return equipmentTypeMap.value.get(typeId as EquipmentType) || null
  }

  const findEquipment = (equipmentId: string | null | undefined): X4Equipment | null => {
    if (!equipmentId) return null
    return equipmentMap.value.get(equipmentId) || null
  }

  const isEquipmentDlcUsable = (equipmentOrId: X4Equipment | string | null | undefined): boolean => {
    const equipment = typeof equipmentOrId === 'string' ? findEquipment(equipmentOrId) : equipmentOrId
    if (!equipment) return false
    return canUseDlcTag(equipment.dlc_tag)
  }

  const isEquipmentDlcAutoSelectable = (equipmentOrId: X4Equipment | string | null | undefined): boolean => {
    const equipment = typeof equipmentOrId === 'string' ? findEquipment(equipmentOrId) : equipmentOrId
    if (!equipment) return false
    return gameData.isDlcActive(equipment.dlc_tag)
  }

  const findWare = (wareId: string | null | undefined): X4Ware | null => {
    if (!wareId) return null
    return waresMap.value.get(wareId) || null
  }

  const getBlueprintsForShip = (shipId: string | null): ShipBlueprint[] => {
    if (!shipId) return []
    return getBucketByShipId(shipId)?.blueprints || []
  }

  const getBuiltInBlueprintId = (shipId: string, preset: BuiltInPresetKey) => {
    return `${BUILT_IN_BLUEPRINT_ID_PREFIX}:${shipId}:${preset}`
  }

  const getBuiltInPresetName = (preset: BuiltInPresetKey) => {
    const matched = BUILT_IN_PRESETS.find((item) => item.key === preset)
    if (!matched) return ''
    return i18n.global.t(matched.labelKey)
  }

  const parseBuiltInBlueprintId = (id: string): { shipId: string; preset: BuiltInPresetKey } | null => {
    if (!id.startsWith(`${BUILT_IN_BLUEPRINT_ID_PREFIX}:`)) return null
    const parts = id.split(':')
    if (parts.length < 3) return null
    const presetRaw = parts[parts.length - 1] as BuiltInPresetKey
    const shipId = parts.slice(1, parts.length - 1).join(':')
    if (!shipId) return null
    if (!BUILT_IN_PRESETS.some((item) => item.key === presetRaw)) return null
    return { shipId, preset: presetRaw }
  }

  const isBuiltInBlueprintId = (id: string) => Boolean(parseBuiltInBlueprintId(id))

  const resolveCurrentShipId = (): string | null => {
    return blueprint.value?.shipId || null
  }

  const createEmptyBlueprintForShip = (shipId: string): ShipBlueprint => ({
    id: '',
    name: '',
    shipId,
    connections: [],
    storage: JSON.parse(JSON.stringify(EMPTY_SHIP_STORAGE)),
    materialMethod: 'default',
    lastUpdated: Date.now()
  })

  const parseMk = (mk: string | null | undefined) => {
    const parsed = Number.parseInt(mk || '', 10)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const pickByMkPreference = (candidates: X4Equipment[], preset: BuiltInPresetKey): X4Equipment | null => {
    if (candidates.length === 0) return null
    if (preset === 'low') {
      const mk1 = candidates.find((item) => parseMk(item.mk) === 1)
      return mk1 || candidates[0] || null
    }
    if (preset === 'mid') {
      const mk2 = candidates.find((item) => parseMk(item.mk) === 2)
      if (mk2) return mk2
      const mk1 = candidates.find((item) => parseMk(item.mk) === 1)
      return mk1 || candidates[0] || null
    }
    if (preset === 'high') {
      const maxMk = candidates.reduce((max, item) => Math.max(max, parseMk(item.mk)), 0)
      return candidates.find((item) => parseMk(item.mk) === maxMk) || candidates[0] || null
    }
    return candidates[0] || null
  }

  const filterCandidatesByRace = (candidates: X4Equipment[], shipRace: string) => {
    const matched = candidates.filter((item) => item.race === shipRace)
    return matched.length > 0 ? matched : candidates
  }

  const getEngineRole = (equipment: X4Equipment): 'combat' | 'allround' | 'travel' | 'other' => {
    const id = equipment.id.toLowerCase()
    if (id.includes('_combat_')) return 'combat'
    if (id.includes('_allround_')) return 'allround'
    if (id.includes('_travel_')) return 'travel'
    return 'other'
  }

  const sortByEnginePriority = (candidates: X4Equipment[], shipPurposePrimary: string) => {
    const weightsFight: Record<'combat' | 'allround' | 'travel' | 'other', number> = { combat: 0, allround: 1, travel: 2, other: 3 }
    const weightsNonFight: Record<'combat' | 'allround' | 'travel' | 'other', number> = { travel: 0, allround: 1, combat: 2, other: 3 }
    const weights = shipPurposePrimary === 'fight' ? weightsFight : weightsNonFight
    return [...candidates].sort((a, b) => {
      const aw = weights[getEngineRole(a)]
      const bw = weights[getEngineRole(b)]
      if (aw !== bw) return aw - bw
      return a.id.localeCompare(b.id)
    })
  }

  const getCandidateEquipments = (
    slotType: EquipmentType,
    size: ShipEquipmentSize,
    connectionTags: string[]
  ): X4Equipment[] => {
    return equipments.value
      .filter((equipment) => !equipment.noplayerblueprint)
      .filter((equipment) => equipment.type === slotType && equipment.size === size)
      .filter((equipment) => isEquipmentDlcAutoSelectable(equipment))
      .filter((equipment) => {
        if (connectionTags.length === 0) return true
        const equipmentTags = normalizeTagList(equipment.slotTags)
        const connectionSet = new Set(connectionTags)
        return equipmentTags.every((tag) => connectionSet.has(tag))
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  const pickDefaultEquipment = (payload: {
    ship: X4Ship
    slotType: EquipmentType
    size: ShipEquipmentSize
    connectionTags: string[]
    preset: BuiltInPresetKey
  }): X4Equipment | null => {
    const { ship, slotType, size, connectionTags, preset } = payload

    if (slotType === 'turret' && ship.purposePrimary === 'mine') {
      const mineTurrets = equipments.value
        .filter((equipment) => !equipment.noplayerblueprint)
        .filter((equipment) => equipment.type === 'turret' && equipment.size === size)
        .filter((equipment) => isEquipmentDlcAutoSelectable(equipment))
        .filter((equipment) => {
          const tags = normalizeTagList(equipment.slotTags).map((tag) => tag.toLowerCase())
          return tags.includes('mine') || tags.includes('mining')
        })
        .sort((a, b) => a.id.localeCompare(b.id))

      const pickedMineTurret = pickByMkPreference(filterCandidatesByRace(mineTurrets, ship.race), preset)
      if (pickedMineTurret) return pickedMineTurret
    }

    let candidates = getCandidateEquipments(slotType, size, connectionTags)
    if (candidates.length === 0) return null

    if (slotType === 'engine') {
      candidates = sortByEnginePriority(candidates, ship.purposePrimary)
    }

    candidates = filterCandidatesByRace(candidates, ship.race)
    return pickByMkPreference(candidates, preset)
  }

  const pickDroneByPurpose = (
    ship: X4Ship,
    purpose: 'trade' | 'mine' | 'build',
    preset: BuiltInPresetKey
  ) => {
    let candidates = drones.value
      .filter((drone) => !drone.noplayerblueprint)
      .filter((drone) => drone.purposePrimary === purpose)
      .sort((a, b) => a.id.localeCompare(b.id))

    if (purpose === 'mine' && ship.droneTags.length > 0) {
      const matchedByTags = candidates.filter((drone) => {
        const tags = normalizeTagList(drone.droneTags)
        return ship.droneTags.every((tag) => tags.includes(tag))
      })
      if (matchedByTags.length > 0) {
        candidates = matchedByTags
      }
    }

    const matchedRace = candidates.filter((drone) => drone.race === ship.race)
    if (matchedRace.length > 0) {
      candidates = matchedRace
    }

    const picked = pickByMkPreference(candidates as unknown as X4Equipment[], preset) as unknown as typeof drones.value[number] | null
    return picked || null
  }

  const buildDefaultStorage = (ship: X4Ship, preset: BuiltInPresetKey): ShipBlueprintStorage => {
    const storage: ShipBlueprintStorage = {
      deployables: [],
      countermeasure: null,
      drones: [],
      missiles: []
    }
    const unitCapacity = Math.max(0, ship.storage?.unit || 0)
    if (unitCapacity <= 0) return storage

    const isLargeOrAbove = ship.class === 'ship_l' || ship.class === 'ship_xl'
    const isBuilderShip = ship.type === 'builder' || ship.droneTags.includes('build')

    if (isLargeOrAbove && ship.purposePrimary === 'mine') {
      const transportDrone = pickDroneByPurpose(ship, 'trade', preset)
      const mineDrone = pickDroneByPurpose(ship, 'mine', preset)
      const transportCount = transportDrone ? Math.min(1, unitCapacity) : 0
      const mineCount = mineDrone ? Math.max(0, Math.min(9, unitCapacity - transportCount)) : 0

      if (transportDrone && transportCount > 0) {
        storage.drones.push({ id: transportDrone.id, name: transportDrone.name || transportDrone.id, count: transportCount })
      }
      if (mineDrone && mineCount > 0) {
        storage.drones.push({ id: mineDrone.id, name: mineDrone.name || mineDrone.id, count: mineCount })
      }
      return storage
    }

    if (isBuilderShip) {
      const buildDrone = pickDroneByPurpose(ship, 'build', preset)
      if (buildDrone) {
        storage.drones.push({ id: buildDrone.id, name: buildDrone.name || buildDrone.id, count: unitCapacity })
      }
      return storage
    }

    if (ship.purposePrimary === 'trade') {
      const transportDrone = pickDroneByPurpose(ship, 'trade', preset)
      if (transportDrone) {
        storage.drones.push({ id: transportDrone.id, name: transportDrone.name || transportDrone.id, count: unitCapacity })
      }
      return storage
    }

    return storage
  }

  const buildBuiltInBlueprintForShip = (shipId: string, preset: BuiltInPresetKey): ShipBlueprint | null => {
    const ship = findShip(shipId)
    if (!ship) return null

    const presetName = getBuiltInPresetName(preset)
    const result: ShipBlueprint = {
      id: getBuiltInBlueprintId(shipId, preset),
      name: presetName,
      shipId,
      connections: [],
      storage: JSON.parse(JSON.stringify(EMPTY_SHIP_STORAGE)),
      materialMethod: 'default',
      lastUpdated: Date.now()
    }

    if (preset === 'empty') {
      return result
    }

    const upsertGroup = (payload: {
      slotType: EquipmentType
      groupName: string
      equipmentId: string
      count: number
    }) => {
      let connection = result.connections.find((item) => item.slot_type === payload.slotType)
      if (!connection) {
        connection = { slot_type: payload.slotType, group: [] }
        result.connections.push(connection)
      }
      let group = connection.group.find((item) => item.group === payload.groupName)
      if (!group) {
        group = { group: payload.groupName, equipment_id: payload.equipmentId, count: payload.count }
        connection.group.push(group)
        return group
      }
      if (ship.purposePrimary === 'mine' && payload.slotType === 'turret' && group.equipment_id && payload.equipmentId) {
        const hasMiningTag = (equipmentId: string) => {
          const equipment = findEquipment(equipmentId)
          const tags = normalizeTagList(equipment?.slotTags || []).map((tag) => tag.toLowerCase())
          return tags.includes('mine') || tags.includes('mining')
        }
        const currentIsMining = hasMiningTag(group.equipment_id)
        const nextIsMining = hasMiningTag(payload.equipmentId)
        if (currentIsMining && !nextIsMining) {
          return group
        }
      }
      // Preserve existing main equipment when caller only needs to ensure the group exists
      // for attaching secondary shield info.
      if (!payload.equipmentId && payload.count <= 0) {
        return group
      }
      group.equipment_id = payload.equipmentId
      group.count = payload.count
      return group
    }

    ship.slots.forEach((slot) => {
      slot.groups.forEach((group) => {
        const mainConnection = group.connection
        const mainCount = Math.max(0, Number(mainConnection?.count || 0))
        const mainSize = resolveSize(undefined, mainConnection?.size)
        if (mainConnection && mainSize) {
          const picked = pickDefaultEquipment({
            ship,
            slotType: slot.type,
            size: mainSize,
            connectionTags: normalizeTagList(mainConnection.tags),
            preset
          })
          if (picked && mainCount > 0) {
            upsertGroup({
              slotType: slot.type,
              groupName: group.group,
              equipmentId: picked.id,
              count: mainCount
            })
          }
        }

        const shieldConnection = mainConnection?.shield
        const shieldSize = resolveSize(undefined, shieldConnection?.size)
        const shieldCount = Math.max(0, Number(shieldConnection?.count || 0))
        if (shieldConnection && shieldSize) {
          const pickedShield = pickDefaultEquipment({
            ship,
            slotType: 'shield',
            size: shieldSize,
            connectionTags: normalizeTagList(shieldConnection.tags),
            preset
          })
          if (pickedShield && shieldCount > 0) {
            const targetGroup = upsertGroup({
              slotType: slot.type,
              groupName: group.group,
              equipmentId: '',
              count: 0
            })
            targetGroup.shield = {
              equipment_id: pickedShield.id,
              count: shieldCount
            }
          }
        }
      })
    })

    if (ship.purposePrimary === 'mine') {
      const turretConnection = result.connections.find((connection) => connection.slot_type === 'turret')
      const hasMiningTurret = (turretConnection?.group || []).some((item) => {
        const equipment = findEquipment(item.equipment_id)
        const tags = normalizeTagList(equipment?.slotTags || []).map((tag) => tag.toLowerCase())
        return tags.includes('mine') || tags.includes('mining')
      })

      if (!hasMiningTurret) {
        const shipTurretSlot = ship.slots.find((slot) => slot.type === 'turret')
        const preferredGroup = shipTurretSlot?.groups.find((group) => normalizeTagList(group.connection?.tags).includes('mining'))
          || shipTurretSlot?.groups[0]
        const preferredSize = resolveSize(undefined, preferredGroup?.connection?.size)
        const preferredCount = Math.max(0, Number(preferredGroup?.connection?.count || 0))
        if (preferredGroup && preferredSize && preferredCount > 0) {
          const mineTurret = pickDefaultEquipment({
            ship,
            slotType: 'turret',
            size: preferredSize,
            connectionTags: normalizeTagList(preferredGroup.connection?.tags),
            preset
          })
          if (mineTurret) {
            upsertGroup({
              slotType: 'turret',
              groupName: preferredGroup.group,
              equipmentId: mineTurret.id,
              count: preferredCount
            })
          }
        }
      }
    }

    result.connections = result.connections.filter((connection) => {
      connection.group = connection.group.filter((group) => {
        const hasMain = Boolean(group.equipment_id)
        const hasShield = Boolean(group.shield?.equipment_id)
        return hasMain || hasShield
      })
      return connection.group.length > 0
    })

    const slotOrder = ['engine', 'thruster', 'shield', 'weapon', 'turret']
    result.connections.sort((a, b) => {
      const orderA = slotOrder.indexOf(a.slot_type)
      const orderB = slotOrder.indexOf(b.slot_type)
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
    })

    result.storage = buildDefaultStorage(ship, preset)
    return result
  }

  const getBuiltInBlueprintsForShip = (shipId: string | null): ShipBlueprint[] => {
    if (!shipId) return []
    return BUILT_IN_PRESETS
      .map((preset) => buildBuiltInBlueprintForShip(shipId, preset.key))
      .filter((item): item is ShipBlueprint => Boolean(item))
  }

  const getLoadableBlueprintsForShip = (shipId: string | null) => {
    if (!shipId) return []
    return [...getBuiltInBlueprintsForShip(shipId), ...getBlueprintsForShip(shipId)]
  }

  // Take snapshot for dirty check
  const takeSnapshot = () => {
    const shipId = resolveCurrentShipId()
    lastSavedSnapshot.value = JSON.stringify({
      shipId,
      blueprint: blueprint.value
    })
    forceDirty.value = false
    loadedBuiltInPreset.value = null
    loadedBuiltInConnectionsSnapshot.value = null
  }

  // Auto-load blueprints from storage on store creation
  loadBlueprintsFromStorage()

  // If active blueprint exists, auto-load the corresponding blueprint after a tick
  if (savedBlueprints.value.activeBlueprintId) {
    const activeBlueprint = findBlueprintById(savedBlueprints.value.activeBlueprintId)
    if (activeBlueprint) {
      // Use queueMicrotask to defer the update until after current execution context
      queueMicrotask(() => {
        viewMode.value = 'workbench'
        blueprint.value = JSON.parse(JSON.stringify(activeBlueprint)) as ShipBlueprint

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
    if (isEmptyForSave()) return false
    if (forceDirty.value) return true
    if (!lastSavedSnapshot.value) return false
    const shipId = resolveCurrentShipId()
    const current = JSON.stringify({
      shipId,
      blueprint: blueprint.value
    })
    return current !== lastSavedSnapshot.value
  })

  const activeBlueprintStatusLabel = computed(() => {
    void i18n.global.locale.value
    if (!loadedBuiltInPreset.value || !loadedBuiltInConnectionsSnapshot.value || !blueprint.value) {
      if (!blueprint.value) return ''
      if (!blueprint.value.name && isDirty.value) {
        return i18n.global.t('shipBuild.status_custom')
      }
      return blueprint.value.name || ''
    }
    const currentConnections = JSON.stringify(blueprint.value.connections || [])
    if (currentConnections !== loadedBuiltInConnectionsSnapshot.value) {
      return i18n.global.t('shipBuild.status_custom')
    }
    return getBuiltInPresetName(loadedBuiltInPreset.value)
  })

  const isBuiltInPresetUnchanged = computed(() => {
    if (!loadedBuiltInPreset.value || !loadedBuiltInConnectionsSnapshot.value || !blueprint.value) return false
    const currentConnections = JSON.stringify(blueprint.value.connections || [])
    return currentConnections === loadedBuiltInConnectionsSnapshot.value
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
        materialMethod: 'default',
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
      materialMethod: blueprint.value?.materialMethod || 'default',
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
    const builtIn = parseBuiltInBlueprintId(id)
    if (builtIn) {
      const bp = buildBuiltInBlueprintForShip(builtIn.shipId, builtIn.preset)
      if (!bp) return
      const activeId = savedBlueprints.value.activeBlueprintId
      const shouldApplyToCurrentSaved =
        Boolean(activeId) &&
        Boolean(blueprint.value) &&
        blueprint.value!.id === activeId &&
        !isBuiltInBlueprintId(activeId) &&
        blueprint.value!.shipId === builtIn.shipId

      if (shouldApplyToCurrentSaved && blueprint.value) {
        const currentId = blueprint.value.id
        const currentName = blueprint.value.name
        const currentMaterialMethod = blueprint.value.materialMethod
        const currentLastUpdated = blueprint.value.lastUpdated
        blueprint.value = {
          ...JSON.parse(JSON.stringify(bp)),
          id: currentId,
          name: currentName,
          shipId: builtIn.shipId,
          materialMethod: currentMaterialMethod,
          lastUpdated: currentLastUpdated
        }
        loadedBuiltInPreset.value = null
        loadedBuiltInConnectionsSnapshot.value = null
        forceDirty.value = false
        return
      }

      bp.name = ''
      blueprint.value = JSON.parse(JSON.stringify(bp))
      savedBlueprints.value.activeShipId = builtIn.shipId
      savedBlueprints.value.activeBlueprintId = null
      loadedBuiltInPreset.value = builtIn.preset
      loadedBuiltInConnectionsSnapshot.value = JSON.stringify(blueprint.value?.connections || [])
      takeSnapshot()
      loadedBuiltInPreset.value = builtIn.preset
      loadedBuiltInConnectionsSnapshot.value = JSON.stringify(blueprint.value?.connections || [])
      forceDirty.value = true
      return
    }

    const bp = findBlueprintById(id)
    if (!bp) return

    const ship = findShip(bp.shipId)
    if (!ship) {
      console.error('Ship not found for blueprint:', bp.shipId)
      return
    }

    // Load blueprint
    const nextBlueprint = JSON.parse(JSON.stringify(bp)) as ShipBlueprint
    nextBlueprint.storage = nextBlueprint.storage
      ? JSON.parse(JSON.stringify(nextBlueprint.storage))
      : JSON.parse(JSON.stringify(EMPTY_SHIP_STORAGE))
    blueprint.value = nextBlueprint
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
    if (isBuiltInBlueprintId(id)) return

    const deletingCurrentLoaded = blueprint.value?.id === id
    const preservedCurrent = deletingCurrentLoaded && blueprint.value
      ? JSON.parse(JSON.stringify(blueprint.value)) as ShipBlueprint
      : null

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

    if (preservedCurrent) {
      preservedCurrent.id = ''
      preservedCurrent.name = ''
      preservedCurrent.lastUpdated = Date.now()
      blueprint.value = preservedCurrent
      savedBlueprints.value.activeShipId = preservedCurrent.shipId || deletedFromShipId
      savedBlueprints.value.activeBlueprintId = null
      saveBlueprintsToStorage()
      takeSnapshot()
      forceDirty.value = true
      return
    }

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
        viewMode.value = 'workbench'
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
      viewMode.value = 'workbench'
      return
    }

    // Switching to a different ship: reset blueprint and start fresh.
    blueprint.value = createEmptyBlueprintForShip(shipId)
    savedBlueprints.value.activeShipId = shipId
    savedBlueprints.value.activeBlueprintId = null
    // Initialize snapshot for dirty check
    takeSnapshot()
    selectedByConnection.value = {}
    fitMode.value = 'connection'
    viewMode.value = 'workbench'
  }

  const enterShipSelector = () => {
    viewMode.value = 'selector'
  }

  const cancelShipSelector = () => {
    viewMode.value = 'workbench'
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
        materialMethod: 'default',
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

  const setMaterialMethod = (method: string) => {
    if (!blueprint.value) return
    blueprint.value.materialMethod = method
    forceDirty.value = true
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
    return equipments.value
      .filter((equipment) => !equipment.noplayerblueprint)
      .filter((equipment) => equipment.type === slotType && equipment.size === size)
      .filter((equipment) => isEquipmentDlcUsable(equipment))
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

  watch(
    () => ({
      shipId: selectedShipId.value,
      enforceDlcActivation: gameData.enforceDlcActivation,
      activeDlcsKey: gameData.activeDlcs.join('|')
    }),
    ({ shipId, enforceDlcActivation }) => {
      if (!shipId || !enforceDlcActivation) return
      if (isShipDlcUsable(shipId)) return
      viewMode.value = 'selector'
    },
    { immediate: true }
  )

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
        const typeDef = equipmentTypeMap.value.get(slot.type)

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
        const shieldTypeDef = equipmentTypeMap.value.get('shield')
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
    viewMode.value = 'workbench'
    savedBlueprints.value.activeShipId = shipId
    savedBlueprints.value.activeBlueprintId = null
    saveBlueprintsToStorage()
    takeSnapshot()
  }

  // Reset all filters and blueprint
  const resetAll = () => {
    blueprint.value = null
    viewMode.value = 'selector'
    lastSavedSnapshot.value = null
    forceDirty.value = false
    loadedBuiltInPreset.value = null
    loadedBuiltInConnectionsSnapshot.value = null
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
    shipByMacroMap,
    raceMap,
    typeMap,
    equipmentMap,
    consumablesMap,
    dronesMap,
    missilesMap,
    // 状态
    activeView,
    selectedShipId,
    viewMode,
    statsViewMode,
    fitMode,
    mockTagPatch,
    selectedShip,
    hasSelectedShip,
    findShip,
    isShipDlcUsable,
    findEquipmentType,
    findEquipment,
    isEquipmentDlcUsable,
    findWare,
    // Blueprint persistence
    blueprint,
    savedBlueprints,
    isDirty,
    activeBlueprintStatusLabel,
    isBuiltInPresetUnchanged,
    isEditable,
    isEmptyForSave,
    // Initialization
    initialize,
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
    getLoadableBlueprintsForShip,
    isBuiltInBlueprintId,
    findBlueprintById,
    loadBlueprintsFromStorage,
    updateBlueprintStorage,
    clearLoadoutForCurrentShip,
    resetAll,
    // Legacy methods (keep for backward compatibility)
    setSelectedShipId,
    enterShipSelector,
    cancelShipSelector,
    setFitMode,
    applyConnectionAssignment,
    setConnectionAssignmentCount,
    buildPreviewBlueprint,
    applyGroupAssignment,
    setStatsViewMode,
    setMaterialMethod,
    setMockTagPatch,
    setDisplayResolvers,
    getBuildAnalysis,
    currentBuildAnalysis
  }
})
