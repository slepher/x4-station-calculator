import { test, expect } from '@playwright/test'

test.describe('build-plan-compute', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('language-select').selectOption('zh-CN')
  })

  async function addGoal(page: import('@playwright/test').Page, name = 'energycells') {
    await page.getByTestId('candidate-search-input').fill(name)
    await page.getByTestId('grouped-candidate-popover').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('[data-testid^="grouped-candidate-item-"]').first().click()
  }

  async function compute(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: /计算建造方案|Compute/ }).click()
    await expect(page.getByText(/计算中|Computing/)).toHaveCount(0)
  }

  function schemeCard(page: import('@playwright/test').Page) {
    return page.locator('.panel-card .panel-content > div.space-y-3 > div').first()
  }

  // ── Chapter 2 ─────────────────────────────────────────────────────────

  test('2.1 状态: 固定目标完成显式计算并展示可手算结果', async ({ page }) => {
    await addGoal(page)
    await compute(page)
    const card = schemeCard(page)
    await expect(card).toBeVisible()
    await expect(card).toContainText(/能量电池产线|Energy Cell Production/)
    await expect(card).toContainText(/×1/)
    await expect(card).toContainText(/能量电池\s*×520|Energy Cells\s*×520/)
    await expect(card).toContainText(/12m/)
  })

  test('2.2 切换: 修改目标数量后重算结果变化', async ({ page }) => {
    await addGoal(page)
    await compute(page)
    const card = schemeCard(page)
    const before = await card.innerText()
    await page.getByTestId('goal-item-energycells').locator('input').fill('2000000')
    await page.getByTestId('goal-item-energycells').locator('input').press('Tab')
    await compute(page)
    await expect(card).not.toHaveText(before)
  })

  // ── Chapter 3 ─────────────────────────────────────────────────────────

  test('3.1 Case: 计算按钮、方案分组和耗时存在', async ({ page }) => {
    await addGoal(page)
    await compute(page)
    await expect(page.getByRole('button', { name: /计算建造方案|Compute/ })).toBeEnabled()
    await expect(schemeCard(page)).toBeVisible()
    await expect(schemeCard(page)).toContainText(/\d+m|\d+\.\d+h/)
  })

  test('3.2 Case: 模块汇总含模块数量、Energy Cells 建材且重叠产线只计一次', async ({ page }) => {
    await addGoal(page, 'hullparts')
    await addGoal(page, 'energycells')
    await compute(page)
    const card = schemeCard(page)
    await expect(card).toBeVisible()
    await expect(card).toContainText(/船体部件产线|Hull Part Production/)
    await expect(card).toContainText(/能量电池|Energy Cells/)
    await expect(card.getByText(/能量电池\s*×\d+|Energy Cells\s*×\d+/)).toHaveCount(1)
    await expect(card).toContainText(/×\d+/)
  })

  test('3.3 Case: 详情默认模块汇总与 steps 切换可逆', async ({ page }) => {
    await addGoal(page)
    await page.locator('label').filter({ hasText: /建材产线|Build Flow/ }).locator('input[type="checkbox"]').check()
    await compute(page)
    await page.locator('.panel-card .panel-content > div.space-y-3 > div').last().click()
    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible()
    const moduleSummary = modal.locator('div.flex-1.overflow-y-auto').first()
    await expect(moduleSummary).toBeVisible()
    await expect(moduleSummary.locator('button')).toHaveCount(1)
    const toggle = modal.getByRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(modal.locator('div.flex-1.overflow-y-auto').last().locator('button').first()).toContainText('#1')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(moduleSummary).toBeVisible()
  })

  test('3.4 Case: 无规划选择仍可计算', async ({ page }) => {
    await addGoal(page)
    await page.getByTestId('build-plan-flow-menu-trigger').click()
    await page.getByTestId('flow-plan-menu-item-unplanned').click()
    await compute(page)
    await expect(schemeCard(page)).toBeVisible()
  })

  // SCC 只验证黑盒结果可继续增加；不把一次结果当作全局最小解 oracle。
})
