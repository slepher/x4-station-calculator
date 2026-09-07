import { test, expect, type Page } from '@playwright/test'
import dbFixture from '../../fixtures/db.json' with { type: 'json' }

const keys = {
  empire: 'x4_empire_data_v9',
  logic_flow: 'x4_logic_flow_plans_v9',
  ship_blueprints: 'x4_ship_blueprints_v9'
} as const

async function openVersionModal(page: Page) {
  await page.getByTestId('toolbar-version-btn').click()
  await expect(page.getByTestId('version-settings-modal')).toContainText('游戏版本')
}

async function selectTargetVersion(page: Page) {
  await page.getByTestId('version-select').selectOption('8.0::stable')
  await expect(page.getByTestId('version-select')).toHaveValue('8.0::stable')
}

async function switchAndReload(page: Page, button = 'version-switch') {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByTestId(button).click()
  ])
  await expect(page.getByTestId('toolbar-version-btn')).toBeVisible()
}

async function readSaved(page: Page) {
  return page.evaluate((storageKeys) => Object.fromEntries(
    Object.entries(storageKeys).map(([module, key]) => [module, JSON.parse(localStorage.getItem(key)!)])
  ), keys)
}

async function makeDirtyModules(page: Page) {
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
  await page.getByTestId('top-view-btn-flow').click()
  await expect(page.locator('.production-group')).toHaveCount(0)
  const hullParts = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]')
  await hullParts.hover()
  await hullParts.locator('.ware-card-add-btn').click()
  await page.locator('.context-menu-new-line').click()
  await expect(page.locator('.production-group')).toHaveCount(1)
  await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toBeVisible()
  await page.getByTestId('top-view-btn-ship-build').click()
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.getByTestId('ship-build-ship-name').filter({ hasText: /^武士刀$|^Katana$/ }).click()
  await page.getByTestId('ship-build-confirm-ship').click()
  const fit = page.getByTestId('ship-build-panel-fit')
  await fit.getByTestId('slot-type-engine').click()
  await fit.locator('[data-testid^="slot-"]:not([data-testid^="slot-type-"])').first().click()
  await page.getByTestId('equipment-picker').locator('[data-testid^="candidate-engine_"]').first().click()
  await page.getByTestId('picker-confirm').click()
  await expect(page.getByTestId('equipment-picker')).toBeHidden()
  await page.getByTestId('top-view-btn-flow').click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const data = JSON.parse(JSON.stringify(dbFixture))
  delete data.vsn
  // Explicit clean planning state in both stable namespaces; dirty state is created through UI.
  data.x4_empire_data = { version: 5, activeId: null, list: [] }
  data.x4_logic_flow_plans = { version: 3, activeId: null, list: [] }
  data.x4_ship_blueprints = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  data.x4_logic_flow_plans_v9 = { version: 3, activeId: null, list: [] }
  data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  await page.evaluate((fixture) => {
    Object.entries(fixture).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.removeItem('x4_game_version')
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
})

test('2.1 状态: 版本弹窗已打开', async ({ page }) => {
  await openVersionModal(page)
  await expect(page.getByTestId('version-select')).toHaveValue('9.0::stable')
  await expect(page.getByTestId('version-settings-modal')).toContainText('版本之间数据不互通')
})

test('2.2 切换: 打开版本弹窗 -> 选择目标版本', async ({ page }) => {
  await openVersionModal(page)
  await selectTargetVersion(page)
  await expect(page.getByTestId('version-switch')).toBeEnabled()
})

test('3.1 Case: 首次访问显示红点', async ({ page }) => {
  await expect(page.getByTestId('toolbar-version-indicator')).toBeVisible()
  await openVersionModal(page)
  await page.getByTestId('version-switch').click()
  await expect(page.getByTestId('toolbar-version-indicator')).toBeHidden()
  await page.reload()
  await expect(page.getByTestId('toolbar-version-indicator')).toBeHidden()
})

test('3.2 Case: 切换版本后数据隔离', async ({ page }) => {
  await page.getByTestId('sidebar-add-station').click()
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await dialog.locator('.dialog-input').fill('M16.1 Stable Empire')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  const before = await readSaved(page)
  expect(before.empire.list).toHaveLength(1)
  expect(before.empire.list[0].name).toBe('M16.1 Stable Empire')
  await openVersionModal(page)
  await selectTargetVersion(page)
  await switchAndReload(page)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4_game_version')!)))
    .toEqual({ version: '8.0', beta: false })
  await expect(page.getByTestId('sidebar-station')).toHaveCount(0)
  expect(await readSaved(page)).toEqual(before)
  await openVersionModal(page)
  await page.getByTestId('version-select').selectOption('9.0::stable')
  await switchAndReload(page)
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
  expect(await readSaved(page)).toEqual(before)
})

