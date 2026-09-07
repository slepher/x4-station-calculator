import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const fit = (page: Page) => page.getByTestId('ship-build-panel-fit')
const method = (page: Page) => page.getByTestId('ship-build-material-method-select')
const summary = (page: Page) => page.getByTestId('ship-build-material-summary')
const equipment = (page: Page, id: string) => page.getByTestId(`ship-build-material-equipment-group-${id}`)
const engine = 'engine_arg_m_allround_01_mk1'
const shield = 'shield_arg_m_standard_01_mk1'
const thruster = 'thruster_gen_l_allround_01_mk1'
const turret = 'turret_arg_l_beam_01_mk1'
// Independent 9.0 static ware ledger, min/max Cr; no production computation imports.
const prices: Record<string, [number, number]> = {
  'Energy Cells': [10, 22], 'Hull Parts': [146, 272], 'Computronic Substrate': [7452, 9108],
  'Metallic Microlattice': [42, 57], 'Antimatter Converters': [248, 461], 'Engine Parts': [128, 237],
  'Field Coils': [247, 576], 'Shield Components': [113, 264], 'Claytronics': [1734, 2346],
  'Silicon Carbide': [1202, 1627], 'Advanced Electronics': [710, 1318], 'Turret Components': [164, 383]
}
const odachi = { 'Energy Cells': 2182, 'Hull Parts': 3174 }
const osaka = { 'Computronic Substrate': 295, 'Energy Cells': 8491, 'Metallic Microlattice': 2717 }
const shieldDefault = { 'Energy Cells': 21, 'Field Coils': 5, 'Shield Components': 4 }
const format = (n: number) => Math.round(n).toLocaleString('en-US')
async function assertRows(list: Locator, counts: Record<string, number>, price: 'min' | 'mid' | 'max' = 'mid') {
  await expect(list).toBeVisible()
  await expect(list.locator('.material-item-row')).toHaveCount(Object.keys(counts).length)
  for (const [name, count] of Object.entries(counts)) {
    const row = list.locator('.list-item').filter({ has: list.page().locator('.material-item-name').filter({ hasText: new RegExp(`^${name}$`) }) })
    await expect(row.locator('.material-item-count')).toHaveText(format(count))
    const [min, max] = prices[name]!
    const unit = price === 'min' ? min : price === 'max' ? max : Math.round((min + max) / 2)
    await expect(row.locator('.material-item-value')).toHaveText(`${format(count * unit)} Cr`)
  }
}
async function selectShip(page: Page, name: 'Odachi' | 'Osaka') {
  await page.getByTestId(`ship-build-filter-class-btn-${name === 'Odachi' ? 'ship_m' : 'ship_l'}`).click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: new RegExp(`^${name}$`) }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
}
async function equip(page: Page, type: string, id: string, row = 0) {
  await page.getByTestId(`slot-type-${type}`).click()
  await fit(page).locator('.slot-row').nth(row).click()
  await page.getByTestId(`candidate-${id}`).click()
  await page.getByTestId('picker-confirm').click()
}
async function save(page: Page) {
  await page.getByTestId('toolbar-save-as-btn').click()
  await page.locator('.dialog-input').fill('Materials M10.4')
  await page.locator('.dialog-input').press('Enter')
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toContainText('Materials M10.4')
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  if (testInfo.title.includes('explicit hull materials')) {
    const plan = JSON.parse(JSON.stringify(data.x4_ship_blueprints.ships.find((s: any) => s.shipId === 'ship_ter_m_corvette_02_a').blueprints[0]))
    plan.hull = { materials: { energycells: 100 } }
    plan.connections = []
    plan.materialMethod = 'default'
    data.x4_ship_blueprints_v9 = { version: 5, activeShipId: plan.shipId, activeBlueprintId: plan.id, ships: [{ shipId: plan.shipId, blueprints: [plan] }] }
  }
  await page.evaluate(db => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('en')
  await page.getByTestId('top-view-btn-ship-build').click()
})

for (const ship of ['Odachi', 'Osaka'] as const) {
  test(`2.1 / 2.2.1 / 2.3.1 / 3.1 / 3.8–3.9 ${ship} production cost and independent ship card`, async ({ page }) => {
    await selectShip(page, ship)
    await method(page).selectOption('default')
    await summary(page).click()
    await assertRows(page.getByTestId('ship-build-material-summary-list'), ship === 'Odachi' ? odachi : osaka)
    const card = page.getByTestId('ship-build-material-ship-group')
    await expect(card).toContainText(ship)
    await expect(card.locator('.material-equipment-count')).toHaveText('x 1')
    await card.click()
    await assertRows(page.getByTestId('ship-build-material-ship-list'), ship === 'Odachi' ? odachi : osaka)
    await summary(page).click()
    await expect(page.getByTestId('ship-build-material-summary-list')).toBeHidden()
  })
}

