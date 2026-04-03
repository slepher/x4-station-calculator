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

interface SectorCenterLookup {
  [sectorId: string]: Vector3
}

interface SectorScaleLookup {
  [sectorId: string]: number
}

export const CURRENT_PARSER_VERSION = 'v2' as const
export const CURRENT_POST_PROCESSOR_VERSION = 'v2' as const
const SECTOR_CENTER_GRID = 64000
const DEFAULT_HEX_INNER_RATIO = Math.sqrt(3) / 2
const DEFAULT_EXTENT_RATIO = 0.8

function snapToSectorCenterGrid(value: number): number {
  return Math.round(value / SECTOR_CENTER_GRID) * SECTOR_CENTER_GRID
}

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
        const rawSectorPos = zone.raw_sector_pos
        if (!rawSectorPos || rawSectorPos.x === undefined || rawSectorPos.y === undefined || rawSectorPos.z === undefined) continue
        lookup[normalizedSectorId][zoneId.toLowerCase()] = {
          x: rawSectorPos.x,
          y: rawSectorPos.y,
          z: rawSectorPos.z
        }
      }
    }
  }
  
  return lookup
}

function buildSectorCenterLookup(maps: X4Map | undefined): SectorCenterLookup {
  const lookup: SectorCenterLookup = {}
  if (!maps) return lookup

  for (const cluster of Object.values(maps.clusters || {})) {
    for (const [sectorId, sector] of Object.entries(cluster?.sectors || {})) {
      if (sector.raw_center_pos?.x !== undefined && sector.raw_center_pos?.y !== undefined && sector.raw_center_pos?.z !== undefined) {
        lookup[sectorId.toLowerCase()] = {
          x: sector.raw_center_pos.x,
          y: sector.raw_center_pos.y,
          z: sector.raw_center_pos.z
        }
        continue
      }

      const positions = Object.values(sector?.zones || {})
        .map((zone) => zone.raw_sector_pos)
        .filter((position): position is Vector3 => Boolean(position))

      if (!positions.length) continue

      const minX = Math.min(...positions.map((position) => position.x))
      const maxX = Math.max(...positions.map((position) => position.x))
      const minY = Math.min(...positions.map((position) => position.y))
      const maxY = Math.max(...positions.map((position) => position.y))
      const minZ = Math.min(...positions.map((position) => position.z))
      const maxZ = Math.max(...positions.map((position) => position.z))

      lookup[sectorId.toLowerCase()] = {
        x: snapToSectorCenterGrid((minX + maxX) / 2),
        y: (minY + maxY) / 2,
        z: snapToSectorCenterGrid((minZ + maxZ) / 2)
      }
    }
  }

  return lookup
}

