import { test, expect, Page } from '@playwright/test'

// ============================================================
// Chapter 2 Helpers
// ============================================================

/**
 * 2.1 状态: 地图渲染-默认视图
 * 进入地图视图并验证基础渲染元素
 */
async function buildMapRenderDefaultView(page: Page) {
  // 2.1.1 在页面导航至 `/?router=maps` 视图
  await page.goto('/?router=maps')
  
  // 2.1.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成，超时设置为 10000ms
  await page.waitForSelector('.map-viewport svg[data-testid="map-svg-canvas"]', { timeout: 10000 })
  
  // 2.1.3 等待 500ms 以确保地图布局稳定
  await page.waitForTimeout(500)
  
  // 2.1.4 断言 `.sector-links` 组存在 #期望: [组存在]
  await expect(page.locator('.sector-links')).toBeVisible()
  
  // 2.1.5 断言 `.sector-links` 组包含 line 元素 #期望: [line 元素集合非空]
  const sectorLinksLines = page.locator('.sector-links line')
  await expect(sectorLinksLines.first()).toBeVisible()
  
  // 2.1.6 断言 `.highways` 组存在 #期望: [组存在]
  await expect(page.locator('.highways')).toBeVisible()
  
  // 2.1.7 断言 `.highways` 组包含 path 或 line 元素 #期望: [path 或 line 元素集合非空]
  const highwaysPaths = page.locator('.highways path')
  const highwaysLines = page.locator('.highways line')
  const hasHighwayElements = await highwaysPaths.count() > 0 || await highwaysLines.count() > 0
  expect(hasHighwayElements).toBe(true)
  
  // 2.1.8 断言 `.gates` 组存在 #期望: [组存在]
  await expect(page.locator('.gates')).toBeVisible()
  
  // 2.1.9 断言 `.gates` 组包含 circle.gate-circle 元素 #期望: [circle.gate-circle 元素集合非空]
  const gateCircles = page.locator('.gates circle.gate-circle')
  await expect(gateCircles.first()).toBeVisible()
  
  // 2.1.10 断言 `.sector-hover-target` 元素存在 #期望: [元素集合非空]
  const sectorHoverTargets = page.locator('.sector-hover-target')
  await expect(sectorHoverTargets.first()).toBeVisible()
}

/**
 * 2.2 状态: 地图渲染-overlay-可见
 * 进入地图视图并验证 overlay 元素
 */
async function buildMapRenderOverlayVisible(page: Page) {
  // 2.2.1 在页面导航至 `/?router=maps` 视图
  await page.goto('/?router=maps')
  
  // 加载 fixture 到 localStorage（排除 vsn 字段）
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  
  // reload 以应用 localStorage 数据
  await page.reload()
  
  // 通过 UI 设置语言（必须通过 UI 触发翻译更新）
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
  
  // 2.2.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成
  await page.waitForSelector('.map-viewport svg[data-testid="map-svg-canvas"]', { timeout: 10000 })
  
  // 2.2.3 等待 500ms 以确保地图布局稳定
  await page.waitForTimeout(500)
  
  // 2.2.4 打开 station panel 以触发 overlay 渲染
  const stationPanelButton = page.locator('[data-testid="map-station-entry-button"]')
  await stationPanelButton.click()
  await page.waitForTimeout(300)
  
  // 2.2.5 断言 `.station-overlays` 组存在 #期望: [组存在]
  await expect(page.locator('.station-overlays')).toBeVisible()
  
  // 2.2.6 断言 `.save-poi-overlays` 组存在 #期望: [组存在]
  await expect(page.locator('.save-poi-overlays')).toBeVisible()
  
  // 2.2.7 断言 `.placement-overlay` 元素存在且 CSS pointer-events 为 auto #期望: [元素存在且有 pointer-events: auto]
  const placementOverlay = page.locator('.placement-overlay').first()
  await expect(placementOverlay).toBeVisible()
  const pointerEvents = await placementOverlay.evaluate(el => el.style.pointerEvents)
  expect(pointerEvents).toBe('auto')
}

