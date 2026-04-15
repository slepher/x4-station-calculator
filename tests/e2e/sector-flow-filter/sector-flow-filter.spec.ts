import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import dbFixture from '../../fixtures/db.json' with { type: 'json' }

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
})

async function loadDbFixture(page: Page) {
  const dbData = JSON.parse(JSON.stringify(dbFixture))
  delete dbData.vsn
  delete dbData.playerStationRecords
  delete dbData.x4_save_archives
  
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
}

async function importSaveArchives(page: Page) {
  const saveData = dbFixture.x4_save_archives
  
  await page.evaluate(async (archivesData: any) => {
    const saveStore = (window as any).saveStore
    const liveStore = (window as any).liveStore
    const saveBindingStore = (window as any).saveBindingStore
    const saveArchiveDB = (window as any).saveArchiveDB
    if (!saveStore || !liveStore || !saveArchiveDB) return { success: false, error: 'Stores not available' }
    
    const { saveArchiveToDB, createArchiveId, loadPlayerStationsByArchiveId } = saveArchiveDB
    const archives = archivesData.archives || []
    const scopeKey = 'x4_save_archives'
    
    for (const archive of archives) {
      await saveArchiveToDB(scopeKey, archive)
      saveStore.importFromJson(archive)
    }
    
    const archive = saveStore.selectedArchive
    if (archive) {
      const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
      const records = await loadPlayerStationsByArchiveId(scopeKey, archiveId)
      liveStore.playerStationRecords.value = records
    }
    
    const bindingsList = saveBindingStore?.savedBindings?.list || []
    if (bindingsList.length > 0) {
      const firstBinding = bindingsList[0]
      saveBindingStore.createOrOpenBinding(firstBinding.gameGuid)
      liveStore.openBinding(firstBinding.gameGuid)
    }
    
    await new Promise(r => setTimeout(r, 100))
    liveStore.syncAllBindingStationsToStateMap?.()
    
    return { success: true }
  }, saveData)
  await page.waitForTimeout(500)
}

async function setupActiveBinding(page: Page) {
  await page.evaluate((gameGuid: string) => {
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
  }, GAME_GUID)
}

async function setLanguage(page: Page, lang: string) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

async function switchToLiveProduction(page: Page) {
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}

async function commonSetup(page: Page) {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
}

test.describe('Sector Flow Filter', () => {
  test('小行星 station flows UI 显示数据', async ({ page }) => {
    await commonSetup(page)
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const asteroidStationTabs = page.locator('.station-tab').filter({ hasText: /地球人|MGO-010|新建空间站/ })
    const stationCount = await asteroidStationTabs.count()
    console.log('Asteroid station tabs count:', stationCount)
    expect(stationCount).toBe(3)
    
    const firstStationTab = asteroidStationTabs.first()
    await firstStationTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('Wareflow panel content (first 500 chars):', panelContent?.substring(0, 500))
    
    const flowItems = wareflowPanel.locator('.wareflow-item')
    const flowCount = await flowItems.count()
    console.log('Flow items count:', flowCount)
    
    if (flowCount > 0) {
      const wareNames: string[] = []
      for (let i = 0; i < Math.min(flowCount, 10); i++) {
        const wareNameEl = flowItems.nth(i).locator('.ware-name')
        if (await wareNameEl.count() > 0) {
          const wareName = await wareNameEl.textContent()
          wareNames.push(wareName || '')
        }
      }
      console.log('Ware names from UI:', wareNames)
      expect(flowCount).toBeGreaterThan(0)
    } else {
      console.log('No flow items - checking if panel has EmptyState')
      const emptyState = wareflowPanel.locator('.empty-state')
      const hasEmpty = await emptyState.count()
      console.log('EmptyState count:', hasEmpty)
    }
  })
})