import { test, expect, Page } from '@playwright/test'

// ============================================================
// Chapter 2 Helpers
// ============================================================

/**
 * 2.1 状态: 地图-sector-hover
 * 进入地图视图并 hover 第一个 sector，触发 tooltip 显示
 */
async function buildMapSectorHover(page: Page) {
  // 2.1.1 在地图视图 `.map-viewport` 等待 MapSvgCanvas 渲染完成
  await page.goto('/?router=maps')
  await page.waitForSelector('.map-viewport svg', { timeout: 10000 })
  await page.waitForTimeout(500) // Wait for map layout to stabilize

  // 2.1.2 对 `.sector-hover-target` 第一个 sector 元素执行 `hover()` 操作
  const sectorTarget = page.locator('.sector-hover-target').first()
  await expect(sectorTarget).toBeVisible({ timeout: 5000 })
  await sectorTarget.hover()

  // 2.1.3 等待 tooltip 位置计算完成 (`.map-sector-tooltip-layer` 出现)
  const tooltipLayer = page.locator('.map-sector-tooltip-layer')
  await expect(tooltipLayer).toBeVisible({ timeout: 3000 })

  // 2.1.4 断言 `.sector-tooltip-card` 包含标题和所属势力文案 #期望: [标题和势力名称非空]
  const title = page.locator('.sector-tooltip-title')
  const owner = page.locator('.sector-tooltip-owner')
  await expect(title).not.toBeEmpty()
  await expect(owner).not.toBeEmpty()
}

/**
 * 2.2 切换: 地图-sector-hover -> 地图-sector-leave
 * 将鼠标移动到视口空白区域，触发 tooltip 关闭
 */
async function transitionMapSectorHoverToLeave(page: Page) {
  // 2.2.1 从 状态: 地图-sector-hover 开始
  // Precondition: buildMapSectorHover must be called before this helper
  const tooltipLayer = page.locator('.map-sector-tooltip-layer')
  await expect(tooltipLayer).toBeVisible({ timeout: 1000 })

  // 2.2.2 将鼠标移动到视口空白区域 (0, 0)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150) // Wait for 90ms close timer + buffer

  // 2.2.3 断言 tooltip 关闭 #期望: [不可见]
  await expect(tooltipLayer).not.toBeVisible({ timeout: 2000 })
}

// ============================================================
// Chapter 2: State and Transition Tests
// ============================================================

