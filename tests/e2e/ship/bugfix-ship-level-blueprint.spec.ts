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
  await page.getByTestId('top-view-btn-ship-build').click()
})

test('4.1 BUG-001 no selected ship has no reachable blueprint load control', async ({ page }) => {
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', '')
  await expect(page.getByTestId('toolbar-load-btn')).toHaveCount(0)
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toBeHidden()
  await expect(page.getByTestId('ship-build-blueprint-menu')).toHaveCount(0)
  await expect(page.locator('.blueprint-item')).toHaveCount(0)
})
