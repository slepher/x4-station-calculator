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
const PARSER_SOURCE = resolve(__dirname, '../../../../src/workers/saveParser.post.ts')
const CURRENT_PARSER_VERSION = readFileSync(PARSER_SOURCE, 'utf-8').match(
  /export const CURRENT_PARSER_VERSION = ['"]([^'"]+)['"]/
)?.[1]
if (!CURRENT_PARSER_VERSION) {
  throw new Error(`Unable to read CURRENT_PARSER_VERSION from ${PARSER_SOURCE}`)
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

function loadAllSaves(): Array<{ save: SaveData; filename: string }> {
  return readdirSync(SAVE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((filename) => ({
      filename,
      save: JSON.parse(readFileSync(join(SAVE_DIR, filename), 'utf-8')) as SaveData
    }))
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
  options?: {
    transformSave?: (save: SaveData, filename: string) => SaveData
    transformSaves?: (saves: SaveData[]) => SaveData[]
    initialArchiveId?: string
  }
): Promise<void> {
  const saves = loadAllSaves()
  const transformed = options?.transformSaves
    ? options.transformSaves(saves.map(({ save, filename }) => options.transformSave?.(save, filename) ?? save))
    : saves.map(({ save, filename }) => options?.transformSave?.(save, filename) ?? save)
  transformed.sort((a, b) => b.meta.time - a.meta.time)

  const archiveState = buildSaveArchivesState(transformed)
  if (options?.initialArchiveId) archiveState.activeArchiveId = options.initialArchiveId
  const snapshot = JSON.parse(JSON.stringify(dbFixture))
  delete snapshot.vsn

  await page.addInitScript(() => {
    localStorage.setItem('isTestEnv', 'true')
  })

  await page.goto('/')
  await waitForAppReady(page)

  await page.evaluate(({ data, archives, gameGuid }) => {
    const w = window as any
    if (!w.gameDataStore || typeof w.gameDataStore.getStorageKey !== 'function') {
      throw new Error('gameDataStore.getStorageKey is required for live fixture setup')
    }
    const keys = {
      empire: w.gameDataStore.getStorageKey('empire'),
      logicFlow: w.gameDataStore.getStorageKey('logic_flow'),
      shipBlueprints: w.gameDataStore.getStorageKey('ship_blueprints'),
      saveArchives: w.gameDataStore.getStorageKey('save_archives')
    }
    if (!keys.saveArchives.includes('save_archives')) {
      throw new Error(`Invalid save archives storage key: ${keys.saveArchives}`)
    }
    const saveBindings = keys.saveArchives.replace('save_archives', 'save_bindings')
    const fixtureKeys = [
      ['x4_empire_data', keys.empire],
      ['x4_logic_flow_plans', keys.logicFlow],
      ['x4_ship_blueprints', keys.shipBlueprints],
      ['x4_save_bindings', saveBindings]
    ] as const
    for (const [source, current] of fixtureKeys) {
      data[current] = data[source]
      if (source !== current) delete data[source]
    }
    data[keys.saveArchives] = archives
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
    localStorage.setItem('isTestEnv', 'true')
  }, { data: snapshot, archives: archiveState, gameGuid: GAME_GUID })

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
