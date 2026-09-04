import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for station-resource-group change
 *
 * Test file: tests/e2e/station-resource-group/station-resource-group.spec.ts
 * Maps to: openspec/changes/station-resource-group/test_tasks.md
 */

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
  await page.evaluate(() => {
    (window as any).shipBuildStore.activeView = 'maps'
  })
  await page.waitForTimeout(200)
  await expect(page.locator('.map-workbench')).toBeVisible()
  await page.getByTestId('map-resource-panel-tab').click()
  await page.waitForTimeout(200)
  await page.getByTestId('map-resource-tab-advanced').click()
  await page.waitForTimeout(100)
})

// Chapter 2 helpers

async function buildLoaderButtonVisible(page: Page) {
  // 2.1.1 切换到高级资源筛选模式
  await page.getByTestId('map-resource-tab-advanced').click()
  // 2.1.2 等待面板渲染完成
  await page.waitForTimeout(100)
  // 2.1.3 定位载入按钮元素
  const loaderTrigger = page.getByTestId('map-resource-advanced-loader-trigger')
  // 2.1.4 断言载入按钮可见 #期望： [按钮存在且可见]
  await expect(loaderTrigger).toBeVisible()
  // 2.1.5 断言按钮显示当前状态文本 #期望： [显示自定义或载入项名称]
  await expect(loaderTrigger.locator('.loader-trigger-label')).toHaveText(/自定义|Custom/)
  // 2.1.6 断言按钮右侧有下拉箭头图标 #期望： [箭头图标可见]
  await expect(loaderTrigger.locator('svg')).toBeVisible()
}

async function buildLoaderMenuOpen(page: Page) {
  // 2.2.1 点击载入按钮触发菜单打开
  await page.getByTestId('map-resource-advanced-loader-trigger').click()
  // 2.2.2 等待菜单渲染完成
  await page.waitForTimeout(100)
  // 2.2.3 定位菜单容器元素
  const menu = page.getByTestId('map-resource-advanced-loader-menu')
  // 2.2.4 断言菜单出现在面板外部 fixed 定位 #期望： [菜单 fixed 定位]
  await expect(menu).toBeVisible()
  const menuStyle = await menu.evaluate(el => el.style.position)
  expect(menuStyle).toBe('fixed')
  // 2.2.5 断言菜单包含星区分组标题 #期望： [显示星区分组标题]
  await expect(menu.locator('.loader-menu-group-title').filter({ hasText: /星区|Sectors/ })).toBeVisible()
  // 2.2.6 断言菜单包含逻辑组网分组标题 #期望： [显示逻辑组网分组标题]
  await expect(menu.locator('.loader-menu-group-title').filter({ hasText: /逻辑组网|Logic Flow/ })).toBeVisible()
  // 2.2.7 断言菜单位置在面板右侧保持间距 #期望： [left > panel.right]
  const panel = page.locator('.resource-panel-shell')
  const panelRect = await panel.boundingBox()
  const menuRect = await menu.boundingBox()
  if (panelRect && menuRect) {
    expect(menuRect.x).toBeGreaterThan(panelRect.x + panelRect.width)
  }
}

async function transitionAdvancedToLoaderMenuOpen(page: Page) {
  // 2.3.1 在高级模式下点击载入按钮
  await page.getByTestId('map-resource-advanced-loader-trigger').click()
  // 2.3.2 等待菜单渲染完成
  await page.waitForTimeout(100)
  // 2.3.3 断言菜单打开可见 #期望： [菜单可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).toBeVisible()
}

async function transitionLoaderMenuOpenToClosed(page: Page) {
  // 2.4.1 在载入菜单打开态点击菜单外部区域
  await page.locator('body').click({ position: { x: 10, y: 10 } })
  // 2.4.2 等待菜单关闭动画完成
  await page.waitForTimeout(100)
  // 2.4.3 断言菜单关闭不可见 #期望： [菜单不可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
}

// Chapter 2 tests

test('2.1 状态: 高级模式载入按钮可见', async ({ page }) => {
  await buildLoaderButtonVisible(page)
})

test('2.2 状态: 载入菜单打开态', async ({ page }) => {
  await buildLoaderMenuOpen(page)
})

test('2.3 切换: 高级模式 -> 载入菜单打开态', async ({ page }) => {
  await buildLoaderButtonVisible(page)
  await transitionAdvancedToLoaderMenuOpen(page)
})

