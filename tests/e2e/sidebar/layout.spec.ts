import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { test } from '../../test-setup'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

test.use({ viewport: { width: 1200, height: 600 } })
test.setTimeout(60000)
test.beforeEach(async ({ page }) => {
  await loadLiveBindingFixture(page)
})

async function snapshot(sidebar: Locator, testInfo: TestInfo, label: string) {
  const geometry = await sidebar.evaluate(element => {
    const origin = element.getBoundingClientRect()
    const selectors = ['.sidebar-toggle-icon', '.sidebar-row:not(.sector-header) .sidebar-item-icon', '.sidebar-fold-icon', '.sidebar-add-btn .sidebar-item-icon']
    const icons = selectors.flatMap(selector => Array.from(element.querySelectorAll<HTMLElement>(selector)).map(icon => {
      const rect = icon.getBoundingClientRect()
      const row = icon.closest<HTMLElement>('.sidebar-row')
      return { id: row?.dataset.entryId ?? selector, center: rect.x + rect.width / 2 - origin.x, y: rect.y, height: row === null ? null : row.getBoundingClientRect().height }
    }))
    const handles = Array.from(element.querySelectorAll('.station-drag-handle, .group-drag-handle')).map(handle => getComputedStyle(handle).position)
    return { icons, handles }
  })
  await testInfo.attach(label, { body: Buffer.from(JSON.stringify(geometry, null, 2)), contentType: 'application/json' })
  await sidebar.screenshot({ path: testInfo.outputPath(`${label}.png`) })
  expect(geometry.icons.length).toBeGreaterThan(4)
  for (const icon of geometry.icons) {
    expect(Math.abs(icon.center - 32), `${label}: ${icon.id} center=${icon.center}`).toBeLessThanOrEqual(0.25)
    if (icon.height !== null) expect(icon.height, `${label}: ${icon.id} row height`).toBe(36)
  }
  for (const position of geometry.handles) expect(position).toBe('absolute')
  return geometry
}

async function verifyToggle(sidebar: Locator, testInfo: TestInfo) {
  // Group expansion clicks can scroll to the bottom; compare layout from the same scroll origin.
  await sidebar.locator('.sidebar-scroll').evaluate(element => { element.scrollTop = 0 })
  await expect.poll(() => sidebar.locator('.sidebar-scroll').evaluate(element => element.scrollTop)).toBe(0)
  const expanded = await snapshot(sidebar, testInfo, 'expanded')
  await sidebar.getByTestId('sidebar-toggle').click()
  await expect(sidebar).toHaveClass(/compact/)
  const compact = await snapshot(sidebar, testInfo, 'compact')
  for (const id of ['overview', 'blueprint-recipe', 'research', 'npc-trade']) {
    const before = expanded.icons.find(icon => icon.id === id)
    if (before === undefined) continue
    const after = compact.icons.find(icon => icon.id === id)
    expect(after, id).toBeDefined()
    expect(after!.y, id).toBe(before.y)
  }
  await sidebar.getByTestId('sidebar-toggle').click()
  await expect(sidebar).not.toHaveClass(/compact/)
  const restored = await snapshot(sidebar, testInfo, 'restored')
  expect(restored.icons).toEqual(expanded.icons)
}

