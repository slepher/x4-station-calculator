import type {
  EmpirePlan,
  SectorPlan,
  LogicFlowPlan,
  SavedEmpiresState,
  SavedFlowGroup,
  SavedFlowNode,
  SavedFlowPlansState,
  SavedShipBlueprintsState,
  ShipBlueprintBucket,
  SavedModule,
  ShipBlueprint,
  StationPlan,
  V1StorageState,
  X4Module
} from '@/types/x4'
import { resolveModuleId } from './blueprintParser'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION, CURRENT_SHIP_BLUEPRINT_VERSION } from './storageVersions'

type ModuleLookup = {
  modulesMap: Record<string, X4Module>
  modulesByMacroId?: Record<string, X4Module>
}

type MigrationResult<T> = {
  state: T
  warnings: string[]
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolveModuleOrWarn(
  rawId: string | undefined,
  lookup: ModuleLookup,
  warnings: string[],
  context: string
): string | null {
  if (!rawId) return null
  const resolved = resolveModuleId(rawId, lookup.modulesMap, lookup.modulesByMacroId)
  if (resolved) return resolved
  warnings.push(`[${context}] unresolved module id: ${rawId}`)
  return null
}

function normalizeStationModules(
  modules: unknown,
  lookup: ModuleLookup,
  warnings: string[],
  context: string
): SavedModule[] {
  if (!Array.isArray(modules)) return []
  const merged = new Map<string, number>()

  modules.forEach((entry, index) => {
    if (!isObject(entry)) return
    const rawId = typeof entry.id === 'string' ? entry.id : ''
    const count = Math.max(0, Number(entry.count || 0))
    if (!rawId || count <= 0) return
    const resolved = resolveModuleOrWarn(rawId, lookup, warnings, `${context}.modules[${index}]`)
    if (!resolved) return
    merged.set(resolved, (merged.get(resolved) || 0) + count)
  })

  return Array.from(merged.entries()).map(([id, count]) => ({ id, count }))
}

function toStationPlan(raw: unknown, index: number): StationPlan {
  const station = isObject(raw) ? raw : {}
  const settings = isObject(station.settings) ? station.settings : {}
  return {
    id: typeof station.id === 'string' && station.id ? station.id : crypto.randomUUID(),
    name: typeof station.name === 'string' && station.name ? station.name : `Station ${index + 1}`,
    sectorId: typeof station.sectorId === 'string' ? station.sectorId : null,
    type: typeof station.type === 'string' && station.type ? station.type as StationPlan['type'] : 'industrial',
    count: Number(station.count ?? 1) || 1,
    modules: Array.isArray(station.modules) ? deepClone(station.modules) : [],
    settings: settings as unknown as StationPlan['settings'],
    lastUpdated: Number(station.lastUpdated) || Date.now(),
    lockedWares: Array.isArray(station.lockedWares) ? deepClone(station.lockedWares) : [],
    warePriority: isObject(station.warePriority) ? deepClone(station.warePriority) as Record<string, number> : {}
  }
}

function defaultSector(index: number = 0): SectorPlan {
  return {
    id: crypto.randomUUID(),
    name: `Sector ${index + 1}`,
    order: index
  }
}

function migrateLegacyV1ToV2(raw: V1StorageState): SavedEmpiresState {
  const stations = Array.isArray(raw.list) ? raw.list : []
  const list: EmpirePlan[] = stations.map((plan, index) => ({
    id: crypto.randomUUID(),
    name: typeof plan.name === 'string' && plan.name ? plan.name : `Empire ${index + 1}`,
    sectors: [defaultSector(0)],
    stations: [{ ...toStationPlan(plan, 0), sectorId: null }]
  }))

  return {
    version: 2,
    activeId: list[0]?.id || null,
    activeStationId: list[0]?.stations[0]?.id || null,
    list
  }
}

function normalizeEmpireStateShape(raw: SavedEmpiresState, warnings?: string[]): SavedEmpiresState {
  const list = (raw.list || []).map((empire, empireIndex) => {
    const sectorsRaw = Array.isArray((empire as EmpirePlan).sectors) ? (empire as EmpirePlan).sectors || [] : []
    if (sectorsRaw.length === 0) {
      warnings?.push(`[empire] empire[${empireIndex}] missing sectors; default sector was created`)
    }
    const sectors = (sectorsRaw.length > 0 ? sectorsRaw : [defaultSector(0)]).map((sector, sectorIndex) => ({
      id: sector?.id || crypto.randomUUID(),
      name: sector?.name || `Sector ${sectorIndex + 1}`,
      order: Number.isFinite(Number(sector?.order)) ? Number(sector.order) : sectorIndex
    }))
    sectors.sort((a, b) => a.order - b.order)
    sectors.forEach((sector, idx) => { sector.order = idx })
    const validSectorIdSet = new Set(sectors.map(s => s.id))

    const stations = (empire.stations || []).map((station, stationIndex) => {
      const normalized = toStationPlan(station, stationIndex)
      if (!normalized.sectorId || !validSectorIdSet.has(normalized.sectorId)) {
        if (normalized.sectorId) {
          warnings?.push(`[empire] empire[${empireIndex}].station[${stationIndex}] invalid sectorId; reset to unassigned`)
        }
        normalized.sectorId = null
      }
      return normalized
    })

    return {
      id: empire.id || crypto.randomUUID(),
      name: empire.name || `Empire ${empireIndex + 1}`,
      sectors,
      stations
    }
  })

  let activeId = raw.activeId || null
  if (activeId && !list.some((empire) => empire.id === activeId)) {
    activeId = list[0]?.id || null
  }

  let activeStationId = raw.activeStationId || null
  if (activeStationId && !list.some((empire) => (empire.stations || []).some((station) => station.id === activeStationId))) {
    const activeEmpire = list.find((empire) => empire.id === activeId) || list[0]
    activeStationId = activeEmpire?.stations?.[0]?.id || null
  }

  return {
    version: raw.version,
    activeId,
    activeStationId,
    list
  }
}

export function migrateEmpireStateToCurrent(
  input: SavedEmpiresState | V1StorageState,
  lookup: ModuleLookup
): MigrationResult<SavedEmpiresState> {
  const warnings: string[] = []

  let working: SavedEmpiresState
  if ((input as V1StorageState).version === 1) {
    const maybeV1 = input as V1StorageState
    const first = Array.isArray(maybeV1.list) ? maybeV1.list[0] : null
    if (first && isObject(first) && !Array.isArray((first as Record<string, unknown>).stations)) {
      working = migrateLegacyV1ToV2(maybeV1)
    } else {
      working = {
        version: 2,
        activeId: (input as SavedEmpiresState).activeId || null,
        activeStationId: (input as SavedEmpiresState).activeStationId || null,
        list: deepClone((input as SavedEmpiresState).list || [])
      }
    }
  } else {
    const inState = input as SavedEmpiresState
    working = {
      version: typeof inState.version === 'number' ? inState.version : 2,
      activeId: inState.activeId || null,
      activeStationId: inState.activeStationId || null,
      list: deepClone(inState.list || [])
    }
  }

  if (working.version > CURRENT_EMPIRE_VERSION) {
    warnings.push(`[empire] input version ${working.version} is newer than supported ${CURRENT_EMPIRE_VERSION}; fallback to best-effort migration`)
  }

  working = normalizeEmpireStateShape(working, warnings)

  const needModuleNormalization = working.version <= 2 || working.version > CURRENT_EMPIRE_VERSION
  if (needModuleNormalization) {
    working.list = working.list.map((empire, empireIndex) => ({
      ...empire,
      stations: (empire.stations || []).map((station, stationIndex) => ({
        ...station,
        modules: normalizeStationModules(
          station.modules,
          lookup,
          warnings,
          `empire[${empireIndex}].station[${stationIndex}]`
        )
      }))
    }))
  }

  working.version = CURRENT_EMPIRE_VERSION
  return { state: working, warnings }
}

function normalizeFlowShape(input: SavedFlowPlansState): SavedFlowPlansState {
  const list: LogicFlowPlan[] = (input.list || []).map((plan, planIndex) => ({
    id: plan.id || crypto.randomUUID(),
    name: plan.name || `Logic Flow ${planIndex + 1}`,
    groups: (plan.groups || []).map((group, groupIndex) => ({
      id: group.id || crypto.randomUUID(),
      name: group.name || `Group ${groupIndex + 1}`,
      category: group.category || 'industrial',
      subCategory: group.subCategory || 'default',
      isLocked: Boolean(group.isLocked),
      lockedLineage: group.lockedLineage || 'default',
      nodes: (group.nodes || []).map((node, nodeIndex) => ({
        id: node.id || crypto.randomUUID(),
        wareId: node.wareId || '',
        moduleId: node.moduleId,
        race: node.race || 'default',
        lineage: node.lineage || 'default',
        column: Number(node.column ?? 0),
        isIsolated: Boolean(node.isIsolated),
        source: 'manual',
        isRoot: Boolean(node.isRoot),
        order: Number(node.order ?? nodeIndex)
      }))
    })),
    settings: {
      isDefaultLocked: Boolean(plan.settings?.isDefaultLocked ?? true)
    },
    lastUpdated: Number(plan.lastUpdated) || Date.now()
  }))

  const activeId = input.activeId && list.some((plan) => plan.id === input.activeId)
    ? input.activeId
    : list[0]?.id || null

  return {
    version: input.version,
    activeId,
    list
  }
}

export function migrateFlowStateToCurrent(
  input: SavedFlowPlansState,
  lookup: ModuleLookup
): MigrationResult<SavedFlowPlansState> {
  const warnings: string[] = []
  const working = normalizeFlowShape(deepClone(input))

  if (working.version > CURRENT_FLOW_VERSION) {
    warnings.push(`[flow] input version ${working.version} is newer than supported ${CURRENT_FLOW_VERSION}; fallback to best-effort migration`)
  }

  const needModuleNormalization = working.version <= 1 || working.version > CURRENT_FLOW_VERSION
  if (needModuleNormalization) {
    working.list = working.list.map((plan, planIndex) => ({
      ...plan,
      groups: (plan.groups || []).map((group: SavedFlowGroup, groupIndex) => ({
        ...group,
        nodes: (group.nodes || []).map((node: SavedFlowNode, nodeIndex) => {
          if (!node.moduleId) return node
          const resolved = resolveModuleOrWarn(
            node.moduleId,
            lookup,
            warnings,
            `flow[${planIndex}].group[${groupIndex}].node[${nodeIndex}]`
          )
          return {
            ...node,
            moduleId: resolved || undefined
          }
        })
      }))
    }))
  }

  working.version = CURRENT_FLOW_VERSION
  return { state: working, warnings }
}

function normalizeShipBlueprintShape(input: SavedShipBlueprintsState & { list?: unknown[] }): MigrationResult<SavedShipBlueprintsState> {
  const warnings: string[] = []
  const normalizeBlueprintList = (rawList: unknown[], context: string, forcedShipId?: string): ShipBlueprint[] => rawList.map((item, index) => {
    const blueprint: Record<string, unknown> = isObject(item) ? item : {}
    const shipId = forcedShipId || (typeof blueprint.shipId === 'string' ? blueprint.shipId : '')
    const storage = isObject(blueprint.storage)
      ? (deepClone(blueprint.storage) as unknown as ShipBlueprint['storage'])
      : undefined
    const hull = isObject(blueprint.hull)
      ? (deepClone(blueprint.hull) as unknown as ShipBlueprint['hull'])
      : undefined
    return {
      id: typeof blueprint.id === 'string' && blueprint.id ? blueprint.id : crypto.randomUUID(),
      name: typeof blueprint.name === 'string' ? blueprint.name : '',
      shipId,
      connections: Array.isArray(blueprint.connections) ? deepClone(blueprint.connections) : [],
      storage,
      hull,
      lastUpdated: Number(blueprint.lastUpdated) || Date.now() + index
    }
  }).filter((blueprint) => {
    if (blueprint.shipId) return true
    warnings.push(`[${context}] dropped blueprint without shipId: ${blueprint.id}`)
    return false
  })

  const raw = input as unknown as Record<string, unknown>
  const legacyList = Array.isArray(raw.list) ? raw.list : []
  const rawShips = Array.isArray(raw.ships) ? raw.ships : []

  let ships: ShipBlueprintBucket[]
  if (rawShips.length > 0) {
    ships = rawShips
      .map((bucket, bucketIndex) => {
        if (!isObject(bucket)) return null
        const shipId = typeof bucket.shipId === 'string' ? bucket.shipId : ''
        if (!shipId) {
          warnings.push(`[ship-blueprint] dropped bucket without shipId at index ${bucketIndex}`)
          return null
        }
        const blueprintsRaw = Array.isArray(bucket.blueprints) ? bucket.blueprints : []
        const blueprints = normalizeBlueprintList(blueprintsRaw, `ship-blueprint.bucket[${bucketIndex}]`, shipId)
        return { shipId, blueprints }
      })
      .filter((bucket): bucket is ShipBlueprintBucket => Boolean(bucket))
      .filter((bucket) => bucket.blueprints.length > 0)
  } else {
    const list = normalizeBlueprintList(legacyList, 'ship-blueprint.legacy')
    const buckets = new Map<string, ShipBlueprint[]>()
    list.forEach((blueprint) => {
      const bucket = buckets.get(blueprint.shipId) || []
      bucket.push(blueprint)
      buckets.set(blueprint.shipId, bucket)
    })
    ships = Array.from(buckets.entries()).map(([shipId, blueprints]) => ({ shipId, blueprints }))
  }

  const activeBlueprintIdRaw = typeof raw.activeBlueprintId === 'string'
    ? raw.activeBlueprintId
    : (typeof raw.activeId === 'string' ? raw.activeId : null)

  const flattened = ships.flatMap((bucket) => bucket.blueprints)
  const activeBlueprint = activeBlueprintIdRaw
    ? flattened.find((item) => item.id === activeBlueprintIdRaw) || null
    : null
  const fallbackBlueprint = flattened[0] || null
  const activeBlueprintId = activeBlueprint?.id || fallbackBlueprint?.id || null

  const activeShipIdRaw = typeof raw.activeShipId === 'string' ? raw.activeShipId : null
  const activeShipId = activeBlueprint?.shipId
    || (activeShipIdRaw && ships.some((bucket) => bucket.shipId === activeShipIdRaw) ? activeShipIdRaw : null)
    || fallbackBlueprint?.shipId
    || ships[0]?.shipId
    || null

  return {
    state: {
      version: input.version,
      activeShipId,
      activeBlueprintId,
      ships
    },
    warnings
  }
}

export function migrateShipBlueprintStateToCurrent(
  input: unknown
): MigrationResult<SavedShipBlueprintsState> {
  let warnings: string[] = []
  const raw = isObject(input) ? input : {}
  const version = typeof raw.version === 'number' ? raw.version : 1
  const activeBlueprintId = typeof raw.activeBlueprintId === 'string'
    ? raw.activeBlueprintId
    : (typeof raw.activeId === 'string' ? raw.activeId : null)
  const activeShipId = typeof raw.activeShipId === 'string' ? raw.activeShipId : null
  const list = Array.isArray(raw.list) ? deepClone(raw.list) : []
  const ships = Array.isArray(raw.ships) ? deepClone(raw.ships) : []

  const normalized = normalizeShipBlueprintShape({
    version,
    activeShipId,
    activeBlueprintId,
    ships,
    list
  })
  const working = normalized.state
  warnings = warnings.concat(normalized.warnings)

  if (working.version > CURRENT_SHIP_BLUEPRINT_VERSION) {
    warnings.push(
      `[ship-blueprint] input version ${working.version} is newer than supported ${CURRENT_SHIP_BLUEPRINT_VERSION}; fallback to best-effort migration`
    )
  }

  working.version = CURRENT_SHIP_BLUEPRINT_VERSION
  return { state: working, warnings }
}
