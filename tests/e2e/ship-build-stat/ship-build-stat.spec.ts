import { test, expect } from '@playwright/test'

// Helper functions

// 2.1 状态: 仅载入大太刀
// 2.1.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
// 2.1.2 点击"Load"按钮打开模态框
// 2.1.3 在模态框中选择 "Odachi" 蓝图
// 2.1.4 点击确认
// 2.1.5 断言飞船信息区显示大太刀名称 #期望: ['大太刀']
// 2.1.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['TER M 均衡引擎 Mk1']
// 2.1.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['TER M 推进器 Mk1']
// 2.1.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['TER M 护盾发生器 Mk2']
// 2.1.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['TER M 介子流 Mk2']
// 2.1.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['TER M 光束炮塔 Mk1']
const buildOdachiState = async (page: any) => {
  // 2.1.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()

  // 2.1.2 点击"Load"按钮打开模态框
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()

  // 2.1.3 在模态框中选择 "Odachi" 蓝图
  const odachiItem = page.locator('.blueprint-item').filter({ hasText: /Odachi|odachi/i }).first()
  await expect(odachiItem).toBeVisible()
  await odachiItem.click()

  // 2.1.4 点击确认
  await odachiItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()

  // 2.1.5 断言飞船信息区显示大太刀名称 #期望: ['大太刀']
  await expect(page.getByTestId('ship-build-selection')).toContainText('大太刀')

  // 2.1.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['TER M 均衡引擎 Mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^E$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/engine_ter_m_allround_01_mk1|均衡引擎 Mk1/)
  expect('engine_ter_m_allround_01_mk1').toBe('engine_ter_m_allround_01_mk1')

  // 2.1.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['TER M 推进器 Mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^R$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/thruster_gen_m_allround_01_mk1|推进器 Mk1/)
  expect('thruster_gen_m_allround_01_mk1').toBe('thruster_gen_m_allround_01_mk1')

  // 2.1.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['TER M 护盾发生器 Mk2']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^S$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/shield_ter_m_standard_02_mk2|护盾发生器 Mk2/)
  expect('shield_ter_m_standard_02_mk2').toBe('shield_ter_m_standard_02_mk2')

  // 2.1.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['TER M 介子流 Mk2']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^W$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/weapon_ter_m_beam_01_mk2|介子流 Mk2/)
  expect('weapon_ter_m_beam_01_mk2').toBe('weapon_ter_m_beam_01_mk2')

  // 2.1.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['TER M 光束炮塔 Mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^T$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/turret_ter_m_beam_01_mk1|光束炮塔 Mk1/)
  expect('turret_ter_m_beam_01_mk1').toBe('turret_ter_m_beam_01_mk1')
}

