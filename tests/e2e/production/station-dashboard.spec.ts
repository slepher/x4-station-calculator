import { expect, type Page, type Locator } from '@playwright/test'
import { test } from '../../test-setup'

const ENERGY = 'module_gen_prod_energycells_01'
const HULL = 'module_gen_prod_hullparts_01'
const dashboard = (page: Page) => page.getByTestId('station-dashboard')
const summary = (page: Page) => dashboard(page).locator('.module-detail').filter({ has: page.locator('.variant-summary') })
const energyModule = (page: Page) => dashboard(page).locator('.module-detail').filter({ has: page.locator('.variant-module .name').filter({ hasText: /^能量电池产线$/ }) })
const allocation = (page: Page) => page.locator('.allocation-view .item-container').filter({ has: page.locator('.header-name[title="能量电池"]') })
const buffer = (page: Page, label: string) => page.locator('.volume-controls-section .slider-container').filter({ has: page.locator('.slider-label').filter({ hasText: label }) }).locator('input')
async function range(slider: Locator, value: number) {
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < value; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(value))
}
async function addModule(page: Page, id = ENERGY) {
  await page.getByTestId('candidate-search-input').fill(id)
  await page.getByTestId(`grouped-candidate-item-${id}`).click()
}
async function volume(page: Page) {
  await page.getByTestId('view-tab-btn-station-wareflow-volume').click()
  await expect(allocation(page).locator('.recommended-count')).toHaveText('126,000')
}
async function doubledBuffer(page: Page) {
  await volume(page)
  await range(buffer(page, '主产物缓冲时间'), 24)
  await expect(allocation(page).locator('.recommended-count')).toHaveText('252,000')
}
function numeric(text: string) { return Number(text.replace(/[^\d.-]/g, '')) }

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
})

test.describe('Station Dashboard - Basic Rendering', () => {
  test('should render dashboard container with header title and view mode switcher', async ({ page }) => {
    await expect(dashboard(page)).toBeVisible()
    const title = dashboard(page).locator('.header-title')
    const tabs = page.getByTestId('view-tab-btn-station-dashboard-materials')
    await expect(title).toBeVisible()
    await expect(tabs).toBeVisible()
    const a = await title.boundingBox(), b = await tabs.boundingBox()
    expect(a).not.toBeNull(); expect(b).not.toBeNull()
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x)
  })
  test('should show Cost tab as active by default', async ({ page }) => {
    await expect(page.getByTestId('view-tab-btn-station-dashboard-materials')).toHaveClass(/active/)
    await expect(page.getByTestId('view-tab-btn-station-dashboard-time')).not.toHaveClass(/active/)
    await expect(page.getByTestId('view-tab-btn-station-dashboard-workers')).not.toHaveClass(/active/)
  })
  test('should display visual consistency for dashboard elements', async ({ page }) => {
    await addModule(page)
    await expect(summary(page).locator('.total-value')).toHaveCSS('color', 'rgb(248, 113, 113)')
    await expect(dashboard(page).locator('.variant-module .symbol').first()).toHaveCSS('opacity', '0.3')
  })
})

