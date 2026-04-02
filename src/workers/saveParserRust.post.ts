import type {
  AggregatedStationModule,
  FactionStationEntry,
  NpcStationEntry,
  PlayerStationEntry,
  PlayerStationModule,
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

function hasPlayerModulePattern(modules: PlayerStationModule[] | undefined, patterns: string[]): boolean {
  if (!modules || modules.length === 0) return false
  return modules.some((module) => {
    const ref = module.ref.toLowerCase()
    return patterns.some((pattern) => ref.includes(pattern))
  })
}

function enrichPlayerStation(station: PlayerStationEntry): PlayerStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()

  const isPiratebase = macro.includes('_piratebase')
  const isShipyard = hasPlayerModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
  const isWharf = hasPlayerModulePattern(modules, ['_ships_m_', '_ships_m'])
  const isEquipmentdock = hasPlayerModulePattern(modules, ['_equip'])
  const isFactory = hasPlayerModulePattern(modules, ['_prod'])
  const isTradestation = macro.includes('tradestation')
  const isDefence = hasPlayerModulePattern(modules, ['_def_', 'defence_'])
  const isHeadquarter = macro.includes('player_hq_') || station.is_headquarter

  let tag: string | undefined
  if (isPiratebase) tag = 'piratestation'
  else if (isShipyard) tag = 'shipyard'
  else if (isWharf) tag = 'wharf'
  else if (isEquipmentdock) tag = 'equipmentdock'
  else if (isFactory) tag = 'factory'
  else if (isTradestation) tag = 'tradestation'
  else if (isDefence) tag = 'defencestation'
  else tag = 'factory'

  return {
    ...station,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isFactory: isFactory || undefined,
    isPiratebase: isPiratebase || undefined,
    isDefence: isDefence || undefined,
    is_headquarter: isHeadquarter || undefined,
    tag
  }
}

function enrichNpcStation(station: NpcStationEntry): NpcStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()

  const isPiratebase = macro.includes('_piratebase')
  const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
  const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
  const isEquipmentdock = hasModulePattern(modules, ['_equip'])
  const isTradestation = macro.includes('tradestation')
  const isFactory = hasModulePattern(modules, ['_prod'])
  const isDefence = hasModulePattern(modules, ['_def_', 'defence_'])

  let tag: string | undefined
  if (isPiratebase) tag = 'piratebase'
  else if (isShipyard) tag = 'shipyard'
  else if (isWharf) tag = 'wharf'
  else if (isEquipmentdock) tag = 'equipmentdock'
  else if (isTradestation) tag = 'tradestation'
  else if (isFactory) tag = 'factory'
  else if (isDefence) tag = 'defence'
  else tag = 'factory'

  return {
    ...station,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isTradestation: isTradestation || undefined,
    isFactory: isFactory || undefined,
    isPiratebase: isPiratebase || undefined,
    isDefence: isDefence || undefined,
    tag
  }
}

function enrichFactionStation(station: FactionStationEntry, owner: 'xenon' | 'khaak'): FactionStationEntry {
  const modules = station.modules || []
  const macro = station.macro.toLowerCase()

  if (owner === 'xenon') {
    const isPiratebase = macro.includes('_piratebase')
    const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
    const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
    const isEquipmentdock = hasModulePattern(modules, ['_equip'])
    const isTradestation = macro.includes('tradestation')
    const isFactory = hasModulePattern(modules, ['_prod'])
    const isDefence = hasModulePattern(modules, ['_def_', 'defence_'])

    let tag: string | undefined
    if (isPiratebase) tag = 'piratebase'
    else if (isShipyard) tag = 'shipyard'
    else if (isWharf) tag = 'wharf'
    else if (isEquipmentdock) tag = 'equipmentdock'
    else if (isTradestation) tag = 'tradestation'
    else if (isFactory) tag = 'factory'
    else if (isDefence) tag = 'defence'
    else tag = 'factory'

    return {
      ...station,
      isShipyard: isShipyard || undefined,
      isWharf: isWharf || undefined,
      isEquipmentdock: isEquipmentdock || undefined,
      isTradestation: isTradestation || undefined,
      isPiratebase: isPiratebase || undefined,
      isDefence: isDefence || undefined,
      tag
    }
  }

  const isHive = macro.includes('landmarks_kha_hive_')
  const isNest = macro.includes('landmarks_kha_nest_')

  const tag = isHive ? 'hive' : isNest ? 'nest' : 'weaponplatform'

  return {
    ...station,
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

export function postProcessRustSaveArchive(archive: SaveArchive): SaveArchive {
  const sectors = Object.fromEntries(
    Object.entries(archive.sectors).map(([sectorMacro, sector]) => {
      const enrichedSector: SectorData = {
        ...sector,
        playerStations: sector.playerStations?.map((station) => enrichPlayerStation(station)),
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
