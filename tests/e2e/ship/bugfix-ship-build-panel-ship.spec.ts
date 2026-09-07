import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

async function openSelector(page: Page) {
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_ship_blueprints_v9 = data.x4_ship_blueprints
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
})

test('4.1 BUG-001: 更换飞船后点击同船确认无法返回 workspace - 修复后', async ({ page }) => {
  const before = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
  await openSelector(page)
  await expect(page.locator('.list-item-pending')).toContainText('武士刀')
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeHidden()
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  expect(await page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))).toEqual(before)
})

test('4.2 BUG-002: 飞船候选过多时无分页器或分页结构错误 - 修复后', async ({ page }) => {
  await openSelector(page)
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  const pager = page.getByTestId('ship-build-list-pager')
  await expect(pager).toBeVisible()
  await expect(pager.locator('button')).toHaveText(['<', '1', '2', '>'])
  await expect(page.locator('.list-item')).toHaveCount(10)
  await expect(page.getByTestId('ship-build-page-1')).toHaveClass(/pager-btn-active/)
  await pager.getByRole('button', { name: '>', exact: true }).click()
  await expect(page.getByTestId('ship-build-page-2')).toHaveClass(/pager-btn-active/)
  await expect(page.locator('.list-item')).toHaveCount(1)
  await pager.getByRole('button', { name: '<', exact: true }).click()
  await expect(page.getByTestId('ship-build-page-1')).toHaveClass(/pager-btn-active/)
  await expect(page.locator('.list-item')).toHaveCount(10)
})
