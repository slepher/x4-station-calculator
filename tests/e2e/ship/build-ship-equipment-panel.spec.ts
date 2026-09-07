import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const details = (page: Page) => page.getByTestId('metrics-panel-ship-build-equipment')
const blueprint = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).shipBuildStore.blueprint)))
const slot = (page: Page, type: string) => page.locator(`[data-testid^="slot-ship_ter_m_corvette_02_a::${type}::"]`).first()
const realCandidate = (page: Page, type: string) => page.locator(`[data-testid^="candidate-${type}_"]`).first()
async function open(page: Page, type: string) {
  await page.getByTestId(`slot-type-${type}`).click()
  await slot(page, type).click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
}
async function shield(page: Page, mk: '1' | '2') {
  await open(page, 'shield')
  await page.getByTestId('picker-race-argon').click()
  await page.getByTestId(`picker-mk-${mk}`).click()
  await page.getByTestId(`candidate-shield_arg_m_standard_01_mk${mk}`).click()
}
async function installShield(page: Page, mk: '1' | '2') {
  await shield(page, mk)
  await page.getByTestId('picker-confirm').click()
  await expect(page.getByTestId('equipment-picker')).toBeHidden()
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
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
})

const requiredDetails: Record<string, string[]> = {
  weapon: ['burstDPS', 'sustainedDPS', 'range', 'singleDamage', 'avgShotTime', 'ammo', 'ammoReload', 'chargetime', 'timeToOverheat', 'cooldelay', 'coolTime', 'cycleTime'],
  turret: ['burstDPS', 'sustainedDPS', 'range', 'singleDamage', 'avgShotTime', 'ammo', 'ammoReload', 'chargetime', 'timeToOverheat', 'cooldelay', 'coolTime', 'cycleTime'],
  shield: ['shieldMax', 'shieldRate', 'shieldDelay'],
  engine: ['thrustForward', 'speed', 'acceleration', 'boostMultiplier', 'boostSpeed', 'boostAccel', 'travelThrust', 'travelSpeed', 'travelCharge', 'travelAcceleration'],
  thruster: ['pitch', 'yaw', 'roll', 'strafe', 'pitchRate', 'yawRate', 'rollRate', 'strafeSpeed', 'strafeAcceleration']
}
for (const type of ['weapon', 'turret', 'shield', 'engine', 'thruster']) {
  test(`2.1–2.5 / 3.5–3.14 ${type}: real candidate summary and canonical details`, async ({ page }) => {
    await open(page, type)
    const candidate = realCandidate(page, type)
    await expect(candidate.locator('.candidate-summary-1 .summary-value')).not.toHaveText('')
    await expect(candidate.locator('.candidate-summary-2 .summary-value')).not.toHaveText('')
    await candidate.click()
    await expect(details(page)).toBeVisible()
    const keys = await details(page).locator('[data-testid^="metric-item-"]').evaluateAll((rows) => rows.map(row => row.getAttribute('data-testid')!.slice('metric-item-'.length)))
    expect.soft(keys).toEqual(expect.arrayContaining(requiredDetails[type]!))
    if (type === 'engine') {
      // Canonical engine summary requires travelSpeed:travelCharge.
      await expect(candidate.locator('.candidate-summary-2 .summary-value')).toHaveText(/^\d[\d,.]*:\d[\d,.]*$/)
    }
  })
}

test('3.1 / 3.18 Equipment is above Stats; closing picker hides details', async ({ page }) => {
  await shield(page, '1')
  const equipment = await details(page).boundingBox()
  const stats = await page.getByTestId('ship-build-panel-stats').boundingBox()
  expect(equipment).not.toBeNull()
  expect(stats).not.toBeNull()
  expect(equipment!.y + equipment!.height).toBeLessThanOrEqual(stats!.y)
  await page.getByTestId('picker-cancel').click()
  await expect(details(page)).toBeHidden()
  await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
})

