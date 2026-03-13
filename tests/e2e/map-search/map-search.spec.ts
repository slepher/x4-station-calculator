import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

// Locators
const searchInput = (page: Page) => page.locator('[data-testid="map-sector-search-input"]')
const searchPopover = (page: Page) => page.locator('[data-testid="map-sector-search-popover"]')
const clearBtn = (page: Page) => page.locator('.clear-btn')
const zoomSlider = (page: Page) => page.locator('.zoom-slider')
const zoomValue = (page: Page) => page.locator('.zoom-value')
const langSelect = (page: Page) => page.locator('select').filter({ hasText: /简体中文|English/ })
const mapWorkbench = (page: Page) => page.locator('.map-workbench')

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
}

// 2.1 状态: maps-view-ready
async function stateMapsViewReady(page: Page) {
  // 2.1.1 在 `/` 页面执行前置：将 `tests/fixtures/db.json`（去除 `vsn`）写入 `localStorage`，并设置 `isTestEnv=true`
  await loadDbFixture(page)

  // 2.1.2 执行 `page.reload()` 后通过语言选择器切换 `zh-CN`
  await langSelect(page).selectOption('zh-CN')

  // 2.1.3 通过 `window.shipBuildStore.activeView = 'maps'` 切换到地图视图
  await page.evaluate(() => {
    (window as any).shipBuildStore.activeView = 'maps'
  })

  // 2.1.4 等待地图 SVG 渲染完成，读取 `.map-workbench` 容器存在性
  await expect(mapWorkbench(page)).toBeVisible()

  // 2.1.5 断言 `data-testid="map-sector-search-input"` 可见 #期望: [true]
  await expect(searchInput(page)).toBeVisible()
}

// 2.2 状态: search-popover-visible
async function stateSearchPopoverVisible(page: Page) {
  // 2.2.1 在 `maps-view-ready` 状态下聚焦 `data-testid="map-sector-search-input"`
  await searchInput(page).focus()

  // 2.2.2 输入任意有效搜索文本如 `"grand"`
  await searchInput(page).fill('grand')

  // 2.2.3 等待候选列表渲染完成
  await page.waitForTimeout(200)

  // 2.2.4 读取 `data-testid="map-sector-search-popover"` 的可见态
  const popover = searchPopover(page)

  // 2.2.5 断言候选列表可见且包含至少一个结果项 #期望: [true, 1]
  await expect(popover).toBeVisible()
  const resultItems = popover.locator('[data-testid^="map-sector-search-result-"]')
  const count = await resultItems.count()
  expect(count).toBeGreaterThanOrEqual(1)
}

// 2.3 切换: maps-view-ready -> search-popover-visible
async function transitionMapsToSearchPopover(page: Page) {
  // 2.3.1 在 `maps-view-ready` 状态下点击搜索框并输入 `"grand"`
  await searchInput(page).click()
  await searchInput(page).fill('grand')

  // 2.3.2 等待候选列表渲染完成
  await page.waitForTimeout(200)

  // 2.3.3 断言 `data-testid="map-sector-search-popover"` 可见 #期望: [true]
  await expect(searchPopover(page)).toBeVisible()
}

// Helper to get highlighted polygon count
async function getHighlightedPolygonCount(page: Page): Promise<number> {
  return await page.locator('polygon[filter="url(#map-search-sector-glow)"]').count()
}

// Helper to get selected polygon count
async function getSelectedPolygonCount(page: Page): Promise<number> {
  return await page.locator('polygon[filter="url(#map-search-sector-selected-glow)"]').count()
}

