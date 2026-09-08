import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const loadDbFixtureWithoutVsn = () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'db.json')
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
  delete fixture.vsn
  return fixture
}
const importFullFixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'import-export', 'import-full.json')
const logicFlowImportFixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'x4-export.json')

const applyFixture = async (page: any, data: Record<string, unknown>) => {
  await page.evaluate((dbData: Record<string, unknown>) => {
    Object.entries(dbData).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, data)
}

const setLanguageByUi = async (page: any) => {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ }).first()
  await langSelect.selectOption('zh-CN')
}

const closeImportModalIfOpen = async (page: any) => {
  const closeBtn = page.locator('[data-testid="import-view-close"]')
  if (await closeBtn.count()) {
    await closeBtn.first().click()
  }
}

const ensureStationMode = async (page: any) => {
  const stationTab = page.locator('[data-testid="sidebar-station"]').first()
  await stationTab.click()
  await expect(stationTab).toHaveClass(/active/)
}

const ensureOverviewMode = async (page: any) => {
  const overviewTab = page.locator('[data-testid="sidebar-overview"]').first()
  await overviewTab.click()
  await expect(overviewTab).toHaveClass(/active/)
}

const openFromStationToolbar = async (page: any) => {
  await ensureStationMode(page)
  await page.locator('[data-testid="toolbar-import-btn"]').click()
  await expect(page.locator('[data-testid="storage-import-wizard"]')).toBeVisible()
}

const openFromContextToolbar = async (page: any, mode: 'station' | 'empire') => {
  if (mode === 'station') {
    await ensureStationMode(page)
    await expect(page.locator('[data-testid="logicflow-import-entry-station"]')).toBeVisible()
    await page.locator('[data-testid="logicflow-import-entry-station"]').click()
  } else {
    await ensureOverviewMode(page)
    await expect(page.locator('[data-testid="logicflow-import-entry-empire"]')).toBeVisible()
    await page.locator('[data-testid="logicflow-import-entry-empire"]').click()
  }
  await expect(page.locator('[data-testid="import-view-modal"]')).toBeVisible()
}

const addNonEmptyStationModule = async (page: any) => {
  await ensureStationMode(page)
  await page.getByTestId('candidate-search-input').fill('module_gen_prod_energycells_01')
  await page.getByTestId('grouped-candidate-item-module_gen_prod_energycells_01').click()
}

const importLogicFlowPlan = async (page: any) => {
  await ensureStationMode(page)
  await page.locator('[data-testid="toolbar-import-btn"]').click()
  await page.locator('[data-testid="storage-import-file-input"]').setInputFiles(logicFlowImportFixturePath)
  await page.locator('[data-testid="storage-import-mode-incremental"]').click()
  for (const key of ['x4_empire_data', 'x4_ship_blueprints', 'x4_save_archives', 'x4_save_bindings', 'x4_build_plan_goals', 'x4_terraforming_data']) {
    const checkbox = page.locator(`[data-testid="storage-import-module-${key}"] input[type="checkbox"]`)
    if (await checkbox.isChecked()) await checkbox.uncheck()
  }
  const logicFlowCheckbox = page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"] input[type="checkbox"]')
  if (!(await logicFlowCheckbox.isChecked())) await logicFlowCheckbox.check()
  await page.getByTestId('storage-import-apply-btn').click()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  await setLanguageByUi(page)
  if (await page.locator('[data-testid="sidebar-station"][data-station-id]').count() === 0) {
    await page.getByTestId('sidebar-add-station').click()
  }
  await addNonEmptyStationModule(page)
}

test.describe('x4-import-move e2e mapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const dbData = loadDbFixtureWithoutVsn()
    await applyFixture(page, dbData)

    await page.reload()
    await setLanguageByUi(page)
    await page.getByTestId('sidebar-add-station').click()
    await expect(page.locator('[data-testid="sidebar-station"][data-station-id]')).toHaveCount(1)
  })

