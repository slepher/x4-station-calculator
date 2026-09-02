import type {
  X4Consumable,
  X4Drone,
  X4Equipment,
  X4EquipmentType,
  X4Missile,
  X4Module,
  X4ModuleGroup,
  X4Ship,
  X4ShipRace,
  X4SlotTag,
  X4ShipType,
  X4Ware,
  WorkforceConsumptionMap,
  X4Bullet,
  X4Map,
  X4MapResources,
  SectorReachability,
  X4RegionYield,
  X4Faction,
  X4Language,
  X4Dlc,
  X4DefaultMax,
  X4ShipSlot,
  X4Res,
  X4ResearchData,
  BlueprintsData,
  X4MapHighwayRing,
  X4MapHighwayRingChain,
  X4MapHighwayRingChainHop
} from '../../types/x4'
import type { TerraformingData } from './terraformingTaskResolver'

export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }
export type LocalizedX4Ware = X4Ware & { localeName: string }
export type LocalizedX4Ship = X4Ship & { localeName: string }
export type ShipBuildDatas = {
  shipMap: Map<string, X4Ship>
  shipByMacroMap: Map<string, X4Ship>
  raceMap: Map<string, X4ShipRace>
  typeMap: Map<string, X4ShipType>
  equipmentMap: Map<string, X4Equipment>
  shipTypes: X4ShipType[]
  shipRaces: X4ShipRace[]
}
export type ShipBuildRawData = {
  ships: X4Ship[]
  races: X4ShipRace[]
  types: X4ShipType[]
  equipments: X4Equipment[]
  equipmentTypes: X4EquipmentType[]
  slotTags: X4SlotTag[]
  wares: X4Ware[]
}
export type ConsumableDatas = {
  consumables: X4Consumable[]
  drones: X4Drone[]
  missiles: X4Missile[]
  consumablesMap: Map<string, X4Consumable>
  dronesMap: Map<string, X4Drone>
  missilesMap: Map<string, X4Missile>
}

export type GameDataFiles = {
  wares: X4Ware[]
  modules: X4Module[]
  moduleGroups: X4ModuleGroup[]
  consumption: WorkforceConsumptionMap
  ships: X4Ship[]
  shipRaces: X4ShipRace[]
  shipTypes: X4ShipType[]
  equipments: X4Equipment[]
  equipmentTypes: X4EquipmentType[]
  slotTags: X4SlotTag[]
  consumables: X4Consumable[]
  drones: X4Drone[]
  missiles: X4Missile[]
  bullets: X4Bullet[]
  maps: X4Map
  sectorReachability: SectorReachability
  mapResources: X4MapResources
  regionyields: X4RegionYield[]
  res: X4Res[]
  factions: X4Faction[]
  defaultMaxes: Record<string, X4DefaultMax>
  shipSlots: Record<string, X4ShipSlot[]>
  languages: X4Language[]
  dlcs: X4Dlc[]
  terraforming: TerraformingData
  research: X4ResearchData
  blueprints: BlueprintsData
}

type JsonModule<T = unknown> = { default: T }
type JsonLoader = () => Promise<unknown>
type GameDataLoaderMap = Record<string, JsonLoader>

const gameDataLoaders = import.meta.glob('/src/assets/x4_game_data/*/data/*.json')
const HIGHWAY_RING_CONNECT_THRESHOLD_M = 1000.1
const HIGHWAY_RING_GATE_THRESHOLD_M = 1000

export function buildGameDataLoaderKey(folderName: string, file: string): string {
  return `/src/assets/x4_game_data/${folderName}/data/${file}`
}

async function loadJsonFromBundle<T>(
  folderName: string,
  file: string,
  loaders: GameDataLoaderMap = gameDataLoaders
): Promise<T> {
  const key = buildGameDataLoaderKey(folderName, file)
  const loader = loaders[key]
  if (!loader) {
    throw new Error(`[GameData] Missing bundled data file '${file}' for folder '${folderName}'`)
  }
  const mod = await loader() as JsonModule<T>
  return mod.default
}

