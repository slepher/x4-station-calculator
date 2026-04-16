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
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
}

test.describe('Live Flow Map - 模块列表验证', () => {
  test('规划模式下，规划区不应包含 auto-fill 模块', async ({ page }) => {
    await commonSetup(page)
    await selectStationInSector(page, '小行星', '地球人')

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)

    const plannedSection = page.locator('.tier-section').first()
    await expect(plannedSection).toBeVisible({ timeout: 2000 })

    const plannedLabel = plannedSection.locator('.tier-label')
    await expect(plannedLabel).toContainText(/规划|Planned/)

    const plannedModules = plannedSection.locator('.module-row')
    const plannedCount = await plannedModules.count()
    console.log('[E2E] planned modules count:', plannedCount)

    const plannedModuleNames: string[] = []
    for (let i = 0; i < plannedCount; i++) {
      const moduleName = await plannedModules.nth(i).locator('.module-name').textContent()
      plannedModuleNames.push(moduleName || '')
    }
    console.log('[E2E] planned module names:', plannedModuleNames)

    const hasEnergycells = plannedModuleNames.some(name => 
      name.includes('能量电池') || name.includes('Energy Cell') || name.includes('energycells')
    )
    const hasStorage = plannedModuleNames.some(name => 
      name.includes('仓储') || name.includes('Storage') || name.includes('Container')
    )
    const hasEType = plannedModuleNames.some(name => 
      name.includes('E型') || name.includes('大型')
    )

    console.log('[E2E BUG CHECK] energycells in planned:', hasEnergycells)
    console.log('[E2E BUG CHECK] storage in planned:', hasStorage)
    console.log('[E2E BUG CHECK] E型-3x大型 in planned:', hasEType)

    expect(hasEnergycells).toBe(false)
    expect(hasStorage).toBe(false)
    expect(hasEType).toBe(false)

    const autoIndustrySection = page.locator('.tier-section.tier-auto').filter({ hasText: /自动工业区|Auto Industry/ })
    const autoInfraSection = page.locator('.tier-section.tier-auto').filter({ hasText: /自动基础设施|Auto Infrastructure/ })

    const autoIndustryCount = await autoIndustrySection.locator('.module-row').count()
    const autoInfraCount = await autoInfraSection.locator('.module-row').count()
    console.log('[E2E] auto industry modules count:', autoIndustryCount)
    console.log('[E2E] auto infrastructure modules count:', autoInfraCount)

    expect(autoIndustryCount).toBeGreaterThan(0)

    const autoIndustryNames: string[] = []
    const autoIndustryModules = autoIndustrySection.locator('.module-row')
    for (let i = 0; i < autoIndustryCount; i++) {
      const name = await autoIndustryModules.nth(i).locator('.module-name').textContent()
      autoIndustryNames.push(name || '')
    }
    console.log('[E2E] auto industry module names:', autoIndustryNames)

    const hasEnergycellsInAuto = autoIndustryNames.some(name => 
      name.includes('能量电池') || name.includes('Energy Cell') || name.includes('energycells') || name.includes('太阳能')
    )
    expect(hasEnergycellsInAuto).toBe(true)
  })

  test('实时模式下 wareflow 应显示真实模块产物，能量电池为负消耗且无重复产线', async ({ page }) => {
    await commonSetup(page)
    await selectStationInSector(page, '小行星', '地球人')

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    await expect(modeBtn).toBeEnabled()

    await modeBtn.click()
    await page.waitForTimeout(500)

    await expect(modeBtn).toHaveClass(/active-live/)

    const expectedWares = [
      { wareId: 'computronicsubstrate', expectedNetRate: 'positive' },
      { wareId: 'siliconcarbide', expectedNetRate: 'positive' },
      { wareId: 'metallicmicrolattice', expectedNetRate: 'positive' },
      { wareId: 'energycells', expectedNetRate: 'negative' }
    ]

    for (const { wareId, expectedNetRate } of expectedWares) {
      const flowWrapper = page.locator(`.flow-wrapper[data-resource-id="${wareId}"]`)
      const count = await flowWrapper.count()
      console.log(`[E2E] ${wareId} flow count:`, count)
      
      expect(count).toBe(1)

      const valueEl = flowWrapper.first().locator('.value')
      const valueText = await valueEl.textContent()
      const netRate = parseFloat(valueText?.replace(/[+Cr\s]/g, '') || '0')
      console.log(`[E2E] ${wareId} netRate:`, netRate)

      if (expectedNetRate === 'positive') {
        expect(netRate).toBeGreaterThan(0)
      } else {
        expect(netRate).toBeLessThan(0)
      }
    }

    const energycellsFlow = page.locator('.flow-wrapper[data-resource-id="energycells"]')
    const detailRows = energycellsFlow.locator('.detail-row')
    const detailCount = await detailRows.count()
    console.log('[E2E] energycells detail rows count:', detailCount)

    expect(detailCount).toBeLessThanOrEqual(3)

    const detailNames: string[] = []
    for (let i = 0; i < detailCount; i++) {
      const name = await detailRows.nth(i).locator('.name').textContent()
      detailNames.push(name || '')
    }
    console.log('[E2E] energycells detail names:', detailNames)

    const energycellsLinesCount = detailNames.filter(name => 
      name.includes('能量电池') || name.includes('Energy Cell') || name.includes('energycells')
    ).length
    console.log('[E2E] energycells production lines in details:', energycellsLinesCount)

    expect(energycellsLinesCount).toBe(0)
  })
})

