import type {
  SavedEmpiresState,
  SavedFlowPlansState,
  SavedShipBlueprintsState,
  V1StorageState,
  X4Module,
  EmpirePlan,
  StationPlan,
  LogicFlowPlan,
  SavedFlowGroup,
  SavedFlowNode,
  ShipBlueprint,
  ShipBlueprintBucket,
  X4Ship,
  X4Equipment
} from '@/types/x4'
import { migrateEmpireStateToCurrent, migrateFlowStateToCurrent, migrateShipBlueprintStateToCurrent } from './stateMigrations'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION, CURRENT_SHIP_BLUEPRINT_VERSION } from './storageVersions'
import { normalizeSectorLinkKey, parseSectorLinkKey } from './sectorLinks'

export type ImportMode = 'overwrite' | 'incremental'
export type ImportModuleKey = 'x4_empire_data' | 'x4_logic_flow_plans' | 'x4_ship_blueprints'

const EMPIRE_KEY: ImportModuleKey = 'x4_empire_data'
const FLOW_KEY: ImportModuleKey = 'x4_logic_flow_plans'
const SHIP_KEY: ImportModuleKey = 'x4_ship_blueprints'

const STORAGE_KEY_MAP: Record<ImportModuleKey, string> = {
  [EMPIRE_KEY]: 'x4_empire_data',
  [FLOW_KEY]: 'x4_logic_flow_plans',
  [SHIP_KEY]: 'x4_ship_blueprints'
}

const DEFAULT_IMPORT_GAME_VSN = '8.0'
const DEFAULT_IMPORT_BETA = false

type MaybeWrapped<T> = T | { value: T }

export interface NormalizedImportPayload {
  modules: Partial<Record<ImportModuleKey, unknown>>
  fileMeta: ImportFileMeta
}

export interface ModuleImportStats {
  key: ImportModuleKey
  count: number
}

export interface ImportFileMeta {
  game_vsn: string
  beta: boolean
  inferred: boolean
}

export interface ImportVersionState {
  file: ImportFileMeta
  current: {
    game_vsn: string
    beta: boolean
  }
  mismatch: boolean
}

export interface ImportSanitizeSummary {
  key: ImportModuleKey
  removed: number
  details: Array<{
    kind: string
    count: number
  }>
}

export interface PreparedImportPayload {
  payload: NormalizedImportPayload
  moduleStats: ModuleImportStats[]
  versionState: ImportVersionState
  preparedModules: Partial<Record<ImportModuleKey, unknown>>
  sanitizeSummaries: ImportSanitizeSummary[]
  warnings: string[]
}

export interface ImportApplyOptions {
  mode: ImportMode
  selectedModules: Partial<Record<ImportModuleKey, boolean>>
  currentView: 'production' | 'flow' | 'ship-build' | 'maps'
  payload: NormalizedImportPayload
  preparedPayload?: PreparedImportPayload
  gameDataStore: GameDataStoreLike
  empireStore: EmpireStoreLike
  logicFlowStore: LogicFlowStoreLike
  shipBuildStore: ShipBuildStoreLike
}

export interface ImportApplyResult {
  applied: ImportModuleKey[]
  skipped: ImportModuleKey[]
  warnings: string[]
  sanitizeSummaries: ImportSanitizeSummary[]
}

interface EmpireStoreLike {
  savedEmpires: SavedEmpiresState
  activeEmpireId: string | null
  isDirty: boolean
  loadEmpire?: (empireId: string) => void
  loadData: (data: SavedEmpiresState) => void
  initializeAllStationCaches: () => void
  saveToStorage: () => void
}

interface LogicFlowStoreLike {
  savedPlans: SavedFlowPlansState
  isDirty: boolean
  loadPlan?: (index: number) => void
  init: () => void
}

interface ShipBuildStoreLike {
  savedBlueprints: SavedShipBlueprintsState
  isDirty: boolean
  activeView: 'production' | 'flow' | 'ship-build' | 'maps'
  shipMap?: MaybeWrapped<Map<string, unknown>>
  equipmentMap?: MaybeWrapped<Map<string, unknown>>
  consumablesMap?: MaybeWrapped<Map<string, unknown>>
  dronesMap?: MaybeWrapped<Map<string, unknown>>
  missilesMap?: MaybeWrapped<Map<string, unknown>>
  findShip?: (id: string | null | undefined) => X4Ship | null
  findEquipment?: (id: string | null | undefined) => X4Equipment | null
  loadBlueprintsFromStorage: () => void
  loadBlueprint: (id: string) => void
}

