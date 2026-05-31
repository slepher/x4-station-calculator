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
  X4Equipment,
  X4Map,
  SavedSaveBindingsState,
  SavedTerraformingState
} from '@/types/x4'
import type { SavedBuildPlanGoalsState } from '@/types/build-plan'
import type {
  SavedSaveArchivesState,
  SaveArchive,
  ArchiveMeta
} from '@/types/saveArchive'
import {
  loadArchiveDetailFromDB,
  clearArchivesFromDB,
  saveArchiveToDB,
  createArchiveId
} from '@/db/saveArchiveDB'
import {
  CURRENT_PARSER_VERSION,
  CURRENT_POST_PROCESSOR_VERSION,
  postProcessRustSaveArchive
} from '@/workers/saveParser.post'
import { migrateEmpireStateToCurrent, migrateFlowStateToCurrent, migrateShipBlueprintStateToCurrent } from './stateMigrations'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION, CURRENT_SHIP_BLUEPRINT_VERSION, CURRENT_TERRAFORMING_VERSION } from './storageVersions'
import { normalizeSectorLinkKey, parseSectorLinkKey } from './sectorLinks'

export type ImportMode = 'overwrite' | 'incremental'
export type ImportModuleKey = 'x4_empire_data' | 'x4_logic_flow_plans' | 'x4_ship_blueprints' | 'x4_save_archives' | 'x4_save_bindings' | 'x4_build_plan_goals' | 'x4_terraforming_data'

const EMPIRE_KEY: ImportModuleKey = 'x4_empire_data'
const FLOW_KEY: ImportModuleKey = 'x4_logic_flow_plans'
const SHIP_KEY: ImportModuleKey = 'x4_ship_blueprints'
const SAVE_KEY: ImportModuleKey = 'x4_save_archives'
const BINDING_KEY: ImportModuleKey = 'x4_save_bindings'
const BUILD_PLAN_KEY: ImportModuleKey = 'x4_build_plan_goals'
const TERRAFORMING_KEY: ImportModuleKey = 'x4_terraforming_data'

const STORAGE_KEY_MAP: Record<ImportModuleKey, string> = {
  [EMPIRE_KEY]: 'x4_empire_data',
  [FLOW_KEY]: 'x4_logic_flow_plans',
  [SHIP_KEY]: 'x4_ship_blueprints',
  [SAVE_KEY]: 'x4_save_archives',
  [BINDING_KEY]: 'x4_save_bindings',
  [BUILD_PLAN_KEY]: 'x4_build_plan_goals',
  [TERRAFORMING_KEY]: 'x4_terraforming_data'
}

export interface SaveArchiveExportData {
  state: SavedSaveArchivesState
  archives: SaveArchive[]
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
  currentView: 'blueprint-production' | 'live-production' | 'flow' | 'ship-build' | 'maps'
  payload: NormalizedImportPayload
  preparedPayload?: PreparedImportPayload
  gameDataStore: GameDataStoreLike
  blueprintStore: BlueprintProductionStoreLike
  liveStore?: LiveProductionStoreLike
  logicFlowStore: LogicFlowStoreLike
  shipBuildStore: ShipBuildStoreLike
  saveStore?: SaveStoreLike
  saveBindingStore?: SaveBindingStoreLike
  buildPlanStore?: BuildPlanStoreLike
  terraformingStore?: TerraformingStoreLike
}

export interface ImportApplyResult {
  applied: ImportModuleKey[]
  skipped: ImportModuleKey[]
  warnings: string[]
  sanitizeSummaries: ImportSanitizeSummary[]
}

interface BlueprintProductionStoreLike {
  savedEmpires: SavedEmpiresState
  isDirty: boolean
  loadEmpire?: (empireId: string) => void
  loadData: (data: SavedEmpiresState) => void
  initializeAllStationDerived: () => void
  saveToStorage: () => void
}

interface LiveProductionStoreLike {
  savedBindings?: SavedSaveBindingsState
  isDirty?: boolean
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
  activeView: 'blueprint-production' | 'live-production' | 'flow' | 'ship-build' | 'maps'
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
  maps?: X4Map
  ships?: X4Ship[]
  equipments?: X4Equipment[]
  currentVersion?: string
  isBeta?: boolean
  getStorageKey?: (module: 'empire' | 'logic_flow' | 'ship_blueprints' | 'save_archives' | 'build_plan_goals') => string
  getIndexedDBName?: () => string
}

