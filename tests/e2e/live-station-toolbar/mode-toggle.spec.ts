import { test } from '../../test-setup'
import { expect } from '@playwright/test'

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

async function loadDbFixture(page: any) {
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
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

async function importSaveArchives(page: any) {
  const saveFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const saveData = saveFixture.default.x4_save_archives
  
  const result = await page.evaluate(async (archivesData: any) => {
    const saveStore = (window as any).saveStore
    const liveStore = (window as any).liveStore
    const saveBindingStore = (window as any).saveBindingStore
    const saveArchiveDB = (window as any).saveArchiveDB
    if (!saveStore || !liveStore || !saveArchiveDB) return { success: false, error: 'Stores or saveArchiveDB not available' }
    
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
    const guid = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
    
    if (bindingsList.length > 0) {
      const firstBinding = bindingsList[0]
      saveBindingStore.createOrOpenBinding(firstBinding.gameGuid)
      liveStore.openBinding(firstBinding.gameGuid)
    }
    
    await new Promise(r => setTimeout(r, 100))
    
    const activeBinding = liveStore.activeBinding
    const derivedBindingStations = liveStore.derivedBindingStations
    const derivedCount = derivedBindingStations?.length || 0
    liveStore.syncAllBindingStationsToStateMap?.()
    
    return { 
      success: true, 
      archiveCount: archives.length,
      archiveId: archive ? createArchiveId(archive.meta.guid, archive.meta.time) : null,
      playerStationRecordsCount: liveStore.playerStationRecords?.value?.length || 0,
      bindingsListCount: bindingsList.length,
      activeBindingGameGuid: activeBinding?.gameGuid,
      derivedBindingStationsCount: derivedCount
    }
  }, saveData)
  
  console.log('import result:', result)
  await page.waitForTimeout(500)
}

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

async function setupActiveBinding(page: any, stationId: string | null = null) {
  await page.evaluate((opts: { gameGuid: string, stationId: string | null }) => {
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: opts.gameGuid,
      activeBindingStation: opts.stationId,
      activeView: 'live-production'
    }))
  }, { gameGuid: GAME_GUID, stationId })
}

async function setLanguage(page: any, lang: string) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

async function switchToLiveProduction(page: any) {
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}

async function selectStationInSector(page: any, sectorName: string, stationName: string) {
  const supplyTab = page.locator('.supply-tab').filter({ hasText: sectorName })
  await expect(supplyTab).toBeVisible({ timeout: 5000 })
  await supplyTab.click()
  await page.waitForTimeout(500)
  
  const stationTab = page.locator('.station-tab').filter({ hasText: stationName })
  await expect(stationTab).toBeVisible({ timeout: 5000 })
  await stationTab.click()
  await page.waitForTimeout(300)
}

async function selectDerivedStationInSector(page: any, sectorName: string, stationCode: string) {
  const supplyTab = page.locator('.supply-tab').filter({ hasText: sectorName })
  await expect(supplyTab).toBeVisible({ timeout: 5000 })
  await supplyTab.click()
  await page.waitForTimeout(500)
  
  const stationTab = page.locator('.station-tab').filter({ hasText: stationCode })
  await expect(stationTab).toBeVisible({ timeout: 5000 })
  await stationTab.click()
  await page.waitForTimeout(300)
}

async function assertModeToggleButtonState(page: any, expectedMode: 'live' | 'planning', canToggle: boolean) {
  const modeToggleBtn = page.locator('.mode-toggle-chip')
  await expect(modeToggleBtn).toBeVisible({ timeout: 1000 })
  
  if (canToggle) {
    await expect(modeToggleBtn).toBeEnabled()
  } else {
    await expect(modeToggleBtn).toBeDisabled()
  }
  
  const modeText = await modeToggleBtn.locator('.chip-status').textContent()
  const expectedModeText = expectedMode === 'live' ? '实时' : '规划'
  expect(modeText).toContain(expectedModeText)
}

async function assertPlanningControlsVisible(page: any, visible: boolean) {
  const racePreferenceSelect = page.locator('.race-select')
  
  if (visible) {
    await expect(racePreferenceSelect).toBeVisible({ timeout: 500 })
  } else {
    await expect(racePreferenceSelect).toBeHidden({ timeout: 500 })
  }
}

test('调试: 查看页面元素', async ({ page }) => {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
  await page.waitForTimeout(1000)
  
  const liveStoreInfo = await page.evaluate(() => {
    const ls = (window as any).liveStore
    return {
      exists: !!ls,
      isReady: ls?.isReady,
      sectorsCount: ls?.sectors?.length,
      derivedBindingStationsCount: ls?.derivedBindingStations?.length,
      playerStationRecordsCount: ls?.playerStationRecords?.value?.length,
      activeBinding: ls?.activeBinding?.gameGuid,
      activeStationId: ls?.activeStationId?.value,
      activeStation: ls?.activeStation?.value?.id,
      bindingStation: ls?.getBindingStation?.(),
      archiveStation: ls?.getArchiveStation?.()
    }
  })
  console.log('liveStore info:', liveStoreInfo)
  
  console.log('--- 点击小行星 supply-tab ---')
  await page.locator('.supply-tab').filter({ hasText: '小行星' }).click()
  await page.waitForTimeout(500)
  
  console.log('--- 点击地球人 station-tab ---')
  await page.locator('.station-tab').filter({ hasText: '地球人' }).click()
  await page.waitForTimeout(500)
  
  const afterSelect = await page.evaluate(() => {
    const ls = (window as any).liveStore
    return {
      activeStationId: ls?.activeStationId?.value,
      bindingStation: ls?.getBindingStation?.(),
      archiveStation: ls?.getArchiveStation?.(),
      hasBindingStation: ls?.getBindingStation?.() !== null,
      hasSaveStation: ls?.getArchiveStation?.() !== null
    }
  })
  console.log('after select:', afterSelect)
  
  await page.screenshot({ path: 'test-results/debug-live-production-expanded.png' })
  
  expect(liveStoreInfo.derivedBindingStationsCount).toBeGreaterThan(0)
})

test('站点 "地球人": bindingStation + saveStation -> 规划模式, 可切换', async ({ page }) => {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
  
  await selectStationInSector(page, '小行星', '地球人')
  
  await assertModeToggleButtonState(page, 'planning', true)
  await assertPlanningControlsVisible(page, true)
})

test('站点 "新建空间站": bindingStation + 无 saveStation -> 规划模式, 不可切换', async ({ page }) => {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
  
  await selectStationInSector(page, '小行星', '新建空间站')
  
  await assertModeToggleButtonState(page, 'planning', false)
  await assertPlanningControlsVisible(page, true)
})

test('存档站点 "PPW-916": 无 bindingStation + saveStation -> 实时模式, 可切换', async ({ page }) => {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
  
  await selectDerivedStationInSector(page, '神圣眼光', 'PPW-916')
  
  await assertModeToggleButtonState(page, 'live', true)
  await assertPlanningControlsVisible(page, false)
})

test('模式切换: 点击切换按钮可切换模式', async ({ page }) => {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
  
  await selectStationInSector(page, '小行星', '地球人')
  
  await assertModeToggleButtonState(page, 'planning', true)
  
  const modeToggleBtn = page.locator('.mode-toggle-chip')
  await modeToggleBtn.click()
  await page.waitForTimeout(300)
  
  await assertModeToggleButtonState(page, 'live', true)
  await assertPlanningControlsVisible(page, false)
  
  await modeToggleBtn.click()
  await page.waitForTimeout(300)
  
  await assertModeToggleButtonState(page, 'planning', true)
  await assertPlanningControlsVisible(page, true)
})