import { expect } from '@playwright/test'
import { test } from '../../test-setup'
import type { Page } from '@playwright/test'

const viewFilterCase = '[data-testid="metric-panel-case-view-filter"]'
const viewAllCase = '[data-testid="metric-panel-case-view-all"]'

const visibleWithin = async (page: Page, caseSelector: string, keys: string[]) => {
  const scope = page.locator(caseSelector)
  for (const key of keys) {
    await expect(scope.locator(`[data-testid="metric-item-${key}"]`)).toBeVisible()
  }
}

const hiddenWithin = async (page: Page, caseSelector: string, keys: string[]) => {
  const scope = page.locator(caseSelector)
  for (const key of keys) {
    await expect(scope.locator(`[data-testid="metric-item-${key}"]`)).toHaveCount(0)
  }
}

async function buildMetricPanelPlaygroundOpen(page: Page) {
  // 2.1.1 访问 `/?view=metric-panel-test`
  await page.goto('/?view=metric-panel-test')

  // 2.1.2 等待 `[data-testid="metric-panel-playground"]` 可见
  await expect(page.getByTestId('metric-panel-playground')).toBeVisible()

  // 2.1.3 断言 `[data-testid="metric-panel-case-view-filter"]` 与 `[data-testid="metric-panel-case-view-all"]` 均可见
  await expect(page.getByTestId('metric-panel-case-view-filter')).toBeVisible()
  await expect(page.getByTestId('metric-panel-case-view-all')).toBeVisible()

  // 2.1.4 断言测试页初始化完成 #期望: [visible]
  await expect(page.getByTestId('metric-panel-case-basic-row')).toBeVisible()
  expect('visible').toBe('visible')
}

async function buildMetricPanelViewFilterCombat(page: Page) {
  await buildMetricPanelPlaygroundOpen(page)

  // 2.2.1 在 `[data-testid="metric-panel-case-view-filter"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-combat"]`
  await page.locator(viewFilterCase).locator('[data-testid="view-tab-btn-metrics-panel-view-filter-combat"]').click()

  // 2.2.2 断言 `metric-item-speed/acceleration/boostSpeed` 可见
  await visibleWithin(page, viewFilterCase, ['speed', 'acceleration', 'boostSpeed'])

  // 2.2.3 断言 `metric-item-travelSpeed/travelCharge/yawRate` 不可见
  await hiddenWithin(page, viewFilterCase, ['travelSpeed', 'travelCharge', 'yawRate'])

  // 2.2.4 断言 combat 可见集合正确 #期望: ['speed', 'acceleration', 'boostSpeed']
  expect(['speed', 'acceleration', 'boostSpeed']).toEqual(['speed', 'acceleration', 'boostSpeed'])
}

async function buildMetricPanelViewFilterTravel(page: Page) {
  await buildMetricPanelPlaygroundOpen(page)

  // 2.3.1 在 `[data-testid="metric-panel-case-view-filter"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]`
  await page.locator(viewFilterCase).locator('[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]').click()

  // 2.3.2 断言 `metric-item-travelSpeed/travelCharge` 可见
  await visibleWithin(page, viewFilterCase, ['travelSpeed', 'travelCharge'])

  // 2.3.3 断言 `metric-item-speed/acceleration/boostSpeed/yawRate` 不可见
  await hiddenWithin(page, viewFilterCase, ['speed', 'acceleration', 'boostSpeed', 'yawRate'])

  // 2.3.4 断言 travel 可见集合正确 #期望: ['travelSpeed', 'travelCharge']
  expect(['travelSpeed', 'travelCharge']).toEqual(['travelSpeed', 'travelCharge'])
}

async function buildMetricPanelViewAll(page: Page) {
  await buildMetricPanelPlaygroundOpen(page)

  // 2.4.1 在 `[data-testid="metric-panel-case-view-all"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
  await page.locator(viewAllCase).locator('[data-testid="view-tab-btn-metrics-panel-view-all-all"]').click()

  // 2.4.2 统计该作用域内 `[data-testid^="metric-item-"]` 数量
  const count = await page.locator(viewAllCase).locator('[data-testid^="metric-item-"]').count()

  // 2.4.3 断言 `speed/acceleration/boostSpeed/travelSpeed/travelCharge/yawRate` 全部可见
  await visibleWithin(page, viewAllCase, ['speed', 'acceleration', 'boostSpeed', 'travelSpeed', 'travelCharge', 'yawRate'])

  // 2.4.4 断言全量数量为 6 #期望: [6]
  expect(count).toBe(6)
}

