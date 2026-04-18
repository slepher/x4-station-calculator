import type {
  AggregatedStationModule,
  FactionStationEntry,
  NpcStationEntry,
  PlayerStationEntry,
  AggregatedEquipment,
  SaveSectorClusterGateEntry,
  SaveSectorHighwayEntry,
  SaveSectorStaticPosition,
  SaveSectorSuperhighwayGateEntry,
  SaveArchive,
  SectorData,
  PlayerStationConstruction
} from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'
import type { X4Equipment, X4Map, X4Ship } from '@/types/x4'
import {
  classifyPlayerStationPoi,
  getFactoryGroup,
  getProductionProfile,
  hasModulePattern
} from '@/store/logic/stationPoiSemantics'

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

export const CURRENT_PARSER_VERSION = 'v5' as const
export const CURRENT_POST_PROCESSOR_VERSION = 'v11' as const
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

interface MapZone {
  raw_sector_pos?: Vector3
}

interface MapGate {
  raw_local_pos?: Vector3
  target_cluster_id?: string
  target_sector_id?: string
}

interface MapHighwayEndpoint {
  x?: number
  y?: number
  z?: number
}

interface MapHighway {
  entry_pos?: MapHighwayEndpoint
  entry?: MapHighwayEndpoint
  exit_pos?: MapHighwayEndpoint
  exit?: MapHighwayEndpoint
  spline?: MapHighwayEndpoint[]
}

interface MapSector {
  id?: string
  raw_center_pos?: Vector3
  normalized?: {
    scale_basis?: { hex_inner_ratio?: number; extent_ratio?: number }
    scale_per_radius?: number
  }
  zones?: Record<string, MapZone>
  cluster_gates?: Record<string, MapGate>
  highways?: Record<string, MapHighway>
}

function recordValues<T>(record: Record<string, T> | undefined): T[] {
  return record ? Object.values(record) : []
}

function mapByCode<T extends { code: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.code, item]))
}

function equipmentIdFromRef(ref: string): string {
  return ref.endsWith('_macro') ? ref.slice(0, -6) : ref
}

function buildEquipmentLookup(equipments: X4Equipment[] | undefined): Record<string, X4Equipment> {
  const lookup: Record<string, X4Equipment> = {}
  if (!equipments) return lookup
  for (const equipment of equipments) {
    lookup[`${equipment.id}_macro`] = equipment
  }
  return lookup
}

function getMapsSectors(maps: X4Map | undefined): Record<string, MapSector> {
  if (!maps) return {}
  if (maps.sectors && Object.keys(maps.sectors).length > 0) {
    return maps.sectors as Record<string, MapSector>
  }

  const sectors: Record<string, MapSector> = {}
  for (const cluster of Object.values(maps.clusters || {})) {
    if (!cluster?.sectors || Array.isArray(cluster.sectors)) continue
    Object.assign(sectors, cluster.sectors as Record<string, MapSector>)
  }
  return sectors
}

