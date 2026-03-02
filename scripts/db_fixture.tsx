import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'

const ROOT = process.cwd()
const SEED_DIR = path.join(ROOT, 'tests/seeds')
const FIXTURE_DIR = path.join(ROOT, 'tests/fixtures')
const DB_DIR = path.join(FIXTURE_DIR, 'db')
const DB_PATH = path.join(FIXTURE_DIR, 'db.json')

const DATA_DIR = path.join(ROOT, 'src/assets/x4_game_data/8.0-Diplomacy/data')

type SeedEmpire = {
  empires: Array<{
    name: string
    stations: Array<{
      name: string
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
  id: string
  wareId: string
  moduleId?: string
  race: string
  lineage: string
  column: number
  isIsolated: boolean
  source: 'manual'
  isRoot: boolean
  order: number
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
  version: 1
  activeId: string | null
  list: LogicFlowPlan[]
}

type SavedModule = { id: string; count: number }

type StationPlan = {
  id: string
  name: string
  type: 'industrial' | 'supply' | 'transit' | 'shipyard'
  count: number
  modules: SavedModule[]
  settings: StationSettings
  lastUpdated: number
  lockedWares: string[]
  warePriority: Record<string, number>
}

type EmpirePlan = {
  id: string
  name: string
  stations: StationPlan[]
}

type SavedEmpiresState = {
  version: number
  activeId: string | null
  activeStationId: string | null
  list: EmpirePlan[]
}

// ============ Ship Build Types ============
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
  count: number
  shield?: {
    equipment_id: string
    count: number
  }
}

type SeedShipBuildBlueprintConnection = {
  slot_type: string
  group: SeedShipBuildBlueprintGroup[]
}

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
  connections: SeedShipBuildBlueprintConnection[]
  lastUpdated: number
}

type SavedShipBlueprintsState = {
  version: 1
  activeId: string | null
  list: ShipBlueprint[]
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
const isShipBuildSeed = (seed: any): seed is SeedShipBuild => Boolean(seed?.ships)

const pickPrimaryOutput = (module: X4Module): string => {
  const keys = Object.keys(module.outputs ?? {})
  if (keys.length === 0) {
    throw new Error(`Module ${module.id} has no outputs.`)
  }
  return keys[0]
}

const buildLogicFlowState = (
  seed: SeedLogicFlow,
  wares: Map<string, X4Ware>,
  modules: Map<string, X4Module>
): SavedFlowPlansState => {
  const now = Date.now()
  const plans: LogicFlowPlan[] = seed.plans.map((plan, planIndex) => {
    const groups: SavedFlowGroup[] = plan.groups.map((group, groupIndex) => {
      const nodes: SavedFlowNode[] = []
      let order = 0
      group.nodes.forEach((node) => {
        if ('wareId' in node) {
          const ware = wares.get(node.wareId)
          if (!ware) throw new Error(`Missing ware ${node.wareId}`)
          nodes.push({
            id: `lf-${planIndex + 1}-g${groupIndex + 1}-i${order + 1}`,
            wareId: node.wareId,
            race: 'default',
            lineage: 'default',
            column: ware.tier,
            isIsolated: true,
            source: 'manual',
            isRoot: false,
            order
          })
          order += 1
          return
        }

        const module = modules.get(node.moduleId)
        if (!module) throw new Error(`Missing module ${node.moduleId}`)
        const wareId = pickPrimaryOutput(module)
        const ware = wares.get(wareId)
        if (!ware) throw new Error(`Missing ware ${wareId}`)

        nodes.push({
          id: `lf-${planIndex + 1}-g${groupIndex + 1}-m${order + 1}`,
          wareId,
          moduleId: module.id,
          race: module.race,
          lineage: group.subCategory,
          column: ware.tier,
          isIsolated: false,
          source: 'manual',
          isRoot: true,
          order
        })
        order += 1
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
    version: 1,
    activeId: plans[0]?.id ?? null,
    list: plans
  }
}

const buildEmpireState = (seed: SeedEmpire): SavedEmpiresState => {
  const now = Date.now()
  const empires: EmpirePlan[] = seed.empires.map((empire, empireIndex) => {
    const stations: StationPlan[] = empire.stations.map((station, stationIndex) => {
      const settings = { ...DEFAULT_STATION_SETTINGS, ...(station.settings || {}) }
      return {
        id: `empire-${empireIndex + 1}-station-${stationIndex + 1}`,
        name: station.name,
        type: 'industrial',
        count: 1,
        modules: station.modules.map((mod) => ({ id: mod.id, count: mod.count })),
        settings,
        lastUpdated: now,
        lockedWares: station.lockedWares || [],
        warePriority: {}
      }
    })

    return {
      id: `empire-${empireIndex + 1}`,
      name: empire.name,
      stations
    }
  })

  return {
    version: 2,
    activeId: empires[0]?.id ?? null,
    activeStationId: empires[0]?.stations[0]?.id ?? null,
    list: empires
  }
}

const buildShipBuildState = (seed: SeedShipBuild): SavedShipBlueprintsState => {
  const now = Date.now()
  const list: ShipBlueprint[] = seed.ships
    .filter((ship) => ship.blueprint)
    .map((ship) => ({
      id: crypto.randomUUID(),
      name: ship.name,
      shipId: ship.id,
      connections: ship.blueprint!.connections,
      lastUpdated: now
    }))

  return {
    version: 1,
    activeId: list[0]?.id ?? null,
    list
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
  const wareMap = new Map(wares.map((ware) => [ware.id, ware]))
  const moduleMap = new Map(modules.map((module) => [module.id, module]))

  const dbPayload: Record<string, any> = {}

  for (const seedFile of seedFiles) {
    const seedPath = path.join(SEED_DIR, seedFile)
    const seed = await loadYaml<any>(seedPath)
    if (isLogicFlowSeed(seed)) {
      dbPayload.x4_logic_flow_plans = buildLogicFlowState(seed, wareMap, moduleMap)
      continue
    }
    if (isEmpireSeed(seed)) {
      dbPayload.x4_empire_data = buildEmpireState(seed)
      continue
    }
    if (isShipBuildSeed(seed)) {
      dbPayload.x4_ship_blueprints = buildShipBuildState(seed)
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