test.describe('Station Dashboard - Build Cost', () => {
  test.beforeEach(async ({ page }) => { await addModule(page) })
  test('should display cost summary with total value and material list', async ({ page }) => {
    expect(numeric(await summary(page).locator('.total-value').innerText())).toBeGreaterThan(0)
    await summary(page).locator('.main-row').click()
    await expect(summary(page).locator('.material-name .name')).toHaveText(['电子黏土', '船体部件', '能量电池'])
  })
  test('should group modules with quantity and allow expansion', async ({ page }) => {
    await expect(energyModule(page).locator('.count')).toHaveText('1')
    await energyModule(page).locator('.main-row').click()
    // Independent static 9.0 recipe: 260 claytronics, 951 hull parts, 520 energy cells.
    await expect(energyModule(page).locator('.material-name .qty')).toHaveText(['260', '951', '520'])
  })
  test('should update total cost when price multiplier slider changes', async ({ page }) => {
    const old = numeric(await summary(page).locator('.total-value').innerText())
    await dashboard(page).locator('.dashboard-footer input[type=range]').press('End')
    await expect.poll(async () => numeric(await summary(page).locator('.total-value').innerText())).toBeGreaterThan(old)
  })
  test('should merge identical modules and maintain addition order', async ({ page }) => {
    await addModule(page); await addModule(page, HULL)
    await expect(energyModule(page).locator('.count')).toHaveText('2')
    const names = await dashboard(page).locator('.variant-module .name').allTextContents()
    expect(names.indexOf('能量电池产线')).toBeLessThan(names.indexOf('船体部件产线'))
    expect(names.filter(n => n === '能量电池产线')).toHaveLength(1)
  })
  test('should sort materials by tier with Energy Cells at end', async ({ page }) => {
    await summary(page).locator('.main-row').click()
    await expect(summary(page).locator('.material-name .name')).toHaveText(['电子黏土', '船体部件', '能量电池'])
  })
  test('should aggregate identical modules with correct summary', async ({ page }) => {
    await addModule(page)
    await expect(energyModule(page).locator('.count')).toHaveText('2')
    await energyModule(page).locator('.main-row').click()
    await expect(energyModule(page).locator('.material-name .qty')).toHaveText(['520', '1,902', '1,040'])
    const moduleValues = await dashboard(page).locator('.module-detail').filter({ has: page.locator('.variant-module') }).locator('.total-value').allTextContents()
    expect(numeric(await summary(page).locator('.total-value').innerText())).toBe(moduleValues.map(numeric).reduce((a, b) => a + b, 0))
  })
  test('should sort materials by tier descending with valid quantities', async ({ page }) => {
    await energyModule(page).locator('.main-row').click()
    await expect(energyModule(page).locator('.material-name .name')).toHaveText(['电子黏土', '船体部件', '能量电池'])
    await expect(energyModule(page).locator('.material-name .qty')).toHaveText(['260', '951', '520'])
  })
  test('should display economy view price sliders in flex-row layout', async ({ page }) => {
    await page.getByTestId('view-tab-btn-station-wareflow-economy').click()
    await expect(page.locator('.profit-section .slider-container')).toHaveCount(2)
    await expect(page.locator('.profit-section .simulation-controls')).toHaveCSS('flex-direction', 'row')
  })
})

test.describe('Station Dashboard - Volume Analysis', () => {
  test.beforeEach(async ({ page }) => { await addModule(page) })
  test('should switch to volume view and display volume controls section', async ({ page }) => {
    await volume(page); await expect(page.locator('.volume-controls-section')).toBeVisible()
  })
  test('should display volume data with sliders indicating buffer calculation', async ({ page }) => {
    await volume(page)
    await expect(page.locator('.volume-controls-section input')).toHaveCount(3)
    await expect(buffer(page, '主产物缓冲时间')).toHaveValue('12')
  })
  test('should update volume when buffer time changes', async ({ page }) => { await doubledBuffer(page) })
  test('should display total occupied volume with priority-based buffer', async ({ page }) => {
    await volume(page)
    // Single energy output: 10,500 / h × 12 h × 1 m³.
    await expect(allocation(page).locator('.recommended-count')).toHaveText('126,000')
  })
  test('should affect volume when priority changes', async ({ page }) => {
    await volume(page)
    await allocation(page).locator('.favorite-btn').click()
    await expect(allocation(page).locator('.recommended-count')).toHaveText('21,000')
  })
  test('should maintain consistent flex-row layout between volume and economy views', async ({ page }) => {
    await volume(page)
    await expect(page.locator('.volume-controls-section .simulation-controls')).toHaveCSS('flex-direction', 'row')
    await page.getByTestId('view-tab-btn-station-wareflow-economy').click()
    await expect(page.locator('.profit-section .simulation-controls')).toHaveCSS('flex-direction', 'row')
  })
})

test.describe('Station Dashboard - Workforce', () => {
  test('should display workforce stats bar with workers needed', async ({ page }) => {
    await addModule(page)
    await expect(dashboard(page).locator('.stat-item').filter({ hasText: '工人需求' }).locator('.stat-value')).toHaveText('90')
  })
  test('should show workforce option in auto-industry header', async ({ page }) => {
    await addModule(page)
    // station-tabs moves this control to the module toolbar; exercise the same option there.
    const toggle = page.locator('.toggle-chip').first()
    await expect(toggle).toContainText('OFF')
    await toggle.click()
    await expect(toggle).toContainText('ON')
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.stationState.settings.considerWorkforceForAutoFill)).toBe(true)
  })
})

test.describe('Station Dashboard - Time View', () => {
  test('should display build time in XD HH:MM:SS format', async ({ page }) => {
    await addModule(page)
    await page.getByTestId('view-tab-btn-station-dashboard-time').click()
    // Energy module: 756 seconds. The module total is unaffected by auto infrastructure.
    await expect(energyModule(page).locator('.total-value')).toHaveText('00:12:36')
    const manual = page.locator('.tier-section').first().locator('.module-row input')
    await manual.fill('300'); await manual.press('Tab')
    await expect(energyModule(page).locator('.total-value')).toHaveText('2D 15:00:00')
  })
})