interface GameDataStoreLike {
  modulesMap: Record<string, X4Module>
  modulesByMacroId?: Record<string, X4Module>
  currentVersion?: string
  isBeta?: boolean
  getStorageKey?: (module: 'empire' | 'logic_flow' | 'ship_blueprints') => string
}

interface ShipSlotRequirement {
  slotType: string
  size: string
  tags: string[]
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrapWrappedValue<T>(value: MaybeWrapped<T> | undefined, fallback: T): T {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value as T
  }
  return (value as T | undefined) ?? fallback
}

function toLookupSet(value: MaybeWrapped<Map<string, unknown>> | undefined): Set<string> {
  return new Set(Array.from(unwrapWrappedValue(value, new Map<string, unknown>()).keys()))
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .map((item) => item.trim())
}

function buildShipSlotRequirementMap(ship: X4Ship | null): Map<string, ShipSlotRequirement> {
  const requirementMap = new Map<string, ShipSlotRequirement>()
  if (!ship) return requirementMap

  ship.slots.forEach((slot) => {
    slot.groups.forEach((group) => {
      requirementMap.set(group.group, {
        slotType: slot.type,
        size: group.connection.size,
        tags: normalizeStringArray(group.connection.tags)
      })
    })
  })

  return requirementMap
}

function isEquipmentCompatibleWithRequirement(
  equipment: X4Equipment | null,
  requirement: ShipSlotRequirement | undefined,
  slotType: string
): boolean {
  if (!equipment) return false
  if (!requirement) return true
  if (equipment.type !== slotType) return false
  if (equipment.size !== requirement.size) return false
  const connectionTags = new Set(requirement.tags)
  return normalizeStringArray(equipment.slotTags).every((tag) => connectionTags.has(tag))
}

function buildImportFileMeta(raw: unknown): ImportFileMeta {
  const record = isObject(raw) ? raw : {}
  const game_vsn = typeof record.game_vsn === 'string' && record.game_vsn.trim()
    ? record.game_vsn.trim()
    : DEFAULT_IMPORT_GAME_VSN
  const beta = typeof record.beta === 'boolean' ? record.beta : DEFAULT_IMPORT_BETA
  const inferred = typeof record.game_vsn !== 'string' || typeof record.beta !== 'boolean'
  return { game_vsn, beta, inferred }
}

function buildImportVersionState(payload: NormalizedImportPayload, gameDataStore: GameDataStoreLike): ImportVersionState {
  const currentVersion = typeof gameDataStore.currentVersion === 'string' && gameDataStore.currentVersion
    ? gameDataStore.currentVersion
    : DEFAULT_IMPORT_GAME_VSN
  const currentBeta = typeof gameDataStore.isBeta === 'boolean' ? gameDataStore.isBeta : DEFAULT_IMPORT_BETA
  return {
    file: payload.fileMeta,
    current: {
      game_vsn: currentVersion,
      beta: currentBeta
    },
    mismatch: payload.fileMeta.game_vsn !== currentVersion || payload.fileMeta.beta !== currentBeta
  }
}

function getStorageKey(moduleKey: ImportModuleKey, gameDataStore?: GameDataStoreLike): string {
  if (!gameDataStore?.getStorageKey) return STORAGE_KEY_MAP[moduleKey]
  if (moduleKey === EMPIRE_KEY) return gameDataStore.getStorageKey('empire')
  if (moduleKey === FLOW_KEY) return gameDataStore.getStorageKey('logic_flow')
  return gameDataStore.getStorageKey('ship_blueprints')
}

function buildSanitizeSummary(key: ImportModuleKey, detailMap: Record<string, number>): ImportSanitizeSummary | null {
  const details = Object.entries(detailMap)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => ({ kind, count }))
  const removed = details.reduce((sum, item) => sum + item.count, 0)
  return removed > 0 ? { key, removed, details } : null
}

function isEmpireState(value: unknown): value is SavedEmpiresState {
  return isObject(value) && Array.isArray(value.list)
}

function isFlowState(value: unknown): value is SavedFlowPlansState {
  return isObject(value) && Array.isArray(value.list)
}

function isShipState(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false
  return Array.isArray(value.list) || Array.isArray(value.ships)
}

type CoercedEmpireState = SavedEmpiresState | V1StorageState

