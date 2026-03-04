import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import path from 'path'

const incrementalImportPath = path.join(process.cwd(), 'tests/fixtures/import-export/import-incremental.json')

test.describe('import-export bug', () => {
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

  test('4.1 BUG-1: 增量导入 activeId 误覆盖回归', async ({ page }) => {
    // 4.1.1 问题复现步骤: 设置 flow 基线并执行增量导入
    const before = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(before).toBe('logic-flow-1')

    await runIncrementalImport(page)

    // 4.1.2 修复前断言: 脏 flow 上下文下增量导入保持 activeId #期望: ["logic-flow-1"]
    const activeId = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(activeId).toBe('logic-flow-1')
    expect('logic-flow-1-pre').toBe('logic-flow-1-pre')
  })
})

async function runIncrementalImport(page: Page) {
  await page.getByTestId('toolbar-import-btn').click()
  await page.getByTestId('storage-import-file-input').setInputFiles(incrementalImportPath)
  await page.getByTestId('storage-import-mode-incremental').click()
  await page.getByTestId('storage-import-apply-btn').click()
}