export async function loadGameDataFiles(
  folderName: string,
  loaders: GameDataLoaderMap = gameDataLoaders
): Promise<GameDataFiles> {

  const [
    wares, modules, moduleGroups, consumption,
    ships, shipRaces, shipTypes,
    equipments, equipmentTypes, slotTags,
    consumables, drones, missiles, bullets,
    maps, sectorReachability, mapResources, regionyields, res, factions,
    defaultMaxes, shipSlots, languages, dlcs, terraforming, research, blueprints
  ] = await Promise.all([
    loadJsonFromBundle<X4Ware[]>(folderName, 'wares.json', loaders),
    loadJsonFromBundle<X4Module[]>(folderName, 'modules.json', loaders),
    loadJsonFromBundle<X4ModuleGroup[]>(folderName, 'module_groups.json', loaders),
    loadJsonFromBundle<WorkforceConsumptionMap>(folderName, 'consumption.json', loaders),
    loadJsonFromBundle<X4Ship[]>(folderName, 'ships.json', loaders),
    loadJsonFromBundle<X4ShipRace[]>(folderName, 'ship_races.json', loaders),
    loadJsonFromBundle<X4ShipType[]>(folderName, 'ship_types.json', loaders),
    loadJsonFromBundle<X4Equipment[]>(folderName, 'equipments.json', loaders),
    loadJsonFromBundle<X4EquipmentType[]>(folderName, 'equipment_types.json', loaders),
    loadJsonFromBundle<X4SlotTag[]>(folderName, 'slot_tags.json', loaders),
    loadJsonFromBundle<X4Consumable[]>(folderName, 'consumables.json', loaders),
    loadJsonFromBundle<X4Drone[]>(folderName, 'drones.json', loaders),
    loadJsonFromBundle<X4Missile[]>(folderName, 'missiles.json', loaders),
    loadJsonFromBundle<X4Bullet[]>(folderName, 'bullets.json', loaders),
    loadJsonFromBundle<X4Map>(folderName, 'maps.json', loaders),
    loadJsonFromBundle<SectorReachability>(folderName, 'sector_reachability.json', loaders),
    loadJsonFromBundle<X4MapResources>(folderName, 'map_resources.json', loaders),
    loadJsonFromBundle<X4RegionYield[]>(folderName, 'regionyields.json', loaders),
    loadJsonFromBundle<X4Res[]>(folderName, 'res.json', loaders),
    loadJsonFromBundle<X4Faction[]>(folderName, 'factions.json', loaders),
    loadJsonFromBundle<Record<string, X4DefaultMax>>(folderName, 'default_maxes.json', loaders),
    loadJsonFromBundle<Record<string, X4ShipSlot[]>>(folderName, 'ship_slots.json', loaders),
    loadJsonFromBundle<X4Language[]>(folderName, 'languages.json', loaders),
    loadJsonFromBundle<X4Dlc[]>(folderName, 'dlcs.json', loaders),
    loadJsonFromBundle<TerraformingData>(folderName, 'terraforming.json', loaders),
    loadJsonFromBundle<X4ResearchData>(folderName, 'research.json', loaders),
    loadJsonFromBundle<BlueprintsData>(folderName, 'blueprints.json', loaders),
  ])

  maps.highwayRings = buildMapHighwayRings(maps)
  maps.highwayRingChains = buildMapHighwayRingChains(maps)

  return {
    wares, modules, moduleGroups, consumption,
    ships, shipRaces, shipTypes,
    equipments, equipmentTypes, slotTags,
    consumables, drones, missiles, bullets,
    maps, sectorReachability, mapResources, regionyields, res, factions,
    defaultMaxes, shipSlots, languages, dlcs, terraforming, research, blueprints
  }
}