function coerceEmpireState(value: unknown): CoercedEmpireState | null {
  if (!isEmpireState(value)) return null

  const raw = value as unknown as Record<string, unknown>
  const version = typeof raw.version === 'number' ? raw.version : 1
  const list = deepClone((raw.list as unknown[]) || [])

  if (version <= 1) {
    return {
      version: 1,
      activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
      list: list as V1StorageState['list']
    }
  }

  return {
    version,
    activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
    activeStationId: typeof raw.activeStationId === 'string' ? raw.activeStationId : null,
    list: list as SavedEmpiresState['list']
  }
}

function coerceFlowState(value: unknown): SavedFlowPlansState | null {
  if (!isFlowState(value)) return null
  const raw = value as unknown as Record<string, unknown>
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
    list: deepClone((raw.list as unknown[]) || []) as SavedFlowPlansState['list']
  }
}

function coerceShipState(value: unknown): Record<string, unknown> | null {
  if (!isShipState(value)) return null
  return deepClone(value as Record<string, unknown>)
}

function migrateEmpireState(input: CoercedEmpireState, gameDataStore: GameDataStoreLike): { state: SavedEmpiresState; warnings: string[] } {
  return migrateEmpireStateToCurrent(input, {
    modulesMap: gameDataStore.modulesMap,
    modulesByMacroId: gameDataStore.modulesByMacroId
  })
}

function migrateFlowState(input: SavedFlowPlansState, gameDataStore: GameDataStoreLike): { state: SavedFlowPlansState; warnings: string[] } {
  return migrateFlowStateToCurrent(input, {
    modulesMap: gameDataStore.modulesMap,
    modulesByMacroId: gameDataStore.modulesByMacroId
  })
}

function remapEmpireIds(input: SavedEmpiresState): { state: SavedEmpiresState; activeChangedTo: string | null } {
  const empireIdMap = new Map<string, string>()
  const stationIdMap = new Map<string, string>()
  const sectorIdMap = new Map<string, string>()

  const list: EmpirePlan[] = input.list.map((empire) => {
    const newEmpireId = crypto.randomUUID()
    empireIdMap.set(empire.id, newEmpireId)
    const oldSectors = empire.sectors || []
    oldSectors.forEach((sector) => {
      sectorIdMap.set(sector.id, crypto.randomUUID())
    })

    const sectors = oldSectors.map((sector, index) => ({
      ...deepClone(sector),
      id: sectorIdMap.get(sector.id)!,
      order: Number.isFinite(Number(sector.order)) ? Number(sector.order) : index
    }))
    const sectorLinks = Array.from(new Set((empire.sectorLinks || []).map((key) => {
      const parsed = parseSectorLinkKey(key)
      if (!parsed) return null
      const mappedA = sectorIdMap.get(parsed.a)
      const mappedB = sectorIdMap.get(parsed.b)
      if (!mappedA || !mappedB) return null
      return normalizeSectorLinkKey(mappedA, mappedB)
    }).filter((key): key is string => !!key)))

    const stations: StationPlan[] = (empire.stations || []).map((station) => {
      const newStationId = crypto.randomUUID()
      stationIdMap.set(station.id, newStationId)
      return {
        ...deepClone(station),
        id: newStationId,
        sectorId: station.sectorId ? (sectorIdMap.get(station.sectorId) || null) : null,
        lastUpdated: Date.now()
      }
    })

    return {
      ...deepClone(empire),
      id: newEmpireId,
      sectors,
      sectorLinks,
      stations
    }
  })

  const mappedActiveEmpireId = input.activeId ? empireIdMap.get(input.activeId) || null : null
  const mappedActiveStationId = input.activeStationId ? stationIdMap.get(input.activeStationId) || null : null

  return {
    state: {
      version: CURRENT_EMPIRE_VERSION,
      activeId: mappedActiveEmpireId,
      activeStationId: mappedActiveStationId,
      list
    },
    activeChangedTo: mappedActiveEmpireId
  }
}

function remapFlowIds(input: SavedFlowPlansState): { state: SavedFlowPlansState; activeChangedTo: string | null } {
  const planIdMap = new Map<string, string>()
  const list: LogicFlowPlan[] = input.list.map((plan) => {
    const newPlanId = crypto.randomUUID()
    planIdMap.set(plan.id, newPlanId)

    const groups: SavedFlowGroup[] = (plan.groups || []).map((group) => {
      const newGroupId = crypto.randomUUID()
      const nodes: SavedFlowNode[] = (group.nodes || []).map((node) => deepClone(node))

      return {
        ...deepClone(group),
        id: newGroupId,
        nodes
      }
    })

    return {
      ...deepClone(plan),
      id: newPlanId,
      groups,
      lastUpdated: Date.now()
    }
  })

  const mappedActive = input.activeId ? planIdMap.get(input.activeId) || null : null

  return {
    state: {
      version: CURRENT_FLOW_VERSION,
      activeId: mappedActive,
      list
    },
    activeChangedTo: mappedActive
  }
}

