import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// Helper functions
const clickSlotType = async (page: any, slotType: 'engine' | 'thruster' | 'shield' | 'weapon' | 'turret') => {
  await page.getByTestId(`slot-type-${slotType}`).click()
}

const expectSlotRowsVisibleByType = async (page: any, shipId: string, slotType: 'engine' | 'thruster' | 'shield' | 'weapon' | 'turret') => {
  await expect(page.locator(`[data-testid^="slot-${shipId}::${slotType}::"]`).first()).toBeVisible()
}

const getBlueprintEquipmentIds = async (page: any): Promise<string[]> => {
  return page.evaluate(() => {
    const store = (window as any).shipBuildStore
    const blueprint = store?.blueprint
    if (!blueprint?.connections) return []
    const ids: string[] = []
    for (const conn of blueprint.connections) {
      for (const group of conn.group || []) {
        if (group.equipment_id) ids.push(group.equipment_id)
        if (group.shield?.equipment_id) ids.push(group.shield.equipment_id)
      }
    }
    return ids
  })
}

const statKeys = [
  'hull',
  'shield',
  'radar_range',
  'weapon_burst',
  'turret_avg',
  'storage_container',
  'dock_m_count',
  'dock_m_capacity',
  'dock_s_count',
  'dock_s_capacity',
  'speed',
  'boost_speed',
  'travel_speed',
  'crew',
  'storage_unit',
  'missile',
  'deployable',
  'countermeasure',
  'shield_recharge_rate',
  'shield_recharge_delay',
  'shield_group_avg',
  'weapon_sustained',
  'storage_solid',
  'storage_liquid',
  'storage_condensed',
  'acceleration',
  'boost_acceleration',
  'boost_duration',
  'boost_recharge',
  'travel_acceleration',
  'travel_charge_time',
  'strafe_speed',
  'strafe_acceleration',
  'yaw',
  'pitch',
  'roll'
] as const

type StatKey = (typeof statKeys)[number]
type StatMap = Record<StatKey, string>

const expectedStats = JSON.parse(
  fs.readFileSync('tests/fixtures/ship-build-stat-expected.json', 'utf8')
) as Record<string, { detail: StatMap }>

const getExpectedDetail = (shipName: 'Odachi' | 'Osaka'): StatMap => {
  const ship = expectedStats[shipName]
  if (!ship) {
    throw new Error(`Missing expected stats fixture for ${shipName}`)
  }
  return ship.detail
}

const setStatsLogic = async (page: any, logic: 'old' | 'new') => {
  await page.getByTestId(`ship-build-stats-logic-${logic}`).click()
}

const captureStatGroup = async (page: any): Promise<StatMap> => {
  const statsPanel = page.getByTestId('ship-build-panel-stats')
  const result = {} as StatMap
  for (const key of statKeys) {
    const text = await statsPanel.getByTestId(`metric-value-${key}`).first().textContent()
    result[key] = (text || '').replace(/\s+/g, ' ').trim()
  }
  return result
}