type HighwayRingPoint = { x: number; z: number }
type HighwayRingEdge = {
  id: string
  entry: HighwayRingPoint
  exit: HighwayRingPoint
  lengthM: number
}
type HighwayRingGate = {
  id: string
  targetClusterId?: string
  pos: HighwayRingPoint
}

function mapPoint(raw: { x?: number; z?: number } | undefined): HighwayRingPoint | null {
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.z)) return null
  return { x: raw.x!, z: raw.z! }
}

function mapDistanceM(a: HighwayRingPoint, b: HighwayRingPoint): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

function mapPathLengthM(points: HighwayRingPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += mapDistanceM(points[i - 1]!, points[i]!)
  }
  return total
}

function highwayRingCycleKey(ids: string[]): string {
  const rotations = ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join('>'))
  return rotations.sort()[0]!
}

function findHighwayRingCycles(edges: HighwayRingEdge[]): Array<{ edges: HighwayRingEdge[]; joins: number[] }> {
  const cycles: Array<{ edges: HighwayRingEdge[]; joins: number[] }> = []
  const seen = new Set<string>()
  const maxDepth = Math.min(edges.length, 8)

  function dfs(start: HighwayRingEdge, current: HighwayRingEdge, path: HighwayRingEdge[], joins: number[]) {
    if (path.length > maxDepth) return
    for (const next of edges) {
      if (path.some((edge) => edge.id === next.id)) continue
      const joinDistance = mapDistanceM(current.exit, next.entry)
      if (joinDistance > HIGHWAY_RING_CONNECT_THRESHOLD_M) continue
      const nextJoins = [...joins, joinDistance]
      const closingDistance = mapDistanceM(next.exit, start.entry)
      if (closingDistance <= HIGHWAY_RING_CONNECT_THRESHOLD_M) {
        const cycle = [...path, next]
        const key = highwayRingCycleKey(cycle.map((edge) => edge.id))
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push({ edges: cycle, joins: [...nextJoins, closingDistance] })
        }
      }
      dfs(start, next, [...path, next], nextJoins)
    }
  }

  for (const edge of edges) {
    dfs(edge, edge, [edge], [])
  }
  return cycles
}

export function buildMapHighwayRings(maps: X4Map): X4MapHighwayRing[] {
  const results: X4MapHighwayRing[] = []

  for (const sector of Object.values(maps.sectors ?? {})) {
    const edges = Object.entries(sector.highways ?? {})
      .map(([id, highway]): HighwayRingEdge | null => {
        const entry = mapPoint(highway.entry)
        const exit = mapPoint(highway.exit)
        const spline = (highway.spline ?? []).map(mapPoint).filter((point): point is HighwayRingPoint => !!point)
        if (!entry || !exit || spline.length < 2) return null
        return { id, entry, exit, lengthM: mapPathLengthM(spline) }
      })
      .filter((edge): edge is HighwayRingEdge => !!edge)

    if (edges.length < 2) continue
    const cycles = findHighwayRingCycles(edges)
    if (cycles.length === 0) continue

    const gates: HighwayRingGate[] = Object.entries(sector.cluster_gates ?? {})
      .map(([id, gate]): HighwayRingGate | null => {
        const pos = mapPoint(gate.raw_local_pos)
        if (!pos) return null
        return { id, targetClusterId: gate.target_cluster_id, pos }
      })
      .filter((gate): gate is HighwayRingGate => !!gate)

    for (const cycle of cycles) {
      const ports = cycle.edges.flatMap((edge) => [
        { highwayId: edge.id, portKind: 'entry' as const, pos: edge.entry },
        { highwayId: edge.id, portKind: 'exit' as const, pos: edge.exit }
      ])
      const gateMatches: X4MapHighwayRing['gateMatches'] = []
      for (const gate of gates) {
        let best: X4MapHighwayRing['gateMatches'][number] | null = null
        for (const port of ports) {
          const distanceM = mapDistanceM(gate.pos, port.pos)
          if (!best || distanceM < best.distanceM) {
            best = {
              gateId: gate.id,
              targetClusterId: gate.targetClusterId,
              highwayId: port.highwayId,
              portKind: port.portKind,
              distanceM
            }
          }
        }
        if (best && best.distanceM <= HIGHWAY_RING_GATE_THRESHOLD_M) {
          gateMatches.push({ ...best, distanceM: Math.round(best.distanceM) })
        }
      }
      if (gateMatches.length === 0) continue

      results.push({
        sectorId: sector.id,
        highwayIds: cycle.edges.map((edge) => edge.id),
        lengthKm: Number((cycle.edges.reduce((sum, edge) => sum + edge.lengthM, 0) / 1000).toFixed(1)),
        maxJoinDistanceM: Math.round(Math.max(...cycle.joins)),
        gateMatches
      })
    }
  }

  return results.sort((a, b) => a.sectorId.localeCompare(b.sectorId) || a.lengthKm - b.lengthKm)
}

