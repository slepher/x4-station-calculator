import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const selectOsakaAndEnterWorkspace = async (page: any) => {
  await page.getByTestId('top-view-btn-ship-build').click()
  await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大阪$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

const loadBuiltInPreset = async (page: any, presetName: '低配' | '中配' | '高配') => {
  await page.getByTestId('ship-build-blueprint-menu-trigger').click()
  const menu = page.getByTestId('ship-build-blueprint-menu')
  await expect(menu).toContainText('预设配装')
  await menu.locator('.ship-blueprint-menu-item-built-in').filter({ hasText: new RegExp('^' + presetName + '$') }).click()
  await expect(menu).toBeHidden()
  const result = await page.evaluate(() => (window as any).shipBuildStore.blueprint.connections.flatMap((c: any) => c.group))
  expect(result.filter((g: any) => g.equipment_id?.startsWith('engine_') && g.count > 0).length).toBeGreaterThan(0)
  expect(result.filter((g: any) => g.equipment_id?.startsWith('turret_') && g.count > 0).length).toBeGreaterThan(0)
}

const hasVisibleNonEmptySlotInCurrentType = async (page: any) => {
  const panel = page.getByTestId('ship-build-panel-fit')
  const rows = panel.locator('[data-testid^="slot-"]:not([data-testid^="slot-type-"])')
  await expect(rows.first()).toBeVisible()
  const titles = (await rows.locator('.slot-row-title').allTextContents()).map((t: string) => t.trim())
  const values = (await rows.locator('.slot-row-value').allTextContents()).map((t: string) => t.trim())
  return titles.map((title: string, idx: number) => ({ title, value: values[idx] || '' }))
}

const isNotEmptySlotText = (text: string) => text.length > 0 && text !== '空槽位' && text !== 'Empty Slot'

const assertSlotTypeLoadedInUI = async (page: any, slotType: 'engine' | 'turret') => {
  const panel = page.getByTestId('ship-build-panel-fit')
  await panel.getByTestId(`slot-type-${slotType}`).click()
  const items = await hasVisibleNonEmptySlotInCurrentType(page)

  const mainItems = items.filter((item: any) => !/护盾|shield/i.test(item.title))
  return mainItems.length > 0 && mainItems.every((item: any) => isNotEmptySlotText(item.value))
}

const assertEngineAndTurretLoadedInUI = async (page: any) => {
  const panel = page.getByTestId('ship-build-panel-fit')
  await expect(panel).toBeVisible()

  const engineLoaded = await assertSlotTypeLoadedInUI(page, 'engine')
  const turretLoaded = await assertSlotTypeLoadedInUI(page, 'turret')

  return { engineLoaded, turretLoaded }
}

const applyFixture = async (page: any, fixturePath: '../../fixtures/db.json' | '../../fixtures/x4-export.json') => {
  await page.goto('/')

  const dbFixture = await import(fixturePath, { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  dbData.x4_game_version = { version: '9.0', beta: false }
  dbData.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  await page.reload()

  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
}

const presetNames: Array<'低配' | '中配' | '高配'> = ['低配', '中配', '高配']

test.describe('默认 fixture(db.json) 对比', () => {
  test.beforeEach(async ({ page }) => {
    await applyFixture(page, '../../fixtures/db.json')
  })

  for (const presetName of presetNames) {
    test(`Osaka 默认预设载入(${presetName}): 配置列表与页面均包含引擎和炮塔 [db.json]`, async ({ page }) => {
      await selectOsakaAndEnterWorkspace(page)
      await loadBuiltInPreset(page, presetName)

      const state = await assertEngineAndTurretLoadedInUI(page)
      expect(state.engineLoaded).toBe(true)
      expect(state.turretLoaded).toBe(true)
    })
  }
})

test.describe('用户提供 fixture(x4-export.json) 对比', () => {
  test.beforeEach(async ({ page }) => {
    await applyFixture(page, '../../fixtures/x4-export.json')
  })

  for (const presetName of presetNames) {
    test(`Osaka 默认预设载入(${presetName}): 配置列表与页面均包含引擎和炮塔 [x4-export.json]`, async ({ page }) => {
      await selectOsakaAndEnterWorkspace(page)
      await loadBuiltInPreset(page, presetName)

      const state = await assertEngineAndTurretLoadedInUI(page)
      expect(state.engineLoaded).toBe(true)
      expect(state.turretLoaded).toBe(true)
    })
  }
})
