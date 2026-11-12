import { createShipStatsCalculation } from './logic/shipBlueprintStats'
import { defineStore } from 'pinia'
import { computed, reactive, ref, toRef, watch } from 'vue'
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
import { extractEquipmentSlotCandidatesWithFacets } from './logic/shipEquipmentPicker'

const BUILT_IN_BLUEPRINT_ID_PREFIX = '__built_in_ship_blueprint__'
const EMPTY_SHIP_STORAGE: ShipBlueprintStorage = {
  deployables: [],
  countermeasure: null,
  drones: [],
  missiles: []
}

const presetSnapshot = (blueprint: ShipBlueprint): string => {
  const storage = blueprint.storage === undefined ? EMPTY_SHIP_STORAGE : blueprint.storage
  const items = (values: Array<{ id: string; count: number }>) => values
    .filter(item => item.count > 0)
    .map(({ id, count }) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({
    connections: blueprint.connections,
    storage: {
      deployables: items(storage.deployables),
      countermeasure: storage.countermeasure === null || storage.countermeasure.count === 0
        ? null : { id: storage.countermeasure.id, count: storage.countermeasure.count },
      drones: items(storage.drones),
      missiles: items(storage.missiles)
    }
  })
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

export type ShipBuildSide = 'A' | 'B'
export type ShipBuildPlan = {
  sessionId: string
  blueprint: ShipBlueprint | null
  saveTargetId: string | null
  lastSavedSnapshot: string | null
  forceDirty: boolean
  loadedBuiltInPreset: BuiltInPresetKey | null
  loadedBuiltInSnapshot: string | null
}

const createPlan = (): ShipBuildPlan => ({
  sessionId: crypto.randomUUID(), blueprint: null, saveTargetId: null,
  lastSavedSnapshot: null, forceDirty: false, loadedBuiltInPreset: null,
  loadedBuiltInSnapshot: null
})

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
  const planA = reactive(createPlan())
  const planB = ref<ShipBuildPlan | null>(null)
  const blueprint = toRef(planA, 'blueprint')
  const selectedShipId = computed<string | null>(() => blueprint.value?.shipId || null)
  const savedBlueprints = ref<SavedShipBlueprintsState>({
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: null,
    activeBlueprintId: null,
    ships: []
  })
  const lastSavedSnapshot = toRef(planA, 'lastSavedSnapshot')
  const forceDirty = toRef(planA, 'forceDirty')
  const loadedBuiltInPreset = toRef(planA, 'loadedBuiltInPreset')
  const loadedBuiltInSnapshot = toRef(planA, 'loadedBuiltInSnapshot')

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
    lastUpdated: Date.now(),
    createdAt: Date.now()
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
      lastUpdated: Date.now(),
      createdAt: 0
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
    planA.sessionId = crypto.randomUUID()
    planA.saveTargetId = blueprint.value && findBlueprintById(blueprint.value.id) ? blueprint.value.id : null
    const shipId = resolveCurrentShipId()
    lastSavedSnapshot.value = JSON.stringify({
      shipId,
      blueprint: blueprint.value
    })
    forceDirty.value = false
    loadedBuiltInPreset.value = null
    loadedBuiltInSnapshot.value = null
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
    if (!loadedBuiltInPreset.value || !loadedBuiltInSnapshot.value || !blueprint.value) {
      if (!blueprint.value) return ''
      if (!blueprint.value.name && isDirty.value) {
        return i18n.global.t('shipBuild.status_custom')
      }
      return blueprint.value.name || ''
    }
    const currentSnapshot = presetSnapshot(blueprint.value)
    if (currentSnapshot !== loadedBuiltInSnapshot.value) {
      return i18n.global.t('shipBuild.status_custom')
    }
    return getBuiltInPresetName(loadedBuiltInPreset.value)
  })

  const isBuiltInPresetUnchanged = computed(() => {
    if (!loadedBuiltInPreset.value || !loadedBuiltInSnapshot.value || !blueprint.value) return false
    const currentSnapshot = presetSnapshot(blueprint.value)
    return currentSnapshot === loadedBuiltInSnapshot.value
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
        lastUpdated: Date.now(),
        createdAt: Date.now()
      }
    }
    let connection = blueprint.value!.connections.find(c => c.slot_type === slotType)
    if (!connection) {
      connection = { slot_type: slotType, group: [] }
      blueprint.value!.connections.push(connection)
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
    if (planB.value !== null || !blueprint.value || !planRequiresSaveAs('A')) return savePlan('A')
    const name = blueprint.value.name === '' ? i18n.global.t('menu.default_blueprint_name') : blueprint.value.name
    return savePlan('A', name)
  }

  const saveAsBlueprint = (name: string) => savePlan('A', name)

  const saveBlueprintWithFallbackName = (name: string) => {
    if (planRequiresSaveAs('A')) return savePlan('A', name)
    return savePlan('A')
  }

  const requiresSaveAsOnSave = () => planRequiresSaveAs('A')

  const loadBlueprint = (id: string) => {
    if (planB.value !== null && planB.value.saveTargetId === id) return
    const builtIn = parseBuiltInBlueprintId(id)
    if (builtIn) {
      const bp = buildBuiltInBlueprintForShip(builtIn.shipId, builtIn.preset)
      if (!bp) return
      const activeId = planA.saveTargetId
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
        const currentCreatedAt = blueprint.value.createdAt
        const currentFavorite = blueprint.value.favorite
        blueprint.value = {
          ...JSON.parse(JSON.stringify(bp)),
          id: currentId,
          name: currentName,
          shipId: builtIn.shipId,
          materialMethod: currentMaterialMethod,
          lastUpdated: currentLastUpdated,
          createdAt: currentCreatedAt,
          favorite: currentFavorite
        }
        loadedBuiltInPreset.value = null
        loadedBuiltInSnapshot.value = null
        forceDirty.value = false
        return
      }

      bp.name = ''
      blueprint.value = JSON.parse(JSON.stringify(bp))
      savedBlueprints.value.activeShipId = builtIn.shipId
      savedBlueprints.value.activeBlueprintId = null
      loadedBuiltInPreset.value = builtIn.preset
      loadedBuiltInSnapshot.value = presetSnapshot(bp)
      takeSnapshot()
      loadedBuiltInPreset.value = builtIn.preset
      loadedBuiltInSnapshot.value = presetSnapshot(bp)
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

  const deleteBlueprint = (id: string, side: ShipBuildSide = 'A') => {
    if (isBuiltInBlueprintId(id)) return
    const otherPlan = getPlan(side === 'A' ? 'B' : 'A')
    if (otherPlan !== null && otherPlan.saveTargetId === id && findBlueprintById(id) !== null) return

    if (planB.value !== null) {
      const next: SavedShipBlueprintsState = JSON.parse(JSON.stringify(savedBlueprints.value))
      next.ships.forEach(bucket => { bucket.blueprints = bucket.blueprints.filter(bp => bp.id !== id) })
      next.ships = next.ships.filter(bucket => bucket.blueprints.length > 0)
      if (next.activeBlueprintId === id) next.activeBlueprintId = null
      try { localStorage.setItem(getStorageKey(), JSON.stringify(next)) }
      catch { return }
      savedBlueprints.value = next
      const plan = getPlan(side)
      if (plan !== null && plan.blueprint !== null && plan.saveTargetId === id) {
        plan.blueprint.id = ''
        plan.blueprint.name = ''
        plan.blueprint.lastUpdated = Date.now()
        plan.saveTargetId = null
        plan.loadedBuiltInPreset = null
        plan.loadedBuiltInSnapshot = null
        plan.lastSavedSnapshot = planSnapshot(plan)
        plan.forceDirty = true
      }
      return
    }

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

  const toggleFavoriteBlueprint = (id: string) => {
    const bp = findBlueprintById(id)
    if (!bp) return
    bp.favorite = !bp.favorite
    for (const plan of [planA, planB.value]) {
      if (plan?.blueprint?.id === id) {
        plan.blueprint.favorite = bp.favorite
      }
    }
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
        lastUpdated: Date.now(),
        createdAt: Date.now()
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
    const ship = findShip(parts[0])
    const slotIndex = Number(parts[2])
    const groupIndex = Number(parts[3])
    if (!ship || Number.isNaN(slotIndex) || Number.isNaN(groupIndex)) return null
    const slot = ship.slots[slotIndex]
    const group = slot?.groups[groupIndex]
    return group?.group || null
  }

  const resolveConnectionCapacityByKey = (connectionKey: string): number => {
    const parts = connectionKey.split('::')
    const ship = findShip(parts[0])
    const slotIndex = Number(parts[2])
    const groupIndex = Number(parts[3])
    if (!ship || Number.isNaN(slotIndex) || Number.isNaN(groupIndex)) return 0
    const slot = ship.slots[slotIndex]
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
      if (payload.equipmentId === null) {
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
      if (payload.equipmentId === null) {
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
  }, side: ShipBuildSide = 'A'): ShipBlueprint | null => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint) return null
    const shipId = plan.blueprint.shipId
    if (!findShip(shipId)) return null
    if (payload.connectionKeys.some(key => key.split('::')[0] !== shipId)) return null
    const keys = payload.connectionKeys.filter((key) => typeof key === 'string' && key.length > 0)
    if (keys.length === 0) return cloneBlueprintForPreview(plan.blueprint)

    const target = cloneBlueprintForPreview(plan.blueprint)
    target.shipId = shipId

    if (payload.mode === 'group') {
      const fallbackCount = keys.reduce((sum, key) => {
        const current = getPlanConnectionAssignment(side, key)?.count ?? 0
        return sum + current
      }, 0)
      const requested = payload.targetCount ?? fallbackCount
      const distributed = distributeCountByCapacity(keys, Math.max(0, Math.round(requested)))
      keys.forEach((connectionKey) => {
        const nextCount = distributed[connectionKey] || 0
        applyAssignmentOnBlueprint(target, {
          connectionKey,
          equipmentId: payload.equipmentId,
          count: nextCount
        })
      })
      cleanupPreviewBlueprint(target)
      return target
    }

    keys.forEach((connectionKey) => {
      const currentCount = getPlanConnectionAssignment(side, connectionKey)?.count
      const capacity = resolveConnectionCapacityByKey(connectionKey)
      const nextCount = payload.targetCount === undefined
        ? (currentCount ?? capacity)
        : Math.min(capacity, Math.max(0, Math.round(payload.targetCount)))
      applyAssignmentOnBlueprint(target, {
        connectionKey,
        equipmentId: payload.equipmentId,
        count: Math.max(0, nextCount)
      })
    })

    cleanupPreviewBlueprint(target)
    return target
  }

  const applyTargetAssignment = (payload: {
    connectionKeys: string[]
    equipmentId: string | null
    mode: FitMode
    targetCount?: number
  }, side: ShipBuildSide = 'A') => {
    const plan = getPlan(side)
    const next = buildPreviewBlueprint(payload, side)
    if (plan && next) plan.blueprint = next
    return plan !== null && next !== null
  }

  const getCompatibleEquipmentIds = (connectionKeys: string[], side: ShipBuildSide = 'A'): string[] => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint || connectionKeys.length === 0) return []
    const ship = findShip(plan.blueprint.shipId)
    if (!ship) return []
    const rows = getConnectionRows(ship)
    const candidateSets: Set<string>[] = []
    for (const key of connectionKeys) {
      const row = rows.find(item => item.connectionKey === key)
      if (!row) return []
      const candidates = extractEquipmentSlotCandidatesWithFacets({
        shipMap: shipMap.value, equipmentMap: equipmentMap.value,
        shipId: ship.id, slotType: row.slotType, size: row.size,
        tagsAll: row.tags, filters: { races: [], mks: [], tags: [] },
        includeEquipment: equipment => isEquipmentDlcUsable(equipment)
      })
      candidateSets.push(new Set(candidates.items.map(item => item.id)))
    }
    return [...candidateSets[0]!].filter(id => candidateSets.every(set => set.has(id)))
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

  const getConnectionRows = (ship: X4Ship | null): FitConnectionRow[] => {
    if (!ship) return []

    const rows: FitConnectionRow[] = []
    ship.slots.forEach((slot, slotIndex) => {
      slot.groups.forEach((group, groupIndex) => {
        const baseKey = `${ship.id}::${slot.type}::${slotIndex}::${groupIndex}`
        const patch = mockTagPatch.value
        const patchItem = patch?.targetShipId === ship.id ? patch.connections[baseKey] : null
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
        const shieldPatchItem = patch?.targetShipId === ship.id ? patch.connections[shieldKey] : null
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
  }

  const connectionRows = computed(() => getConnectionRows(selectedShip.value))

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
    planB.value = null
    planA.sessionId = crypto.randomUUID()
    planA.saveTargetId = null
    blueprint.value = null
    viewMode.value = 'selector'
    lastSavedSnapshot.value = null
    forceDirty.value = false
    loadedBuiltInPreset.value = null
    loadedBuiltInSnapshot.value = null
  }

  const getStatsCalculation = (bp: ShipBlueprint | null) => createShipStatsCalculation(
    bp === null ? null : findShip(bp.shipId), { findEquipment, isEquipmentDlcUsable }
  )

  const getPickerCandidates = (query: Omit<Parameters<typeof extractEquipmentSlotCandidatesWithFacets>[0], 'shipMap' | 'equipmentMap' | 'includeEquipment'>) =>
    extractEquipmentSlotCandidatesWithFacets({ ...query, shipMap: shipMap.value,
      equipmentMap: equipmentMap.value, includeEquipment: isEquipmentDlcUsable })

  const getPlanStats = (bp: ShipBlueprint | null) => {
    if (!bp) return []
    const ship = findShip(bp.shipId)
    if (!ship) return []
    const values = getStatsCalculation(bp).buildDetailStatsByUseEquipmentStats(ship, bp)
    const known: Record<string, boolean> = {
      hull: Number.isFinite(ship.hull), radar_range: Number.isFinite(ship.radarRange),
      crew: Number.isFinite(ship.crew?.capacity), storage_unit: Number.isFinite(ship.storage?.unit),
      missile: Number.isFinite(ship.storage?.missile), deployable: Number.isFinite(ship.storage?.deployable),
      countermeasure: Number.isFinite(ship.storage?.countermeasure)
    }
    for (const key of ['storage_container', 'storage_solid', 'storage_liquid', 'storage_condensed']) known[key] = Array.isArray(ship.cargo)
    for (const key of ['dock_m_count', 'dock_s_count']) known[key] = Array.isArray(ship.dockarea)
    for (const key of ['dock_m_capacity', 'dock_s_capacity']) known[key] = Array.isArray(ship.shipstorage)
    for (const key of ['speed', 'boost_speed', 'travel_speed', 'travel_acceleration']) known[key] = Number.isFinite(ship.physics?.drag?.forward)
    for (const key of ['acceleration', 'boost_acceleration', 'strafe_acceleration']) known[key] = Number.isFinite(ship.physics?.mass)
    known.strafe_acceleration = known.strafe_acceleration! && Number.isFinite(ship.physics?.accfactors?.horizontal)
    known.strafe_speed = Number.isFinite(ship.physics?.drag?.horizontal)
    for (const key of ['yaw', 'pitch', 'roll'] as const) known[key] = Number.isFinite(ship.physics?.drag?.[key])
    return values.map(item => ({ ...item, value: known[item.key] === false ? undefined : item.value }))
  }

  const getPlanConnectionAssignment = (side: ShipBuildSide, key: string): ConnectionValue | undefined => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint || key.split('::')[0] !== plan.blueprint.shipId) return undefined
    const parts = key.split('::')
    const ship = findShip(plan.blueprint.shipId)
    const slot = ship?.slots[Number(parts[2])]
    const group = slot?.groups[Number(parts[3])]
    if (!slot || !group) return undefined
    const assignment = plan.blueprint.connections.find(c => c.slot_type === slot.type)?.group.find(g => g.group === group.group)
    if (parts[4] === 'shield') {
      if (assignment?.shield) return { equipmentId: assignment.shield.equipment_id, count: assignment.shield.count }
      return { equipmentId: null, count: resolveConnectionCapacityByKey(key) }
    }
    if (assignment) return { equipmentId: assignment.equipment_id, count: assignment.count }
    return { equipmentId: null, count: resolveConnectionCapacityByKey(key) }
  }

  const updatePlanStorage = (side: ShipBuildSide, storage: ShipBlueprintStorage) => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint) return false
    plan.blueprint.storage = JSON.parse(JSON.stringify(storage))
    return true
  }

  const getPlan = (side: ShipBuildSide): ShipBuildPlan | null => side === 'A' ? planA : planB.value

  const planSnapshot = (plan: ShipBuildPlan) => JSON.stringify({
    shipId: plan.blueprint === null ? null : plan.blueprint.shipId, blueprint: plan.blueprint
  })

  const isPlanDirty = (side: ShipBuildSide) => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint) return false
    return plan.forceDirty || (plan.lastSavedSnapshot !== null && planSnapshot(plan) !== plan.lastSavedSnapshot)
  }

  const planRequiresSaveAs = (side: ShipBuildSide) => {
    const plan = getPlan(side)
    if (!plan || plan.saveTargetId === null) return true
    return findBlueprintById(plan.saveTargetId) === null
  }

  const makePlan = (source: ShipBlueprint, saved: boolean): ShipBuildPlan => {
    const plan = createPlan()
    plan.blueprint = JSON.parse(JSON.stringify(source))
    plan.saveTargetId = saved ? source.id : null
    plan.lastSavedSnapshot = planSnapshot(plan)
    return plan
  }

  const defaultComparisonPlan = (shipId: string, side: ShipBuildSide = 'B'): ShipBuildPlan | null => {
    const other = getPlan(side === 'A' ? 'B' : 'A')
    if (!findShip(shipId) || !isShipDlcUsable(shipId)) return null
    const candidates = getBlueprintsForShip(shipId)
      .filter(bp => bp.shipId === shipId && bp.id !== other?.saveTargetId && !isBuiltInBlueprintId(bp.id))
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })
    if (candidates.length > 0) return makePlan(candidates[0]!, true)
    return makePlan(createEmptyBlueprintForShip(shipId), false)
  }

  const openComparison = () => {
    if (planB.value || !blueprint.value) return false
    const next = defaultComparisonPlan(blueprint.value.shipId)
    if (!next) return false
    planB.value = next
    return true
  }

  const replacePlanShip = (side: ShipBuildSide, shipId: string) => {
    const plan = getPlan(side)
    if (plan === null) return false
    if (plan.blueprint?.shipId === shipId) return true
    const next = defaultComparisonPlan(shipId, side)
    if (!next) return false
    if (side === 'A') Object.assign(planA, next)
    else planB.value = next
    return true
  }
  const replaceComparisonShip = (shipId: string) => replacePlanShip('B', shipId)

  const replaceComparisonBlueprint = (id: string) => {
    if (!planB.value || id === planA.saveTargetId) return false
    const source = findBlueprintById(id)
    if (!source || !findShip(source.shipId) || !isShipDlcUsable(source.shipId)) return false
    planB.value = makePlan(source, true)
    return true
  }

  const loadPlanPreset = (side: ShipBuildSide, id: string) => {
    const plan = getPlan(side)
    const preset = parseBuiltInBlueprintId(id)
    if (!plan || !plan.blueprint || !preset || preset.shipId !== plan.blueprint.shipId) return false
    if (side === 'A') { loadBlueprint(id); return true }
    const source = buildBuiltInBlueprintForShip(preset.shipId, preset.preset)
    if (!source) return false
    if (plan.saveTargetId !== null && findBlueprintById(plan.saveTargetId)) {
      plan.blueprint = { ...plan.blueprint, connections: source.connections, storage: source.storage }
      plan.loadedBuiltInPreset = null
      plan.loadedBuiltInSnapshot = null
    } else {
      source.name = ''
      plan.blueprint = source
      plan.saveTargetId = null
      plan.loadedBuiltInPreset = preset.preset
      plan.loadedBuiltInSnapshot = presetSnapshot(source)
      plan.forceDirty = true
    }
    return true
  }

  const getPlanPresetId = (side: ShipBuildSide): string | null => {
    const plan = getPlan(side)
    if (plan === null || plan.blueprint === null || plan.loadedBuiltInPreset === null) return null
    if (presetSnapshot(plan.blueprint) !== plan.loadedBuiltInSnapshot) return null
    return getBuiltInBlueprintId(plan.blueprint.shipId, plan.loadedBuiltInPreset)
  }

  const getPlanStatusLabel = (side: ShipBuildSide) => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint) return ''
    if (plan.loadedBuiltInPreset !== null) {
      if (presetSnapshot(plan.blueprint) === plan.loadedBuiltInSnapshot) return getBuiltInPresetName(plan.loadedBuiltInPreset)
      return i18n.global.t('shipBuild.status_custom')
    }
    if (plan.blueprint.name === '' && isPlanDirty(side)) return i18n.global.t('shipBuild.status_custom')
    return plan.blueprint.name
  }

  const closeComparison = (keep: ShipBuildSide) => {
    if (!planB.value) return false
    if (keep === 'B') Object.assign(planA, planB.value)
    planB.value = null
    savedBlueprints.value.activeShipId = planA.blueprint === null ? null : planA.blueprint.shipId
    savedBlueprints.value.activeBlueprintId = planRequiresSaveAs('A') ? null : planA.saveTargetId
    saveBlueprintsToStorage()
    return true
  }

  const savePlan = (side: ShipBuildSide, name?: string, sessionId?: string): 'saved' | 'needs-name' | 'failed' | 'invalid' => {
    const plan = getPlan(side)
    if (!plan || !plan.blueprint || (sessionId !== undefined && sessionId !== plan.sessionId)) return 'invalid'
    if (name === undefined && planRequiresSaveAs(side)) return 'needs-name'
    if (name !== undefined && !name.trim()) return 'invalid'
    const record: ShipBlueprint = JSON.parse(JSON.stringify(plan.blueprint))
    const state: SavedShipBlueprintsState = JSON.parse(JSON.stringify(savedBlueprints.value))
    let bucket = state.ships.find(item => item.shipId === record.shipId)
    if (!bucket) { bucket = { shipId: record.shipId, blueprints: [] }; state.ships.push(bucket) }
    if (name !== undefined) {
      record.id = crypto.randomUUID()
      record.name = name.trim()
      record.createdAt = Date.now()
      bucket.blueprints.push(record)
    } else {
      const index = bucket.blueprints.findIndex(item => item.id === plan.saveTargetId)
      if (index < 0) return 'needs-name'
      record.id = plan.saveTargetId!
      record.createdAt = bucket.blueprints[index]!.createdAt
      bucket.blueprints[index] = record
    }
    record.lastUpdated = Date.now()
    state.activeShipId = record.shipId
    state.activeBlueprintId = record.id
    try { localStorage.setItem(getStorageKey(), JSON.stringify(state)) }
    catch { return 'failed' }
    savedBlueprints.value = state
    plan.blueprint = JSON.parse(JSON.stringify(record))
    plan.saveTargetId = record.id
    plan.forceDirty = false
    plan.loadedBuiltInPreset = null
    plan.loadedBuiltInSnapshot = null
    plan.lastSavedSnapshot = planSnapshot(plan)
    return 'saved'
  }

  return {
    getStatsCalculation, getPlanStats, getPickerCandidates,
    getConnectionRows, getPlanConnectionAssignment, updatePlanStorage,
    getPlan, isPlanDirty, planRequiresSaveAs, openComparison, replacePlanShip, replaceComparisonShip,
    replaceComparisonBlueprint, closeComparison, savePlan, loadPlanPreset, getPlanStatusLabel, getPlanPresetId,
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
    waresMap,
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
    toggleFavoriteBlueprint,
    saveBlueprintsToStorage,
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
    applyTargetAssignment,
    getCompatibleEquipmentIds,
    getConnectionAssignment: (key: string) => selectedByConnectionComputed.value[key],
    applyGroupAssignment,
    setStatsViewMode,
    setMaterialMethod,
    setMockTagPatch,
    setDisplayResolvers,
    getBuildAnalysis,
    currentBuildAnalysis
  }
})