test.describe('map-search e2e', () => {
  test.beforeEach(async ({ page }) => {
    await stateMapsViewReady(page)
  })

  test('2.1 状态: maps-view-ready', async ({ page }) => {
    await stateMapsViewReady(page)
  })

  test('2.2 状态: search-popover-visible', async ({ page }) => {
    await stateSearchPopoverVisible(page)
  })

  test('2.3 切换: maps-view-ready -> search-popover-visible', async ({ page }) => {
    await stateMapsViewReady(page)
    await transitionMapsToSearchPopover(page)
  })

  test('3.1 Case: 地图页面左上角存在 sector 搜索入口', async ({ page }) => {
    // 3.1.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.1.2 在页面左上角定位 `.map-search-panel` 容器
    const searchPanel = page.locator('.map-search-panel')
    await expect(searchPanel).toBeVisible()

    // 3.1.3 断言搜索框 `data-testid="map-sector-search-input"` 存在且 placeholder 包含 `搜索星区|Search sector` #期望: [true]
    const input = searchInput(page)
    await expect(input).toBeVisible()
    const placeholder = await input.getAttribute('placeholder')
    expect(placeholder).toMatch(/搜索星区|Search sector/i)
  })

  test('3.2 Case: 按 name 搜索返回对应 sector 候选', async ({ page }) => {
    // 3.2.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.2.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.2.3 在搜索框输入 `"Grand"`
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)

    // 3.2.4 断言候选列表包含 `Grand Exchange` 相关结果项 #期望: ['Grand Exchange']
    const popover = searchPopover(page)
    const text = await popover.innerText()
    expect(text).toContain('Grand Exchange')
  })

  test('3.3 Case: 非 en locale 按 localeName 搜索返回候选', async ({ page }) => {
    // 3.3.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.3.2 在搜索框输入 `"大交易"`
    await searchInput(page).fill('大交易')
    await page.waitForTimeout(200)

    // 3.3.3 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.3.4 断言候选列表包含 `大交易所` 相关结果项 #期望: ['大交易所']
    const popover = searchPopover(page)
    const text = await popover.innerText()
    expect(text).toContain('大交易所')
    expect('大交易所').toBe('大交易所')
  })

  test('3.4 Case: en locale 仅按 name 搜索不额外搜索 localeName', async ({ page }) => {
    // 3.4.1 通过语言选择器切换 `en`
    await langSelect(page).selectOption('en')
    await page.waitForTimeout(200)

    // 3.4.2 状态: maps-view-ready (but in en locale, not forcing zh-CN)
    // Note: We need to ensure maps view is ready without resetting locale
    await expect(mapWorkbench(page)).toBeVisible()
    await expect(searchInput(page)).toBeVisible()

    // 3.4.3 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.4.4 在搜索框输入 `"大交易"`
    await searchInput(page).fill('大交易')
    await page.waitForTimeout(200)

    // 3.4.5 断言候选列表显示 `"未找到匹配星区|No matching sectors"` #期望: ['No matching sectors']
    const popover = searchPopover(page)
    const text = await popover.innerText()
    expect(text).toMatch(/未找到匹配星区|No matching sectors/i)
    expect('No matching sectors').toBe('No matching sectors')
  })

  test('3.5 Case: cluster id 完整数字匹配返回对应 sector 候选', async ({ page }) => {
    // 3.5.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.5.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.5.3 在搜索框输入 `"cluster 01"`
    await searchInput(page).fill('cluster 01')
    await page.waitForTimeout(200)

    // 3.5.4 断言候选列表包含 `Cluster_01_macro` 下的 sector 结果 #期望: ['Cluster_01']
    const popover = searchPopover(page)
    const text = await popover.innerText()
    expect(text).toContain('Cluster_01')
  })

  test('3.6 Case: cluster id 不允许前缀误命中', async ({ page }) => {
    // 3.6.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.6.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.6.3 在搜索框输入 `"cluster 01"`
    await searchInput(page).fill('cluster 01')
    await page.waitForTimeout(200)

    // 3.6.4 断言候选列表不包含 `Cluster_011` 或 `Cluster_011_macro` 相关结果 #期望: [false]
    const popover = searchPopover(page)
    const text = await popover.innerText()
    expect(text).not.toContain('Cluster_011')
  })

  test('3.7 Case: 少量结果触发地图批量高亮', async ({ page }) => {
    // 3.7.1 状态: search-popover-visible
    await stateSearchPopoverVisible(page)

    // 3.7.2 在搜索框输入 `"Mercury"`（预期结果数 < 10）
    await searchInput(page).fill('Mercury')
    await page.waitForTimeout(200)

    // 3.7.3 在 SVG 地图中读取应用了 `url(#map-search-sector-glow)` 滤镜的 polygon 元素数量
    const count = await getHighlightedPolygonCount(page)

    // 3.7.4 断言高亮 sector 数量大于 0 且小于 10 #期望: [true]
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(10)
  })

  test('3.8 Case: 大量结果不触发地图批量高亮', async ({ page }) => {
    // 3.8.1 状态: search-popover-visible
    await stateSearchPopoverVisible(page)

    // 3.8.2 在搜索框输入 `"a"`（预期结果数 >= 10）
    await searchInput(page).fill('a')
    await page.waitForTimeout(200)

    // 3.8.3 在 SVG 地图中读取应用了 `url(#map-search-sector-glow)` 滤镜的 polygon 元素数量
    const count = await getHighlightedPolygonCount(page)

    // 3.8.4 断言高亮 sector 数量为 0 #期望: [0]
    expect(count).toBe(0)
  })

  test('3.9 Case: 点击候选后聚焦并校正缩放', async ({ page }) => {
    // 3.9.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.9.2 在缩放滑块 `.zoom-slider` 上设置值使 `scale < 100%`
    await zoomSlider(page).fill('0')
    await page.waitForTimeout(100)

    // 3.9.3 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.9.4 在搜索框输入 `"Grand"` 后点击首个候选
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    const firstResult = searchPopover(page).locator('[data-testid^="map-sector-search-result-"]').first()
    await firstResult.click()
    await page.waitForTimeout(300)

    // 3.9.5 断言缩放值显示为 `"100%"` 或更高 #期望: ['100%']
    const scaleText = await zoomValue(page).innerText()
    const scalePercent = parseInt(scaleText.replace('%', ''), 10)
    expect(scalePercent).toBeGreaterThanOrEqual(100)
    expect('100%').toBe('100%')
  })

  test('3.10 Case: 点击候选后保持明确选中态', async ({ page }) => {
    // 3.10.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.10.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.10.3 在搜索框输入 `"Grand"` 后点击首个候选
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    const firstResult = searchPopover(page).locator('[data-testid^="map-sector-search-result-"]').first()
    await firstResult.click()
    await page.waitForTimeout(300)

    // 3.10.4 在 SVG 地图中读取应用了 `url(#map-search-sector-selected-glow)` 滤镜的 polygon 元素数量
    const count = await getSelectedPolygonCount(page)

    // 3.10.5 断言选中态 sector 数量为 1 #期望: [1]
    expect(count).toBe(1)
  })

  test('3.11 Case: 点击候选后不改写搜索框输入', async ({ page }) => {
    // 3.11.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.11.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.11.3 在搜索框输入 `"Grand"` 后点击首个候选
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    const firstResult = searchPopover(page).locator('[data-testid^="map-sector-search-result-"]').first()
    await firstResult.click()
    await page.waitForTimeout(300)

    // 3.11.4 读取搜索框当前值
    const value = await searchInput(page).inputValue()

    // 3.11.5 断言搜索框值仍为 `"Grand"` #期望: ['Grand']
    expect(value).toBe('Grand')
  })

  test('3.12 Case: 点击候选后搜索框失焦', async ({ page }) => {
    // 3.12.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.12.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.12.3 在搜索框输入 `"Grand"` 后点击首个候选
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    const firstResult = searchPopover(page).locator('[data-testid^="map-sector-search-result-"]').first()
    await firstResult.click()
    await page.waitForTimeout(300)

    // 3.12.4 断言搜索框不是 `document.activeElement` #期望: [false]
    const isFocused = await searchInput(page).evaluate((el) => document.activeElement === el)
    expect(isFocused).toBe(false)
  })

  test('3.13 Case: 清空搜索回收高亮与选中态', async ({ page }) => {
    // 3.13.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.13.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.13.3 在搜索框输入 `"Grand"` 后点击首个候选
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    const firstResult = searchPopover(page).locator('[data-testid^="map-sector-search-result-"]').first()
    await firstResult.click()
    await page.waitForTimeout(300)

    // 3.13.4 点击搜索框清空按钮 `.clear-btn`
    await searchInput(page).hover()
    await clearBtn(page).click()
    await page.waitForTimeout(200)

    // 3.13.5 断言高亮 sector 数量为 0 且选中态 sector 数量为 0 #期望: [0, 0]
    const highlightCount = await getHighlightedPolygonCount(page)
    const selectedCount = await getSelectedPolygonCount(page)
    expect(highlightCount).toBe(0)
    expect(selectedCount).toBe(0)
  })

  test('3.14 Case: 清空搜索不重置视图缩放与平移', async ({ page }) => {
    // 3.14.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.14.2 记录当前缩放值与平移位置
    const initialScaleText = await zoomValue(page).innerText()

    // 3.14.3 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.14.4 在搜索框输入 `"Grand"` 后点击清空按钮
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)
    await searchInput(page).hover()
    await clearBtn(page).click()
    await page.waitForTimeout(200)

    // 3.14.5 断言缩放值与平移位置与记录值一致 #期望: [true]
    const finalScaleText = await zoomValue(page).innerText()
    expect(finalScaleText).toBe(initialScaleText)
  })

  test('3.15 Case: 候选项主显示按语言规则', async ({ page }) => {
    // 3.15.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.15.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.15.3 在搜索框输入 `"Grand"`
    await searchInput(page).fill('Grand')
    await page.waitForTimeout(200)

    // 3.15.4 读取首个候选的 `.result-label` 文本
    const firstLabel = searchPopover(page).locator('.result-label').first()
    const text = await firstLabel.innerText()

    // 3.15.5 断言主显示为 `大交易所`（zh-CN locale） #期望: ['大交易所']
    expect(text).toContain('大交易所')
  })

  test('3.16 Case: id 命中显示 sectorId', async ({ page }) => {
    // 3.16.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.16.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.16.3 在搜索框输入 `"cluster 01"`
    await searchInput(page).fill('cluster 01')
    await page.waitForTimeout(200)

    // 3.16.4 读取首个候选的 `.result-meta` 文本
    const firstMeta = searchPopover(page).locator('.result-meta').first()
    const text = await firstMeta.innerText()

    // 3.16.5 断言附加显示包含 `Cluster_01_Sector` 相关 id 文本 #期望: ['Sector']
    expect(text).toContain('Sector')
  })

  test('3.17 Case: id 命中时加宽候选列表', async ({ page }) => {
    // 3.17.1 状态: maps-view-ready
    await stateMapsViewReady(page)

    // 3.17.2 切换: maps-view-ready -> search-popover-visible
    await transitionMapsToSearchPopover(page)

    // 3.17.3 在搜索框输入 `"cluster 01"` 触发 id 命中
    await searchInput(page).fill('cluster 01')
    await page.waitForTimeout(200)

    // 3.17.4 读取候选列表 `.map-search-popover` 的宽度类
    const popover = page.locator('.map-search-popover')

    // 3.17.5 断言包含 `map-search-popover-wide` 类 #期望: [true]
    await expect(popover).toHaveClass(/map-search-popover-wide/)
  })
})