type HighwayLink = {
  highwayId: string
  entry: HighwayRingPoint
  exit: HighwayRingPoint
  lengthM: number
}

function buildSectorHighwayLinkMap(maps: X4Map): Map<string, HighwayLink[]> {
  const bySector = new Map<string, HighwayLink[]>()
  for (const sector of Object.values(maps.sectors ?? {})) {
    const links: HighwayLink[] = []
    for (const [id, highway] of Object.entries(sector.highways ?? {})) {
      const entry = mapPoint(highway.entry)
      const exit = mapPoint(highway.exit)
      const spline = (highway.spline ?? []).map(mapPoint).filter((p): p is HighwayRingPoint => !!p)
      if (!entry || !exit || spline.length < 2) continue
      links.push({ highwayId: id, entry, exit, lengthM: mapPathLengthM(spline) })
    }
    if (links.length > 0) bySector.set(sector.id, links)
  }
  return bySector
}

type SectorBridge = {
  sectorId: string
  gateId: string
  targetClusterId: string
}

function ringNeighborBridges(sectorId: string, ringSectorIds: Set<string>, maps: X4Map): SectorBridge[] {
  const sector = maps.sectors[sectorId]
  if (!sector) return []
  const bridges: SectorBridge[] = []
  for (const [gateId, gate] of Object.entries(sector.cluster_gates ?? {})) {
    const targetClusterId = gate.target_cluster_id
    if (!targetClusterId) continue
    for (const [candidateId, candidate] of Object.entries(maps.sectors)) {
      if (candidate.cluster_id !== targetClusterId) continue
      if (!ringSectorIds.has(candidateId)) continue
      bridges.push({ sectorId: candidateId, gateId, targetClusterId })
      break
    }
  }
  return bridges
}

function walkRingCycle(
  startSectorId: string,
  ringSectorIds: Set<string>,
  maps: X4Map
): string[] | null {
  const order: string[] = [startSectorId]
  const visited = new Set<string>([startSectorId])
  let prev: string | null = null
  let current = startSectorId
  const maxIters = ringSectorIds.size + 2
  let iters = 0
  while (iters < maxIters) {
    iters += 1
    const bridges = ringNeighborBridges(current, ringSectorIds, maps)
      .filter((bridge) => bridge.sectorId !== prev)
    if (bridges.length === 0) break
    const next = bridges[0]!.sectorId
    if (next === startSectorId) break
    if (visited.has(next)) break
    order.push(next)
    visited.add(next)
    prev = current
    current = next
  }
  if (order.length < 2) return null
  return order
}

