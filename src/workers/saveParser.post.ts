import type {
  AggregatedStationModule,
  FactionStationEntry,
  NpcStationEntry,
  PlayerStationEntry,
  SaveArchive,
  SectorData
} from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'
import type { X4Map } from '@/types/x4'

interface Vector3 {
  x: number
  y: number
  z: number
}

interface ZoneLookup {
  [sectorId: string]: {
    [zoneId: string]: Vector3
  }
}

export const CURRENT_PARSER_VERSION = 'v2' as const
export const CURRENT_POST_PROCESSOR_VERSION = 'v2' as const

const FACTORY_GROUP_PRIORITY = [
  'shiptech',
  'hightech',
  'refined',
  'pharmaceutical',
  'food',
  'agricultural',
  'water',
  'energy'
]

function buildZoneLookup(maps: X4Map | undefined): ZoneLookup {
  const lookup: ZoneLookup = {}
  if (!maps) return lookup
  
  for (const clusterId in maps.clusters) {
    const cluster = maps.clusters[clusterId]
    if (!cluster) continue
    
    for (const sectorId in cluster.sectors) {
      const sector = cluster.sectors[sectorId]
      if (!sector || !sector.zones) continue
      
      const normalizedSectorId = sectorId.toLowerCase()
      lookup[normalizedSectorId] = {}
      for (const [zoneId, zone] of Object.entries(sector.zones)) {
        lookup[normalizedSectorId][zoneId.toLowerCase()] = zone.position
      }
    }
  }
  
  return lookup
}

function addVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  }
}

function calculateFinalPosition(
  relativePosition: Vector3,
  zoneId: string | undefined,
  sectorId: string,
  zoneLookup: ZoneLookup
): Vector3 {
  if (!zoneId) {
    return relativePosition
  }
  
  const sectorZones = zoneLookup[sectorId.toLowerCase()]
  if (!sectorZones) {
    return relativePosition
  }
  
  const zonePosition = sectorZones[zoneId.toLowerCase()]
  if (!zonePosition) {
    return relativePosition
  }
  
  return addVectors(zonePosition, relativePosition)
}

function enrichModulesWithGameData(
  modules: AggregatedStationModule[] | undefined,
  modulesByMacroId: Record<string, X4Module>
): AggregatedStationModule[] | undefined {
  if (!modules || modules.length === 0) return modules
  
  return modules.map((module) => {
    const matchedModule = modulesByMacroId[module.ref]
    
    if (!matchedModule) {
      return module
    }
    
    return {
      ...module,
      module_id: matchedModule.id,
      type: matchedModule.type,
      group: matchedModule.group
    }
  })
}

function getFactoryGroup(
  modules: AggregatedStationModule[] | undefined
): string {
  if (!modules || modules.length === 0) return 'factory'
  
  const productionModules = modules.filter((m) => m.type === 'production')
  if (productionModules.length === 0) return 'factory'
  
  const groups = productionModules.map((m) => m.group).filter((g): g is string => Boolean(g))
  
  for (const priorityGroup of FACTORY_GROUP_PRIORITY) {
    if (groups.includes(priorityGroup)) {
      return priorityGroup
    }
  }
  
  return 'factory'
}

function hasModulePattern(modules: AggregatedStationModule[] | undefined, patterns: string[]): boolean {
  if (!modules || modules.length === 0) return false
  return modules.some((module) => {
    const ref = module.ref.toLowerCase()
    return patterns.some((pattern) => ref.includes(pattern))
  })
}

function enrichPlayerStation(
  station: PlayerStationEntry,
  sectorId: string,
  zoneLookup: ZoneLookup
): PlayerStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()
  
  const isPiratebase = macro.includes('_piratebase')
  const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
  const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
  const isEquipmentdock = hasModulePattern(modules, ['_equip'])
  const isFactory = modules.some((m) => m.type === 'production')
  const factoryGroup = getFactoryGroup(modules)
  const isTradestation = macro.includes('tradestation')
  const isDefencemodule = modules.some((m) => m.type === 'defencemodule')
  const isHeadquarter = macro.includes('player_hq_') || station.is_headquarter
  
  let tag: string | undefined
  if (isPiratebase) tag = 'piratestation'
  else if (isShipyard) tag = 'shipyard'
  else if (isWharf) tag = 'wharf'
  else if (isEquipmentdock) tag = 'equipmentdock'
  else if (isFactory) tag = 'factory'
  else if (isTradestation) tag = 'tradestation'
  else if (isDefencemodule) tag = 'defencemodule'
  else tag = 'factory'
  
  const position = calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup
  )
  
  return {
    ...station,
    position,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isFactory: isFactory || undefined,
    factoryGroup: factoryGroup !== 'factory' ? factoryGroup : undefined,
    isPiratebase: isPiratebase || undefined,
    isDefencemodule: isDefencemodule || undefined,
    is_headquarter: isHeadquarter || undefined,
    tag
  }
}