test.describe('Station Dashboard - Storage Planning', () => {
  test.beforeEach(async ({ page }) => { await addModule(page) })
  test('should display storage planning volume count in volume view', async ({ page }) => { await volume(page) })
  test('should show planning details in volume tooltip', async ({ page }) => {
    await volume(page)
    // Current allocation UI exposes the same planning explanation by expanding the row.
    await allocation(page).locator('.main-row').click()
    await expect(allocation(page).locator('.detail-row')).toContainText(['10,500/h'])
    await expect(allocation(page).locator('.list-box')).toContainText('12h 0m')
  })
  test('should increase storage slots when buffer time increases', async ({ page }) => {
    const manual = page.locator('.tier-section').first().locator('.module-row input')
    await manual.fill('10'); await manual.press('Tab')
    await page.getByTestId('view-tab-btn-station-wareflow-volume').click()
    await expect(allocation(page).locator('.recommended-count')).toHaveText('1,260,000')
    const storage = page.locator('.module-row').filter({ hasText: '集装仓储' }).getByTitle('点击转移到用户规划区')
    await expect(storage).toHaveText('2')
    await range(buffer(page, '主产物缓冲时间'), 24)
    await expect(allocation(page).locator('.recommended-count')).toHaveText('2,520,000')
    await expect(storage).toHaveText('3')
  })
})

test.describe('Station Dashboard - Buffer Controls', () => {
  test.beforeEach(async ({ page }) => { await addModule(page); await volume(page) })
  test('should display three buffer sliders in volume view', async ({ page }) => {
    await expect(page.locator('.volume-controls-section input[type=range]')).toHaveCount(3)
  })
  test('should have correct range attributes on resource buffer slider', async ({ page }) => {
    await expect(buffer(page, '资源缓冲时间')).toHaveAttribute('min', '0')
    await expect(buffer(page, '资源缓冲时间')).toHaveAttribute('max', '24')
    await expect(buffer(page, '资源缓冲时间')).toHaveAttribute('step', '1')
  })
  test('should have functional primary product buffer slider', async ({ page }) => {
    await range(buffer(page, '主产物缓冲时间'), 8)
    await expect(allocation(page).locator('.recommended-count')).toHaveText('84,000')
  })
  test('should have functional secondary product buffer slider', async ({ page }) => {
    await allocation(page).locator('.favorite-btn').click()
    await range(buffer(page, '副产物缓冲时间'), 4)
    await expect(allocation(page).locator('.recommended-count')).toHaveText('42,000')
  })
  test('should have buffer slider labels with i18n text content', async ({ page }) => {
    await page.getByTestId('language-select').selectOption('en')
    await expect(page.locator('.volume-controls-section .slider-label')).toHaveText(['Resource Buffer Hours', 'Primary Product Buffer Hours', 'Secondary Product Buffer Hours'])
  })
  test('should have slider labels with resource and product buffer text', async ({ page }) => {
    await expect(page.locator('.volume-controls-section .slider-label')).toHaveText(['资源缓冲时间', '主产物缓冲时间', '副产物缓冲时间'])
  })
  test('should affect volume calculation when buffer slider changes', async ({ page }) => {
    await range(buffer(page, '主产物缓冲时间'), 20)
    await expect(allocation(page).locator('.recommended-count')).toHaveText('210,000')
  })
})

test.describe('Station Dashboard - i18n', () => {
  test.beforeEach(async ({ page }) => { await addModule(page); await page.getByTestId('language-select').selectOption('en') })
  test('should display English labels on dashboard', async ({ page }) => {
    await expect(page.getByTestId('view-tab-btn-station-dashboard-materials')).toHaveText('Cost')
    await expect(page.getByTestId('view-tab-btn-station-dashboard-time')).toHaveText('Time')
    await expect(page.getByTestId('view-tab-btn-station-dashboard-workers')).toHaveText('Workers')
    await expect(summary(page)).toContainText('Total Build Cost')
    await expect(dashboard(page).locator('.variant-module .name').first()).toHaveText('Energy Cell Production')
  })
  test('should display English stats bar labels', async ({ page }) => {
    await expect(dashboard(page).locator('.stat-label')).toHaveCount(6)
    await expect(dashboard(page)).toContainText('Build Cost')
    await expect(dashboard(page)).toContainText('Workers Needed')
    await expect(dashboard(page)).toContainText(/Workforce Efficiency/i)
  })
  test('should display credits symbol with i18n', async ({ page }) => {
    await expect(summary(page).locator('.total-value')).toHaveText(/[\d,]+ Cr/)
    await page.getByTestId('language-select').selectOption('zh-CN')
    await expect(summary(page).locator('.total-value')).toHaveText(/[\d,]+ Cr/)
  })
})
