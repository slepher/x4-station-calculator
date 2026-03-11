import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION, CURRENT_SHIP_BLUEPRINT_VERSION } from '../src/store/logic/storageVersions'

const ROOT = process.cwd()
const SEED_DIR = path.join(ROOT, 'tests/seeds')
const FIXTURE_DIR = path.join(ROOT, 'tests/fixtures')
const DB_DIR = path.join(FIXTURE_DIR, 'db')
const DB_PATH = path.join(FIXTURE_DIR, 'db.json')

const DATA_DIR = path.join(ROOT, 'src/assets/x4_game_data/8.0-Diplomacy/data')
const FIXTURE_TIMESTAMP = Number(process.env.DB_FIXTURE_TIMESTAMP ?? 1772453451902)

type SeedEmpire = {
  empires: Array<{
    name: string
    sectors?: Array<{ id: string; name: string; order: number }>
    sectorLinks?: string[]
    stations: Array<{
      name: string
      sectorId?: string
      settings?: Record<string, boolean>
      modules: Array<{ id: string; count: number }>
      lockedWares?: string[]
    }>
  }>
}

type SeedLogicFlow = {
  plans: Array<{
    name: string
    groups: Array<{
      name: string
      category: 'industrial' | 'agricultural'
      subCategory: string
      isLocked: boolean
      lockedLineage: string
      nodes: Array<
        | { moduleId: string; isIsolated: false }
        | { wareId: string; isIsolated: true }
      >
    }>
  }>
}

type X4Ware = {
  id: string
  tier: number
}

type X4Module = {
  id: string
  race: string
  outputs: Record<string, number>
}

type SavedFlowNode = {
  isolated?: string
  module?: string
}

type SavedFlowGroup = {
  id: string
  name: string
  category: 'industrial' | 'agricultural'
  subCategory: string
  isLocked: boolean
  lockedLineage: string
  nodes: SavedFlowNode[]
}

type LogicFlowPlan = {
  id: string
  name: string
  groups: SavedFlowGroup[]
  settings: { isDefaultLocked: boolean }
  lastUpdated: number
}

type SavedFlowPlansState = {
  version: number
  activeId: string | null
  list: LogicFlowPlan[]
}

type SavedModule = { id: string; count: number }

type StationPlan = {
  id: string
  name: string
  sectorId?: string | null
  type: 'industrial' | 'supply' | 'transit' | 'shipyard'
  count: number
  modules: SavedModule[]
  settings: StationSettings
  lastUpdated: number
  lockedWares: string[]
  warePriority: Record<string, number>
}

type SectorPlan = {
  id: string
  name: string
  order: number
}

type EmpirePlan = {
  id: string
  name: string
  sectors?: SectorPlan[]
  sectorLinks?: string[]
  stations: StationPlan[]
}

type SavedEmpiresState = {
  version: number
  activeId: string | null
  activeStationId: string | null
  list: EmpirePlan[]
}

// ============ Ship Blueprint Seed Types ============
type SeedShipBuildShip = {
  id: string
  name: string
  class: string
  type: string
  race: string
  blueprint: SeedShipBuildBlueprint | null
}

type SeedShipBuildBlueprintGroup = {
  group: string
  equipment_id: string
  count?: number
  shield?: {
    equipment_id: string
    count?: number
  }
}

type SeedShipBuildBlueprintConnectionByGroup = {
  slot_type: string
  group: SeedShipBuildBlueprintGroup[]
}

type SeedShipBuildBlueprintConnectionBySize = {
  slot_type: string
  size: Array<{
    size: string
    equipment_id: string
    shield?: {
      equipment_id: string
    }
  }>
}

type SeedShipBuildBlueprintConnectionBySlot = {
  slot_type: string
  equipment_id: string
  shield?: {
    equipment_id: string
  }
}

type SeedShipBuildBlueprintConnection =
  | SeedShipBuildBlueprintConnectionByGroup
  | SeedShipBuildBlueprintConnectionBySize
  | SeedShipBuildBlueprintConnectionBySlot

type SeedShipBuildBlueprint = {
  shipId: string
  connections: SeedShipBuildBlueprintConnection[]
}

type SeedShipBuild = {
  ships: SeedShipBuildShip[]
}

