import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.describe('Live Station Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('live dashboard renders with station-dashboard testid', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })
  })

  test('live dashboard shows cost analysis after switching to live mode', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const modeBtn = page.locator('.mode-toggle-chip')
    await modeBtn.click()
    await page.waitForTimeout(500)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })

    const costStat = dashboard.locator('[data-testid="cost-stat"]')
    await expect(costStat).toBeVisible({ timeout: 1000 })
  })

  test('planning mode station dashboard shows editable analysis', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })

    const raceSelect = page.locator('.race-select')
    await expect(raceSelect).toBeVisible({ timeout: 500 })
  })
})