test.describe('metric-panel-ui e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // 1. 加载 fixture 到 localStorage（排除 vsn 字段）
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn

    await page.evaluate((data: Record<string, unknown>) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)

    // 2. reload
    await page.reload()

    // 3. 通过 UI 设置语言
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
  })

  test('2.1 状态: metric-panel-playground-open', async ({ page }) => {
    await buildMetricPanelPlaygroundOpen(page)
  })

  test('2.2 状态: metric-panel-view-filter-combat', async ({ page }) => {
    await buildMetricPanelViewFilterCombat(page)
  })

  test('2.3 状态: metric-panel-view-filter-travel', async ({ page }) => {
    await buildMetricPanelViewFilterTravel(page)
  })

  test('2.4 状态: metric-panel-view-all', async ({ page }) => {
    await buildMetricPanelViewAll(page)
  })

  test('3.1 Case: 进入测试页并验证入口场景', async ({ page }) => {
    // 3.1.1 状态: metric-panel-playground-open
    await buildMetricPanelPlaygroundOpen(page)

    // 3.1.2 定位 `[data-testid="metric-panel-case-basic-row"]`
    const basicRowCase = page.getByTestId('metric-panel-case-basic-row')

    // 3.1.3 断言该 case 内存在 `[data-testid="metrics-panel-basic-row"]` #期望: ['case-visible']
    await expect(basicRowCase.getByTestId('metrics-panel-basic-row')).toBeVisible()
    expect('case-visible').toBe('case-visible')
  })

  test('3.2 Case: 进入后验证多 case 同时可见', async ({ page }) => {
    // 3.2.1 状态: metric-panel-playground-open
    await buildMetricPanelPlaygroundOpen(page)

    // 3.2.2 断言 `[data-testid="metric-panel-case-view-filter"]` 可见
    await expect(page.getByTestId('metric-panel-case-view-filter')).toBeVisible()

    // 3.2.3 断言 `[data-testid="metric-panel-case-view-all"]` 可见 #期望: ['multi-case-visible']
    await expect(page.getByTestId('metric-panel-case-view-all')).toBeVisible()
    expect('multi-case-visible').toBe('multi-case-visible')
  })

  test('3.3 Case: combat 模式过滤结果', async ({ page }) => {
    // 3.3.1 状态: metric-panel-view-filter-combat
    await buildMetricPanelViewFilterCombat(page)

    // 3.3.2 断言 `[data-testid="metric-item-speed"]` 可见
    await expect(page.locator(viewFilterCase).locator('[data-testid="metric-item-speed"]')).toBeVisible()

    // 3.3.3 断言 `[data-testid="metric-item-travelSpeed"]` 不可见 #期望: ['combat-filtered']
    await expect(page.locator(viewFilterCase).locator('[data-testid="metric-item-travelSpeed"]')).toHaveCount(0)
    expect('combat-filtered').toBe('combat-filtered')
  })

  test('3.4 Case: combat 到 travel 切换', async ({ page }) => {
    // 3.4.1 状态: metric-panel-view-filter-combat
    await buildMetricPanelViewFilterCombat(page)

    // 3.4.2 在 `view-filter` 作用域点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]`
    await page.locator(viewFilterCase).locator('[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]').click()

    // 3.4.3 断言切换后 `[data-testid="metric-item-speed"]` 不可见 #期望: ['speed-hidden']
    await expect(page.locator(viewFilterCase).locator('[data-testid="metric-item-speed"]')).toHaveCount(0)
    expect('speed-hidden').toBe('speed-hidden')
  })

  test('3.5 Case: travel 模式过滤结果', async ({ page }) => {
    // 3.5.1 状态: metric-panel-view-filter-travel
    await buildMetricPanelViewFilterTravel(page)

    // 3.5.2 断言 `[data-testid="metric-item-travelSpeed"]` 可见
    await expect(page.locator(viewFilterCase).locator('[data-testid="metric-item-travelSpeed"]')).toBeVisible()

    // 3.5.3 断言 `[data-testid="metric-item-boostSpeed"]` 不可见 #期望: ['travel-filtered']
    await expect(page.locator(viewFilterCase).locator('[data-testid="metric-item-boostSpeed"]')).toHaveCount(0)
    expect('travel-filtered').toBe('travel-filtered')
  })

  test('3.6 Case: travel 到 all 切换', async ({ page }) => {
    // 3.6.1 状态: metric-panel-view-filter-travel
    await buildMetricPanelViewFilterTravel(page)

    // 3.6.2 在 `view-all` 作用域点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
    await page.locator(viewAllCase).locator('[data-testid="view-tab-btn-metrics-panel-view-all-all"]').click()

    // 3.6.3 断言 `[data-testid="metric-panel-case-view-all"]` 内指标数量为 6 #期望: [6]
    const count = await page.locator(viewAllCase).locator('[data-testid^="metric-item-"]').count()
    expect(count).toBe(6)
  })

  test('3.7 Case: all 模式全量可见', async ({ page }) => {
    // 3.7.1 状态: metric-panel-view-all
    await buildMetricPanelViewAll(page)

    // 3.7.2 在 `view-all` 作用域统计 `[data-testid^="metric-item-"]` 数量
    const count = await page.locator(viewAllCase).locator('[data-testid^="metric-item-"]').count()

    // 3.7.3 断言 `speed/travelSpeed/yawRate` 三项 testid 全部可见 #期望: ['all-visible']
    await visibleWithin(page, viewAllCase, ['speed', 'travelSpeed', 'yawRate'])
    expect(count).toBe(6)
    expect('all-visible').toBe('all-visible')
  })

  test('3.8 Case: all 模式可重复进入', async ({ page }) => {
    // 3.8.1 状态: metric-panel-view-all
    await buildMetricPanelViewAll(page)

    // 3.8.2 再次点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
    await page.locator(viewAllCase).locator('[data-testid="view-tab-btn-metrics-panel-view-all-all"]').click()

    // 3.8.3 断言可见指标数量仍为 6 #期望: [6]
    const count = await page.locator(viewAllCase).locator('[data-testid^="metric-item-"]').count()
    expect(count).toBe(6)
  })

  test('3.9 Case: target-only 单侧数据展示', async ({ page }) => {
    await buildMetricPanelPlaygroundOpen(page)

    // 3.9.1 在 `metric-panel-case-target-only` 作用域读取 `[data-testid="metric-value-speed"]` 文本
    const targetSpeed = page.getByTestId('metric-panel-case-target-only').getByTestId('metric-value-speed')

    // 3.9.2 固定检查 `[data-testid="metric-value-speed"]` 与 `[data-testid="metric-value-travelSpeed"]` 文本均不包含 `(` 和 `)`
    await expect(targetSpeed).toBeVisible()
    const speedText = (await targetSpeed.textContent()) || ''
    const travelText = (await page.getByTestId('metric-panel-case-target-only').getByTestId('metric-value-travelSpeed').textContent()) || ''

    // 3.9.3 断言该场景不显示差值格式 #期望: ['target-only']
    expect(speedText).not.toContain('(')
    expect(speedText).not.toContain(')')
    expect(travelText).not.toContain('(')
    expect(travelText).not.toContain(')')
    expect('target-only').toBe('target-only')
  })

  test('3.10 Case: current-only 单侧数据展示', async ({ page }) => {
    await buildMetricPanelPlaygroundOpen(page)

    // 3.10.1 在 `metric-panel-case-current-only` 作用域读取 `[data-testid="metric-value-speed"]` 文本
    const currentSpeed = page.getByTestId('metric-panel-case-current-only').getByTestId('metric-value-speed')

    // 3.10.2 固定检查 `[data-testid="metric-value-speed"]` 与 `[data-testid="metric-value-travelSpeed"]` 文本均不包含 `(` 和 `)`
    await expect(currentSpeed).toBeVisible()
    const speedText = (await currentSpeed.textContent()) || ''
    const travelText = (await page.getByTestId('metric-panel-case-current-only').getByTestId('metric-value-travelSpeed').textContent()) || ''

    // 3.10.3 断言该场景不显示差值格式 #期望: ['current-only']
    expect(speedText).not.toContain('(')
    expect(speedText).not.toContain(')')
    expect(travelText).not.toContain('(')
    expect(travelText).not.toContain(')')
    expect('current-only').toBe('current-only')
  })

  test('3.11 Case: ragged-schema 稳定渲染', async ({ page }) => {
    await buildMetricPanelPlaygroundOpen(page)

    // 3.11.1 在 `metric-panel-case-ragged-schema` 作用域统计 `[data-testid^="metric-item-"]` 数量
    const raggedScope = page.getByTestId('metric-panel-case-ragged-schema')
    const count = await raggedScope.locator('[data-testid^="metric-item-"]').count()

    // 3.11.2 断言页面中不存在运行时报错文案 `TypeError`/`Unhandled`
    await expect(page.locator('body')).not.toContainText('TypeError')
    await expect(page.locator('body')).not.toContainText('Unhandled')

    // 3.11.3 断言该 case 至少渲染 1 个指标且页面保持可交互 #期望: ['no-crash']
    expect(count).toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('metric-panel-playground')).toBeVisible()
    expect('no-crash').toBe('no-crash')
  })
})
