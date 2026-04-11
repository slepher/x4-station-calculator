import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import path from 'path'

const fullImportPath = path.join(process.cwd(), 'tests/fixtures/import-export/import-full.json')

test.describe('import-export e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn

    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)

    await page.reload()

    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
  })

  test('2.1 状态: 导出按钮触发下载', async ({ page }) => {
    await stateExportDownloaded(page)
  })

  test('2.2 状态: 导入文件并进入配置面板', async ({ page }) => {
    await stateImportConfigVisible(page)
  })

  test('2.3 状态: 覆盖模式默认全选', async ({ page }) => {
    await stateOverwriteAllSelected(page)
  })

  test('2.4 状态: 覆盖模式取消flow后导入', async ({ page }) => {
    await stateOverwriteFlowUncheckedAndApplied(page)
  })

  test('3.1 Case: 导入导出主路径编排', async ({ page }) => {
    // 3.1.1 状态: 导出按钮触发下载
    await stateExportDownloaded(page)
    // 3.1.2 状态: 导入文件并进入配置面板
    await stateImportConfigVisible(page)
    // 3.1.3 状态: 覆盖模式默认全选
    await stateOverwriteAllSelected(page)
    // 3.1.4 状态: 覆盖模式取消flow后导入
    await stateOverwriteFlowUncheckedAndApplied(page)
    // 3.1.4.1 导入后保持 flow activeId 不变 #期望: ["logic-flow-1"]
    const flowActiveId = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(flowActiveId).toBe('logic-flow-1')
  })
})

async function stateExportDownloaded(page: Page) {
  // 2.1.1 点击导出按钮并收到 `.json` 下载 #期望: ["x4-export-"]
  await page.getByTestId('toolbar-export-btn').click()
  await expect(page.getByTestId('storage-export-config')).toBeVisible()

  await expect(page.getByTestId('storage-export-module-x4_empire_data')).toBeVisible()
  await expect(page.getByTestId('storage-export-module-x4_logic_flow_plans')).toBeVisible()
  await expect(page.getByTestId('storage-export-module-x4_ship_blueprints')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('storage-export-download-btn').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('x4-export-')
}

async function stateImportConfigVisible(page: Page) {
  // 2.2.1 上传 `import-full.json` 后显示导入配置 #期望: [true]
  await ensureImportConfigWithFile(page)
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
}

async function stateOverwriteAllSelected(page: Page) {
  // 2.3.1 上传后保持 overwrite 并断言三模块默认选中 #期望: [true]
  await ensureImportConfigWithFile(page)

  const empireCheckbox = page.locator('[data-testid="storage-import-module-x4_empire_data"] input[type="checkbox"]')
  const flowCheckbox = page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"] input[type="checkbox"]')
  const shipCheckbox = page.locator('[data-testid="storage-import-module-x4_ship_blueprints"] input[type="checkbox"]')

  await expect(empireCheckbox).toBeChecked()
  await expect(flowCheckbox).toBeChecked()
  await expect(shipCheckbox).toBeChecked()
  expect(await empireCheckbox.isChecked()).toBe(true)
}

async function stateOverwriteFlowUncheckedAndApplied(page: Page) {
  // 2.4.1 取消 flow 模块后执行导入并保持 flow 基线数据 #期望: ["imp-empire-1","logic-flow-1"]
  await ensureImportConfigWithFile(page)

  const flowCheckbox = page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"] input[type="checkbox"]')
  await flowCheckbox.uncheck()
  await page.getByTestId('storage-import-apply-btn').click()

  const after = await page.evaluate(() => {
    const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
    const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
    return { empireActive: empire.activeId, flowActive: flow.activeId }
  })

  expect(after.empireActive).toBe('imp-empire-1')
  expect(after.flowActive).toBe('logic-flow-1')
}

async function ensureImportConfigWithFile(page: Page) {
  const config = page.getByTestId('storage-import-config')
  if (await config.isVisible()) return
  await page.getByTestId('toolbar-import-btn').click()
  await page.getByTestId('storage-import-file-input').setInputFiles(fullImportPath)
}
