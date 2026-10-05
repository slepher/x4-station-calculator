import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'
import { setupLogicFlow } from '../logic-flow/helpers/setupLogicFlow'
import { dragWareToTarget } from '../logic-flow/helpers/dragLogicFlow'

const ENERGY = 'module_gen_prod_energycells_01'
const HULL = 'module_gen_prod_hullparts_01'
const flow = (page: Page, id = 'energycells') => page.locator(`[data-testid="flow-wrapper"][data-resource-id="${id}"]`)
const allocation = (page: Page) => page.locator('.allocation-view .item-container').filter({ has: page.locator('.header-name[title="能量电池"]') })
const tab = (page: Page, view: string) => page.getByTestId(`view-tab-btn-station-wareflow-${view}`)
const dash = (page: Page) => page.getByTestId('station-dashboard')
const summary = (page: Page) => dash(page).locator('.module-detail').filter({ has: page.locator('.variant-summary') }).locator('.total-value')
async function addModule(page: Page, id = ENERGY) {
  await page.getByTestId('candidate-search-input').fill(id)
  await page.getByTestId(`grouped-candidate-item-${id}`).click()
}
async function setupStation(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default)); delete data.vsn
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
}
async function saveReload(page: Page, name: string) {
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await dialog.locator('.dialog-input').fill(name)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('x4_empire_data_v9')!)
    return state.list.find((item: any) => item.id === state.activeId)
  })
  expect(saved.name).toBe(name)
  expect(saved.stations).toHaveLength(1)
  await page.reload()
  await page.getByTestId('sidebar-station').click()
  return saved
}
const number = (text: string) => Number(text.replace(/[^\d.-]/g, ''))
async function energyEconomy(page: Page) {
  await tab(page, 'economy').click()
  // Independent 9.0 data: 10,500 energy / h × midpoint price 16 Cr.
  await expect(flow(page).getByTestId('flow-value')).toContainText('168,000')
  await expect(flow(page).getByTestId('flow-value')).toContainText('Cr')
}

test.describe('Ware Flow View Modes', () => {
  test.beforeEach(async ({ page }) => { await setupStation(page); await addModule(page) })
  test('Title Style Verification', async ({ page }) => {
    await expect(page.locator('.list-wrapper .header-title')).toHaveText('资源视图')
    await expect(page.locator('.list-wrapper .header-title')).toHaveCSS('font-weight', '700')
  })
  test('Switcher Button Style Verification', async ({ page }) => {
    await expect(tab(page, 'quantity')).toHaveClass(/active/)
    for (const view of ['economy', 'volume', 'transport']) {
      await expect(tab(page, view)).toBeVisible(); await expect(tab(page, view)).not.toHaveClass(/active/)
    }
  })
  test('3.1 View mode switching', async ({ page }) => {
    for (const [view, title] of [['economy', '经济视图'], ['volume', '材料体积'], ['transport', '运输视图'], ['quantity', '资源视图']]) {
      await tab(page, view).click()
      await expect(tab(page, view)).toHaveClass(/active/)
      await expect(page.locator('.list-wrapper .header-title')).toHaveText(title)
    }
  })
  test('UI Verification: Volume View Switch', async ({ page }) => {
    await tab(page, 'volume').click()
    await expect(allocation(page).locator('.recommended-count')).toHaveText('126,000')
    await expect(page.locator('.volume-controls-section input')).toHaveCount(3)
  })
  test('3.2 Profit analysis integration', async ({ page }) => {
    await energyEconomy(page)
    await expect(page.getByTestId('profit-val')).toContainText('168,000')
  })
  test('3.3 Resource list function', async ({ page }) => {
    await expect(flow(page).locator('.header-name')).toHaveText('能量电池')
    await expect(flow(page).getByTestId('flow-value')).toContainText('10,500')
    await flow(page).locator('.main-row').click()
    await expect(flow(page).locator('..')).toContainText('能量电池产线')
  })
  test('3.4 Layout and interaction', async ({ page }) => {
    await expect(page.getByTestId('candidate-search-input')).toBeVisible()
    await expect(page.locator('.tier-section').first().locator('.module-row')).toHaveCount(1)
    await addModule(page)
    await expect(flow(page).getByTestId('flow-value')).toContainText('21,000')
  })
  test('3.6 Economy view data display', async ({ page }) => { await energyEconomy(page) })
  test('8.1 Economy view uses wareFlowList', async ({ page }) => {
    await energyEconomy(page)
    await expect(page.getByTestId('flow-wrapper')).toHaveCount(1)
    await expect(flow(page).locator('.header-name')).toHaveText('能量电池')
  })
  test('8.7 profitTotal from wareFlowList', async ({ page }) => {
    await energyEconomy(page)
    expect(number(await page.getByTestId('profit-val').innerText())).toBe(10500 * 16)
  })
  test('8.11 Economy text i18n', async ({ page }) => {
    await page.getByTestId('language-select').selectOption('en'); await tab(page, 'economy').click()
    await expect(page.getByTestId('wareflow-group-title')).toHaveText('Product Income')
    await expect(page.locator('.list-wrapper .header-title')).toHaveText('Economy')
  })
  test('9.1 Resource view uses wareFlowList', async ({ page }) => {
    await expect(page.getByTestId('flow-wrapper')).toHaveCount(1)
    await expect(flow(page).getByTestId('flow-value')).toContainText('10,500')
  })
  test('9.5 Economy view display consistent', async ({ page }) => {
    await energyEconomy(page)
    const values = await page.getByTestId('flow-value').allTextContents()
    await tab(page, 'quantity').click(); await energyEconomy(page)
    await expect(page.getByTestId('flow-value')).toHaveText(values)
  })
  test('I18n Verification', async ({ page }) => {
    await expect(tab(page, 'transport')).toHaveText('运输视图')
    await page.getByTestId('language-select').selectOption('en')
    await expect(tab(page, 'transport')).toHaveText('Transport')
    await expect(dash(page)).toContainText('Workers Needed')
    await expect(dash(page)).toContainText('Transport Trips')
    await page.getByTestId('view-tab-btn-station-dashboard-volume').click()
    await expect(dash(page).locator('.variant-summary')).toHaveText('Total Build Volume')
  })
})