function enrichNpcStation(
  station: NpcStationEntry,
  sectorId: string,
  zoneLookup: ZoneLookup
): NpcStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()
  
  const isPiratebase = macro.includes('_piratebase')
  const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
  const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
  const isEquipmentdock = hasModulePattern(modules, ['_equip'])
  const isFactory = modules.some((m) => m.type === 'production')
  const factoryGroup = getFactoryGroup(modules)
  const isTradestation = macro.includes('tradestation')
  const isDefencemodule = modules.some((m) => m.type === 'defencemodule')
  
  let tag: string | undefined
  if (isPiratebase) tag = 'piratebase'
  else if (isShipyard) tag = 'shipyard'
  else if (isWharf) tag = 'wharf'
  else if (isEquipmentdock) tag = 'equipmentdock'
  else if (isFactory) tag = 'factory'
  else if (isTradestation) tag = 'tradestation'
  else if (isDefencemodule) tag = 'defencemodule'
  else tag = 'factory'
  
  const position = calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup
  )
  
  return {
    ...station,
    position,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isTradestation: isTradestation || undefined,
    isFactory: isFactory || undefined,
    factoryGroup: factoryGroup !== 'factory' ? factoryGroup : undefined,
    isPiratebase: isPiratebase || undefined,
    isDefencemodule: isDefencemodule || undefined,
    tag
  }
}

function enrichFactionStation(
  station: FactionStationEntry, 
  owner: 'xenon' | 'khaak',
  sectorId: string,
  zoneLookup: ZoneLookup
): FactionStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()
  
  if (owner === 'xenon') {
    const isPiratebase = macro.includes('_piratebase')
    const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
    const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
    const isEquipmentdock = hasModulePattern(modules, ['_equip'])
    const isFactory = modules.some((m) => m.type === 'production')
    const factoryGroup = getFactoryGroup(modules)
    const isTradestation = macro.includes('tradestation')
    const isDefencemodule = modules.some((m) => m.type === 'defencemodule')
    
    let tag: string | undefined
    if (isPiratebase) tag = 'piratebase'
    else if (isShipyard) tag = 'shipyard'
    else if (isWharf) tag = 'wharf'
    else if (isEquipmentdock) tag = 'equipmentdock'
    else if (isFactory) tag = 'factory'
    else if (isTradestation) tag = 'tradestation'
    else if (isDefencemodule) tag = 'defencemodule'
    else tag = 'factory'
    
    const position = calculateFinalPosition(
      station.relative_position,
      station.zone_id,
      sectorId,
      zoneLookup
    )
    
    return {
      ...station,
      position,
      isShipyard: isShipyard || undefined,
      isWharf: isWharf || undefined,
      isEquipmentdock: isEquipmentdock || undefined,
      isTradestation: isTradestation || undefined,
      isFactory: isFactory || undefined,
      factoryGroup: factoryGroup !== 'factory' ? factoryGroup : undefined,
      isPiratebase: isPiratebase || undefined,
      isDefencemodule: isDefencemodule || undefined,
      tag
    }
  }
  
  const isHive = macro.includes('landmarks_kha_hive_')
  const isNest = macro.includes('landmarks_kha_nest_')
  
  const tag = isHive ? 'hive' : isNest ? 'nest' : 'weaponplatform'
  
  const position = calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup
  )
  
  return {
    ...station,
    position,
    isNest: isNest || undefined,
    isHive: isHive || undefined,
    tag
  }
}

function stripEmptySectorArrays(sector: SectorData): SectorData {
  const nextSector: SectorData = {
    name: sector.name,
    is_known: sector.is_known,
    owner: sector.owner
  }
  
  if (sector.playerStations?.length) nextSector.playerStations = sector.playerStations
  if (sector.xenonStations?.length) nextSector.xenonStations = sector.xenonStations
  if (sector.khaakStations?.length) nextSector.khaakStations = sector.khaakStations
  if (sector.npcStations?.length) nextSector.npcStations = sector.npcStations
  if (sector.datavaults?.length) nextSector.datavaults = sector.datavaults
  if (sector.erlkingVaults?.length) nextSector.erlkingVaults = sector.erlkingVaults
  if (sector.abandonedShips?.length) nextSector.abandonedShips = sector.abandonedShips
  
  return nextSector
}

export function postProcessRustSaveArchive(
  archive: SaveArchive, 
  modulesByMacroId?: Record<string, X4Module>,
  maps?: X4Map
): SaveArchive {
  const zoneLookup = buildZoneLookup(maps)
  
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      let enrichedSector: SectorData = {
        ...sector,
        playerStations: sector.playerStations?.map((station) => {
          const enrichedModules = modulesByMacroId 
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichPlayerStation({ ...station, modules: enrichedModules }, sectorMacro, zoneLookup)
        }),
        npcStations: sector.npcStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichNpcStation({ ...station, modules: enrichedModules }, sectorMacro, zoneLookup)
        }),
        xenonStations: sector.xenonStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules }, 'xenon', sectorMacro, zoneLookup)
        }),
        khaakStations: sector.khaakStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules }, 'khaak', sectorMacro, zoneLookup)
        }),
        datavaults: sector.datavaults?.map((vault) => {
          const position = calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup
          )
          return { ...vault, position }
        }),
        erlkingVaults: sector.erlkingVaults?.map((vault) => {
          const position = calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup
          )
          return { ...vault, position }
        }),
        abandonedShips: sector.abandonedShips?.map((ship) => {
          const position = calculateFinalPosition(
            ship.relative_position,
            ship.zone_id,
            sectorMacro,
            zoneLookup
          )
          return { ...ship, position }
        })
      }
      
      return [sectorMacro, stripEmptySectorArrays(enrichedSector)]
    })
  )
  
  return {
    ...archive,
    meta: {
      ...archive.meta,
      parser_version: archive.meta.parser_version ?? CURRENT_PARSER_VERSION,
      post_processor_version: CURRENT_POST_PROCESSOR_VERSION
    },
    sectors,
    isValid: (archive.meta.parser_version ?? CURRENT_PARSER_VERSION) === CURRENT_PARSER_VERSION
  }
}
