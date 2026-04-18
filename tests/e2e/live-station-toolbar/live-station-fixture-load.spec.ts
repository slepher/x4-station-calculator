import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from '../helpers/loadLiveBindingFixture'

test.describe('Live Station Fixture Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('loads save binding fixture and reveals archive-only station tabs', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '神圣眼光' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()

    const archiveStationTab = page.locator('.station-tab').filter({ hasText: 'PPW-916' })
    await expect(archiveStationTab).toBeVisible({ timeout: 5000 })
  })
})
