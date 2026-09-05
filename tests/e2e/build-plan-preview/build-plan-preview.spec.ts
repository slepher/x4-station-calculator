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
    await page.locator(`[data-testid="grouped-candidate-item-${name}"]`).click()
  }

  async function buildPreviewState(page: Page) {
    await addProductionGoal(page)
    await page.waitForTimeout(500)
  }

  async function selectFlowPlan(page: Page, id = 'logic-flow-1') {
    await page.locator('[data-testid="build-plan-flow-menu-trigger"]').click()
    await page.locator(`[data-testid="flow-plan-menu-item-${id}"]`).click()
    await page.waitForTimeout(500)
  }

  function buildMaterialCheckbox(page: Page) {
    return page.locator('input[type="checkbox"]')
  }

  async function setBuildMaterialPlanning(page: Page, enabled: boolean) {
    const checkbox = buildMaterialCheckbox(page)
    await expect(checkbox).toHaveCount(1)
    if (await checkbox.isChecked() !== enabled) await checkbox.click()
    await expect(checkbox).toBeChecked({ checked: enabled })
    await expect(page.locator('[data-testid="preview-section"]').first()).toBeVisible()
  }

  // ── Chapter 2 ─────────────────────────────────────────────────────────

  test('2.1 状态: Preview 面板已加载且有预览结果', async ({ page }) => {
    await buildPreviewState(page)
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
    const groups = page.locator('.allocation-group')
    await expect(groups.first()).toBeVisible()
    await expect(groups.first().locator('.allocation-group-name')).not.toHaveText('')
    await expect(groups.first().locator('.allocation-group-count')).toHaveText('1')
  })

  test('2.2 切换: 勾选建材产线 checkbox -> Preview 重算', async ({ page }) => {
    await buildPreviewState(page)
    const checkbox = buildMaterialCheckbox(page)
    const wasChecked = await checkbox.isChecked()
    await checkbox.click()
    await expect(checkbox).toBeChecked({ checked: !wasChecked })
    const materialSection = page.locator('[data-testid="preview-section"]').filter({ hasText: '建材产线分配' })
    if (wasChecked) {
      await expect(materialSection).toHaveCount(0)
    } else {
      await expect(materialSection).toBeVisible()
    }
  })

  // ── Chapter 3 ─────────────────────────────────────────────────────────

  test('3.1 Case: Preview 区渲染 derived 与 required 项', async ({ page }) => {
    // 3.1.1 状态: Preview 面板已加载且有预览结果
    await addProductionGoal(page, 'hullparts')
    await selectFlowPlan(page)
    await expect(page.locator('[data-testid="preview-section"]')).toBeVisible()
    await setBuildMaterialPlanning(page, true)
    // 3.1.2/3.1.3 derived 项显示固定模块名与目标标签
    const productionSection = page.locator('[data-testid="preview-section"]').filter({ hasText: '生产产线' })
    await expect(productionSection.locator('.goal-name')).toContainText('船体部件产线')
    await expect(productionSection.locator('.preview-tag--derived')).toHaveText('目标')
    // 3.1.4 required 项显示固定 ware 名与建材标签
    const materialSection = page.locator('[data-testid="preview-section"]').filter({ hasText: '建材产线分配' })
    await expect(materialSection.locator('.preview-tag--required')).toHaveCount(3)
    await expect(materialSection.locator('.goal-name')).toContainText(['能量电池', '石墨烯', '精炼金属'])
    await expect(materialSection.locator('.preview-tag--required').first()).toHaveText('建材')
    // 3.1.5 preview 项不可编辑
    await expect(page.locator('[data-testid="preview-section"] .derived-badge')).toHaveCount(5)
  })

  test('3.2 Case: 分组 card 显示 moduleId 去重计数', async ({ page }) => {
    // 3.2.1 状态: Preview 面板已加载且有预览结果
    await addProductionGoal(page, 'hullparts')
    await selectFlowPlan(page)
    await setBuildMaterialPlanning(page, true)
    await expect(page.locator('[data-testid="preview-section"]').filter({ hasText: '生产产线' }).locator('.allocation-group-count')).toHaveText('1')
  })

  test('3.3 Case: checkbox 切换影响预览', async ({ page }) => {
    // 3.3.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    const checkbox = buildMaterialCheckbox(page)
    await selectFlowPlan(page)
    await setBuildMaterialPlanning(page, true)
    // 3.3.2/3.3.3 勾选后建材分组出现
    await expect(page.locator('[data-testid="preview-section"]').filter({ hasText: '建材产线分配' })).toBeVisible()
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
    // 3.3.4/3.3.5 关闭后建材分组隐藏，用户目标仍保留
    await expect(page.locator('[data-testid="preview-section"]').filter({ hasText: '建材产线分配' })).toHaveCount(0)
    await expect(page.locator('.ware-row').filter({ hasText: '能量电池' })).toBeVisible()
  })

  test('3.4 Case: 无规划模式 preview 生成', async ({ page }) => {
    // 3.4.1 添加目标
    await addProductionGoal(page)
    await page.waitForTimeout(300)
    // 3.4.2 选择无规划
    const flowTrigger = page.locator('[data-testid="build-plan-flow-menu-trigger"]')
    await expect(flowTrigger).toBeVisible()
    await flowTrigger.click()
    const menu = page.locator('[data-testid="build-plan-flow-menu"]')
    await expect(menu).toBeVisible()
    await menu.locator('[data-testid="flow-plan-menu-item-unplanned"]').click()
    await page.waitForTimeout(500)
    // 3.4.3 断言待规划分组
    const unmatched = page.locator('.allocation-group--unmatched')
    await expect(unmatched).toBeVisible()
  })

  test('3.5 Case: Preview 项名称显示规则', async ({ page }) => {
    // 3.5.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.5.2 定位名称
    const nameEl = page.locator('.goal-name').first()
    await expect(nameEl).toHaveText('能量电池产线')
  })

  test('3.6 Case: 用户目标区与 preview 区分离', async ({ page }) => {
    // 3.6.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.6.2 preview 区不含数量输入框
    const inputs = page.locator('[data-testid="preview-section"]').locator('.goal-number-input')
    await expect(inputs).toHaveCount(0)
    // 3.6.3 preview 区不含删除按钮
    const removeBtns = page.locator('[data-testid="preview-section"]').locator('.remove-btn')
    await expect(removeBtns).toHaveCount(0)
  })

  test('4.1 Bug: 无规划仍显示 unmatched 且不移除用户目标', async ({ page }) => {
    await buildPreviewState(page)
    await page.locator('[data-testid="build-plan-flow-menu-trigger"]').click()
    await page.locator('[data-testid="flow-plan-menu-item-unplanned"]').click()
    await expect(page.locator('.allocation-group--unmatched')).toBeVisible()
    await expect(page.locator('.ware-row').filter({ hasText: '能量电池' })).toBeVisible()
  })
})
