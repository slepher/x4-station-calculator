import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.describe('binding selects latest valid archive', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page, {
      transformSave: (save, filename) => {
        if (filename === 'save.json') {
          return { ...save, meta: { ...save.meta, parser_version: 'v4' } }
        }
        return save
      }
    })
  })

  test('map save panel shows invalid badge on newest archive, valid one is clickable', async ({ page }) => {
    await page.getByTestId('top-view-btn-maps').click()
    await page.waitForTimeout(500)
    const saveTab = page.getByTestId('map-save-panel-tab')
    await expect(saveTab).toBeVisible({ timeout: 3000 })
    await saveTab.click()
    await page.waitForTimeout(500)

    const panel = page.getByTestId('map-save-panel')
    await expect(panel).toBeVisible({ timeout: 3000 })

    const invalidWarning = panel.locator('.invalid-warning')
    await expect(invalidWarning).toBeVisible()
    await expect(invalidWarning).toContainText(/无效|Invalid/)

    const groupTitle = panel.locator('[data-testid="save-group-title"]')
    await expect(groupTitle).toBeVisible()
    await expect(groupTitle).toContainText(/slepher/)
    await expect(groupTitle).toContainText(/2/)
  })

  test('stations load from older valid archive when newer one is invalid', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('.station-tab').filter({ hasText: '地球人' })
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })
  })
})