function buildSectorScaleLookup(maps: X4Map | undefined): SectorScaleLookup {
  const lookup: SectorScaleLookup = {}
  if (!maps) return lookup

  for (const cluster of Object.values(maps.clusters || {})) {
    for (const [sectorId, sector] of Object.entries(cluster?.sectors || {})) {
      const points: Array<{ x: number; z: number }> = []
      Object.values(sector?.zones || {}).forEach((zone) => {
        if (zone.raw_sector_pos?.x !== undefined && zone.raw_sector_pos?.z !== undefined) {
          points.push({ x: zone.raw_sector_pos.x, z: zone.raw_sector_pos.z })
        }
      })
      Object.values(sector?.cluster_gates || {}).forEach((gate) => {
        if (gate.raw_local_pos?.x !== undefined && gate.raw_local_pos?.z !== undefined) {
          points.push({ x: gate.raw_local_pos.x, z: gate.raw_local_pos.z })
        }
      })

      if (!points.length) {
        lookup[sectorId.toLowerCase()] = Number(sector.normalized?.scale_per_radius || 0)
        continue
      }

      const centerX = sector.raw_center_pos?.x !== undefined
        ? sector.raw_center_pos.x
        : snapToSectorCenterGrid((Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2)
      const centerZ = sector.raw_center_pos?.z !== undefined
        ? sector.raw_center_pos.z
        : snapToSectorCenterGrid((Math.min(...points.map((point) => point.z)) + Math.max(...points.map((point) => point.z))) / 2)
      const maxExtent = Math.max(
        1,
        ...points.map((point) => Math.hypot(point.x - centerX, point.z - centerZ))
      )
      const innerRatio = Number((sector.normalized as { scale_basis?: { hex_inner_ratio?: number } } | undefined)?.scale_basis?.hex_inner_ratio || DEFAULT_HEX_INNER_RATIO)
      const extentRatio = Number((sector.normalized as { scale_basis?: { extent_ratio?: number } } | undefined)?.scale_basis?.extent_ratio || DEFAULT_EXTENT_RATIO)
      lookup[sectorId.toLowerCase()] = (innerRatio * extentRatio) / maxExtent
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

function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  }
}

function calculateFinalPosition(
  relativePosition: Vector3 | undefined,
  zoneId: string | undefined,
  sectorId: string,
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup
): Vector3 {
  const basePosition = relativePosition || { x: 0, y: 0, z: 0 }
  const sectorCenter = sectorCenterLookup[sectorId.toLowerCase()] || { x: 0, y: 0, z: 0 }
  if (!zoneId) {
    return subtractVectors(basePosition, sectorCenter)
  }
  
  const sectorZones = zoneLookup[sectorId.toLowerCase()]
  if (!sectorZones) {
    return subtractVectors(basePosition, sectorCenter)
  }
  
  const zonePosition = sectorZones[zoneId.toLowerCase()]
  if (!zonePosition) {
    return subtractVectors(basePosition, sectorCenter)
  }

  return subtractVectors(addVectors(zonePosition, basePosition), sectorCenter)
}

function withTransformPosition(position: Vector3, sectorId: string, sectorScaleLookup: SectorScaleLookup): Vector3 & { tx?: number; ty?: number } {
  const scale = sectorScaleLookup[sectorId.toLowerCase()] || 0
  if (!scale) return position
  return {
    ...position,
    tx: position.x * scale,
    ty: -position.z * scale
  }
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
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup,
  sectorScaleLookup: SectorScaleLookup
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
  
  const position = withTransformPosition(calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup,
    sectorCenterLookup
  ), sectorId, sectorScaleLookup)
  
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
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup,
  sectorScaleLookup: SectorScaleLookup
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
  
  const position = withTransformPosition(calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup,
    sectorCenterLookup
  ), sectorId, sectorScaleLookup)
  
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
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup,
  sectorScaleLookup: SectorScaleLookup
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
    
    const position = withTransformPosition(calculateFinalPosition(
      station.relative_position,
      station.zone_id,
      sectorId,
      zoneLookup,
      sectorCenterLookup
    ), sectorId, sectorScaleLookup)
    
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
  
  const position = withTransformPosition(calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup,
    sectorCenterLookup
  ), sectorId, sectorScaleLookup)
  
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
  const sectorCenterLookup = buildSectorCenterLookup(maps)
  const sectorScaleLookup = buildSectorScaleLookup(maps)
  
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      let enrichedSector: SectorData = {
        ...sector,
        playerStations: sector.playerStations?.map((station) => {
          const enrichedModules = modulesByMacroId 
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichPlayerStation({ ...station, modules: enrichedModules }, sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        }),
        npcStations: sector.npcStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichNpcStation({ ...station, modules: enrichedModules }, sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        }),
        xenonStations: sector.xenonStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules }, 'xenon', sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        }),
        khaakStations: sector.khaakStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules }, 'khaak', sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        }),
        datavaults: sector.datavaults?.map((vault) => {
          const position = withTransformPosition(calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup,
            sectorCenterLookup
          ), sectorMacro, sectorScaleLookup)
          return { ...vault, position }
        }),
        erlkingVaults: sector.erlkingVaults?.map((vault) => {
          const position = withTransformPosition(calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup,
            sectorCenterLookup
          ), sectorMacro, sectorScaleLookup)
          return { ...vault, position }
        }),
        abandonedShips: sector.abandonedShips?.map((ship) => {
          const position = withTransformPosition(calculateFinalPosition(
            ship.relative_position,
            ship.zone_id,
            sectorMacro,
            zoneLookup,
            sectorCenterLookup
          ), sectorMacro, sectorScaleLookup)
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
