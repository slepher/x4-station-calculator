import type {
  AggregatedStationModule,
  FactionStationEntry,
  NpcStationEntry,
  PlayerStationEntry,
  SaveSectorClusterGateEntry,
  SaveSectorHighwayEntry,
  SaveSectorStaticPosition,
  SaveSectorSuperhighwayGateEntry,
  SaveArchive,
  SectorData
} from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'
import type { X4Map } from '@/types/x4'
import {
  classifyPlayerStationPoi,
  getFactoryGroup,
  getProductionProfile,
  hasModulePattern
} from '@/store/logic/stationPoiSemantics'
import shipsData from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'

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

interface SectorScaleBasisLookup {
  [sectorId: string]: {
    hex_inner_ratio: number
    extent_ratio: number
    fallback_scale_per_radius: number
  }
}

interface SectorStaticScalePointsLookup {
  [sectorId: string]: Array<{ x: number; z: number }>
}

interface SectorStaticClusterGateLookup {
  [sectorId: string]: SaveSectorClusterGateEntry[]
}

interface SectorStaticSuperhighwayGateLookup {
  [sectorId: string]: SaveSectorSuperhighwayGateEntry[]
}

interface SectorStaticHighwayLookup {
  [sectorId: string]: SaveSectorHighwayEntry[]
}

export const CURRENT_PARSER_VERSION = 'v2' as const
export const CURRENT_POST_PROCESSOR_VERSION = 'v9' as const
const SECTOR_CENTER_GRID = 64000
const DEFAULT_HEX_INNER_RATIO = Math.sqrt(3) / 2
const DEFAULT_EXTENT_RATIO = 0.8
function snapToSectorCenterGrid(value: number): number {
  return Math.round(value / SECTOR_CENTER_GRID) * SECTOR_CENTER_GRID
}

interface ShipLookupEntry {
  id: string
  purpose: string
}

interface ShipLookup {
  [macro: string]: ShipLookupEntry
}

function buildShipLookup(): ShipLookup {
  const lookup: ShipLookup = {}
  const ships = shipsData as Array<{ id: string; macro?: string; purposePrimary?: string }>
  for (const ship of ships) {
    if (ship.macro && ship.purposePrimary) {
      lookup[ship.macro] = {
        id: ship.id,
        purpose: ship.purposePrimary
      }
    }
  }
  return lookup
}

const SHIP_LOOKUP = buildShipLookup()

function buildZoneLookup(maps: X4Map | undefined): ZoneLookup {
  const lookup: ZoneLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
    if (!sector?.zones) continue
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
  
  return lookup
}

function buildSectorCenterLookup(maps: X4Map | undefined): SectorCenterLookup {
  const lookup: SectorCenterLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
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

  return lookup
}

function buildSectorScaleBasisLookup(maps: X4Map | undefined): SectorScaleBasisLookup {
  const lookup: SectorScaleBasisLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
    const normalized = sector.normalized as {
      scale_basis?: { hex_inner_ratio?: number; extent_ratio?: number }
      scale_per_radius?: number
    } | undefined
    lookup[sectorId.toLowerCase()] = {
      hex_inner_ratio: Number(normalized?.scale_basis?.hex_inner_ratio || DEFAULT_HEX_INNER_RATIO),
      extent_ratio: Number(normalized?.scale_basis?.extent_ratio || DEFAULT_EXTENT_RATIO),
      fallback_scale_per_radius: Number(normalized?.scale_per_radius || 0)
    }
  }

  return lookup
}

function buildSectorStaticScalePointsLookup(maps: X4Map | undefined): SectorStaticScalePointsLookup {
  const lookup: SectorStaticScalePointsLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
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
    lookup[sectorId.toLowerCase()] = points
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
  relativePosition: Vector3 | undefined,
  zoneId: string | undefined,
  sectorId: string,
  zoneLookup: ZoneLookup
): Vector3 {
  const basePosition = relativePosition || { x: 0, y: 0, z: 0 }
  if (!zoneId) {
    return basePosition
  }
  
  const sectorZones = zoneLookup[sectorId.toLowerCase()]
  if (!sectorZones) {
    return basePosition
  }
  
  const zonePosition = sectorZones[zoneId.toLowerCase()]
  if (!zonePosition) {
    return basePosition
  }

  return addVectors(zonePosition, basePosition)
}