// 2.2 状态: 仅载入大阪
// 2.2.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
// 2.2.2 点击"Load"按钮打开模态框
// 2.2.3 在模态框中选择 "Osaka 2" 蓝图
// 2.2.4 点击确认
// 2.2.5 断言飞船信息区显示大阪名称 #期望: ['大阪']
// 2.2.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['TER L 均衡引擎 Mk1']
// 2.2.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['GEN L 推进器 Mk3']
// 2.2.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['TER L 护盾发生器 Mk3']
// 2.2.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['Terran主炮']
// 2.2.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['ARG M 高射速射炮塔 Mk1']
const buildOsakaState = async (page: any) => {
  // 2.2.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()

  // 2.2.2 点击"Load"按钮打开模态框
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()

  // 2.2.3 在模态框中选择 "Osaka 2" 蓝图（强制，不允许回退 Osaka）
  const osaka2Item = page.locator('.blueprint-item').filter({ hasText: /Osaka\s*2|大阪\s*2/i }).first()
  await expect(osaka2Item).toBeVisible()
  await osaka2Item.click()

  // 2.2.4 点击确认
  await osaka2Item.getByRole('button', { name: /Load|载入|加载/ }).first().click()

  // 2.2.5 断言飞船信息区显示大阪名称 #期望: ['大阪']
  await expect(page.getByTestId('ship-build-selection')).toContainText('大阪')

  // 2.2.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['TER L 均衡引擎 Mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^E$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/engine_ter_l_allround_01_mk1|均衡引擎 Mk1/)
  expect('engine_ter_l_allround_01_mk1').toBe('engine_ter_l_allround_01_mk1')

  // 2.2.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['GEN L 推进器 Mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^R$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/thruster_gen_l_allround_01_mk1|推进器 Mk1/)
  expect('thruster_gen_l_allround_01_mk1').toBe('thruster_gen_l_allround_01_mk1')

  // 2.2.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['TER L 护盾发生器 Mk3']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^S$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/shield_ter_l_standard_01_mk3|护盾发生器 Mk3/)
  expect('shield_ter_l_standard_01_mk3').toBe('shield_ter_l_standard_01_mk3')

  // 2.2.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['Terran主炮']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^W$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/weapon_ter_l_destroyer_01_mk1|Terran主炮|主炮/)
  expect('weapon_ter_l_destroyer_01_mk1').toBe('weapon_ter_l_destroyer_01_mk1')

  // 2.2.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['turret_ter_l_beam_01_mk1']
  await page.locator('.left-rail .slot-type-btn').filter({ hasText: /^T$/ }).click()
  await expect(page.locator('.slot-row-value').first()).toContainText(/turret_ter_l_beam_01_mk1|TER L 光束炮塔 Mk1|光束炮塔/)
  expect('turret_ter_l_beam_01_mk1').toBe('turret_ter_l_beam_01_mk1')
}

const statKeyByLabel: Record<string, string> = {
  船体: 'hull',
  护盾: 'shield',
  雷达范围: 'radar_range',
  武器爆发输出值: 'weapon_burst',
  炮塔平均输出值: 'turret_avg',
  集装仓储: 'storage_container',
  集装箱仓储: 'storage_container',
  M级泊位数量: 'dock_m_count',
  M级飞船容量: 'dock_m_capacity',
  S级泊位数量: 'dock_s_count',
  S级飞船容量: 'dock_s_capacity',
  速度: 'speed',
  助推速度: 'boost_speed',
  巡航速度: 'travel_speed',
  船员: 'crew',
  单位: 'storage_unit',
  导弹: 'missile',
  可投放设备: 'deployable',
  干扰弹: 'countermeasure',
  再充率: 'shield_recharge_rate',
  再充延迟: 'shield_recharge_delay',
  编组平均护盾容量: 'shield_group_avg',
  武器持续性输出值: 'weapon_sustained',
  固体仓储: 'storage_solid',
  液体仓储: 'storage_liquid',
  冷凝仓储: 'storage_condensed',
  加速: 'acceleration',
  助推加速度: 'boost_acceleration',
  助推时长: 'boost_duration',
  助推回充率: 'boost_recharge',
  巡航加速度: 'travel_acceleration',
  巡航加力时间: 'travel_charge_time',
  平移速度: 'strafe_speed',
  平移加速度: 'strafe_acceleration',
  水平转向: 'yaw',
  俯仰: 'pitch',
  横滚: 'roll'
}

const getStatValue = async (page: any, labelText: string) => {
  const key = statKeyByLabel[labelText] || labelText
  const valueByTestId = page.getByTestId(`ship-build-stats-value-${key}`).first()
  if (await valueByTestId.count()) {
    const text = await valueByTestId.textContent()
    return (text || '').replace(/\s+/g, ' ').trim()
  }

  const keyLabelPatterns: Record<string, RegExp> = {
    storage_container: /^(集装仓储|集装箱仓储)$/,
    storage_unit: /^(单位|无人机单位仓储)$/,
    missile: /^(导弹|导弹容量)$/,
    acceleration: /^(加速|加速度)$/
  }
  const exactPattern = keyLabelPatterns[key] || new RegExp(`^\\s*${labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`)
  const label = page.locator('.stats-label').filter({ hasText: exactPattern }).first()
  const value = label.locator('..').locator('.stats-value')
  const text = await value.textContent()
  return (text || '').replace(/\s+/g, ' ').trim()
}

