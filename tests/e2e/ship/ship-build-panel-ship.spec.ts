import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const view = (page: Page) => page.getByTestId('ship-build-view')
const hull = (page: Page) => page.getByTestId('ship-build-panel-ship').getByTestId('metric-value-hull')
const card = (page: Page, name: string) => page.locator('.list-item').filter({ has: page.getByTestId('ship-build-ship-name').filter({ hasText: new RegExp(`^${name}$`) }) })
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))

async function openSelector(page: Page) {
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
}
async function currentSelector(page: Page) {
  await expect(view(page)).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  await openSelector(page)
  await expect(card(page, '武士刀')).toHaveClass(/list-item-pending/)
  await expect(hull(page)).toHaveText('12,200MJ')
}
async function pendingOdachi(page: Page) {
  await currentSelector(page)
  await card(page, '大太刀').click()
  await expect(card(page, '大太刀')).toHaveClass(/list-item-pending/)
  await expect(view(page)).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  await expect(hull(page)).toHaveText(/16,100\s*\(\+3,900\)/)
}
async function confirmOdachi(page: Page) {
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  await expect(view(page)).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_02_a')
  const result = await blueprint(page)
  expect(result.shipId).toBe('ship_ter_m_corvette_02_a')
  expect(result.connections.flatMap((connection: any) => connection.group).filter((group: any) => group.equipment_id)).toEqual([])
}
async function allCorvettes(page: Page) {
  await currentSelector(page)
  // Loaded Katana preselects M/Terran/corvette; remove only race to show all 11 corvettes.
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await expect(page.getByTestId('ship-build-list-pager')).toBeVisible()
  await expect(page.locator('.list-item')).toHaveCount(10)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = data.x4_ship_blueprints
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
})

test('2.1 状态: selector-open-with-current-ship', async ({ page }) => {
  const before = await blueprint(page)
  await currentSelector(page)
  expect(await blueprint(page)).toEqual(before)
})

test('2.2 状态: selector-open-with-pending-ship', async ({ page }) => {
  const before = await blueprint(page)
  await pendingOdachi(page)
  expect(await blueprint(page)).toEqual(before)
})

test('2.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship', async ({ page }) => {
  await pendingOdachi(page)
  await confirmOdachi(page)
})

test('2.4 切换: selector-open-with-current-ship -> workspace-with-current-ship', async ({ page }) => {
  const before = await blueprint(page)
  await currentSelector(page)
  await page.getByTestId('ship-build-cancel-ship-change').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  expect(await blueprint(page)).toEqual(before)
})

test('3.1 Case: 更换飞船入口切到 selector 且保留当前 ship 基准', async ({ page }) => {
  const before = await blueprint(page)
  await pendingOdachi(page)
  await page.getByTestId('ship-build-cancel-ship-change').click()
  await expect(view(page)).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  expect(await blueprint(page)).toEqual(before)
})

test('3.2 Case: 选择同船确认可返回 workspace', async ({ page }) => {
  const before = await blueprint(page)
  await currentSelector(page)
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  expect(await blueprint(page)).toEqual(before)
})

test('3.3 Case: 选择不同船确认后切换 ship', async ({ page }) => {
  await pendingOdachi(page)
  await confirmOdachi(page)
  await expect(page.getByTestId('ship-build-material-ship-group')).toContainText('大太刀')
})

test('3.4 Case: 取消更换在同船级筛选下不改筛选标签', async ({ page }) => {
  const before = await blueprint(page)
  await currentSelector(page)
  await page.getByTestId('ship-build-filter-race-btn-argon').click()
  await expect(page.getByTestId('ship-build-filter-race-btn-argon')).toHaveClass(/filter-chip-active/)
  await page.getByTestId('ship-build-cancel-ship-change').click()
  expect(await blueprint(page)).toEqual(before)
  await openSelector(page)
  await expect(page.getByTestId('ship-build-filter-race-btn-argon')).toHaveClass(/filter-chip-active/)
})

test('3.5 Case: 跨船级 pending 仅显示 target 不显示 diff', async ({ page }) => {
  await currentSelector(page)
  await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
  await page.getByTestId('ship-build-filter-type-btn-destroyer').click()
  await card(page, '大阪').click()
  await expect(hull(page)).toHaveText('104,000MJ')
  await expect(view(page)).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
})

test('3.6 Case: 同船级 pending 显示 current/target 差值', async ({ page }) => {
  await pendingOdachi(page)
  await confirmOdachi(page)
  await openSelector(page)
  await card(page, '武士刀').click()
  await expect(hull(page)).toHaveText(/12,200\s*\(-3,900\)/)
})

test('3.7 Case: 候选超过 10 条时分页器位于列表上方右侧', async ({ page }) => {
  await allCorvettes(page)
  const actions = page.getByTestId('ship-build-list-column').locator('.list-header-actions')
  await expect(actions.getByTestId('ship-build-list-pager')).toBeVisible()
  await expect(actions.getByTestId('ship-build-confirm-ship')).toBeVisible()
  await expect(page.getByTestId('ship-build-list-pager').locator('button')).toHaveText(['<', '1', '2', '>'])
  const pager = await page.getByTestId('ship-build-list-pager').boundingBox()
  const first = await page.locator('.list-item').first().boundingBox()
  expect(pager).not.toBeNull()
  expect(first).not.toBeNull()
  expect(pager!.y + pager!.height).toBeLessThanOrEqual(first!.y)
})

test('3.8 Case: 分页器页码按钮高亮样式与 picker 分页器一致', async ({ page }) => {
  await allCorvettes(page)
  const firstPageNames = await page.getByTestId('ship-build-ship-name').allTextContents()
  await page.getByTestId('ship-build-page-2').click()
  await expect(page.getByTestId('ship-build-page-2')).toHaveClass(/pager-btn-active/)
  await expect(page.getByTestId('ship-build-page-1')).not.toHaveClass(/pager-btn-active/)
  await expect(page.locator('.list-item')).toHaveCount(1)
  expect(firstPageNames).not.toContain(await page.getByTestId('ship-build-ship-name').innerText())
  await expect(page.getByTestId('ship-build-list-pager').getByRole('button', { name: '>', exact: true })).toBeDisabled()
})
