import type {
  AggregatedStationModule,
  FactionStationEntry,
  NpcStationEntry,
  SaveArchive,
  SectorData
} from '@/types/saveArchive'

function hasModulePattern(modules: AggregatedStationModule[] | undefined, patterns: string[]): boolean {
  if (!modules || modules.length === 0) return false
  return modules.some((module) => {
    const ref = module.ref.toLowerCase()
    return patterns.some((pattern) => ref.includes(pattern))
  })
}

function enrichNpcStation(station: NpcStationEntry): NpcStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()
  return {
    ...station,
    isShipyard: hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x']) || undefined,
    isWharf: hasModulePattern(modules, ['_ships_m_', '_ships_m']) || undefined,
    isEquipmentdock: hasModulePattern(modules, ['_equip']) || undefined,
    isTradestation: macro.includes('tradestation') || undefined
  }
}

function enrichFactionStation(station: FactionStationEntry, owner: 'xenon' | 'khaak'): FactionStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()
  if (owner === 'xenon') {
    return {
      ...station,
      isShipyard: hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x']) || undefined,
      isWharf: hasModulePattern(modules, ['_ships_m_', '_ships_m']) || undefined,
      isEquipmentdock: hasModulePattern(modules, ['_equip']) || undefined,
      isTradestation: macro.includes('tradestation') || undefined
    }
  }

  return {
    ...station,
    isNest: macro.includes('landmarks_kha_nest_') || undefined,
    isHive: macro.includes('landmarks_kha_hive_') || undefined
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

export function postProcessRustSaveArchive(archive: SaveArchive): SaveArchive {
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      const enrichedSector: SectorData = {
        ...sector,
        npcStations: sector.npcStations?.map((station) => enrichNpcStation(station)),
        xenonStations: sector.xenonStations?.map((station) => enrichFactionStation(station, 'xenon')),
        khaakStations: sector.khaakStations?.map((station) => enrichFactionStation(station, 'khaak'))
      }

      return [sectorMacro, stripEmptySectorArrays(enrichedSector)]
    })
  )

  return {
    ...archive,
    sectors
  }
}