test('3.1 Case: StationToolbar Import 打开 storage-import 向导', async ({ page }) => {
    // 3.1.1 点击 StationToolbar `Import` 按钮并打开 `storage-import-wizard`
    await openFromStationToolbar(page)

    // 3.1.2 上传合法导入文件后，断言 Empire/Flow/Ship 三个模块复选项存在
    await page.locator('[data-testid="storage-import-file-input"]').setInputFiles(importFullFixturePath)
    await expect(page.locator('[data-testid="storage-import-config"]')).toBeVisible()
    await expect(page.locator('[data-testid="storage-import-module-x4_empire_data"]')).toBeVisible()
    await expect(page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"]')).toBeVisible()
    await expect(page.locator('[data-testid="storage-import-module-x4_ship_blueprints"]')).toBeVisible()

    // 3.1.3 断言覆盖/增量模式切换可见且不显示 `import-view-modal` #期望: [true]
    const hasOverwrite = await page.locator('[data-testid="storage-import-mode-overwrite"]').isVisible()
    const hasIncremental = await page.locator('[data-testid="storage-import-mode-incremental"]').isVisible()
    const hasImportViewModal = await page.locator('[data-testid="import-view-modal"]').isVisible().catch(() => false)
    expect(hasOverwrite && hasIncremental && !hasImportViewModal).toBe(true)
  })

  test('3.2 Case: ContextToolbar logic-flow 入口按当前页面自动判定导入目标', async ({ page }) => {
    await importLogicFlowPlan(page)
    // 3.2.1 站点页点击 `logicflow-import-entry-station` 后显示 `logicflow-import-group-list`
    await openFromContextToolbar(page, 'station')
    await page.locator('[data-testid="top-view-btn-import-view-logic-flow"]').click()
    await expect(page.locator('[data-testid="logicflow-import-group-list"]')).toBeVisible()

    // 3.2.2 帝国总览点击 `logicflow-import-entry-empire` 后显示 `logicflow-import-plan-list`
    await closeImportModalIfOpen(page)
    await openFromContextToolbar(page, 'empire')
    await page.locator('[data-testid="top-view-btn-import-view-logic-flow"]').click()
    await expect(page.locator('[data-testid="logicflow-import-plan-list"]')).toBeVisible()

    // 3.2.3 两种入口均进入统一 `import-view-modal` #期望: [true]
    const isUnifiedModal = await page.locator('[data-testid="import-view-modal"]').isVisible()
    expect(isUnifiedModal).toBe(true)
  })

  test('3.3 Case: 游戏蓝图上传后展示模块数且在非空站点弹策略弹窗', async ({ page }) => {
    // 3.3.1 在站点页通过 ContextToolbar 入口打开 `import-view-modal` 并切到 game-blueprint tab
    await addNonEmptyStationModule(page)
    await openFromContextToolbar(page, 'station')
    await page.locator('[data-testid="top-view-btn-import-view-game-blueprint"]').click()
    const xml = '<plan name="Alpha Station"><entry macro="prod_gen_energycells_macro" /><entry macro="prod_gen_refinedmetals_macro" /></plan>'
    await page.locator('[data-testid="import-blueprint-file-upload"] input[type="file"]').setInputFiles({
      name: 'alpha.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(xml)
    })

    // 3.3.2 断言 `import-blueprint-module-count` 显示模块总数 `2`
    await expect(page.locator('[data-testid="import-blueprint-module-count"]')).toHaveText('2')

    // 3.3.3 点击导入后弹出 `blueprint-import-strategy-modal` 且包含覆盖/添加/新空间站按钮 #期望: [true]
    await page.locator('[data-testid="import-view-action-import"]').click()
    await expect(page.locator('[data-testid="blueprint-import-strategy-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-cancel"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-overwrite"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-add"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-new"]')).toBeVisible()
  })

  test('3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站', async ({ page }) => {
    // 3.4.1 点击 `[data-testid="sidebar-overview"]` 并断言 `[data-testid="sidebar-overview"].active` 可见后，再通过 `logicflow-import-entry-empire` 打开 `import-view-modal` #期望: [true]
    await ensureOverviewMode(page)
    const hasOverviewActive = await page.locator('[data-testid="sidebar-overview"].active').isVisible()
    expect(hasOverviewActive).toBe(true)

    await openFromContextToolbar(page, 'empire')

    // 3.4.2 输入 `https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1` 并执行导入
    const beforeCount = await page.locator('[data-testid="sidebar-station"][data-station-id]').count()
    await page.locator('[data-testid="top-view-btn-import-view-x4-station"]').click()
    await page.locator('[data-testid="import-x4-station-input"]').fill('https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1')
    await page.locator('[data-testid="import-view-action-import"]').click()

    const afterCount = await page.locator('[data-testid="sidebar-station"][data-station-id]').count()

    // 3.4.3 断言导入后 `import-view-modal` 不可见，且 `[data-testid="sidebar-station"][data-station-id]` 数量从 `N` 变为 `N+1` #期望: ['N+1']
    const importModalGone = await page.locator('[data-testid="import-view-modal"]').isVisible().catch(() => false)
    expect(importModalGone).toBe(false)
    expect(afterCount).toBe(beforeCount + 1)

    // 3.4.4 断言当前激活标签 `[data-testid="sidebar-station"].active .sidebar-item-label` 文案为 `新建空间站` #期望: ['新建空间站']
    await page.waitForSelector('[data-testid="sidebar-station"].active .sidebar-item-label')
    const activeTabLabel = await page.locator('[data-testid="sidebar-station"].active .sidebar-item-label').textContent()
    expect(activeTabLabel).toContain('新建空间站')

    // 3.4.5 断言站点标签区可见且 `[data-testid="sidebar-overview"].active` 不可见（已从帝国总览切回新建站点） #期望: [true]
    const hasStationTabs = await page.locator('[data-testid="sidebar-station"]').first().isVisible()
    const hasNoOverviewActive = await page.locator('[data-testid="sidebar-overview"].active').isVisible().catch(() => false)
    expect(hasStationTabs && !hasNoOverviewActive).toBe(true)
  })

  test('3.5 Case: 非空站点在 logic-flow tab 点击导入进入统一策略弹窗', async ({ page }) => {
    // 3.5.1 在站点页通过 `logicflow-import-entry-station` 打开 `import-view-modal` 并保持当前站点非空
    await ensureStationMode(page)
    await addNonEmptyStationModule(page)
    await importLogicFlowPlan(page)
    await openFromContextToolbar(page, 'station')

    // 3.5.2 切换到 `logic-flow` tab 后通过可导入规划区的真实导入动作继续
    await page.locator('[data-testid="top-view-btn-import-view-logic-flow"]').click()
    await expect(page.locator('[data-testid^="logicflow-import-group-direct-"]').first()).toBeVisible()
    await page.locator('[data-testid^="logicflow-import-group-direct-"]').first().click()

    // 3.5.3 断言显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']
    await expect(page.locator('[data-testid="blueprint-import-strategy-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-cancel"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-overwrite"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-add"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-new"]')).toBeVisible()
  })

  test('3.6 Case: 非空站点在 x4-station tab 点击导入进入统一策略弹窗', async ({ page }) => {
    // 3.6.1 在站点页通过 `logicflow-import-entry-station` 打开 `import-view-modal` 并切换到 `x4-station` tab
    await ensureStationMode(page)
    await addNonEmptyStationModule(page)
    await openFromContextToolbar(page, 'station')
    await page.locator('[data-testid="top-view-btn-import-view-x4-station"]').click()

    // 3.6.2 输入 "https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1" 后执行 `import-view-action-import`
    await page.locator('[data-testid="import-x4-station-input"]').fill('https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1')
    await page.locator('[data-testid="import-view-action-import"]').click()

    // 3.6.3 断言显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']
    await expect(page.locator('[data-testid="blueprint-import-strategy-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-cancel"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-overwrite"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-add"]')).toBeVisible()
    await expect(page.locator('[data-testid="blueprint-strategy-new"]')).toBeVisible()
  })

  test('M9.1 placement: station panel uses real pointer placement and renders persisted identity', async ({ page }) => {
    await addNonEmptyStationModule(page)
    await page.getByTestId('top-view-btn-maps').click()
    await expect(page.getByTestId('map-workbench-view')).toBeVisible()
    await page.getByTestId('map-station-panel-tab').click()
    await expect(page.getByTestId('map-station-panel')).toBeVisible()

    const stationItem = page.locator('[data-testid^="station-item-"]').first()
    await expect(stationItem).toBeVisible()
    const sector = page.locator('[data-map-sector-id="cluster_01_sector001_macro"]').first()
    await expect(sector).toBeVisible()
    const source = await stationItem.boundingBox()
    const target = await sector.boundingBox()
    expect(source).not.toBeNull()
    expect(target).not.toBeNull()
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 4 })
    await page.mouse.up()

    await expect(stationItem).toHaveClass(/placed/)
    await expect(page.locator('[data-placement-key^="blueprint:"]').first()).toBeVisible()
  })
})
