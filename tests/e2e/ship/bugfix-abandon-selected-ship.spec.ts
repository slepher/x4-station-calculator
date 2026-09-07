import { expect } from '@playwright/test'
import { test } from '../../test-setup'

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
})

test('4.1 BUG-001: New 后材料船体分组未展示 - 修复后', async ({ page }) => {
  await page.getByTestId('top-view-btn-ship-build').click()
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await page.getByTestId('ship-build-panel-fit').getByTestId('slot-type-engine').click()
  await page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]').first().click()
  await page.getByTestId('equipment-picker').locator('[data-testid^="candidate-engine_"]').first().click()
  await page.getByTestId('picker-confirm').click()
  await page.getByTestId('toolbar-new-btn').click()
  await page.getByTestId('dialog-backdrop').getByRole('button', { name: /丢弃并新建|Discard\s*&\s*New/i }).click()
  await expect(page.getByTestId('dialog-backdrop')).toBeHidden()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
  await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
  await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-ship-group')).toContainText('大太刀')
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_02_a')
  const blueprint = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
  expect(blueprint.shipId).toBe('ship_ter_m_corvette_02_a')
  expect(blueprint.connections.flatMap((connection: any) => connection.group).filter((group: any) => group.equipment_id)).toEqual([])
})