function withTransformPosition(
  position: Vector3,
  sectorId: string,
  sectorScaleLookup: SectorScaleLookup,
  sectorCenterLookup: SectorCenterLookup
): Vector3 & { tx?: number; ty?: number } {
  const scale = sectorScaleLookup[sectorId.toLowerCase()] || 0
  if (!scale) return position
  const sectorCenter = sectorCenterLookup[sectorId.toLowerCase()] || { x: 0, y: 0, z: 0 }
  return {
    ...position,
    tx: (position.x - sectorCenter.x) * scale,
    ty: -(position.z - sectorCenter.z) * scale
  }
}

function collectSectorArchivePoiPoints(
  sector: SectorData,
  sectorId: string,
  zoneLookup: ZoneLookup
): Array<{ x: number; z: number }> {
  const points: Array<{ x: number; z: number }> = []
  const appendPoint = (relativePosition: Vector3 | undefined, zoneId?: string) => {
    const position = calculateFinalPosition(relativePosition, zoneId, sectorId, zoneLookup)
    points.push({ x: position.x, z: position.z })
  }

  sector.playerStations?.forEach((station) => appendPoint(station.relative_position, station.zone_id))
  sector.npcStations?.forEach((station) => appendPoint(station.relative_position, station.zone_id))
  sector.xenonStations?.forEach((station) => appendPoint(station.relative_position, station.zone_id))
  sector.khaakStations?.forEach((station) => appendPoint(station.relative_position, station.zone_id))
  sector.datavaults?.forEach((vault) => appendPoint(vault.relative_position, vault.zone_id))
  sector.erlkingVaults?.forEach((vault) => appendPoint(vault.relative_position, vault.zone_id))
  sector.abandonedShips?.forEach((ship) => appendPoint(ship.relative_position, ship.zone_id))

  return points
}

function buildArchiveSectorScaleLookup(
  archive: SaveArchive,
  maps: X4Map | undefined,
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup
): SectorScaleLookup {
  const lookup: SectorScaleLookup = {}
  const staticScalePointsLookup = buildSectorStaticScalePointsLookup(maps)
  const scaleBasisLookup = buildSectorScaleBasisLookup(maps)

  for (const [sectorId, sector] of Object.entries(archive.sectors || {})) {
    const sectorKey = sectorId.toLowerCase()
    const points = [
      ...(staticScalePointsLookup[sectorKey] || []),
      ...collectSectorArchivePoiPoints(sector, sectorId, zoneLookup)
    ]
    const scaleBasis = scaleBasisLookup[sectorKey]

    if (!points.length) {
      lookup[sectorKey] = scaleBasis?.fallback_scale_per_radius || 0
      continue
    }

    const sectorCenter = sectorCenterLookup[sectorKey] || { x: 0, y: 0, z: 0 }
    const maxExtent = Math.max(
      1,
      ...points.map((point) => Math.hypot(point.x - sectorCenter.x, point.z - sectorCenter.z))
    )
    const innerRatio = scaleBasis?.hex_inner_ratio || DEFAULT_HEX_INNER_RATIO
    const extentRatio = scaleBasis?.extent_ratio || DEFAULT_EXTENT_RATIO
    lookup[sectorKey] = (innerRatio * extentRatio) / maxExtent
  }

  return lookup
}

function buildSectorStaticClusterGateLookup(
  maps: X4Map | undefined,
  sectorScaleLookup: SectorScaleLookup,
  sectorCenterLookup: SectorCenterLookup
): SectorStaticClusterGateLookup {
  const lookup: SectorStaticClusterGateLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
    lookup[sectorId.toLowerCase()] = Object.entries(sector?.cluster_gates || {}).flatMap(([gateId, gate]) => {
      if (gate.raw_local_pos?.x === undefined || gate.raw_local_pos?.z === undefined) return []
      const position = {
        x: gate.raw_local_pos.x,
        y: 0,
        z: gate.raw_local_pos.z
      }
      return [{
        id: gateId,
        target_cluster_id: gate.target_cluster_id,
        position: withTransformPosition(position, sectorId, sectorScaleLookup, sectorCenterLookup)
      }]
    })
  }

  return lookup
}