for (const selected of ['empire', 'logic_flow', 'ship_blueprints'] as const) {
  test(`3.3 Case: 仅保存勾选的 dirty 模块 ${selected}`, async ({ page }) => {
    await makeDirtyModules(page)
    const before = await readSaved(page)
    await openVersionModal(page)
    await selectTargetVersion(page)
    await expect(page.getByTestId('unsaved-modules-panel')).toContainText('勾选的模块会在切换版本前先保存')
    await expect(page.getByTestId('unsaved-module-empire')).not.toBeChecked()
    await expect(page.getByTestId('unsaved-module-logic_flow')).not.toBeChecked()
    await expect(page.getByTestId('unsaved-module-ship_blueprints')).not.toBeChecked()
    await page.getByTestId('unsaved-select-all').check()
    await expect(page.getByTestId('module-name-empire')).not.toHaveValue('')
    await expect(page.getByTestId('module-name-logic_flow')).not.toHaveValue('')
    await expect(page.getByTestId('module-name-ship_blueprints')).not.toHaveValue('')
    await page.getByTestId('unsaved-select-all').uncheck()
    await page.getByTestId(`unsaved-module-${selected}`).check()
    const name = page.getByTestId(`module-name-${selected}`)
    await name.fill(' ')
    await expect(page.getByTestId('version-save-switch')).toBeDisabled()
    await name.fill(`M16.1 ${selected}`)
    await expect(page.getByTestId('version-save-switch')).toHaveText('保存并切换')
    await switchAndReload(page, 'version-save-switch')
    const after = await readSaved(page)
    if (selected === 'ship_blueprints') {
      expect(after.ship_blueprints.ships).toHaveLength(1)
      expect(after.ship_blueprints.ships[0].shipId).toBe('ship_ter_m_corvette_01_a')
      expect(after.ship_blueprints.ships[0].blueprints).toHaveLength(1)
      expect(after.ship_blueprints.ships[0].blueprints[0].name).toBe('M16.1 ship_blueprints')
    } else {
      expect(after[selected].list).toHaveLength(1)
      expect(after[selected].list[0].name).toBe(`M16.1 ${selected}`)
    }
    for (const unchecked of Object.keys(keys).filter(module => module !== selected)) {
      expect(after[unchecked]).toEqual(before[unchecked])
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4_game_version')!)))
      .toEqual({ version: '8.0', beta: false })
  })
}

test('3.4 Case: 不勾选时切换不保存 dirty 模块', async ({ page }) => {
  await makeDirtyModules(page)
  const before = await readSaved(page)
  await openVersionModal(page)
  await selectTargetVersion(page)
  await expect(page.getByTestId('unsaved-module-empire')).not.toBeChecked()
  await expect(page.getByTestId('unsaved-module-logic_flow')).not.toBeChecked()
  await expect(page.getByTestId('unsaved-module-ship_blueprints')).not.toBeChecked()
  await expect(page.getByTestId('version-switch')).toHaveText('切换')
  await switchAndReload(page)
  expect(await readSaved(page)).toEqual(before)
})

test('3.5 Case: 同版本确认写入且不 reload、不保存 dirty 模块', async ({ page }) => {
  await makeDirtyModules(page)
  const before = await readSaved(page)
  const documentBefore = await page.evaluate(() => performance.timeOrigin)
  await openVersionModal(page)
  await expect(page.getByTestId('unsaved-modules-panel')).toHaveCount(0)
  await page.getByTestId('version-switch').click()
  await expect(page.getByTestId('version-settings-modal')).toBeHidden()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4_game_version')!)))
    .toEqual({ version: '9.0', beta: false })
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentBefore)
  expect(await readSaved(page)).toEqual(before)
  await expect(page.locator('.production-group')).toHaveCount(1)
})

test('3.6 Case: 同版本已写库按钮禁用', async ({ page }) => {
  await openVersionModal(page)
  await page.getByTestId('version-switch').click()
  await makeDirtyModules(page)
  await openVersionModal(page)
  await expect(page.getByTestId('version-switch')).toBeDisabled()
  await expect(page.getByTestId('unsaved-modules-panel')).toHaveCount(0)
  await expect(page.getByTestId('version-save-switch')).toHaveCount(0)
})
