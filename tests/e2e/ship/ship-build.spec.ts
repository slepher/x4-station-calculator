import { test, expect, type Page } from '@playwright/test'

const cards = (page: Page) => page.getByTestId('ship-build-list-column').locator('.list-item')
const names = (page: Page) => page.getByTestId('ship-build-ship-name')
async function filterTerranM(page: Page) {
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await expect(cards(page)).toHaveCount(7)
}
async function chooseKatana(page: Page) {
  await filterTerranM(page)
  await names(page).filter({ hasText: /^武士刀$/ }).click()
}
async function confirmKatana(page: Page) {
  await chooseKatana(page)
  await page.getByTestId('ship-build-confirm-ship').click()
  await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

test.describe('Ship Build View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const data = JSON.parse(JSON.stringify(fixture.default))
    delete data.vsn
    data.x4_game_version = { version: '9.0', beta: false }
    data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
    await page.evaluate((db) => {
      Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, data)
    await page.reload()
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.getByTestId('top-view-btn-ship-build').click()
    await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
  })

  test('状态：船只建造视图', async ({ page }) => {
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)
    await expect(page.getByTestId('toolbar-new-btn')).toHaveClass(/btn-emerald/)
    await expect(page.getByTestId('toolbar-save-btn')).toHaveClass(/btn-green/)
    await expect(page.getByTestId('toolbar-load-btn')).toHaveCount(0)
    for (const action of ['new', 'save', 'save-as']) {
      await expect(page.getByTestId(`toolbar-${action}-btn`)).toBeDisabled()
    }
  })

  test('切换：量化生产->船只建造', async ({ page }) => {
    await page.getByTestId('top-view-btn-blueprint-production').click()
    await expect(page.getByTestId('ship-build-selector-grid')).toHaveCount(0)
    await page.getByTestId('top-view-btn-ship-build').click()
    await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
  })

  test('场景：未选择 class 不显示列表', async ({ page }) => {
    await expect(page.getByTestId('ship-build-list-empty')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('场景：未选择 race/type 不显示列表', async ({ page }) => {
    await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
    await expect(page.getByTestId('ship-build-list-empty')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('场景：选择 class + race 显示列表', async ({ page }) => {
    await filterTerranM(page)
    await expect(names(page).filter({ hasText: /^武士刀$/ })).toBeVisible()
    await expect(names(page).filter({ hasText: /^大太刀$/ })).toBeVisible()
  })

  test('场景：选择 class + type 显示列表', async ({ page }) => {
    await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
    await page.getByTestId('ship-build-filter-type-btn-corvette').click()
    await expect(cards(page)).toHaveCount(10)
    await expect(page.getByTestId('ship-build-page-2')).toBeVisible()
  })

  test('场景：race + type 同时选择取交集', async ({ page }) => {
    await filterTerranM(page)
    await page.getByTestId('ship-build-filter-type-btn-corvette').click()
    await expect(names(page)).toHaveText(['武士刀', '大太刀'])
  })

  test('场景：type 选项随 class 联动', async ({ page }) => {
    await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
    await expect(page.getByTestId('ship-build-filter-type-btn-destroyer')).toBeVisible()
    await page.getByTestId('ship-build-filter-class-btn-ship_s').click()
    await expect(page.getByTestId('ship-build-filter-type-btn-destroyer')).toHaveCount(0)
    await expect(page.getByTestId('ship-build-filter-type-btn-fighter')).toBeVisible()
  })

  test('场景：飞船名称本地化展示', async ({ page }) => {
    await filterTerranM(page)
    await expect(names(page).filter({ hasText: /^武士刀$/ })).toBeVisible()
    await page.getByTestId('language-select').selectOption('en')
    await expect(names(page).filter({ hasText: /^Katana$/ })).toBeVisible()
  })

  test('场景：race 标签显示计数', async ({ page }) => {
    await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
    await page.getByTestId('ship-build-filter-type-btn-corvette').click()
    await expect(page.getByTestId('ship-build-filter-race-btn-terran')).toHaveText('terran(2)')
  })

  test('场景：type 标签显示计数', async ({ page }) => {
    await filterTerranM(page)
    await expect(page.getByTestId('ship-build-filter-type-btn-corvette').getByTestId('ship-build-type-count')).toHaveText('(2)')
    await expect(page.getByTestId('ship-build-filter-type-btn-miner').getByTestId('ship-build-type-count')).toHaveText('(2)')
  })

  test('场景：筛选与结果 4:6 布局 → 当前 selector 三栏 1:1:1', async ({ page }) => {
    const filter = await page.getByTestId('ship-build-filter-column').boundingBox()
    const list = await page.getByTestId('ship-build-list-column').boundingBox()
    const stats = await page.getByTestId('ship-build-panel-ship').boundingBox()
    expect(filter).not.toBeNull()
    expect(list).not.toBeNull()
    expect(stats).not.toBeNull()
    expect(Math.abs(filter!.width - list!.width)).toBeLessThan(2)
    expect(Math.abs(list!.width - stats!.width)).toBeLessThan(2)
    expect(filter!.x).toBeLessThan(list!.x)
    expect(list!.x).toBeLessThan(stats!.x)
  })

  test('场景：结果区 3 列固定宽度 → 当前中栏等宽候选', async ({ page }) => {
    await filterTerranM(page)
    const first = await cards(page).nth(0).boundingBox()
    const second = await cards(page).nth(1).boundingBox()
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first!.width).toBeCloseTo(second!.width, 0)
    expect(first!.x).toBeCloseTo(second!.x, 0)
    expect(second!.y).toBeGreaterThan(first!.y)
  })

  test('场景：列表单选与选择展示', async ({ page }) => {
    await chooseKatana(page)
    await expect(page.locator('.list-item-pending')).toHaveCount(1)
    await expect(page.locator('.list-item-pending')).toContainText('武士刀')
    await expect(page.getByTestId('ship-build-panel-ship').getByTestId('metric-value-hull')).toHaveText('12,200MJ')
    await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', '')
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)
  })

  test('场景：选择区切换与更换', async ({ page }) => {
    await confirmKatana(page)
    await page.getByTestId('ship-build-change-ship-fit-header').click()
    await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
    await expect(page.getByTestId('ship-build-view')).toHaveAttribute('data-selected-ship-id', 'ship_ter_m_corvette_01_a')
  })

  test('场景：下方三列显示规则', async ({ page }) => {
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)
    await confirmKatana(page)
    for (const panel of ['fit', 'stats', 'materials']) await expect(page.getByTestId(`ship-build-panel-${panel}`)).toBeVisible()
  })

  test('场景：已选详情高度自适应', async ({ page }) => {
    await chooseKatana(page)
    const panel = page.getByTestId('ship-build-panel-ship')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('max-height', 'none')
    expect(await panel.evaluate(el => el.clientHeight >= el.scrollHeight)).toBe(true)
  })
})
