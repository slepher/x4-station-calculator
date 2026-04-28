import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.describe('Contribution name 显示验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
    await page.waitForTimeout(300)

    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.waitForTimeout(200)
  })

  test('小行星星区: 反物质转换器展开后应显示 station name "新建空间站"', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })

    const antimatterFlow = wareflowPanel.locator('.flow-wrapper').filter({ hasText: '反物质转换器' })
    await expect(antimatterFlow).toBeVisible({ timeout: 2000 })

    const mainRow = antimatterFlow.locator('.main-row')
    await mainRow.click()
    await page.waitForTimeout(200)

    const listBox = antimatterFlow.locator('.list-box')
    await expect(listBox).toBeVisible({ timeout: 1000 })

    const listContent = await listBox.textContent()
    expect(listContent).toContain('新建空间站')
  })

  test('地球人: 星区运营电子基质展开后贡献名应显示 "地球人" 而非 KXN-018', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    const modeClass = await modeBtn.getAttribute('class')
    if (modeClass && modeClass.includes('active-live')) {
      await modeBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(modeBtn).toHaveClass(/active-planning/)

    const stationTab = page.locator('.station-tab').filter({ hasText: '地球人' })
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const opsSection = page.locator('.list-wrapper').filter({ hasText: /星区运营|Sector Operations/i })
    await expect(opsSection).toBeVisible({ timeout: 2000 })

    const electronicMatrix = opsSection.locator('.flow-wrapper').filter({ hasText: '电子基质' })
    await expect(electronicMatrix).toBeVisible({ timeout: 2000 })

    const mainRow = electronicMatrix.locator('.main-row')
    await mainRow.click()
    await page.waitForTimeout(200)

    const listBox = electronicMatrix.locator('.list-box')
    await expect(listBox).toBeVisible({ timeout: 1000 })

    const listContent = await listBox.textContent()
    expect(listContent).toContain('地球人')
    expect(listContent).not.toContain('KXN-018')
  })

  test('小行星仓储视图: 反物质转换器展开后贡献名应显示 "新建空间站"', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    const modeClass = await modeBtn.getAttribute('class')
    if (modeClass && modeClass.includes('active-live')) {
      await modeBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(modeBtn).toHaveClass(/active-planning/)

    const volumeTab = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]')
    await expect(volumeTab).toBeVisible({ timeout: 2000 })
    await volumeTab.click()
    await page.waitForTimeout(300)

    const volumePanel = page.locator('[data-testid="volume-groups"]')
    await expect(volumePanel).toBeVisible({ timeout: 2000 })

    const antimatterFlow = volumePanel.locator('.flow-wrapper').filter({ hasText: '反物质转换器' })
    await expect(antimatterFlow).toBeVisible({ timeout: 2000 })

    const mainRow = antimatterFlow.locator('.main-row')
    await mainRow.click()
    await page.waitForTimeout(200)

    const listBox = antimatterFlow.locator('.list-box')
    await expect(listBox).toBeVisible({ timeout: 1000 })

    const listContent = await listBox.textContent()
    expect(listContent).toContain('新建空间站')
  })

  test('小行星运输视图: 反物质转换器展开后贡献名应显示 "新建空间站"', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    const modeClass = await modeBtn.getAttribute('class')
    if (modeClass && modeClass.includes('active-live')) {
      await modeBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(modeBtn).toHaveClass(/active-planning/)

    const transportTab = page.locator('[data-testid="view-tab-btn-station-wareflow-transport"]')
    await expect(transportTab).toBeVisible({ timeout: 2000 })
    await transportTab.click()
    await page.waitForTimeout(300)

    const transportPanel = page.locator('[data-testid="transport-groups"]')
    await expect(transportPanel).toBeVisible({ timeout: 2000 })

    const antimatterFlow = transportPanel.locator('.flow-wrapper').filter({ hasText: '反物质转换器' })
    await expect(antimatterFlow).toBeVisible({ timeout: 2000 })

    const mainRow = antimatterFlow.locator('.main-row')
    await mainRow.click()
    await page.waitForTimeout(200)

    const listBox = antimatterFlow.locator('.list-box')
    await expect(listBox).toBeVisible({ timeout: 1000 })

    const listContent = await listBox.textContent()
    expect(listContent).toContain('新建空间站')
  })

  test('新建空间站缺口: 星区运营量子管明细应含 "阿尔忒弥斯的朦胧" 和 "警惕凝视"', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    const modeClass = await modeBtn.getAttribute('class')
    if (modeClass && modeClass.includes('active-live')) {
      await modeBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(modeBtn).toHaveClass(/active-planning/)

    const stationTab = page.locator('.station-tab').filter({ hasText: '新建空间站' })
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const gapToggle = page.locator('[data-testid="toggle-show-empire-gaps"]')
    await expect(gapToggle).toBeVisible({ timeout: 2000 })
    await gapToggle.click()
    await page.waitForTimeout(300)

    const sectorOpsSection = page.locator('.empire-gap-group').filter({ hasText: /星区运营|Sector Operations/i })
    await expect(sectorOpsSection).toBeVisible({ timeout: 2000 })

    const quantumTubes = sectorOpsSection.locator('.flow-wrapper').filter({ hasText: '量子管' })
    await expect(quantumTubes).toBeVisible({ timeout: 2000 })

    const mainRow = quantumTubes.locator('.main-row')
    await mainRow.click()
    await page.waitForTimeout(200)

    const listBox = quantumTubes.locator('.list-box')
    await expect(listBox).toBeVisible({ timeout: 1000 })

    const listContent = await listBox.textContent()
    expect(listContent).toContain('阿尔忒弥斯的朦胧')
    expect(listContent).toContain('警惕凝视')
  })
})