async function scrollWithFixedControls(page: Page, sidebar: Locator, blueprint: boolean) {
  const toggle = await sidebar.getByTestId('sidebar-toggle').boundingBox()
  const add = blueprint ? await sidebar.getByTestId('sidebar-add-station').boundingBox() : null
  const scroll = sidebar.locator('.sidebar-scroll')
  expect(await scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await scroll.hover()
  await page.mouse.wheel(0, 240)
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(80)
  expect(await sidebar.getByTestId('sidebar-toggle').boundingBox()).toEqual(toggle)
  if (blueprint) {
    expect(await sidebar.getByTestId('sidebar-add-station').boundingBox()).toEqual(add)
    const box = await sidebar.boundingBox()
    expect(Math.abs(add!.y + add!.height - box!.y - box!.height)).toBeLessThanOrEqual(0.25)
  } else {
    await expect(sidebar.getByTestId('sidebar-add-station')).toHaveCount(0)
    await expect(sidebar.getByTestId('sidebar-bind-station')).toHaveCount(0)
  }
}

test('1.1 蓝图图标对齐、切换稳定及两端按钮固定', async ({ page }, testInfo) => {
  // 1.1.1 通过 UI 切到蓝图并形成滚动溢出
  await page.getByTestId('top-view-btn-blueprint-production').click()
  const sidebar = page.getByTestId('production-sidebar')
  await expect(sidebar.getByTestId('sidebar-add-station')).toBeVisible()
  for (let index = 0; index < 14; index += 1) await sidebar.getByTestId('sidebar-add-station').click()
  await sidebar.getByTestId('sidebar-overview').locator('.sidebar-nav').click()
  // 1.1.2 展开坐标、行高、拖拽手柄与当前行外观
  await snapshot(sidebar, testInfo, 'initial')
  expect(await sidebar.getByTestId('sidebar-overview').evaluate(element => getComputedStyle(element).boxShadow)).toBe('none')
  // 1.1.3 UI 收起并展开，比较实际坐标
  await verifyToggle(sidebar, testInfo)
  // 1.1.4 真实滚轮滚动不移动顶部／底部按钮
  await scrollWithFixedControls(page, sidebar, true)
})

test('1.2 实况图标与分组对齐、切换稳定及顶部按钮固定', async ({ page }, testInfo) => {
  // 1.2.1 fixture 初始化由 beforeEach 完成，通过 UI 展开现有组
  const sidebar = page.getByTestId('production-sidebar')
  await expect(sidebar.getByTestId('sidebar-sector-toggle').first()).toBeVisible()
  for (const toggle of await sidebar.getByTestId('sidebar-sector-toggle').all()) {
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  }
  await expect(sidebar.getByTestId('sidebar-station').first()).toBeVisible()
  // 1.2.2 展开状态的主图标与分组箭头坐标、行高
  await snapshot(sidebar, testInfo, 'initial')
  // 1.2.3 UI 收起并展开，比较实际坐标
  await verifyToggle(sidebar, testInfo)
  // 1.2.4 真实滚轮滚动不移动顶部，无底部添加／绑定入口
  await scrollWithFixedControls(page, sidebar, false)
})

for (const compact of [false, true]) {
  test(`1.3 分组仅折叠，中转站首项导航并保留选中状态（窄侧栏=${compact}）`, async ({ page }, testInfo) => {
    const sidebar = page.getByTestId('production-sidebar')
    await sidebar.getByTestId('sidebar-overview').locator('.sidebar-nav').click()
    const header = sidebar.getByTestId('sidebar-sector').first()
    const groupId = await header.getAttribute('data-sector-id')
    const toggle = header.getByTestId('sidebar-sector-toggle')
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    if (compact) await sidebar.getByTestId('sidebar-toggle').click()
    const transit = sidebar.locator(`[data-testid="sidebar-transit"][data-sector-id="${groupId}"]`)
    await expect(transit).toBeVisible()
    const section = header.locator('..')
    expect(await section.locator('.sidebar-row').nth(1).getAttribute('data-entry-id')).toBe(`transit:${groupId}`)
    if (compact) await toggle.locator('.sidebar-fold-icon').click()
    else await toggle.locator('.sidebar-item-label').click()
    await expect(transit).toHaveCount(0)
    await expect(page.getByTestId('transit-hub-center-dashboard')).toHaveCount(0)
    await toggle.click()
    await transit.locator('.sidebar-nav').click()
    await expect(page.getByTestId('transit-hub-center-dashboard')).toBeVisible()
    await expect(transit.locator('.sidebar-nav')).toHaveAttribute('aria-current', 'page')
    await expect(header).not.toHaveClass(/(^|\s)active(\s|$)/)
    await toggle.click()
    await expect(transit).toHaveCount(0)
    await expect(page.getByTestId('transit-hub-center-dashboard')).toBeVisible()
    await toggle.click()
    await expect(transit.locator('.sidebar-nav')).toHaveAttribute('aria-current', 'page')
    for (const entry of [toggle, transit.locator('.sidebar-nav')]) {
      expect((await entry.boundingBox())!.height).toBe(32)
      const icon = entry.locator('.sidebar-fold-icon, .sidebar-item-icon')
      const box = (await icon.boundingBox())!
      expect([box.width, box.height]).toEqual([26, 26])
    }
    await sidebar.screenshot({ path: testInfo.outputPath('single-purpose-sidebar.png') })
  })
}