function followRingChainFrom(
  startSectorId: string,
  ringSectorIds: Set<string>,
  ringBySector: Map<string, X4MapHighwayRing>,
  linkMap: Map<string, HighwayLink[]>,
  maps: X4Map
): X4MapHighwayRingChain | null {
  const order = walkRingCycle(startSectorId, ringSectorIds, maps)
  if (!order || order.length < 2) return null
  const hops: X4MapHighwayRingChainHop[] = []
  const N = order.length
  for (let i = 0; i < N; i += 1) {
    const sectorId = order[i]!
    const prevId = order[(i - 1 + N) % N]!
    const nextId = order[(i + 1) % N]!
    const hop = buildHopForSectorWithMaps(sectorId, prevId, nextId, ringBySector, linkMap, maps)
    if (!hop) return null
    hops.push(hop)
  }
  const total = hops.reduce((sum, hop) => sum + hop.forwardHighwayLengthKm, 0)
  return { hops, totalLengthKm: Number(total.toFixed(1)) }
}

function buildHopForSectorWithMaps(
  sectorId: string,
  prevSectorId: string,
  nextSectorId: string,
  ringBySector: Map<string, X4MapHighwayRing>,
  linkMap: Map<string, HighwayLink[]>,
  maps: X4Map
): X4MapHighwayRingChainHop | null {
  const sector = ringBySector.get(sectorId)
  if (!sector) return null
  const prevSector = maps.sectors[prevSectorId]
  const nextSector = maps.sectors[nextSectorId]
  if (!prevSector || !nextSector) return null
  const prevClusterId = prevSector.cluster_id
  const nextClusterId = nextSector.cluster_id
  const prevMatch = sector.gateMatches.find((m) => m.targetClusterId === prevClusterId)
  const nextMatch = sector.gateMatches.find((m) => m.targetClusterId === nextClusterId)
  if (!prevMatch || !nextMatch) return null
  if (prevMatch.gateId === nextMatch.gateId) return null
  const links = linkMap.get(sectorId) ?? []
  const forwardLink = findDirectedHighwayLink(sectorId, prevMatch.gateId, nextMatch.gateId, links, maps)
  const backwardLink = findDirectedHighwayLink(sectorId, nextMatch.gateId, prevMatch.gateId, links, maps)
  if (!forwardLink || !backwardLink) return null
  return {
    sectorId,
    prevGateId: prevMatch.gateId,
    nextGateId: nextMatch.gateId,
    forwardHighwayId: forwardLink.highwayId,
    forwardHighwayLengthKm: Number((forwardLink.lengthM / 1000).toFixed(1)),
    backwardHighwayId: backwardLink.highwayId,
    backwardHighwayLengthKm: Number((backwardLink.lengthM / 1000).toFixed(1))
  }
}

function findDirectedHighwayLink(
  sectorId: string,
  fromGateId: string,
  toGateId: string,
  links: HighwayLink[],
  maps: X4Map
): HighwayLink | null {
  const sector = maps.sectors[sectorId]
  const fromGate = mapPoint(sector?.cluster_gates?.[fromGateId]?.raw_local_pos)
  const toGate = mapPoint(sector?.cluster_gates?.[toGateId]?.raw_local_pos)
  if (!fromGate || !toGate) return null

  let best: { link: HighwayLink; entryDistanceM: number; exitDistanceM: number; totalDistanceM: number } | null = null
  for (const link of links) {
    const entryDistanceM = mapDistanceM(fromGate, link.entry)
    const exitDistanceM = mapDistanceM(toGate, link.exit)
    const totalDistanceM = entryDistanceM + exitDistanceM
    if (!best || totalDistanceM < best.totalDistanceM) {
      best = { link, entryDistanceM, exitDistanceM, totalDistanceM }
    }
  }
  if (!best) return null
  if (best.entryDistanceM > HIGHWAY_RING_GATE_THRESHOLD_M || best.exitDistanceM > HIGHWAY_RING_GATE_THRESHOLD_M) return null
  return best.link
}

