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
    await closeBtn.first().click({ force: true })
  }
}

const ensureStationMode = async (page: any) => {
  const stationTab = page.locator('.station-tab').first()
  for (let i = 0; i < 3; i += 1) {
    await stationTab.click({ force: true })
    const isStation = await page.evaluate(() => {
      const empireStore = (window as any).empireStore
      return empireStore?.activeStationId !== null
    })
    if (isStation) return
    await page.waitForTimeout(120)
  }

  await expect.poll(async () => {
    const empireStore = await page.evaluate(() => (window as any).empireStore?.activeStationId ?? null)
    return empireStore !== null
  }).toBe(true)
}

const ensureOverviewMode = async (page: any) => {
  const overviewTab = page.locator('.overview-tab').first()
  for (let i = 0; i < 3; i += 1) {
    await overviewTab.click({ force: true })
    const isOverview = await page.evaluate(() => {
      const empireStore = (window as any).empireStore
      return empireStore?.activeStationId === null
    })
    if (isOverview) return
    await page.waitForTimeout(120)
  }

  await expect.poll(async () => {
    return page.evaluate(() => (window as any).empireStore?.activeStationId === null)
  }).toBe(true)
}

const openFromStationToolbar = async (page: any) => {
  await ensureStationMode(page)
  await page.locator('[data-testid="toolbar-import-btn"]').click({ force: true })
  await expect(page.locator('[data-testid="storage-import-wizard"]')).toBeVisible()
}

const openFromContextToolbar = async (page: any, mode: 'station' | 'empire') => {
  if (mode === 'station') {
    await ensureStationMode(page)
    await expect(page.locator('[data-testid="logicflow-import-entry-station"]')).toBeVisible()
    await page.locator('[data-testid="logicflow-import-entry-station"]').click({ force: true })
  } else {
    await ensureOverviewMode(page)
    await expect(page.locator('[data-testid="logicflow-import-entry-empire"]')).toBeVisible()
    await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
  }
  await expect(page.locator('[data-testid="import-view-modal"]')).toBeVisible()
}

test.describe('x4-import-move e2e mapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const dbData = loadDbFixtureWithoutVsn()
    await applyFixture(page, dbData)

    await page.reload()
    await setLanguageByUi(page)
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
    // 3.2.1 站点页点击 `logicflow-import-entry-station` 后显示 `logicflow-import-group-list`
    await openFromContextToolbar(page, 'station')
    await page.locator('[data-testid="top-view-btn-import-view-logic-flow"]').click({ force: true })
    const stationHasGroupList = await page.locator('[data-testid="logicflow-import-group-list"]').isVisible()

    // 3.2.2 帝国总览点击 `logicflow-import-entry-empire` 后显示 `logicflow-import-plan-list`
    await closeImportModalIfOpen(page)
    await openFromContextToolbar(page, 'empire')
    await page.locator('[data-testid="top-view-btn-import-view-logic-flow"]').click({ force: true })
    const empireHasPlanList = await page.locator('[data-testid="logicflow-import-plan-list"]').isVisible()

    // 3.2.3 两种入口均进入统一 `import-view-modal` #期望: [true]
    const isUnifiedModal = await page.locator('[data-testid="import-view-modal"]').isVisible()
    expect(stationHasGroupList && empireHasPlanList && isUnifiedModal).toBe(true)
  })

  test('3.3 Case: 游戏蓝图上传后展示模块数且在非空站点弹策略弹窗', async ({ page }) => {
    // 3.3.1 在站点页通过 ContextToolbar 入口打开 `import-view-modal` 并切到 game-blueprint tab
    await openFromContextToolbar(page, 'station')
    await page.locator('[data-testid="top-view-btn-import-view-game-blueprint"]').click({ force: true })
    const xml = '<plan name="Alpha Station"><entry macro="prod_gen_energycells_macro" /><entry macro="prod_gen_refinedmetals_macro" /></plan>'
    await page.locator('[data-testid="import-blueprint-file-upload"] input[type="file"]').setInputFiles({
      name: 'alpha.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(xml)
    })

    // 3.3.2 断言 `import-blueprint-module-count` 显示模块总数 `2`
    await expect(page.locator('[data-testid="import-blueprint-module-count"]')).toHaveText('2')

    // 3.3.3 点击导入后弹出 `blueprint-import-strategy-modal` 且包含覆盖/添加/新空间站按钮 #期望: [true]
    await page.locator('[data-testid="import-view-action-import"]').click({ force: true })
    const hasStrategyModal = await page.locator('[data-testid="blueprint-import-strategy-modal"]').isVisible()
    const hasOverwrite = await page.locator('[data-testid="blueprint-strategy-overwrite"]').isVisible()
    const hasAdd = await page.locator('[data-testid="blueprint-strategy-add"]').isVisible()
    const hasNew = await page.locator('[data-testid="blueprint-strategy-new"]').isVisible()
    expect(hasStrategyModal && hasOverwrite && hasAdd && hasNew).toBe(true)
  })

  test('3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站', async ({ page }) => {
    // 3.4.1 在帝国总览打开导入视图并切换到 `x4-station` tab
    await openFromContextToolbar(page, 'empire')
    await page.locator('[data-testid="top-view-btn-import-view-x4-station"]').click({ force: true })

    // 3.4.2 输入 `https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1` 并执行导入
    const beforeState = await page.evaluate(() => {
      const empireStore = (window as any).empireStore
      return {
        count: empireStore.activeEmpire.stations.length,
        names: empireStore.activeEmpire.stations.map((s: any) => s.name)
      }
    })
    await page.locator('[data-testid="import-x4-station-input"]').fill('https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1')
    await page.locator('[data-testid="import-view-action-import"]').click({ force: true })

    const afterState = await page.evaluate(() => {
      const empireStore = (window as any).empireStore
      const stations = empireStore.activeEmpire.stations
      const lastStation = stations[stations.length - 1]
      return {
        count: stations.length,
        lastName: lastStation?.name || '',
        lastModulesLen: Array.isArray(lastStation?.modules) ? lastStation.modules.length : 0,
        lastType: lastStation?.type || '',
        lastCount: lastStation?.count ?? -1
      }
    })

    // 3.4.3 断言新建空间站 `modules` 字段存在且至少包含 1 项 #期望: [1]
    expect(afterState.lastModulesLen).toBeGreaterThanOrEqual(1)

    // 3.4.4 断言新建空间站 `type=industrial` 且 `count=1` #期望: ['industrial', 1]
    expect(afterState.lastType).toBe('industrial')
    expect(afterState.lastCount).toBe(1)

    // 3.4.5 断言空间站数量增加且新建站名为 `新建空间站` #期望: ['新建空间站']
    expect(afterState.count).toBe(beforeState.count + 1)
    expect(afterState.lastName).toBe('新建空间站')
  })
})
