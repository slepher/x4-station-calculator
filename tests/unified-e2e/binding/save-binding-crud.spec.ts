import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

test.describe('Save Binding CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('live production view is active after fixture load', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="overview-tab"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
  })

  test('overview tab shows empire wareflow dashboard', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="overview-tab"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
    await overviewTab.click()

    const dashboard = page.locator('[data-testid="empire-wareflow-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 5000 })
  })
})
