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
  ShipBlueprint
} from '@/types/x4'
import { migrateEmpireStateToCurrent, migrateFlowStateToCurrent } from './stateMigrations'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION } from './storageVersions'

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

export interface NormalizedImportPayload {
  modules: Partial<Record<ImportModuleKey, unknown>>
}

export interface ModuleImportStats {
  key: ImportModuleKey
  count: number
}

export interface ImportApplyOptions {
  mode: ImportMode
  selectedModules: Partial<Record<ImportModuleKey, boolean>>
  currentView: 'production' | 'flow' | 'ship-build'
  payload: NormalizedImportPayload
  gameDataStore: GameDataStoreLike
  empireStore: EmpireStoreLike
  logicFlowStore: LogicFlowStoreLike
  shipBuildStore: ShipBuildStoreLike
}

export interface ImportApplyResult {
  applied: ImportModuleKey[]
  skipped: ImportModuleKey[]
  warnings: string[]
}

interface EmpireStoreLike {
  savedEmpires: SavedEmpiresState
  activeEmpireId: string | null
  isDirty: boolean
  loadData: (data: SavedEmpiresState) => void
  initializeAllStationCaches: () => void
  saveToStorage: () => void
}

interface LogicFlowStoreLike {
  savedPlans: SavedFlowPlansState
  isDirty: boolean
  init: () => void
}

interface ShipBuildStoreLike {
  savedBlueprints: SavedShipBlueprintsState
  isDirty: boolean
  activeView: 'production' | 'flow' | 'ship-build'
  loadBlueprintsFromStorage: () => void
  loadBlueprint: (id: string) => void
}