export function buildMapHighwayRingChains(maps: X4Map): X4MapHighwayRingChain[] {
  const rings = maps.highwayRings ?? []
  if (rings.length === 0) return []
  const ringBySector = new Map<string, X4MapHighwayRing>()
  const ringSectorIds = new Set<string>()
  for (const ring of rings) {
    ringBySector.set(ring.sectorId, ring)
    ringSectorIds.add(ring.sectorId)
  }
  const linkMap = buildSectorHighwayLinkMap(maps)

  const visitedChains = new Set<string>()
  const chains: X4MapHighwayRingChain[] = []
  for (const startSectorId of ringSectorIds) {
    const chain = followRingChainFrom(startSectorId, ringSectorIds, ringBySector, linkMap, maps)
    if (!chain || chain.hops.length < 2) continue
    const key = chain.hops.map((hop) => hop.sectorId).sort().join('>')
    if (visitedChains.has(key)) continue
    visitedChains.add(key)
    chains.push(chain)
  }
  return chains
}

export function getShipBuildRawData(data: GameDataFiles): ShipBuildRawData {
  return {
    ships: data.ships,
    races: data.shipRaces,
    types: data.shipTypes,
    equipments: data.equipments,
    equipmentTypes: data.equipmentTypes,
    slotTags: data.slotTags,
    wares: data.wares
  }
}

export function buildShipBuildDatas(payload: ShipBuildRawData): ShipBuildDatas {
  const shipMap = new Map<string, X4Ship>()
  const shipByMacroMap = new Map<string, X4Ship>()
  payload.ships.forEach((ship) => {
    shipMap.set(ship.id, ship)
    if (ship.macro) {
      shipByMacroMap.set(ship.macro, ship)
    }
  })

  const raceMap = new Map<string, X4ShipRace>()
  payload.races.forEach((race) => raceMap.set(race.id, race))

  const typeMap = new Map<string, X4ShipType>()
  payload.types.forEach((type) => typeMap.set(type.id, type))

  const equipmentMap = new Map<string, X4Equipment>()
  payload.equipments.forEach((equipment) => equipmentMap.set(equipment.id, equipment))

  return {
    shipMap,
    shipByMacroMap,
    raceMap,
    typeMap,
    equipmentMap,
    shipTypes: payload.types,
    shipRaces: payload.races
  }
}

export function buildConsumableDatas(data: GameDataFiles): ConsumableDatas {
  const { consumables, drones, missiles } = data

  const consumablesMap = new Map<string, X4Consumable>()
  consumables.forEach((item) => consumablesMap.set(item.id, item))

  const dronesMap = new Map<string, X4Drone>()
  drones.forEach((item) => dronesMap.set(item.id, item))

  const missilesMap = new Map<string, X4Missile>()
  missiles.forEach((item) => missilesMap.set(item.id, item))

  return {
    consumables,
    drones,
    missiles,
    consumablesMap,
    dronesMap,
    missilesMap
  }
}

export function buildWaresMap(wares: X4Ware[]): Record<string, X4Ware> {
  const map: Record<string, X4Ware> = {}
  wares.forEach(w => {
    map[w.id] = {
      ...w,
      price: w.price || 0,
      minPrice: w.minPrice || 0,
      maxPrice: w.maxPrice || 0
    }
  })
  return map
}

export function buildModulesMap(modules: X4Module[]): Record<string, X4Module> {
  const map: Record<string, X4Module> = {}
  modules.forEach(m => {
    if(!m.isPlayerBlueprint) return
    map[m.id] = {
      ...m,
      macroId: m.macroId || '',
      buildCost: m.buildCost || {},
      outputs: m.outputs || {},
      inputs: m.inputs || {},
      cycleTime: m.cycleTime || 0,
      workforce: {
        capacity: m.workforce?.capacity || 0,
        needed: m.workforce?.needed || 0,
        maxBonus: m.workforce?.maxBonus || 0
      }
    }
  })
  return map
}

export function buildModulesByMacroIdMap(modulesMap: Record<string, X4Module>): Record<string, X4Module> {
  const map: Record<string, X4Module> = {}
  Object.values(modulesMap).forEach((module) => {
    if (!module.macroId) return
    map[module.macroId] = module
  })
  return map
}

