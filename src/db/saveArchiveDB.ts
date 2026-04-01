import Dexie, { type Table } from 'dexie'
import type { SaveArchive } from '@/types/saveArchive'

export interface ArchiveMeta {
  id: string
  guid: string
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: string
  source: 'original' | 'imported'
  isCompatible: boolean
  createdAt: Date
  sectorCount: number
}

export interface ArchiveData {
  id: string
  data: SaveArchive
}

export interface ExportData {
  version: string
  exportedAt: string
  archives: SaveArchive[]
}

const DB_NAME = 'X4SaveArchiveDB'
const DB_VERSION = 1

class X4SaveDB extends Dexie {
  archives!: Table<ArchiveMeta>
  archiveData!: Table<ArchiveData>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({
      archives: 'id, guid, playerName, time, createdAt, parser_version',
      archiveData: 'id'
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

function generateId(guid: string, time: number): string {
  return `${guid}_${time}`
}

export async function saveArchiveToDB(archive: SaveArchive): Promise<void> {
  const database = getDB()
  const id = generateId(archive.meta.guid, archive.meta.time)
  
  const meta: ArchiveMeta = {
    id,
    guid: archive.meta.guid,
    time: archive.meta.time,
    playerName: archive.meta.playerName,
    version: archive.meta.version,
    filename: archive.meta.filename,
    parser_version: archive.meta.parser_version,
    source: archive.meta.source,
    isCompatible: archive.isCompatible,
    createdAt: new Date(),
    sectorCount: Object.keys(archive.sectors).length
  }
  
  const data: ArchiveData = {
    id,
    data: archive
  }
  
  await database.transaction('rw', [database.archives, database.archiveData], async () => {
    await database.archives.put(meta)
    await database.archiveData.put(data)
  })
}

export async function loadArchiveListFromDB(): Promise<ArchiveMeta[]> {
  const database = getDB()
  return database.archives.orderBy('createdAt').reverse().toArray()
}

export async function loadArchiveDetailFromDB(id: string): Promise<SaveArchive | null> {
  const database = getDB()
  const record = await database.archiveData.get(id)
  return record?.data ?? null
}

export async function removeArchiveFromDB(guid: string, time: number): Promise<void> {
  const database = getDB()
  const id = generateId(guid, time)
  
  await database.transaction('rw', [database.archives, database.archiveData], async () => {
    await database.archives.delete(id)
    await database.archiveData.delete(id)
  })
}

export async function clearAllArchivesFromDB(): Promise<void> {
  const database = getDB()
  await database.transaction('rw', [database.archives, database.archiveData], async () => {
    await database.archives.clear()
    await database.archiveData.clear()
  })
}

export async function removeOutdatedArchivesFromDB(currentParserVersion: string): Promise<number> {
  const database = getDB()
  const outdated = await database.archives
    .where('parser_version')
    .notEqual(currentParserVersion)
    .toArray()
  
  if (outdated.length === 0) return 0
  
  const ids = outdated.map(m => m.id)
  
  await database.transaction('rw', [database.archives, database.archiveData], async () => {
    await database.archives.bulkDelete(ids)
    await database.archiveData.bulkDelete(ids)
  })
  
  return ids.length
}

export async function exportArchiveFromDB(guid: string, time: number): Promise<string | null> {
  const id = generateId(guid, time)
  const archive = await loadArchiveDetailFromDB(id)
  if (!archive) return null
  return JSON.stringify(archive, null, 2)
}

export async function exportAllArchivesFromDB(): Promise<string> {
  const database = getDB()
  const allData = await database.archiveData.toArray()
  
  const exportData: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    archives: allData.map(r => r.data)
  }
  
  return JSON.stringify(exportData, null, 2)
}

export async function getArchiveCountFromDB(): Promise<number> {
  const database = getDB()
  return database.archives.count()
}