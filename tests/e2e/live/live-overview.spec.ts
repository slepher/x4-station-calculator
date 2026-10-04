import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'
import { getSidebarTransit } from './helpers/sidebarNavigation'

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

    const dashboard = page.locator('[data-testid="empire-wareflow-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 5000 })
    await expect(dashboard.getByTestId('flow-wrapper').first()).toBeVisible()
  })

  test('overview shows binding name in the save sync panel', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await overviewTab.click()

    const bindingEntry = page.locator('.overview-left-panel').filter({ hasText: 'slepher' })
    await expect(bindingEntry).toBeVisible({ timeout: 5000 })
    await expect(bindingEntry).toContainText('slepher')
    await expect(bindingEntry.locator('.archive-group--bound .player-name')).toHaveText('slepher')
    await expect(bindingEntry.locator('.save-item-selected .save-filename')).toHaveText('save_008')
    expect(await page.evaluate(() => (window as any).saveStore.selectedArchive.meta.time)).toBe(667632.933)
  })

  test('save upload panel and save list are visible in overview', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await overviewTab.click()

    const uploadPanel = page.locator('.overview-left-panel')
    await expect(uploadPanel).toBeVisible({ timeout: 5000 })
    await expect(uploadPanel.locator('.upload-zone')).toBeVisible()
    await expect(uploadPanel.locator('input[type="file"]')).toHaveCount(1)
    await expect(uploadPanel.locator('.save-list .save-item').first()).toBeVisible()
  })

  test('live overview transit tab shows sector tab bar', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"]').first()
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await (await getSidebarTransit(page, 'cluster_100_sector001_macro')).locator('.sidebar-nav').click()
    await expect(page.locator('.mode-toggle-chip')).toBeVisible()
    await expect(page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')).toBeVisible()
  })
})