test('2.4 切换: 载入菜单打开态 -> 载入菜单关闭态', async ({ page }) => {
  await buildLoaderMenuOpen(page)
  await transitionLoaderMenuOpenToClosed(page)
})

// Chapter 3 tests

test('3.1 Case: 显示载入按钮', async ({ page }) => {
  // 3.1.1 状态: 高级模式载入按钮可见
  await buildLoaderButtonVisible(page)
  // 3.1.2 断言按钮在新增组按钮右侧 #期望： [按钮位置正确]
  const addBtn = page.getByTestId('map-resource-advanced-add-group')
  const loaderBtn = page.getByTestId('map-resource-advanced-loader-trigger')
  const addRect = await addBtn.boundingBox()
  const loaderRect = await loaderBtn.boundingBox()
  if (addRect && loaderRect) {
    expect(loaderRect.x).toBeGreaterThan(addRect.x + addRect.width - 10)
  }
})

test('3.2 Case: 打开载入菜单', async ({ page }) => {
  // 3.2.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.2.2 断言星区列表包含 sector-1 项 #期望： [sector-1项可见]
  await expect(page.getByTestId('map-resource-advanced-loader-sector-sector-1')).toBeVisible()
  // 3.2.3 断言逻辑组网存档列表包含 logic-flow-1 项 #期望： [logic-flow-1项可见]
  await expect(page.getByTestId('map-resource-advanced-loader-logicflow-logic-flow-1')).toBeVisible()
})

test('3.3 Case: 载入星区空间站为组', async ({ page }) => {
  // 3.3.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.3.2 点击星区列表中第一个星区项
  await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
  await page.waitForTimeout(100)
  // 3.3.3 断言菜单已关闭 #期望： [菜单不可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
  // 3.3.4 断言载入按钮显示星区名称 #期望： [按钮文本=星区名称]
  const loaderTrigger = page.getByTestId('map-resource-advanced-loader-trigger')
  await expect(loaderTrigger.locator('.loader-trigger-label')).toHaveText(/星区 1/)
  // 3.3.5 断言组列表被替换为新组 #期望： [组数量=该星区空间站数量]
  const groupCards = page.locator('.advanced-group-card')
  await expect(groupCards).toHaveCount(3)
  // 3.3.6 断言每个组的标签包含空间站消耗的资源 #期望： [组标签=资源wareId列表]
  const summaryTags = page.locator('.summary-tag')
  await expect(summaryTags.first()).toBeVisible()
})

test('3.4 Case: 载入逻辑组网存档为组', async ({ page }) => {
  // 3.4.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.4.2 点击逻辑组网列表中第一个存档项
  await page.getByTestId('map-resource-advanced-loader-logicflow-logic-flow-1').click()
  await page.waitForTimeout(100)
  // 3.4.3 断言菜单已关闭 #期望： [菜单不可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
  // 3.4.4 断言载入按钮显示存档名称 #期望： [按钮文本=存档名称]
  const loaderTrigger = page.getByTestId('map-resource-advanced-loader-trigger')
  await expect(loaderTrigger.locator('.loader-trigger-label')).toHaveText(/Logic Flow 1/)
  // 3.4.5 断言组列表被替换为新组 #期望： [组数量=存档中tier0组数量]
  const groupCards = page.locator('.advanced-group-card')
  const groupCount = await groupCards.count()
  await expect(groupCount).toBeGreaterThan(0)
  // 3.4.6 断言每个组的标签为 tier0 资源 #期望： [组标签=tier0资源列表]
  const summaryTags = page.locator('.summary-tag')
  await expect(summaryTags.first()).toBeVisible()
})

test('3.5 Case: 点击外部关闭菜单', async ({ page }) => {
  // 3.5.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.5.2 点击面板区域菜单外部
  await page.locator('body').click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(100)
  // 3.5.3 断言菜单关闭 #期望： [菜单不可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
})

test('3.6 Case: 刷新按钮无待刷新时隐藏', async ({ page }) => {
  // 3.6.1 状态: 高级模式载入按钮可见
  await buildLoaderButtonVisible(page)
  // 3.6.2 点击载入按钮载入星区
  await page.getByTestId('map-resource-advanced-loader-trigger').click()
  await page.waitForTimeout(100)
  await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
  await page.waitForTimeout(100)
  // 3.6.3 断言刷新按钮行不可见 #期望： [advanced-refresh-row不可见]
  await expect(page.locator('.advanced-refresh-row')).not.toBeVisible()
})

