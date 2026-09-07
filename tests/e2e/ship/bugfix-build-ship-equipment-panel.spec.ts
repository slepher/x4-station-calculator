import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

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

const details = (page: Page) => page.getByTestId('metrics-panel-ship-build-equipment')

test('4.1 expanded equipment picker hides materials and makes Fit two thirds wide', async ({ page }) => {
  await select(page, 'Odachi')
  await open(page, 'weapon')
  await expect.soft(page.getByTestId('ship-build-panel-materials')).toBeHidden()
  const whole = await page.getByTestId('ship-build-panels').boundingBox()
  const fitBox = await fit(page).boundingBox()
  expect(fitBox).not.toBeNull()
  expect(whole).not.toBeNull()
  expect(fitBox!.width / whole!.width).toBeGreaterThan(0.6)
})

test('4.2–4.4 empty candidate retains current and neutral values; empty current/candidate hides details', async ({ page }) => {
  await select(page, 'Odachi')
  await assign(page, 'engine')
  await open(page, 'engine')
  await page.getByTestId('candidate-empty').click()
  await expect(details(page)).toBeVisible()
  await expect(details(page).getByTestId('metric-value-boostDuration').locator('span').first()).toHaveClass(/diff-neutral/)
  await page.getByTestId('picker-confirm').click()
  await open(page, 'engine')
  await expect(details(page)).toBeHidden()
  await page.locator('[data-testid^="candidate-engine_"]').first().click()
  await expect(details(page)).toBeVisible()
})

test('4.5 empty slot candidate has neutral non-comparison value style', async ({ page }) => {
  await select(page, 'Odachi')
  await open(page, 'engine')
  await page.locator('[data-testid^="candidate-engine_"]').first().click()
  await expect(details(page).getByTestId('metric-value-boostDuration').locator('span').first()).toHaveClass(/diff-neutral/)
  await expect(details(page).locator('.diff-positive, .diff-negative')).toHaveCount(0)
})

test('4.6 Asgard group tabs separate large and medium sizes', async ({ page }) => {
  await select(page, 'Asgard', 'xl')
  await page.getByTestId('slot-type-turret').click()
  await expect(page.getByTestId('group-tab-row-large').getByRole('button')).toHaveCount(8)
  await expect(page.getByTestId('group-tab-row-medium').getByRole('button')).toHaveCount(3)
})

test('4.7 standard and missile filters form union of real compatible turret candidates', async ({ page }) => {
  await select(page, 'Osaka', 'l')
  await open(page, 'turret')
  await page.getByTestId('picker-race-argon').click()
  await page.getByTestId('picker-tag-missile').click()
  await expect(page.locator('[data-testid^="candidate-turret_"]')).toHaveCount(2)
  await page.getByTestId('picker-tag-standard').click()
  await expect(page.getByTestId('candidate-turret_arg_l_beam_01_mk1')).toBeVisible()
  await expect(page.getByTestId('candidate-turret_arg_l_dumbfire_01_mk1')).toBeVisible()
  await expect(page.locator('[data-testid^="candidate-turret_"]')).toHaveCount(5)
})

test('4.8 confirming another ship closes picker and restores normal workbench', async ({ page }) => {
  await select(page, 'Odachi')
  await open(page, 'weapon')
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^Katana$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('equipment-picker')).toBeHidden()
  await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
  await expect(modes(page).nth(0)).toHaveClass(/active/)
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
})

test('4.9 Tokyo ten medium turret groups split evenly into five plus five', async ({ page }) => {
  await select(page, 'Tokyo', 'xl')
  await page.getByTestId('slot-type-turret').click()
  await expect(page.getByTestId('group-tab-row-medium-1').getByRole('button')).toHaveCount(5)
  await expect(page.getByTestId('group-tab-row-medium-2').getByRole('button')).toHaveCount(5)
})
