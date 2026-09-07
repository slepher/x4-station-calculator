import { expect, test, type Page } from '@playwright/test'

const fit = (page: Page) => page.getByTestId('ship-build-panel-fit')
const modes = (page: Page) => fit(page).locator('.mode-tab')
const slot = (page: Page, type: string, index = 0) => fit(page).locator(`[data-testid^="slot-"]:not([data-testid^="slot-type-"])`).filter({ has: page.locator('.slot-row-title') }).nth(index)
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
async function select(page: Page, name: string, cls = 'm', race = 'terran', type?: string) {
  await page.getByTestId(`ship-build-filter-class-btn-ship_${cls}`).click()
  await page.getByTestId(`ship-build-filter-race-btn-${race}`).click()
  if (type) await page.getByTestId(`ship-build-filter-type-btn-${type}`).click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: new RegExp(`^${name}$`) }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
}
async function open(page: Page, type: string, index = 0) {
  await page.getByTestId(`slot-type-${type}`).click()
  await fit(page).locator('.group-tab').nth(index).click()
  await slot(page, type).click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
}
async function assign(page: Page, type: string, index = 0, candidateIndex = 0) {
  await open(page, type, index)
  await page.locator(`[data-testid^="candidate-${type}_"]`).nth(candidateIndex).click()
  await page.getByTestId('picker-confirm').click()
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
  await page.getByTestId('language-select').selectOption('en')
  await page.getByTestId('top-view-btn-ship-build').click()
})

test('4.1 BUG-001 mixed installed equipment permits group view without rewriting blueprint', async ({ page }) => {
  await select(page, 'Odachi')
  await assign(page, 'turret', 0, 0)
  await assign(page, 'turret', 1, 1)
  const before = await blueprint(page)
  const ids = before.connections.flatMap((c: any) => c.group).filter((g: any) => g.equipment_id?.startsWith('turret_')).map((g: any) => g.equipment_id)
  expect(new Set(ids).size).toBe(2)
  await modes(page).nth(1).click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
  await expect(fit(page).locator('.slot-row-value-mixed')).toBeVisible()
  expect(await blueprint(page)).toEqual(before)
})