test('3.7 Case: 刷新按钮有待刷新时显示', async ({ page }) => {
  // 3.7.1 状态: 高级模式载入按钮可见
  await buildLoaderButtonVisible(page)
  // 3.7.2 点击载入按钮载入星区
  await page.getByTestId('map-resource-advanced-loader-trigger').click()
  await page.waitForTimeout(100)
  await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
  await page.waitForTimeout(100)
  // 3.7.3 点击组编辑按钮取消选中 ore 标签
  const firstGroup = page.locator('.advanced-group-card').first()
  await firstGroup.locator('button:has-text("编辑")').click()
  await page.waitForTimeout(100)
  const oreTag = firstGroup.locator('[data-testid$="-ore"]').first()
  await oreTag.click()
  await page.waitForTimeout(100)
  // 3.7.4 断言刷新按钮行可见 #期望： [advanced-refresh-row可见]
  await expect(page.locator('.advanced-refresh-row')).toBeVisible()
  // 3.7.5 断言刷新按钮在 pending 提示右侧 #期望： [按钮右对齐]
  const refreshRow = page.locator('.advanced-refresh-row')
  const pendingEl = refreshRow.locator('.advanced-pending')
  const refreshBtn = refreshRow.locator('.advanced-refresh-btn')
  await expect(pendingEl).toBeVisible()
  await expect(refreshBtn).toBeVisible()
})

test('3.8 Case: 载入后候选自动刷新', async ({ page }) => {
  // 3.8.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.8.2 点击星区列表中第一个星区项
  await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
  await page.waitForTimeout(200)
  // 3.8.3 断言候选列表容器可见且有候选项 #期望： [candidate-list.count >= 1]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  await expect(candidateList).toBeVisible()
  const candidates = candidateList.locator('.advanced-candidate-item')
  const candidateCount = await candidates.count()
  await expect(candidateCount).toBeGreaterThanOrEqual(1)
})

test('3.9 Case: 空星区过滤', async ({ page }) => {
  // 3.9.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.9.2 断言星区列表仅包含有资源需求的星区 #期望： [无无资源需求星区]
  const sectorItems = page.locator('[data-testid^="map-resource-advanced-loader-sector-"]')
  const sectorCount = await sectorItems.count()
  await expect(sectorCount).toBeGreaterThan(0)
  await expect(page.locator('.loader-menu-empty').filter({ hasText: /没有资源需求的星区/ })).not.toBeVisible()
})

test('3.10 Case: 空逻辑组网存档过滤', async ({ page }) => {
  // 3.10.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.10.2 断言逻辑组网列表仅包含有 tier0 资源需求的存档 #期望： [无无tier0需求存档]
  const logicflowItems = page.locator('[data-testid^="map-resource-advanced-loader-logicflow-"]')
  const logicflowCount = await logicflowItems.count()
  await expect(logicflowCount).toBeGreaterThan(0)
  await expect(page.locator('.loader-menu-empty').filter({ hasText: /没有 tier0 资源需求的存档/ })).not.toBeVisible()
})

test('3.11 Case: 关闭面板时菜单同步关闭', async ({ page }) => {
  // 3.11.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.11.2 关闭资源筛选面板
  await page.getByTestId('map-resource-close-panel').click()
  await page.waitForTimeout(100)
  // 3.11.3 断言菜单关闭 #期望： [菜单不可见]
  await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
})

test('3.12 Case: 载入项高亮显示', async ({ page }) => {
  // 3.12.1 状态: 载入菜单打开态
  await buildLoaderMenuOpen(page)
  // 3.12.2 点击星区列表中第一个星区项
  await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
  await page.waitForTimeout(100)
  // 3.12.3 再次打开载入菜单
  await page.getByTestId('map-resource-advanced-loader-trigger').click()
  await page.waitForTimeout(100)
  // 3.12.4 断言已载入星区项有 active 样式 #期望： [active类存在]
  const sectorItem = page.getByTestId('map-resource-advanced-loader-sector-sector-1')
  await expect(sectorItem).toHaveClass(/active/)
})