interface SaveStoreLike {
  savedArchivesState: SavedSaveArchivesState
  selectedArchive: SaveArchive | null
  isInitialized: boolean
  loadDataAndRestore: (data: SavedSaveArchivesState) => Promise<void>
  restoreSelectedArchive: (archiveId: string) => Promise<void>
}

interface SaveBindingStoreLike {
  savedBindings: SavedSaveBindingsState
  loadData: (data: SavedSaveBindingsState) => void
}

interface BuildPlanStoreLike {
  savedPlans: SavedBuildPlanGoalsState
  loadPlansFromStorage: () => void
  savePlansToStorage: () => void
}

interface TerraformingStoreLike {
  savedPlans: SavedTerraformingState
  loadFromStorage: () => SavedTerraformingState | null
  init: () => void
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
  if (moduleKey === SHIP_KEY) return gameDataStore.getStorageKey('ship_blueprints')
  if (moduleKey === BUILD_PLAN_KEY) return gameDataStore.getStorageKey('build_plan_goals')
  if (moduleKey === BINDING_KEY) {
    const saveKey = gameDataStore.getStorageKey('save_archives')
    return saveKey.includes('save_archives') ? saveKey.replace('save_archives', 'save_bindings') : STORAGE_KEY_MAP[BINDING_KEY]
  }
  return gameDataStore.getStorageKey('save_archives')
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

function isSaveExportData(value: unknown): value is SaveArchiveExportData {
  if (!isObject(value)) return false
  const data = value as Record<string, unknown>
  return isObject(data.state) && Array.isArray(data.archives)
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

function coerceSaveExportData(value: unknown): SaveArchiveExportData | null {
  if (!isSaveExportData(value)) return null
  const data = value as SaveArchiveExportData
  const state = deepClone(data.state)
  state.list = state.list.map(item => ({
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)
  }))
  return {
    state,
    archives: deepClone(data.archives)
  }
}

const SAVE_ARCHIVES_STATE_VERSION = 1

function migrateSaveArchivesStateToCurrent(input: SavedSaveArchivesState): { state: SavedSaveArchivesState; warnings: string[] } {
  const version = input.version || 1
  if (version === SAVE_ARCHIVES_STATE_VERSION) {
    return { state: deepClone(input), warnings: [] }
  }
  return { state: deepClone(input), warnings: [] }
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

  return {
    state: {
      version: CURRENT_EMPIRE_VERSION,
      activeId: mappedActiveEmpireId,
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

    const groupIdMap = new Map<string, string>()
    const groups: SavedFlowGroup[] = (plan.groups || []).map((group) => {
      const newGroupId = crypto.randomUUID()
      groupIdMap.set(group.id, newGroupId)
      const nodes: SavedFlowNode[] = (group.nodes || []).map((node) => deepClone(node))

      return {
        ...deepClone(group),
        id: newGroupId,
        nodes
      }
    })

    const remappedBuildFlow = plan.buildFlow
      ? {
          assignments: plan.buildFlow.assignments.map(a => ({
            ...a,
            sourceGroupId: groupIdMap.get(a.sourceGroupId) || a.sourceGroupId,
            targetGroupId: a.targetGroupId
              ? (groupIdMap.get(a.targetGroupId) || a.targetGroupId)
              : undefined
          }))
        }
      : undefined

    return {
      ...deepClone(plan),
      id: newPlanId,
      groups,
      buildFlow: remappedBuildFlow,
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
      [SHIP_KEY]: raw.data[SHIP_KEY],
      [SAVE_KEY]: raw.data[SAVE_KEY],
      [BINDING_KEY]: raw.data[BINDING_KEY],
      [BUILD_PLAN_KEY]: raw.data[BUILD_PLAN_KEY],
      [TERRAFORMING_KEY]: raw.data[TERRAFORMING_KEY]
    }
  }

  return {
    [EMPIRE_KEY]: raw[EMPIRE_KEY],
    [FLOW_KEY]: raw[FLOW_KEY],
    [SHIP_KEY]: raw[SHIP_KEY],
    [SAVE_KEY]: raw[SAVE_KEY],
    [BINDING_KEY]: raw[BINDING_KEY],
    [BUILD_PLAN_KEY]: raw[BUILD_PLAN_KEY],
    [TERRAFORMING_KEY]: raw[TERRAFORMING_KEY]
  }
}

function coerceSaveBindingsState(value: unknown): SavedSaveBindingsState | null {
  if (!isObject(value)) return null
  if (!Array.isArray(value.list)) return null
  return {
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    list: value.list as SavedSaveBindingsState['list']
  }
}

function isBuildPlanGoalsState(value: unknown): value is SavedBuildPlanGoalsState {
  return isObject(value) && Array.isArray(value.list)
}

function coerceBuildPlanGoalsState(value: unknown): SavedBuildPlanGoalsState | null {
  if (!isBuildPlanGoalsState(value)) return null
  const raw = value as unknown as Record<string, unknown>
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
    list: deepClone((raw.list as unknown[]) || []) as SavedBuildPlanGoalsState['list']
  }
}

function coerceTerraformingState(value: unknown): SavedTerraformingState | null {
  if (!isObject(value)) return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.list)) return null
  return {
    version: typeof raw.version === 'number' ? raw.version : CURRENT_TERRAFORMING_VERSION,
    activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
    list: deepClone(raw.list as any[]) as SavedTerraformingState['list']
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
  const save = coerceSaveExportData(payload.modules[SAVE_KEY])
  const binding = coerceSaveBindingsState(payload.modules[BINDING_KEY])
  const buildPlan = coerceBuildPlanGoalsState(payload.modules[BUILD_PLAN_KEY])
  const terraforming = coerceTerraformingState(payload.modules[TERRAFORMING_KEY])

  if (empire) stats.push({ key: EMPIRE_KEY, count: empire.list.length })
  if (flow) stats.push({ key: FLOW_KEY, count: flow.list.length })
  if (ship) {
    const migrated = migrateShipBlueprintStateToCurrent(ship)
    const count = migrated.state.ships.reduce((sum, bucket) => sum + bucket.blueprints.length, 0)
    stats.push({ key: SHIP_KEY, count })
  }
  if (save) {
    stats.push({ key: SAVE_KEY, count: save.state.list.length })
  }
  if (binding) stats.push({ key: BINDING_KEY, count: binding.list.length })
  if (buildPlan) stats.push({ key: BUILD_PLAN_KEY, count: buildPlan.list.length })
  if (terraforming) stats.push({ key: TERRAFORMING_KEY, count: terraforming.list.length })

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

function normalizeVersion(v: string): string {
  const trimmed = v.trim()
  if (/^\d+\.\d+$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed.toFixed(1) : v
  }
  const num = parseInt(trimmed, 10)
  if (isNaN(num)) return v
  return num >= 100 ? (num / 100).toFixed(1) : num.toFixed(1)
}

interface SanitizeSaveResult {
  state: SavedSaveArchivesState
  validArchives: SaveArchive[]
  skippedCount: number
  skippedDetails: string[]
}

function sanitizeSaveArchives(
  input: SaveArchiveExportData,
  gameDataStore: GameDataStoreLike
): SanitizeSaveResult {
  const currentVersion = normalizeVersion(gameDataStore.currentVersion || DEFAULT_IMPORT_GAME_VSN)
  const validArchives: SaveArchive[] = []
  const validMetas: ArchiveMeta[] = []
  const skippedDetails: string[] = []

  for (const archive of input.archives) {
    const archiveVersion = normalizeVersion(archive.meta.version)
    if (archiveVersion !== currentVersion) {
      skippedDetails.push(`[${archive.meta.playerName}] ${archive.meta.filename}: version mismatch (${archive.meta.version} vs ${gameDataStore.currentVersion})`)
      continue
    }

    if (archive.meta.parser_version !== CURRENT_PARSER_VERSION) {
      skippedDetails.push(`[${archive.meta.playerName}] ${archive.meta.filename}: parser_version mismatch (${archive.meta.parser_version} vs ${CURRENT_PARSER_VERSION})`)
      continue
    }

    validArchives.push(archive)
    const meta = input.state.list.find(m => m.id === createArchiveId(archive.meta.guid, archive.meta.time))
    if (meta) {
      validMetas.push(meta)
    }
  }

  const activeArchiveId = input.state.activeArchiveId && (
    validMetas.some(m => m.id === input.state.activeArchiveId) ||
    validMetas.some(m => m.guid === input.state.activeArchiveId)
  )
    ? input.state.activeArchiveId
    : (validMetas[0]?.id || null)

  return {
    state: {
      version: input.state.version,
      activeArchiveId,
      list: validMetas,
      settings: input.state.settings
    },
    validArchives,
    skippedCount: skippedDetails.length,
    skippedDetails
  }
}

function reprocessSaveArchives(
  archives: SaveArchive[],
  gameDataStore: GameDataStoreLike
): SaveArchive[] {
  const modulesByMacroId = gameDataStore.modulesByMacroId || {}
  const maps = gameDataStore.maps

  return archives.map(archive => {
    if (archive.meta.post_processor_version === CURRENT_POST_PROCESSOR_VERSION) {
      return archive
    }

    const reprocessed = postProcessRustSaveArchive(archive, modulesByMacroId, maps, gameDataStore.ships, gameDataStore.equipments)
    reprocessed.meta.post_processor_version = CURRENT_POST_PROCESSOR_VERSION
    reprocessed.isValid = archive.meta.parser_version === CURRENT_PARSER_VERSION
    return reprocessed
  })
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

  const save = coerceSaveExportData(payload.modules[SAVE_KEY])
  if (save) {
    const migrated = migrateSaveArchivesStateToCurrent(save.state)
    warnings.push(...migrated.warnings)
    const sanitized = sanitizeSaveArchives({ state: migrated.state, archives: save.archives }, gameDataStore)
    const reprocessed = reprocessSaveArchives(sanitized.validArchives, gameDataStore)
    preparedModules[SAVE_KEY] = {
      state: sanitized.state,
      archives: reprocessed
    }
    moduleStats.push({ key: SAVE_KEY, count: sanitized.state.list.length })
    if (sanitized.skippedCount > 0) {
      sanitizeSummaries.push({
        key: SAVE_KEY,
        removed: sanitized.skippedCount,
        details: [{ kind: 'archivesSkipped', count: sanitized.skippedCount }]
      })
      warnings.push(...sanitized.skippedDetails)
    }
  }

  const binding = coerceSaveBindingsState(payload.modules[BINDING_KEY])
  if (binding) {
    preparedModules[BINDING_KEY] = binding
    moduleStats.push({ key: BINDING_KEY, count: binding.list.length })
  }

  const buildPlan = coerceBuildPlanGoalsState(payload.modules[BUILD_PLAN_KEY])
  if (buildPlan) {
    preparedModules[BUILD_PLAN_KEY] = buildPlan
    moduleStats.push({ key: BUILD_PLAN_KEY, count: buildPlan.list.length })
  }

  const terraforming = coerceTerraformingState(payload.modules[TERRAFORMING_KEY])
  if (terraforming) {
    preparedModules[TERRAFORMING_KEY] = terraforming
    moduleStats.push({ key: TERRAFORMING_KEY, count: terraforming.list.length })
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
  gameDataStore?: GameDataStoreLike,
  saveBindings?: SavedSaveBindingsState,
  buildPlanGoals?: SavedBuildPlanGoalsState,
  terraforming?: SavedTerraformingState
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

  let terraformingData = terraforming ? deepClone(terraforming) : undefined
  if (terraformingData) {
    if (!saveBindings) {
      terraformingData.list = terraformingData.list.filter(p => p.mode !== 'live')
    }
    if (terraformingData.list.length === 0) terraformingData = undefined
  }

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
      [SHIP_KEY]: deepClone(migratedShip.state),
      ...(saveBindings ? { [BINDING_KEY]: deepClone(saveBindings) } : {}),
      ...(buildPlanGoals ? { [BUILD_PLAN_KEY]: deepClone(buildPlanGoals) } : {}),
      ...(terraformingData ? { [TERRAFORMING_KEY]: terraformingData } : {})
    }
  }
}