function remapShipIds(input: SavedShipBlueprintsState): { state: SavedShipBlueprintsState; activeChangedTo: string | null } {
  const idMap = new Map<string, string>()

  const ships: ShipBlueprintBucket[] = input.ships.map((bucket) => ({
    shipId: bucket.shipId,
    blueprints: bucket.blueprints.map((blueprint) => {
      const newId = crypto.randomUUID()
      idMap.set(blueprint.id, newId)
      return {
        ...deepClone(blueprint),
        id: newId,
        lastUpdated: Date.now()
      }
    })
  }))

  const mappedActive = input.activeBlueprintId ? idMap.get(input.activeBlueprintId) || null : null

  return {
    state: {
      version: CURRENT_SHIP_BLUEPRINT_VERSION,
      activeShipId: mappedActive
        ? (ships.find((bucket) => bucket.blueprints.some((item) => item.id === mappedActive))?.shipId || null)
        : null,
      activeBlueprintId: mappedActive,
      ships
    },
    activeChangedTo: mappedActive
  }
}

function shouldUpdateActiveIncremental(currentActiveId: string | null, activeItemEmpty: boolean, isDirty: boolean): boolean {
  if (!currentActiveId) return true
  return activeItemEmpty && !isDirty
}

function isEmpireActiveEmpty(state: SavedEmpiresState): boolean {
  if (!state.activeId) return true
  const empire = state.list.find((item) => item.id === state.activeId)
  if (!empire) return true
  return (empire.stations || []).every((station) => (station.modules || []).length === 0)
}

function isFlowActiveEmpty(state: SavedFlowPlansState): boolean {
  if (!state.activeId) return true
  const plan = state.list.find((item) => item.id === state.activeId)
  if (!plan) return true
  return (plan.groups || []).length === 0
}

function isShipActiveEmpty(state: SavedShipBlueprintsState): boolean {
  if (!state.activeBlueprintId) return true
  const active = state.ships
    .flatMap((bucket) => bucket.blueprints)
    .find((item) => item.id === state.activeBlueprintId)
  if (!active) return true
  return (active.connections || []).length === 0
}

function mergeEmpireState(current: SavedEmpiresState, incoming: SavedEmpiresState): SavedEmpiresState {
  return {
    version: CURRENT_EMPIRE_VERSION,
    activeId: current.activeId,
    activeStationId: current.activeStationId,
    list: [...deepClone(current.list), ...deepClone(incoming.list)]
  }
}

function mergeFlowState(current: SavedFlowPlansState, incoming: SavedFlowPlansState): SavedFlowPlansState {
  return {
    version: CURRENT_FLOW_VERSION,
    activeId: current.activeId,
    list: [...deepClone(current.list), ...deepClone(incoming.list)]
  }
}

function mergeShipState(current: SavedShipBlueprintsState, incoming: SavedShipBlueprintsState): SavedShipBlueprintsState {
  const mergedMap = new Map<string, ShipBlueprint[]>()
  current.ships.forEach((bucket) => {
    mergedMap.set(bucket.shipId, [...deepClone(bucket.blueprints)])
  })
  incoming.ships.forEach((bucket) => {
    const existing = mergedMap.get(bucket.shipId) || []
    mergedMap.set(bucket.shipId, [...existing, ...deepClone(bucket.blueprints)])
  })

  return {
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: current.activeShipId,
    activeBlueprintId: current.activeBlueprintId,
    ships: Array.from(mergedMap.entries()).map(([shipId, blueprints]) => ({ shipId, blueprints }))
  }
}

function persistModule(moduleKey: ImportModuleKey, value: unknown, gameDataStore?: GameDataStoreLike) {
  localStorage.setItem(getStorageKey(moduleKey, gameDataStore), JSON.stringify(value))
}

function getImportModulesFromRaw(raw: unknown): Partial<Record<ImportModuleKey, unknown>> {
  if (!isObject(raw)) return {}

  if (isObject(raw.data)) {
    return {
      [EMPIRE_KEY]: raw.data[EMPIRE_KEY],
      [FLOW_KEY]: raw.data[FLOW_KEY],
      [SHIP_KEY]: raw.data[SHIP_KEY]
    }
  }

  return {
    [EMPIRE_KEY]: raw[EMPIRE_KEY],
    [FLOW_KEY]: raw[FLOW_KEY],
    [SHIP_KEY]: raw[SHIP_KEY]
  }
}

