import Dexie, { type Table } from 'dexie'
import type {
  SaveArchive,
  PlayerStationEntry,
  BuildStorageEntry,
  SectorData,
  PlayerStationRecord,
  ArchiveDataRecord,
  PlayerStationType
} from '@/types/saveArchive'

export type { PlayerStationRecord, ArchiveDataRecord, PlayerStationType }

const DB_NAME = 'X4SaveArchiveDB'
const DB_VERSION = 4

const DEFAULT_TABLE_NAMES = {
  archive_data: 'archive_data',
  player_station: 'player_station'
}

const VERSION_TABLE_MAP: Record<string, { archive_data: string; player_station: string }> = {
  'x4_save_archives': { archive_data: 'archive_data', player_station: 'player_station' },
  'x4_save_archives_v9_beta': { archive_data: 'archive_data_v9_beta', player_station: 'player_station_v9_beta' }
}

function getTableNames(scopeKey: string): { archive_data: string; player_station: string } {
  return VERSION_TABLE_MAP[scopeKey] ?? DEFAULT_TABLE_NAMES
}

class X4SaveDB extends Dexie {
  archive_data!: Table<ArchiveDataRecord>
  archive_data_v9_beta!: Table<ArchiveDataRecord>
  player_station!: Table<PlayerStationRecord>
  player_station_v9_beta!: Table<PlayerStationRecord>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      archives: 'id, guid, playerName, time, createdAt, parser_version',
      archiveData: 'id'
    })
    this.version(2).stores({
      archives: 'id, guid, playerName, time, createdAt, parser_version, post_processor_version, isValid',
      archiveData: 'id'
    })
    this.version(3).stores({
      archiveData: 'id, scopeKey, archiveId'
    })
    this.version(DB_VERSION).stores({
      archive_data: 'id, archiveId',
      archive_data_v9_beta: 'id, archiveId',
      player_station: 'id, archiveId, sectorMacro, type',
      player_station_v9_beta: 'id, archiveId, sectorMacro, type'
    }).upgrade(async (tx) => {
      interface OldArchiveRecord {
        id: string
        scopeKey: string
        archiveId: string
        data: SaveArchive
      }
      
      const oldRecords = await tx.table('archiveData').toArray() as OldArchiveRecord[]
      
      for (const record of oldRecords) {
        const archive = record.data
        const archiveId = record.archiveId
        const tableNames = getTableNames(record.scopeKey)
        const archiveDataTable = tx.table(tableNames.archive_data)
        const playerStationTable = tx.table(tableNames.player_station)
        
        const strippedSectors: Record<string, SectorData> = {}
        for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
          strippedSectors[sectorMacro] = {
            ...sector,
            player_stations: undefined,
            player_buildstorages: undefined
          }
        }
        const strippedArchive: SaveArchive = {
          ...archive,
          sectors: strippedSectors
        }
        
        await archiveDataTable.put({
          id: archiveId,
          archiveId,
          data: strippedArchive
        })
        
        for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
          if (sector.player_stations) {
            for (const [code, entry] of Object.entries(sector.player_stations)) {
              await playerStationTable.put({
                id: `${archiveId}:${code}`,
                archiveId,
                sectorMacro,
                code,
                type: 'station',
                data: entry
              })
            }
          }
          if (sector.player_buildstorages) {
            for (const [code, entry] of Object.entries(sector.player_buildstorages)) {
              await playerStationTable.put({
                id: `${archiveId}:${code}`,
                archiveId,
                sectorMacro,
                code,
                type: 'buildstorage',
                data: entry
              })
            }
          }
        }
      }
      
      await tx.table('archiveData').clear()
      await tx.table('archives').clear()
    })
  }
}

let db: X4SaveDB | null = null

function getDB(): X4SaveDB {
  if (!db) {
    db = new X4SaveDB()
  }
  return db
}

export function createArchiveId(guid: string, time: number): string {
  return `${guid}_${time}`
}

function createStationRecordId(archiveId: string, code: string): string {
  return `${archiveId}:${code}`
}

function getArchiveDataTable(scopeKey: string): Table<ArchiveDataRecord> {
  const db = getDB()
  const names = getTableNames(scopeKey)
  return db.table(names.archive_data) as Table<ArchiveDataRecord>
}