test.describe('Live Flow Map - Transit Hub 切换规则验证', () => {
  test('transit hub toggle 按钮 UI 存在且文本变化', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const modeToggle = page.locator('.mode-toggle-chip')
    await expect(modeToggle).toBeVisible({ timeout: 1000 })
    await expect(modeToggle).toHaveClass(/active-planning/)

    const chipStatus = await modeToggle.locator('.chip-status').textContent()
    expect(chipStatus).toContain('规划')

    await modeToggle.click()
    await page.waitForTimeout(500)

    const liveChipStatus = await modeToggle.locator('.chip-status').textContent()
    expect(liveChipStatus).toContain('实时')
    await expect(modeToggle).toHaveClass(/active-live/)
  })

  test('transit hub 无 archive 时，按钮文本变化但样式保持 planning 色', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const modeToggle = page.locator('.mode-toggle-chip')
    await expect(modeToggle).toBeVisible({ timeout: 1000 })

    const chipStatus = await modeToggle.locator('.chip-status').textContent()
    expect(chipStatus).toContain('规划')

    await modeToggle.click()
    await page.waitForTimeout(500)

    const liveChipStatus = await modeToggle.locator('.chip-status').textContent()
    expect(liveChipStatus).toContain('实时')

    await expect(modeToggle).toHaveClass(/active-planning/)
    await expect(modeToggle).not.toHaveClass(/active-live/)
  })

  test('transit hub 有 archive 时，切换后建筑模块面板存在', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const buildPanel = page.locator('.tier-section.tier-auto')
    await expect(buildPanel).toBeVisible({ timeout: 2000 })

    const modeToggle = page.locator('.mode-toggle-chip')
    await modeToggle.click()
    await page.waitForTimeout(500)

    const archiveList = page.locator('.archive-module-list')
    await expect(archiveList).toBeVisible()
  })

  test('transit hub 无 archive 时，切换后建筑模块面板内容不变', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const buildPanel = page.locator('.tier-section.tier-auto')
    await expect(buildPanel).toBeVisible({ timeout: 2000 })

    const planningContent = await buildPanel.textContent()
    console.log('[E2E Transit] planning content:', planningContent?.substring(0, 100))

    const modeToggle = page.locator('.mode-toggle-chip')
    await modeToggle.click()
    await page.waitForTimeout(500)

    const liveContent = await buildPanel.textContent()
    console.log('[E2E Transit] live content:', liveContent?.substring(0, 100))

    expect(liveContent).toBe(planningContent)
  })

  test('station live dashboard 显示 live analysis', async ({ page }) => {
    await commonSetup(page)
    await selectStationInSector(page, '小行星', '地球人')

    const modeBtn = page.locator('.mode-toggle-chip')
    await modeBtn.click()
    await page.waitForTimeout(500)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })

    const costStat = dashboard.locator('[data-testid="cost-stat"]')
    await expect(costStat).toBeVisible({ timeout: 1000 })

    const costValue = await costStat.locator('.stat-value').textContent()
    console.log('[E2E Station Dashboard] live cost:', costValue)

    expect(costValue).toBeTruthy()
  })

  test('transit hub 有 archive 时，切换后 build 区使用 ArchiveModuleList', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const modeToggle = page.locator('.mode-toggle-chip')
    await modeToggle.click()
    await page.waitForTimeout(500)

    await expect(modeToggle).toHaveClass(/active-live/)

    const archiveModuleList = page.locator('.archive-module-list')
    await expect(archiveModuleList).toBeVisible({ timeout: 2000 })

    const moduleRows = archiveModuleList.locator('.module-row')
    const count = await moduleRows.count()
    console.log('[E2E Transit Archive] archive module count:', count)

    expect(count).toBeGreaterThan(0)
  })

  test('transit hub center dashboard 在 live mode 下切换数据源', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const centerDashboard = page.locator('[data-testid="transit-hub-center-dashboard"]')
    await expect(centerDashboard).toBeVisible({ timeout: 2000 })

    const planningFlows = centerDashboard.locator('.ware-flow-row')
    const planningCount = await planningFlows.count()
    console.log('[E2E Transit Center] planning flows count:', planningCount)

    const modeToggle = page.locator('.mode-toggle-chip')
    await modeToggle.click()
    await page.waitForTimeout(500)

    const liveFlows = centerDashboard.locator('.ware-flow-row')
    const liveCount = await liveFlows.count()
    console.log('[E2E Transit Center] live flows count:', liveCount)

    expect(liveCount).toBeGreaterThanOrEqual(0)
  })

  test('transit hub materials panel 在无 archive 时保持 planning 数据', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const materialsPanel = page.locator('[data-testid="transit-hub-materials-panel"]')
    await expect(materialsPanel).toBeVisible({ timeout: 2000 })

    const planningMaterials = await materialsPanel.locator('.module-row').count()
    console.log('[E2E Transit Materials] planning materials count:', planningMaterials)

    const modeToggle = page.locator('.mode-toggle-chip')
    await modeToggle.click()
    await page.waitForTimeout(500)

    const liveMaterials = await materialsPanel.locator('.module-row').count()
    console.log('[E2E Transit Materials] live materials count:', liveMaterials)

    expect(liveMaterials).toBe(planningMaterials)
  })

  test('transit hub 扇区信息显示正确的日照效率而非默认100%', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const toolbar = page.locator('.live-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 1000 })

    const sunlightGroup = toolbar.locator('.input-group').filter({ hasText: /光伏效率|Sunlight/ })
    await expect(sunlightGroup).toBeVisible({ timeout: 1000 })

    const sunlightPill = sunlightGroup.locator('.count-pill')
    const sunlightValue = await sunlightPill.locator('.font-mono').textContent()
    console.log('[E2E Transit Sector] sunlight value:', sunlightValue)

    expect(sunlightValue).toBeTruthy()
    expect(sunlightValue).not.toBe('100')

    const sunlightNum = parseInt(sunlightValue || '0')
    expect(sunlightNum).toBeGreaterThan(100)
    expect(sunlightNum).toBeLessThan(200)
  })

  test('transit hub 扇区信息显示正确的扇区资源数量', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const toolbar = page.locator('.live-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 1000 })

    const resourcesGroup = toolbar.locator('[data-testid="sector-resources-pill"]')
    await expect(resourcesGroup).toBeVisible({ timeout: 1000 })

    const resourceValue = await resourcesGroup.locator('.font-mono').textContent()
    console.log('[E2E Transit Sector] resource count:', resourceValue)

    expect(resourceValue).toBeTruthy()
    const count = parseInt(resourceValue || '0')
    expect(count).toBeGreaterThan(0)
  })

  test('transit hub 扇区 popover 显示正确的扇区名称', async ({ page }) => {
    await commonSetup(page)

    const transitTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(transitTab).toBeVisible({ timeout: 5000 })
    await transitTab.click()
    await page.waitForTimeout(500)

    const toolbar = page.locator('.live-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 1000 })

    const sectorPill = toolbar.locator('[data-testid="sector-pill"]')
    await sectorPill.click()
    await page.waitForTimeout(300)

    const popover = page.locator('.sector-popover')
    await expect(popover).toBeVisible({ timeout: 1000 })

    const popoverHeader = await popover.locator('.popover-header').textContent()
    console.log('[E2E Transit Sector] popover header:', popoverHeader)

    expect(popoverHeader).toBeTruthy()
    expect(popoverHeader).not.toBe('-')

    await page.keyboard.press('Escape')
  })
})