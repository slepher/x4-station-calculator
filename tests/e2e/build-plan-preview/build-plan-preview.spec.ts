import { test } from '../../test-setup'
import { expect } from '@playwright/test'
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
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('language-select').selectOption('zh-CN')
  })

  async function addProductionGoal(page: Page, name = 'energycells') {
    await page.locator('[data-testid="candidate-search-input"]').fill(name)
    await page.locator('[data-testid="grouped-candidate-popover"]').waitFor({ state: 'visible', timeout: 5000 })
    await expect(page.locator(`[data-testid="grouped-candidate-item-${name}"]`)).toBeVisible()
    await page.locator(`[data-testid="grouped-candidate-item-${name}"]`).click()
  }

  function previewSection(page: Page, title: RegExp) {
    return page.locator('[data-testid="preview-section"]').filter({
      has: page.locator('.allocation-section-title').filter({ hasText: title }),
    })
  }

  async function selectFlowPlan(page: Page, id = 'logic-flow-1') {
    await page.locator('[data-testid="build-plan-flow-menu-trigger"]').click()
    const menuItem = page.locator(`[data-testid="flow-plan-menu-item-${id}"]`)
    await expect(menuItem).toBeVisible()
    await menuItem.click()
    await expect(page.locator('[data-testid="build-plan-flow-menu-label"]')).toHaveText('Logic Flow 1')
  }

  function buildMaterialCheckbox(page: Page) {
    return page.locator('input[type="checkbox"]')
  }

  async function setBuildMaterialPlanning(page: Page, enabled: boolean) {
    const checkbox = buildMaterialCheckbox(page)
    await expect(checkbox).toHaveCount(1)
    if (enabled) await checkbox.check()
    else await checkbox.uncheck()
    await expect(checkbox).toBeChecked({ checked: enabled })
  }

  async function buildPreviewState(page: Page, name = 'energycells') {
    await addProductionGoal(page, name)
    await selectFlowPlan(page)
    await setBuildMaterialPlanning(page, false)
  }

  async function expectRow(section: ReturnType<typeof previewSection>, name: string, tags: string[]) {
    const row = section.locator('.goal-row').filter({ hasText: name })
    await expect(row).toHaveCount(1)
    await expect(row.locator('.preview-tag')).toHaveText(tags)
    await expect(row.locator('.derived-badge')).toHaveCount(1)
  }

  // Historical mapping: generation-5 retained 5 passed/4 failed. The failures were
  // 2.2 material setup and 3.1-3.3 stale logic-flow-1 locators; they are not current results.

  // ── Chapter 2 ─────────────────────────────────────────────────────────

  test('2.1 状态: Preview 面板已加载且有预览结果', async ({ page }) => {
    // 2.1.1 输入固定 ware 名称
    await buildPreviewState(page)
    // 2.1.2 通过搜索结果添加 production-rate 目标
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
    // 2.1.3 定位 preview 区
    const production = previewSection(page, /生产产线|Production Lines/)
    // 2.1.4 预览区显示固定分组
    await expect(production).toHaveCount(1)
    const groups = production.locator('.allocation-group')
    await expect(groups).toHaveCount(1)
    await expect(groups.locator('.allocation-group-name')).toHaveText('E1-S1')
    // 2.1.5 分组显示 moduleId 去重计数
    await expect(groups.locator('.allocation-group-count')).toHaveText('1')
    await expectRow(production, '能量电池产线', ['目标'])
  })

  test('2.2 切换: 勾选建材产线 checkbox -> Preview 重算', async ({ page }) => {
    await buildPreviewState(page)
    // 2.2.1 定位建材产线 checkbox
    const checkbox = buildMaterialCheckbox(page)
    await expect(checkbox).not.toBeChecked()
    // 2.2.2 切换 checkbox
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    // 2.2.3 建材分组发生确定变化
    const buildMaterial = previewSection(page, /建材产线分配|Build Material Allocation/)
    const production = previewSection(page, /生产产线|Production Lines/)
    await expect(buildMaterial.locator('.allocation-group-name')).toHaveText('E1-S1')
    await expect(buildMaterial.locator('.allocation-group-count')).toHaveText('3')
    await expectRow(buildMaterial, '电子黏土产线', ['建材'])
    await expectRow(buildMaterial, '船体部件产线', ['建材'])
    await expectRow(buildMaterial, '量子管', ['材料'])
    await expectRow(buildMaterial, '能量电池产线', ['目标'])
    await expect(production.locator('.allocation-group-name')).toHaveText('lf-1-g2')
    await expect(production.locator('.allocation-group-count')).toHaveText('1')
    await expectRow(production, '量子管产线', ['材料'])
  })

  // ── Chapter 3 ─────────────────────────────────────────────────────────

  test('3.1 Case: Preview 区渲染 derived 与 required 项', async ({ page }) => {
    // 3.1.1 状态: Preview 面板已加载且有预览结果
    await addProductionGoal(page, 'hullparts')
    await selectFlowPlan(page)
    await expect(previewSection(page, /生产产线|Production Lines/)).toHaveCount(1)
    await setBuildMaterialPlanning(page, true)
    // 3.1.2 定位 preview 条目
    const previewRows = page.locator('[data-testid="preview-section"] .goal-row')
    await expect(previewRows).toHaveCount(4)
    // 3.1.3 derived 项显示固定模块名与目标标签
    const buildMaterialSection = previewSection(page, /建材产线分配|Build Material Allocation/)
    const productionSection = previewSection(page, /生产产线|Production Lines/)
    await expectRow(buildMaterialSection, '电子黏土产线', ['建材'])
    await expectRow(buildMaterialSection, '船体部件产线', ['目标', '建材'])
    // 3.1.4 required 项显示固定 ware 名与需求标签
    await expectRow(buildMaterialSection, '量子管', ['材料'])
    await expectRow(productionSection, '量子管产线', ['材料'])
    // 3.1.5 每个 preview 项只有展示锁，不提供编辑控件
    await expect(page.locator('[data-testid="preview-section"] .derived-badge')).toHaveCount(await previewRows.count())
  })

  test('3.2 Case: 分组 card 显示 moduleId 去重计数', async ({ page }) => {
    // 3.2.1 状态: Preview 面板已加载且有预览结果
    await addProductionGoal(page, 'hullparts')
    await selectFlowPlan(page)
    await setBuildMaterialPlanning(page, true)
    // 3.2.2 在分组 header 内定位计数
    // 3.2.3 断言计数等于固定 moduleId 去重数
    const buildMaterial = previewSection(page, /建材产线分配|Build Material Allocation/)
    const production = previewSection(page, /生产产线|Production Lines/)
    await expect(buildMaterial.locator('.allocation-group-name')).toHaveText('E1-S1')
    await expect(buildMaterial.locator('.allocation-group-count')).toHaveText('2')
    await expect(production.locator('.allocation-group-name')).toHaveText('lf-1-g2')
    await expect(production.locator('.allocation-group-count')).toHaveText('1')
  })

  test('3.3 Case: checkbox 切换影响预览', async ({ page }) => {
    // 3.3.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    const checkbox = buildMaterialCheckbox(page)
    // 3.3.2 勾选建材产线 checkbox
    await setBuildMaterialPlanning(page, true)
    // 3.3.3 断言建材产线区可见
    await expect(previewSection(page, /建材产线分配|Build Material Allocation/)).toHaveCount(1)
    // 3.3.4 取消建材产线 checkbox
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
    // 3.3.5 关闭后建材分组隐藏，用户目标仍保留
    await expect(previewSection(page, /建材产线分配|Build Material Allocation/)).toHaveCount(0)
    const production = previewSection(page, /生产产线|Production Lines/)
    await expect(production.locator('.allocation-group-name')).toHaveText('E1-S1')
    await expect(production.locator('.allocation-group-count')).toHaveText('1')
    await expectRow(production, '能量电池产线', ['目标'])
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
  })

  test('3.4 Case: 无规划模式 preview 生成', async ({ page }) => {
    // 3.4.1 添加 production-rate 目标
    await addProductionGoal(page)
    // 3.4.2 选择无规划
    const flowTrigger = page.locator('[data-testid="build-plan-flow-menu-trigger"]')
    await expect(flowTrigger).toBeVisible()
    await flowTrigger.click()
    const menu = page.locator('[data-testid="build-plan-flow-menu"]')
    await expect(menu).toBeVisible()
    await menu.locator('[data-testid="flow-plan-menu-item-unplanned"]').click()
    await expect(page.locator('[data-testid="build-plan-flow-menu-label"]')).toHaveText(/无规划|Unplanned Line/)
    // 3.4.3 断言待规划分组
    const unmatched = page.locator('.allocation-group--unmatched')
    await expect(unmatched).toBeVisible()
    // 3.4.4 断言公开预览精确保留目标
    const production = previewSection(page, /生产产线|Production Lines/)
    await expect(production.locator('.allocation-group-name')).toHaveText('待规划产线')
    await expect(production.locator('.allocation-group-count')).toHaveText('1')
    await expectRow(production, '能量电池产线', ['目标'])
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
  })

  test('3.5 Case: Preview 项名称显示规则', async ({ page }) => {
    // 3.5.1 状态: Preview 面板已加载
    await addProductionGoal(page, 'hullparts')
    await selectFlowPlan(page)
    await setBuildMaterialPlanning(page, true)
    // 3.5.2 在预览区定位名称
    const buildMaterialSection = previewSection(page, /建材产线分配|Build Material Allocation/)
    const productionSection = previewSection(page, /生产产线|Production Lines/)
    // 3.5.3 derived 项显示 module 名称
    await expect(buildMaterialSection.locator('.goal-name').filter({ hasText: '船体部件产线' })).toHaveCount(1)
    // 3.5.4 required 项显示 ware 名称
    await expect(productionSection.locator('.goal-name').filter({ hasText: '量子管' })).toHaveCount(1)
  })

  test('3.6 Case: 用户目标区与 preview 区分离', async ({ page }) => {
    // 3.6.1 状态: Preview 面板已加载
    await buildPreviewState(page)
    // 3.6.2 在 preview 区定位 goal rows
    const preview = page.locator('[data-testid="preview-section"]')
    await expect(preview.locator('.goal-row')).toHaveCount(1)
    // 3.6.3 preview 区不含数量输入框
    const inputs = page.locator('[data-testid="preview-section"]').locator('input[type="number"]')
    await expect(inputs).toHaveCount(0)
    // 3.6.4 preview 区不含删除按钮
    const removeBtns = page.locator('[data-testid="preview-section"]').locator('.remove-btn')
    await expect(removeBtns).toHaveCount(0)
  })

  test('4.1 Bug: 无规划仍显示 unmatched 且不移除用户目标', async ({ page }) => {
    await buildPreviewState(page)
    await page.locator('[data-testid="build-plan-flow-menu-trigger"]').click()
    const unplanned = page.locator('[data-testid="flow-plan-menu-item-unplanned"]')
    await expect(unplanned).toBeVisible()
    await unplanned.click()
    await expect(page.locator('[data-testid="build-plan-flow-menu-label"]')).toHaveText(/无规划|Unplanned Line/)
    await expect(page.locator('.allocation-group--unmatched')).toBeVisible()
    await expect(page.getByTestId('goal-item-energycells')).toBeVisible()
    const production = previewSection(page, /生产产线|Production Lines/)
    await expect(production.locator('.allocation-group-name')).toHaveText('待规划产线')
    await expect(production.locator('.allocation-group-count')).toHaveText('1')
    await expectRow(production, '能量电池产线', ['目标'])
  })
})