test('2.1.1 / 4.1.2 / 2.2.3–2.2.5 / 2.3.2–2.3.5 thruster methods deduplicate and exclude xenon', async ({ page }) => {
  await selectShip(page, 'Osaka')
  await equip(page, 'thruster', thruster)
  expect(await method(page).locator('option').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value))).toEqual(['default', 'terran', 'closedloop'])
  await method(page).selectOption('closedloop')
  await equipment(page, thruster).click()
  await assertRows(page.getByTestId(`ship-build-material-equipment-list-${thruster}`), { Claytronics: 14, 'Energy Cells': 273, 'Hull Parts': 84 })
  await method(page).selectOption('terran')
  await assertRows(page.getByTestId(`ship-build-material-equipment-list-${thruster}`), { 'Computronic Substrate': 5, 'Energy Cells': 175, 'Metallic Microlattice': 56, 'Silicon Carbide': 6 })
})

test('2.2.2 / 2.3 / 2.5 / 3.4 / 3.7.1 Odachi shield fallback uses default when terran absent', async ({ page }) => {
  await selectShip(page, 'Odachi')
  await equip(page, 'shield', shield)
  await equipment(page, shield).click()
  await method(page).selectOption('default')
  await assertRows(page.getByTestId(`ship-build-material-equipment-list-${shield}`), shieldDefault)
  await method(page).selectOption('terran')
  await assertRows(page.getByTestId(`ship-build-material-equipment-list-${shield}`), shieldDefault)
  await summary(page).click()
  await assertRows(page.getByTestId('ship-build-material-summary-list'), { 'Computronic Substrate': 76, 'Energy Cells': 2203, 'Metallic Microlattice': 698, 'Field Coils': 5, 'Shield Components': 4 })
  await method(page).selectOption('closedloop')
  await assertRows(page.getByTestId(`ship-build-material-equipment-list-${shield}`), { 'Energy Cells': 131, 'Hull Parts': 5 })
})

test('2.3.3 / 3.7.2 Osaka turret falls back under terran and ship under closedloop', async ({ page }) => {
  await selectShip(page, 'Osaka')
  await equip(page, 'thruster', thruster)
  await equip(page, 'turret', turret)
  await equipment(page, turret).click()
  const list = page.getByTestId(`ship-build-material-equipment-list-${turret}`)
  await method(page).selectOption('default')
  await assertRows(list, { 'Advanced Electronics': 10, 'Energy Cells': 133, 'Turret Components': 31 })
  await method(page).selectOption('terran')
  await assertRows(list, { 'Advanced Electronics': 10, 'Energy Cells': 133, 'Turret Components': 31 })
  await method(page).selectOption('closedloop')
  await page.getByTestId('ship-build-material-ship-group').click()
  await assertRows(page.getByTestId('ship-build-material-ship-list'), osaka)
  await assertRows(list, { Claytronics: 6, 'Energy Cells': 87, 'Hull Parts': 34 })
})

test('2.2 / 2.4 / 3.2–3.3 / 3.6 / 3.10 grouped identical equipment aggregates quantity and separate hull', async ({ page }) => {
  await selectShip(page, 'Osaka')
  await equip(page, 'engine', 'engine_arg_l_allround_01_mk1')
  const card = equipment(page, 'engine_arg_l_allround_01_mk1')
  await expect(card).toHaveCount(1)
  await expect(card.locator('.material-equipment-count')).toHaveText('x 2')
  await expect(page.getByTestId('ship-build-material-ship-group')).toBeVisible()
  await card.click()
  await assertRows(page.getByTestId('ship-build-material-equipment-list-engine_arg_l_allround_01_mk1'), { 'Antimatter Converters': 294, 'Energy Cells': 50, 'Engine Parts': 134 })
})

test('3.5 prices change exact values only and preserve quantities at both endpoints', async ({ page }) => {
  await selectShip(page, 'Odachi')
  await summary(page).click()
  const list = page.getByTestId('ship-build-material-summary-list')
  await assertRows(list, odachi)
  const slider = page.getByTestId('ship-build-material-price-slider').locator('input[type="range"]')
  await slider.focus()
  await slider.press('Home')
  await assertRows(list, odachi, 'min')
  await expect(summary(page).locator('.material-summary-value')).toHaveText(`${format(2182 * 10 + 3174 * 146)} Cr`)
  await slider.press('End')
  await assertRows(list, odachi, 'max')
  await expect(summary(page).locator('.material-summary-value')).toHaveText(`${format(2182 * 22 + 3174 * 272)} Cr`)
})