function getPlayerStationTable(scopeKey: string): Table<PlayerStationRecord> {
  const db = getDB()
  const names = getTableNames(scopeKey)
  return db.table(names.player_station) as Table<PlayerStationRecord>
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
  return {
    ...archive,
    sectors: strippedSectors
  }
}

function mergePlayerStationsIntoArchive(
  archive: SaveArchive,
  records: PlayerStationRecord[]
): SaveArchive {
  const mergedSectors: Record<string, SectorData> = { ...archive.sectors }
  
  for (const [_sectorMacro, sector] of Object.entries(mergedSectors)) {
    if (sector) {
      sector.player_stations = sector.player_stations ?? {}
      sector.player_buildstorages = sector.player_buildstorages ?? {}
    }
  }
  
  for (const record of records) {
    const sector = mergedSectors[record.sectorMacro]
    if (!sector) continue
    
    if (record.type === 'station') {
      const stations = sector.player_stations ?? {}
      stations[record.code] = record.data as PlayerStationEntry
      sector.player_stations = stations
    } else {
      const buildstorages = sector.player_buildstorages ?? {}
      buildstorages[record.code] = record.data as BuildStorageEntry
      sector.player_buildstorages = buildstorages
    }
  }
  
  return {
    ...archive,
    sectors: mergedSectors
  }
}

export async function saveArchiveToDB(scopeKey: string, archive: SaveArchive): Promise<void> {
  const database = getDB()
  const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
  const archiveTable = getArchiveDataTable(scopeKey)
  const stationTable = getPlayerStationTable(scopeKey)
  
  const strippedArchive = stripPlayerStationsFromArchive(archive)
  
  await database.transaction('rw', [archiveTable, stationTable], async () => {
    await archiveTable.put({
      id: archiveId,
      archiveId,
      data: strippedArchive
    })
    
    const stationRecords: PlayerStationRecord[] = []
    
    for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
      if (sector.player_stations) {
        for (const [code, entry] of Object.entries(sector.player_stations)) {
          stationRecords.push({
            id: createStationRecordId(archiveId, code),
            archiveId,
            sectorMacro,
            code,
            type: 'station',
            data: entry
          })
        }
      }
      if (sector.player_buildstorages) {
        for (const [code, entry] of Object.entries(sector.player_buildstorages)) {
          stationRecords.push({
            id: createStationRecordId(archiveId, code),
            archiveId,
            sectorMacro,
            code,
            type: 'buildstorage',
            data: entry
          })
        }
      }
    }
    
    if (stationRecords.length > 0) {
      await stationTable.bulkPut(stationRecords)
    }
  })
}

export async function loadArchiveDetailFromDB(scopeKey: string, archiveId: string): Promise<SaveArchive | null> {
  const archiveTable = getArchiveDataTable(scopeKey)
  const stationTable = getPlayerStationTable(scopeKey)
  
  const record = await archiveTable.get(archiveId)
  if (!record) return null
  
  const stationRecords = await stationTable.where('archiveId').equals(archiveId).toArray()
  
  return mergePlayerStationsIntoArchive(record.data, stationRecords)
}

export async function removeArchiveFromDB(scopeKey: string, archiveId: string): Promise<void> {
  const database = getDB()
  const archiveTable = getArchiveDataTable(scopeKey)
  const stationTable = getPlayerStationTable(scopeKey)
  
  await database.transaction('rw', [archiveTable, stationTable], async () => {
    await archiveTable.delete(archiveId)
    const stationIds = await stationTable.where('archiveId').equals(archiveId).primaryKeys()
    if (stationIds.length > 0) {
      await stationTable.bulkDelete(stationIds)
    }
  })
}

export async function clearArchivesFromDB(scopeKey: string): Promise<void> {
  const archiveTable = getArchiveDataTable(scopeKey)
  const stationTable = getPlayerStationTable(scopeKey)
  
  await archiveTable.clear()
  await stationTable.clear()
}

export async function clearLegacySaveDB(): Promise<void> {
  db = null
  await Dexie.delete(DB_NAME)
}

export async function loadPlayerStationsByArchiveId(
  scopeKey: string,
  archiveId: string
): Promise<PlayerStationRecord[]> {
  const stationTable = getPlayerStationTable(scopeKey)
  return await stationTable.where('archiveId').equals(archiveId).toArray()
}