export async function buildSaveExportData(
  state: SavedSaveArchivesState,
  gameDataStore: GameDataStoreLike
): Promise<SaveArchiveExportData> {
  const archives: SaveArchive[] = []

  for (const meta of state.list) {
    const archive = await loadArchiveDetailFromDB(gameDataStore, meta.id)
    if (archive) {
      archives.push(archive)
    }
  }

  return {
    state: deepClone(state),
    archives
  }
}

export async function buildExportPayloadWithSave(
  empire: SavedEmpiresState,
  flow: SavedFlowPlansState,
  ship: SavedShipBlueprintsState,
  save: SavedSaveArchivesState | null,
  gameDataStore?: GameDataStoreLike
) {
  const basePayload = buildExportPayload(empire, flow, ship, gameDataStore)

  if (save && save.list.length > 0) {
    const saveExportData = await buildSaveExportData(save, gameDataStore || { modulesMap: {} })
    return {
      ...basePayload,
      data: {
        ...basePayload.data,
        [SAVE_KEY]: saveExportData
      }
    }
  }

  return basePayload
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
  const current = deepClone(options.blueprintStore.savedEmpires)

  let next: SavedEmpiresState
  let incomingActiveId: string | null = migrated.activeId || null
  if (options.mode === 'overwrite') {
    next = migrated
  } else {
    const remapped = remapEmpireIds(migrated)
    incomingActiveId = remapped.state.activeId
    next = mergeEmpireState(current, remapped.state)

    const canUpdate = shouldUpdateActiveIncremental(current.activeId, isEmpireActiveEmpty(current), options.blueprintStore.isDirty)
    if (canUpdate && incomingActiveId) {
      next.activeId = incomingActiveId
    } else {
      next.activeId = current.activeId
    }
  }

  if (options.mode === 'overwrite' && !next.activeId && next.list.length > 0) {
    next.activeId = next.list[0]?.id || null
    warnings.push('Empire activeId was missing; fallback to first empire.')
  }

  persistModule(EMPIRE_KEY, next, options.gameDataStore)
  options.blueprintStore.loadData(next)
  options.blueprintStore.initializeAllStationDerived()
  options.blueprintStore.saveToStorage()
  if (next.activeId) {
    options.blueprintStore.loadEmpire?.(next.activeId)
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

async function applySaveImport(options: ImportApplyOptions, warnings: string[]): Promise<boolean> {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const saveData = preparedPayload.preparedModules[SAVE_KEY] as { state: SavedSaveArchivesState; archives: SaveArchive[] } | undefined
  if (!saveData) return false

  const defaultSettings = {
    visibility: {
      playerStation: false,
      npcStation: false,
      xenonStation: false,
      khaakStation: false,
      abandonedShip: false,
      datavault: false,
      erlkingVault: false
    }
  }
  const currentState = options.saveStore?.savedArchivesState || { version: 1, activeArchiveId: null, list: [], settings: defaultSettings }

  let nextState: SavedSaveArchivesState
  let nextArchives: SaveArchive[]

  if (options.mode === 'overwrite') {
    await clearArchivesFromDB(options.gameDataStore)
    nextState = saveData.state
    nextArchives = saveData.archives
  } else {
    const mergedList = [...currentState.list]
    for (const meta of saveData.state.list) {
      const existingIndex = mergedList.findIndex(m => m.id === meta.id)
      if (existingIndex >= 0) {
        mergedList[existingIndex] = meta
      } else {
        mergedList.push(meta)
      }
    }

    const canUpdateActive = !currentState.activeArchiveId || !options.saveStore?.selectedArchive
    nextState = {
      version: saveData.state.version,
      activeArchiveId: canUpdateActive && saveData.state.activeArchiveId ? saveData.state.activeArchiveId : currentState.activeArchiveId,
      list: mergedList,
      settings: currentState.settings
    }
    nextArchives = saveData.archives
  }

  if (!nextState.activeArchiveId && nextState.list.length > 0) {
    nextState.activeArchiveId = nextState.list[0]?.id || null
    warnings.push('Save activeArchiveId was missing; fallback to first archive.')
  }

  persistModule(SAVE_KEY, nextState, options.gameDataStore)

  for (const archive of nextArchives) {
    const serializedArchive = JSON.parse(JSON.stringify(archive))
    await saveArchiveToDB(options.gameDataStore, serializedArchive)
  }

  if (options.saveStore) {
    await options.saveStore.loadDataAndRestore(nextState)
  }

  return true
}

function applySaveBindingImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const bindingData = preparedPayload.preparedModules[BINDING_KEY] as SavedSaveBindingsState | undefined
  if (!bindingData) return false

  if (options.saveBindingStore) {
    options.saveBindingStore.loadData(bindingData)
    return true
  }

  persistModule(BINDING_KEY, bindingData, options.gameDataStore)
  warnings.push(`${BINDING_KEY} imported to storage; reload may be required.`)
  return true
}

function applyBuildPlanImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const data = preparedPayload.preparedModules[BUILD_PLAN_KEY] as SavedBuildPlanGoalsState | undefined
  if (!data) return false

  if (options.buildPlanStore) {
    if (options.mode === 'overwrite') {
      persistModule(BUILD_PLAN_KEY, data, options.gameDataStore)
      options.buildPlanStore.loadPlansFromStorage()
    } else {
      const current = deepClone(options.buildPlanStore.savedPlans)
      const remappedList = data.list.map(plan => ({
        ...deepClone(plan),
        id: crypto.randomUUID(),
        lastUpdated: Date.now()
      }))
      const merged: SavedBuildPlanGoalsState = {
        version: data.version,
        activeId: current.activeId,
        list: [...current.list, ...remappedList]
      }
      persistModule(BUILD_PLAN_KEY, merged, options.gameDataStore)
      options.buildPlanStore.loadPlansFromStorage()
    }
    return true
  }

  persistModule(BUILD_PLAN_KEY, data, options.gameDataStore)
  warnings.push(`${BUILD_PLAN_KEY} imported to storage; reload may be required.`)
  return true
}

