import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'
import { expandSidebarGroup, getSidebarTransit } from '../live/helpers/sidebarNavigation'

async function verifyViewSwitching(page: Page, uiKey: string) {
  const footer = page.getByTestId('transport-throughput-footer')
  const toolbar = page.locator('.context-toolbar, .live-toolbar')
  await expect(toolbar).not.toContainText('单泊位吞吐量')
  await page.getByTestId('view-tab-btn-' + uiKey + '-quantity').click()
  await expect(footer).toHaveCount(0)
  await page.getByTestId('view-tab-btn-' + uiKey + '-transport').click()
  await expect(footer).toBeVisible()
  await expect(footer).toContainText('单泊位吞吐量')
  await expect(page.getByTestId('single-berth-throughput')).toHaveText(/^\s*[\d,]+\.\d m³\/h\s*$/)
  for (const mode of ['economy', 'volume', 'quantity']) {
    await page.getByTestId('view-tab-btn-' + uiKey + '-' + mode).click()
    await expect(footer).toHaveCount(0)
  }
  await page.getByTestId('view-tab-btn-' + uiKey + '-transport').click()
}

async function changeShipCapacity(page: Page) {
  await page.getByTestId('view-tab-btn-station-dashboard-volume').click()
  const slider = page.getByTestId('station-dashboard').locator('input.range-transport')
  await slider.fill('20000')
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('21000')
  await expect(page.getByTestId('single-berth-throughput')).toHaveText('315,000.0 m³/h')
}

test.describe('Blueprint transport throughput footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const data = JSON.parse(JSON.stringify(fixture.default))
    delete data.vsn
    data.x4_game_version = { version: '9.0', beta: false }
    data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, data)
    await page.reload()
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.getByTestId('sidebar-add-station').click()
  })

  test('shows throughput only in transport footer, including empty stations, and updates with capacity', async ({ page }) => {
    await verifyViewSwitching(page, 'station-wareflow')
    await expect(page.getByTestId('single-berth-throughput')).toHaveText('930,000.0 m³/h')
    await page.getByTestId('candidate-search-input').fill('module_gen_prod_energycells_01')
    await page.getByTestId('grouped-candidate-item-module_gen_prod_energycells_01').click()
    await changeShipCapacity(page)
  })
})

test.describe('Live transport throughput footer', () => {
  test.beforeEach(async ({ page }) => {
    await loadLiveBindingFixture(page)
  })

  test('station transport footer survives planning/live switch', async ({ page }) => {
    await expandSidebarGroup(page, 'cluster_100_sector001_macro')
    await page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]').click()
    await verifyViewSwitching(page, 'station-wareflow')
    await changeShipCapacity(page)
    await page.locator('.mode-toggle-chip').click()
    await expect(page.locator('.mode-toggle-chip')).toHaveClass(/active-live/)
    await expect(page.getByTestId('single-berth-throughput')).toHaveText('315,000.0 m³/h')
    await expect(page.locator('.live-toolbar')).not.toContainText('单泊位吞吐量')
  })

  test('transit transport footer survives mode switch without archive trade station', async ({ page }) => {
    const transit = await getSidebarTransit(page, 'cluster_100_sector001_macro')
    await transit.locator('.sidebar-nav').click()
    await verifyViewSwitching(page, 'transit-hub-wareflow')
    const throughput = await page.getByTestId('single-berth-throughput').textContent()
    await page.locator('.mode-toggle-chip').click()
    // Without an archive trade station, visualMode remains planning even in live mode.
    await expect(page.locator('.mode-toggle-chip .chip-status')).toHaveText('实时')
    await expect(page.getByTestId('single-berth-throughput')).toHaveText(throughput!)
    await expect(page.locator('.live-toolbar')).not.toContainText('单泊位吞吐量')
  })
})
