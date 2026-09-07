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
  if (testInfo.title.startsWith('3.15')) {
    data.x4_ship_blueprints_v9 = { ...data.x4_ship_blueprints, activeShipId: 'ship_ter_l_destroyer_01_a', activeBlueprintId: '820168b5-01fa-ea26-6318-7a4e56f501d4' }
  }
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
})

test('2.1–2.3 initial selector, confirmed ship and real equipment blueprint structure', async ({ page }) => {
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
  await selectOdachi(page)
  await equip(page)
  const current = await blueprint(page)
  expect(current.shipId).toBe(shipId)
  expect(current.connections.find((c: any) => c.slot_type === 'engine').group).toEqual([
    expect.objectContaining({ group: 'con_engine_01', equipment_id: 'engine_arg_m_allround_01_mk1', count: 1 })
  ])
})

test('2.4–2.5 / 3.1–3.2 Save and Save As create distinct named blueprints preserving loadout', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await page.getByTestId('toolbar-save-btn').click()
  await page.locator('.dialog-input').fill('Original M10.3')
  await page.locator('.dialog-input').press('Enter')
  const original = await blueprint(page)
  await saveAs(page, 'Copy M10.3')
  const copy = await blueprint(page)
  expect(copy.id).not.toBe(original.id)
  expect(copy.connections).toEqual(original.connections)
  const saved = (await persisted(page)).ships.find((s: any) => s.shipId === shipId).blueprints
  expect(saved.map((b: any) => b.name)).toEqual(expect.arrayContaining(['Original M10.3', 'Copy M10.3']))
})

test('3.3 / 3.3b / 3.4 active saved blueprint restores after reload with matching filters', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await saveAs(page, 'Reload M10.3')
  const before = await blueprint(page)
  const hasData = Boolean(await persisted(page))
  console.log('localStorage has data:', hasData)
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toContainText('Reload M10.3')
  expect(await blueprint(page)).toEqual({ ...before, favorite: false })
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await expect(page.getByTestId('ship-build-filter-class-btn-ship_m')).toHaveClass(/filter-chip-active/)
  await expect(page.getByTestId('ship-build-filter-race-btn-terran')).toHaveClass(/filter-chip-active/)
  await expect(page.getByTestId('ship-build-filter-type-btn-corvette')).toHaveClass(/filter-chip-active/)
})

test('3.5 delete active blueprint removes saved entry after confirmation and refresh', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await saveAs(page, 'Delete M10.3')
  const id = (await blueprint(page)).id
  await page.getByTestId('ship-build-blueprint-menu-trigger').click()
  const row = page.getByTestId('ship-build-blueprint-menu').locator('.ship-blueprint-menu-row').filter({ hasText: /^Delete M10.3$/ })
  page.once('dialog', dialog => dialog.accept())
  await row.locator('.ship-blueprint-delete-btn').click()
  const stored = await persisted(page)
  expect(stored.activeBlueprintId).toBeNull()
  expect(stored.ships.flatMap((s: any) => s.blueprints).map((b: any) => b.id)).not.toContain(id)
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
  expect((await persisted(page)).ships.flatMap((s: any) => s.blueprints).map((b: any) => b.id)).not.toContain(id)
})

test('3.6 explicit empty equipment removes group rather than storing null', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await fit(page).locator('.slot-row').first().click()
  await page.getByTestId('candidate-empty').click()
  await page.getByTestId('picker-confirm').click()
  const groups = (await blueprint(page)).connections.flatMap((c: any) => c.group)
  expect(groups).toEqual([])
  await page.getByTestId('toolbar-save-as-btn').click()
  await expect(page.locator('.dialog-input')).toBeHidden()
  await expect(page.getByText('无法保存空方案。请先添加至少一个模块。', { exact: true })).toBeVisible()
  expect((await persisted(page)).ships.flatMap((s: any) => s.blueprints)).toEqual([])
  await equip(page, 'shield')
  await saveAs(page, 'Removed engine M10.3')
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  const stored = (await persisted(page)).ships.find((s: any) => s.shipId === shipId).blueprints.find((b: any) => b.name === 'Removed engine M10.3')
  expect(stored.connections.map((c: any) => c.slot_type)).not.toContain('engine')
  expect(stored.connections.find((c: any) => c.slot_type === 'shield').group).toEqual([
    expect.objectContaining({ equipment_id: 'shield_arg_m_standard_01_mk1', count: 1 })
  ])
  await page.getByTestId('slot-type-engine').click()
  await expect(fit(page).locator('.slot-row-count').first()).toHaveText('0/1')
})

