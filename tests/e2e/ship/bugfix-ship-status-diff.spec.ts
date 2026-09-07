import { expect } from '@playwright/test'
import { test } from '../../test-setup'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  await page.evaluate(db => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
})

test('4.1 empty turret group real candidate previews positive DPS without mutating blueprint', async ({ page }) => {
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  const fit = page.getByTestId('ship-build-panel-fit')
  await fit.locator('.mode-tab').nth(1).click()
  await page.getByTestId('slot-type-turret').click()
  await fit.locator('.slot-row').first().click()
  const before = await page.evaluate(() => JSON.stringify((window as any).shipBuildStore.blueprint))
  await page.locator('[data-testid^="candidate-turret_"]').first().click()
  const turret = page.getByTestId('ship-build-panel-stats').getByTestId('metric-value-turret_avg')
  await expect(turret).toContainText('(+')
  const text = (await turret.innerText()).replace(/[\s,]/g, '')
  const diff = text.match(/\(\+([\d.]+)\)/)
  expect(diff).not.toBeNull()
  expect(Number(diff![1])).toBeGreaterThan(0)
  expect(await page.evaluate(() => JSON.stringify((window as any).shipBuildStore.blueprint))).toBe(before)
  await page.getByTestId('picker-cancel').click()
  await expect(turret).not.toContainText('(')
  expect(await page.evaluate(() => JSON.stringify((window as any).shipBuildStore.blueprint))).toBe(before)
})
