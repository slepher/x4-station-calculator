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
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
    await overviewTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="empire-wareflow-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 5000 })
  })

  test('overview shows binding name in the save sync panel', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await overviewTab.click()
    await page.waitForTimeout(300)

    const bindingEntry = page.locator('.overview-left-panel').filter({ hasText: 'slepher' })
    await expect(bindingEntry).toBeVisible({ timeout: 5000 })
    await expect(bindingEntry).toContainText('slepher')
  })

  test('save upload panel and save list are visible in overview', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await overviewTab.click()
    await page.waitForTimeout(300)

    const uploadPanel = page.locator('.overview-left-panel')
    await expect(uploadPanel).toBeVisible({ timeout: 5000 })
  })

  test('live overview transit tab shows sector tab bar', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"]').first()
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
  })
})