function buildSectorStaticSuperhighwayGateLookup(
  maps: X4Map | undefined,
  sectorScaleLookup: SectorScaleLookup,
  sectorCenterLookup: SectorCenterLookup
): SectorStaticSuperhighwayGateLookup {
  const lookup: SectorStaticSuperhighwayGateLookup = {}
  if (!maps) return lookup

  for (const cluster of Object.values(maps.clusters || {})) {
    ;(cluster?.sectors || []).forEach((sectorId) => {
      lookup[sectorId.toLowerCase()] ||= []
    })

    Object.entries(cluster?.sector_links || {}).forEach(([linkId, link]) => {
      const sectorA = link.sector_a_id ? maps.sectors?.[link.sector_a_id] : undefined
      const sectorB = link.sector_b_id ? maps.sectors?.[link.sector_b_id] : undefined
      const zoneA = sectorA && link.from_zone_id ? sectorA.zones?.[link.from_zone_id] : undefined
      const zoneB = sectorB && link.to_zone_id ? sectorB.zones?.[link.to_zone_id] : undefined

      if (sectorA && zoneA?.raw_sector_pos?.x !== undefined && zoneA.raw_sector_pos?.z !== undefined) {
        const position = {
          x: zoneA.raw_sector_pos.x,
          y: zoneA.raw_sector_pos.y || 0,
          z: zoneA.raw_sector_pos.z
        }
        const sectorAKey = sectorA.id.toLowerCase()
        lookup[sectorAKey] ||= []
        lookup[sectorAKey].push({
          id: `${linkId}:from`,
          link_id: linkId,
          zone_id: link.from_zone_id || '',
          target_sector_id: sectorB?.id,
          position: withTransformPosition(position, sectorA.id, sectorScaleLookup, sectorCenterLookup)
        })
      }

      if (sectorB && zoneB?.raw_sector_pos?.x !== undefined && zoneB.raw_sector_pos?.z !== undefined) {
        const position = {
          x: zoneB.raw_sector_pos.x,
          y: zoneB.raw_sector_pos.y || 0,
          z: zoneB.raw_sector_pos.z
        }
        const sectorBKey = sectorB.id.toLowerCase()
        lookup[sectorBKey] ||= []
        lookup[sectorBKey].push({
          id: `${linkId}:to`,
          link_id: linkId,
          zone_id: link.to_zone_id || '',
          target_sector_id: sectorA?.id,
          position: withTransformPosition(position, sectorB.id, sectorScaleLookup, sectorCenterLookup)
        })
      }
    })
  }

  return lookup
}