type ShipBlueprint = {
  id: string
  name: string
  shipId: string
  connections: ResolvedShipBuildBlueprintConnection[]
  lastUpdated: number
}

type ResolvedShipBuildBlueprintGroup = {
  group: string
  equipment_id: string
  count: number
  shield?: {
    equipment_id: string
    count: number
  }
}

type ResolvedShipBuildBlueprintConnection = {
  slot_type: string
  group: ResolvedShipBuildBlueprintGroup[]
}

type SavedShipBlueprintsState = {
  version: number
  activeId: string | null
  list: ShipBlueprint[]
}

type X4ShipConnection = {
  size?: string
  count: number
  shield?: {
    size?: string
    count: number
  }
}

type X4ShipSlotGroup = {
  group: string
  connection: X4ShipConnection
}

type X4ShipSlot = {
  type: string
  groups: X4ShipSlotGroup[]
}

type X4Ship = {
  id: string
  slots: X4ShipSlot[]
}

type StationSettings = {
  sunlight: number
  useHQ: boolean
  manualWorkforce: number
  workforcePercent: number
  workforceAuto: boolean
  considerWorkforceForAutoFill: boolean
  supplyWorkforceBonus?: boolean
  buyMultiplier: number
  sellMultiplier: number
  minersEnabled: boolean
  internalSupply: boolean
  showEmpireGaps?: boolean
  racePreference: string
  resourceBufferHours: number
  primaryProductBufferHours: number
  secondaryProductBufferHours: number
  transportShipCapacity: number
}

const DEFAULT_STATION_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: false,
  internalSupply: false,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1.0,
  primaryProductBufferHours: 12.0,
  secondaryProductBufferHours: 2.0,
  transportShipCapacity: 62000
}

const loadJson = async <T,>(file: string): Promise<T> => {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw) as T
}

const loadYaml = async <T,>(file: string): Promise<T> => {
  const raw = await readFile(file, 'utf8')
  return parse(raw) as T
}

const isEmpireSeed = (seed: any): seed is SeedEmpire => Boolean(seed?.empires)
const isLogicFlowSeed = (seed: any): seed is SeedLogicFlow => Boolean(seed?.plans)
const isShipBlueprintSeed = (seed: any): seed is SeedShipBuild => Boolean(seed?.ships)

const pickPrimaryOutput = (module: X4Module): string => {
  const keys = Object.keys(module.outputs ?? {})
  if (keys.length === 0) {
    throw new Error(`Module ${module.id} has no outputs.`)
  }
  return keys[0]
}