export function normalizeImportPayload(raw: unknown): NormalizedImportPayload {
  return {
    modules: getImportModulesFromRaw(raw),
    fileMeta: buildImportFileMeta(raw)
  }
}

export function getModuleImportStats(payload: NormalizedImportPayload): ModuleImportStats[] {
  const stats: ModuleImportStats[] = []

  const empire = coerceEmpireState(payload.modules[EMPIRE_KEY])
  const flow = coerceFlowState(payload.modules[FLOW_KEY])
  const ship = coerceShipState(payload.modules[SHIP_KEY])

  if (empire) stats.push({ key: EMPIRE_KEY, count: empire.list.length })
  if (flow) stats.push({ key: FLOW_KEY, count: flow.list.length })
  if (ship) {
    const migrated = migrateShipBlueprintStateToCurrent(ship)
    const count = migrated.state.ships.reduce((sum, bucket) => sum + bucket.blueprints.length, 0)
    stats.push({ key: SHIP_KEY, count })
  }

  return stats
}

function sanitizeEmpireState(input: SavedEmpiresState, gameDataStore: GameDataStoreLike) {
  let invalidModulesRemoved = 0
  const state: SavedEmpiresState = {
    ...deepClone(input),
    list: input.list.map((empire) => ({
      ...deepClone(empire),
      stations: (empire.stations || []).map((station) => ({
        ...deepClone(station),
        modules: (station.modules || []).filter((module) => {
          const isValid = Boolean(gameDataStore.modulesMap[module.id])
          if (!isValid) invalidModulesRemoved += 1
          return isValid
        })
      }))
    }))
  }

  return {
    state,
    summary: buildSanitizeSummary(EMPIRE_KEY, { invalidModulesRemoved })
  }
}

function sanitizeFlowState(input: SavedFlowPlansState, gameDataStore: GameDataStoreLike) {
  let invalidFlowModulesRemoved = 0
  const state: SavedFlowPlansState = {
    ...deepClone(input),
    list: input.list.map((plan) => ({
      ...deepClone(plan),
      groups: (plan.groups || []).map((group) => ({
        ...deepClone(group),
        nodes: (group.nodes || []).filter((node) => {
          if (!node.module) return true
          const isValid = Boolean(gameDataStore.modulesMap[node.module])
          if (!isValid) invalidFlowModulesRemoved += 1
          return isValid
        })
      }))
    }))
  }

  return {
    state,
    summary: buildSanitizeSummary(FLOW_KEY, { invalidFlowModulesRemoved })
  }
}