export function buildModulesByOutputMap(modulesMap: Record<string, X4Module>): Record<string, X4Module[]> {
  const outputMap: Record<string, X4Module[]> = {}
  Object.values(modulesMap).forEach(module => {
    Object.keys(module.outputs).forEach(wareId => {
      if (!outputMap[wareId]) {
        outputMap[wareId] = []
      }
      outputMap[wareId].push(module)
    })
  })
  return outputMap
}

export function buildWorkforceConsumptionMap(consumption: WorkforceConsumptionMap): WorkforceConsumptionMap {
  return consumption
}

export function buildLocalizedModulesMap(
  modules: X4Module[],
  isEn: boolean,
  translateModule: (m: X4Module) => string
): Record<string, LocalizedX4Module> {
  const map: Record<string, LocalizedX4Module> = {}
  modules.forEach(m => {
    if(!m.isPlayerBlueprint) return
    map[m.id] = {
      ...m,
      macroId: m.macroId || '',
      localeName: isEn ? (m.name || '') : translateModule(m as X4Module)
    }
  })
  return map
}

export function buildLocalizedModuleGroupsMap(
  moduleGroups: X4ModuleGroup[],
  isEn: boolean,
  translateModuleGroup: (mg: X4ModuleGroup) => string
): Record<string, LocalizedX4ModuleGroup> {
  const map: Record<string, LocalizedX4ModuleGroup> = {}
  moduleGroups.forEach((mg) => {
    map[mg.id] = {
      ...mg,
      localeName: isEn ? (mg.name || '') : translateModuleGroup(mg)
    }
  })
  return map
}

export function buildLocalizedWaresMap(
  wares: X4Ware[],
  isEn: boolean,
  translateWare: (w: X4Ware) => string
): Record<string, LocalizedX4Ware> {
  const map: Record<string, LocalizedX4Ware> = {}
  wares.forEach(w => {
    map[w.id] = {
      ...w,
      localeName: isEn ? (w.name || '') : translateWare(w)
    }
  })
  return map
}

export function buildLocalizedShipsMap(
  ships: X4Ship[],
  isEn: boolean,
  translateShip: (s: X4Ship) => string
): Record<string, LocalizedX4Ship> {
  const map: Record<string, LocalizedX4Ship> = {}
  ships.forEach(s => {
    map[s.id] = {
      ...s,
      localeName: isEn ? (s.name || '') : translateShip(s)
    }
  })
  return map
}

