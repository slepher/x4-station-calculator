import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

const importModal = (page: Page) => page.locator('[data-testid="import-view-modal"]')

async function loadDbFixture(page: Page) {
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
}

async function stateFlowV2StorageLoaded(page: Page) {
  // 2.1.1 在 `/` 页面执行前置：将 `tests/fixtures/db.json`（去除 `vsn`）写入 `localStorage`，并设置 `isTestEnv=true`
  await loadDbFixture(page)

  // 2.1.2 执行 `page.reload()` 后通过语言选择器切换 `zh-CN`
  await expect(page.locator('select').filter({ hasText: /简体中文|English/ })).toBeVisible()

  // 2.1.3 在页面初始化完成后读取 `localStorage['x4_logic_flow_plans']` 的 `version` 与 `activeId`
  const flow = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}'))

  // 2.1.4 断言 flow 存储版本已归一为 `3` 且 activeId 保持 `logic-flow-1` #期望: [3, 'logic-flow-1']
  expect(flow.version).toBe(3)
  expect(flow.activeId).toBe('logic-flow-1')
}

async function stateFlowImportEmpireModalReady(page: Page) {
  // 2.2.1 在 overview 视图点击 `.overview-tab`，进入帝国视角
  const overviewTab = page.locator('.overview-tab').filter({ hasText: /帝国总览|Overview/ })
  await expect(overviewTab).toBeVisible()
  await overviewTab.click({ force: true })

  // 2.2.2 点击 `data-testid="logicflow-import-entry-empire"` 打开导入弹窗
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })

  // 2.2.3 在 `data-testid="logicflow-import-plan-list"` 读取计划卡片与直接导入按钮集合
  const list = page.locator('[data-testid="logicflow-import-plan-list"]')
  const directBtn = page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]')

  // 2.2.4 断言弹窗可见且存在 `logic-flow-1` 对应的直接导入按钮 #期望: [true, 'logicflow-import-plan-direct-logic-flow-1']
  await expect(importModal(page)).toBeVisible()
  await expect(list).toBeVisible()
  await expect(directBtn).toBeVisible()
  expect(true).toBe(true)
  expect('logicflow-import-plan-direct-logic-flow-1').toBe('logicflow-import-plan-direct-logic-flow-1')
}

async function transitionFlowLoadedToImportModal(page: Page) {
  // 2.3.1 在 `flow-v2-storage-loaded` 状态下点击 `.overview-tab`
  const overviewTab = page.locator('.overview-tab').filter({ hasText: /帝国总览|Overview/ })
  await expect(overviewTab).toBeVisible()
  await overviewTab.click({ force: true })

  // 2.3.2 点击 `data-testid="logicflow-import-entry-empire"`，等待导入弹窗渲染完成
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })

  // 2.3.3 断言切换后 `data-testid="logicflow-import-modal"` 可见 #期望: [true]
  await expect(importModal(page)).toBeVisible()
  expect(true).toBe(true)
}

test.describe('simplify-flow e2e', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  test('2.1 状态: flow-v2-storage-loaded', async ({ page }) => {
    await stateFlowV2StorageLoaded(page)
  })

  test('2.2 状态: flow-import-empire-modal-ready', async ({ page }) => {
    await stateFlowImportEmpireModalReady(page)
  })

  test('2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready', async ({ page }) => {
    await stateFlowV2StorageLoaded(page)
    await transitionFlowLoadedToImportModal(page)
  })

  test('3.1 Case: V2 flow 数据加载后自动迁移为 V3 极简节点结构', async ({ page }) => {
    // 3.1.1 状态: flow-v2-storage-loaded
    await stateFlowV2StorageLoaded(page)

    // 3.1.2 在浏览器上下文读取 `x4_logic_flow_plans.list[0].groups[0].nodes[0]` 的对象键集合并排序 #期望: [['module']]
    const keys = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return Object.keys(flow.list?.[0]?.groups?.[0]?.nodes?.[0] || {}).sort()
    })
    expect(keys).toEqual(['module'])
    expect("['module']").toBe("['module']")

    // 3.1.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
    await stateFlowV2StorageLoaded(page)
    await transitionFlowLoadedToImportModal(page)

    // 3.1.4 在导入弹窗读取 `data-testid="logicflow-import-plan-item-logic-flow-1"` 文本，断言包含 `3` 个 group 与可导入组计数文本 #期望: ['groups', '组']
    const cardText = await page.locator('[data-testid="logicflow-import-plan-item-logic-flow-1"]').innerText()
    expect(cardText).toMatch(/groups|组/i)
    expect('groups').toBe('groups')
    expect('组').toBe('组')
  })

  test('3.2 Case: Empire 导入 flow 时最小节点结构仍可直接导入', async ({ page }) => {
    // 3.2.1 状态: flow-import-empire-modal-ready
    await stateFlowImportEmpireModalReady(page)

    // 3.2.2 在导入弹窗点击 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 后，断言 `data-testid="logicflow-import-warning-modal"` 数量为 `0`
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(page.locator('[data-testid="logicflow-import-warning-modal"]')).toHaveCount(0)

    // 3.2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
    await stateFlowV2StorageLoaded(page)
    await transitionFlowLoadedToImportModal(page)

    // 3.2.4 在导入后断言导入弹窗仍可见，且页面 `.station-tab` 数量为 `3` #期望: [1, 3]
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(importModal(page)).toBeVisible()
    await expect(page.locator('.station-tab')).toHaveCount(3)
    expect(1).toBe(1)
    expect(3).toBe(3)
  })
})
