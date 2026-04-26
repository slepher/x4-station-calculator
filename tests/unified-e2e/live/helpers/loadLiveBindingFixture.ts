import type { Page } from '@playwright/test'
import dbFixture from '../../../fixtures/db.json' with { type: 'json' }
import saveFixture from '../../../fixtures/save.json' with { type: 'json' }

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

function buildSaveArchivesState() {
  const archiveId = `${saveFixture.meta.guid}_${saveFixture.meta.time}`
  return {
    version: 1,
    activeArchiveId: archiveId,
    list: [
      {
        id: archiveId,
        guid: saveFixture.meta.guid,
        time: saveFixture.meta.time,
        playerName: saveFixture.meta.playerName,
        version: saveFixture.meta.version,
        filename: saveFixture.meta.filename,
        parser_version: saveFixture.meta.parser_version,
        post_processor_version: saveFixture.meta.post_processor_version,
        source: saveFixture.meta.source,
        isCompatible: true,
        isValid: true,
        createdAt: new Date('2026-03-02T12:10:51.902Z').toISOString(),
        sectorCount: Object.keys(saveFixture.sectors || {}).length
      }
    ],
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
  snapshot.x4_save_archives = buildSaveArchivesState()
  return snapshot as Record<string, unknown>
})()

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 2000 })
}

async function setLanguage(page: Page, lang: 'zh-CN' | 'en'): Promise<void> {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

export async function loadLiveBindingFixture(page: Page): Promise<void> {
  await page.goto('/')
  await waitForAppReady(page)

  await page.evaluate(() => {
    ;(window as any).isTestEnv = true
    Object.keys(localStorage).forEach((key) => {
      if (key !== 'user_locale') localStorage.removeItem(key)
    })
    localStorage.setItem('isTestEnv', 'true')
    sessionStorage.clear()
  })
  await page.reload()
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
  }, { data: localStorageFixture, gameGuid: GAME_GUID })

  await page.evaluate(async (archive) => {
    const saveArchiveDB = (window as any).saveArchiveDB
    const gameDataStore = (window as any).gameDataStore
    if (!saveArchiveDB || !gameDataStore) {
      throw new Error('saveArchiveDB or gameDataStore is not available in test env')
    }
    await saveArchiveDB.saveArchiveToDB(gameDataStore, archive)
  }, saveFixture)

  await page.reload()
  await waitForAppReady(page)
  await setLanguage(page, 'zh-CN')
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}
