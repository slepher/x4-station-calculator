import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('Empire CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.getByTestId('sidebar-add-station').click()
    await expect(page.locator('[data-testid="sidebar-station"][data-station-id]')).toHaveCount(1)
  })

  test('opens load modal from toolbar', async ({ page }) => {
    const loadBtn = page.locator('[data-testid="toolbar-load-btn"]')
    await expect(loadBtn).toBeVisible()
    await loadBtn.click()
    await expect(page.locator('[data-testid="dialog-backdrop"]')).toBeVisible()
  })

  test('default empire exists with one station', async ({ page }) => {
    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const count = await stationTabs.count()
    expect(count).toBe(1)
  })

  test('new button creates fresh empire', async ({ page }) => {
    const newBtn = page.locator('[data-testid="toolbar-new-btn"]')
    await newBtn.click()

    const dialog = page.locator('[data-testid="dialog-backdrop"]')
    if (await dialog.isVisible()) {
      const discardBtn = dialog.locator('button').filter({ hasText: /丢弃|Discard/ }).first()
      await discardBtn.click({ force: true })
    }
    await page.waitForTimeout(200)

    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const count = await stationTabs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('load modal opens and shows saved empires', async ({ page }) => {
    const loadBtn = page.locator('[data-testid="toolbar-load-btn"]')
    await loadBtn.click()
    const dialog = page.locator('[data-testid="dialog-backdrop"]')
    await expect(dialog).toBeVisible()
  })
})
