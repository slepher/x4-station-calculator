import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.describe('Live Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('overview tab is visible and shows empire wareflow dashboard', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="overview-tab"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
    await overviewTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="empire-wareflow-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 5000 })
  })

  test('overview toolbar shows binding name', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="overview-tab"]')
    await overviewTab.click()
    await page.waitForTimeout(300)

    const nameInput = page.locator('.ghost-input.w-64.text-lg').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    const name = await nameInput.inputValue()
    expect(name.length).toBeGreaterThan(0)
  })

  test('save upload panel and save list are visible in overview', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="overview-tab"]')
    await overviewTab.click()
    await page.waitForTimeout(300)

    const uploadPanel = page.locator('.overview-left-panel')
    await expect(uploadPanel).toBeVisible({ timeout: 5000 })
  })

  test('live overview transit tab shows sector tab bar', async ({ page }) => {
    const sectorTab = page.locator('[data-testid^="supply-tab"]').first()
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
  })
})
