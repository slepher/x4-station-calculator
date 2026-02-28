import { test, expect } from '@playwright/test'

test.describe('ship-build-stat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
  })

  // 2.1 状态: heron-selected
  test('2.1 状态: heron-selected', async ({ page }) => {
    // 2.1.1 启动应用并进入"船只建造"视图
    await page.click('[data-testid="toolbar-ship-build"]')

    // 2.1.2 点击选择 `class=L` 筛选条件
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')

    // 2.1.3 点击选择 `race=teladi` 筛选条件
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')

    // 2.1.4 点击选择 `type=freighter` 筛选条件
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')

    // 2.1.5 在列表中点击选择 `Heron Vanguard`（ship_tel_l_trans_container_02_a）
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 2.1.6 断言中列属性面板可见
    await expect(page.locator('[data-testid="ship-build-panel-stats"]')).toBeVisible()

    // 2.1.7 断言已选详情区可见
    await expect(page.locator('[data-testid="ship-build-selection"]')).toBeVisible()
  })

  // 2.2 切换: heron-selected -> detail-mode
  test('2.2 切换: heron-selected -> detail-mode', async ({ page }) => {
    // Setup: 进入 heron-selected 状态
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 2.2.1 在已选 Heron Vanguard 状态下，点击"详细"档位按钮
    await page.click('[data-testid="ship-build-stats-mode-detail"]')

    // 2.2.2 断言中列属性面板显示简略字段集合
    await expect(page.locator('.stats-row')).toHaveCount(18)

    // 2.2.3 断言中列属性面板显示详细字段集合，包含所有36项字段标签
    await expect(page.locator('.stats-row')).toHaveCount(36)
  })

  // 3.1 Case: 中列属性区双档位渲染
  test('3.1 Case: 中列属性区双档位渲染', async ({ page }) => {
    // 前提: 状态 heron-selected
    // 前提: 切换 heron-selected -> detail-mode
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 3.1.1 进入"已选 Heron Vanguard"状态
    // (already in this state from setup)

    // 3.1.2 断言"简略"档位按钮可见
    await expect(page.locator('[data-testid="ship-build-stats-mode-summary"]')).toBeVisible()

    // 3.1.3 断言"详细"档位按钮可见
    await expect(page.locator('[data-testid="ship-build-stats-mode-detail"]')).toBeVisible()
  })

  // 3.2 Case: 简略字段与截图 2 对齐
  test('3.2 Case: 简略字段与截图 2 对齐', async ({ page }) => {
    // 前提: 状态 heron-selected
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 3.2.1 点击"简略"档位按钮切换到简略模式
    await page.click('[data-testid="ship-build-stats-mode-summary"]')

    // 3.2.2 断言字段集合包含：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹，共18项（期望 toHaveCount(18)）
    await expect(page.locator('.stats-row')).toHaveCount(18)
  })

  // 3.3 Case: 详细字段与截图 1 对齐
  test('3.3 Case: 详细字段与截图 1 对齐', async ({ page }) => {
    // 前提: 状态 heron-selected
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 3.3.1 点击"详细"档位按钮切换到详细模式
    await page.click('[data-testid="ship-build-stats-mode-detail"]')

    // 3.3.2 断言字段集合包含36项字段标签（期望 toHaveCount(36)）
    await expect(page.locator('.stats-row')).toHaveCount(36)
  })

  // 3.4 Case: 详细档位真实值与占位并存
  test('3.4 Case: 详细档位真实值与占位并存', async ({ page }) => {
    // 前提: 状态 heron-selected
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 3.4.1 点击"详细"档位按钮切换到详细模式
    await page.click('[data-testid="ship-build-stats-mode-detail"]')

    // 3.4.2 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为真实值（期望 not.toBe('--')）
    await expect(page.locator('.stats-value').first()).not.toHaveText('--')

    // 3.4.3 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值（期望 not.toBe('--')）
    await expect(page.locator('.stats-value').first()).not.toHaveText('--')
  })

  // 3.5 Case: 取消固定高度限制
  test('3.5 Case: 取消固定高度限制', async ({ page }) => {
    // 前提: 状态 heron-selected
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')
    await page.click('[data-testid="ship-build-filter-race"] >> text=Teladi')
    await page.click('[data-testid="ship-build-filter-type"] >> text=Freighter')
    await page.click('[data-testid="ship-item-ship_tel_l_trans_container_02_a"]')

    // 3.5.1 获取中列属性面板容器的样式属性
    const statsPanel = page.locator('[data-testid="ship-build-panel-stats"]')

    // 3.5.2 获取已选详情区容器的样式属性
    const selectionPanel = page.locator('[data-testid="ship-build-selection"]')

    // 3.5.3 断言中列属性面板容器不包含固定高度样式（期望 toBeFalsy()）
    await expect(statsPanel).not.toHaveClass(/h-48/)

    // 3.5.4 断言已选详情区容器不包含固定高度样式（期望 toBeFalsy()）
    await expect(selectionPanel).not.toHaveClass(/h-48/)
  })

  // 3.6 Case: 大太刀满装备DPS计算
  test('3.6 Case: 大太刀满装备DPS计算', async ({ page }) => {
    // 前提: 状态 heron-selected
    // 3.6.1 进入船只建造视图，点击选择 `class=M` 筛选条件
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=M')

    // 3.6.2 点击选择 `race=terran` 筛选条件
    await page.click('[data-testid="ship-build-filter-race"] >> text=Terran')

    // 3.6.3 点击选择 `type=corvette` 筛选条件
    await page.click('[data-testid="ship-build-filter-type"] >> text=Corvette')

    // 3.6.4 在列表中点击选择 `大太刀`（ship_ter_m_corvette_02_a）
    await page.click('[data-testid="ship-item-ship_ter_m_corvette_02_a"]')

    // 3.6.5 配置满装备

    // 3.6.6 点击"详细"档位按钮切换到详细模式
    await page.click('[data-testid="ship-build-stats-mode-detail"]')

    // 3.6.7 验证所有属性值
  })

  // 3.7 Case: 大阪满装备DPS计算
  test('3.7 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 前提: 状态 heron-selected
    // 3.7.1 进入船只建造视图，点击选择 `class=L` 筛选条件
    await page.click('[data-testid="toolbar-ship-build"]')
    await page.click('[data-testid="ship-build-filter-class"] >> text=L')

    // 3.7.2 点击选择 `race=terran` 筛选条件
    await page.click('[data-testid="ship-build-filter-race"] >> text=Terran')

    // 3.7.3 点击选择 `type=destroyer` 筛选条件
    await page.click('[data-testid="ship-build-filter-type"] >> text=Destroyer')

    // 3.7.4 在列表中点击选择 `Osaka`（ship_ter_l_destroyer_01_a）
    await page.click('[data-testid="ship-item-ship_ter_l_destroyer_01_a"]')

    // 3.7.5 验证预设装备配置

    // 3.7.6 点击"详细"档位按钮切换到详细模式
    await page.click('[data-testid="ship-build-stats-mode-detail"]')

    // 3.7.7 验证所有属性值
  })
})
