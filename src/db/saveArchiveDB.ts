import Dexie, { type Table } from 'dexie'
import type {
  SaveArchive,
  SaveResearchRuntime,
  PlayerStationEntry,
  BuildStorageEntry,
  SectorData,
  PlayerStationsRecord,
  ArchiveDataRecord,
  PlayerStationRecord,
  PlayerStationType
} from '@/types/saveArchive'

export type { PlayerStationsRecord, ArchiveDataRecord, PlayerStationRecord, PlayerStationType }

interface GameDataStoreLike {
  getIndexedDBName?: () => string
}

const DEFAULT_DB_NAME = 'x4_save_archive_db'

const dbCache = new Map<string, X4SaveArchiveDB>()

function getDBName(gameDataStore: GameDataStoreLike): string {
  return gameDataStore.getIndexedDBName?.() ?? DEFAULT_DB_NAME
}

class X4SaveArchiveDB extends Dexie {
  archive_data!: Table<ArchiveDataRecord>
  player_stations!: Table<PlayerStationsRecord>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      archive_data: 'id, archiveId, guid',
      player_stations: 'id, archiveId, guid'
    })
  }
}

function getDB(gameDataStore: GameDataStoreLike): X4SaveArchiveDB {
  const dbName = getDBName(gameDataStore)
  let db = dbCache.get(dbName)
  if (!db) {
    db = new X4SaveArchiveDB(dbName)
    dbCache.set(dbName, db)
  }
  return db
}

export function createArchiveId(guid: string, time: number): string {
  return `${guid}_${time}`
}

const defaultResearchRuntime: SaveResearchRuntime = {
  visibleIds: [],
  completedIds: [],
  activeId: null
}

function stripPlayerStationsFromArchive(archive: SaveArchive): SaveArchive {
  const strippedSectors: Record<string, SectorData> = {}
  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    strippedSectors[sectorMacro] = {
      ...sector,
      player_stations: undefined,
      player_buildstorages: undefined
    }
  }
  const { research: _, terraforming_clusters: __, playerBlueprints: ___, playerRelations: ____, playerLicences: _____, ...rest } = archive
  return {
    ...rest,
    sectors: strippedSectors
  }
}

function extractPlayerStationsData(archive: SaveArchive): PlayerStationsRecord['data'] {
  const playerStationsData: Record<string, Record<string, PlayerStationEntry>> = {}
  const playerBuildstoragesData: Record<string, Record<string, BuildStorageEntry>> = {}

  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    if (sector.player_stations && Object.keys(sector.player_stations).length > 0) {
      playerStationsData[sectorMacro] = sector.player_stations
    }
    if (sector.player_buildstorages && Object.keys(sector.player_buildstorages).length > 0) {
      playerBuildstoragesData[sectorMacro] = sector.player_buildstorages
    }
  }

  return {
    player_stations: playerStationsData,
    player_buildstorages: playerBuildstoragesData,
    research: archive.research ?? defaultResearchRuntime,
    terraforming_clusters: archive.terraforming_clusters ?? {},
    player_blueprints: archive.playerBlueprints ?? [],
    player_relations: archive.playerRelations ?? {},
    player_licences: archive.playerLicences ?? {}
  }
}

function mergePlayerStationsIntoArchive(
  archive: SaveArchive,
  stationsData?: PlayerStationsRecord['data']
): SaveArchive {
  if (!stationsData) return archive

  const mergedSectors: Record<string, SectorData> = { ...archive.sectors }

  for (const [sectorMacro, sector] of Object.entries(mergedSectors)) {
    if (sector) {
      sector.player_stations = stationsData.player_stations[sectorMacro] ?? {}
      sector.player_buildstorages = stationsData.player_buildstorages[sectorMacro] ?? {}
    }
  }

  return {
    ...archive,
    sectors: mergedSectors,
    research: stationsData.research ?? defaultResearchRuntime,
    terraforming_clusters: stationsData.terraforming_clusters ?? {},
    playerBlueprints: stationsData.player_blueprints ?? [],
    playerRelations: stationsData.player_relations ?? {},
    playerLicences: stationsData.player_licences ?? {}
  }
}

export async function saveArchiveToDB(gameDataStore: GameDataStoreLike, archive: SaveArchive): Promise<void> {
  const db = getDB(gameDataStore)
  const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)

  const strippedArchive = stripPlayerStationsFromArchive(archive)
  const stationsData = extractPlayerStationsData(archive)

  await db.transaction('rw', [db.archive_data, db.player_stations], async () => {
    await db.archive_data.put({
      id: archiveId,
      archiveId,
      guid: archive.meta.guid,
      data: strippedArchive
    })

    await db.player_stations.put({
      id: archiveId,
      archiveId,
      guid: archive.meta.guid,
      data: stationsData
    })
  })
}

export async function loadArchiveDetailFromDB(gameDataStore: GameDataStoreLike, archiveId: string): Promise<SaveArchive | null> {
  const db = getDB(gameDataStore)

  const archiveRecord = await db.archive_data.get(archiveId)
  if (!archiveRecord) return null

  const stationsRecord = await db.player_stations.get(archiveId)

  return mergePlayerStationsIntoArchive(archiveRecord.data, stationsRecord?.data)
}

export async function removeArchiveFromDB(gameDataStore: GameDataStoreLike, archiveId: string): Promise<void> {
  const db = getDB(gameDataStore)

  await db.transaction('rw', [db.archive_data, db.player_stations], async () => {
    await db.archive_data.delete(archiveId)
    await db.player_stations.delete(archiveId)
  })
}

export async function clearArchivesFromDB(gameDataStore: GameDataStoreLike): Promise<void> {
  const db = getDB(gameDataStore)
  await db.archive_data.clear()
  await db.player_stations.clear()
}

export async function deleteCurrentArchiveDB(gameDataStore: GameDataStoreLike): Promise<void> {
  const dbName = getDBName(gameDataStore)
  dbCache.delete(dbName)
  await Dexie.delete(dbName)
}

export async function clearLegacySaveDB(): Promise<void> {
  dbCache.clear()
  await Dexie.delete('X4SaveArchiveDB')
}

export function flattenPlayerStationsRecord(
  archiveId: string,
  data: PlayerStationsRecord['data']
): PlayerStationRecord[] {
  const records: PlayerStationRecord[] = []

  for (const [sectorMacro, stations] of Object.entries(data.player_stations)) {
    for (const [code, entry] of Object.entries(stations)) {
      records.push({
        id: `${archiveId}:${code}`,
        archiveId,
        sectorMacro,
        code,
        type: 'station',
        data: entry
      })
    }
  }

  for (const [sectorMacro, buildstorages] of Object.entries(data.player_buildstorages)) {
    for (const [code, entry] of Object.entries(buildstorages)) {
      records.push({
        id: `${archiveId}:${code}`,
        archiveId,
        sectorMacro,
        code,
        type: 'buildstorage',
        data: entry
      })
    }
  }

  return records
}

export async function loadPlayerStationsFlatByArchiveId(
  gameDataStore: GameDataStoreLike,
  archiveId: string
): Promise<PlayerStationRecord[]> {
  const db = getDB(gameDataStore)

  const record = await db.player_stations.get(archiveId)
  if (!record) return []

  return flattenPlayerStationsRecord(archiveId, record.data)
}