test.describe('Ware Flow Groups', () => {
  test.beforeEach(async ({ page }) => {
    await setupStation(page); await addModule(page, HULL)
    await page.locator('.toggle-chip').first().click()
    await flow(page, 'graphene').locator('.lock-btn').click()
  })
  test('Supply group display', async ({ page }) => {
    const group = page.getByTestId('wareflow-group').filter({ has: page.getByTestId('wareflow-group-title').filter({ hasText: /^补给$/ }) })
    await expect(group).toBeVisible()
    await expect(group.locator('[data-resource-id="foodrations"]')).toBeVisible()
    await expect(group.locator('[data-resource-id="medicalsupplies"]')).toBeVisible()
  })
  test('Economy view supply expenses', async ({ page }) => {
    await tab(page, 'economy').click()
    const group = page.getByTestId('wareflow-group').filter({ has: page.getByTestId('wareflow-group-title').filter({ hasText: /^补给支出$/ }) })
    await expect(group).toBeVisible()
    await expect(group.getByTestId('flow-value').first()).toContainText('Cr')
    expect(number(await flow(page, 'foodrations').getByTestId('flow-value').innerText())).toBeLessThan(0)
  })
  test('Group order: Products -> Operations -> Supply -> Resources', async ({ page }) => {
    await expect(page.getByTestId('wareflow-group-title')).toHaveText(['产品', '运营', '补给', '资源'])
  })
  test('8.2 Economy view groups: Product Income / Operational Expense / Resource Expense', async ({ page }) => {
    await tab(page, 'economy').click()
    await expect(page.getByTestId('wareflow-group-title')).toHaveText(['产品收入', '运营支出', '补给支出', '资源支出'])
    await expect(page.getByTestId('economy-group-sum')).toHaveCount(4)
  })
  test('8.4 Group sum netValue display', async ({ page }) => {
    await tab(page, 'economy').click()
    const groups = page.getByTestId('wareflow-group')
    await expect(groups).toHaveCount(4)
    for (const group of await groups.all()) {
      const rows = await group.getByTestId('flow-value').allTextContents()
      const expected = rows.map(number).reduce((sum, value) => sum + Math.abs(value), 0)
      expect(number(await group.getByTestId('economy-group-sum').innerText())).toBeCloseTo(expected, -1)
    }
  })
  test('9.3 Resource view same grouping as economy', async ({ page }) => {
    const groups = page.getByTestId('wareflow-group')
    const ids = await groups.evaluateAll(nodes => nodes.map(node => Array.from(node.querySelectorAll('[data-resource-id]')).map(row => row.getAttribute('data-resource-id'))))
    expect(ids).toHaveLength(4)
    await tab(page, 'economy').click()
    expect(await groups.evaluateAll(nodes => nodes.map(node => Array.from(node.querySelectorAll('[data-resource-id]')).map(row => row.getAttribute('data-resource-id'))))).toEqual(ids)
  })
  test('9.4 Resource view has no Cr values', async ({ page }) => {
    await expect(flow(page, 'hullparts').getByTestId('flow-value')).toBeVisible()
    await expect(page.locator('.list-wrapper')).not.toContainText('Cr')
  })
})

