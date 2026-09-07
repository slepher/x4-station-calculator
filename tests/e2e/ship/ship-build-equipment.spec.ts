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

for (const [name, cls, race, type] of [['Odachi', 'm', 'terran', 'corvette'], ['Osaka', 'l', 'terran', 'destroyer'], ['Heron Vanguard', 'l', 'teladi', 'freighter']]) {
  test(`2.1–2.4 / 3.17 ${name}: filters lead to workbench with standard mode`, async ({ page }) => {
    await select(page, name!, cls, race, type)
    await expect(fit(page)).toContainText(name!)
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
    await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
    await expect(modes(page).nth(0)).toHaveClass(/active/)
  })
}

test('2.5–2.8 / 3.2–3.4 connection and group installations preserve assignments across mode switches', async ({ page }) => {
  await select(page, 'Odachi')
  await assign(page, 'turret')
  let groups = (await blueprint(page)).connections.flatMap((c: any) => c.group)
  expect(groups.filter((g: any) => g.equipment_id?.startsWith('turret_'))).toHaveLength(1)
  await assign(page, 'turret', 1)
  const before = await blueprint(page)
  await modes(page).nth(1).click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
  expect(await blueprint(page)).toEqual(before)
  await expect(fit(page).locator('.slot-row-count').first()).toHaveText('2/2')
  await open(page, 'turret')
  await page.getByTestId('candidate-empty').click()
  await page.getByTestId('picker-confirm').click()
  await expect(fit(page).locator('.slot-row-count').first()).toHaveText('0/2')
  await assign(page, 'turret')
  groups = (await blueprint(page)).connections.flatMap((c: any) => c.group)
  expect(groups.filter((g: any) => g.equipment_id?.startsWith('turret_') && g.count === 1)).toHaveLength(2)
  await modes(page).nth(0).click()
  await expect(fit(page).locator('.slot-row-count')).toHaveText(['1/1'])
  await fit(page).locator('.group-tab').nth(1).click()
  await expect(fit(page).locator('.slot-row-count')).toHaveText(['1/1'])
})

test('2.9 / 3.18–3.19 mixed equipment no longer blocks group mode and remains intact', async ({ page }) => {
  await select(page, 'Odachi')
  await assign(page, 'turret', 0, 0)
  await assign(page, 'turret', 1, 1)
  const before = await blueprint(page)
  const ids = before.connections.flatMap((c: any) => c.group).filter((g: any) => g.equipment_id?.startsWith('turret_')).map((g: any) => g.equipment_id)
  expect(new Set(ids).size).toBe(2)
  await expect(modes(page).nth(1)).toBeEnabled()
  await modes(page).nth(1).click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
  await expect(fit(page).locator('.slot-row-value-mixed')).toBeVisible()
  expect(await blueprint(page)).toEqual(before)
  await assign(page, 'turret')
  await expect(fit(page).locator('.slot-row-value-mixed')).toHaveCount(0)
})

test('3.1 / 3.5 / 3.15–3.16 Osaka main turret and child shield remain separately counted', async ({ page }) => {
  await select(page, 'Osaka', 'l')
  await page.getByTestId('slot-type-turret').click()
  await expect(fit(page).locator('.slot-row')).toHaveCount(2)
  await assign(page, 'turret', 0)
  await slot(page, 'turret', 1).click()
  await page.locator('[data-testid^="candidate-shield_"]').first().click()
  await page.getByTestId('picker-confirm').click()
  const groups = (await blueprint(page)).connections.flatMap((c: any) => c.group)
  expect(groups.filter((g: any) => g.equipment_id?.startsWith('turret_') && g.count === 1)).toHaveLength(1)
  expect(groups.filter((g: any) => g.shield?.equipment_id?.startsWith('shield_') && g.shield.count === 2)).toHaveLength(1)
  await modes(page).nth(1).click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
  await expect(fit(page).locator('.slot-row-count')).toHaveText(['1/3', '2/6'])
})

test('3.6–3.9 / 3.12 real slot tags reject incompatible and NPC-only equipment', async ({ page }) => {
  await select(page, 'Odachi')
  await open(page, 'turret')
  const turretIds = await allCandidateIds(page)
  expect(turretIds).toContain('candidate-turret_arg_m_beam_01_mk1')
  expect(turretIds).not.toContain('candidate-turret_arg_m_beam_02_mk1')
  expect(turretIds).not.toContain('candidate-turret_xen_m_beam_02_mk1')
  await page.getByTestId('picker-cancel').click()
  await open(page, 'shield')
  const shieldIds = await allCandidateIds(page)
  expect(shieldIds).toContain('candidate-shield_arg_m_standard_01_mk1')
  expect(shieldIds).not.toContain('candidate-shield_arg_m_standard_02_mk1')
})

async function allCandidateIds(page: Page) {
  const candidates = page.getByTestId('equipment-picker').locator('.candidate-item')
  const ids = await candidates.evaluateAll(items => items.map(item => item.getAttribute('data-testid')))
  const pages = await page.locator('[data-testid^="picker-page-"]').count()
  for (let number = 2; number <= pages; number++) {
    await page.getByTestId(`picker-page-${number}`).click()
    ids.push(...await candidates.evaluateAll(items => items.map(item => item.getAttribute('data-testid'))))
  }
  return ids
}

test('3.10–3.11 / 3.13 / 3.21 translated names and tags remain stable across modes; no image placeholders', async ({ page }) => {
  await select(page, 'Odachi')
  await open(page, 'turret')
  const name = await page.locator('[data-testid^="candidate-turret_"]').first().locator('.candidate-name').innerText()
  expect(name).toMatch(/[A-Z][a-z]+/)
  await expect(page.getByTestId('equipment-picker').locator('img')).toHaveCount(0)
  await expect(fit(page).locator('.compatibility-line.tags')).toContainText('Advanced')
  await page.getByTestId('picker-cancel').click()
  await modes(page).nth(1).click()
  await open(page, 'turret')
  await expect(page.locator('[data-testid^="candidate-turret_"]').first().locator('.candidate-name')).toHaveText(name)
})

test('2.10 / 3.14 natural same-size different tags split group tabs (Nova)', async ({ page }) => {
  await select(page, 'Nova Vanguard', 's', 'argon')
  await page.getByTestId('slot-type-weapon').click()
  await modes(page).nth(1).click()
  await expect(fit(page).locator('.group-tab')).toHaveCount(2)
  const labels: string[] = []
  for (const tab of await fit(page).locator('.group-tab').all()) {
    await tab.click()
    labels.push(await fit(page).locator('.compatibility-line.tags').innerText())
  }
  expect(new Set(labels).size).toBe(2)
})

test('3.20 empty compatibility whitelist hides the entire compatibility box', async ({ page }) => {
  await select(page, 'Odachi')
  await page.getByTestId('slot-type-thruster').click()
  await expect(fit(page).locator('.compatibility-box')).toHaveCount(0)
})
