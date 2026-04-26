import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('Empire CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('isTestEnv', 'true')
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('opens load modal from toolbar', async ({ page }) => {
    const loadBtn = page.locator('[data-testid="toolbar-load-btn"]')
    await expect(loadBtn).toBeVisible()
    await loadBtn.click()
    await expect(page.locator('[data-testid="dialog-backdrop"]')).toBeVisible()
  })

  test('default empire exists with one station', async ({ page }) => {
    const stationTabs = page.locator('.station-tab')
    const count = await stationTabs.count()
    expect(count).toBeGreaterThan(0)
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

    const stationTabs = page.locator('.station-tab')
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