test.describe('Favorite Button & Priority', () => {
  test.beforeEach(async ({ page }) => { await setupStation(page); await addModule(page); await addModule(page, HULL) })
  test('1.1 FavoriteButton 3-state icon render', async ({ page }) => {
    await expect(flow(page).locator('.favorite-btn svg')).toHaveAttribute('fill', 'currentColor')
    await expect(flow(page, 'graphene').locator('.favorite-btn svg')).toHaveAttribute('fill', 'none')
    await flow(page).locator('.favorite-btn').click()
    await expect(flow(page).locator('.favorite-btn linearGradient')).toHaveCount(1)
  })
  test('1.2 FavoriteButton state cycle', async ({ page }) => {
    const planned = flow(page).locator('.favorite-btn'), automatic = flow(page, 'graphene').locator('.favorite-btn')
    for (const level of [1, 2]) { await planned.click(); await expect(planned).toHaveClass(new RegExp(`level-${level}`)) }
    for (const level of [1, 0]) { await automatic.click(); await expect(automatic).toHaveClass(new RegExp(`level-${level}`)) }
  })
  test('1.3 FavoriteButton across view modes', async ({ page }) => {
    await flow(page).locator('.favorite-btn').click()
    for (const view of ['economy', 'volume', 'quantity']) {
      await tab(page, view).click()
      const row = view === 'volume' ? allocation(page) : flow(page)
      await expect(row.locator('.favorite-btn')).toHaveClass(/level-1/)
      await expect(row.locator('.favorite-btn')).toHaveCount(1)
    }
  })
  test('Button visible but disabled for pure input solid wares (Ore)', async ({ page }) => {
    const button = flow(page, 'ore').locator('.favorite-btn')
    await expect(button).toBeVisible(); await expect(button).toHaveClass(/disabled/)
    await button.click(); await expect(button).toHaveClass(/level-0/)
  })
  test('Button visible for produced wares (Energy Cells)', async ({ page }) => {
    await expect(flow(page).locator('.favorite-btn')).toBeVisible()
    await expect(flow(page).locator('.favorite-btn')).not.toHaveClass(/disabled/)
  })
  test('2.1 Product identity detection', async ({ page }) => {
    await expect(flow(page).locator('.favorite-btn')).toHaveClass(/level-2/)
    await expect(flow(page, 'hullparts').locator('.favorite-btn')).toHaveClass(/level-2/)
    await expect(flow(page, 'graphene').locator('.favorite-btn')).toHaveClass(/level-0/)
  })
  test('2.2 Priority state persistence', async ({ page }) => {
    await flow(page).locator('.favorite-btn').click()
    const saved = await saveReload(page, 'M7.3 Priority')
    expect(saved.stations[0].warePriority.energycells).toBe(1)
    await expect(flow(page).locator('.favorite-btn')).toHaveClass(/level-1/)
  })
  test('4.1 Integration workflow', async ({ page }) => {
    await flow(page, 'graphene').locator('.lock-btn').click()
    await expect(flow(page, 'graphene').locator('.lock-btn')).toHaveClass(/is-locked/)
    await flow(page).locator('.favorite-btn').click()
    await saveReload(page, 'M7.3 Flow workflow')
    await expect(flow(page, 'graphene').locator('.lock-btn')).toHaveClass(/is-locked/)
    await expect(flow(page).locator('.favorite-btn')).toHaveClass(/level-1/)
  })
  test('FavoriteButton availability in economy and volume views', async ({ page }) => {
    for (const view of ['economy', 'volume']) {
      await tab(page, view).click()
      const row = view === 'volume' ? allocation(page) : flow(page)
      await row.locator('.favorite-btn').click()
      await expect(row.locator('.favorite-btn')).toHaveClass(new RegExp(view === 'economy' ? 'level-1' : 'level-2'))
    }
  })
})

