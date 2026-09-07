import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const scope = (page: Page, id: string) => page.getByTestId(`metric-panel-case-${id}`)
const keys = (page: Page, id: string) => scope(page, id).locator('[data-testid^="metric-item-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.slice('metric-item-'.length)))
const all = ['speed', 'acceleration', 'boostSpeed', 'travelSpeed', 'travelCharge', 'yawRate']

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  await page.evaluate(db => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.goto('/?view=metric-panel-test')
  await expect(page.getByTestId('metric-panel-playground')).toBeVisible()
})

test('2.1 / 3.1–3.2 schema controls row/column ordering and optional tabs', async ({ page }) => {
  await expect(scope(page, 'basic-row').getByTestId('metrics-panel-basic-row')).toBeVisible()
  expect(await keys(page, 'basic-row')).toEqual(all)
  expect(await keys(page, 'column-order')).toEqual(['speed', 'travelSpeed', 'acceleration', 'travelCharge', 'boostSpeed', 'yawRate'])
  await expect(scope(page, 'basic-row').locator('[data-testid^="view-tab-btn-"]')).toHaveCount(0)
  await expect(scope(page, 'view-filter')).toBeVisible()
  await expect(scope(page, 'view-all')).toBeVisible()
  const columns = await scope(page, 'basic-row').locator('.metrics-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(3)
})

test('2.2–2.4 / 3.3–3.8 combat travel and all filter real metrics and remain repeatable', async ({ page }) => {
  const filtered = scope(page, 'view-filter')
  await filtered.getByTestId('view-tab-btn-metrics-panel-view-filter-combat').click()
  expect(await keys(page, 'view-filter')).toEqual(['speed', 'acceleration', 'boostSpeed'])
  await filtered.getByTestId('view-tab-btn-metrics-panel-view-filter-travel').click()
  expect(await keys(page, 'view-filter')).toEqual(['travelSpeed', 'travelCharge'])
  await filtered.getByTestId('view-tab-btn-metrics-panel-view-filter-all').click()
  expect(await keys(page, 'view-filter')).toEqual(all)
  for (let i = 0; i < 2; i++) {
    await scope(page, 'view-all').getByTestId('view-tab-btn-metrics-panel-view-all-all').click()
    expect(await keys(page, 'view-all')).toEqual(['speed', 'travelSpeed', 'acceleration', 'travelCharge', 'boostSpeed', 'yawRate'])
  }
})

test('3.9–3.10 single-side values have exact numbers; comparison retains signed differences', async ({ page }) => {
  await expect(scope(page, 'target-only').getByTestId('metric-value-speed')).toHaveText('205m/s')
  await expect(scope(page, 'target-only').getByTestId('metric-value-travelSpeed')).toHaveText('3,100m/s')
  await expect(scope(page, 'current-only').getByTestId('metric-value-speed')).toHaveText('180m/s')
  await expect(scope(page, 'current-only').getByTestId('metric-value-travelSpeed')).toHaveText('2,600m/s')
  await expect(scope(page, 'basic-row').getByTestId('metric-value-speed')).toHaveText('205(+25)m/s')
  await expect(scope(page, 'basic-row').getByTestId('metric-value-acceleration')).toHaveText('10(-2)m/s2')
})

test('3.11 ragged schema skips only holes and remains interactive', async ({ page }) => {
  expect(await keys(page, 'ragged-schema')).toEqual(['speed', 'yawRate', 'acceleration', 'travelSpeed', 'travelCharge', 'boostSpeed'])
  await expect(page.locator('body')).not.toContainText('TypeError')
  await expect(page.locator('body')).not.toContainText('Unhandled')
  await scope(page, 'view-filter').getByTestId('view-tab-btn-metrics-panel-view-filter-maneuver').click()
  expect(await keys(page, 'view-filter')).toEqual(['yawRate'])
})
