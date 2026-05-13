import { test, expect, Page } from '@playwright/test'

// ============================================================
// Chapter 2 Helpers
// ============================================================

/**
 * 2.1 状态: 地图-资源面板打开
 */
async function buildMapResourcePanelOpen(page: Page) {
  // 2.1.1 在地图视图导航到 `/?router=maps` 路由
  await page.goto('/?router=maps')
  // 2.1.2 对 `.map-viewport svg` 等待渲染完成
  await page.waitForSelector('.map-viewport svg', { timeout: 10000 })
  await page.waitForTimeout(500)
  // 2.1.3 对 `data-testid="map-resource-entry-button"` 执行点击操作打开资源面板
  const entryButton = page.locator('[data-testid="map-resource-entry-button"]')
  await entryButton.click()
  // 2.1.4 断言 `data-testid="map-resource-panel-header"` 可见 #期望: [资源面板已展开]
  const panelHeader = page.locator('[data-testid="map-resource-panel-header"]')
  await expect(panelHeader).toBeVisible({ timeout: 5000 })
}

/**
 * 2.2 切换: 地图-资源面板打开 -> 地图-资源面板关闭
 */
async function transitionMapResourcePanelOpenToClose(page: Page) {
  // 2.2.1 状态: 地图-资源面板打开
  const panelHeader = page.locator('[data-testid="map-resource-panel-header"]')
  await expect(panelHeader).toBeVisible()
  // 2.2.2 对 `data-testid="map-resource-close-panel"` 执行点击操作关闭面板
  const closeButton = page.locator('[data-testid="map-resource-close-panel"]')
  await closeButton.click()
  // 2.2.3 断言 `data-testid="map-resource-panel-header"` 不可见 #期望: [资源面板已关闭]
  await expect(panelHeader).not.toBeVisible({ timeout: 3000 })
}

// ============================================================
// Chapter 2: State and Transition Tests
// ============================================================

