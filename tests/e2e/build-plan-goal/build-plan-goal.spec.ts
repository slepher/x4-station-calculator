import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const ENERGY_CELLS = 'energycells'
const HULL_PARTS = 'hullparts'
const LOGIC_FLOW = 'logic-flow-1'
const KATANA_BLUEPRINT = 'd111f259-6c0d-f519-aa82-10829f684cbb'
const KATANA_SHIP = 'ship_ter_m_corvette_01_a'
const PLAN_1 = 'Build Plan 1'
const PLAN_2 = 'Build Plan 2'

type StoredGoal = {
  type: string
  wareId?: string
  ratePerHour?: number
  buildTimeMode?: string
  buildTime?: number
  entries?: Array<{ shipId: string; blueprintId: string; quantity: number }>
  shipyardLCount?: number
  shipyardXLCount?: number
  wharfCount?: number
}

type StoredPlan = {
  id: string
  name: string
  buildGoals: StoredGoal[]
  logicFlowPlanId: string | null
}

type StoredPlans = {
  activeId: string | null
  list: StoredPlan[]
}

const panel = (page: Page) => page.locator('.panel-card').filter({ has: page.getByTestId('build-plan-plan-menu-trigger') })
const planMenu = (page: Page) => page.getByTestId('build-plan-plan-menu')
const planTitle = (page: Page) => panel(page).locator('.panel-header > span.cursor-pointer')
const planItem = (page: Page, name: string) => planMenu(page).getByRole('button', { name, exact: true })
const planWrapper = (page: Page, name: string) => planMenu(page).locator('.plan-menu-item-wrapper').filter({ has: planItem(page, name) })

async function storedPlans(page: Page): Promise<StoredPlans> {
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_build_plan_goals') || 'null'))
  expect(state).not.toBeNull()
  return state as StoredPlans
}

async function buildPanelLoaded(page: Page) {
  await expect(panel(page)).toBeVisible()
  await expect(page.getByTestId('build-plan-plan-menu-trigger')).toBeVisible()
  await expect(page.getByTestId('candidate-search-input')).toBeVisible()
}

async function addGoal(page: Page, wareId: string) {
  await page.getByTestId('candidate-search-input').fill(wareId)
  await expect(page.getByTestId('grouped-candidate-popover')).toBeVisible()
  await expect(page.getByTestId(`grouped-candidate-item-${wareId}`)).toBeVisible()
  await page.getByTestId(`grouped-candidate-item-${wareId}`).click()
  await expect(page.getByTestId(`goal-item-${wareId}`)).toBeVisible()
}

async function addKatana(page: Page) {
  await page.getByTestId('goal-category-select').selectOption('fleet')
  const search = page.getByTestId('fleet-search-input')
  await expect(search).toBeVisible()
  await search.fill('Katana')
  await expect(page.getByTestId('fleet-search-popover')).toBeVisible()
  await expect(page.getByTestId(`fleet-result-${KATANA_BLUEPRINT}`)).toBeVisible()
  await page.getByTestId(`fleet-result-${KATANA_BLUEPRINT}`).click()
  await expect(page.getByTestId('fleet-goal-card')).toBeVisible()
}

async function openPlanMenu(page: Page) {
  await page.getByTestId('build-plan-plan-menu-trigger').click()
  await expect(planMenu(page)).toBeVisible()
}

async function createPlan(page: Page) {
  await openPlanMenu(page)
  await planMenu(page).locator('.plan-menu-item-new').click()
  await expect(planTitle(page)).toHaveText(PLAN_2)
}

async function switchPlan(page: Page, name: string) {
  await openPlanMenu(page)
  await planItem(page, name).click()
  await expect(planTitle(page)).toHaveText(name)
  await expect(planMenu(page)).toBeHidden()
}

async function deletePlan(page: Page, name: string) {
  await openPlanMenu(page)
  await expect(planWrapper(page, name)).toHaveCount(1)
  await planWrapper(page, name).locator('.plan-delete-btn').click()
}

async function selectFlow(page: Page, flowId: string) {
  await page.getByTestId('build-plan-flow-menu-trigger').click()
  await expect(page.getByTestId('build-plan-flow-menu')).toBeVisible()
  await page.getByTestId(`flow-plan-menu-item-${flowId}`).click()
  await expect(page.getByTestId('build-plan-flow-menu')).toBeHidden()
}

async function reloadAndSetEnglish(page: Page) {
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  await page.getByTestId('language-select').selectOption('en')
  await buildPanelLoaded(page)
}

