import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'
import expectedStats from '../../fixtures/ship-build-stat-expected.json' with { type: 'json' }

const statKeys = [
  'hull',
  'shield',
  'radar_range',
  'weapon_burst',
  'turret_avg',
  'storage_container',
  'dock_m_count',
  'dock_m_capacity',
  'dock_s_count',
  'dock_s_capacity',
  'speed',
  'boost_speed',
  'travel_speed',
  'crew',
  'storage_unit',
  'missile',
  'deployable',
  'countermeasure',
  'shield_recharge_rate',
  'shield_recharge_delay',
  'shield_group_avg',
  'weapon_sustained',
  'storage_solid',
  'storage_liquid',
  'storage_condensed',
  'acceleration',
  'boost_acceleration',
  'boost_duration',
  'boost_recharge',
  'travel_acceleration',
  'travel_charge_time',
  'strafe_speed',
  'strafe_acceleration',
  'yaw',
  'pitch',
  'roll'
] as const

const panel = (page: Page) => page.getByTestId('ship-build-panel-stats')
const detail = (page: Page) => page.getByTestId('view-tab-btn-metrics-panel-ship-build-stats-panel-detail').click()

// The existing independent 36-field snapshots describe 8.0-Diplomacy, including Osaka hull95,000.
// Preserve that representative version explicitly instead of rewriting expectations from runtime output.
test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '8.0', beta: false }
  const osaka = testInfo.title.includes('Osaka')
  data.x4_ship_blueprints = {
    ...data.x4_ship_blueprints,
    activeShipId: osaka ? 'ship_ter_l_destroyer_01_a' : 'ship_ter_m_corvette_02_a',
    activeBlueprintId: osaka ? '820168b5-01fa-ea26-6318-7a4e56f501d4' : 'b2540610-0c02-698f-4451-3d8ce1183c49'
  }
  await page.evaluate(db => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-ship-build').click()
  await page.getByTestId('ship-build-blueprint-menu-trigger').click()
  await page.getByTestId('ship-build-blueprint-menu').locator('.ship-blueprint-menu-item-text').filter({ hasText: new RegExp('^' + (osaka ? 'Osaka' : 'Odachi') + '$') }).click()
})

for (const ship of ['Odachi', 'Osaka'] as const) {
  test('2.' + (ship === 'Odachi' ? '1' : '2') + ' / 3.3 / 3.' + (ship === 'Odachi' ? '5' : '6') + ' ' + ship + ' saved loadout and all36 independent 8.0 expected metrics', async ({ page }) => {
    await expect(page.getByTestId('ship-build-panel-fit')).toContainText(ship === 'Odachi' ? '大太刀' : '大阪')
    const ids = await page.evaluate(() => (window as any).shipBuildStore.blueprint.connections.flatMap((c: any) => c.group.map((g: any) => g.equipment_id)))
    expect(ids).toEqual(expect.arrayContaining(ship === 'Odachi' ? [
      'engine_ter_m_virtual_01_mk1', 'thruster_gen_m_combat_01_mk3', 'shield_ter_m_virtual_01_mk3', 'weapon_ter_m_laser_02_mk1', 'turret_ter_m_laser_03_mk1'
    ] : ['engine_ter_l_allround_01_mk1', 'thruster_gen_l_allround_01_mk3', 'shield_ter_l_standard_01_mk3', 'weapon_ter_l_destroyer_01_mk1', 'turret_arg_l_plasma_01_mk1', 'turret_arg_m_flak_01_mk1']))
    for (const type of ['engine', 'thruster', 'shield', 'weapon', 'turret']) {
      await page.getByTestId('slot-type-' + type).click()
      await expect(page.getByTestId('ship-build-panel-fit').locator('.slot-row-value').first()).toBeVisible()
    }
    await detail(page)
    for (const key of statKeys) {
      const actual = (await panel(page).getByTestId('metric-value-' + key).innerText()).replace(/\s+/g, '')
      const expected = ship === 'Osaka' && key === 'turret_avg' ? '301.1MW' : expectedStats[ship].detail[key].replace(/\s+/g, '')
      expect.soft(actual, ship + '.' + key).toBe(expected)
    }
  })

  test('3.7–3.11 ' + ship + ' hull speed crew progress bars have real fills', async ({ page }) => {
    await detail(page)
    for (const key of ['hull', 'speed', 'crew']) {
      const bar = panel(page).getByTestId('metric-bar-' + key)
      await expect(bar).toBeVisible()
      const widths = await bar.evaluate(el => ({ full: el.getBoundingClientRect().width, fill: el.firstElementChild!.getBoundingClientRect().width }))
      expect(widths.fill).toBeGreaterThan(0)
      expect(widths.fill).toBeLessThanOrEqual(widths.full)
    }
    const hullPercent = await panel(page).getByTestId('metric-bar-hull').locator('.metric-bar-fill').evaluate(el => parseFloat((el as HTMLElement).style.width))
    expect(hullPercent).toBeCloseTo(ship === 'Odachi' ? 16100 / 46800.00186 * 100 : 95000 / 253200.010061 * 100, 3)
  })
}

test('3.1–3.2 / 3.4 summary/detail exact fields and adaptive panel height', async ({ page }) => {
  const summary = statKeys.slice(0, 18)
  const keys = () => panel(page).locator('[data-testid^="metric-item-"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-testid')!.slice(12)).sort())
  await page.getByTestId('view-tab-btn-metrics-panel-ship-build-stats-panel-summary').click()
  expect(await keys()).toEqual([...summary].sort())
  const summaryHeight = (await panel(page).boundingBox())!.height
  await detail(page)
  expect(await keys()).toEqual([...statKeys].sort())
  expect((await panel(page).boundingBox())!.height).toBeGreaterThan(summaryHeight)
  await page.getByTestId('view-tab-btn-metrics-panel-ship-build-stats-panel-summary').click()
  expect(await keys()).toEqual([...summary].sort())
})

for (const shipClass of ['ship_s', 'ship_xl']) {
  test('3.12–3.13 ' + shipClass + ' class selection activates filter and exposes race controls', async ({ page }) => {
    await page.getByTestId('ship-build-change-ship-fit-header').click()
    await page.getByTestId('ship-build-filter-class-btn-' + shipClass).click()
    await expect(page.getByTestId('ship-build-filter-class-btn-' + shipClass)).toHaveClass(/filter-chip-active/)
    await expect(page.getByTestId('ship-build-filter-race-btn-argon')).toBeVisible()
  })
}
