import { test, expect } from '@playwright/test'

// Helper functions
const openShipBuild = async (page: any) => {
  await page.goto('/')

  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('isTestEnv', 'true')
  })
  await page.reload()
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()
}

const enterShipState = async (page: any, config: { classLabel: string; racePattern: RegExp; shipPattern: RegExp }) => {
  await openShipBuild(page)
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: config.classLabel, exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: config.racePattern }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: config.shipPattern }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
}

const enterOdachiState = async (page: any) => {
  await enterShipState(page, { classLabel: 'M', racePattern: /terran/i, shipPattern: /Odachi|大太刀/ })
}

const enterOsakaState = async (page: any) => {
  await enterShipState(page, { classLabel: 'L', racePattern: /terran/i, shipPattern: /Osaka|大阪/ })
}

const switchToSlotTab = async (page: any, label: string) => {
  // Click on slot type button in left rail (E/S/W/T)
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: new RegExp(`^${label}$`) }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const selectEquipment = async (page: any, slotLabel: string, equipmentNamePattern: RegExp) => {
  // 1. Switch to the slot type tab (E/S/W/T)
  await switchToSlotTab(page, slotLabel)

  // 2. Click the first slot button to open the picker
  const slotButton = page.locator('[data-testid^="slot-"]').first()
  await expect(slotButton).toBeVisible()
  await slotButton.click()

  // 3. Wait for picker to open and find the equipment candidate
  const picker = page.getByTestId('equipment-picker')
  await expect(picker).toBeVisible()

  // 4. Click on the matching equipment candidate
  const candidate = picker.locator('[data-testid^="candidate-"]').filter({ hasText: equipmentNamePattern }).first()
  await expect(candidate).toBeVisible()
  await candidate.click()

  // 5. Confirm the selection
  const confirmBtn = page.getByTestId('picker-confirm')
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()
}


const getStatValue = async (page: any, labelText: string) => {
  const label = page.locator('.stats-label').filter({ hasText: new RegExp(labelText) }).first()
  const value = label.locator('..').locator('.stats-value')
  return await value.textContent()
}