function applyTerraformingImport(options: ImportApplyOptions, _warnings: string[]): boolean {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const data = preparedPayload.preparedModules[TERRAFORMING_KEY] as SavedTerraformingState | undefined
  if (!data) return false

  let nextList = data.list
  const liveSelected = options.selectedModules[SAVE_KEY] || options.selectedModules[BINDING_KEY]
  const blueprintSelected = options.selectedModules[EMPIRE_KEY] || options.selectedModules[FLOW_KEY]
    || options.selectedModules[SHIP_KEY] || options.selectedModules[BUILD_PLAN_KEY]

  if (!liveSelected && !blueprintSelected) {
    nextList = []
  } else if (!liveSelected) {
    nextList = nextList.filter(p => p.mode !== 'live')
  } else if (!blueprintSelected) {
    nextList = nextList.filter(p => p.mode !== 'blueprint')
  }

  const next: SavedTerraformingState = data.list.length === nextList.length
    ? data
    : { ...data, list: nextList }

  if (next.list.length === 0) return false

  if (options.mode === 'overwrite') {
    persistModule(TERRAFORMING_KEY, next, options.gameDataStore)
  } else {
    if (options.terraformingStore) {
      const current = deepClone(options.terraformingStore.savedPlans)
      const remappedList = next.list.map(plan => ({
        ...deepClone(plan),
        id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }))
      const merged: SavedTerraformingState = {
        version: next.version,
        activeId: current.activeId,
        list: [...current.list, ...remappedList]
      }
      persistModule(TERRAFORMING_KEY, merged, options.gameDataStore)
    } else {
      persistModule(TERRAFORMING_KEY, next, options.gameDataStore)
    }
  }

  if (options.terraformingStore) {
    options.terraformingStore.init()
  }

  return true
}

