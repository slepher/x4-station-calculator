import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('StationStateMap 回归 - 分站隔离', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('切换分站不串站', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    await addBtn.click()
    await page.waitForTimeout(200)

    const tabs = page.locator('.station-tab')
    await expect(tabs).toHaveCount(2)

    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveClass(/active/)

    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveClass(/active/)
    await expect(tabs.nth(0)).not.toHaveClass(/active/)
  })
})
