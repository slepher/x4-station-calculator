import Dexie, { type Table } from 'dexie'
import type { SaveArchive } from '@/types/saveArchive'

export interface ArchiveDataRecord {
  id: string
  scopeKey: string
  archiveId: string
  data: SaveArchive
}

const DB_NAME = 'X4SaveArchiveDB'
const DB_VERSION = 3

class X4SaveDB extends Dexie {
  archiveData!: Table<ArchiveDataRecord>

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
    this.version(DB_VERSION).stores({
      archiveData: 'id, scopeKey, archiveId'
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

function createScopedId(scopeKey: string, archiveId: string): string {
  return `${scopeKey}:${archiveId}`
}

export async function saveArchiveToDB(scopeKey: string, archive: SaveArchive): Promise<void> {
  const database = getDB()
  const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)

  await database.archiveData.put({
    id: createScopedId(scopeKey, archiveId),
    scopeKey,
    archiveId,
    data: archive
  })
}

export async function loadArchiveDetailFromDB(scopeKey: string, archiveId: string): Promise<SaveArchive | null> {
  const database = getDB()
  const record = await database.archiveData.get(createScopedId(scopeKey, archiveId))
  return record?.data ?? null
}

export async function removeArchiveFromDB(scopeKey: string, archiveId: string): Promise<void> {
  const database = getDB()
  await database.archiveData.delete(createScopedId(scopeKey, archiveId))
}

export async function clearArchivesFromDB(scopeKey: string): Promise<void> {
  const database = getDB()
  const ids = await database.archiveData.where('scopeKey').equals(scopeKey).primaryKeys()
  await database.archiveData.bulkDelete(ids)
}

export async function clearLegacySaveDB(): Promise<void> {
  db = null
  await Dexie.delete(DB_NAME)
}
