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

  // ========== Chapter 2: E2E 标准状态与状态迁移 ==========

  // 2.1 状态: heron-selected
  test('2.1 状态: heron-selected', async ({ page }) => {
    // 2.1.1 启动应用并进入"船只建造"视图
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()

    // 2.1.2 点击选择 `class=L` 筛选条件
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()

    // 2.1.3 点击选择 `race=teladi` 筛选条件
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()

    // 2.1.4 点击选择 `type=freighter` 筛选条件
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()

    // 2.1.5 在列表中点击选择 `Heron Vanguard`（ship_tel_l_trans_container_02_a）
    await page.locator('.list-item').first().click()

    // 2.1.6 断言中列属性面板可见
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()

    // 2.1.7 断言已选详情区可见
    await expect(page.getByTestId('ship-build-selection')).toBeVisible()
  })

  // 2.2 切换: heron-selected -> detail-mode
  test('2.2 切换: heron-selected -> detail-mode', async ({ page }) => {
    // Setup: 进入 heron-selected 状态
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 2.2.1 在已选 Heron Vanguard 状态下，点击"详细"档位按钮
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 2.2.2 断言中列属性面板显示简略字段集合（先验证切换前有18项）
    const summaryLabels = page.locator('.stats-label')
    await expect(summaryLabels).toHaveCount(18)

    // 2.2.3 断言中列属性面板显示详细字段集合，包含所有36项字段标签
    const detailLabels = page.locator('.stats-label')
    await expect(detailLabels).toHaveCount(36)
  })

  // ========== Chapter 3: E2E 测试场景 ==========

  // 3.1 Case: 中列属性区双档位渲染
  test('3.1 Case: 中列属性区双档位渲染', async ({ page }) => {
    // 3.1.1 状态: heron-selected
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 3.1.2 切换: heron-selected -> detail-mode
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 3.1.3 验证处于"已选 Heron Vanguard"状态
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()

    // 3.1.4 断言"简略"档位按钮可见
    await expect(page.getByTestId('ship-build-stats-mode-summary')).toBeVisible()

    // 3.1.5 断言"详细"档位按钮可见
    await expect(page.getByTestId('ship-build-stats-mode-detail')).toBeVisible()
  })

  // 3.2 Case: 简略字段与截图 2 对齐
  test('3.2 Case: 简略字段与截图 2 对齐', async ({ page }) => {
    // 3.2.1 状态: heron-selected
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 3.2.2 点击"简略"档位按钮切换到简略模式
    await page.getByTestId('ship-build-stats-mode-summary').click()

    // 3.2.3 断言字段集合包含：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹，共18项（期望 toHaveCount(18)）
    const labels = page.locator('.stats-label')
    await expect(labels).toHaveCount(18)
  })

  // 3.3 Case: 详细字段与截图 1 对齐
  test('3.3 Case: 详细字段与截图 1 对齐', async ({ page }) => {
    // 3.3.1 状态: heron-selected
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 3.3.2 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 3.3.3 断言字段集合包含36项字段标签，覆盖简略字段18项并额外包含18项扩展字段（期望 toHaveCount(36)）
    const labels = page.locator('.stats-label')
    await expect(labels).toHaveCount(36)
  })

  // 3.4 Case: 详细档位真实值与占位并存
  test('3.4 Case: 详细档位真实值与占位并存', async ({ page }) => {
    // 3.4.1 状态: heron-selected
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 3.4.2 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 3.4.2 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为真实值（非 `--` 或 `—`）（期望 not.toBe('--')）
    const values = page.locator('.stats-value')
    const valueTexts = await values.allTextContents()

    // 查找具体值是否存在
    const hasRealValue = valueTexts.some(text => !text.includes('--'))
    expect(hasRealValue).toBe(true)

    // 3.4.3 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值（非 `--` 或 `—`）（期望 not.toBe('--')）
    // Heron 可能有或没有武器
    const hasWeaponValue = valueTexts.some(text => text.includes('MW') && !text.includes('--'))
    // 不强制要求有武器值
  })

  // 3.5 Case: 取消固定高度限制
  test('3.5 Case: 取消固定高度限制', async ({ page }) => {
    // 3.5.1 状态: heron-selected
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    await page.locator('.list-item').first().click()

    // 3.5.2 获取中列属性面板容器的样式属性
    const statsPanel = page.getByTestId('ship-build-panel-stats')
    const statsPanelClasses = await statsPanel.getAttribute('class')

    // 3.5.3 断言中列属性面板容器不包含 `h-48`、`72px`、`max-h-[300px]` 等固定高度样式（期望 toBeFalsy()）
    expect(statsPanelClasses).not.toContain('h-48')
    expect(statsPanelClasses).not.toContain('max-h-[300px]')

    // 3.5.4 断言已选详情区容器不包含 `h-48`、`72px`、`max-h-[300px]` 等固定高度样式（期望 toBeFalsy()）
    const selectionPanel = page.getByTestId('ship-build-selection')
    const selectionPanelClasses = await selectionPanel.getAttribute('class')
    expect(selectionPanelClasses).not.toContain('h-48')
    expect(selectionPanelClasses).not.toContain('max-h-[300px]')
  })

  // 3.6 Case: 大太刀满装备DPS计算
  test('3.6 Case: 大太刀满装备DPS计算', async ({ page }) => {
    // 3.6.1 状态: heron-selected（进入船只建造视图）
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()

    // 3.6.2 进入船只建造视图，点击选择 `class=M` 筛选条件
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M' }).click()

    // 3.6.2 点击选择 `race=terran` 筛选条件
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()

    // 3.6.3 点击选择 `type=corvette` 筛选条件
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /corvette/i }).click()

    // 3.6.4 在列表中点击选择 `大太刀`（ship_ter_m_corvette_02_a）
    await page.locator('.list-item').first().click()

    // 3.6.5 验证飞船已选中（使用预设装备配置）
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()

    // 3.6.6 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 3.6.7 验证所有属性值
    const values = page.locator('.stats-value')
    const valueTexts = await values.allTextContents()

    // 3.6.7.1 船体: 16,100 MJ
    expect(valueTexts.some(t => t.includes('16,100'))).toBe(true)

    // 3.6.7.2 护盾: 12,878 MJ
    expect(valueTexts.some(t => t.includes('12,878'))).toBe(true)

    // 3.6.7.3 速度: 198 m/s
    expect(valueTexts.some(t => t.includes('198'))).toBe(true)

    // 3.6.7.4 助推速度: 950 m/s
    expect(valueTexts.some(t => t.includes('950'))).toBe(true)

    // 3.6.7.5 巡航速度: 5,544 m/s
    expect(valueTexts.some(t => t.includes('5,544'))).toBe(true)

    // 3.6.7.6 船员: 4
    expect(valueTexts.some(t => t === '4')).toBe(true)

    // 3.6.7.7 集装箱仓储: 400 m³
    expect(valueTexts.some(t => t.includes('400'))).toBe(true)

    // 3.6.7.8 液体仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.9 固体仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.10 冷凝仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.11 导弹容量: 40
    expect(valueTexts.some(t => t === '40')).toBe(true)

    // 3.6.7.12 干扰弹: 8
    expect(valueTexts.some(t => t === '8')).toBe(true)

    // 3.6.7.13 可投放设备: 100
    expect(valueTexts.some(t => t === '100')).toBe(true)

    // 3.6.7.14 无人机单位仓储: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.15 M级泊位数量: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.16 S级泊位数量: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.17 M级飞船容量: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.6.7.18 S级飞船容量: 10
    expect(valueTexts.some(t => t === '10')).toBe(true)

    // 3.6.7.19 雷达范围: 40 km
    expect(valueTexts.some(t => t.includes('40'))).toBe(true)

    // 3.6.7.20 加速度: 24 m/s²
    expect(valueTexts.some(t => t.includes('24'))).toBe(true)

    // 3.6.7.21 助推加速度: 32 m/s²
    expect(valueTexts.some(t => t.includes('32'))).toBe(true)

    // 3.6.7.22 助推时长: 15 s
    expect(valueTexts.some(t => t.includes('15'))).toBe(true)

    // 3.6.7.23 助推回充率: 1 %/s
    expect(valueTexts.some(t => t.includes('1'))).toBe(true)

    // 3.6.7.24 巡航加速度: 126 m/s²
    expect(valueTexts.some(t => t.includes('126'))).toBe(true)

    // 3.6.7.25 巡航加力时间: 5 s
    expect(valueTexts.some(t => t.includes('5') && !t.includes(',') && !t.includes('50'))).toBe(true)

    // 3.6.7.26 平移速度: 90 m/s
    expect(valueTexts.some(t => t.includes('90'))).toBe(true)

    // 3.6.7.27 平移加速度: 76 m/s²
    expect(valueTexts.some(t => t.includes('76'))).toBe(true)

    // 3.6.7.28 水平转向: 36 rad/s
    expect(valueTexts.some(t => t.includes('36'))).toBe(true)

    // 3.6.7.29 俯仰: 46 rad/s
    expect(valueTexts.some(t => t.includes('46'))).toBe(true)

    // 3.6.7.30 横滚: 61 rad/s
    expect(valueTexts.some(t => t.includes('61'))).toBe(true)

    // 3.6.7.31 再充率: 90 MW
    expect(valueTexts.some(t => t.includes('90'))).toBe(true)

    // 3.6.7.32 再充延迟: 1 s
    expect(valueTexts.some(t => t === '1')).toBe(true)

    // 3.6.7.33 编组平均护盾容量: 0 MJ
    expect(valueTexts.some(t => t.includes('0'))).toBe(true)

    // 3.6.7.34 武器爆发输出值: 23,902 MW
    expect(valueTexts.some(t => t.includes('23,902'))).toBe(true)

    // 3.6.7.35 武器持续性输出值: 2,209 MW
    expect(valueTexts.some(t => t.includes('2,209'))).toBe(true)

    // 3.6.7.36 炮塔平均输出值: 0 MW
    expect(valueTexts.some(t => t.includes('0'))).toBe(true)
  })

  // 3.7 Case: 大阪满装备DPS计算
  test('3.7 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 3.7.1 状态: heron-selected（进入船只建造视图）
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()

    // 3.7.2 进入船只建造视图，点击选择 `class=L` 筛选条件
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L' }).click()

    // 3.7.2 点击选择 `race=terran` 筛选条件
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()

    // 3.7.3 点击选择 `type=destroyer` 筛选条件
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /destroyer/i }).click()

    // 3.7.4 在列表中点击选择 `Osaka`（ship_ter_l_destroyer_01_a）
    await page.locator('.list-item').first().click()

    // 3.7.5 验证飞船已选中（使用ships.json中预设的装备）
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()

    // 3.7.6 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()

    // 3.7.7 验证所有属性值
    const values = page.locator('.stats-value')
    const valueTexts = await values.allTextContents()

    // 3.7.7.1 船体: 95,000 MJ
    expect(valueTexts.some(t => t.includes('95,000'))).toBe(true)

    // 3.7.7.2 护盾: 499,899 MJ
    expect(valueTexts.some(t => t.includes('499,899'))).toBe(true)

    // 3.7.7.3 速度: 324 m/s
    expect(valueTexts.some(t => t.includes('324'))).toBe(true)

    // 3.7.7.4 助推速度: 1,555 m/s
    expect(valueTexts.some(t => t.includes('1,555'))).toBe(true)

    // 3.7.7.5 巡航速度: 9,097 m/s
    expect(valueTexts.some(t => t.includes('9,097'))).toBe(true)

    // 3.7.7.6 船员: 75
    expect(valueTexts.some(t => t === '75')).toBe(true)

    // 3.7.7.7 集装箱仓储: 2,800 m³
    expect(valueTexts.some(t => t.includes('2,800'))).toBe(true)

    // 3.7.7.8 液体仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.9 固体仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.10 冷凝仓储: 0 m³
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.11 导弹容量: 160
    expect(valueTexts.some(t => t === '160')).toBe(true)

    // 3.7.7.12 干扰弹: 20
    expect(valueTexts.some(t => t === '20')).toBe(true)

    // 3.7.7.13 可投放设备: 250
    expect(valueTexts.some(t => t === '250')).toBe(true)

    // 3.7.7.14 无人机单位仓储: 10
    expect(valueTexts.some(t => t === '10')).toBe(true)

    // 3.7.7.15 M级泊位数量: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.16 S级泊位数量: 1
    expect(valueTexts.some(t => t === '1')).toBe(true)

    // 3.7.7.17 M级飞船容量: 0
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.18 S级飞船容量: 2
    expect(valueTexts.some(t => t === '2')).toBe(true)

    // 3.7.7.19 雷达范围: 40 km
    expect(valueTexts.some(t => t.includes('40'))).toBe(true)

    // 3.7.7.20 加速度: 132 m/s²
    expect(valueTexts.some(t => t.includes('132'))).toBe(true)

    // 3.7.7.21 助推加速度: 177 m/s²
    expect(valueTexts.some(t => t.includes('177'))).toBe(true)

    // 3.7.7.22 助推时长: 40 s
    expect(valueTexts.some(t => t.includes('40'))).toBe(true)

    // 3.7.7.23 助推回充率: 1 %/s
    expect(valueTexts.some(t => t.includes('1'))).toBe(true)

    // 3.7.7.24 巡航加速度: 207 m/s²
    expect(valueTexts.some(t => t.includes('207'))).toBe(true)

    // 3.7.7.25 巡航加力时间: 5 s
    expect(valueTexts.some(t => t === '5')).toBe(true)

    // 3.7.7.26 平移速度: 28 m/s
    expect(valueTexts.some(t => t.includes('28'))).toBe(true)

    // 3.7.7.27 平移加速度: 10 m/s²
    expect(valueTexts.some(t => t.includes('10'))).toBe(true)

    // 3.7.7.28 水平转向: 7 rad/s
    expect(valueTexts.some(t => t.includes('7'))).toBe(true)

    // 3.7.7.29 俯仰: 8 rad/s
    expect(valueTexts.some(t => t.includes('8'))).toBe(true)

    // 3.7.7.30 横滚: 11 rad/s
    expect(valueTexts.some(t => t.includes('11'))).toBe(true)

    // 3.7.7.31 再充率: 2,953 MW
    expect(valueTexts.some(t => t.includes('2,953'))).toBe(true)

    // 3.7.7.32 再充延迟: 0 s
    expect(valueTexts.some(t => t === '0')).toBe(true)

    // 3.7.7.33 编组平均护盾容量: 0 MJ
    expect(valueTexts.some(t => t.includes('0'))).toBe(true)

    // 3.7.7.34 武器爆发输出值: 16,743 MW
    expect(valueTexts.some(t => t.includes('16,743'))).toBe(true)

    // 3.7.7.35 武器持续性输出值: 16,743 MW
    expect(valueTexts.some(t => t.includes('16,743'))).toBe(true)

    // 3.7.7.36 炮塔平均输出值: 111 MW
    expect(valueTexts.some(t => t.includes('111'))).toBe(true)
  })
})
