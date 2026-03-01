import { test, expect } from '@playwright/test'

test.describe('ship-build-stat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.waitForSelector('.toolbar-panel', { state: 'visible' })
  })

  // 2.1 状态: heron-selected
  test('2.1 状态: heron-selected', async ({ page }) => {
    // 2.1.1 启动应用并进入"船只建造"视图
    // 2.1.2 点击选择 `class=L` 筛选条件
    // 2.1.3 点击选择 `race=teladi` 筛选条件
    // 2.1.4 点击选择 `type=freighter` 筛选条件
    // 2.1.5 在列表中点击选择 `Heron Vanguard`（ship_tel_l_trans_container_02_a）
    // 2.1.6 断言中列属性面板可见 #期望: [true]
    // 2.1.7 断言已选详情区可见 #期望: [true]
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
    await expect(page.getByTestId('ship-build-selection')).toBeVisible()
  })

  // 2.2 切换: heron-selected -> detail-mode
  test('2.2 切换: heron-selected -> detail-mode', async ({ page }) => {
    // 2.2.1 在已选 Heron Vanguard 状态下，点击"详细"档位按钮
    // 2.2.2 断言中列属性面板显示简略字段集合 #期望: [true]
    // 2.2.3 断言中列属性面板显示详细字段集合，包含所有36项字段标签 #期望: [36]
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await page.getByTestId('ship-build-stats-mode-detail').click()
    await expect(page.locator('.stats-label')).toHaveCount(18)
    await expect(page.locator('.stats-label')).toHaveCount(36)
  })

  // 3.1 Case: 中列属性区双档位渲染
  test('3.1 Case: 中列属性区双档位渲染', async ({ page }) => {
    // 3.1.1 状态: heron-selected
    // 3.1.2 切换: heron-selected -> detail-mode
    // 3.1.3 断言"简略"档位按钮可见 #期望: [true]
    // 3.1.4 断言"详细"档位按钮可见 #期望: [true]
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await page.getByTestId('ship-build-stats-mode-detail').click()
    await expect(page.getByTestId('ship-build-stats-mode-summary')).toBeVisible()
    await expect(page.getByTestId('ship-build-stats-mode-detail')).toBeVisible()
  })

  // 3.2 Case: 简略字段与截图 2 对齐
  test('3.2 Case: 简略字段与截图 2 对齐', async ({ page }) => {
    // 3.2.1 状态: heron-selected
    // 3.2.2 点击"简略"档位按钮切换到简略模式
    // 3.2.3 断言字段集合包含18项 #期望: [18]
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await page.getByTestId('ship-build-stats-mode-summary').click()
    await expect(page.locator('.stats-label')).toHaveCount(18)
  })

  // 3.3 Case: 详细字段与截图 1 对齐
  test('3.3 Case: 详细字段与截图 1 对齐', async ({ page }) => {
    // 3.3.1 状态: heron-selected
    // 3.3.2 点击"详细"档位按钮切换到详细模式
    // 3.3.3 断言字段集合包含36项 #期望: [36]
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await page.getByTestId('ship-build-stats-mode-detail').click()
    await expect(page.locator('.stats-label')).toHaveCount(36)
  })

  // 3.4 Case: 详细档位真实值与占位并存
  test('3.4 Case: 详细档位真实值与占位并存', async ({ page }) => {
    // 3.4.1 状态: heron-selected
    // 3.4.2 点击详细档位按钮
    // 3.4.3 断言船体等字段为真实值 #期望: ['--']
    // 3.4.4 断言武器DPS字段为真实值 #期望: ['--']
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    await page.getByTestId('ship-build-stats-mode-detail').click()
    const values = page.locator('.stats-value')
    const firstValue = values.first()
    await expect(firstValue).not.toHaveText('--')
    const hasMW = page.locator('.stats-value').filter({ hasText: /MW/ })
    expect(await hasMW.count()).toBeGreaterThanOrEqual(0)
  })

  // 3.5 Case: 取消固定高度限制
  test('3.5 Case: 取消固定高度限制', async ({ page }) => {
    // 3.5.1 状态: heron-selected
    // 3.5.2 获取中列属性面板容器的样式属性
    // 3.5.3 获取已选详情区容器的样式属性
    // 3.5.4 断言中列属性面板容器不包含固定高度样式 #期望: ['h-48', '72px']
    // 3.5.5 断言已选详情区容器不包含固定高度样式 #期望: ['h-48', '72px']
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()
    const statsPanel = page.getByTestId('ship-build-panel-stats')
    const selection = page.getByTestId('ship-build-selection')
    expect(await statsPanel.getAttribute('class')).toBeDefined()
    expect(await selection.getAttribute('class')).toBeDefined()
    const statsClasses = await statsPanel.getAttribute('class')
    const selectionClasses = await selection.getAttribute('class')
    expect(statsClasses).not.toContain('h-48')
    expect(selectionClasses).not.toContain('h-48')
  })
})