test.describe('build-plan-goal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const data = JSON.parse(JSON.stringify(fixture.default))
    delete data.vsn
    data.x4_game_version = { version: '8.0', beta: false }
    data.x4_build_plan_goals = { version: 2, activeId: null, list: [] }
    await page.evaluate((initialState) => {
      Object.entries(initialState).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, data)
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('language-select').selectOption('en')
  })

  test('2.1 状态: 建造目标面板已加载', async ({ page }) => {
    await buildPanelLoaded(page)
    await expect(planTitle(page)).toHaveText('Build Plan')
    await expect(page.getByTestId('build-plan-plan-menu-trigger')).toBeVisible()
  })

  test('2.2 切换: 无目标 -> 有 production-rate 目标', async ({ page }) => {
    await buildPanelLoaded(page)
    await addGoal(page, ENERGY_CELLS)
    const goal = page.getByTestId(`goal-item-${ENERGY_CELLS}`)
    await expect(goal.locator('input')).toHaveCount(1)
    await goal.locator('input').fill('2400')
    await goal.locator('input').blur()
    expect((await storedPlans(page)).list[0].buildGoals).toEqual([{ type: 'production-rate', wareId: ENERGY_CELLS, ratePerHour: 2400 }])
    await goal.getByRole('button').click()
    await expect(goal).toHaveCount(0)
    expect((await storedPlans(page)).list[0].buildGoals).toEqual([])
  })

  test('2.3 切换: 无目标 -> 有 Fleet 目标', async ({ page }) => {
    await buildPanelLoaded(page)
    await addKatana(page)
    const fleet = page.getByTestId('fleet-goal-card')
    await expect(fleet.locator('.fleet-group')).toHaveCount(1)
    await expect(fleet.getByTestId(`fleet-entry-qty-${KATANA_BLUEPRINT}`)).toBeVisible()
    const state = await storedPlans(page)
    expect(state.list[0].buildGoals).toEqual([{
      type: 'fleet',
      buildTime: 3600,
      buildTimeMode: 'actual',
      entries: [{ shipId: KATANA_SHIP, blueprintId: KATANA_BLUEPRINT, quantity: 1 }],
      shipyardLCount: 1,
      shipyardXLCount: 1,
      wharfCount: 1,
    }])
  })

  test('2.4 切换: 有 production-rate 目标 -> 切换到其他方案', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await createPlan(page)
    await expect(page.getByTestId('goal-item-energycells')).toHaveCount(0)
    await expect(planTitle(page)).toHaveText(PLAN_2)
    await expect(planMenu(page)).toBeHidden()
  })

  test('2.5 切换: 有目标 -> 删除当前方案', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await createPlan(page)
    await deletePlan(page, PLAN_2)
    await expect(planTitle(page)).toHaveText(PLAN_1)
    await openPlanMenu(page)
    await expect(planItem(page, PLAN_2)).toHaveCount(0)
    await expect(planItem(page, PLAN_1)).toHaveCount(1)
  })

  test('2.6 切换: 有 Fleet 目标 -> 切换建造时间模式', async ({ page }) => {
    await addKatana(page)
    const fleet = page.getByTestId('fleet-goal-card')
    const ratesBefore = await fleet.getByTestId('fleet-rates').textContent()
    const mode = fleet.locator('.fleet-mode-select')
    await expect(mode).toHaveValue('actual')
    await mode.selectOption('planned')
    const buildTime = fleet.getByTestId('fleet-build-time-input').locator('input')
    await buildTime.fill('600')
    await buildTime.blur()
    await expect(buildTime).toHaveValue('600')
    expect(await fleet.getByTestId('fleet-rates').textContent()).not.toBe(ratesBefore)
    expect((await storedPlans(page)).list[0].buildGoals[0]).toMatchObject({ buildTimeMode: 'planned', buildTime: 600 })
    await mode.selectOption('actual')
    await expect(fleet.getByTestId('fleet-build-time-input')).toBeHidden()
  })

  test('2.7 切换: 有目标 -> 绑定逻辑产线方案', async ({ page }) => {
    await addGoal(page, HULL_PARTS)
    await selectFlow(page, LOGIC_FLOW)
    await expect(page.getByTestId('build-plan-flow-menu-label')).toHaveText('Logic Flow 1')
    expect((await storedPlans(page)).list[0].logicFlowPlanId).toBe(LOGIC_FLOW)
  })

  test('2.8 切换: 有目标 -> 绑定无规划产线', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await selectFlow(page, 'unplanned')
    await expect(page.getByTestId('build-plan-flow-menu-label')).toHaveText('Unplanned')
    expect((await storedPlans(page)).list[0].logicFlowPlanId).toBeNull()
  })

  test('2.9 切换: 有 Fleet 目标 -> 删除 Fleet 条目', async ({ page }) => {
    await addKatana(page)
    await page.getByTestId(`fleet-entry-remove-${KATANA_BLUEPRINT}`).click()
    await expect(page.getByTestId(`fleet-entry-remove-${KATANA_BLUEPRINT}`)).toHaveCount(0)
    await expect(page.getByTestId('fleet-goal-card')).toHaveCount(0)
    expect((await storedPlans(page)).list[0].buildGoals).toEqual([])
  })

  test('3.1 Case: 首次添加目标自动创建方案', async ({ page }) => {
    await buildPanelLoaded(page)
    await addGoal(page, ENERGY_CELLS)
    await addGoal(page, HULL_PARTS)
    const state = await storedPlans(page)
    expect(state.list).toHaveLength(1)
    expect(state.activeId).toBe(state.list[0].id)
    expect(state.list[0]).toMatchObject({ name: PLAN_1, logicFlowPlanId: LOGIC_FLOW })
    expect(state.list[0].buildGoals).toEqual([
      { type: 'production-rate', wareId: ENERGY_CELLS, ratePerHour: 10500 },
      { type: 'production-rate', wareId: HULL_PARTS, ratePerHour: 1176 },
    ])
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
    await expect(page.getByTestId('goal-item-hullparts')).toBeVisible()
  })

  test('3.2 Case: 方案菜单切换与目标恢复', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await createPlan(page)
    const title = planTitle(page)
    await title.dblclick()
    const nameInput = panel(page).locator('.panel-header input')
    await nameInput.fill('Reloadable Plan')
    await nameInput.press('Enter')
    await expect(planTitle(page)).toHaveText('Reloadable Plan')
    await switchPlan(page, PLAN_1)
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
    await expect(page.getByTestId('goal-item-hullparts')).toHaveCount(0)
    await switchPlan(page, 'Reloadable Plan')
    await expect(page.getByTestId('goal-item-energycells')).toHaveCount(0)
  })

  test('3.3 Case: 方案删除与自动切换', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await createPlan(page)
    await deletePlan(page, PLAN_2)
    await expect(planTitle(page)).toHaveText(PLAN_1)
    await deletePlan(page, PLAN_1)
    await expect(planTitle(page)).toHaveText('Build Plan')
    await openPlanMenu(page)
    await expect(page.getByText('No saved plans', { exact: true })).toBeVisible()
    expect((await storedPlans(page)).activeId).toBeNull()
    expect((await storedPlans(page)).list).toEqual([])
  })

  test('3.4 Case: Fleet 条目添加与分组展示', async ({ page }) => {
    await addKatana(page)
    const fleet = page.getByTestId('fleet-goal-card')
    await expect(fleet.locator('.fleet-group')).toHaveCount(1)
    await expect(fleet.locator('.fleet-group')).toContainText('Wharf')
    const quantity = fleet.getByTestId(`fleet-entry-qty-${KATANA_BLUEPRINT}`).locator('input')
    await quantity.fill('2')
    await quantity.blur()
    const shipyardCount = fleet.getByTestId('fleet-shipyard-count-wharf').locator('input')
    await shipyardCount.fill('2')
    await shipyardCount.blur()
    await expect(quantity).toHaveValue('2')
    await expect(shipyardCount).toHaveValue('2')
    expect((await storedPlans(page)).list[0].buildGoals[0]).toMatchObject({
      entries: [{ shipId: KATANA_SHIP, blueprintId: KATANA_BLUEPRINT, quantity: 2 }],
      wharfCount: 2,
    })
  })

  test('3.5 Case: Fleet 建造时间模式切换', async ({ page }) => {
    await addKatana(page)
    const fleet = page.getByTestId('fleet-goal-card')
    const mode = fleet.locator('.fleet-mode-select')
    await mode.selectOption('planned')
    await expect(fleet.getByTestId('fleet-build-time-input')).toBeVisible()
    await mode.selectOption('actual')
    await expect(fleet.getByTestId('fleet-build-time-input')).toBeHidden()
    expect((await storedPlans(page)).list[0].buildGoals[0]).toMatchObject({ buildTimeMode: 'actual' })
  })

  test('3.6 Case: Fleet 蓝图缺失降级处理', async ({ page }) => {
    await addKatana(page)
    await page.getByTestId('top-view-btn-ship-build').click()
    await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    await page.getByTestId('ship-build-blueprint-menu-trigger').click()
    const menu = page.getByTestId('ship-build-blueprint-menu')
    const katanaRow = menu.locator('.ship-blueprint-menu-row').filter({ has: menu.getByText('Katana', { exact: true }) })
    await expect(katanaRow).toHaveCount(1)
    page.once('dialog', dialog => dialog.accept())
    await katanaRow.locator('.ship-blueprint-delete-btn').click()
    await expect(menu.getByText('Katana', { exact: true })).toHaveCount(0)
    await page.getByTestId('top-view-btn-blueprint-production').click()
    await buildPanelLoaded(page)
    const fleet = page.getByTestId('fleet-goal-card')
    await expect(fleet).toBeVisible()
    await expect(fleet.locator('.fleet-entry')).toHaveCount(1)
    await expect(fleet.locator('[data-testid="fleet-entry-warning"]')).toHaveCount(1)
    await expect(fleet.locator('.fleet-entry-detail')).toHaveCount(0)
    await expect(fleet.getByTestId('fleet-rates')).toBeVisible()
    await expect(fleet.getByTestId(`fleet-entry-remove-${KATANA_BLUEPRINT}`)).toBeVisible()
  })

  test('3.7 Case: 删除最后一条 Fleet 条目自动移除', async ({ page }) => {
    await addKatana(page)
    await page.getByTestId(`fleet-entry-remove-${KATANA_BLUEPRINT}`).click()
    await expect(page.getByTestId('fleet-goal-card')).toHaveCount(0)
    expect((await storedPlans(page)).list[0].buildGoals).toEqual([])
  })

  test('3.8 Case: 同 active 逻辑产线绑定', async ({ page }) => {
    await addGoal(page, HULL_PARTS)
    await selectFlow(page, LOGIC_FLOW)
    await expect(page.getByTestId('allocation-section')).toBeVisible()
    await expect(page.getByTestId('allocation-section').locator('.allocation-group:not(.allocation-group--unmatched)')).toHaveCount(1)
    const logicState = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans') || 'null'))
    expect(logicState.activeId).toBe(LOGIC_FLOW)
    expect((await storedPlans(page)).list[0].logicFlowPlanId).toBe(LOGIC_FLOW)
  })

  test('3.9 Case: 非 active 逻辑产线绑定', async ({ page }) => {
    await addGoal(page, HULL_PARTS)
    await selectFlow(page, LOGIC_FLOW)
    await createPlan(page)
    await addGoal(page, ENERGY_CELLS)
    await selectFlow(page, 'unplanned')
    expect((await storedPlans(page)).list[1]).toMatchObject({ name: PLAN_2, logicFlowPlanId: null })
    const logicState = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans') || 'null'))
    expect(logicState.activeId).toBe(LOGIC_FLOW)
    await switchPlan(page, PLAN_1)
    await expect(page.getByTestId('goal-item-hullparts')).toBeVisible()
    await expect(page.getByTestId('goal-item-energycells')).toHaveCount(0)
    await expect(page.getByTestId('build-plan-flow-menu-label')).toHaveText('Logic Flow 1')
    expect((await storedPlans(page)).list[0].logicFlowPlanId).toBe(LOGIC_FLOW)
  })

  test('3.10 Case: 无规划产线模式', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await selectFlow(page, 'unplanned')
    await expect(page.getByTestId('build-plan-flow-menu-label')).toHaveText('Unplanned')
    await expect(page.getByTestId('allocation-section')).toContainText('Unmatched')
    const compute = page.getByRole('button', { name: 'Compute Plan', exact: true })
    await expect(compute).toBeEnabled()
    await compute.click()
    await expect(compute).toBeEnabled()
    expect((await storedPlans(page)).list[0].logicFlowPlanId).toBeNull()
  })

  test('3.11 Case: 产线自动分配展示', async ({ page }) => {
    await addGoal(page, HULL_PARTS)
    await selectFlow(page, LOGIC_FLOW)
    const allocation = page.getByTestId('allocation-section')
    await expect(allocation).toBeVisible()
    await expect(allocation.locator('.allocation-group:not(.allocation-group--unmatched)')).toHaveCount(1)
    await expect(allocation.locator('.allocation-group--unmatched')).toHaveCount(0)
  })

  test('3.12 Case: 页面刷新持久化恢复', async ({ page }) => {
    await addGoal(page, ENERGY_CELLS)
    await createPlan(page)
    await selectFlow(page, 'unplanned')
    const beforeReload = await storedPlans(page)
    expect(beforeReload.activeId).toBe(beforeReload.list[1].id)
    expect(beforeReload.list[1]).toMatchObject({ name: PLAN_2, buildGoals: [], logicFlowPlanId: null })
    await reloadAndSetEnglish(page)
    await expect(planTitle(page)).toHaveText(PLAN_2)
    await expect(page.getByTestId('goal-item-energycells')).toHaveCount(0)
    await expect(page.getByTestId('build-plan-flow-menu-label')).toHaveText('Unplanned')
    await switchPlan(page, PLAN_1)
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
    expect((await storedPlans(page)).list[0]).toMatchObject({ name: PLAN_1, logicFlowPlanId: LOGIC_FLOW })
  })
})