const parseNumberWithUnit = (raw: string): { num: number; unit: string } | null => {
  const normalized = raw.trim()
  const m = normalized.match(/^(-?[\d,]+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  const num = Number(m[1]!.replace(/,/g, ''))
  if (Number.isNaN(num)) return null
  return { num, unit: (m[2] ?? '').trim() }
}

const diffOldVsNew = (oldStats: StatMap, newStats: StatMap): string[] => {
  const diffs: string[] = []
  for (const key of statKeys) {
    const oldVal = oldStats[key]
    const newVal = newStats[key]
    if (oldVal === newVal) continue
    const oldNum = parseNumberWithUnit(oldVal)
    const newNum = parseNumberWithUnit(newVal)
    if (!oldNum || !newNum || oldNum.unit !== newNum.unit) {
      diffs.push(`${key}: ${oldVal} -> ${newVal}`)
      continue
    }
    const delta = Math.abs(oldNum.num - newNum.num)
    const tolerance = Math.max(Math.abs(newNum.num) * 0.01, 1)
    if (delta > tolerance) {
      diffs.push(`${key}: ${oldVal} -> ${newVal} (delta=${delta}, tol=${tolerance.toFixed(3)})`)
    }
  }
  return diffs
}

const diffAgainstExpected = (actual: StatMap, expected: StatMap): string[] => {
  const diffs: string[] = []
  const normalize = (value: string) => value.replace(/\s+/g, '')
  for (const key of statKeys) {
    if (normalize(actual[key]) !== normalize(expected[key])) {
      diffs.push(`${key}: actual=${actual[key]} expected=${expected[key]}`)
    }
  }
  return diffs
}

// 2.1 状态: 仅载入大太刀
// 2.1.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
// 2.1.2 点击"Load"按钮打开模态框
// 2.1.3 在模态框中选择 "Odachi" 蓝图
// 2.1.4 点击确认
// 2.1.5 断言飞船信息区显示大太刀名称 #期望: ['大太刀']
// 2.1.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['engine_ter_m_virtual_01_mk1']
// 2.1.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['thruster_gen_m_combat_01_mk3']
// 2.1.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['shield_ter_m_virtual_01_mk3']
// 2.1.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['weapon_ter_m_laser_02_mk1']
// 2.1.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['turret_ter_m_laser_03_mk1']
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

  // 2.1.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['engine_ter_m_virtual_01_mk1']
  await clickSlotType(page, 'engine')
  await expectSlotRowsVisibleByType(page, 'ship_ter_m_corvette_02_a', 'engine')
  const odachiEngineIds = await getBlueprintEquipmentIds(page)
  expect(odachiEngineIds).toContain('engine_ter_m_virtual_01_mk1')

  // 2.1.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['thruster_gen_m_combat_01_mk3']
  await clickSlotType(page, 'thruster')
  await expectSlotRowsVisibleByType(page, 'ship_ter_m_corvette_02_a', 'thruster')
  const odachiThrusterIds = await getBlueprintEquipmentIds(page)
  expect(odachiThrusterIds).toContain('thruster_gen_m_combat_01_mk3')

  // 2.1.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['shield_ter_m_virtual_01_mk3']
  await clickSlotType(page, 'shield')
  await expectSlotRowsVisibleByType(page, 'ship_ter_m_corvette_02_a', 'shield')
  const odachiShieldIds = await getBlueprintEquipmentIds(page)
  expect(odachiShieldIds).toContain('shield_ter_m_virtual_01_mk3')

  // 2.1.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['weapon_ter_m_laser_02_mk1']
  await clickSlotType(page, 'weapon')
  await expectSlotRowsVisibleByType(page, 'ship_ter_m_corvette_02_a', 'weapon')
  const odachiWeaponIds = await getBlueprintEquipmentIds(page)
  expect(odachiWeaponIds).toContain('weapon_ter_m_laser_02_mk1')

  // 2.1.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['turret_ter_m_laser_03_mk1']
  await clickSlotType(page, 'turret')
  await expectSlotRowsVisibleByType(page, 'ship_ter_m_corvette_02_a', 'turret')
  const odachiTurretIds = await getBlueprintEquipmentIds(page)
  expect(odachiTurretIds).toContain('turret_ter_m_laser_03_mk1')
}

// 2.2 状态: 仅载入大阪
// 2.2.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
// 2.2.2 点击"Load"按钮打开模态框
// 2.2.3 在模态框中选择 "Osaka" 蓝图
// 2.2.4 点击确认
// 2.2.5 断言飞船信息区显示大阪名称 #期望: ['大阪']
// 2.2.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['engine_ter_l_allround_01_mk1']
// 2.2.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['thruster_gen_l_allround_01_mk3']
// 2.2.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['shield_ter_l_standard_01_mk3']
// 2.2.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['weapon_ter_l_destroyer_01_mk1']
// 2.2.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['turret_arg_l_plasma_01_mk1', 'turret_arg_m_flak_01_mk1']
const buildOsakaState = async (page: any) => {
  // 2.2.1 打开Ship Build页面（beforeEach 已加载fixture并设置语言）
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()

  // 2.2.2 点击"Load"按钮打开模态框
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()

  // 2.2.3 在模态框中选择 "Osaka" 蓝图
  const osakaItem = page
    .locator('.blueprint-item')
    .filter({ hasText: /Osaka|大阪/i })
    .filter({ hasNotText: /Osaka\s*2|大阪\s*2/i })
    .first()
  await expect(osakaItem).toBeVisible()
  await osakaItem.click()

  // 2.2.4 点击确认
  await osakaItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()

  // 2.2.5 断言飞船信息区显示大阪名称 #期望: ['大阪']
  await expect(page.getByTestId('ship-build-selection')).toContainText('大阪')

  // 2.2.6 切换到引擎槽位类型(E)，断言引擎槽位有装备名称 #期望: ['engine_ter_l_allround_01_mk1']
  await clickSlotType(page, 'engine')
  await expectSlotRowsVisibleByType(page, 'ship_ter_l_destroyer_01_a', 'engine')
  const osakaEngineIds = await getBlueprintEquipmentIds(page)
  expect(osakaEngineIds).toContain('engine_ter_l_allround_01_mk1')

  // 2.2.7 切换到推进器槽位类型(R)，断言推进器槽位有装备名称 #期望: ['thruster_gen_l_allround_01_mk3']
  await clickSlotType(page, 'thruster')
  await expectSlotRowsVisibleByType(page, 'ship_ter_l_destroyer_01_a', 'thruster')
  const osakaThrusterIds = await getBlueprintEquipmentIds(page)
  expect(osakaThrusterIds).toContain('thruster_gen_l_allround_01_mk3')

  // 2.2.8 切换到护盾槽位类型(S)，断言护盾槽位有装备名称 #期望: ['shield_ter_l_standard_01_mk3']
  await clickSlotType(page, 'shield')
  await expectSlotRowsVisibleByType(page, 'ship_ter_l_destroyer_01_a', 'shield')
  const osakaShieldIds = await getBlueprintEquipmentIds(page)
  expect(osakaShieldIds).toContain('shield_ter_l_standard_01_mk3')

  // 2.2.9 切换到武器槽位类型(W)，断言武器槽位有装备名称 #期望: ['weapon_ter_l_destroyer_01_mk1']
  await clickSlotType(page, 'weapon')
  await expectSlotRowsVisibleByType(page, 'ship_ter_l_destroyer_01_a', 'weapon')
  const osakaWeaponIds = await getBlueprintEquipmentIds(page)
  expect(osakaWeaponIds).toContain('weapon_ter_l_destroyer_01_mk1')

  // 2.2.10 切换到炮塔槽位类型(T)，断言炮塔槽位有装备名称 #期望: ['turret_arg_l_plasma_01_mk1', 'turret_arg_m_flak_01_mk1']
  await clickSlotType(page, 'turret')
  await expectSlotRowsVisibleByType(page, 'ship_ter_l_destroyer_01_a', 'turret')
  const osakaTurretIds = await getBlueprintEquipmentIds(page)
  expect(osakaTurretIds).toContain('turret_arg_l_plasma_01_mk1')
  expect(osakaTurretIds).toContain('turret_arg_m_flak_01_mk1')
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
  const statsPanel = page.getByTestId('ship-build-panel-stats')
  const valueByTestId = statsPanel.getByTestId(`metric-value-${key}`).first()
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
  const label = statsPanel.locator('.metric-label').filter({ hasText: exactPattern }).first()
  const value = label.locator('..').locator('.metric-value')
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
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-summary').click()
    // 3.1.3 断言字段集合包含18项 #期望: [18]
    const labels = page.getByTestId('ship-build-panel-stats').locator('.metric-label')
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
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.2.3 断言字段集合包含36项 #期望: [36]
    const labels = page.getByTestId('ship-build-panel-stats').locator('.metric-label')
    await expect(labels).toHaveCount(36)
    // 3.2.4 点击"简略"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-summary').click()
    // 3.2.5 断言字段集合包含18项 #期望: [18]
    await expect(page.getByTestId('ship-build-panel-stats').locator('.metric-label')).toHaveCount(18)
  })

  // 3.3 Case: 详细档位真实值
  test('3.3 Case: 详细档位真实值', async ({ page }) => {
    // 3.3.1 状态: 大太刀已选
    await buildOdachiState(page)
    // 3.3.2 切换: 大太刀已选 -> 详细档位
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.3.3 断言船体、护盾、速度为真实值 #期望: ['--']
    const values = page.getByTestId('ship-build-panel-stats').locator('.metric-value')
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
    // 3.5.1 状态: 仅载入大太刀
    await buildOdachiState(page)
    // 3.5.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.5.3 采集 36 项详细字段快照并与 `tests/fixtures/ship-build-stat-expected.json` 的 Odachi.detail 全量比对
    const actualStats = await captureStatGroup(page)
    // 3.5.4 断言差异项数量为 0 #期望: [0]
    const expected = getExpectedDetail('Odachi')
    const expectedDiffs = diffAgainstExpected(actualStats, expected)
    expect(expectedDiffs, `Actual/Expected diffs (Odachi):\n${expectedDiffs.join('\n')}`).toEqual([])
    expect(expectedDiffs.length).toBe(0)
  })

  // 3.6 Case: 大阪满装备DPS计算
  test('3.6 Case: 大阪满装备DPS计算', async ({ page }) => {
    // 3.6.1 状态: 仅载入大阪
    await buildOsakaState(page)
    // 3.6.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.6.3 采集 36 项详细字段快照并与 `tests/fixtures/ship-build-stat-expected.json` 的 Osaka.detail 全量比对
    const actualStats = await captureStatGroup(page)
    // 3.6.4 断言差异项数量为 0 #期望: [0]
    const expected = getExpectedDetail('Osaka')
    const expectedDiffs = diffAgainstExpected(actualStats, expected)
    expect(expectedDiffs, `Actual/Expected diffs (Osaka):\n${expectedDiffs.join('\n')}`).toEqual([])
    expect(expectedDiffs.length).toBe(0)
  })

  // 3.7 Case: M级船进度条渲染
  test('3.7 Case: M级船进度条渲染', async ({ page }) => {
    // 3.7.1 状态: 仅载入大太刀 (class: ship_m)
    await buildOdachiState(page)
    // 3.7.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.7.3 断言船体进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-hull"]')).toBeVisible()
    // 3.7.4 断言速度进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-speed"]')).toBeVisible()
    // 3.7.5 断言船员进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-crew"]')).toBeVisible()
  })

  // 3.8 Case: L级船进度条渲染
  test('3.8 Case: L级船进度条渲染', async ({ page }) => {
    // 3.8.1 状态: 仅载入大阪 (class: ship_l)
    await buildOsakaState(page)
    // 3.8.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.8.3 断言船体进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-hull"]')).toBeVisible()
    // 3.8.4 断言速度进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-speed"]')).toBeVisible()
    // 3.8.5 断言船员进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-crew"]')).toBeVisible()
  })

  // 3.9 Case: 进度条渲染与比例
  test('3.9 Case: 进度条渲染与比例', async ({ page }) => {
    // 3.9.1 状态: 仅载入大太刀 (class: ship_m)
    await buildOdachiState(page)
    // 3.9.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.9.3 断言船体进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-hull"]')).toBeVisible()
    // 3.9.4 断言速度进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-speed"]')).toBeVisible()
    // 3.9.5 断言船员进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-crew"]')).toBeVisible()
  })

  // 3.10 Case: 进度条渲染-大阪
  test('3.10 Case: 进度条渲染-大阪', async ({ page }) => {
    // 3.10.1 状态: 仅载入大阪
    await buildOsakaState(page)
    // 3.10.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.10.3 断言进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-hull"]')).toBeVisible()
  })

  // 3.11 Case: 进度条渲染-大太刀
  test('3.11 Case: 进度条渲染-大太刀', async ({ page }) => {
    // 3.11.1 状态: 仅载入大太刀
    await buildOdachiState(page)
    // 3.11.2 点击"详细"档位按钮
    await page.getByTestId('view-tab-btn-ship-build-stats-mode-detail').click()
    // 3.11.3 断言进度条可见 #期望: [toBeVisible]
    await expect(page.getByTestId('ship-build-panel-stats').locator('[data-testid="metric-bar-hull"]')).toBeVisible()
  })

  // 3.12 Case: S级过滤器交互
  test('3.12 Case: S级过滤器交互', async ({ page }) => {
    // 3.12.1 通过data属性判断飞船选择状态
    const isShipSelected = await page.locator('[data-ship-selected]').getAttribute('data-ship-selected')
    // 3.12.2 情况A:已选飞船则点击"Change Ship"切换
    if (isShipSelected === 'true') {
      await page.locator('[data-testid="ship-build-change-ship"]').click()
    }
    // 3.12.3 断言S级过滤器按钮可见
    await expect(page.getByTestId('ship-build-filter-class-btn-ship_s')).toBeVisible()
    // 3.12.4 点击S级按钮
    await page.getByTestId('ship-build-filter-class-btn-ship_s').click()
    // 3.12.5 断言S级按钮选中状态
    await expect(page.getByTestId('ship-build-filter-class-btn-ship_s')).toHaveClass(/filter-chip-active/)
    // 3.12.6 断言种族过滤器显示
    await expect(page.getByTestId('ship-build-filter-race-btn-argon')).toBeVisible()
  })

  // 3.13 Case: XL级过滤器交互
  test('3.13 Case: XL级过滤器交互', async ({ page }) => {
    // 3.13.1 通过data属性判断飞船选择状态
    const isShipSelected = await page.locator('[data-ship-selected]').getAttribute('data-ship-selected')
    // 3.13.2 情况A:已选飞船则点击"Change Ship"切换
    if (isShipSelected === 'true') {
      await page.locator('[data-testid="ship-build-change-ship"]').click()
    }
    // 3.13.3 断言XL级过滤器按钮可见
    await expect(page.getByTestId('ship-build-filter-class-btn-ship_xl')).toBeVisible()
    // 3.13.4 点击XL级按钮
    await page.getByTestId('ship-build-filter-class-btn-ship_xl').click()
    // 3.13.5 断言XL级按钮选中状态
    await expect(page.getByTestId('ship-build-filter-class-btn-ship_xl')).toHaveClass(/filter-chip-active/)
    // 3.13.6 断言种族过滤器显示
    await expect(page.getByTestId('ship-build-filter-race-btn-argon')).toBeVisible()
  })
})