interface GameDataStoreLike {
  modulesMap: Record<string, X4Module>
  modulesByMacroId?: Record<string, X4Module>
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEmpireState(value: unknown): value is SavedEmpiresState {
  return isObject(value) && Array.isArray(value.list)
}

function isFlowState(value: unknown): value is SavedFlowPlansState {
  return isObject(value) && Array.isArray(value.list)
}

function isShipState(value: unknown): value is SavedShipBlueprintsState {
  return isObject(value) && Array.isArray(value.list)
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

function coerceShipState(value: unknown): SavedShipBlueprintsState | null {
  if (!isShipState(value)) return null
  const raw = value as unknown as SavedShipBlueprintsState
  return {
    version: 1,
    activeId: raw.activeId || null,
    list: deepClone(raw.list || [])
  }
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

function migrateShipState(input: SavedShipBlueprintsState): SavedShipBlueprintsState {
  return deepClone(input)
}

function remapEmpireIds(input: SavedEmpiresState): { state: SavedEmpiresState; activeChangedTo: string | null } {
  const empireIdMap = new Map<string, string>()
  const stationIdMap = new Map<string, string>()

  const list: EmpirePlan[] = input.list.map((empire) => {
    const newEmpireId = crypto.randomUUID()
    empireIdMap.set(empire.id, newEmpireId)

    const stations: StationPlan[] = (empire.stations || []).map((station) => {
      const newStationId = crypto.randomUUID()
      stationIdMap.set(station.id, newStationId)
      return {
        ...deepClone(station),
        id: newStationId,
        lastUpdated: Date.now()
      }
    })

    return {
      ...deepClone(empire),
      id: newEmpireId,
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
  const groupIdMap = new Map<string, string>()

  const list: LogicFlowPlan[] = input.list.map((plan) => {
    const newPlanId = crypto.randomUUID()
    planIdMap.set(plan.id, newPlanId)

    const groups: SavedFlowGroup[] = (plan.groups || []).map((group) => {
      const newGroupId = crypto.randomUUID()
      groupIdMap.set(group.id, newGroupId)

      const nodes: SavedFlowNode[] = (group.nodes || []).map((node) => ({
        ...deepClone(node),
        id: crypto.randomUUID()
      }))

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

  const list: ShipBlueprint[] = input.list.map((blueprint) => {
    const newId = crypto.randomUUID()
    idMap.set(blueprint.id, newId)
    return {
      ...deepClone(blueprint),
      id: newId,
      lastUpdated: Date.now()
    }
  })

  const mappedActive = input.activeId ? idMap.get(input.activeId) || null : null

  return {
    state: {
      version: 1,
      activeId: mappedActive,
      list
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
  if (!state.activeId) return true
  const blueprint = state.list.find((item) => item.id === state.activeId)
  if (!blueprint) return true
  return (blueprint.connections || []).length === 0
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
  return {
    version: 1,
    activeId: current.activeId,
    list: [...deepClone(current.list), ...deepClone(incoming.list)]
  }
}

function persistModule(moduleKey: ImportModuleKey, value: unknown) {
  localStorage.setItem(STORAGE_KEY_MAP[moduleKey], JSON.stringify(value))
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
    modules: getImportModulesFromRaw(raw)
  }
}

export function getModuleImportStats(payload: NormalizedImportPayload): ModuleImportStats[] {
  const stats: ModuleImportStats[] = []

  const empire = coerceEmpireState(payload.modules[EMPIRE_KEY])
  const flow = coerceFlowState(payload.modules[FLOW_KEY])
  const ship = coerceShipState(payload.modules[SHIP_KEY])

  if (empire) stats.push({ key: EMPIRE_KEY, count: empire.list.length })
  if (flow) stats.push({ key: FLOW_KEY, count: flow.list.length })
  if (ship) stats.push({ key: SHIP_KEY, count: ship.list.length })

  return stats
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

  return {
    format: 'x4-import-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      [EMPIRE_KEY]: deepClone(migratedEmpire),
      [FLOW_KEY]: deepClone(migratedFlow),
      [SHIP_KEY]: deepClone(ship)
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
  const raw = options.payload.modules[EMPIRE_KEY]
  const incomingRaw = coerceEmpireState(raw)
  if (!incomingRaw) return false

  const migratedResult = migrateEmpireState(incomingRaw, options.gameDataStore)
  warnings.push(...migratedResult.warnings)
  const migrated = migratedResult.state
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

  persistModule(EMPIRE_KEY, next)
  options.empireStore.loadData(next)
  options.empireStore.initializeAllStationCaches()
  options.empireStore.saveToStorage()
  return true
}

function applyFlowImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const raw = options.payload.modules[FLOW_KEY]
  const incomingRaw = coerceFlowState(raw)
  if (!incomingRaw) return false

  const migratedResult = migrateFlowState(incomingRaw, options.gameDataStore)
  warnings.push(...migratedResult.warnings)
  const migrated = migratedResult.state
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

  persistModule(FLOW_KEY, next)
  options.logicFlowStore.init()
  return true
}

function applyShipImport(options: ImportApplyOptions, warnings: string[]): boolean {
  const raw = options.payload.modules[SHIP_KEY]
  const incomingRaw = coerceShipState(raw)
  if (!incomingRaw) return false

  const migrated = migrateShipState(incomingRaw)
  const current = deepClone(options.shipBuildStore.savedBlueprints)

  let next: SavedShipBlueprintsState
  let incomingActiveId: string | null = migrated.activeId || null

  if (options.mode === 'overwrite') {
    next = migrated
  } else {
    const remapped = remapShipIds(migrated)
    incomingActiveId = remapped.state.activeId
    next = mergeShipState(current, remapped.state)

    const canUpdate = shouldUpdateActiveIncremental(current.activeId, isShipActiveEmpty(current), options.shipBuildStore.isDirty)
    if (canUpdate && incomingActiveId) {
      next.activeId = incomingActiveId
    } else {
      next.activeId = current.activeId
    }
  }

  if (options.mode === 'overwrite' && !next.activeId && next.list.length > 0) {
    next.activeId = next.list[0]?.id || null
    warnings.push('Ship-build activeId was missing; fallback to first blueprint.')
  }

  persistModule(SHIP_KEY, next)
  options.shipBuildStore.loadBlueprintsFromStorage()
  if (next.activeId && options.currentView === 'ship-build') {
    options.shipBuildStore.loadBlueprint(next.activeId)
  }
  return true
}

export function applyImportPayload(options: ImportApplyOptions): ImportApplyResult {
  const warnings: string[] = []
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

  return { applied, skipped, warnings }
}