test('3.3 / 3.22 positive difference uses fixed shield values and blue bar', async ({ page }) => {
  await installShield(page, '1')
  const before = await blueprint(page)
  await shield(page, '2')
  const value = details(page).getByTestId('metric-value-shieldMax')
  await expect(value).toHaveText('7,475(+1,725)MJ')
  await expect(value.locator('.diff-positive')).toBeVisible()
  await expect(details(page).getByTestId('metric-bar-shieldMax').locator('.metric-bar-positive')).toBeVisible()
  expect(await blueprint(page)).toEqual(before)
})

test('3.4 / 3.23 negative difference uses fixed shield values and pink bar', async ({ page }) => {
  await installShield(page, '2')
  await shield(page, '1')
  const value = details(page).getByTestId('metric-value-shieldMax')
  await expect(value).toHaveText('5,750(-1,725)MJ')
  await expect(value.locator('.diff-negative')).toBeVisible()
  await expect(details(page).getByTestId('metric-bar-shieldMax').locator('.metric-bar-negative')).toBeVisible()
})

test('2.7 / 3.17 / 3.24 same equipment displays no comparison delta or colored bar', async ({ page }) => {
  await installShield(page, '1')
  await shield(page, '1')
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('5,750MJ')
  await expect(details(page).locator('.metric-bar-positive, .metric-bar-negative')).toHaveCount(0)
})

test('3.15 candidate empty displays current values; both empty hides details', async ({ page }) => {
  // 监听 console 日志
  const logs: string[] = []
  page.on('console', msg => logs.push(msg.text()))
  await installShield(page, '1')
  await open(page, 'shield')
  await page.getByTestId('candidate-empty').click()
  // 打印日志
  console.log('Console logs:', logs.filter(l => l.includes('DEBUG')))
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('5,750MJ')
  await page.getByTestId('picker-confirm').click()
  await open(page, 'shield')
  await page.getByTestId('candidate-empty').click()
  await expect(details(page)).toBeHidden()
})

test('2.6 / 3.16 / 3.20 empty current previews only candidate and commits only on confirm', async ({ page }) => {
  const before = await blueprint(page)
  await shield(page, '1')
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('5,750MJ')
  expect(await blueprint(page)).toEqual(before)
  await page.getByTestId('picker-confirm').click()
  const groups = (await blueprint(page)).connections.flatMap((c: any) => c.group)
  expect(groups.filter((g: any) => g.equipment_id === 'shield_arg_m_standard_01_mk1' && g.count > 0)).toHaveLength(1)
})

test('3.19 / 3.21 changing candidate and equipment type refreshes details', async ({ page }) => {
  await shield(page, '1')
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('5,750MJ')
  await page.getByTestId('picker-mk-1').click()
  await page.getByTestId('picker-mk-2').click()
  await page.getByTestId('candidate-shield_arg_m_standard_01_mk2').click()
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('7,475MJ')
  await page.getByTestId('picker-cancel').click()
  await open(page, 'engine')
  await realCandidate(page, 'engine').click()
  await expect(details(page).getByTestId('metric-item-speed')).toBeVisible()
  await expect(details(page).getByTestId('metric-item-shieldMax')).toHaveCount(0)
})

test('3.2 progress maximum remains based on all compatible candidates after race filtering', async ({ page }) => {
  await open(page, 'shield')
  await page.getByTestId('candidate-shield_arg_m_standard_01_mk1').click()
  const width = await details(page).getByTestId('metric-bar-shieldMax').locator('.metric-bar-neutral').evaluate(el => (el as HTMLElement).style.width)
  await page.getByTestId('picker-race-argon').click()
  await expect(details(page).getByTestId('metric-value-shieldMax')).toHaveText('5,750MJ')
  const filteredWidth = await details(page).getByTestId('metric-bar-shieldMax').locator('.metric-bar-neutral').evaluate(el => (el as HTMLElement).style.width)
  expect(filteredWidth).toBe(width)
  // 9.0 advanced/unhittable medium shields: TER Mk3 capacity 9,720 is the compatible maximum.
  expect(parseFloat(width)).toBeCloseTo(5750 / 9720 * 100, 2)
})
