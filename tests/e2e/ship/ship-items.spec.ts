import { expect, type Page, type Locator } from '@playwright/test'
import { test } from '../../test-setup'

const section = (page: Page, title: string) => page.locator('.storage-section').filter({ has: page.locator('.storage-section-title').filter({ hasText: new RegExp(`^${title}$`) }) })
const storage = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint.storage)))
async function amount(input: Locator, value: number) {
  await input.focus()
  await input.press('Home')
  for (let step = 0; step < value; step++) await input.press('ArrowRight')
  await expect(input).toHaveValue(String(value))
}
async function saveAs(page: Page, name: string) {
  await page.getByTestId('toolbar-save-as-btn').click()
  await page.locator('.dialog-input').fill(name)
  await page.locator('.dialog-input').press('Enter')
  await expect(page.locator('.dialog-input')).toBeHidden()
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
  await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^Osaka$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
})

test('2.1–2.3 C/U tabs preserve order and isolate storage controls', async ({ page }) => {
  await expect(page.locator('.left-rail .slot-type-btn')).toHaveText(['E', 'R', 'S', 'W', 'T', 'C', 'U'])
  await page.getByTestId('slot-type-consumables').click()
  await expect(section(page, 'Deployable')).toBeVisible()
  await expect(section(page, 'Countermeasure')).toBeVisible()
  await expect(page.locator('.group-tabs, .compatibility-box, .slot-wall')).toHaveCount(0)
  await page.getByTestId('slot-type-units').click()
  await expect(section(page, 'Deployable')).toBeHidden()
  await expect(section(page, 'Drone')).toBeVisible()
  await expect(page.locator('.group-tabs, .compatibility-box, .slot-wall')).toHaveCount(0)
})

test('3.1–3.2 C deployable and countermeasure quantities use independent capacities', async ({ page }) => {
  await page.getByTestId('slot-type-consumables').click()
  await amount(section(page, 'Deployable').locator('input').first(), 30)
  const countermeasure = section(page, 'Countermeasure').locator('input')
  await countermeasure.focus()
  await countermeasure.press('End')
  await expect(countermeasure).toHaveValue('20')
  await expect(section(page, 'Deployable').locator('.storage-section-info')).toHaveText('30 / 250')
  await expect(section(page, 'Countermeasure').locator('.storage-section-info')).toHaveText('20 / 20')
  expect((await storage(page)).deployables).toMatchObject([{ id: 'waypointmarker_01', count: 30 }])
  await expect(section(page, 'Countermeasure').locator('.slider-fill-blue')).toHaveCount(0)
  await expect(section(page, 'Deployable').locator('.slider-fill-blue').first()).toBeVisible()
})

test('3.3 U drone candidates follow empty ship tags and share capacity ten', async ({ page }) => {
  await page.getByTestId('slot-type-units').click()
  const drone = section(page, 'Drone')
  await expect(drone.locator('.storage-item')).toHaveCount(3)
  await amount(drone.locator('input').first(), 6)
  await drone.locator('input').nth(1).focus()
  await drone.locator('input').nth(1).press('End')
  await expect(drone.locator('input').nth(1)).toHaveValue('4')
  await expect(drone.locator('.storage-section-info')).toHaveText('10 / 10')
  expect((await storage(page)).drones).toMatchObject([
    { id: 'ship_gen_s_fightingdrone_01_a', count: 6 },
    { id: 'ship_gen_xs_cargodrone_empty_01_a', count: 4 }
  ])
})

test('3.4–3.5 missile section follows real equipped ammunition tags and quantity capacity', async ({ page }) => {
  await page.getByTestId('slot-type-units').click()
  await expect(section(page, 'Missile')).toBeHidden()
  await page.getByTestId('slot-type-turret').click()
  await page.getByTestId('ship-build-panel-fit').locator('.slot-row').first().click()
  await page.getByTestId('picker-race-argon').click()
  await page.getByTestId('candidate-turret_arg_l_dumbfire_01_mk1').click()
  await page.getByTestId('picker-confirm').click()
  await page.getByTestId('slot-type-units').click()
  const missiles = section(page, 'Missile')
  // Preserve historical diagnostic wording, but absence is a hard failure below.
  if (!(await missiles.isVisible())) console.log('Skipping missile assertions - no missile section visible')
  await expect(missiles).toBeVisible()
  await expect(missiles.locator('.storage-item')).toHaveCount(8)
  await amount(missiles.locator('input').first(), 15)
  await expect(missiles.locator('.storage-section-info')).toHaveText('15 / 160')
  expect((await storage(page)).missiles).toMatchObject([{ id: 'missile_cluster_heavy_mk1', count: 15 }])
})

test('3.6–3.7 saving and Save As preserve storage through refresh', async ({ page }) => {
  await page.getByTestId('slot-type-consumables').click()
  await amount(section(page, 'Deployable').locator('input').first(), 50)
  await saveAs(page, 'Items original')
  const original = await storage(page)
  await saveAs(page, 'Items copy')
  expect(await storage(page)).toEqual(original)
  await page.reload()
  await page.getByTestId('top-view-btn-ship-build').click()
  await page.getByTestId('slot-type-consumables').click()
  await expect(section(page, 'Deployable').locator('input').first()).toHaveValue('50')
  expect(await storage(page)).toEqual(original)
  await expect(page.getByTestId('ship-build-blueprint-menu-trigger')).toContainText('Items copy')
})

test('3.8 drag into unavailable range clamps to remaining shared deployable capacity', async ({ page }) => {
  await page.getByTestId('slot-type-consumables').click()
  const deployable = section(page, 'Deployable')
  const inputs = deployable.locator('input')
  // Preserve original diagnostic; the multi-item acceptance is never skipped.
  if (await inputs.count() < 2) console.log('Only one deployable item available, skipping multi-item dragMax test')
  expect(await inputs.count()).toBeGreaterThan(1)
  await amount(inputs.first(), 30)
  const box = await inputs.nth(1).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(inputs.nth(1)).toHaveValue('220')
  await expect(deployable.locator('.storage-section-info')).toHaveText('250 / 250')
  expect((await storage(page)).deployables).toMatchObject([
    { id: 'waypointmarker_01', count: 30 }, { id: 'resourceprobe_01', count: 220 }
  ])
  await expect(inputs.nth(1)).toBeEnabled()
})
