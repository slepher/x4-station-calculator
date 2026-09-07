import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const discard = (page: Page) => page.getByTestId('dialog-backdrop').getByRole('button', { name: /丢弃并新建|Discard\s*&\s*New/i })
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))

async function dirtyShipWithNewDialog(page: Page) {
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await page.getByTestId('ship-build-panel-fit').getByTestId('slot-type-engine').click()
  await page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]').first().click()
  await page.getByTestId('equipment-picker').locator('[data-testid^="candidate-engine_"]').first().click()
  await page.getByTestId('picker-confirm').click()
  const fitted = await blueprint(page)
  expect(fitted.shipId).toBe('ship_ter_m_corvette_02_a')
  expect(fitted.connections.flatMap((connection: any) => connection.group).filter((group: any) => group.equipment_id).length).toBeGreaterThan(0)
  await page.getByTestId('toolbar-new-btn').click()
  await expect(discard(page)).toBeVisible()
}

async function verifyReset(page: Page) {
  await expect(page.getByTestId('dialog-backdrop')).toBeHidden()
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_02_a')
  for (const panel of ['fit', 'stats', 'materials']) await expect(page.getByTestId(`ship-build-panel-${panel}`)).toBeVisible()
  await expect(page.getByTestId('ship-build-material-ship-group')).toContainText('大太刀')
  const reset = await blueprint(page)
  expect(reset.shipId).toBe('ship_ter_m_corvette_02_a')
  expect(reset.connections.flatMap((connection: any) => connection.group).filter((group: any) => group.equipment_id)).toEqual([])
  expect(await page.evaluate(() => (window as any).shipBuildStore.isDirty)).toBe(false)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
})

test('2.1 状态: ship-build-selected-ship-dirty', async ({ page }) => {
  await dirtyShipWithNewDialog(page)
})

test('2.2 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship', async ({ page }) => {
  await dirtyShipWithNewDialog(page)
  await discard(page).click()
  await verifyReset(page)
})

test('3.1 Case: 选船后修改并执行 New-Discard&New 后同 ship 且船体材料分组可见', async ({ page }) => {
  await dirtyShipWithNewDialog(page)
  await discard(page).click()
  await verifyReset(page)
  await page.getByTestId('toolbar-new-btn').click()
  await verifyReset(page)
})