test.describe('Volume View', () => {
  test.describe('Station Dashboard Volume', () => {
    test.beforeEach(async ({ page }) => {
      await setupStation(page); await addModule(page)
      await page.getByTestId('view-tab-btn-station-dashboard-volume').click()
    })
    test('Stats Bar Layout and Colors', async ({ page }) => {
      await expect(dash(page).locator('.stat-item')).toHaveCount(6)
      await expect(dash(page).getByTestId('cost-stat').locator('.stat-value')).toHaveCSS('color', 'rgb(248, 113, 113)')
      await expect(dash(page).locator('.stat-value').nth(1)).toHaveCSS('color', 'rgb(96, 165, 250)')
      await expect(dash(page).locator('.stat-value').nth(2)).toHaveCSS('color', 'rgb(52, 211, 153)')
    })
    test('Footer Controls: Transport Capacity slider and trips', async ({ page }) => {
      const slider = dash(page).locator('.dashboard-footer input')
      await slider.press('Home'); for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
      await expect(slider).toHaveValue('10000')
      const volume = number(await summary(page).innerText())
      await expect(dash(page).locator('.stat-value').nth(4)).toHaveText(`${Math.ceil(volume / 10000)} (10K)`)
    })
    test('Data Verification: volume increases with more modules', async ({ page }) => {
      const before = number(await summary(page).innerText())
      await addModule(page)
      // Additional energy module construction: 260×24 + 951×12 + 520×1 m³.
      await expect.poll(async () => number(await summary(page).innerText())).toBe(before + 18172)
    })
    test('Persistence: transport capacity survives save and reload', async ({ page }) => {
      const slider = dash(page).locator('.dashboard-footer input')
      await slider.press('Home'); for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
      const saved = await saveReload(page, 'M7.3 Construction transport')
      expect(saved.stations[0].settings.transportShipCapacity).toBe(10000)
      await page.getByTestId('view-tab-btn-station-dashboard-volume').click()
      await expect(dash(page).locator('.dashboard-footer input')).toHaveValue('10000')
    })
  })
  test.describe('Volume Compression Rate', () => {
    test.beforeEach(async ({ page }) => { await setupLogicFlow(page, 'clean'); await dragWareToTarget(page, 'hullparts', 'new') })
    async function node(page: Page, ware: string) {
      const group = page.locator('.production-group').filter({ has: page.locator('.flow-node[data-ware-id="hullparts"]') })
      await expect(group).toHaveCount(1)
      return group.locator(`.flow-node[data-ware-id="${ware}"]`)
    }
    test('2.1 FlowNode displays compression rate', async ({ page }) => {
      const hull = await node(page, 'hullparts')
      // 1176×12 / (160×20 + 1120×14) = 74.745...%; energy excluded by spec.
      await expect(hull.locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveText('75%')
    })
    test('2.2 Compression rate color coding', async ({ page }) => {
      const hull = await node(page, 'hullparts')
      await expect(hull.locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveClass(/text-emerald-400/)
      await expect((await node(page, 'graphene')).locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveText('100%')
    })
    test('2.3 Isolated node hides compression rate', async ({ page }) => {
      const graphene = await node(page, 'graphene')
      await expect(graphene.locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveText('100%')
      await graphene.hover(); await graphene.getByRole('button').filter({ hasText: '✂️' }).click()
      await expect(graphene).toContainText('EXT')
      await expect(graphene.locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveCount(0)
    })
    test('2.4 T0 resource node hides compression rate', async ({ page }) => {
      const ore = await node(page, 'ore')
      await expect(ore).toBeVisible()
      await expect(ore.locator('span.font-mono').filter({ hasText: /[0-9]+%/ })).toHaveCount(0)
    })
  })
})

test.describe('Volume Analysis', () => {
  test.beforeEach(async ({ page }) => { await setupStation(page); await addModule(page); await tab(page, 'volume').click() })
  test('4.9 Volume group titles spacing', async ({ page }) => {
    const title = page.getByTestId('wareflow-group-title')
    await expect(title).toHaveText('集装箱')
    await expect(title).toHaveCSS('font-size', '14px')
    const a = await title.boundingBox(), b = await allocation(page).locator('.main-row').boundingBox()
    expect(a).not.toBeNull(); expect(b).not.toBeNull()
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height)
  })
  test('4.10 Volume title info display', async ({ page }) => {
    await expect(allocation(page).locator('.recommended-count')).toHaveText('126,000')
    await expect(allocation(page).locator('.recommended-icon')).toBeVisible()
  })
  test('Narrow storage rows keep values inside the row when expanded', async ({ page }) => {
    const row = allocation(page)
    await row.locator('.main-row').click()
    await expect(row.locator('.detail-row').first()).toBeVisible()

    for (const width of [420, 500, 600]) {
      await page.locator('.allocation-view').evaluate((element, width) => {
        element.style.width = `${width}px`
      }, width)
      const bounds = await row.evaluate(element => {
        const main = element.querySelector('.main-row')!.getBoundingClientRect()
        const recommended = element.querySelector('.recommended-block')!.getBoundingClientRect()
        const actions = element.querySelector('.flow-action-rail')!.getBoundingClientRect()
        const table = element.querySelector('.detail-table')!
        return {
          valueRight: recommended.right,
          rowRight: main.right,
          actionsLeft: actions.left,
          overflow: element.scrollWidth > element.clientWidth,
          columns: table.querySelector('.detail-head')!.children.length
        }
      })
      expect(bounds.valueRight).toBeLessThanOrEqual(bounds.rowRight)
      expect(bounds.valueRight).toBeLessThan(bounds.actionsLeft)
      expect(bounds.overflow).toBe(false)
      expect(bounds.columns).toBe(3)
      await expect(row.locator('.recommended-count')).toHaveText('126,000')
    }
  })
  test('4.11 Group header colors blend with WareFlow', async ({ page }) => {
    await expect(page.getByTestId('wareflow-group-title')).toHaveCSS('color', 'rgb(203, 213, 225)')
    await expect(allocation(page).locator('.main-row')).toHaveCSS('background-color', 'rgba(30, 41, 59, 0.4)')
  })
  test('Volume group i18n', async ({ page }) => {
    await addModule(page, HULL)
    await expect(page.getByTestId('wareflow-group-title')).toHaveText(['集装箱', '固体', '液体'])
    await page.getByTestId('language-select').selectOption('en')
    await expect(page.getByTestId('wareflow-group-title')).toHaveText(['Container', 'Solid', 'Liquid'])
  })
  test('Planning space display', async ({ page }) => {
    await expect(page.locator('.allocation-group-summary')).toContainText('126,000 m3')
  })
  test('3.8 Volume analysis feature', async ({ page }) => {
    await expect(allocation(page).locator('.recommended-count')).toHaveText('126,000')
    await allocation(page).locator('.favorite-btn').click()
    await expect(allocation(page).locator('.recommended-count')).toHaveText('21,000')
    await expect(page.locator('.allocation-group-summary')).toContainText('21,000 m3')
  })
})

test.describe('Tooltip & i18n', () => {
  test.beforeEach(async ({ page }) => { await setupStation(page); await addModule(page) })
  test('FavoriteButton tooltip display', async ({ page }) => {
    await flow(page).locator('.favorite-btn').hover()
    const tooltip = page.locator('.tippy-box:visible')
    await expect(tooltip).toContainText('主产物'); await expect(tooltip).toContainText('12h')
    await expect(tooltip).toContainText('副产物'); await expect(tooltip).toContainText('2h')
  })
  test('LockButton tooltip display', async ({ page }) => {
    await flow(page).locator('.lock-btn').hover()
    const tooltip = page.locator('.tippy-box:visible')
    await expect(tooltip).toContainText('未锁定'); await expect(tooltip).toContainText('锁定')
  })
  test('i18n tooltip key verification', async ({ page }) => {
    await page.getByTestId('language-select').selectOption('en')
    await flow(page).locator('.favorite-btn').hover()
    const tooltip = page.locator('.tippy-box:visible')
    await expect(tooltip).toContainText('Primary'); await expect(tooltip).toContainText('Secondary')
    await expect(tooltip).not.toContainText('tooltip.')
  })
  test('3.5 Internationalization language switch', async ({ page }) => {
    await page.getByTestId('language-select').selectOption('en')
    await expect(flow(page).locator('.header-name')).toHaveText('Energy Cells')
    await expect(page.locator('.list-wrapper .header-title')).toHaveText('Resource View')
    await page.getByTestId('language-select').selectOption('zh-CN')
    await expect(flow(page).locator('.header-name')).toHaveText('能量电池')
    await expect(page.locator('.list-wrapper .header-title')).toHaveText('资源视图')
  })
})