test('3.11 saved blueprint equipment and method restore material calculation after refresh', async ({ page }) => {
  await selectShip(page, 'Odachi')
  await equip(page, 'engine', engine)
  await method(page).selectOption('closedloop')
  await save(page)
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(method(page)).toHaveValue('closedloop')
  await summary(page).click()
  await assertRows(page.getByTestId('ship-build-material-summary-list'), { 'Energy Cells': 2281, 'Hull Parts': 3177 })
})

test('3.8 explicit hull materials contribute separately from production and equipment', async ({ page }) => {
  await equip(page, 'engine', engine)
  const configured = await page.evaluate(() => (window as any).shipBuildStore.blueprint.hull)
  expect.soft(configured).toEqual({ materials: { energycells: 100 } })
  await summary(page).click()
  await assertRows(page.getByTestId('ship-build-material-summary-list'), { 'Energy Cells': 2297, 'Hull Parts': 3174, 'Antimatter Converters': 3, 'Engine Parts': 5 })
})

for (const [type, parentId, quantity] of [
  ['turret', turret, 2], ['engine', 'engine_arg_l_allround_01_mk1', 4]
] as const) {
  test(`4.3.${type === 'turret' ? '1' : '2'} ${type} attached shield contributes exact material quantity`, async ({ page }) => {
    const shield = 'shield_arg_m_standard_02_mk1'
    await selectShip(page, 'Osaka')
    await page.getByTestId(`slot-type-${type}`).click()
    const i = 0
    const tabLabel = await fit(page).locator('.group-tab').first().textContent()
    console.log(`Testing group ${i}: ${tabLabel}`)
    await fit(page).locator('.slot-row').first().click()
    const optionCount = await page.locator(`[data-testid^="candidate-${type}_"]`).count()
    console.log(`  Found ${optionCount} options`)
    await page.getByTestId(`candidate-${parentId}`).click()
    await page.getByTestId('picker-confirm').click()
    const sectionCount = await fit(page).locator('.slot-row').count()
    console.log(`  After selecting equipment, found ${sectionCount} wall sections`)
    expect(sectionCount).toBe(2)
    const s = 1
    const section = fit(page).locator('.slot-row').nth(s)
    const sectionText = await section.textContent()
    console.log(`  Section ${s}: ${sectionText?.substring(0, 50)}`)
    await expect(section.locator('.slot-row-title')).toContainText('Shield')
    console.log('  -> Found shield section!')
    await section.click()
    const shieldOption = page.getByTestId(`candidate-${shield}`)
    const shieldText = await shieldOption.textContent()
    console.log(`  Shield option: ${shieldText}`)
    console.log(`  Selecting shield option`)
    const shieldSectionText = await section.textContent()
    console.log(`  Shield section text before click: ${shieldSectionText}`)
    await shieldOption.click()
    await page.getByTestId('picker-confirm').click()
    const shieldSectionTextAfter = await section.textContent()
    console.log(`  Shield section text after click: ${shieldSectionTextAfter}`)
    const allGroups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    const groupCount = await allGroups.count()
    console.log(`  Found ${groupCount} equipment groups in materials`)
    for (let g = 0; g < groupCount; g++) {
      const group = allGroups.nth(g)
      const testId = await group.getAttribute('data-testid')
      const text = await group.textContent()
      console.log(`  Group ${g}: ${testId} -> ${text?.substring(0, 80)}`)
      const groupText = text
      console.log(`  Group ${g}: ${groupText?.substring(0, 50)}`)
    }
    const shieldCount = await page.locator('[data-testid^="ship-build-material-equipment-group-shield"]').count()
    console.log(`  Shield groups count: ${shieldCount}`)
    expect(shieldCount).toBe(1)
    const equipmentId = shield
    console.log(`  Equipment ID: ${equipmentId}`)
    await expect(equipment(page, shield).locator('.material-equipment-count')).toHaveText(`x ${quantity}`)
    await equipment(page, shield).click()
    const shieldList = page.getByTestId(`ship-build-material-equipment-list-${shield}`)
    const shieldListText = await shieldList.textContent()
    console.log(`  Shield list text: ${shieldListText?.substring(0, 100)}`)
    await assertRows(shieldList, { 'Energy Cells': 21 * quantity, 'Field Coils': 5 * quantity, 'Shield Components': 4 * quantity })
  })
}