function sanitizeShipState(input: SavedShipBlueprintsState, shipBuildStore: ShipBuildStoreLike) {
  const shipIds = toLookupSet(shipBuildStore.shipMap)
  const equipmentIds = toLookupSet(shipBuildStore.equipmentMap)
  const consumableIds = toLookupSet(shipBuildStore.consumablesMap)
  const droneIds = toLookupSet(shipBuildStore.dronesMap)
  const missileIds = toLookupSet(shipBuildStore.missilesMap)

  let invalidShipsRemoved = 0
  let invalidEquipmentsCleared = 0
  let invalidShieldsCleared = 0
  let invalidStorageItemsRemoved = 0

  const ships: ShipBlueprintBucket[] = []
  input.ships.forEach((bucket) => {
    if (!shipIds.has(bucket.shipId)) {
      invalidShipsRemoved += bucket.blueprints.length
      return
    }

    const blueprints: ShipBlueprint[] = []
    bucket.blueprints.forEach((blueprint) => {
      if (!shipIds.has(blueprint.shipId)) {
        invalidShipsRemoved += 1
        return
      }

      const ship = shipBuildStore.findShip?.(blueprint.shipId) || null
      const slotRequirementMap = buildShipSlotRequirementMap(ship)

      const connections = (blueprint.connections || []).map((connection) => {
        const groups = (connection.group || []).reduce<ShipBlueprint['connections'][number]['group']>((acc, group) => {
          const nextGroup = deepClone(group) as unknown as Record<string, unknown>
          const groupRequirement = slotRequirementMap.get(group.group)
          const currentEquipment = typeof group.equipment_id === 'string' && group.equipment_id
            ? shipBuildStore.findEquipment?.(group.equipment_id) || null
            : null
          const passesEquipmentCompatibility = !groupRequirement || !shipBuildStore.findEquipment
            || isEquipmentCompatibleWithRequirement(currentEquipment, groupRequirement, connection.slot_type)

          const isEquipmentValid = !group.equipment_id
            || (
              equipmentIds.has(group.equipment_id)
              && passesEquipmentCompatibility
            )

          if (!isEquipmentValid && group.equipment_id) {
            nextGroup.equipment_id = ''
            nextGroup.count = 0
            invalidEquipmentsCleared += 1
          }

          const nextShield = isObject(nextGroup.shield) ? nextGroup.shield as Record<string, unknown> : null
          const shieldEquipmentId = nextShield && typeof nextShield.equipment_id === 'string' ? nextShield.equipment_id : ''
          const currentShield = shieldEquipmentId
            ? shipBuildStore.findEquipment?.(shieldEquipmentId) || null
            : null
          const passesShieldCompatibility = !shipBuildStore.findEquipment
            || isEquipmentCompatibleWithRequirement(currentShield, undefined, 'shield')
          const isShieldValid = !shieldEquipmentId
            || (
              equipmentIds.has(shieldEquipmentId)
              && passesShieldCompatibility
            )

          if (!isShieldValid && nextShield) {
            nextGroup.shield = {
              ...nextShield,
              equipment_id: '',
              count: 0
            }
            invalidShieldsCleared += 1
          }

          const mainEquipmentId = typeof nextGroup.equipment_id === 'string' ? nextGroup.equipment_id : ''
          const nextShieldId = isObject(nextGroup.shield) && typeof nextGroup.shield.equipment_id === 'string'
            ? nextGroup.shield.equipment_id
            : ''
          if (mainEquipmentId || nextShieldId) {
            acc.push(nextGroup as unknown as ShipBlueprint['connections'][number]['group'][number])
          }
          return acc
        }, [])

        return {
          ...deepClone(connection),
          group: groups
        }
      })

      const storage = blueprint.storage
        ? {
            ...deepClone(blueprint.storage),
            deployables: (blueprint.storage.deployables || []).filter((item) => {
              const isValid = consumableIds.has(item.id)
              if (!isValid) invalidStorageItemsRemoved += 1
              return isValid
            }),
            countermeasure: (() => {
              if (!blueprint.storage?.countermeasure) return null
              const isValid = consumableIds.has(blueprint.storage.countermeasure.id)
              if (!isValid) {
                invalidStorageItemsRemoved += 1
                return null
              }
              return deepClone(blueprint.storage.countermeasure)
            })(),
            drones: (blueprint.storage.drones || []).filter((item) => {
              const isValid = droneIds.has(item.id)
              if (!isValid) invalidStorageItemsRemoved += 1
              return isValid
            }),
            missiles: (blueprint.storage.missiles || []).filter((item) => {
              const isValid = missileIds.has(item.id)
              if (!isValid) invalidStorageItemsRemoved += 1
              return isValid
            })
          }
        : undefined

      blueprints.push({
        ...deepClone(blueprint),
        connections,
        storage
      })
    })

    if (blueprints.length > 0) {
      ships.push({
        shipId: bucket.shipId,
        blueprints
      })
    }
  })

  const flattened = ships.flatMap((bucket) => bucket.blueprints)
  const activeBlueprint = input.activeBlueprintId
    ? flattened.find((item) => item.id === input.activeBlueprintId) || null
    : null

  return {
    state: {
      version: input.version,
      activeShipId: activeBlueprint?.shipId || (ships.some((bucket) => bucket.shipId === input.activeShipId) ? input.activeShipId : ships[0]?.shipId || null),
      activeBlueprintId: activeBlueprint?.id || flattened[0]?.id || null,
      ships
    },
    summary: buildSanitizeSummary(SHIP_KEY, {
      invalidShipsRemoved,
      invalidEquipmentsCleared,
      invalidShieldsCleared,
      invalidStorageItemsRemoved
    })
  }
}