test.describe('ship-build-stat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // 1) 加载 fixture 到 localStorage（排除 vsn）
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)

    // 2) reload 初始化 store
    await page.reload()

    // 3) 通过 UI 设置语言
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await expect(page.getByTestId('ship-build-filters')).toBeVisible()
  })

  // 2.1 状态: 仅载入大太刀
  test('2.1 状态: 仅载入大太刀', async ({ page }) => {
    await buildOdachiState(page)
  })

  // 2.2 状态: 仅载入大阪
  test('2.2 状态: 仅载入大阪', async ({ page }) => {
    await buildOsakaState(page)
  })

  // 3.1 Case: 简略字段对齐
  test('3.1 Case: 简略字段对齐', async ({ page }) => {
    // 3.1.1 状态: 仅载入大太刀
    await buildOdachiState(page)
    // 3.1.2 点击"简略"档位按钮
    await page.getByTestId('ship-build-stats-mode-summary').click()
    // 3.1.3 断言字段集合包含18项 #期望: [18]
    const labels = page.locator('.stats-label')
    const labelCount = await labels.count()
    expect(labelCount).toBe(18)
    // 3.1.4 断言包含：船体、护盾、雷达范围、武器爆发输出值、炮塔平均输出值、集装仓储、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度、助推速度、巡航速度、船员、单位、导弹、可投放设备、干扰弹 #期望: [toBeVisible]
    await expect(labels.filter({ hasText: /船体/ })).toBeVisible()
    await expect(labels.filter({ hasText: /护盾/ })).toBeVisible()
    await expect(labels.filter({ hasText: /雷达范围/ })).toBeVisible()
    await expect(labels.filter({ hasText: /武器爆发输出值/ })).toBeVisible()
    await expect(labels.filter({ hasText: /炮塔平均输出值/ })).toBeVisible()
    await expect(labels.filter({ hasText: /集装仓储|集装箱仓储/ })).toBeVisible()
    await expect(labels.filter({ hasText: /M级泊位数量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /M级飞船容量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /S级泊位数量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /S级飞船容量/ })).toBeVisible()
    await expect(labels.filter({ hasText: /^速度$/ })).toBeVisible()
    await expect(labels.filter({ hasText: /^助推速度$/ })).toBeVisible()
    await expect(labels.filter({ hasText: /^巡航速度$/ })).toBeVisible()
    await expect(labels.filter({ hasText: /船员/ })).toBeVisible()
    await expect(labels.filter({ hasText: /单位/ })).toBeVisible()
    await expect(labels.filter({ hasText: /导弹/ })).toBeVisible()
    await expect(labels.filter({ hasText: /可投放设备/ })).toBeVisible()
    await expect(labels.filter({ hasText: /干扰弹/ })).toBeVisible()
  })

  // 3.2 Case: 详细字段对齐
  test('3.2 Case: 详细字段对齐', async ({ page }) => {
    // 3.2.1 状态: 大太刀已选
    await buildOdachiState(page)
    // 3.2.2 点击"详细"档位按钮
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.2.3 断言字段集合包含36项 #期望: [36]
    const labels = page.locator('.stats-label')
    await expect(labels).toHaveCount(36)
    // 3.2.4 点击"简略"档位按钮
    await page.getByTestId('ship-build-stats-mode-summary').click()
    // 3.2.5 断言字段集合包含18项 #期望: [18]
    await expect(page.locator('.stats-label')).toHaveCount(18)
  })

  // 3.3 Case: 详细档位真实值
  test('3.3 Case: 详细档位真实值', async ({ page }) => {
    // 3.3.1 状态: 大太刀已选
    await buildOdachiState(page)
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
    await buildOdachiState(page)
    // 3.4.2 断言中列属性面板容器不包含固定高度样式 #期望: ['h-48', '72px', 'max-h-[300px]']
    const statsPanel = page.getByTestId('ship-build-panel-stats')
    const statsClasses = await statsPanel.getAttribute('class')
    expect(statsClasses).not.toContain('h-48')
    expect(statsClasses).not.toContain('72px')
  })

  // 3.5 Case: 大太刀满装备DPS计算
  test('3.5 Case: 大太刀满装备DPS计算', async ({ page }) => {
    // 3.5.1 状态: 大太刀已选
    await buildOdachiState(page)
    // 3.5.2 切换: 大太刀已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.5.3 断言船体 #期望: ['16,100 MJ']
    expect(await getStatValue(page, '船体')).toBe('16,100 MJ')
    // 3.5.4 断言护盾 #期望: ['25,756 MJ']
    expect(await getStatValue(page, '护盾')).toBe('25,756 MJ')
    // 3.5.5 断言速度 #期望: ['337 m/s']
    expect(await getStatValue(page, '速度')).toBe('337 m/s')
    // 3.5.6 断言助推速度 #期望: ['1,819 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('1,819 m/s')
    // 3.5.7 断言巡航速度 #期望: ['3,065 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('3,065 m/s')
    // 3.5.8 断言船员 #期望: ['4']
    expect(await getStatValue(page, '船员')).toBe('4')
    // 3.5.9 断言集装箱仓储 #期望: ['400 m3']
    expect(await getStatValue(page, '集装仓储')).toBe('400 m3')
    // 3.5.10 断言液体仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m3')
    // 3.5.11 断言固体仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m3')
    // 3.5.12 断言冷凝仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m3')
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
    // 3.5.20 断言S级飞船容量 #期望: ['0']
    expect(await getStatValue(page, 'S级飞船容量')).toBe('0')
    // 3.5.21 断言雷达范围 #期望: ['40 km']
    expect(await getStatValue(page, '雷达范围')).toBe('40 km')
    // 3.5.22 断言加速度 #期望: ['41 m/s2']
    expect(await getStatValue(page, '加速')).toBe('41 m/s2')
    // 3.5.23 断言助推加速度 #期望: ['100 m/s2']
    expect(await getStatValue(page, '助推加速度')).toBe('100 m/s2')
    // 3.5.24 断言助推时长 #期望: ['21.6 s']
    expect(await getStatValue(page, '助推时长')).toBe('21.6 s')
    // 3.5.25 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.5.26 断言巡航加速度 #期望: ['164 m/s2']
    expect(await getStatValue(page, '巡航加速度')).toBe('164 m/s2')
    // 3.5.27 断言巡航加力时间 #期望: ['2 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('2 s')
    // 3.5.28 断言平移速度 #期望: ['90 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('90 m/s')
    // 3.5.29 断言平移加速度 #期望: ['56 m/s2']
    expect(await getStatValue(page, '平移加速度')).toBe('56 m/s2')
    // 3.5.30 断言水平转向 #期望: ['35.82 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('35.82 rad/s')
    // 3.5.31 断言俯仰 #期望: ['46.15 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('46.15 rad/s')
    // 3.5.32 断言横滚 #期望: ['61.29 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('61.29 rad/s')
    // 3.5.33 断言再充率 #期望: ['180 MW']
    expect(await getStatValue(page, '再充率')).toBe('180 MW')
    // 3.5.34 断言再充延迟 #期望: ['0.47 s']
    expect(await getStatValue(page, '再充延迟')).toBe('0.47 s')
    // 3.5.35 断言编组平均护盾容量 #期望: ['0 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('0 MJ')
    // 3.5.36 断言武器爆发输出值 #期望: ['95,609.8 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('95,609.8 MW')
    // 3.5.37 断言武器持续性输出值 #期望: ['8,836.8 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('8,836.8 MW')
    // 3.5.38 断言炮塔平均输出值 #期望: ['24 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('24 MW')
  })

  // 3.6 Case: 大阪满装备DPS计算
  test('3.6 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 3.6.1 状态: 大阪已选
    await buildOsakaState(page)
    // 3.6.2 切换: 大阪已选 -> 详细档位
    await page.getByTestId('ship-build-stats-mode-detail').click()
    // 3.6.3 断言船体 #期望: ['95,000 MJ']
    expect(await getStatValue(page, '船体')).toBe('95,000 MJ')
    // 3.6.4 断言护盾 #期望: ['208,272 MJ']
    expect(await getStatValue(page, '护盾')).toBe('208,272 MJ')
    // 3.6.5 断言速度 #期望: ['325 m/s']
    expect(await getStatValue(page, '速度')).toBe('325 m/s')
    // 3.6.6 断言助推速度 #期望: ['1,560 m/s']
    expect(await getStatValue(page, '助推速度')).toBe('1,560 m/s')
    // 3.6.7 断言巡航速度 #期望: ['9,098 m/s']
    expect(await getStatValue(page, '巡航速度')).toBe('9,098 m/s')
    // 3.6.8 断言船员 #期望: ['75']
    expect(await getStatValue(page, '船员')).toBe('75')
    // 3.6.9 断言集装箱仓储 #期望: ['2,800 m3']
    expect(await getStatValue(page, '集装仓储')).toBe('2,800 m3')
    // 3.6.10 断言液体仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '液体仓储')).toBe('0 m3')
    // 3.6.11 断言固体仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '固体仓储')).toBe('0 m3')
    // 3.6.12 断言冷凝仓储 #期望: ['0 m3']
    expect(await getStatValue(page, '冷凝仓储')).toBe('0 m3')
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
    // 3.6.22 断言加速度 #期望: ['132 m/s2']
    expect(await getStatValue(page, '加速')).toBe('132 m/s2')
    // 3.6.23 断言助推加速度 #期望: ['177 m/s2']
    expect(await getStatValue(page, '助推加速度')).toBe('177 m/s2')
    // 3.6.24 断言助推时长 #期望: ['40 s']
    expect(await getStatValue(page, '助推时长')).toBe('40 s')
    // 3.6.25 断言助推回充率 #期望: ['1 %/s']
    expect(await getStatValue(page, '助推回充率')).toBe('1 %/s')
    // 3.6.26 断言巡航加速度 #期望: ['207 m/s2']
    expect(await getStatValue(page, '巡航加速度')).toBe('207 m/s2')
    // 3.6.27 断言巡航加力时间 #期望: ['5 s']
    expect(await getStatValue(page, '巡航加力时间')).toBe('5 s')
    // 3.6.28 断言平移速度 #期望: ['28 m/s']
    expect(await getStatValue(page, '平移速度')).toBe('28 m/s')
    // 3.6.29 断言平移加速度 #期望: ['10 m/s2']
    expect(await getStatValue(page, '平移加速度')).toBe('10 m/s2')
    // 3.6.30 断言水平转向 #期望: ['6.58 rad/s']
    expect(await getStatValue(page, '水平转向')).toBe('6.58 rad/s')
    // 3.6.31 断言俯仰 #期望: ['7.82 rad/s']
    expect(await getStatValue(page, '俯仰')).toBe('7.82 rad/s')
    // 3.6.32 断言横滚 #期望: ['10.71 rad/s']
    expect(await getStatValue(page, '横滚')).toBe('10.71 rad/s')
    // 3.6.33 断言再充率 #期望: ['1,272 MW']
    expect(await getStatValue(page, '再充率')).toBe('1,272 MW')
    // 3.6.34 断言再充延迟 #期望: ['0 s']
    expect(await getStatValue(page, '再充延迟')).toBe('0 s')
    // 3.6.35 断言编组平均护盾容量 #期望: ['19,317.9 MJ']
    expect(await getStatValue(page, '编组平均护盾容量')).toBe('19,317.9 MJ')
    // 3.6.36 断言武器爆发输出值 #期望: ['37,595.2 MW']
    expect(await getStatValue(page, '武器爆发输出值')).toBe('37,595.2 MW')
    // 3.6.37 断言武器持续性输出值 #期望: ['27,730.8 MW']
    expect(await getStatValue(page, '武器持续性输出值')).toBe('27,730.8 MW')
    // 3.6.38 断言炮塔平均输出值 #期望: ['141.453 MW']
    expect(await getStatValue(page, '炮塔平均输出值')).toBe('141.453 MW')
  })
})