const stableId = (...parts: string[]): string => {
  const hex = createHash('sha1').update(parts.join('::')).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const buildLogicFlowState = (
  seed: SeedLogicFlow,
  now: number
): SavedFlowPlansState => {
  const plans: LogicFlowPlan[] = seed.plans.map((plan, planIndex) => {
    const groups: SavedFlowGroup[] = plan.groups.map((group, groupIndex) => {
      const nodes: SavedFlowNode[] = group.nodes.map((node) => {
        if ('wareId' in node) {
          return { isolated: node.wareId }
        }
        return { module: node.moduleId }
      })

      return {
        id: `lf-${planIndex + 1}-g${groupIndex + 1}`,
        name: group.name,
        category: group.category,
        subCategory: group.subCategory,
        isLocked: group.isLocked,
        lockedLineage: group.lockedLineage,
        nodes
      }
    })

    return {
      id: `logic-flow-${planIndex + 1}`,
      name: plan.name,
      groups,
      settings: { isDefaultLocked: true },
      lastUpdated: now
    }
  })

  return {
    version: CURRENT_FLOW_VERSION,
    activeId: plans[0]?.id ?? null,
    list: plans
  }
}

const buildEmpireState = (seed: SeedEmpire, now: number): SavedEmpiresState => {
  const empires: EmpirePlan[] = seed.empires.map((empire, empireIndex) => {
    const stations: StationPlan[] = empire.stations.map((station, stationIndex) => {
      const settings = { ...DEFAULT_STATION_SETTINGS, ...(station.settings || {}) }
      return {
        id: `empire-${empireIndex + 1}-station-${stationIndex + 1}`,
        name: station.name,
        sectorId: station.sectorId || null,
        type: 'industrial',
        count: 1,
        modules: station.modules.map((mod) => ({ id: mod.id, count: mod.count })),
        settings,
        lastUpdated: now,
        lockedWares: station.lockedWares || [],
        warePriority: {}
      }
    })

    const result: EmpirePlan = {
      id: `empire-${empireIndex + 1}`,
      name: empire.name,
      stations
    }

    if (empire.sectors && empire.sectors.length > 0) {
      result.sectors = empire.sectors
    }
    if (empire.sectorLinks && empire.sectorLinks.length > 0) {
      result.sectorLinks = empire.sectorLinks
    }

    return result
  })

  return {
    version: CURRENT_EMPIRE_VERSION,
    activeId: empires[0]?.id ?? null,
    activeStationId: empires[0]?.stations[0]?.id ?? null,
    list: empires
  }
}

const buildShipSlotCountMap = (ships: X4Ship[]): Map<string, X4ShipConnection> => {
  const m = new Map<string, X4ShipConnection>()
  for (const ship of ships) {
    for (const slot of ship.slots || []) {
      for (const g of slot.groups || []) {
        m.set(`${ship.id}::${slot.type}::${g.group}`, g.connection)
      }
    }
  }
  return m
}

const buildShipSlotGroupsMap = (ships: X4Ship[]): Map<string, X4ShipSlotGroup[]> => {
  const m = new Map<string, X4ShipSlotGroup[]>()
  for (const ship of ships) {
    for (const slot of ship.slots || []) {
      m.set(`${ship.id}::${slot.type}`, slot.groups || [])
    }
  }
  return m
}

const injectShipConnectionCounts = (
  shipId: string,
  connections: SeedShipBuildBlueprintConnection[],
  slotCountMap: Map<string, X4ShipConnection>,
  slotGroupsMap: Map<string, X4ShipSlotGroup[]>
): ResolvedShipBuildBlueprintConnection[] => {
  return connections.map((connection) => {
    if ('group' in connection) {
      return {
        slot_type: connection.slot_type,
        group: connection.group.map((group) => {
          const key = `${shipId}::${connection.slot_type}::${group.group}`
          const slotConnection = slotCountMap.get(key)
          if (!slotConnection) {
            throw new Error(`Missing ship slot connection for ${key}`)
          }

          const resolved: ResolvedShipBuildBlueprintGroup = {
            group: group.group,
            equipment_id: group.equipment_id,
            count: slotConnection.count
          }

          if (group.shield) {
            if (!slotConnection.shield) {
              throw new Error(`Missing shield slot connection for ${key}`)
            }
            resolved.shield = {
              equipment_id: group.shield.equipment_id,
              count: slotConnection.shield.count
            }
          }
          return resolved
        })
      }
    }

    if ('size' in connection) {
      const slotKey = `${shipId}::${connection.slot_type}`
      const slotGroups = slotGroupsMap.get(slotKey)
      if (!slotGroups || slotGroups.length === 0) {
        throw new Error(`Missing ship slot groups for ${slotKey}`)
      }

      const resolvedGroups: ResolvedShipBuildBlueprintGroup[] = []
      for (const sizeRow of connection.size) {
        const matched = slotGroups.filter(
          (slotGroup) => slotGroup.connection.size === sizeRow.size
        )
        if (matched.length === 0) {
          throw new Error(`No slot groups matched size ${sizeRow.size} for ${slotKey}`)
        }

        for (const slotGroup of matched) {
          const resolved: ResolvedShipBuildBlueprintGroup = {
            group: slotGroup.group,
            equipment_id: sizeRow.equipment_id,
            count: slotGroup.connection.count
          }

          if (sizeRow.shield) {
            if (!slotGroup.connection.shield) {
              throw new Error(`Missing shield slot connection for ${slotKey}::${slotGroup.group}`)
            }
            resolved.shield = {
              equipment_id: sizeRow.shield.equipment_id,
              count: slotGroup.connection.shield.count
            }
          }

          resolvedGroups.push(resolved)
        }
      }

      return {
        slot_type: connection.slot_type,
        group: resolvedGroups
      }
    }

    const slotKey = `${shipId}::${connection.slot_type}`
    const slotGroups = slotGroupsMap.get(slotKey)
    if (!slotGroups || slotGroups.length === 0) {
      throw new Error(`Missing ship slot groups for ${slotKey}`)
    }

    return {
      slot_type: connection.slot_type,
      group: slotGroups.map((slotGroup) => {
        const resolved: ResolvedShipBuildBlueprintGroup = {
          group: slotGroup.group,
          equipment_id: connection.equipment_id,
          count: slotGroup.connection.count
        }

        if (connection.shield) {
          if (!slotGroup.connection.shield) {
            throw new Error(`Missing shield slot connection for ${slotKey}::${slotGroup.group}`)
          }
          resolved.shield = {
            equipment_id: connection.shield.equipment_id,
            count: slotGroup.connection.shield.count
          }
        }

        return resolved
      })
    }
  })
}

const buildShipBlueprintState = (
  seed: SeedShipBuild,
  ships: X4Ship[],
  now: number
): SavedShipBlueprintsState => {
  const slotCountMap = buildShipSlotCountMap(ships)
  const slotGroupsMap = buildShipSlotGroupsMap(ships)
  const list: ShipBlueprint[] = seed.ships
    .filter((ship) => ship.blueprint)
    .map((ship, index) => ({
      id: stableId('x4_ship_blueprints', ship.id, ship.name, String(index)),
      name: ship.name,
      shipId: ship.id,
      connections: injectShipConnectionCounts(
        ship.blueprint!.shipId,
        ship.blueprint!.connections,
        slotCountMap,
        slotGroupsMap
      ),
      lastUpdated: now
    }))

  const shipsBuckets = Array.from(
    list.reduce((map, blueprint) => {
      const bucket = map.get(blueprint.shipId) || []
      bucket.push(blueprint)
      map.set(blueprint.shipId, bucket)
      return map
    }, new Map<string, ShipBlueprint[]>()).entries()
  ).map(([shipId, blueprints]) => ({ shipId, blueprints }))

  const activeBlueprint = list[0] || null
  return {
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: activeBlueprint?.shipId ?? null,
    activeBlueprintId: activeBlueprint?.id ?? null,
    ships: shipsBuckets
  }
}

const readCurrentVsn = async (): Promise<number | null> => {
  try {
    const raw = await readFile(DB_PATH, 'utf8')
    const data = JSON.parse(raw) as { vsn?: number }
    return typeof data.vsn === 'number' ? data.vsn : null
  } catch {
    return null
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const bump = args.includes('--bump')

  const seedFiles = (await readdir(SEED_DIR)).filter((f) => f.endsWith('.yaml'))

  const wares = await loadJson<X4Ware[]>(path.join(DATA_DIR, 'wares.json'))
  const modules = await loadJson<X4Module[]>(path.join(DATA_DIR, 'modules.json'))
  const ships = await loadJson<X4Ship[]>(path.join(DATA_DIR, 'ships.json'))
  const wareMap = new Map(wares.map((ware) => [ware.id, ware]))
  const moduleMap = new Map(modules.map((module) => [module.id, module]))

  const dbPayload: Record<string, any> = {}
  const now = FIXTURE_TIMESTAMP

  for (const seedFile of seedFiles) {
    const seedPath = path.join(SEED_DIR, seedFile)
    const seed = await loadYaml<any>(seedPath)
    if (isLogicFlowSeed(seed)) {
      dbPayload.x4_logic_flow_plans = buildLogicFlowState(seed, now)
      continue
    }
    if (isEmpireSeed(seed)) {
      dbPayload.x4_empire_data = buildEmpireState(seed, now)
      continue
    }
    if (isShipBlueprintSeed(seed)) {
      dbPayload.x4_ship_blueprints = buildShipBlueprintState(seed, ships, now)
    }
  }

  const currentVsn = await readCurrentVsn()
  const nextVsn = currentVsn !== null ? currentVsn + 1 : 1
  const finalVsn = bump ? nextVsn : currentVsn ?? 1

  if (bump && currentVsn !== null) {
    await mkdir(DB_DIR, { recursive: true })
    await rename(DB_PATH, path.join(DB_DIR, `db-${currentVsn}.json`))
  }

  const output = { vsn: finalVsn, ...dbPayload }
  await mkdir(FIXTURE_DIR, { recursive: true })
  await writeFile(DB_PATH, JSON.stringify(output, null, 2), 'utf8')
  console.log(JSON.stringify(output, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
