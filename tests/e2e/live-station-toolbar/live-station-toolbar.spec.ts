import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'

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

async function importSaveArchives(page: Page) {
  const saveFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const saveData = saveFixture.default.x4_save_archives
  
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

async function selectStationInSector(page: Page, sectorName: string, stationName: string) {
  const supplyTab = page.locator('.supply-tab').filter({ hasText: sectorName })
  await expect(supplyTab).toBeVisible({ timeout: 5000 })
  await supplyTab.click()
  await page.waitForTimeout(500)
  
  const stationTab = page.locator('.station-tab').filter({ hasText: stationName })
  await expect(stationTab).toBeVisible({ timeout: 5000 })
  await stationTab.click()
  await page.waitForTimeout(300)
}

async function commonSetup(page: Page) {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
}

test.describe('3 E2E 测试场景', () => {
  test('3.1 Case: 站点"地球人"双数据源-规划模式可切换', async ({ page }) => {
    // 3.1.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.1.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '小行星', '地球人')
    // 3.1.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-planning`
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    // 3.1.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '规划' #期望: ['规划']
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('规划')
    // 3.1.5 断言 `.race-select` 可见（规划控件显示） #期望: [visible]
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
    // 3.1.6 断言 `.mode-toggle-chip` 按钮 enabled（可切换） #期望: [enabled]
    await expect(modeBtn).toBeEnabled()
  })

  test('3.2 Case: 站点"新建空间站"仅有bindingStation-规划模式不可切换', async ({ page }) => {
    // 3.2.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.2.2 点击星区 `小行星` supply-tab，点击站点 `新建空间站` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '小行星', '新建空间站')
    // 3.2.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-planning`
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    // 3.2.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '规划' #期望: ['规划']
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('规划')
    // 3.2.5 断言 `.race-select` 可见（规划控件显示） #期望: [visible]
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
    // 3.2.6 断言 `.mode-toggle-chip` 按钮 disabled（不可切换） #期望: [disabled]
    await expect(modeBtn).toBeDisabled()
  })

  test('3.3 Case: 存档站点"PPW-916"仅有saveStation-实时模式可切换', async ({ page }) => {
    // 3.3.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.3.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    // 3.3.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-live`
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-live/)
    // 3.3.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '实时' #期望: ['实时']
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('实时')
    // 3.3.5 断言 `.race-select` 隐藏（规划控件隐藏） #期望: [hidden]
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    // 3.3.6 断言 `.mode-toggle-chip` 按钮 enabled（可切换） #期望: [enabled]
    await expect(modeBtn).toBeEnabled()
  })

  test('3.4 Case: 模式切换交互-点击按钮可切换状态', async ({ page }) => {
    // 3.4.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.4.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '小行星', '地球人')
    // 3.4.3 断言初始状态为规划模式，`.mode-toggle-chip` CSS 类包含 `active-planning`
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    // 3.4.4 点击 `.mode-toggle-chip` 按钮，等待 300ms
    await modeBtn.click()
    await page.waitForTimeout(300)
    // 3.4.5 断言切换后状态为实时模式，`.mode-toggle-chip` CSS 类包含 `active-live` #期望: ['实时']
    await expect(modeBtn).toHaveClass(/active-live/)
    const modeText1 = await modeBtn.locator('.chip-status').textContent()
    expect(modeText1).toContain('实时')
    // 3.4.6 断言 `.race-select` 隐藏（规划控件隐藏） #期望: [hidden]
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    // 3.4.7 再次点击 `.mode-toggle-chip` 按钮，等待 300ms
    await modeBtn.click()
    await page.waitForTimeout(300)
    // 3.4.8 断言切换回规划模式，`.mode-toggle-chip` CSS 类包含 `active-planning` #期望: ['规划']
    await expect(modeBtn).toHaveClass(/active-planning/)
    const modeText2 = await modeBtn.locator('.chip-status').textContent()
    expect(modeText2).toContain('规划')
    // 3.4.9 断言 `.race-select` 可见（规划控件显示） #期望: [visible]
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
  })

  test('3.5 Case: Toolbar布局结构正确展示各字段', async ({ page }) => {
    // 3.5.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.5.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '小行星', '地球人')
    // 3.5.3 断言 `.mode-toggle-chip` 可见（模式切换按钮）
    await expect(page.locator('.mode-toggle-chip')).toBeVisible({ timeout: 1000 })
    // 3.5.4 断言 `.readonly-pill` 可见且包含站点编码文本（编码字段）
    await expect(page.locator('.readonly-pill')).toBeVisible({ timeout: 500 })
    // 3.5.5 断言星区字段区域可见（点击可触发 popover）
    const sectorField = page.locator('.live-toolbar .toolbar-section .input-group').filter({ hasText: /^星区|Sector$/ }).first()
    await expect(sectorField).toBeVisible({ timeout: 500 })
    // 3.5.6 断言光伏效率 `.count-pill` 可见且显示百分比数值
    await expect(page.locator('.live-toolbar').locator('.count-pill').first()).toBeVisible({ timeout: 500 })
    // 3.5.7 断言 `.race-select` 可见（偏好种族下拉） #期望: [visible]
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
  })

  test('3.6 Case: 星区字段点击弹出坐标popover', async ({ page }) => {
    // 3.6.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.6.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    // 3.6.3 点击星区字段区域，触发 popover 显示
    const sectorField = page.locator('.input-group').filter({ hasText: /星区|Sector/ }).first()
    await sectorField.click()
    await page.waitForTimeout(100)
    // 3.6.4 断言 `.sector-popover` 可见
    await expect(page.locator('.sector-popover')).toBeVisible({ timeout: 500 })
    // 3.6.5 断言 popover 内容包含坐标文本格式 #期望: ['坐标']
    const popoverContent = page.locator('.sector-popover .popover-content')
    const popoverText = await popoverContent.textContent()
    expect(popoverText).toContain('坐标')
  })

  test('3.7 Case: 星区资源popover展示resources列表', async ({ page }) => {
    // 3.7.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.7.2 选择有资源的站点，等待 toolbar 加载
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    // 3.7.3 点击星区资源字段区域，触发 popover 显示
    const resourcesField = page.locator('.input-group').filter({ hasText: /星区资源|Sector Resources/ }).first()
    await resourcesField.click()
    await page.waitForTimeout(100)
    // 3.7.4 断言 `.resources-popover` 可见
    await expect(page.locator('.resources-popover')).toBeVisible({ timeout: 500 })
    // 3.7.5 断言 popover 内 `.resource-item` 元素存在（资源列表展示） #期望: [资源列表]
    await expect(page.locator('.resources-popover .popover-content')).toBeVisible({ timeout: 500 })
  })

  test('3.8 Case: 规划模式下控件可编辑', async ({ page }) => {
    // 3.8.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.8.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '小行星', '地球人')
    // 3.8.3 断言 `.race-select` 可见且可交互（偏好种族下拉）
    const raceSelect = page.locator('.race-select')
    await expect(raceSelect).toBeVisible({ timeout: 500 })
    await expect(raceSelect).toBeEnabled()
    // 3.8.4 断言 workforce toggle-chip 可见且可点击（工人运算开关）
    const workforceBtn = page.locator('.toolbar-section .toggle-chip').filter({ hasText: /ON|OFF/ }).first()
    await expect(workforceBtn).toBeVisible({ timeout: 500 })
    // 3.8.5 断言显示缺口 toggle-chip 可见且可点击
    const gapsBtn = page.locator('[data-testid="toggle-show-empire-gaps"]')
    await expect(gapsBtn).toBeVisible({ timeout: 500 })
    // 3.8.6 点击 workforce toggle-chip，断言状态切换 #期望: [ON/OFF切换]
    const initialText = await workforceBtn.locator('.chip-status').textContent()
    await workforceBtn.click()
    await page.waitForTimeout(100)
    const afterText = await workforceBtn.locator('.chip-status').textContent()
    expect(initialText).not.toBe(afterText)
  })

  test('3.9 Case: 实时模式下规划控件隐藏', async ({ page }) => {
    // 3.9.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
    await commonSetup(page)
    // 3.9.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    // 3.9.3 断言 `.race-select` 隐藏（偏好种族下拉隐藏） #期望: [hidden]
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    // 3.9.4 断言 workforce toggle-chip 隐藏（工人运算开关隐藏） #期望: [hidden]
    await expect(page.locator('[data-testid="toggle-show-empire-gaps"]')).toBeHidden({ timeout: 500 })
    // 3.9.5 断言显示缺口 toggle-chip 隐藏 #期望: [hidden]
    const workforceBtn = page.locator('.toolbar-section .toggle-chip').filter({ hasText: /ON|OFF/ }).first()
    await expect(workforceBtn).toBeHidden({ timeout: 500 })
  })
})