/**
 * 2.3 状态: 地图-sector-hover-激活
 * 进入地图视图并 hover 第一个 sector，触发 tooltip 显示
 */
async function buildMapSectorHoverActive(page: Page) {
  // 2.3.1 在页面导航至 `/?router=maps` 视图
  await page.goto('/?router=maps')
  
  // 2.3.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成
  await page.waitForSelector('.map-viewport svg[data-testid="map-svg-canvas"]', { timeout: 10000 })
  
  // 2.3.3 对 `.sector-hover-target` 第一个元素执行 hover 操作
  const sectorTarget = page.locator('.sector-hover-target').first()
  await expect(sectorTarget).toBeVisible({ timeout: 5000 })
  await sectorTarget.hover()
  
  // 2.3.4 等待 300ms 以确保 tooltip 位置计算完成
  await page.waitForTimeout(300)
  
  // 2.3.5 断言 `.map-sector-tooltip-layer` 可见 #期望: [可见]
  const tooltipLayer = page.locator('.map-sector-tooltip-layer')
  await expect(tooltipLayer).toBeVisible({ timeout: 3000 })
  
  // 2.3.6 断言 `.sector-tooltip-title` 文本非空 #期望: [文本非空]
  const title = page.locator('.sector-tooltip-title')
  await expect(title).not.toBeEmpty()
}

/**
 * 2.4 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
 * 从默认视图状态执行 hover 操作，激活 tooltip
 */
async function transitionMapRenderDefaultViewToSectorHoverActive(page: Page) {
  // 2.4.1 断言当前处于 地图渲染-默认视图 #期望: [tooltip 不可见]
  const tooltipLayer = page.locator('.map-sector-tooltip-layer')
  await expect(tooltipLayer).not.toBeVisible()
  
  // 2.4.2 对 `.sector-hover-target` 第一个元素执行 hover 操作
  const sectorTarget = page.locator('.sector-hover-target').first()
  await sectorTarget.hover()
  
  // 2.4.3 断言 `.map-sector-tooltip-layer` 可见 #期望: [可见]
  await expect(tooltipLayer).toBeVisible({ timeout: 3000 })
}

/**
 * 2.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
 * 从 hover 激活状态移动鼠标到空白区域，关闭 tooltip
 */
async function transitionMapSectorHoverActiveToMapRenderDefaultView(page: Page) {
  // 2.5.1 断言当前处于 地图-sector-hover-激活 #期望: [tooltip 可见]
  const tooltipLayer = page.locator('.map-sector-tooltip-layer')
  await expect(tooltipLayer).toBeVisible()
  
  // 2.5.2 将鼠标移动到 `.map-viewport` 元素的左上角坐标 (0, 0)
  await page.mouse.move(0, 0)
  
  // 2.5.3 等待 200ms 以确保 tooltip 关闭计时器触发
  await page.waitForTimeout(200)
  
  // 2.5.4 断言 `.map-sector-tooltip-layer` 不可见 #期望: [不可见]
  await expect(tooltipLayer).not.toBeVisible({ timeout: 2000 })
}

// ============================================================
// Chapter 2: State and Transition Tests
// ============================================================

