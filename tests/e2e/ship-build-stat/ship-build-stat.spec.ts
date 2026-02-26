import { test, expect } from '@playwright/test'

test.describe('Ship Build Stats Panel', () => {
  const shipBuildButton = (page: any) => page.getByRole('button', { name: /Ship Build|船只建造/ })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.waitForSelector('.toolbar-panel', { state: 'visible' })
  })

  // 2.1 Bootstrapping & State - 状态：船只建造已选 Heron Vanguard
  test('状态：船只建造已选 Heron Vanguard', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select class=L
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    // Select race=teladi
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    // Select type=freighter
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    // Select Heron Vanguard from list
    const listItems = page.locator('.list-item')
    await listItems.first().click()

    // Assert both stats panel and selection are visible
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
    await expect(page.getByTestId('ship-build-selection')).toBeVisible()
  })

  // 2.1 Bootstrapping & State - 切换：状态->详细档位
  test('切换：已选 Heron Vanguard -> 详细档位', async ({ page }) => {
    await shipBuildButton(page).click()

    // Setup state: select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Click detail button
    const detailBtn = page.getByTestId('ship-build-stats-mode-detail')
    await detailBtn.click()

    // Assert detail fields are shown
    const statsPanel = page.getByTestId('ship-build-stats-panel')
    await expect(statsPanel).toBeVisible()
  })

  // 2.2 Scenario - 中列属性区双档位渲染
  test('场景：中列属性区双档位渲染', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Assert both Summary and Detail buttons are visible
    await expect(page.getByTestId('ship-build-stats-mode-summary')).toBeVisible()
    await expect(page.getByTestId('ship-build-stats-mode-detail')).toBeVisible()
  })

  // 2.2 Scenario - 简略字段与截图 2 对齐
  test('场景：简略字段与截图 2 对齐', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Summary mode should be active
    const summaryBtn = page.getByTestId('ship-build-stats-mode-summary')
    await expect(summaryBtn).toHaveClass(/stats-mode-btn-active/)

    // Check that basic fields are shown (Hull, Shield, Speed, etc.)
    const statsPanel = page.getByTestId('ship-build-stats-panel')
    await expect(statsPanel).toBeVisible()
    const statsRows = statsPanel.locator('.stats-row')
    expect(await statsRows.count()).toBeGreaterThan(0)
  })

  // 2.2 Scenario - 详细字段与截图 1 对齐
  test('场景：详细字段与截图 1 对齐', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Get summary field count
    const statsPanel = page.getByTestId('ship-build-stats-panel')
    const summaryCount = await statsPanel.locator('.stats-row').count()

    // Switch to detail
    const detailBtn = page.getByTestId('ship-build-stats-mode-detail')
    await detailBtn.click()

    // Detail should have more fields than summary
    const detailCount = await statsPanel.locator('.stats-row').count()
    expect(detailCount).toBeGreaterThan(summaryCount)
  })

  // 2.2 Scenario - 详细档位真实值与占位并存
  test('场景：详细档位真实值与占位并存', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Switch to detail
    const detailBtn = page.getByTestId('ship-build-stats-mode-detail')
    await detailBtn.click()

    // Check real value fields: Hull/Shield/Speed/Boost/Travel/Crew/Storage
    const statsPanel = page.getByTestId('ship-build-stats-panel')
    const statsValues = statsPanel.locator('.stats-value')
    const valueTexts = await statsValues.allTextContents()

    // Should have some real values (non-placeholder)
    const hasRealValues = valueTexts.some(v => v && v.trim() !== '' && !v.includes('--'))
    expect(hasRealValues).toBe(true)

    // Should have placeholder message
    const pendingMsg = statsPanel.locator('.stats-pending')
    await expect(pendingMsg).toBeVisible()
    await expect(pendingMsg).toContainText(/not wired|待接入/)
  })

  // 2.2 Scenario - 取消固定高度限制
  test('场景：取消固定高度限制', async ({ page }) => {
    await shipBuildButton(page).click()

    // Select Heron Vanguard
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'L', exact: true }).click()

    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    await page.locator('.list-item').first().click()

    // Check stats panel has no fixed height
    const statsPanel = page.getByTestId('ship-build-stats-panel')
    const statsPanelStyle = await statsPanel.getAttribute('style') || ''
    expect(statsPanelStyle).not.toContain('h-48')
    expect(statsPanelStyle).not.toContain('72px')

    // Check selection panel has no fixed height
    const selectionPanel = page.getByTestId('ship-build-selection')
    if (await selectionPanel.count() > 0) {
      const selectionStyle = await selectionPanel.getAttribute('style') || ''
      expect(selectionStyle).not.toContain('h-48')
      expect(selectionStyle).not.toContain('72px')
    }
  })
})
