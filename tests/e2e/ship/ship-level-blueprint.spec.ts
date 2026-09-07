import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const shipId = 'ship_ter_m_corvette_02_a'
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
const persisted = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('x4_ship_blueprints_v9')!))
const fit = (page: Page) => page.getByTestId('ship-build-panel-fit')
async function selectOdachi(page: Page) {
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(fit(page)).toBeVisible()
}
async function equip(page: Page, type = 'engine') {
  await page.getByTestId(`slot-type-${type}`).click()
  await fit(page).locator('.slot-row').first().click()
  await page.locator(`[data-testid^="candidate-${type}_"]`).first().click()
  await page.getByTestId('picker-confirm').click()
}
async function saveAs(page: Page, name: string) {
  await page.getByTestId('toolbar-save-as-btn').click()
  await page.locator('.dialog-input').fill(name)
  await page.locator('.dialog-input').press('Enter')
  await expect(page.locator('.dialog-input')).toBeHidden()
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toContainText(name)
}
async function load(page: Page, name: string) {
  await page.getByTestId('ship-build-blueprint-menu-trigger').click()
  await page.getByTestId('ship-build-blueprint-menu').locator('.ship-blueprint-menu-item-text').filter({ hasText: new RegExp(`^${name}$`) }).click()
  await expect(page.getByTestId('ship-build-blueprint-menu')).toBeHidden()
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  if (testInfo.title.startsWith('3.4 Fit')) {
    data.x4_ship_blueprints_v9 = { ...data.x4_ship_blueprints, activeShipId: shipId, activeBlueprintId: 'b2540610-0c02-698f-4451-3d8ce1183c49' }
  }
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
})

test('2.1 / 3.1 no selected ship disables mutations and exposes no Load entry', async ({ page }) => {
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', '')
  for (const action of ['new', 'save', 'save-as']) await expect(page.getByTestId(`toolbar-${action}-btn`)).toBeDisabled()
  await expect(page.getByTestId('toolbar-load-btn')).toHaveCount(0)
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toBeHidden()
})

test('2.2 / 3.3 dirty ship New opens save dialog and discard keeps selected ship', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await page.getByTestId('toolbar-new-btn').click()
  await expect(page.getByTestId('dialog-backdrop')).toBeVisible()
  await page.getByRole('button', { name: /丢弃并新建/ }).click()
  await expect(page.getByTestId('dialog-backdrop')).toBeHidden()
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', shipId)
  expect((await blueprint(page)).connections.flatMap((c: any) => c.group).filter((g: any) => g.equipment_id)).toEqual([])
})

test('2.3 / 3.2 Save persists dirty blueprint; clean second Save leaves persisted bytes unchanged', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await saveAs(page, 'M10.3 saved ship')
  await equip(page, 'shield')
  await page.getByTestId('toolbar-save-btn').click()
  await expect(fit(page).locator('.ship-blueprint-dirty-dot')).toHaveCount(0)
  const first = await persisted(page)
  expect(first.version).toBe(5)
  expect(first.activeShipId).toBe(shipId)
  const saved = first.ships.find((s: any) => s.shipId === shipId).blueprints.find((b: any) => b.id === first.activeBlueprintId)
  expect(saved.connections.flatMap((c: any) => c.group).filter((g: any) => g.equipment_id?.startsWith('shield_'))).toHaveLength(1)
  await page.getByTestId('toolbar-save-btn').click()
  expect(await persisted(page)).toEqual(first)
})

test('3.4 Fit load dropdown lists only current ship blueprints', async ({ page }) => {
  await expect(fit(page)).toBeVisible()
  await page.getByTestId('ship-build-blueprint-menu-trigger').click()
  const menu = page.getByTestId('ship-build-blueprint-menu')
  await expect(menu.locator('.ship-blueprint-menu-item-text').filter({ hasText: /^Odachi$/ })).toBeVisible()
  await expect(menu).not.toContainText('Katana')
  await expect(menu).not.toContainText('Osaka')
  await menu.locator('.ship-blueprint-menu-item-text').filter({ hasText: /^Odachi$/ }).click()
  expect((await blueprint(page)).name).toBe('Odachi')
  await page.getByTestId('toolbar-save-as-btn').click()
  await expect(page.locator('.dialog-input')).toBeVisible()
})