function buildSectorStaticHighwayLookup(
  maps: X4Map | undefined,
  sectorScaleLookup: SectorScaleLookup,
  sectorCenterLookup: SectorCenterLookup
): SectorStaticHighwayLookup {
  const lookup: SectorStaticHighwayLookup = {}
  if (!maps) return lookup

  const toPosition = (position: Vector3, sectorId: string): SaveSectorStaticPosition =>
    withTransformPosition(position, sectorId, sectorScaleLookup, sectorCenterLookup)

  for (const [sectorId, sector] of Object.entries(maps.sectors || {})) {
    lookup[sectorId.toLowerCase()] = Object.entries(sector?.highways || {}).flatMap(([highwayId, highway]) => {
      const entry = highway.entry_pos || highway.entry
      const exit = highway.exit_pos || highway.exit
      if (!entry || !exit) return []

      return [{
        id: highwayId,
        entry: toPosition({
          x: entry.x ?? 0,
          y: entry.y ?? 0,
          z: entry.z ?? 0
        }, sectorId),
        exit: toPosition({
          x: exit.x ?? 0,
          y: exit.y ?? 0,
          z: exit.z ?? 0
        }, sectorId),
        spline: Array.isArray(highway.spline)
          ? highway.spline
            .filter((point): point is Vector3 =>
              typeof point?.x === 'number' &&
              typeof point?.z === 'number'
            )
            .map((point) => toPosition({
              x: point.x,
              y: point.y ?? 0,
              z: point.z
            }, sectorId))
          : []
      }]
    })
  }

  return lookup
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

function enrichPlayerStation(
  station: PlayerStationEntry,
  sectorId: string,
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup,
  sectorScaleLookup: SectorScaleLookup,
  modulesByMacroId?: Record<string, X4Module>
): PlayerStationEntry {
  const modules = station.modules || []
  const classification = classifyPlayerStationPoi({
    macro: station.macro,
    modules,
    isHeadquarter: station.is_headquarter,
    modulesByMacroId
  })
  
  const position = withTransformPosition(calculateFinalPosition(
    station.relative_position,
    station.zone_id,
    sectorId,
    zoneLookup
  ), sectorId, sectorScaleLookup, sectorCenterLookup)
  const { productionProfile, profileName } = getProductionProfile(modules, modulesByMacroId)
  
  return {
    ...station,
    position,
    isShipyard: classification.isShipyard,
    isWharf: classification.isWharf,
    isEquipmentdock: classification.isEquipmentdock,
    isFactory: classification.isFactory,
    factoryGroup: classification.factoryGroup,
    productionProfile,
    profileName,
    isPiratebase: classification.isPiratebase,
    isDefencemodule: classification.isDefencemodule,
    is_headquarter: classification.is_headquarter,
    tag: classification.tag
  }
}

function enrichNpcStation(
  station: NpcStationEntry,
  sectorId: string,
  zoneLookup: ZoneLookup,
  sectorCenterLookup: SectorCenterLookup,
  sectorScaleLookup: SectorScaleLookup,
  modulesByMacroId?: Record<string, X4Module>
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
    zoneLookup
  ), sectorId, sectorScaleLookup, sectorCenterLookup)
  const { productionProfile, profileName } = getProductionProfile(modules, modulesByMacroId)
  
  return {
    ...station,
    position,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isTradestation: isTradestation || undefined,
    isFactory: isFactory || undefined,
    factoryGroup: factoryGroup !== 'factory' ? factoryGroup : undefined,
    productionProfile,
    profileName,
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
      zoneLookup
    ), sectorId, sectorScaleLookup, sectorCenterLookup)
    
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
    zoneLookup
  ), sectorId, sectorScaleLookup, sectorCenterLookup)
  
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
    owner: sector.owner,
    scale_per_radius: sector.scale_per_radius
  }
  
  if (sector.clusterGates?.length) nextSector.clusterGates = sector.clusterGates
  if (sector.superhighwayGates?.length) nextSector.superhighwayGates = sector.superhighwayGates
  if (sector.highways?.length) nextSector.highways = sector.highways
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
  const sectorScaleLookup = buildArchiveSectorScaleLookup(archive, maps, zoneLookup, sectorCenterLookup)
  const sectorStaticClusterGateLookup = buildSectorStaticClusterGateLookup(maps, sectorScaleLookup, sectorCenterLookup)
  const sectorStaticSuperhighwayGateLookup = buildSectorStaticSuperhighwayGateLookup(maps, sectorScaleLookup, sectorCenterLookup)
  const sectorStaticHighwayLookup = buildSectorStaticHighwayLookup(maps, sectorScaleLookup, sectorCenterLookup)
  
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      let enrichedSector: SectorData = {
        ...sector,
        scale_per_radius: sectorScaleLookup[sectorMacro.toLowerCase()] || undefined,
        clusterGates: sectorStaticClusterGateLookup[sectorMacro.toLowerCase()] || [],
        superhighwayGates: sectorStaticSuperhighwayGateLookup[sectorMacro.toLowerCase()] || [],
        highways: sectorStaticHighwayLookup[sectorMacro.toLowerCase()] || [],
        playerStations: sector.playerStations?.map((station) => {
          const enrichedModules = modulesByMacroId 
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichPlayerStation(
            { ...station, modules: enrichedModules },
            sectorMacro,
            zoneLookup,
            sectorCenterLookup,
            sectorScaleLookup,
            modulesByMacroId
          )
        }),
        npcStations: sector.npcStations?.map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichNpcStation(
            { ...station, modules: enrichedModules },
            sectorMacro,
            zoneLookup,
            sectorCenterLookup,
            sectorScaleLookup,
            modulesByMacroId
          )
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
            zoneLookup
          ), sectorMacro, sectorScaleLookup, sectorCenterLookup)
          return { ...vault, position }
        }),
        erlkingVaults: sector.erlkingVaults?.map((vault) => {
          const position = withTransformPosition(calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup
          ), sectorMacro, sectorScaleLookup, sectorCenterLookup)
          return { ...vault, position }
        }),
        abandonedShips: sector.abandonedShips?.filter((ship) => {
          return SHIP_LOOKUP[ship.macro] !== undefined
        }).map((ship) => {
          const position = withTransformPosition(calculateFinalPosition(
            ship.relative_position,
            ship.zone_id,
            sectorMacro,
            zoneLookup
          ), sectorMacro, sectorScaleLookup, sectorCenterLookup)
          const shipEntry = SHIP_LOOKUP[ship.macro]
          return { ...ship, position, shipId: shipEntry?.id, purpose: shipEntry?.purpose }
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