test.describe('map-resource-filter', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`))
    await page.addInitScript(() => {
      (window as any).isTestEnv = true
    })
  })

  // 2.1 状态: 地图-资源面板打开
  test('2.1 状态: 地图-资源面板打开', async ({ page }) => {
    await buildMapResourcePanelOpen(page)
  })

  // 2.2 切换: 地图-资源面板打开 -> 地图-资源面板关闭
  test('2.2 切换: 地图-资源面板打开 -> 地图-资源面板关闭', async ({ page }) => {
    await buildMapResourcePanelOpen(page)
    await transitionMapResourcePanelOpenToClose(page)
  })

  // ============================================================
  // Chapter 3: E2E Test Scenarios
  // ============================================================

  // 3.1 Case: 多资源饼图渲染
  test('3.1 Case: 多资源饼图渲染', async ({ page }) => {
    // 3.1.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.1.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
    await page.locator('[data-testid="map-resource-tag-ore"]').click()
    // 3.1.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
    await page.locator('[data-testid="map-resource-tag-silicon"]').click()
    // 3.1.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内的 SVG 断言存在多个 `data-testid="resource-pie-slice"` 子元素 #期望: [pie-slice 数量 >= 2]
    const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
    const slices = sector.locator('[data-testid="resource-pie-slice"]')
    await expect(slices.first()).toBeVisible({ timeout: 3000 })
    const sliceCount = await slices.count()
    expect(sliceCount).toBeGreaterThanOrEqual(2)
    // 3.1.5 对第一个饼图切片断言 `fill` 属性为 `#CF7F54` (ore 颜色) #期望: [fill='#CF7F54']
    const firstSlice = slices.first()
    await expect(firstSlice).toHaveAttribute('fill', '#CF7F54')
  })

  // 3.2 Case: 单资源单色填充
  test('3.2 Case: 单资源单色填充', async ({ page }) => {
    // 3.2.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.2.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
    await page.locator('[data-testid="map-resource-tag-ore"]').click()
    // 3.2.3 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无 pie-slice 元素]
    const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
    const slices = sector.locator('[data-testid="resource-pie-slice"]')
    await expect(slices.first()).not.toBeVisible({ timeout: 3000 })
    // 3.2.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"] polygon` 断言 `fill` 属性为 `#CF7F54` (ore 颜色) #期望: [fill='#CF7F54']
    const polygon = sector.locator('polygon').first()
    await expect(polygon).toBeVisible()
    await expect(polygon).toHaveAttribute('fill', '#CF7F54')
  })

  // 3.3 Case: 日光单独染色
  test('3.3 Case: 日光单独染色', async ({ page }) => {
    // 3.3.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.3.2 对 `data-testid="map-resource-tag-sunlight"` 执行点击操作选中日光
    await page.locator('[data-testid="map-resource-tag-sunlight"]').click()
    // 3.3.3 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无 pie-slice 元素]
    const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
    const slices = sector.locator('[data-testid="resource-pie-slice"]')
    await expect(slices.first()).not.toBeVisible({ timeout: 3000 })
    // 3.3.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"] polygon` 断言 `fill` 属性为 `#F7D24B` (sunlight 颜色) #期望: [fill='#F7D24B']
    const polygon = sector.locator('polygon').first()
    await expect(polygon).toBeVisible()
    await expect(polygon).toHaveAttribute('fill', '#F7D24B')
  })

  // 3.4 Case: 日光混合时排除
  test('3.4 Case: 日光混合时排除', async ({ page }) => {
    // 3.4.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.4.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
    await page.locator('[data-testid="map-resource-tag-ore"]').click()
    // 3.4.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
    await page.locator('[data-testid="map-resource-tag-silicon"]').click()
    // 3.4.4 对 `data-testid="map-resource-tag-sunlight"` 执行点击操作选中日光
    await page.locator('[data-testid="map-resource-tag-sunlight"]').click()
    // 3.4.5 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言饼图切片数量为 2 #期望: [pie-slice 数量 = 2]
    const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
    const slices = sector.locator('[data-testid="resource-pie-slice"]')
    await expect(slices.first()).toBeVisible({ timeout: 3000 })
    const sliceCount = await slices.count()
    expect(sliceCount).toBe(2)
    // 3.4.6 对所有饼图切片断言 `fill` 属性均不为 `#F7D24B` (sunlight 颜色) #期望: [无 sunlight 颜色切片]
    for (let i = 0; i < sliceCount; i++) {
      const slice = slices.nth(i)
      const fill = await slice.getAttribute('fill')
      expect(fill).not.toBe('#F7D24B')
    }
  })

  // 3.5 Case: 关闭面板保留筛选状态
  test('3.5 Case: 关闭面板保留筛选状态', async ({ page }) => {
    // 3.5.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.5.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
    await page.locator('[data-testid="map-resource-tag-ore"]').click()
    // 3.5.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
    await page.locator('[data-testid="map-resource-tag-silicon"]').click()
    // 3.5.4 切换: 地图-资源面板打开 -> 地图-资源面板关闭
    await transitionMapResourcePanelOpenToClose(page)
    // 3.5.5 对 `data-testid="map-resource-entry-button"` 执行点击操作重新打开面板
    await page.locator('[data-testid="map-resource-entry-button"]').click()
    // 3.5.6 对 `data-testid="map-resource-tag-ore"` 断言包含 `selected` 类名 #期望: [ore 保持选中]
    const oreTag = page.locator('[data-testid="map-resource-tag-ore"]')
    await expect(oreTag).toHaveClass(/selected/)
    // 3.5.7 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言饼图切片数量为 2 #期望: [pie-slice 数量 = 2]
    const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
    const slices = sector.locator('[data-testid="resource-pie-slice"]')
    await expect(slices.first()).toBeVisible({ timeout: 3000 })
    const sliceCount = await slices.count()
    expect(sliceCount).toBe(2)
  })

  // 3.6 Case: 面板关闭清除高亮
  test('3.6 Case: 面板关闭清除高亮', async ({ page }) => {
    // 3.6.1 状态: 地图-资源面板打开
    await buildMapResourcePanelOpen(page)
    // 3.6.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
    await page.locator('[data-testid="map-resource-tag-ore"]').click()
    // 3.6.3 切换: 地图-资源面板打开 -> 地图-资源面板关闭
    await transitionMapResourcePanelOpenToClose(page)
    // 3.6.4 对 `.map-viewport svg` 断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无资源高亮显示]
    const slices = page.locator('.map-viewport svg [data-testid="resource-pie-slice"]')
    await expect(slices.first()).not.toBeVisible({ timeout: 3000 })
  })
})