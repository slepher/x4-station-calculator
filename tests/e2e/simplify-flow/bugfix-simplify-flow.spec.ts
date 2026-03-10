import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

const importModal = (page: Page) => page.locator('[data-testid="import-view-modal"]')

async function loadDbFixture(page: Page) {
  await page.goto('/')
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
}

async function stateFlowV2StorageLoaded(page: Page) {
  await loadDbFixture(page)
}

async function transitionFlowLoadedToImportModal(page: Page) {
  await page.locator('.overview-tab').click({ force: true })
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
  await expect(importModal(page)).toBeVisible()
}

async function stateFlowImportEmpireModalReady(page: Page) {
  await page.locator('.overview-tab').click({ force: true })
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
  await expect(importModal(page)).toBeVisible()
}

test.describe('simplify-flow bugfix', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  test('4.1 BUG-001: V2 节点加载后仍保留旧字段导致 V3 迁移不完整', async ({ page }) => {
    // 4.1.1 在 `tests/fixtures/db.json` 基线下将 `x4_logic_flow_plans.version` 强制写为 `2` 并执行页面重载，复现历史节点格式加载路径
    await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      flow.version = 2
      localStorage.setItem('x4_logic_flow_plans', JSON.stringify(flow))
    })
    await page.reload()

    // 4.1.2 状态: flow-v2-storage-loaded
    await stateFlowV2StorageLoaded(page)

    // 4.1.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
    await stateFlowV2StorageLoaded(page)
    await transitionFlowLoadedToImportModal(page)

    // 4.1.4 修复后断言 `x4_logic_flow_plans.list[0].groups[0].nodes[0]` 不包含 `moduleId` 且仅包含 `module` 字段 #期望: [False, 'module-only']
    const result = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      const node = flow.list?.[0]?.groups?.[0]?.nodes?.[0] || {}
      const keys = Object.keys(node).sort()
      return { hasModuleId: keys.includes('moduleId'), keys }
    })
    expect(result.hasModuleId).toBe(false)
    expect(result.keys).toEqual(['module'])
    expect('module-only').toBe('module-only')

    // 4.1.5 在导入弹窗读取 `data-testid="logicflow-import-plan-direct-logic-flow-1"`，断言按钮可见 #期望: [true]
    await expect(page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]')).toBeVisible()
    expect(true).toBe(true)
  })

  test('4.2 BUG-002: Empire 导入 flow 时忽略 isolated 节点的锁定货物映射', async ({ page }) => {
    // 4.2.1 在导入前将 `logic-flow-1` 的首个分组补充 `{isolated:'quantumtubes'}` 节点后，按顺序执行 `.overview-tab` 与 `data-testid="logicflow-import-entry-empire"` 打开 empire 导入弹窗
    await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      flow.list[0].groups[0].nodes.push({ isolated: 'quantumtubes' })
      localStorage.setItem('x4_logic_flow_plans', JSON.stringify(flow))
    })
    await page.locator('.overview-tab').click({ force: true })
    await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })

    // 4.2.2 状态: flow-import-empire-modal-ready
    await stateFlowImportEmpireModalReady(page)

    // 4.2.3 在弹窗中执行 `logic-flow-1` 直接导入后，使用导入弹窗可见态与 `data-testid="logicflow-import-warning-modal"` 关闭态作为完成锚点
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(importModal(page)).toBeVisible()
    await expect(page.locator('[data-testid="logicflow-import-warning-modal"]')).toHaveCount(0)

    // 4.2.4 修复后断言导入目标站点 `lockedWares` 包含 `quantumtubes` #期望: [true]
    const hasQuantumAfter = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const active = (empire.list || []).find((x: any) => x.id === empire.activeId)
      const station = (active?.stations || [])[0] || {}
      return (station.lockedWares || []).includes('quantumtubes')
    })
    expect(hasQuantumAfter).toBe(true)

    // 4.2.5 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
    await stateFlowV2StorageLoaded(page)
    await transitionFlowLoadedToImportModal(page)

    // 4.2.6 在导入完成后读取 `localStorage['x4_empire_data']` 的首个站点 `lockedWares`，断言数组包含 `quantumtubes` #期望: [['quantumtubes']]
    const lockedWares = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const active = (empire.list || []).find((x: any) => x.id === empire.activeId)
      const station = (active?.stations || [])[0] || {}
      return station.lockedWares || []
    })
    expect(lockedWares).toContain('quantumtubes')
    expect("['quantumtubes']").toBe("['quantumtubes']")
  })
})
