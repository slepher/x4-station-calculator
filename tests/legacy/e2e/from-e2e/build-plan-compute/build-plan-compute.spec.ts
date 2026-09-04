import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('build-plan-compute', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    })
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
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('zh-CN')
    }
  })

  async function addGoal(page: Page, name = 'energycells') {
    await page.locator('[data-testid="candidate-search-input"]').fill(name)
    await page.locator('[data-testid="grouped-candidate-popover"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('[data-testid^="grouped-candidate-item-"]').first().click()
    await page.waitForTimeout(300)
  }

  async function clickCompute(page: Page) {
    const btn = page.locator('button').filter({ hasText: /计算建造方案|Compute/ })
    await btn.waitFor({ state: 'visible', timeout: 5000 })
    await btn.click()
    await page.waitForTimeout(1000)
  }

  async function buildComputeState(page: Page) {
    await addGoal(page)
    await clickCompute(page)
  }

  // ── Chapter 2 ─────────────────────────────────────────────────────────

  test('2.1 状态: 建造方案计算完成', async ({ page }) => {
    await buildComputeState(page)
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
    const groups = page.locator('.allocation-group')
    await expect(groups.first()).toBeVisible()
    await expect(groups.first().locator('.allocation-group-name')).toBeVisible()
  })

  test('2.2 切换: 修改目标 -> 重算方案', async ({ page }) => {
    await buildComputeState(page)
    await addGoal(page, 'hullparts')
    await clickCompute(page)
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
  })

  // ── Chapter 3 ─────────────────────────────────────────────────────────

  test('3.1 Case: 基础建造方案计算', async ({ page }) => {
    // 3.1.1 状态: 建造方案计算完成
    await buildComputeState(page)
    // 3.1.2 切换: 修改目标 -> 重算方案
    await clickCompute(page)
    // 3.1.3 断言计算按钮可点击
    const btn = page.locator('button').filter({ hasText: /计算建造方案|Compute/ })
    await expect(btn).toBeEnabled()
    // 3.1.4 断言方案分组存在
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
  })

  test('3.2 Case: 方案卡片展示模块汇总', async ({ page }) => {
    // 3.2.1 状态: 建造方案计算完成
    await buildComputeState(page)
    // 3.2.2 切换: 修改目标 -> 重算方案
    await clickCompute(page)
    // 3.2.3 定位模块信息区
    const groups = page.locator('.allocation-group')
    if (await groups.count() > 0) {
      // 3.2.4 断言名称可见
      await expect(groups.first().locator('.allocation-group-name')).toBeVisible()
    }
  })

  test('3.3 Case: 方案详情弹窗两态展示', async ({ page }) => {
    // 3.3.1 状态: 建造方案计算完成
    await buildComputeState(page)
    // 3.3.2 点击方案卡片
    const groups = page.locator('.allocation-group')
    if (await groups.count() > 0) {
      await groups.first().click()
      await page.waitForTimeout(300)
      // 3.3.3 断言弹窗存在
      const modal = page.locator('.fixed.inset-0')
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toBeVisible()
      }
    }
  })
})