function buildShipLookup(ships: X4Ship[] | undefined): ShipLookup {
  const lookup: ShipLookup = {}
  if (!ships) return lookup
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

function buildZoneLookup(maps: X4Map | undefined): ZoneLookup {
  const lookup: ZoneLookup = {}
  if (!maps) return lookup

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
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

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
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

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
    const normalized = sector.normalized
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

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
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

  recordValues(sector.player_stations).forEach((station) => appendPoint(station.relative_position, station.zone_id))
  recordValues(sector.npc_stations).forEach((station) => appendPoint(station.relative_position, station.zone_id))
  recordValues(sector.xenon_stations).forEach((station) => appendPoint(station.relative_position, station.zone_id))
  recordValues(sector.khaak_stations).forEach((station) => appendPoint(station.relative_position, station.zone_id))
  recordValues(sector.datavaults).forEach((vault) => appendPoint(vault.relative_position, vault.zone_id))
  recordValues(sector.erlking_vaults).forEach((vault) => appendPoint(vault.relative_position, vault.zone_id))
  recordValues(sector.abandoned_ships).forEach((ship) => appendPoint(ship.relative_position, ship.zone_id))

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

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
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

  const sectors = getMapsSectors(maps)
  for (const cluster of Object.values(maps.clusters || {})) {
    const sectorIds = Array.isArray(cluster?.sectors)
      ? cluster.sectors
      : Object.keys(cluster?.sectors || {})
    sectorIds.forEach((sectorId) => {
      lookup[sectorId.toLowerCase()] ||= []
    })

    Object.entries(cluster?.sector_links || {}).forEach(([linkId, link]) => {
      const sectorA = link.sector_a_id ? sectors[link.sector_a_id] : undefined
      const sectorB = link.sector_b_id ? sectors[link.sector_b_id] : undefined
      const zoneA = sectorA && link.from_zone_id ? sectorA.zones?.[link.from_zone_id] : undefined
      const zoneB = sectorB && link.to_zone_id ? sectorB.zones?.[link.to_zone_id] : undefined

      if (sectorA && zoneA?.raw_sector_pos?.x !== undefined && zoneA.raw_sector_pos?.z !== undefined) {
        const position = {
          x: zoneA.raw_sector_pos.x,
          y: zoneA.raw_sector_pos.y || 0,
          z: zoneA.raw_sector_pos.z
        }
        const sectorAId = sectorA.id || link.sector_a_id || ''
        const sectorAKey = sectorAId.toLowerCase()
        lookup[sectorAKey] ||= []
        lookup[sectorAKey].push({
          id: `${linkId}:from`,
          link_id: linkId,
          zone_id: link.from_zone_id || '',
          target_sector_id: sectorB?.id,
          position: withTransformPosition(position, sectorAId, sectorScaleLookup, sectorCenterLookup)
        })
      }

      if (sectorB && zoneB?.raw_sector_pos?.x !== undefined && zoneB.raw_sector_pos?.z !== undefined) {
        const position = {
          x: zoneB.raw_sector_pos.x,
          y: zoneB.raw_sector_pos.y || 0,
          z: zoneB.raw_sector_pos.z
        }
        const sectorBId = sectorB.id || link.sector_b_id || ''
        const sectorBKey = sectorBId.toLowerCase()
        lookup[sectorBKey] ||= []
        lookup[sectorBKey].push({
          id: `${linkId}:to`,
          link_id: linkId,
          zone_id: link.to_zone_id || '',
          target_sector_id: sectorA?.id,
          position: withTransformPosition(position, sectorBId, sectorScaleLookup, sectorCenterLookup)
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

  for (const [sectorId, sector] of Object.entries(getMapsSectors(maps))) {
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

function aggregateModules(
  constructions: PlayerStationConstruction[],
  excludeIds: Set<string> = new Set()
): AggregatedStationModule[] {
  const counts: Record<string, number> = {}
  
  for (const c of constructions) {
    if (excludeIds.has(c.id || '')) continue
    counts[c.ref] = (counts[c.ref] || 0) + 1
  }
  
  return Object.entries(counts).map(([ref, amount]) => ({ ref, amount }))
}

function aggregateEquipments(
  constructions: PlayerStationConstruction[],
  excludeIds: Set<string> = new Set()
): AggregatedEquipment[] {
  const totals: Record<string, { type: 'shields' | 'turrets'; amount: number }> = {}
  
  for (const c of constructions) {
    if (excludeIds.has(c.id || '')) continue
    for (const e of c.equipments || []) {
      const key = e.ref
      if (!totals[key]) {
        totals[key] = { type: e.type, amount: 0 }
      }
      totals[key].amount += e.exact
    }
  }
  
  return Object.entries(totals).map(([ref, data]) => ({ type: data.type, ref, amount: data.amount }))
}

function subtractAggregatedModules(
  base: AggregatedStationModule[],
  subtract: AggregatedStationModule[]
): AggregatedStationModule[] {
  const subtractMap = new Map(subtract.map(m => [m.ref, m.amount]))
  
  return base
    .map(module => ({
      ref: module.ref,
      amount: module.amount - (subtractMap.get(module.ref) || 0)
    }))
    .filter(m => m.amount > 0)
}

function subtractAggregatedEquipments(
  base: AggregatedEquipment[],
  subtract: AggregatedEquipment[]
): AggregatedEquipment[] {
  const subtractMap = new Map(subtract.map(e => [e.ref, e.amount]))
  
  return base
    .map(equipment => ({
      type: equipment.type,
      ref: equipment.ref,
      amount: equipment.amount - (subtractMap.get(equipment.ref) || 0)
    }))
    .filter(e => e.amount > 0)
}

function aggregateSectorPlayerStations(sector: SectorData): SectorData {
  if (!hasEntries(sector.player_stations)) return sector
  
  const aggregatedStations = recordValues(sector.player_stations).map((station) => {
    const constructions = station.constructions || []
    
    const buildstorageCode = station.buildstorage_code
    const buildstorage = buildstorageCode 
      ? sector.player_buildstorages?.[buildstorageCode] 
      : undefined
    
    const excludeIds = new Set<string>()
    if (buildstorage?.progress?.sequenceindex !== undefined) {
      const seqIndex = buildstorage.progress.sequenceindex
      const bsConstructions = buildstorage.constructions || []
      const inProgressConstruction = bsConstructions[seqIndex]
      if (inProgressConstruction?.id) {
        excludeIds.add(inProgressConstruction.id)
      }
    }
    
    const modules = aggregateModules(constructions, excludeIds)
    const equipments = aggregateEquipments(constructions, excludeIds)
    
    const tag = modules.length === 0 ? 'constructionsite' : station.tag
    
    return {
      ...station,
      modules,
      equipments,
      tag
    }
  })
  
  return {
    ...sector,
    player_stations: mapByCode(aggregatedStations)
  }
}

function aggregateSectorPlayerBuildstorages(sector: SectorData): SectorData {
  if (!hasEntries(sector.player_buildstorages)) return sector
  
  const aggregatedBuildstorages = recordValues(sector.player_buildstorages).map((buildstorage) => {
    const constructions = buildstorage.constructions || []
    
    const rawModules = aggregateModules(constructions)
    const rawEquipments = aggregateEquipments(constructions)
    
    const stationCode = buildstorage.station_code
    const station = stationCode ? sector.player_stations?.[stationCode] : undefined
    
    const stationModules = station?.modules || []
    const stationEquipments = station?.equipments || []
    
    const modules = subtractAggregatedModules(rawModules, stationModules)
    const equipments = subtractAggregatedEquipments(rawEquipments, stationEquipments)
    
    return {
      ...buildstorage,
      modules,
      equipments
    }
  })
  
  return {
    ...sector,
    player_buildstorages: mapByCode(aggregatedBuildstorages)
  }
}

function enrichModulesWithGameData(
  modules: AggregatedStationModule[] | undefined,
  modulesByMacroId: Record<string, X4Module>
): AggregatedStationModule[] | undefined {
  if (!modules || modules.length === 0) return modules

  return modules.map(module => {
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

function enrichEquipmentsWithGameData(
  equipments: AggregatedEquipment[] | undefined,
  equipmentLookup: Record<string, X4Equipment>
): AggregatedEquipment[] | undefined {
  if (!equipments || equipments.length === 0) return equipments

  return equipments.map(equipment => {
    const matchedEquipment = equipmentLookup[equipment.ref]
    return {
      ...equipment,
      equipment_id: matchedEquipment?.id || equipmentIdFromRef(equipment.ref)
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

function hasEntries<T>(record: Record<string, T> | undefined): boolean {
  return Boolean(record && Object.keys(record).length > 0)
}

function stripEmptySectorCollections(sector: SectorData): SectorData {
  const nextSector: SectorData = {
    name: sector.name,
    is_known: sector.is_known,
    owner: sector.owner,
    scale_per_radius: sector.scale_per_radius
  }
  
  if (sector.clusterGates?.length) nextSector.clusterGates = sector.clusterGates
  if (sector.superhighwayGates?.length) nextSector.superhighwayGates = sector.superhighwayGates
  if (sector.highways?.length) nextSector.highways = sector.highways
  if (hasEntries(sector.player_stations)) nextSector.player_stations = sector.player_stations
  if (hasEntries(sector.xenon_stations)) nextSector.xenon_stations = sector.xenon_stations
  if (hasEntries(sector.khaak_stations)) nextSector.khaak_stations = sector.khaak_stations
  if (hasEntries(sector.npc_stations)) nextSector.npc_stations = sector.npc_stations
  if (hasEntries(sector.player_buildstorages)) nextSector.player_buildstorages = sector.player_buildstorages
  if (hasEntries(sector.datavaults)) nextSector.datavaults = sector.datavaults
  if (hasEntries(sector.erlking_vaults)) nextSector.erlking_vaults = sector.erlking_vaults
  if (hasEntries(sector.abandoned_ships)) nextSector.abandoned_ships = sector.abandoned_ships
  
  return nextSector
}

function attachSectorBuildstorages(sector: SectorData): SectorData {
  const buildstorages = recordValues(sector.player_buildstorages)
  if (!buildstorages.length) return sector
  if (!hasEntries(sector.player_stations)) {
    return {
      ...sector,
      player_buildstorages: mapByCode(buildstorages)
    }
  }

  const stationById = new Map<string, PlayerStationEntry>()
  for (const station of recordValues(sector.player_stations)) {
    if (!station.component_id || stationById.has(station.component_id)) continue
    stationById.set(station.component_id, station)
  }

  const buildstorageCodeByStationId = new Map<string, string>()
  const linkedBuildstorages = buildstorages.map((buildstorage) => {
    const stationId = buildstorage.target_station_component_id
    const station = stationId ? stationById.get(stationId) : undefined
    if (stationId && station?.code && !buildstorageCodeByStationId.has(stationId)) {
      buildstorageCodeByStationId.set(stationId, buildstorage.code)
    }

    return {
      ...buildstorage,
      station_code: station?.code
    }
  })

  return {
    ...sector,
    player_buildstorages: mapByCode(linkedBuildstorages),
    player_stations: mapByCode(recordValues(sector.player_stations).map((station) => ({
      ...station,
      buildstorage_code: station.component_id
        ? buildstorageCodeByStationId.get(station.component_id)
        : undefined
    })))
  }
}

export function postProcessRustSaveArchive(
  archive: SaveArchive, 
  modulesByMacroId?: Record<string, X4Module>,
  maps?: X4Map,
  ships?: X4Ship[],
  equipments?: X4Equipment[]
): SaveArchive {
  const SHIP_LOOKUP = buildShipLookup(ships)
  const EQUIPMENT_LOOKUP = buildEquipmentLookup(equipments)
  const zoneLookup = buildZoneLookup(maps)
  const sectorCenterLookup = buildSectorCenterLookup(maps)
  const sectorScaleLookup = buildArchiveSectorScaleLookup(archive, maps, zoneLookup, sectorCenterLookup)
  const sectorStaticClusterGateLookup = buildSectorStaticClusterGateLookup(maps, sectorScaleLookup, sectorCenterLookup)
  const sectorStaticSuperhighwayGateLookup = buildSectorStaticSuperhighwayGateLookup(maps, sectorScaleLookup, sectorCenterLookup)
  const sectorStaticHighwayLookup = buildSectorStaticHighwayLookup(maps, sectorScaleLookup, sectorCenterLookup)
  
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      let processedSector = attachSectorBuildstorages(sector)
      processedSector = aggregateSectorPlayerStations(processedSector)
      processedSector = aggregateSectorPlayerBuildstorages(processedSector)
      
      let enrichedSector: SectorData = {
        ...processedSector,
        scale_per_radius: sectorScaleLookup[sectorMacro.toLowerCase()] || undefined,
        clusterGates: sectorStaticClusterGateLookup[sectorMacro.toLowerCase()] || [],
        superhighwayGates: sectorStaticSuperhighwayGateLookup[sectorMacro.toLowerCase()] || [],
        highways: sectorStaticHighwayLookup[sectorMacro.toLowerCase()] || [],
        player_stations: mapByCode(recordValues(processedSector.player_stations).map((station) => {
          const enrichedModules = modulesByMacroId 
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichPlayerStation(
            { ...station, modules: enrichedModules, equipments: enrichEquipmentsWithGameData(station.equipments, EQUIPMENT_LOOKUP) },
            sectorMacro,
            zoneLookup,
            sectorCenterLookup,
            sectorScaleLookup,
            modulesByMacroId
          )
        })),
        npc_stations: mapByCode(recordValues(processedSector.npc_stations).map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichNpcStation(
            { ...station, modules: enrichedModules, equipments: enrichEquipmentsWithGameData(station.equipments, EQUIPMENT_LOOKUP) },
            sectorMacro,
            zoneLookup,
            sectorCenterLookup,
            sectorScaleLookup,
            modulesByMacroId
          )
        })),
        xenon_stations: mapByCode(recordValues(processedSector.xenon_stations).map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules, equipments: enrichEquipmentsWithGameData(station.equipments, EQUIPMENT_LOOKUP) }, 'xenon', sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        })),
        khaak_stations: mapByCode(recordValues(processedSector.khaak_stations).map((station) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(station.modules, modulesByMacroId)
            : station.modules
          return enrichFactionStation({ ...station, modules: enrichedModules, equipments: enrichEquipmentsWithGameData(station.equipments, EQUIPMENT_LOOKUP) }, 'khaak', sectorMacro, zoneLookup, sectorCenterLookup, sectorScaleLookup)
        })),
        player_buildstorages: mapByCode(recordValues(processedSector.player_buildstorages).map((buildstorage) => {
          const enrichedModules = modulesByMacroId
            ? enrichModulesWithGameData(buildstorage.modules, modulesByMacroId)
            : buildstorage.modules
          return {
            ...buildstorage,
            modules: enrichedModules,
            equipments: enrichEquipmentsWithGameData(buildstorage.equipments, EQUIPMENT_LOOKUP)
          }
        })),
        datavaults: mapByCode(recordValues(processedSector.datavaults).map((vault) => {
          const position = withTransformPosition(calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup
          ), sectorMacro, sectorScaleLookup, sectorCenterLookup)
          return { ...vault, position }
        })),
        erlking_vaults: mapByCode(recordValues(sector.erlking_vaults).map((vault) => {
          const position = withTransformPosition(calculateFinalPosition(
            vault.relative_position,
            vault.zone_id,
            sectorMacro,
            zoneLookup
          ), sectorMacro, sectorScaleLookup, sectorCenterLookup)
          return { ...vault, position }
        })),
        abandoned_ships: mapByCode(recordValues(sector.abandoned_ships).filter((ship) => {
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
        }))
      }

      enrichedSector = attachSectorBuildstorages(enrichedSector)
      
      return [sectorMacro, stripEmptySectorCollections(enrichedSector)]
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
