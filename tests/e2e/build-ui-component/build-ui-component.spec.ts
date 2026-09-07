import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

const ENERGY = 'module_gen_prod_energycells_01'
const keys = ['materials', 'volume', 'time', 'workers'] as const
const dashboard = (page: Page) => page.getByTestId('station-dashboard')
const energy = (page: Page) => dashboard(page).locator('.module-detail').filter({
  has: page.locator('.variant-module .name').filter({ hasText: /^能量电池产线$/ })
})
const titles = { materials: '建设成本', volume: '材料体积', time: '建造用时', workers: '劳动力' }

async function expectView(page: Page, key: typeof keys[number]) {
  await expect(dashboard(page)).toBeVisible()
  const tabs = page.getByTestId('view-tab-ui-station-dashboard')
  await expect(tabs).toBeVisible()
  await expect(tabs.getByRole('button')).toHaveCount(4)
  expect(await tabs.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('data-testid'))))
    .toEqual(keys.map(key => `view-tab-btn-station-dashboard-${key}`))
  await expect(tabs.locator('.view-tab-btn-active-sky')).toHaveCount(1)
  await expect(page.getByTestId(`view-tab-btn-station-dashboard-${key}`)).toHaveClass(/view-tab-btn-active-sky/)
  await expect(dashboard(page).locator('.header-title')).toHaveText(titles[key])
  const value = energy(page).locator('.total-value')
  const footer = dashboard(page).locator('.dashboard-footer')
  if (key === 'materials') {
    await expect(value).toHaveText(/[\d,]+ Cr/)
    await expect(footer.locator('input[type=range]')).toBeVisible()
    await expect(footer.locator('.workforce-control-panel')).toHaveCount(0)
  } else if (key === 'volume') {
    // Static 9.0 recipe: 260×24 + 951×12 + 520×1 = 18,172 m³.
    await expect(value).toHaveText('18,172 m³')
    await expect(footer.locator('input[type=range]')).toHaveAttribute('min', '5000')
    await expect(footer.locator('.workforce-control-panel')).toHaveCount(0)
  } else if (key === 'time') {
    // Static Energy module build time: 756 seconds.
    await expect(value).toHaveText('00:12:36')
    await expect(footer).toHaveCount(0)
  } else {
    await expect(value).toHaveText('90')
    await expect(footer.locator('.workforce-control-panel')).toBeVisible()
    await expect(footer.locator('.simulation-controls')).toHaveCount(0)
  }
}
async function switchView(page: Page, key: typeof keys[number]) {
  await page.getByTestId(`view-tab-btn-station-dashboard-${key}`).click()
  await expectView(page, key)
}

test.describe('build-ui-component e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const data = JSON.parse(JSON.stringify(fixture.default)); delete data.vsn
    data.x4_game_version = { version: '9.0', beta: false }
    data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
    await page.evaluate(data => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, data)
    await page.reload()
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.getByTestId('sidebar-add-station').click()
    await page.getByTestId('candidate-search-input').fill(ENERGY)
    await page.getByTestId(`grouped-candidate-item-${ENERGY}`).click()
  })

  test('2.1 状态: StationDashboard-默认视图', async ({ page }) => {
    await expectView(page, 'materials')
  })
  test('2.2 切换: materials -> volume', async ({ page }) => {
    await expectView(page, 'materials')
    await switchView(page, 'volume')
  })
  test('2.3 切换: volume -> time', async ({ page }) => {
    await switchView(page, 'volume')
    await switchView(page, 'time')
  })
  test('2.4 切换: time -> workers', async ({ page }) => {
    await switchView(page, 'time')
    await switchView(page, 'workers')
  })
  test('3.1 Case: Dashboard 视图切换无回归', async ({ page }) => {
    await expectView(page, 'materials')
    const before = Number((await energy(page).locator('.total-value').innerText()).replace(/[^\d.]/g, ''))
    await dashboard(page).locator('.dashboard-footer input[type=range]').press('End')
    await expect.poll(async () => Number((await energy(page).locator('.total-value').innerText()).replace(/[^\d.]/g, ''))).toBeGreaterThan(before)
    await switchView(page, 'volume')
    const capacity = dashboard(page).locator('.dashboard-footer input[type=range]')
    await capacity.press('Home')
    await expect(capacity).toHaveValue('5000')
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.stationState.settings.transportShipCapacity)).toBe(5000)
    await expect(energy(page).locator('.total-value')).toHaveText('18,172 m³')
    await switchView(page, 'time')
    await switchView(page, 'workers')
  })
  test('3.2 Case: data-testid 稳定可定位', async ({ page }) => {
    for (const key of keys) await switchView(page, key)
    await switchView(page, 'materials')
  })
})