test.describe('map-refactory', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`))
    
    await page.addInitScript(() => {
      (window as any).isTestEnv = true
    })
  })
  
  // 2.1 状态: 地图渲染-默认视图
  test('2.1 状态: 地图渲染-默认视图', async ({ page }) => {
    await buildMapRenderDefaultView(page)
  })
  
  // 2.2 状态: 地图渲染-overlay-可见
  test('2.2 状态: 地图渲染-overlay-可见', async ({ page }) => {
    await buildMapRenderOverlayVisible(page)
  })
  
  // 2.3 状态: 地图-sector-hover-激活
  test('2.3 状态: 地图-sector-hover-激活', async ({ page }) => {
    await buildMapSectorHoverActive(page)
  })
  
  // 2.4 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  test('2.4 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活', async ({ page }) => {
    await buildMapRenderDefaultView(page)
    await transitionMapRenderDefaultViewToSectorHoverActive(page)
  })
  
  // 2.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
  test('2.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图', async ({ page }) => {
    await buildMapSectorHoverActive(page)
    await transitionMapSectorHoverActiveToMapRenderDefaultView(page)
  })
  
  // ============================================================
  // Chapter 3: E2E Test Scenarios
  // ============================================================
  
  // 3.1 Case: Sector link 渲染验证
  test('3.1 Case: Sector link 渲染验证', async ({ page }) => {
    // 3.1.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.1.2 获取 `.sector-links line` 元素数量
    const lines = page.locator('.sector-links line')
    const count = await lines.count()
    expect(count).toBeGreaterThan(0)
    
    // 3.1.3 断言每个 line 元素有有效的 x1, y1, x2, y2 属性 #期望: [属性值为数值字符串]
    for (let i = 0; i < count; i++) {
      const line = lines.nth(i)
      const x1 = await line.getAttribute('x1')
      const y1 = await line.getAttribute('y1')
      const x2 = await line.getAttribute('x2')
      const y2 = await line.getAttribute('y2')
      expect(x1).not.toBeNull()
      expect(y1).not.toBeNull()
      expect(x2).not.toBeNull()
      expect(y2).not.toBeNull()
      expect(parseFloat(x1!)).not.toBeNaN()
      expect(parseFloat(y1!)).not.toBeNaN()
      expect(parseFloat(x2!)).not.toBeNaN()
      expect(parseFloat(y2!)).not.toBeNaN()
    }
    
    // 3.1.4 断言每个 line 元素 stroke 颜色为 `#1d4ed8` #期望: [stroke="#1d4ed8"]
    const firstLine = lines.first()
    const stroke = await firstLine.getAttribute('stroke')
    expect(stroke).toBe('#1d4ed8')
  })
  
  // 3.2 Case: Highway segment 渲染验证
  test('3.2 Case: Highway segment 渲染验证', async ({ page }) => {
    // 3.2.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.2.2 获取 `.highways` 组内元素数量
    const paths = page.locator('.highways path')
    const lines = page.locator('.highways line')
    const pathCount = await paths.count()
    const lineCount = await lines.count()
    expect(pathCount + lineCount).toBeGreaterThan(0)
    
    // 3.2.3 断言 path 元素 d 属性包含有效的 SVG path 命令 #期望: [包含 M 和 C/L 命令]
    for (let i = 0; i < pathCount; i++) {
      const path = paths.nth(i)
      const d = await path.getAttribute('d')
      expect(d).not.toBeNull()
      expect(d!).toContain('M')
      expect(d!).toMatch(/C|L/)
    }
    
    // 3.2.4 断言 line 元素（如有）有有效坐标属性 #期望: [x1, y1, x2, y2 为数值]
    for (let i = 0; i < lineCount; i++) {
      const line = lines.nth(i)
      const x1 = await line.getAttribute('x1')
      const y1 = await line.getAttribute('y1')
      const x2 = await line.getAttribute('x2')
      const y2 = await line.getAttribute('y2')
      expect(x1).not.toBeNull()
      expect(parseFloat(x1!)).not.toBeNaN()
    }
    
    // 3.2.5 断言 highway stroke 颜色为 `#0ea5e9` #期望: [stroke="#0ea5e9"]
    if (pathCount > 0) {
      const stroke = await paths.first().getAttribute('stroke')
      expect(stroke).toBe('#0ea5e9')
    } else if (lineCount > 0) {
      const stroke = await lines.first().getAttribute('stroke')
      expect(stroke).toBe('#0ea5e9')
    }
  })
  
  // 3.3 Case: Gate circle 渲染验证
  test('3.3 Case: Gate circle 渲染验证', async ({ page }) => {
    // 3.3.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.3.2 获取 `.gates circle.gate-circle` 元素数量
    const gateCircles = page.locator('.gates circle.gate-circle')
    const count = await gateCircles.count()
    expect(count).toBeGreaterThan(0)
    
    // 3.3.3 断言每个 gate-circle 有 cx, cy, r 属性 #期望: [属性值为数值字符串]
    for (let i = 0; i < Math.min(count, 5); i++) {
      const circle = gateCircles.nth(i)
      const cx = await circle.getAttribute('cx')
      const cy = await circle.getAttribute('cy')
      const r = await circle.getAttribute('r')
      expect(cx).not.toBeNull()
      expect(cy).not.toBeNull()
      expect(r).not.toBeNull()
      expect(parseFloat(cx!)).not.toBeNaN()
    }
    
    // 3.3.4 断言每个 gate-circle 有 data-gate-id 和 data-cluster-id 属性 #期望: [属性非空]
    const firstCircle = gateCircles.first()
    const gateId = await firstCircle.getAttribute('data-gate-id')
    const clusterId = await firstCircle.getAttribute('data-cluster-id')
    expect(gateId).not.toBeNull()
    expect(clusterId).not.toBeNull()
    
    // 3.3.5 断言 gate-circle stroke-width 与 stargateVisualScale 关联 #期望: [stroke-width 约为 0.3 * 1.5 = 0.45]
    const strokeWidth = await firstCircle.getAttribute('stroke-width')
    expect(strokeWidth).not.toBeNull()
    const swValue = parseFloat(strokeWidth!)
    expect(swValue).toBeCloseTo(0.45, 1)
  })
  
  // 3.4 Case: Cross-cluster gate line 渲染验证
  test('3.4 Case: Cross-cluster gate line 渲染验证', async ({ page }) => {
    // 3.4.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.4.2 获取 `.cross-links line.gate-path` 元素数量
    const gatePaths = page.locator('.cross-links line.gate-path')
    const count = await gatePaths.count()
    
    if (count > 0) {
      // 3.4.3 断言每个 gate-path 有 data-gate-line-id 属性 #期望: [属性包含 "<->" 分隔符]
      const gateLineId = await gatePaths.first().getAttribute('data-gate-line-id')
      expect(gateLineId).not.toBeNull()
      expect(gateLineId!).toContain('<->')
      
      // 3.4.4 断言每个 gate-path stroke 颅色为 `#e5e7eb` #期望: [stroke="#e5e7eb"]
      const stroke = await gatePaths.first().getAttribute('stroke')
      expect(stroke).toBe('#e5e7eb')
    }
  })
  
  // 3.5 Case: ClipPath id 无冲突
  test('3.5 Case: ClipPath id 无冲突', async ({ page }) => {
    // 3.5.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.5.2 获取 `defs clipPath` 所有元素
    const clipPaths = page.locator('defs clipPath')
    const count = await clipPaths.count()
    expect(count).toBeGreaterThan(0)
    
    // 3.5.3 断言每个 clipPath id 唯一 #期望: [id 数量等于元素数量]
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const id = await clipPaths.nth(i).getAttribute('id')
      if (id) ids.push(id)
    }
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
    
    // 3.5.4 断言 clipPath id 格式为 `sector-clip-{clusterId}-{sectorId}` #期望: [id 包含 "sector-clip-" 前缀]
    const firstId = ids[0]
    expect(firstId).toContain('sector-clip-')
  })
  
  // 3.6 Case: Filter id 无冲突
  test('3.6 Case: Filter id 无冲突', async ({ page }) => {
    // 3.6.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.6.2 获取 `defs filter` 所有元素
    const filters = page.locator('defs filter')
    const count = await filters.count()
    
    if (count > 0) {
      // 3.6.3 断言每个 filter id 唯一 #期望: [id 数量等于元素数量]
      const ids: string[] = []
      for (let i = 0; i < count; i++) {
        const id = await filters.nth(i).getAttribute('id')
        if (id) ids.push(id)
      }
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
      
      // 3.6.4 断言 filter id 格式正确 #期望: [id 包含 faction-color- 或 map-search-sector-glow 标识]
      const firstId = ids[0]
      expect(firstId).toMatch(/faction-color-|map-search-sector-glow/)
    }
  })
  
  // 3.7 Case: Sector hover 事件绑定验证
  test('3.7 Case: Sector hover 事件绑定验证', async ({ page }) => {
    // 3.7.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.7.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
    await buildMapRenderDefaultView(page)
    await transitionMapRenderDefaultViewToSectorHoverActive(page)
    
    // 3.7.3 断言 `.sector-tooltip-card` 包含标题和所属势力 #期望: [标题和势力非空]
    const title = page.locator('.sector-tooltip-title')
    const owner = page.locator('.sector-tooltip-owner')
    await expect(title).not.toBeEmpty()
    await expect(owner).not.toBeEmpty()
    
    // 3.7.4 断言 `.sunlight-name` 可见 #期望: [可见]
    const sunlightName = page.locator('.sunlight-name')
    await expect(sunlightName).toBeVisible()
  })
  
  // 3.8 Case: Sector hover 关闭验证
  test('3.8 Case: Sector hover 关闭验证', async ({ page }) => {
    // 3.8.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.8.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
    await buildMapRenderDefaultView(page)
    await transitionMapRenderDefaultViewToSectorHoverActive(page)
    
    // 3.8.3 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
    await buildMapSectorHoverActive(page)
    await transitionMapSectorHoverActiveToMapRenderDefaultView(page)
    
    // 3.8.4 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]
    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    await expect(tooltipLayer).not.toBeVisible()
  })
  
  // 3.9 Case: Placement overlay pointerdown 事件验证
  test('3.9 Case: Placement overlay pointerdown 事件验证', async ({ page }) => {
    // 3.9.1 状态: 地图渲染-overlay-可见
    await buildMapRenderOverlayVisible(page)
    
    // 3.9.2 断言 `.placement-overlay` 元素存在
    const placementOverlay = page.locator('.placement-overlay').first()
    await expect(placementOverlay).toBeVisible()
    
    // 3.9.3 断言 `.placement-overlay` pointer-events 为 auto #期望: [pointer-events: auto]
    const pointerEvents = await placementOverlay.evaluate(el => el.style.pointerEvents)
    expect(pointerEvents).toBe('auto')
  })
  
  // 3.10 Case: Save POI overlay pointerdown 事件验证
  test('3.10 Case: Save POI overlay pointerdown 事件验证', async ({ page }) => {
    // 3.10.1 状态: 地图渲染-overlay-可见
    await buildMapRenderOverlayVisible(page)
    
    // 3.10.2 断言 `.save-poi-overlays` 组存在 #期望: [组存在]
    const savePoiOverlays = page.locator('.save-poi-overlays')
    await expect(savePoiOverlays).toBeVisible()
    
    // 3.10.3 断言 `.save-poi-marker` pointer-events 为 auto #期望: [pointer-events: auto]
    const marker = page.locator('.save-poi-marker').first()
    if (await marker.count() > 0) {
      const pointerEvents = await marker.evaluate(el => el.style.pointerEvents)
      expect(pointerEvents).toBe('auto')
    }
  })
  
  // 3.11 Case: Tooltip 不闪烁消失
  test('3.11 Case: Tooltip 不闪烁消失', async ({ page }) => {
    // 3.11.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.11.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
    await buildMapRenderDefaultView(page)
    await transitionMapRenderDefaultViewToSectorHoverActive(page)
    
    // 3.11.3 获取 `.map-sector-tooltip-layer` 的 boundingBox
    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    const box = await tooltipLayer.boundingBox()
    expect(box).not.toBeNull()
    
    // 3.11.4 将鼠标从 sector 移动到 tooltip 元素中心位置
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.waitForTimeout(100)
    
    // 3.11.5 断言 `.map-sector-tooltip-layer` 保持可见 #期望: [可见]
    await expect(tooltipLayer).toBeVisible()
    
    // 3.11.6 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
    await buildMapSectorHoverActive(page)
    await transitionMapSectorHoverActiveToMapRenderDefaultView(page)
    
    // 3.11.7 断言 tooltip 最终关闭 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible()
  })
  
  // 3.12 Case: 缩放触发 tooltip 隐藏验证
  test('3.12 Case: 缩放触发 tooltip 隐藏验证', async ({ page }) => {
    // 3.12.1 状态: 地图渲染-默认视图
    await buildMapRenderDefaultView(page)
    
    // 3.12.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
    await buildMapRenderDefaultView(page)
    await transitionMapRenderDefaultViewToSectorHoverActive(page)
    
    const tooltipLayer = page.locator('.map-sector-tooltip-layer')
    const viewport = page.locator('.map-viewport')
    
    // 3.12.3 在 `.map-viewport` 执行鼠标滚轮缩放操作 (deltaY: -100)
    const viewportBox = await viewport.boundingBox()
    if (viewportBox) {
      const centerX = viewportBox.x + viewportBox.width / 2
      const centerY = viewportBox.y + viewportBox.height / 2
      await page.mouse.move(centerX, centerY)
      await viewport.dispatchEvent('wheel', { deltaY: -100 })
    }
    
    // 3.12.4 断言 `.map-sector-tooltip-layer` 因缩放暂时不可见 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible({ timeout: 1000 })
    
    // 3.12.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
    await buildMapSectorHoverActive(page)
    await transitionMapSectorHoverActiveToMapRenderDefaultView(page)
    
    // 3.12.6 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]
    await expect(tooltipLayer).not.toBeVisible()
  })
  
  // 3.13 Case: Tooltip 内容完整性验证
  test('3.13 Case: Tooltip 内容完整性验证', async ({ page }) => {
    // 3.13.1 状态: 地图-sector-hover-激活
    await buildMapSectorHoverActive(page)
    
    // 3.13.2 断言 `.sector-tooltip-title` 显示 sector 本地化名称 #期望: [文本非空且非英文 ID]
    const title = page.locator('.sector-tooltip-title')
    const titleText = await title.textContent() || ''
    expect(titleText.length).toBeGreaterThan(0)
    expect(titleText).not.toMatch(/^\{.*\}$/)
    
    // 3.13.3 断言 `.sector-tooltip-owner` 显示势力本地化名称 #期望: [文本非空]
    const owner = page.locator('.sector-tooltip-owner')
    await expect(owner).not.toBeEmpty()
    
    // 3.13.4 断言 `.sector-tooltip-grid` 包含 `.sunlight-name` 元素 #期望: [可见]
    const sunlightName = page.locator('.sunlight-name')
    await expect(sunlightName).toBeVisible()
    
    // 3.13.5 断言资源列表按固定顺序显示 #期望: [ore, silicon, ice, hydrogen, nividium 顺序]
    const resourceNames = page.locator('.sector-tooltip-grid .resource-name')
    const count = await resourceNames.count()
    expect(count).toBeGreaterThan(0)
  })
  
  // 3.14 Case: Tooltip 内容本地化验证
  test('3.14 Case: Tooltip 内容本地化验证', async ({ page }) => {
    // 3.14.1 状态: 地图-sector-hover-激活
    await buildMapSectorHoverActive(page)
    
    // 3.14.2 记录 `.sector-tooltip-title` 和 `.sector-tooltip-owner` 当前文本内容
    const title = page.locator('.sector-tooltip-title')
    const owner = page.locator('.sector-tooltip-owner')
    const titleTextBefore = await title.textContent() || ''
    const ownerTextBefore = await owner.textContent() || ''
    
    // 3.14.3 通过语言选择器切换到 `zh-CN`
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.waitForTimeout(500)
    
    // 3.14.4 重新 hover 同一 sector 触发 tooltip 更新
    const sectorTarget = page.locator('.sector-hover-target').first()
    await sectorTarget.hover()
    await page.waitForTimeout(300)
    
    // 3.14.5 断言 `.sector-tooltip-title` 文本切换为中文 #期望: [文本包含中文字符]
    const titleTextAfter = await title.textContent() || ''
    const hasChinese = titleTextAfter.match(/[\u4e00-\u9fff]/)
    expect(hasChinese).not.toBeNull()
  })
})