test.describe('ship-build-stat', () => {
  test.beforeEach(async ({ page }) => {
    await openShipBuild(page)
  })

  // 2.1 状态: heron-selected
  test('2.1 状态: heron-selected', async ({ page }) => {
    // 2.1.1 启动应用并进入"船只建造"视图
    await openShipBuild(page)
    // 2.1.2 点击选择 `class=L` 筛选条件
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
    // 2.1.3 点击选择 `race=teladi` 筛选条件
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /teladi/i }).click()
    // 2.1.4 点击选择 `type=freighter` 筛选条件
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /freighter/i }).click()
    // 2.1.5 在列表中点击选择 `Heron Vanguard`（ship_tel_l_trans_container_02_a）
    await page.locator('.list-item').first().click()
    // 2.1.6 断言中列属性面板可见 #期望: [true]
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
    // 2.1.7 断言已选详情区可见 #期望: [true]
    await expect(page.getByTestId('ship-build-selection')).toBeVisible()
  })

  // 2.2 切换: heron-selected -> detail-mode
  test('2.2 切换: heron-selected -> detail-mode', async ({ page }) => {
    // 2.2.1 在已选 Heron Vanguard 状态下，点击"详细"档位按钮
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 2.2.2 断言中列属性面板显示简略字段集合 #期望: [true]
    await expect(page.locator('.stats-label')).toHaveCount(18)
    // 2.2.3 断言中列属性面板显示详细字段集合，包含所有36项字段标签 #期望: [36]
    await expect(page.locator('.stats-label')).toHaveCount(36)
  })

  // 3.1 Case: 中列属性区双档位渲染
  test('3.1 Case: 中列属性区双档位渲染', async ({ page }) => {
    // 3.1.1 状态: heron-selected
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    // 3.1.2 切换: heron-selected -> detail-mode
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.1.3 断言"简略"档位按钮可见 #期望: [true]
    await expect(page.getByTestId('ship-build-stats-mode-summary')).toBeVisible()
    // 3.1.4 断言"详细"档位按钮可见 #期望: [true]
    await expect(page.getByTestId('ship-build-stats-mode-detail')).toBeVisible()
  })

  // 3.2 Case: 简略字段与截图 2 对齐
  test('3.2 Case: 简略字段与截图 2 对齐', async ({ page }) => {
    // 3.2.1 状态: heron-selected
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    // 3.2.2 点击"简略"档位按钮切换到简略模式
    await page.getByTestId('ship-build-stats-mode-summary').click()
    // 3.2.3 断言字段集合包含18项 #期望: [18]
    await expect(page.locator('.stats-label')).toHaveCount(18)
  })

  // 3.3 Case: 详细字段与截图 1 对齐
  test('3.3 Case: 详细字段与截图 1 对齐', async ({ page }) => {
    // 3.3.1 状态: heron-selected
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    // 3.3.2 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.3.3 断言字段集合包含36项 #期望: [36]
    await expect(page.locator('.stats-label')).toHaveCount(36)
  })

  // 3.4 Case: 详细档位真实值与占位并存
  test('3.4 Case: 详细档位真实值与占位并存', async ({ page }) => {
    // 3.4.1 状态: heron-selected
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    // 3.4.2 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.4.3 断言船体等字段为真实值 #期望: ['--']
    const firstValue = page.locator('.stats-value').first()
    await expect(firstValue).not.toHaveText('--')
    // 3.4.4 断言武器DPS字段为真实值 #期望: ['--']
    const mwValues = page.locator('.stats-value').filter({ hasText: /MW/ })
    const firstMW = mwValues.first()
    expect(await firstMW.textContent()).not.toBe('--')
  })

  // 3.5 Case: 取消固定高度限制
  test('3.5 Case: 取消固定高度限制', async ({ page }) => {
    // 3.5.1 状态: heron-selected
    await enterShipState(page, { classLabel: 'L', racePattern: /teladi/i, shipPattern: /Heron|苍鹭/ })
    // 3.5.2 获取中列属性面板容器的样式属性
    const statsPanel = page.getByTestId('ship-build-panel-stats')
    // 3.5.3 获取已选详情区容器的样式属性
    const selection = page.getByTestId('ship-build-selection')
    // 3.5.4 断言中列属性面板容器不包含固定高度样式 #期望: ['h-48', '72px']
    const statsClasses = await statsPanel.getAttribute('class')
    expect(statsClasses).not.toContain('h-48')
    expect(statsClasses).not.toContain('72px')
    // 3.5.5 断言已选详情区容器不包含固定高度样式 #期望: ['h-48', '72px']
    const selectionClasses = await selection.getAttribute('class')
    expect(selectionClasses).not.toContain('h-48')
    expect(selectionClasses).not.toContain('72px')
  })

  // 3.6 Case: 大太刀满装备DPS计算
  test('3.6 Case: 大太刀满装备DPS计算', async ({ page }) => {
    // 3.6.1 状态: heron-selected
    await enterOdachiState(page)
    // 3.6.2 进入船只建造视图，点击选择 `class=M` 筛选条件
    const classFilter = page.getByTestId('ship-build-filter-class')
    await expect(classFilter).toBeVisible()
    // 3.6.3 点击选择 `race=terran` 筛选条件
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await expect(raceFilter).toBeVisible()
    // 3.6.4 点击选择 `type=corvette` 筛选条件
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await expect(typeFilter).toBeVisible()
    // 3.6.5 在列表中点击选择 `大太刀`（ship_ter_m_corvette_02_a）
    const shipItem = page.locator('.list-item').first()
    await expect(shipItem).toBeVisible()
    // 3.6.6 配置满装备
    const panelFit = page.getByTestId('ship-build-panel-fit')
    await expect(panelFit).toBeVisible()
    // 3.6.7 引擎槽位：选择装备 `engine_ter_m_allround_01_mk1` 数量1
    await selectEquipment(page, 'E', /Mk1/i)
    // 3.6.8 推进器槽位：选择装备 `thruster_gen_m_allround_01_mk1` 数量1
    await selectEquipment(page, 'T', /Mk1/i)
    // 3.6.9 护盾槽位：选择装备 `shield_ter_m_standard_02_mk2` 数量2
    await selectEquipment(page, 'S', /Mk2/i)
    // 3.6.10 武器槽位：选择装备 `weapon_ter_m_beam_01_mk2` 数量4
    await selectEquipment(page, 'W', /Mk2/i)
    await selectEquipment(page, 'W', /Mk2/i)
    await selectEquipment(page, 'W', /Mk2/i)
    await selectEquipment(page, 'W', /Mk2/i)
    // 3.6.11 炮塔槽位：选择装备 `turret_ter_m_beam_01_mk1` 数量2
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    // 3.6.12 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.6.13 验证所有属性值
    const statsLabels = page.locator('.stats-label')
    await expect(statsLabels).toHaveCount(36)
    // 3.6.14 断言船体 #期望: ['16,100 MJ']
    expect(await getStatValue(page, '船体')).toBe('16,100 MJ')
    // 3.6.15 断言护盾 #期望: ['12,878 MJ']
    expect(await getStatValue(page, '护盾')).toBe('12,878 MJ')
    // 3.6.16 断言速度 #期望: ['198 m/s']
    expect(await getStatValue(page, '速度')).toBe('198 m/s')
    // 3.6.17 断言助推速度 #期望: ['950 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('950 m/s')
    // 3.6.18 断言巡航速度 #期望: ['5,544 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('5,544 m/s')
    // 3.6.19 断言船员 #期望: ['4']
    expect(await getStatValue(page, '船员')).toBe('4')
    // 3.6.20 断言集装箱仓储 #期望: ['400 m³']
    expect(await getStatValue(page, '集装仓储')).toBe('400 m³')
    // 3.6.21 断言液体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m³')
    // 3.6.22 断言固体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m³')
    // 3.6.23 断言冷凝仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m³')
    // 3.6.24 断言导弹容量 #期望: ['40']
    expect(await getStatValue(page, '导弹')).toBe('40')
    // 3.6.25 断言干扰弹 #期望: ['8']
    expect(await getStatValue(page, '干扰弹')).toBe('8')
    // 3.6.26 断言可投放设备 #期望: ['100']
    expect(await getStatValue(page, '可投放设备')).toBe('100')
    // 3.6.27 断言无人机单位仓储 #期望: ['0']
    expect(await getStatValue(page, '单位')).toBe('0')
    // 3.6.28 断言M级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'M级泊位数量')).toBe('0')
    // 3.6.29 断言S级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'S级泊位数量')).toBe('0')
    // 3.6.30 断言M级飞船容量 #期望: ['0']
    expect(await getStatValue(page, 'M级飞船容量')).toBe('0')
    // 3.6.31 断言S级飞船容量 #期望: ['10']
    expect(await getStatValue(page, 'S级飞船容量')).toBe('10')
    // 3.6.32 断言雷达范围 #期望: ['40 km']
    expect(await getStatValue(page, '雷达范围')).toBe('40 km')
    // 3.6.33 断言加速度 #期望: ['24 m/s²']
    expect(await getStatValue(page, '加速')).toBe('24 m/s²')
    // 3.6.34 断言助推加速度 #期望: ['32 m/s²']
    expect(await getStatValue(page, '助推加速度')).toBe('32 m/s²')
    // 3.6.35 断言助推时长 #期望: ['15 s']
    expect(await getStatValue(page, '助推时长')).toBe('15 s')
    // 3.6.36 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.6.37 断言巡航加速度 #期望: ['126 m/s²']
    expect(await getStatValue(page, '巡航加速度')).toBe('126 m/s²')
    // 3.6.38 断言巡航加力时间 #期望: ['5 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('5 s')
    // 3.6.39 断言平移速度 #期望: ['90 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('90 m/s')
    // 3.6.40 断言平移加速度 #期望: ['76 m/s²']
    expect(await getStatValue(page, '平移加速度')).toBe('76 m/s²')
    // 3.6.41 断言水平转向 #期望: ['36 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('36 rad/s')
    // 3.6.42 断言俯仰 #期望: ['46 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('46 rad/s')
    // 3.6.43 断言横滚 #期望: ['61 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('61 rad/s')
    // 3.6.44 断言再充率 #期望: ['90 MW']
    expect(await getStatValue(page, '再充率')).toBe('90 MW')
    // 3.6.45 断言再充延迟 #期望: ['1 s']
    expect(await getStatValue(page, '再充延迟')).toBe('1 s')
    // 3.6.46 断言编组平均护盾容量 #期望: ['0 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('0 MJ')
    // 3.6.47 断言武器爆发输出值 #期望: ['23,902 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('23,902 MW')
    // 3.6.48 断言武器持续性输出值 #期望: ['2,209 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('2,209 MW')
    // 3.6.49 断言炮塔平均输出值 #期望: ['0 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('0 MW')
  })

  // 3.7 Case: 大阪满装备DPS计算
  test('3.7 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 3.7.1 状态: heron-selected
    await enterOsakaState(page)
    // 3.7.2 进入船只建造视图，点击选择 `class=L` 筛选条件
    const classFilter = page.getByTestId('ship-build-filter-class')
    await expect(classFilter).toBeVisible()
    // 3.7.3 点击选择 `race=terran` 筛选条件
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await expect(raceFilter).toBeVisible()
    // 3.7.4 点击选择 `type=destroyer` 筛选条件
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await expect(typeFilter).toBeVisible()
    // 3.7.5 在列表中点击选择 `Osaka`（ship_ter_l_destroyer_01_a）
    const shipItem = page.locator('.list-item').first()
    await expect(shipItem).toBeVisible()
    // 3.7.6 验证预设装备配置
    const panelFit = page.getByTestId('ship-build-panel-fit')
    await expect(panelFit).toBeVisible()
    // 3.7.7 引擎槽位：装备 `engine_ter_l_allround_01_mk1` 数量6
    await selectEquipment(page, 'E', /Mk1/i)
    await selectEquipment(page, 'E', /Mk1/i)
    await selectEquipment(page, 'E', /Mk1/i)
    await selectEquipment(page, 'E', /Mk1/i)
    await selectEquipment(page, 'E', /Mk1/i)
    await selectEquipment(page, 'E', /Mk1/i)
    // 3.7.8 推进器槽位：装备 `thruster_gen_l_allround_01_mk1` 数量1
    await selectEquipment(page, 'T', /Mk1/i)
    // 3.7.9 护盾槽位(专用L)：装备 `shield_ter_l_standard_01_mk2` 数量3
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    // 3.7.10 护盾槽位(专用L)：装备 `shield_ter_l_standard_01_mk3` 数量2
    await selectEquipment(page, 'S', /Mk3/i)
    await selectEquipment(page, 'S', /Mk3/i)
    // 3.7.11 护盾槽位(挂载M)：装备 `shield_ter_m_standard_02_mk1` 数量16
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    await selectEquipment(page, 'S', /Mk1/i)
    // 3.7.12 护盾槽位(挂载M)：装备 `shield_ter_m_standard_02_mk2` 数量20
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    await selectEquipment(page, 'S', /Mk2/i)
    // 3.7.13 主炮槽位：装备 `weapon_ter_l_destroyer_01_mk1` 数量6
    await selectEquipment(page, 'W', /Mk1/i)
    await selectEquipment(page, 'W', /Mk1/i)
    await selectEquipment(page, 'W', /Mk1/i)
    await selectEquipment(page, 'W', /Mk1/i)
    await selectEquipment(page, 'W', /Mk1/i)
    await selectEquipment(page, 'W', /Mk1/i)
    // 3.7.14 炮塔槽位：装备 `turret_ter_l_beam_01_mk1` 数量6
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    await selectEquipment(page, 'T', /Mk1/i)
    // 3.7.15 炮塔槽位：装备 `turret_tel_l_plasma_01_mk1` 数量3
    await selectEquipment(page, 'T', /Plasma/i)
    await selectEquipment(page, 'T', /Plasma/i)
    await selectEquipment(page, 'T', /Plasma/i)
    // 3.7.16 炮塔槽位：装备 `turret_ter_m_gatling_02_mk1` 数量8
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    await selectEquipment(page, 'T', /Gatling/i)
    // 3.7.17 炮塔槽位：装备 `turret_ter_m_laser_02_mk1` 数量10
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    await selectEquipment(page, 'T', /Laser/i)
    // 3.7.18 点击"详细"档位按钮切换到详细模式
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.7.19 验证所有属性值
    const statsLabels = page.locator('.stats-label')
    await expect(statsLabels).toHaveCount(36)
    // 3.7.20 断言船体 #期望: ['95,000 MJ']
    expect(await getStatValue(page, '船体')).toBe('95,000 MJ')
    // 3.7.21 断言护盾 #期望: ['499,899 MJ']
    expect(await getStatValue(page, '护盾')).toBe('499,899 MJ')
    // 3.7.22 断言速度 #期望: ['324 m/s']
    expect(await getStatValue(page, '速度')).toBe('324 m/s')
    // 3.7.23 断言助推速度 #期望: ['1,555 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('1,555 m/s')
    // 3.7.24 断言巡航速度 #期望: ['9,097 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('9,097 m/s')
    // 3.7.25 断言船员 #期望: ['75']
    expect(await getStatValue(page, '船员')).toBe('75')
    // 3.7.26 断言集装箱仓储 #期望: ['2,800 m³']
    expect(await getStatValue(page, '集装仓储')).toBe('2,800 m³')
    // 3.7.27 断言液体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m³')
    // 3.7.28 断言固体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m³')
    // 3.7.29 断言冷凝仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m³')
    // 3.7.30 断言导弹容量 #期望: ['160']
    expect(await getStatValue(page, '导弹')).toBe('160')
    // 3.7.31 断言干扰弹 #期望: ['20']
    expect(await getStatValue(page, '干扰弹')).toBe('20')
    // 3.7.32 断言可投放设备 #期望: ['250']
    expect(await getStatValue(page, '可投放设备')).toBe('250')
    // 3.7.33 断言无人机单位仓储 #期望: ['10']
    expect(await getStatValue(page, '单位')).toBe('10')
    // 3.7.34 断言M级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'M级泊位数量')).toBe('0')
    // 3.7.35 断言S级泊位数量 #期望: ['1']
    expect(await getStatValue(page, 'S级泊位数量')).toBe('1')
    // 3.7.36 断言M级飞船容量 #期望: ['0']
    expect(await getStatValue(page, 'M级飞船容量')).toBe('0')
    // 3.7.37 断言S级飞船容量 #期望: ['2']
    expect(await getStatValue(page, 'S级飞船容量')).toBe('2')
    // 3.7.38 断言雷达范围 #期望: ['40 km']
    expect(await getStatValue(page, '雷达范围')).toBe('40 km')
    // 3.7.39 断言加速度 #期望: ['132 m/s²']
    expect(await getStatValue(page, '加速')).toBe('132 m/s²')
    // 3.7.40 断言助推加速度 #期望: ['177 m/s²']
    expect(await getStatValue(page, '助推加速度')).toBe('177 m/s²')
    // 3.7.41 断言助推时长 #期望: ['40 s']
    expect(await getStatValue(page, '助推时长')).toBe('40 s')
    // 3.7.42 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.7.43 断言巡航加速度 #期望: ['207 m/s²']
    expect(await getStatValue(page, '巡航加速度')).toBe('207 m/s²')
    // 3.7.44 断言巡航加力时间 #期望: ['5 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('5 s')
    // 3.7.45 断言平移速度 #期望: ['28 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('28 m/s')
    // 3.7.46 断言平移加速度 #期望: ['10 m/s²']
    expect(await getStatValue(page, '平移加速度')).toBe('10 m/s²')
    // 3.7.47 断言水平转向 #期望: ['7 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('7 rad/s')
    // 3.7.48 断言俯仰 #期望: ['8 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('8 rad/s')
    // 3.7.49 断言横滚 #期望: ['11 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('11 rad/s')
    // 3.7.50 断言再充率 #期望: ['2,953 MW']
    expect(await getStatValue(page, '再充率')).toBe('2,953 MW')
    // 3.7.51 断言再充延迟 #期望: ['0 s']
    expect(await getStatValue(page, '再充延迟')).toBe('0 s')
    // 3.7.52 断言编组平均护盾容量 #期望: ['0 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('0 MJ')
    // 3.7.53 断言武器爆发输出值 #期望: ['16,743 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('16,743 MW')
    // 3.7.54 断言武器持续性输出值 #期望: ['16,743 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('16,743 MW')
    // 3.7.55 断言炮塔平均输出值 #期望: ['111 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('111 MW')
  })
})
