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
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })
    await expect(page.locator('.mode-toggle-chip')).toHaveClass(/active-planning/)
    await expect(page.locator('.live-toolbar .ghost-input')).toHaveValue('地球人')
    await expect(dashboard.locator('.stats-bar .stat-item')).toHaveCount(6)
  })

  test('live dashboard shows cost analysis after switching to live mode', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toHaveClass(/active-planning/)
    await modeBtn.click()
    await expect(modeBtn).toHaveClass(/active-live/)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })

    const costStat = dashboard.locator('[data-testid="cost-stat"]')
    await expect(costStat).toBeVisible({ timeout: 1000 })
    await expect(costStat.locator('.stat-value')).toContainText('Cr')
    const archiveModule = page.locator('.archive-module-list .module-row').filter({ has: page.locator('.module-name-text').filter({ hasText: /^电子基质生产线$/ }) })
    await expect(archiveModule.locator('.count-text')).toHaveText('8')
    await expect(archiveModule.locator('input')).toHaveCount(0)
    await page.getByTestId('view-tab-btn-station-dashboard-workers').click()
    await expect(dashboard.locator('.auto-toggle input')).toBeChecked()
    await expect(dashboard.locator('.auto-toggle input')).toBeDisabled()
    await modeBtn.click()
    await expect(modeBtn).toHaveClass(/active-planning/)
    await expect(dashboard.locator('.auto-toggle input')).toBeEnabled()
  })

  test('planning mode station dashboard shows editable analysis', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })

    const raceSelect = page.locator('.race-select')
    await expect(raceSelect).toBeVisible({ timeout: 500 })
    await expect(raceSelect).toBeEnabled()
    const plannedModule = page.locator('.module-row--draggable').filter({ has: page.locator('.module-name-text').filter({ hasText: /^电子基质生产线$/ }) })
    await expect(plannedModule.locator('input')).toHaveValue('10')
    const stats = await dashboard.locator('.stats-bar').innerText()
    for (const view of ['volume', 'time', 'workers']) {
      await page.getByTestId(`view-tab-btn-station-dashboard-${view}`).click()
      await expect(dashboard.locator('.stats-bar')).toHaveText(stats, { useInnerText: true })
    }
  })
})
