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
  X4RegionYield,
  X4Faction,
  X4Language,
  X4Dlc,
  X4DefaultMax,
  X4ShipSlot,
  X4Res
} from '../../types/x4'

export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }
export type LocalizedX4Ware = X4Ware & { localeName: string }
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
  regionyields: X4RegionYield[]
  res: X4Res[]
  factions: X4Faction[]
  defaultMaxes: Record<string, X4DefaultMax>
  shipSlots: Record<string, X4ShipSlot[]>
  languages: X4Language[]
  dlcs: X4Dlc[]
}

type JsonModule<T = unknown> = { default: T }
type JsonLoader = () => Promise<unknown>
type GameDataLoaderMap = Record<string, JsonLoader>

const gameDataLoaders = import.meta.glob('/src/assets/x4_game_data/*/data/*.json')

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
    maps, regionyields, res, factions,
    defaultMaxes, shipSlots, languages, dlcs
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
    loadJsonFromBundle<X4RegionYield[]>(folderName, 'regionyields.json', loaders),
    loadJsonFromBundle<X4Res[]>(folderName, 'res.json', loaders),
    loadJsonFromBundle<X4Faction[]>(folderName, 'factions.json', loaders),
    loadJsonFromBundle<Record<string, X4DefaultMax>>(folderName, 'default_maxes.json', loaders),
    loadJsonFromBundle<Record<string, X4ShipSlot[]>>(folderName, 'ship_slots.json', loaders),
    loadJsonFromBundle<X4Language[]>(folderName, 'languages.json', loaders),
    loadJsonFromBundle<X4Dlc[]>(folderName, 'dlcs.json', loaders)
  ])

  return {
    wares, modules, moduleGroups, consumption,
    ships, shipRaces, shipTypes,
    equipments, equipmentTypes, slotTags,
    consumables, drones, missiles, bullets,
    maps, regionyields, res, factions,
    defaultMaxes, shipSlots, languages, dlcs
  }
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

export function findModuleForWare(
  wareId: string,
  lineage: string,
  modulesByOutputMap: Record<string, X4Module[]>
): X4Module | null {
  const producers = (modulesByOutputMap[wareId] || []).filter(m => m.method !== 'recycling')
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

  return producers[0] || null
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
      if (m.race === raceKey && INDUSTRIAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    if (raceKey === 'teladi') {
      Object.values(modulesMap).forEach(m => {
        if (m.race === 'default' && INDUSTRIAL_GROUPS.includes(m.group)) {
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

      resultSet.add(wareId)

      const ware = waresMap[wareId]
      if (ware && ware.tier === 0) return

      const module = findModuleForWare(wareId, raceKey, modulesByOutputMap)
      if (module && module.inputs) {
        Object.keys(module.inputs).forEach(inputId => trace(inputId))
      }
    }
    seeds.forEach(id => trace(id))
    wareSetsByIndustrialRace[raceKey] = resultSet
  })

  agriRaces.forEach(race => {
    const resultSet = new Set<string>()
    const seeds = new Set<string>()

    Object.values(modulesMap).forEach(m => {
      if (m.race === race && AGRICULTURAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    const visited = new Set<string>()
    const trace = (wareId: string) => {
      if (visited.has(wareId)) return
      visited.add(wareId)

      resultSet.add(wareId)

      const ware = waresMap[wareId]
      if (ware && ware.tier === 0) return

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
