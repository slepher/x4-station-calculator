import type { Page } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dbFixture from '../../../fixtures/db.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURES_DIR = resolve(__dirname, '../../../fixtures')
const SAVE_DIR = join(FIXTURES_DIR, 'save')
const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const CURRENT_PARSER_VERSION = 'v7'

interface SaveData {
  meta: {
    guid: string
    time: number
    playerName: string
    version: string
    filename: string
    parser_version: string
    post_processor_version: string
    source: string
  }
  sectors: Record<string, any>
}

function loadAllSaves(): SaveData[] {
  return readdirSync(SAVE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SAVE_DIR, f), 'utf-8')) as SaveData)
}

function buildSaveArchivesState(saves: SaveData[]) {
  const list = saves.map((s) => {
    const archiveId = `${s.meta.guid}_${s.meta.time}`
    return {
      id: archiveId,
      guid: s.meta.guid,
      time: s.meta.time,
      playerName: s.meta.playerName,
      version: s.meta.version,
      filename: s.meta.filename,
      parser_version: s.meta.parser_version,
      post_processor_version: s.meta.post_processor_version,
      source: s.meta.source,
      isCompatible: true,
      isValid: s.meta.parser_version === CURRENT_PARSER_VERSION,
      createdAt: new Date().toISOString(),
      sectorCount: Object.keys(s.sectors || {}).length
    }
  })
  list.sort((a, b) => b.time - a.time)

  return {
    version: 1,
    activeArchiveId: list[0]?.id || null,
    list,
    settings: {
      visibility: {
        playerStation: true,
        npcStation: true,
        xenonStation: true,
        khaakStation: true,
        abandonedShip: true,
        datavault: true,
        erlkingVault: true
      }
    }
  }
}

const localStorageFixture = (() => {
  const snapshot = JSON.parse(JSON.stringify(dbFixture))
  delete snapshot.vsn
  const saves = loadAllSaves()
  snapshot.x4_save_archives = buildSaveArchivesState(saves)
  return snapshot as Record<string, unknown>
})()

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 2000 })
}

async function setLanguage(page: Page, lang: 'zh-CN' | 'en'): Promise<void> {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

export async function loadLiveBindingFixture(
  page: Page,
  options?: { transformSave?: (save: SaveData, filename: string) => SaveData }
): Promise<void> {
  const saves = loadAllSaves()
  const filenames = readdirSync(SAVE_DIR).filter((f) => f.endsWith('.json'))
  const transformed = options?.transformSave
    ? saves.map((s, i) => options.transformSave!(s, filenames[i]))
    : saves
  transformed.sort((a, b) => b.meta.time - a.meta.time)

  const archiveState = buildSaveArchivesState(transformed)
  const snapshot = JSON.parse(JSON.stringify(dbFixture))
  delete snapshot.vsn
  snapshot.x4_save_archives = archiveState

  await page.addInitScript(() => {
    localStorage.setItem('isTestEnv', 'true')
  })

  await page.goto('/')
  await waitForAppReady(page)

  await page.evaluate(({ data, gameGuid }) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
    localStorage.setItem('isTestEnv', 'true')
  }, { data: snapshot, gameGuid: GAME_GUID })

  await page.evaluate(async ({ archives }) => {
    const w = window as any
    if (w.saveArchiveDB) {
      for (const archive of archives) {
        await w.saveArchiveDB.saveArchiveToDB(w.gameDataStore, archive)
      }
      return
    }
    const dbName = w.gameDataStore?.getIndexedDBName?.() ?? 'x4_save_archive_db'
    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('archive_data')) db.createObjectStore('archive_data', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('player_stations')) db.createObjectStore('player_stations', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const db = await openDb()
    for (const archive of archives) {
      const archiveId = `${archive.meta.guid}_${archive.meta.time}`
      const sectorsNoStations: Record<string, any> = {}
      const psMap: Record<string, any> = {}
      const pbsMap: Record<string, any> = {}
      for (const [macro, sector] of Object.entries(archive.sectors as Record<string, any>)) {
        if (sector.player_stations && Object.keys(sector.player_stations).length > 0) {
          psMap[macro] = sector.player_stations
        }
        if (sector.player_buildstorages && Object.keys(sector.player_buildstorages).length > 0) {
          pbsMap[macro] = sector.player_buildstorages
        }
        sectorsNoStations[macro] = { ...sector, player_stations: undefined, player_buildstorages: undefined }
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['archive_data', 'player_stations'], 'readwrite')
        tx.objectStore('archive_data').put({ id: archiveId, archiveId, guid: archive.meta.guid, data: { ...archive, sectors: sectorsNoStations } })
        tx.objectStore('player_stations').put({ id: archiveId, archiveId, guid: archive.meta.guid, data: { player_stations: psMap, player_buildstorages: pbsMap } })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }
    db.close()
  }, { archives: transformed })

  await page.reload()
  await waitForAppReady(page)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}
