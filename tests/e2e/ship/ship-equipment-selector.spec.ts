import { expect, test, type Page } from '@playwright/test'

const fit = (page: Page) => page.getByTestId('ship-build-panel-fit')
const modes = (page: Page) => fit(page).locator('.mode-tab')
const slot = (page: Page, type: string) => page.locator(`[data-testid^="slot-ship_ter_l_destroyer_01_a::${type}::"]`).first()
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
async function open(page: Page, type: string) {
  await page.getByTestId(`slot-type-${type}`).click()
  await slot(page, type).click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
}
async function install(page: Page, type: string) {
  if (type === 'weapon') {
    await page.getByTestId('slot-type-weapon').click()
    await slot(page, 'weapon').click()
    await expect(slot(page, 'weapon').locator('.slot-row-count')).toHaveText('1/1')
    await expect(page.getByTestId('equipment-picker')).toBeHidden()
    return
  }
  await open(page, type)
  await page.locator(`[data-testid^="candidate-${type}_"]`).first().click()
  await page.getByTestId('picker-confirm').click()
}
async function drag(page: Page, slider: ReturnType<Page['locator']>, fraction: number, beforeRelease: () => Promise<void> = async () => {}) {
  const box = await slider.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + 2 + (box!.width - 4) * fraction, box!.y + box!.height / 2, { steps: 8 })
  await beforeRelease()
  await page.mouse.up()
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
  await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大阪$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
})

test('2.1–2.3 Osaka selection and picker anchor survive group mode switch', async ({ page }) => {
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_l_destroyer_01_a')
  await open(page, 'turret')
  await expect(modes(page).nth(0)).toHaveClass(/active/)
  const before = await blueprint(page)
  await modes(page).nth(1).click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
  await expect(fit(page).locator('.slot-row-expanded')).toHaveCount(1)
  expect(await blueprint(page)).toEqual(before)
  await page.getByTestId('picker-cancel').click()
  await expect(modes(page).nth(1)).toHaveClass(/active/)
})

test('2.4 / 3.7 / 3.8 each slot slider matches width, 8px track and slate background', async ({ page }) => {
  await page.getByTestId('slot-type-engine').click()
  const stack = slot(page, 'engine').locator('..')
  const buttonBox = await slot(page, 'engine').boundingBox()
  const sliderBox = await stack.locator('input[type=range]').boundingBox()
  expect(buttonBox).not.toBeNull()
  expect(sliderBox).not.toBeNull()
  expect(sliderBox!.width).toBeCloseTo(buttonBox!.width, 0)
  await expect(stack.locator('.slider-track-bg')).toHaveCSS('height', '8px')
  await expect(stack.locator('.slider-track-bg')).toHaveCSS('background-color', 'rgb(30, 41, 59)')
})

test('2.5 / 3.10 mouse drag stages UI only; release count zero retains equipment and excludes contribution', async ({ page }) => {
  const stats = await page.getByTestId('ship-build-panel-stats').innerText()
  const materials = await page.getByTestId('ship-build-panel-materials').innerText()
  await install(page, 'engine')
  const before = await blueprint(page)
  const equipped = before.connections.flatMap((c: any) => c.group).find((g: any) => g.equipment_id?.startsWith('engine_'))
  expect(equipped.count).toBe(2)
  const slider = slot(page, 'engine').locator('..').locator('input[type=range]')
  await drag(page, slider, 0, async () => {
    await expect(slider).toHaveValue('0')
    expect(await blueprint(page)).toEqual(before)
  })
  const after = (await blueprint(page)).connections.flatMap((c: any) => c.group).find((g: any) => g.equipment_id === equipped.equipment_id)
  expect(after.count).toBe(0)
  await expect(page.getByTestId('ship-build-panel-stats')).toHaveText(stats, { useInnerText: true })
  await expect(page.getByTestId('ship-build-panel-materials')).toHaveText(materials, { useInnerText: true })
})

test('3.2 unique weapon candidate click fills partial group', async ({ page }) => {
  await install(page, 'weapon')
  await modes(page).nth(1).click()
  const grouped = fit(page).locator('.slot-row').first()
  await expect(grouped.locator('.slot-row-count')).toHaveText('1/2')
  await grouped.click()
  await expect.soft(grouped.locator('.slot-row-count')).toHaveText('2/2')
  await expect.soft(page.getByTestId('equipment-picker')).toBeHidden()
})

test('3.3 unique weapon candidate click clears full group', async ({ page }) => {
  await page.getByTestId('slot-type-weapon').click()
  await modes(page).nth(1).click()
  const grouped = fit(page).locator('.slot-row').first()
  await grouped.click()
  await expect(grouped.locator('.slot-row-count')).toHaveText('2/2')
  await expect(page.getByTestId('equipment-picker')).toBeHidden()
  await grouped.click()
  await expect(grouped.locator('.slot-row-count')).toHaveText('0/2')
})

test('3.4 explicit clear in group mode returns standard count 0/1', async ({ page }) => {
  await install(page, 'weapon')
  await modes(page).nth(1).click()
  await fit(page).locator('.slot-row').first().click()
  await expect(fit(page).locator('.slot-row-count').first()).toHaveText('2/2')
  await fit(page).locator('.slot-row').first().click()
  await expect(fit(page).locator('.slot-row-count').first()).toHaveText('0/2')
  await expect(page.getByTestId('equipment-picker')).toBeHidden()
  await modes(page).nth(0).click()
  await expect(slot(page, 'weapon').locator('.slot-row-count')).toHaveText('0/1')
})

test('3.9 group slider step equals aggregate capacity', async ({ page }) => {
  await install(page, 'engine')
  await modes(page).nth(1).click()
  const slider = fit(page).locator('.slot-stack').first().locator('input[type=range]')
  await expect(slider).toHaveAttribute('max', '2')
  await expect(slider).toHaveAttribute('step', '2')
})

test('3.5 more than three race tags occupy two rows', async ({ page }) => {
  await open(page, 'engine')
  const tags = page.locator('[data-testid^="picker-race-"]')
  expect(await tags.count()).toBeGreaterThan(3)
  const ys = await tags.evaluateAll(items => [...new Set(items.map(item => Math.round(item.getBoundingClientRect().y)))])
  expect(ys).toHaveLength(2)
})

test('3.1 / 3.6 expanded selector retains prescribed two-column width and 25.6px rows', async ({ page }) => {
  await open(page, 'turret')
  const shell = fit(page).locator('.arsenal-shell')
  const columns = await shell.evaluate(el => getComputedStyle(el).gridTemplateColumns)
  expect.soft(columns).toMatch(/^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/)
  await expect.soft(fit(page).locator('.mode-tabs')).toHaveCSS('height', '25.6px')
  await expect.soft(fit(page).locator('.group-tabs')).toHaveCSS('height', '25.6px')
})