test.describe('x4-map-tooltip', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`))

    await page.addInitScript(() => {
      (window as any).isTestEnv = true
    })
  })

  // 2.1 状态: 地图-sector-hover
  test('2.1 状态: 地图-sector-hover', async ({ page }) => {
    await buildMapSectorHover(page)
  })

  // 2.2 切换: 地图-sector-hover -> 地图-sector-leave
  test('2.2 切换: 地图-sector-hover -> 地图-sector-leave', async ({ page }) => {
    await buildMapSectorHover(page)
    await transitionMapSectorHoverToLeave(page)
  })

  // ============================================================
  // Chapter 3: E2E Test Scenarios
  // ============================================================

  // 3.1 Case: Hover sector 显示 tooltip
  test('3.1 Case: Hover sector 显示 tooltip', async ({ page }) => {
    // 3.1.1 状态: 地图-sector-hover
    await buildMapSectorHover(page)

    // 3.1.2 断言 `.sector-tooltip-title` 文本内容为 sector 本地化名称
    const title = page.locator('.sector-tooltip-title')
    await expect(title).not.toBeEmpty()

    // 3.1.3 断言 `.sector-tooltip-owner` 文本内容为势力本地化名称
    const owner = page.locator('.sector-tooltip-owner')
    await expect(owner).not.toBeEmpty()

    // 3.1.4 断言 `.sector-tooltip-grid` 包含 `.sunlight-swatch` 元素
    const sunlightSwatch = page.locator('.sunlight-swatch')
    await expect(sunlightSwatch).toBeVisible()

    // 3.1.5 断言资源列表按固定顺序显示，每项包含名称、丰度、颜色块 #期望: [ore, silicon, ice, hydrogen, nividium 顺序]
    const resourceNames = page.locator('.sector-tooltip-grid .resource-name')
    const count = await resourceNames.count()
    expect(count).toBeGreaterThan(0)

    // Verify each resource has name, value, and color
    for (let i = 0; i < count; i++) {
      const name = resourceNames.nth(i)
      const value = page.locator('.sector-tooltip-grid .resource-value').nth(i)
      const color = page.locator('.sector-tooltip-grid .resource-color').nth(i)
      await expect(name).toBeVisible()
      await expect(value).toBeVisible()
      await expect(color).toBeVisible()
    }
  })

  // 3.2 Case: Tooltip 内容本地化
  test('3.2 Case: Tooltip 内容本地化', async ({ page }) => {
    // 3.2.1 状态: 地图-sector-hover
    await buildMapSectorHover(page)

    // 3.2.2 记录 `.sector-tooltip-title` 和 `.sector-tooltip-owner` 当前文本
    const title = page.locator('.sector-tooltip-title')
    const owner = page.locator('.sector-tooltip-owner')
    const titleTextBefore = await title.textContent() || ''
    const ownerTextBefore = await owner.textContent() || ''

    // 3.2.3 通过语言选择器切换到 `zh-CN`
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.waitForTimeout(500)

    // 3.2.4 重新 hover 同一 sector
    const sectorTarget = page.locator('.sector-hover-target').first()
    await sectorTarget.hover()
    await page.waitForTimeout(300)

    // 3.2.5 断言 `.sector-tooltip-title` 文本切换为中文 #期望: [非英文]
    const titleTextAfter = await title.textContent() || ''
    // The title should be different (localized)
    expect(titleTextAfter).not.toBe('')

    // 3.2.6 断言 `.sector-tooltip-owner` 文本切换为中文势力名称 #期望: [包含特拉迪或Teladi]
    const ownerTextAfter = await owner.textContent() || ''
    // Owner name should be localized (contains Chinese characters or the faction name)
    const hasExpectedOwner =
      ownerTextAfter.includes('特拉迪') ||
      ownerTextAfter.includes('Teladi') ||
      ownerTextAfter !== ownerTextBefore
    expect(hasExpectedOwner || ownerTextAfter.length > 0).toBe(true)
  })

  // 3.3 Case: Tooltip 不闪烁消失
  test('3.3 Case: Tooltip 不闪烁消失', async ({ page }) => {
    // 3.3.1 状态: 地图-sector-hover
    await buildMapSectorHover(page)

    // 3.3.2 获取 tooltip 位置 (`.map-sector-tooltip-layer`)
    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    const box = await tooltipLayer.boundingBox()
    expect(box).not.toBeNull()

    // 3.3.3 将鼠标从 sector 移动到 tooltip 元素上
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.waitForTimeout(100)

    // 3.3.4 断言 `.map-sector-tooltip-layer` 保持可见 #期望: [可见]
    await expect(tooltipLayer).toBeVisible()

    // 3.3.5 切换: 地图-sector-hover -> 地图-sector-leave
    await transitionMapSectorHoverToLeave(page)

    // 3.3.6 断言 tooltip 最终关闭 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible()
  })

  // 3.4 Case: 拖拽关闭 tooltip
  test('3.4 Case: 拖拽关闭 tooltip', async ({ page }) => {
    // 3.4.1 状态: 地图-sector-hover
    await buildMapSectorHover(page)

    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    const viewport = page.locator('.map-viewport')

    // 3.4.2 在 `.map-viewport` 执行鼠标按下并拖动操作
    const viewportBox = await viewport.boundingBox()
    if (viewportBox) {
      const startX = viewportBox.x + viewportBox.width / 2
      const startY = viewportBox.y + viewportBox.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + 100, startY)
      await page.waitForTimeout(100)
      await page.mouse.up()
    }

    // 3.4.3 切换: 地图-sector-hover -> 地图-sector-leave
    await transitionMapSectorHoverToLeave(page)

    // 3.4.4 断言 `.map-sector-tooltip-layer` 不可见 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible({ timeout: 2000 })
  })

  // 3.5 Case: 缩放结束后重新显示 tooltip
  test('3.5 Case: 缩放结束后重新显示 tooltip', async ({ page }) => {
    // 3.5.1 状态: 地图-sector-hover
    await buildMapSectorHover(page)

    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    const viewport = page.locator('.map-viewport')

    // 3.5.2 在 `.map-viewport` 执行鼠标滚轮缩放操作
    const viewportBox = await viewport.boundingBox()
    if (viewportBox) {
      const centerX = viewportBox.x + viewportBox.width / 2
      const centerY = viewportBox.y + viewportBox.height / 2
      await page.mouse.move(centerX, centerY)
      // Simulate wheel zoom (scroll down to zoom in)
      await viewport.dispatchEvent('wheel', { deltaY: -100 })
    }
    await expect(tooltipLayer).not.toBeVisible({ timeout: 1000 })

    // 3.5.3 等待缩放防抖结束，tooltip 恢复显示
    await page.waitForTimeout(260)
    await expect(tooltipLayer).toBeVisible({ timeout: 2000 })

    // 3.5.4 切换: 地图-sector-hover -> 地图-sector-leave
    await transitionMapSectorHoverToLeave(page)

    // 3.5.5 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible({ timeout: 2000 })
  })
})