export function findModuleForWare(
  wareId: string,
  lineage: string,
  modulesByOutputMap: Record<string, X4Module[]>
): X4Module | null {
  const candidates = modulesByOutputMap[wareId]
  if (!candidates) return null
  const producers = candidates.filter(m => {
    const hourlyRate = m.outputs[wareId]
    return hourlyRate !== undefined
      && hourlyRate > 0
      && (m.type === 'production' || m.type === 'processingmodule')
      && m.method !== 'recycling'
  })
  if (producers.length === 0) return null

  let found = producers.find(m => m.race === lineage)
  if (found) return found

  found = producers.find(m => m.method === lineage)
  if (found) return found

  if (lineage === 'teladi') {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  found = producers.find(m => m.method === 'default')
  if (found) return found

  const agriRaces = ['argon', 'boron', 'paranid', 'split']
  if (agriRaces.includes(lineage)) {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  return producers[0]!
}

export function findRecyclingModuleForWare(
  wareId: string,
  modulesByOutputMap: Record<string, X4Module[]>
): X4Module | null {
  const candidates = modulesByOutputMap[wareId]
  if (!candidates) return null
  const found = candidates.find(m => {
    const hourlyRate = m.outputs[wareId]
    return m.method === 'recycling' && hourlyRate !== undefined && hourlyRate > 0
  })
  return found === undefined ? null : found
}

export function precomputeCandidateWares(
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  modulesByOutputMap: Record<string, X4Module[]>
): {
  wareSetsByIndustrialRace: Record<string, Set<string>>
  wareSetsByRace: Record<string, Set<string>>
} {
  const industrialRaces = ['default', 'terran', 'teladi']
  const agriRaces = ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']

  const INDUSTRIAL_GROUPS = ['minerals', 'gases', 'refined', 'hightech', 'shiptech', 'energy']
  const AGRICULTURAL_GROUPS = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice', 'energy']

  const wareSetsByIndustrialRace: Record<string, Set<string>> = {}
  const wareSetsByRace: Record<string, Set<string>> = {}

  industrialRaces.forEach(raceKey => {
    const resultSet = new Set<string>()
    const seeds = new Set<string>()

    Object.values(modulesMap).forEach(m => {
      if (m.race === raceKey && m.method !== 'recycling' && INDUSTRIAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    if (raceKey === 'teladi') {
      Object.values(modulesMap).forEach(m => {
        if (m.race === 'default' && m.method !== 'recycling' && INDUSTRIAL_GROUPS.includes(m.group)) {
          Object.keys(m.outputs).forEach(id => {
            if (waresMap[id]?.tier === 3) {
              seeds.add(id)
            }
          })
        }
      })
    }

    const visited = new Set<string>()
    const trace = (wareId: string) => {
      if (visited.has(wareId)) return
      visited.add(wareId)

      const ware = waresMap[wareId]
      if (!ware || ware.tier === null) return
      resultSet.add(wareId)
      if (!((modulesByOutputMap[wareId]?.length ?? 0) > 0)) return

      const module = findModuleForWare(wareId, raceKey, modulesByOutputMap)
      if (module && module.inputs) {
        Object.keys(module.inputs).forEach(inputId => trace(inputId))
      }
    }
    seeds.forEach(id => trace(id))
    wareSetsByIndustrialRace[raceKey] = resultSet
  })

  const recyclingWares = new Set<string>()
  const traceRecyclingUpstream = (wareId: string, lineage: string) => {
    const ware = waresMap[wareId]
    if (!ware || ware.tier === null || recyclingWares.has(wareId)) return
    recyclingWares.add(wareId)
    const producer = findModuleForWare(wareId, lineage, modulesByOutputMap)
    if (producer?.inputs) {
      Object.keys(producer.inputs).forEach(inputId => traceRecyclingUpstream(inputId, producer.race))
    }
  }
  Object.values(modulesMap).forEach(module => {
    if (module.method !== 'recycling') return
    Object.entries(module.outputs).forEach(([wareId, hourlyRate]) => {
      const ware = waresMap[wareId]
      if (hourlyRate > 0 && ware && ware.tier !== null) recyclingWares.add(wareId)
    })
    Object.keys(module.inputs).forEach(inputId => traceRecyclingUpstream(inputId, module.race))
  })
  wareSetsByIndustrialRace.recycling = recyclingWares

  agriRaces.forEach(race => {
    const resultSet = new Set<string>()
    const seeds = new Set<string>()

    Object.values(modulesMap).forEach(m => {
      if (m.race === race && m.method !== 'recycling' && AGRICULTURAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    const visited = new Set<string>()
    const trace = (wareId: string) => {
      if (visited.has(wareId)) return
      visited.add(wareId)

      const ware = waresMap[wareId]
      if (!ware || ware.tier === null) return
      resultSet.add(wareId)
      if (!((modulesByOutputMap[wareId]?.length ?? 0) > 0)) return

      const module = findModuleForWare(wareId, race, modulesByOutputMap)
      if (module && module.inputs) {
        Object.keys(module.inputs).forEach(inputId => trace(inputId))
      }
    }
    seeds.forEach(id => trace(id))
    wareSetsByRace[race] = resultSet
  })

  return { wareSetsByIndustrialRace, wareSetsByRace }
}