test('2.6 / 3.7–3.9 dirty changes survive view switches and New prompts; Save clears dirty', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await saveAs(page, 'Dirty M10.3')
  await equip(page, 'shield')
  await expect(fit(page).locator('.ship-blueprint-dirty-dot')).toBeVisible()
  const before = await blueprint(page)
  await page.getByTestId('top-view-btn-blueprint-production').click()
  await page.getByTestId('top-view-btn-ship-build').click()
  expect(await blueprint(page)).toEqual(before)
  await page.getByTestId('toolbar-new-btn').click()
  await expect(page.getByTestId('dialog-backdrop')).toBeVisible()
  await page.getByTestId('dialog-backdrop').getByRole('button', { name: '', exact: true }).click()
  await page.getByTestId('toolbar-save-btn').click()
  await expect(fit(page).locator('.ship-blueprint-dirty-dot')).toHaveCount(0)
})

test('3.10 group installation persists all original connections', async ({ page }) => {
  await selectOdachi(page)
  await fit(page).locator('.mode-tab').nth(1).click()
  await equip(page, 'turret')
  await saveAs(page, 'Group M10.3')
  const groups = (await blueprint(page)).connections.find((c: any) => c.slot_type === 'turret').group
  expect(groups).toHaveLength(2)
  expect(groups.map((g: any) => g.count)).toEqual([1, 1])
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  expect((await blueprint(page)).connections.find((c: any) => c.slot_type === 'turret').group).toEqual(groups)
})

test('3.11 confirm different ship clears draft equipment but retains saved original', async ({ page }) => {
  await selectOdachi(page)
  await equip(page)
  await saveAs(page, 'Keep M10.3')
  const original = await blueprint(page)
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^武士刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  expect((await blueprint(page)).connections.flatMap((c: any) => c.group)).toEqual([])
  expect((await persisted(page)).ships.find((s: any) => s.shipId === shipId).blueprints.find((b: any) => b.id === original.id)).toEqual(original)
})

test('3.12 shield tab responds and selected shield changes actual blueprint', async ({ page }) => {
  await selectOdachi(page)
  await page.getByTestId('slot-type-shield').click()
  const initialText = await fit(page).locator('.slot-row-value').first().innerText()
  console.log('Initial picked:', initialText)
  await equip(page, 'shield')
  const afterText = await fit(page).locator('.slot-row-value').first().innerText()
  console.log('After picked:', afterText)
  expect(afterText).not.toBe(initialText)
  expect((await blueprint(page)).connections.find((c: any) => c.slot_type === 'shield').group[0]).toMatchObject({ equipment_id: 'shield_arg_m_standard_01_mk1', count: 1 })
})

test('3.15–3.19 / 3.22 current Load menu restores localized ship and separate parent/child equipment', async ({ page }) => {
  await load(page, 'Osaka')
  const before = await blueprint(page)
  await expect(fit(page)).toContainText('大阪')
  await page.getByTestId('slot-type-engine').click()
  await expect(fit(page).locator('.slot-row')).toHaveCount(2)
  await expect(fit(page).locator('.slot-row-title').nth(1)).toContainText('护盾')
  expect(before.connections.find((c: any) => c.slot_type === 'engine').group[0]).toMatchObject({ count: 2, shield: { count: 4 } })
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  expect(await blueprint(page)).toEqual(before)
})

test('3.20–3.21 save and reload preserve canonical slot-type ordering', async ({ page }) => {
  await selectOdachi(page)
  for (const type of ['turret', 'weapon', 'shield', 'thruster', 'engine']) await equip(page, type)
  await saveAs(page, 'Order M10.3')
  const order = ['engine', 'thruster', 'shield', 'weapon', 'turret']
  expect((await blueprint(page)).connections.map((c: any) => c.slot_type)).toEqual(order)
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  expect((await blueprint(page)).connections.map((c: any) => c.slot_type)).toEqual(order)
})