export async function applyImportPayload(options: ImportApplyOptions): Promise<ImportApplyResult> {
  const preparedPayload = options.preparedPayload || prepareImportPayload(options.payload, options.gameDataStore, options.shipBuildStore)
  const warnings: string[] = [...preparedPayload.warnings]
  const applied: ImportModuleKey[] = []
  const skipped: ImportModuleKey[] = []

  const syncEntries: Array<{ key: ImportModuleKey; run: () => boolean }> = [
    { key: EMPIRE_KEY, run: () => applyEmpireImport(options, warnings) },
    { key: FLOW_KEY, run: () => applyFlowImport(options, warnings) },
    { key: SHIP_KEY, run: () => applyShipImport(options, warnings) },
    { key: BINDING_KEY, run: () => applySaveBindingImport(options, warnings) },
    { key: BUILD_PLAN_KEY, run: () => applyBuildPlanImport(options, warnings) },
    { key: TERRAFORMING_KEY, run: () => applyTerraformingImport(options, warnings) }
  ]

  syncEntries.forEach(({ key, run }) => {
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

  if (options.selectedModules[SAVE_KEY]) {
    const saveApplied = await applySaveImport(options, warnings)
    if (saveApplied) {
      applied.push(SAVE_KEY)
    } else {
      skipped.push(SAVE_KEY)
      warnings.push(`${SAVE_KEY} payload is missing or invalid.`)
    }
  } else {
    skipped.push(SAVE_KEY)
  }

  return {
    applied,
    skipped,
    warnings,
    sanitizeSummaries: preparedPayload.sanitizeSummaries
  }
}