export function prepareImportPayload(
  payload: NormalizedImportPayload,
  gameDataStore: GameDataStoreLike,
  shipBuildStore: ShipBuildStoreLike
): PreparedImportPayload {
  const warnings: string[] = []
  const moduleStats: ModuleImportStats[] = []
  const sanitizeSummaries: ImportSanitizeSummary[] = []
  const preparedModules: Partial<Record<ImportModuleKey, unknown>> = {}

  const empire = coerceEmpireState(payload.modules[EMPIRE_KEY])
  if (empire) {
    const migrated = migrateEmpireState(empire, gameDataStore)
    warnings.push(...migrated.warnings)
    const sanitized = sanitizeEmpireState(migrated.state, gameDataStore)
    preparedModules[EMPIRE_KEY] = sanitized.state
    moduleStats.push({ key: EMPIRE_KEY, count: sanitized.state.list.length })
    if (sanitized.summary) sanitizeSummaries.push(sanitized.summary)
  }

  const flow = coerceFlowState(payload.modules[FLOW_KEY])
  if (flow) {
    const migrated = migrateFlowState(flow, gameDataStore)
    warnings.push(...migrated.warnings)
    const sanitized = sanitizeFlowState(migrated.state, gameDataStore)
    preparedModules[FLOW_KEY] = sanitized.state
    moduleStats.push({ key: FLOW_KEY, count: sanitized.state.list.length })
    if (sanitized.summary) sanitizeSummaries.push(sanitized.summary)
  }

  const ship = coerceShipState(payload.modules[SHIP_KEY])
  if (ship) {
    const migrated = migrateShipBlueprintStateToCurrent(ship)
    warnings.push(...migrated.warnings)
    const sanitized = sanitizeShipState(migrated.state, shipBuildStore)
    preparedModules[SHIP_KEY] = sanitized.state
    moduleStats.push({
      key: SHIP_KEY,
      count: sanitized.state.ships.reduce((sum, bucket) => sum + bucket.blueprints.length, 0)
    })
    if (sanitized.summary) sanitizeSummaries.push(sanitized.summary)
  }

  return {
    payload,
    moduleStats,
    versionState: buildImportVersionState(payload, gameDataStore),
    preparedModules,
    sanitizeSummaries,
    warnings
  }
}

export function buildExportPayload(
  empire: SavedEmpiresState,
  flow: SavedFlowPlansState,
  ship: SavedShipBlueprintsState,
  gameDataStore?: GameDataStoreLike
) {
  const lookup = gameDataStore || { modulesMap: {}, modulesByMacroId: {} }
  const empireCoerced = coerceEmpireState(empire)
  const flowCoerced = coerceFlowState(flow)
  const migratedEmpire = empireCoerced ? migrateEmpireState(empireCoerced, lookup).state : {
    ...deepClone(empire),
    version: CURRENT_EMPIRE_VERSION
  }
  const migratedFlow = flowCoerced ? migrateFlowState(flowCoerced, lookup).state : {
    ...deepClone(flow),
    version: CURRENT_FLOW_VERSION
  }
  const migratedShip = migrateShipBlueprintStateToCurrent(ship)

  return {
    format: 'x4-import-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    game_vsn: typeof gameDataStore?.currentVersion === 'string' && gameDataStore.currentVersion
      ? gameDataStore.currentVersion
      : DEFAULT_IMPORT_GAME_VSN,
    beta: typeof gameDataStore?.isBeta === 'boolean' ? gameDataStore.isBeta : DEFAULT_IMPORT_BETA,
    data: {
      [EMPIRE_KEY]: deepClone(migratedEmpire),
      [FLOW_KEY]: deepClone(migratedFlow),
      [SHIP_KEY]: deepClone(migratedShip.state)
    }
  }
}

export function triggerJsonDownload(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function applyEmpireImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const migrated = preparedPayload.preparedModules[EMPIRE_KEY] as SavedEmpiresState | undefined
  if (!migrated) return false
  const current = deepClone(options.empireStore.savedEmpires)

  let next: SavedEmpiresState
  let incomingActiveId: string | null = migrated.activeId || null
  let incomingActiveStationId: string | null = migrated.activeStationId || null

  if (options.mode === 'overwrite') {
    next = migrated
  } else {
    const remapped = remapEmpireIds(migrated)
    incomingActiveId = remapped.state.activeId
    incomingActiveStationId = remapped.state.activeStationId
    next = mergeEmpireState(current, remapped.state)

    const canUpdate = shouldUpdateActiveIncremental(current.activeId, isEmpireActiveEmpty(current), options.empireStore.isDirty)
    if (canUpdate && incomingActiveId) {
      next.activeId = incomingActiveId
      next.activeStationId = incomingActiveStationId
    } else {
      next.activeId = current.activeId
      next.activeStationId = current.activeStationId
    }
  }

  if (options.mode === 'overwrite' && !next.activeId && next.list.length > 0) {
    next.activeId = next.list[0]?.id || null
    next.activeStationId = next.list[0]?.stations[0]?.id || null
    warnings.push('Empire activeId was missing; fallback to first empire.')
  }

  persistModule(EMPIRE_KEY, next, options.gameDataStore)
  options.empireStore.loadData(next)
  options.empireStore.initializeAllStationCaches()
  options.empireStore.saveToStorage()
  if (next.activeId) {
    options.empireStore.loadEmpire?.(next.activeId)
  }
  return true
}

function applyFlowImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const migrated = preparedPayload.preparedModules[FLOW_KEY] as SavedFlowPlansState | undefined
  if (!migrated) return false
  const current = deepClone(options.logicFlowStore.savedPlans)

  let next: SavedFlowPlansState
  let incomingActiveId: string | null = migrated.activeId || null

  if (options.mode === 'overwrite') {
    next = migrated
  } else {
    const remapped = remapFlowIds(migrated)
    incomingActiveId = remapped.state.activeId
    next = mergeFlowState(current, remapped.state)

    const canUpdate = shouldUpdateActiveIncremental(current.activeId, isFlowActiveEmpty(current), options.logicFlowStore.isDirty)
    if (canUpdate && incomingActiveId) {
      next.activeId = incomingActiveId
    } else {
      next.activeId = current.activeId
    }
  }

  if (options.mode === 'overwrite' && !next.activeId && next.list.length > 0) {
    next.activeId = next.list[0]?.id || null
    warnings.push('Logic-flow activeId was missing; fallback to first plan.')
  }

  persistModule(FLOW_KEY, next, options.gameDataStore)
  options.logicFlowStore.init()
  if (next.activeId) {
    const activeIndex = next.list.findIndex((plan) => plan.id === next.activeId)
    if (activeIndex >= 0) {
      options.logicFlowStore.loadPlan?.(activeIndex)
    }
  }
  return true
}

function applyShipImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const migrated = preparedPayload.preparedModules[SHIP_KEY] as SavedShipBlueprintsState | undefined
  if (!migrated) return false
  const current = deepClone(options.shipBuildStore.savedBlueprints)

  let next: SavedShipBlueprintsState
  let incomingActiveId: string | null = migrated.activeBlueprintId || null

  if (options.mode === 'overwrite') {
    next = migrated
  } else {
    const remapped = remapShipIds(migrated)
    incomingActiveId = remapped.state.activeBlueprintId
    next = mergeShipState(current, remapped.state)

    const canUpdate = shouldUpdateActiveIncremental(current.activeBlueprintId, isShipActiveEmpty(current), options.shipBuildStore.isDirty)
    if (canUpdate && incomingActiveId) {
      next.activeBlueprintId = incomingActiveId
      next.activeShipId = remapped.state.activeShipId
    } else {
      next.activeBlueprintId = current.activeBlueprintId
      next.activeShipId = current.activeShipId
    }
  }

  const firstBlueprint = next.ships.flatMap((bucket) => bucket.blueprints)[0] || null
  if (options.mode === 'overwrite' && !next.activeBlueprintId && firstBlueprint) {
    next.activeBlueprintId = firstBlueprint.id
    next.activeShipId = firstBlueprint.shipId
    warnings.push('Ship-build activeId was missing; fallback to first blueprint.')
  }

  persistModule(SHIP_KEY, next, options.gameDataStore)
  options.shipBuildStore.loadBlueprintsFromStorage()
  if (next.activeBlueprintId) {
    options.shipBuildStore.loadBlueprint(next.activeBlueprintId)
  }
  return true
}

export function applyImportPayload(options: ImportApplyOptions): ImportApplyResult {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const warnings: string[] = [...preparedPayload.warnings]
  const applied: ImportModuleKey[] = []
  const skipped: ImportModuleKey[] = []

  const entries: Array<{ key: ImportModuleKey; run: () => boolean }> = [
    { key: EMPIRE_KEY, run: () => applyEmpireImport(options, warnings) },
    { key: FLOW_KEY, run: () => applyFlowImport(options, warnings) },
    { key: SHIP_KEY, run: () => applyShipImport(options, warnings) }
  ]

  entries.forEach(({ key, run }) => {
    if (!options.selectedModules[key]) {
      skipped.push(key)
      return
    }

    if (run()) {
      applied.push(key)
      return
    }

    skipped.push(key)
    warnings.push(`${key} payload is missing or invalid.`)
  })

  return {
    applied,
    skipped,
    warnings,
    sanitizeSummaries: preparedPayload.sanitizeSummaries
  }
}
