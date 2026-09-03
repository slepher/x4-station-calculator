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
const CURRENT_PARSER_VERSION = 'v9'
const CURRENT_SAVE_ARCHIVES_KEY = 'x4_save_archives_v9'
const CURRENT_SAVE_BINDINGS_KEY = 'x4_save_bindings_v9'
const FIXTURE_KEY_MIGRATIONS: Record<string, string> = {
  x4_empire_data: 'x4_empire_data_v9',
  x4_logic_flow_plans: 'x4_logic_flow_plans_v9',
  x4_ship_blueprints: 'x4_ship_blueprints_v9',
  'x4-setting': 'x4-setting_v9'
}

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
  for (const [legacyKey, currentKey] of Object.entries(FIXTURE_KEY_MIGRATIONS)) {
    snapshot[currentKey] = snapshot[legacyKey]
    delete snapshot[legacyKey]
  }
  snapshot[CURRENT_SAVE_ARCHIVES_KEY] = archiveState
  snapshot[CURRENT_SAVE_BINDINGS_KEY] = snapshot.x4_save_bindings
  delete snapshot.x4_save_bindings

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
    for (const archive of archives) {
      await w.saveArchiveDB.saveArchiveToDB(w.gameDataStore, archive)
    }
  }, { archives: transformed })

  await page.reload()
  await waitForAppReady(page)
  await page.getByTestId('top-view-btn-live-production').click()
  await setLanguage(page, 'zh-CN')
  await page.waitForTimeout(200)
}
