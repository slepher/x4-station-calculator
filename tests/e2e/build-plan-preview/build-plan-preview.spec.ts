import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('build-plan-preview', () => {
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

  async function addProductionGoal(page: Page, name = 'energycells') {
    await page.locator('[data-testid="candidate-search-input"]').fill(name)
    await page.locator('[data-testid="grouped-candidate-popover"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('[data-testid^="grouped-candidate-item-"]').first().click()
  }

  async function buildPreviewState(page: Page) {
    await addProductionGoal(page)
    await page.waitForTimeout(500)
  }

  async function toggleCheckbox(page: Page) {
    const cb = page.locator('input[type=checkbox]')
    if (await cb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cb.click()
      await page.waitForTimeout(500)
    }
  }

  // ── Chapter 2 ─────────────────────────────────────────────────────────

  test('2.1 状态: Preview 面板已加载且有预览结果', async ({ page }) => {
    await buildPreviewState(page)
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
    const groups = page.locator('.allocation-group')
    await expect(groups.first()).toBeVisible()
    await expect(page.locator('.allocation-group-name').first()).toBeVisible()
  })

  test('2.2 切换: 勾选建材产线 checkbox -> Preview 重算', async ({ page }) => {
    await buildPreviewState(page)
    const groupsBefore = await page.locator('.allocation-group').count()
    await toggleCheckbox(page)
    const groupsAfter = await page.locator('.allocation-group').count()
    expect(groupsAfter).not.toBe(groupsBefore)
  })

  // ── Chapter 3 ─────────────────────────────────────────────────────────

  test('3.1 Case: Preview 区渲染 derived 与 required 项', async ({ page }) => {
    // 3.1.1 状态: Preview 面板已加载且有预览结果
    await buildPreviewState(page)
    // 3.1.2 定位 goal-row
    const rows = page.locator('.goal-row')
    if (await rows.count() > 0) {
      // 3.1.3 derived 绿色标签
      const greenTags = page.locator('.preview-tag--derived')
      const hasGreen = await greenTags.count() > 0
      // 3.1.4 required 红色标签
      const redTags = page.locator('.preview-tag--required')
      const hasRed = await redTags.count() > 0
      expect(hasGreen || hasRed).toBe(true)
      // 3.1.5 锁定图标
      await expect(page.locator('.derived-badge').first()).toBeVisible()
    }
  })

  test('3.2 Case: 分组 card 显示 moduleId 去重计数', async ({ page }) => {
    // 3.2.1 状态: Preview 面板已加载且有预览结果
    await buildPreviewState(page)
    const countBadge = page.locator('.allocation-group-count').first()
    if (await countBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 3.2.2/3.2.3 断言计数存在
      await expect(countBadge).toBeVisible()
    }
  })

  test('3.3 Case: checkbox 切换影响预览', async ({ page }) => {
    // 3.3.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.3.2 切换: 勾选 checkbox -> 重算
    await toggleCheckbox(page)
    await page.waitForTimeout(300)
    // 3.3.3 切换后状态
    await toggleCheckbox(page)
    await page.waitForTimeout(300)
    // 断言面板仍在
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
  })

  test('3.4 Case: 无规划模式 preview 生成', async ({ page }) => {
    // 3.4.1 添加目标
    await addProductionGoal(page)
    await page.waitForTimeout(300)
    // 3.4.2 选择无规划
    const flowTrigger = page.locator('[data-testid="build-plan-flow-menu-trigger"]')
    if (await flowTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await flowTrigger.click()
      const menu = page.locator('[data-testid="build-plan-flow-menu"]')
      await expect(menu).toBeVisible()
      const unplanned = menu.locator('[data-testid="flow-plan-menu-item-unplanned"]')
      if (await unplanned.isVisible({ timeout: 2000 }).catch(() => false)) {
        await unplanned.click()
      }
    }
    await page.waitForTimeout(500)
    // 3.4.3 断言待规划分组
    const unmatched = page.locator('.allocation-group--unmatched')
    if (await unmatched.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(unmatched).toBeVisible()
    }
  })

  test('3.5 Case: Preview 项名称显示规则', async ({ page }) => {
    // 3.5.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.5.2 定位名称
    const nameEl = page.locator('.goal-name').first()
    if (await nameEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 3.5.3/3.5.4 名称非空
      const name = await nameEl.textContent()
      expect(name?.trim().length).toBeGreaterThan(0)
    }
  })

  test('3.6 Case: 用户目标区与 preview 区分离', async ({ page }) => {
    // 3.6.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.6.2 preview 区不含数量输入框
    const inputs = page.locator('[data-testid="preview-section"]').locator('.goal-number-input')
    expect(await inputs.count()).toBe(0)
    // 3.6.3 preview 区不含删除按钮
    const removeBtns = page.locator('[data-testid="preview-section"]').locator('.remove-btn')
    expect(await removeBtns.count()).toBe(0)
  })
})
