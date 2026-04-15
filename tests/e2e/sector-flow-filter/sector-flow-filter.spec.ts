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
  test('小行星星区聚合 flows 应只显示三个 station 的 planned ware 作为 surplus', async ({ page }) => {
    await commonSetup(page)
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('小行星聚合 flows:', panelContent?.substring(0, 800))
    
    const plannedWares = ['反物质转换器', '励磁线圈', '电子基质', '碳化硅', '金属微晶']
    const autoIndustryWares = ['等离子导体', '量子管', '石墨烯', '超流体冷却剂', '精炼金属', '硅晶片']
    
    const productsGroupCount = await wareflowPanel.locator('.flow-group').count()
    console.log('Flow group count:', productsGroupCount)
    
    const productsHeader = wareflowPanel.locator('.group-header').filter({ hasText: /产品|Products/i })
    const headerCount = await productsHeader.count()
    console.log('Products header count:', headerCount)
    
    if (headerCount > 0) {
      const productsHeaderText = await productsHeader.first().textContent()
      console.log('Products header text:', productsHeaderText)
      
      const productsGroup = productsHeader.first().locator('..')
      const productsContent = await productsGroup.textContent()
      console.log('Products group content:', productsContent?.substring(0, 500))
      
      for (const planned of plannedWares) {
        expect(productsContent).toContain(planned.substring(0, 4))
      }
      
      for (const auto of autoIndustryWares) {
        expect(productsContent).not.toContain(auto.substring(0, 4))
      }
    } else {
      console.log('Products header not found - checking panel content directly')
      
      const productsKeywordMatch = panelContent?.match(/产品([^资]*)/)
      if (productsKeywordMatch) {
        const productsPart = productsKeywordMatch[1]
        console.log('Products part extracted:', productsPart?.substring(0, 400))
        
        for (const planned of plannedWares) {
          expect(productsPart).toContain(planned.substring(0, 4))
        }
        
        for (const auto of autoIndustryWares) {
          expect(productsPart).not.toContain(auto.substring(0, 4))
        }
      }
    }
  })
  
  test('单个 station flows 显示原始数据（含 auto-industry surplus）', async ({ page }) => {
    await commonSetup(page)
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const stationTabs = page.locator('.station-tab').filter({ hasText: /地球人|MGO-010|新建空间站/ })
    const stationCount = await stationTabs.count()
    expect(stationCount).toBe(3)
    
    const mgoTab = stationTabs.filter({ hasText: 'MGO-010' })
    await mgoTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('MGO-010 单站 flows（原始数据）:', panelContent?.substring(0, 600))
    
    const plannedWare = '励磁线圈'
    const autoIndustryWares = ['等离子导体', '量子管', '石墨烯', '超流体冷却剂']
    
    expect(panelContent).toContain(plannedWare.substring(0, 4))
    
    for (const autoWare of autoIndustryWares) {
      expect(panelContent).toContain(autoWare.substring(0, 4))
    }
    
    console.log('验证：单个 station 显示所有 flows（含 auto-industry surplus）')
  })
  
  test('小行星聚合 flows 详细快照（基准数据）', async ({ page }) => {
    await commonSetup(page)
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('=== 小行星聚合 flows 完整快照 ===')
    console.log('Full content:', panelContent)
    
    expect(panelContent).toContain('反物质转换器+3,192.0')
    expect(panelContent).toContain('励磁线圈+2,100.0')
    expect(panelContent).toContain('电子基质+5,880.0')
    expect(panelContent).toContain('碳化硅+5,760.0')
    expect(panelContent).toContain('金属微晶+37,760.0')
    
    expect(panelContent).not.toContain('等离子导体')
    expect(panelContent).not.toContain('量子管')
    expect(panelContent).not.toContain('石墨烯')
    
    console.log('=== 基准快照验证完成（Products surplus） ===')
  })
})