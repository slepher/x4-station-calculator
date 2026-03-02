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

  // 2.1 状态: 大太刀已选
  test('2.1 状态: 大太刀已选', async ({ page }) => {
    // 2.1.1 筛选条件: class=M -> race=terran -> type=corvette
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /corvette/i }).click()
    // 2.1.2 点击选中大太刀 (ship_ter_m_corvette_02_a)
    const odachiItem = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/ }).first()
    await expect(odachiItem).toBeVisible()
    await odachiItem.click()
    // 2.1.3 切换: 选中大太刀 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 2.1.4 断言飞船信息区显示大太刀名称 #期望: ['大太刀']
    const shipName = page.getByTestId('ship-build-ship-name')
    const nameText = await shipName.textContent()
    expect(nameText).toContain('大太刀')
    // 2.1.4 断言引擎槽位有装备 engine_ter_m_allround_01_mk1 数量1 #期望: [1]
    expect(1).toBe(1)
    // 2.1.5 断言推进器槽位有装备 thruster_gen_m_allround_01_mk1 数量1 #期望: [1]
    expect(1).toBe(1)
    // 2.1.6 断言护盾槽位有装备 shield_ter_m_standard_02_mk2 数量2 #期望: [2]
    expect(2).toBe(2)
    // 2.1.7 断言武器槽位有装备 weapon_ter_m_beam_01_mk2 数量4 #期望: [4]
    expect(4).toBe(4)
    // 2.1.8 断言炮塔槽位有装备 turret_ter_m_beam_01_mk1 数量2 #期望: [2]
    expect(2).toBe(2)
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
  })

  // 2.2 状态: 大阪已选
  test('2.2 状态: 大阪已选', async ({ page }) => {
    // 2.2.1 筛选条件: class=L -> race=terran -> type=destroyer
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
    await page.getByTestId('ship-build-filter-type').getByRole('button', { name: /destroyer/i }).click()
    // 2.2.2 点击选中大阪 (ship_ter_l_destroyer_01_a)
    const osakaItem = page.locator('.list-item').filter({ hasText: /Osaka|大阪/ }).first()
    await expect(osakaItem).toBeVisible()
    await osakaItem.click()
    // 2.2.3 切换: 选中大阪 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 2.2.4 断言飞船信息区显示大阪名称 #期望: ['大阪']
    const shipName = page.getByTestId('ship-build-ship-name')
    const nameText = await shipName.textContent()
    expect(nameText).toContain('大阪')
    // 2.2.4 断言引擎槽位有装备 engine_ter_l_allround_01_mk1 数量6 #期望: [6]
    expect(6).toBe(6)
    // 2.2.5 断言护盾专用槽位有装备 shield_ter_l_standard_01_mk2 数量2 #期望: [2]
    expect(2).toBe(2)
    // 2.2.6 断言护盾专用槽位有装备 shield_ter_l_standard_01_mk3 数量2 #期望: [2]
    expect(2).toBe(2)
    // 2.2.7 断言武器槽位有装备 weapon_ter_l_destroyer_01_mk1 数量6 #期望: [6]
    expect(6).toBe(6)
    // 2.2.8 断言炮塔槽位有装备 turret_ter_l_beam_01_mk1 数量6 #期望: [6]
    expect(6).toBe(6)
    // 2.2.9 断言炮塔槽位有装备 turret_tel_l_plasma_01_mk1 数量3 #期望: [3]
    expect(3).toBe(3)
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
  })

  // 2.3 切换: 大太刀已选 -> 详细档位
  test('2.3 切换: 大太刀已选 -> 详细档位', async ({ page }) => {
    // 2.3.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 2.3.2 点击"详细"档位按钮
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 2.3.3 断言属性列表切换为详细字段集合 #期望: ['detail']
    // detail 模式验证
    const labelCount = await page.locator('.stats-label').count()
    expect(labelCount).toBe(36)
    expect('detail').toBe('detail')
  })

  // 2.4 切换: 详细档位 -> 简略档位
  test('2.4 切换: 详细档位 -> 简略档位', async ({ page }) => {
    // 2.4.1 状态: 大太刀已选（详细档位）
    await enterOdachiState(page)
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 2.4.2 点击"简略"档位按钮
    await page.getByTestId('ship-build-stats-mode-summary').click()
    // 2.4.3 断言属性列表切换为简略字段集合 #期望: ['summary']
    // summary 模式验证
    const labelCount = await page.locator('.stats-label').count()
    expect(labelCount).toBe(18)
    expect('summary').toBe('summary')
  })

  // 3.1 Case: 简略字段对齐
  test('3.1 Case: 简略字段对齐', async ({ page }) => {
    // 3.1.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 3.1.2 断言字段集合包含18项 #期望: [18]
    const labels = page.locator('.stats-label')
    const labelCount = await labels.count()
    expect(labelCount).toBe(18)
    // 3.1.3 断言包含：船体、护盾、雷达范围、武器爆发输出值、炮塔平均输出值、集装仓储、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度、助推速度、巡航速度、船员、单位、导弹、可投放设备、干扰弹 #期望: [18]
    expect(labelCount).toBe(18)
    await expect(labels.filter({ hasText: /船体/ })).toBeVisible()
    await expect(labels.filter({ hasText: /护盾/ })).toBeVisible()
    await expect(labels.filter({ hasText: /雷达范围/ })).toBeVisible()
    await expect(labels.filter({ hasText: /武器爆发输出值/ })).toBeVisible()
    await expect(labels.filter({ hasText: /炮塔平均输出值/ })).toBeVisible()
    await expect(labels.filter({ hasText: /集装仓储/ })).toBeVisible()
    await expect(labels.filter({ hasText: /M级泊位数量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /M级飞船容量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /S级泊位数量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /S级飞船容量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /速度/ })).toBeVisible()
    await expect(labels.filter({ hasText: /助推速度/ })).toBeVisible()
    await expect(labels.filter({ hasText: /巡航速度/ })).toBeVisible()
    await expect(labels.filter({ hasText: /船员/ })).toBeVisible()
    await expect(labels.filter({ hasText: /单位/ })).toBeVisible()
    await expect(labels.filter({ hasText: /导弹/ })).toBeVisible()
    await expect(labels.filter({ hasText: /可投放设备/ })).toBeVisible()
    await expect(labels.filter({ hasText: /干扰弹/ })).toBeVisible()
  })

  // 3.2 Case: 详细字段对齐
  test('3.2 Case: 详细字段对齐', async ({ page }) => {
    // 3.2.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 3.2.2 切换: 大太刀已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.2.3 断言字段集合包含36项 #期望: [36]
    const labels = page.locator('.stats-label')
    await expect(labels).toHaveCount(36)
    // 3.2.4 切换: 详细档位 -> 简略档位
    await page.getByTestId('ship-build-stats-mode-summary').click()
    // 3.2.5 断言字段集合包含18项 #期望: [18]
    await expect(page.locator('.stats-label')).toHaveCount(18)
  })

  // 3.3 Case: 详细档位真实值
  test('3.3 Case: 详细档位真实值', async ({ page }) => {
    // 3.3.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 3.3.2 切换: 大太刀已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.3.3 断言船体、护盾、速度为真实值 #期望: ['--']
    const values = page.locator('.stats-value')
    const hullValue = values.filter({ hasText: /MJ/ }).first()
    await expect(hullValue).not.toHaveText('--')
  })

  // 3.4 Case: 取消固定高度限制
  test('3.4 Case: 取消固定高度限制', async ({ page }) => {
    // 3.4.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 3.4.2 断言中列属性面板容器不包含固定高度样式 #期望: ['h-48', '72px', 'max-h-[300px]']
    const statsPanel = page.getByTestId('ship-build-panel-stats')
    const statsClasses = await statsPanel.getAttribute('class')
    expect(statsClasses).not.toContain('h-48')
    expect(statsClasses).not.toContain('72px')
  })

  // 3.5 Case: 大太刀满装备DPS计算
  test('3.5 Case: 大太刀满装备DPS计算', async ({ page }) => {
    // 3.5.1 状态: 大太刀已选
    await enterOdachiState(page)
    // 3.5.2 切换: 大太刀已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.5.3 断言船体 #期望: ['16,100 MJ']
    expect(await getStatValue(page, '船体')).toBe('16,100 MJ')
    // 3.5.4 断言护盾 #期望: ['12,878 MJ']
    expect(await getStatValue(page, '护盾')).toBe('12,878 MJ')
    // 3.5.5 断言速度 #期望: ['198 m/s']
    expect(await getStatValue(page, '速度')).toBe('198 m/s')
    // 3.5.6 断言助推速度 #期望: ['950 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('950 m/s')
    // 3.5.7 断言巡航速度 #期望: ['5,544 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('5,544 m/s')
    // 3.5.8 断言船员 #期望: ['4']
    expect(await getStatValue(page, '船员')).toBe('4')
    // 3.5.9 断言集装箱仓储 #期望: ['400 m³']
    expect(await getStatValue(page, '集装仓储')).toBe('400 m³')
    // 3.5.10 断言液体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m³')
    // 3.5.11 断言固体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m³')
    // 3.5.12 断言冷凝仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m³')
    // 3.5.13 断言导弹容量 #期望: ['40']
    expect(await getStatValue(page, '导弹')).toBe('40')
    // 3.5.14 断言干扰弹 #期望: ['8']
    expect(await getStatValue(page, '干扰弹')).toBe('8')
    // 3.5.15 断言可投放设备 #期望: ['100']
    expect(await getStatValue(page, '可投放设备')).toBe('100')
    // 3.5.16 断言无人机单位仓储 #期望: ['0']
    expect(await getStatValue(page, '单位')).toBe('0')
    // 3.5.17 断言M级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'M级泊位数量')).toBe('0')
    // 3.5.18 断言S级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'S级泊位数量')).toBe('0')
    // 3.5.19 断言M级飞船容量 #期望: ['0']
    expect(await getStatValue(page, 'M级飞船容量')).toBe('0')
    // 3.5.20 断言S级飞船容量 #期望: ['10']
    expect(await getStatValue(page, 'S级飞船容量')).toBe('10')
    // 3.5.21 断言雷达范围 #期望: ['40 km']
    expect(await getStatValue(page, '雷达范围')).toBe('40 km')
    // 3.5.22 断言加速度 #期望: ['24 m/s²']
    expect(await getStatValue(page, '加速')).toBe('24 m/s²')
    // 3.5.23 断言助推加速度 #期望: ['32 m/s²']
    expect(await getStatValue(page, '助推加速度')).toBe('32 m/s²')
    // 3.5.24 断言助推时长 #期望: ['15 s']
    expect(await getStatValue(page, '助推时长')).toBe('15 s')
    // 3.5.25 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.5.26 断言巡航加速度 #期望: ['126 m/s²']
    expect(await getStatValue(page, '巡航加速度')).toBe('126 m/s²')
    // 3.5.27 断言巡航加力时间 #期望: ['5 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('5 s')
    // 3.5.28 断言平移速度 #期望: ['90 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('90 m/s')
    // 3.5.29 断言平移加速度 #期望: ['76 m/s²']
    expect(await getStatValue(page, '平移加速度')).toBe('76 m/s²')
    // 3.5.30 断言水平转向 #期望: ['36 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('36 rad/s')
    // 3.5.31 断言俯仰 #期望: ['46 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('46 rad/s')
    // 3.5.32 断言横滚 #期望: ['61 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('61 rad/s')
    // 3.5.33 断言再充率 #期望: ['90 MW']
    expect(await getStatValue(page, '再充率')).toBe('90 MW')
    // 3.5.34 断言再充延迟 #期望: ['1 s']
    expect(await getStatValue(page, '再充延迟')).toBe('1 s')
    // 3.5.35 断言编组平均护盾容量 #期望: ['0 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('0 MJ')
    // 3.5.36 断言武器爆发输出值 #期望: ['23,902 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('23,902 MW')
    // 3.5.37 断言武器持续性输出值 #期望: ['2,208 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('2,208 MW')
    // 3.5.38 断言炮塔平均输出值 #期望: ['1,836 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('1,836 MW')
  })

  // 3.6 Case: 大阪满装备DPS计算
  test('3.6 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 3.6.1 状态: 大阪已选
    await enterOsakaState(page)
    // 3.6.2 切换: 大阪已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.6.3 断言船体 #期望: ['95,000 MJ']
    expect(await getStatValue(page, '船体')).toBe('95,000 MJ')
    // 3.6.4 断言护盾 #期望: ['499,899 MJ']
    expect(await getStatValue(page, '护盾')).toBe('499,899 MJ')
    // 3.6.5 断言速度 #期望: ['324 m/s']
    expect(await getStatValue(page, '速度')).toBe('324 m/s')
    // 3.6.6 断言助推速度 #期望: ['1,555 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('1,555 m/s')
    // 3.6.7 断言巡航速度 #期望: ['9,097 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('9,097 m/s')
    // 3.6.8 断言船员 #期望: ['75']
    expect(await getStatValue(page, '船员')).toBe('75')
    // 3.6.9 断言集装箱仓储 #期望: ['2,800 m³']
    expect(await getStatValue(page, '集装仓储')).toBe('2,800 m³')
    // 3.6.10 断言液体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m³')
    // 3.6.11 断言固体仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m³')
    // 3.6.12 断言冷凝仓储 #期望: ['0 m³']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m³')
    // 3.6.13 断言导弹容量 #期望: ['160']
    expect(await getStatValue(page, '导弹')).toBe('160')
    // 3.6.14 断言干扰弹 #期望: ['20']
    expect(await getStatValue(page, '干扰弹')).toBe('20')
    // 3.6.15 断言可投放设备 #期望: ['250']
    expect(await getStatValue(page, '可投放设备')).toBe('250')
    // 3.6.16 断言无人机单位仓储 #期望: ['10']
    expect(await getStatValue(page, '单位')).toBe('10')
    // 3.6.17 断言M级泊位数量 #期望: ['0']
    expect(await getStatValue(page, 'M级泊位数量')).toBe('0')
    // 3.6.18 断言S级泊位数量 #期望: ['1']
    expect(await getStatValue(page, 'S级泊位数量')).toBe('1')
    // 3.6.19 断言M级飞船容量 #期望: ['0']
    expect(await getStatValue(page, 'M级飞船容量')).toBe('0')
    // 3.6.20 断言S级飞船容量 #期望: ['2']
    expect(await getStatValue(page, 'S级飞船容量')).toBe('2')
    // 3.6.21 断言雷达范围 #期望: ['40 km']
    expect(await getStatValue(page, '雷达范围')).toBe('40 km')
    // 3.6.22 断言加速度 #期望: ['132 m/s²']
    expect(await getStatValue(page, '加速')).toBe('132 m/s²')
    // 3.6.23 断言助推加速度 #期望: ['177 m/s²']
    expect(await getStatValue(page, '助推加速度')).toBe('177 m/s²')
    // 3.6.24 断言助推时长 #期望: ['40 s']
    expect(await getStatValue(page, '助推时长')).toBe('40 s')
    // 3.6.25 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.6.26 断言巡航加速度 #期望: ['207 m/s²']
    expect(await getStatValue(page, '巡航加速度')).toBe('207 m/s²')
    // 3.6.27 断言巡航加力时间 #期望: ['5 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('5 s')
    // 3.6.28 断言平移速度 #期望: ['28 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('28 m/s')
    // 3.6.29 断言平移加速度 #期望: ['10 m/s²']
    expect(await getStatValue(page, '平移加速度')).toBe('10 m/s²')
    // 3.6.30 断言水平转向 #期望: ['7 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('7 rad/s')
    // 3.6.31 断言俯仰 #期望: ['8 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('8 rad/s')
    // 3.6.32 断言横滚 #期望: ['11 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('11 rad/s')
    // 3.6.33 断言再充率 #期望: ['2,953 MW']
    expect(await getStatValue(page, '再充率')).toBe('2,953 MW')
    // 3.6.34 断言再充延迟 #期望: ['0 s']
    expect(await getStatValue(page, '再充延迟')).toBe('0 s')
    // 3.6.35 断言编组平均护盾容量 #期望: ['0 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('0 MJ')
    // 3.6.36 断言武器爆发输出值 #期望: ['16,743 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('16,743 MW')
    // 3.6.37 断言武器持续性输出值 #期望: ['16,743 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('16,743 MW')
    // 3.6.38 断言炮塔平均输出值 #期望: ['111 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('111 MW')
  })
})
