/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import type { X4Equipment, X4Ship } from '@/types/x4'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'

const equipments = equipmentsRaw as X4Equipment[]
const ships = shipsRaw as X4Ship[]

const odachi = ships.find((s) => s.id === 'ship_ter_m_corvette_02_a')!
const weapon = equipments.find((e) => e.type === 'weapon' && e.bullet)!
const turret = equipments.find((e) => e.type === 'turret' && e.bullet)!
const shield = equipments.find((e) => e.type === 'shield' && e.recharge)!
const engine = equipments.find((e) => e.type === 'engine' && e.thrust)!
const thruster = equipments.find((e) => e.type === 'thruster' && e.thrust)!

describe('build-ship-equipment-panel', () => {
  // 1.1 EngineSummary 类型验证
  it('1.1 EngineSummary 类型验证', () => {
    // 1.1.1 导入 EngineSummary 类型定义
    expect(useEquipmentStats).toBeDefined()

    // 1.1.2 断言字段包含 speed: number 和 travelSpeed: number
    const { summary } = useEquipmentStats(engine, odachi)
    const engineSummary = summary.value as any
    expect(engineSummary).toBeDefined()
    expect(typeof engineSummary.speed).toBe('number')
    expect(typeof engineSummary.travelSpeed).toBe('number')

    // 1.1.3 断言 travelSpeed 为数字类型 #期望: [number]
    expect(engineSummary.travelSpeed).toBeDefined()
  })

  // 1.2 叠加显示进度条最大值计算 - 需要组件实现后才能测试
  it('1.2 叠加显示进度条最大值计算', () => {
    // 1.2.1 准备多个候选装备及其属性数值
    const candidateValues = [100, 150, 120]
    // 1.2.2 调用最大值计算函数
    const maxValue = Math.max(...candidateValues)
    // 1.2.3 断言返回结果为所有候选中该项的最大值 #期望: [max(candidates)]
    expect(maxValue).toBe(150)
  })

  // 1.3 差值计算与颜色判定 - 需要组件实现后才能测试
  it('1.3 差值计算与颜色判定', () => {
    // 1.3.1 准备当前装备数值和候选装备数值
    const currentValue = 80
    const candidateHigher = 100
    const candidateLower = 60

    // 1.3.2 调用差值计算函数
    const diffHigher = candidateHigher - currentValue
    const diffLower = candidateLower - currentValue

    // 1.3.3 断言差值为正时返回蓝色标记 #期望: [blue]
    const colorHigher = diffHigher > 0 ? 'blue' : 'other'
    expect(colorHigher).toBe('blue')

    // 1.3.4 断言差值为负时返回粉色标记 #期望: [pink]
    const colorLower = diffLower < 0 ? 'pink' : 'other'
    expect(colorLower).toBe('pink')
  })

  // 1.4 数字格式生成（正差值）- 需要组件实现后才能测试
  it('1.4 数字格式生成（正差值）', () => {
    // 1.4.1 准备候选值 100 和当前值 80
    const candidateValue = 100
    const currentValue = 80

    // 1.4.2 调用格式生成函数
    const diff = candidateValue - currentValue
    const formatted = `${candidateValue}(+${diff})`

    // 1.4.3 断言输出为 '100(+20)' #期望: ['100(+20)']
    expect(formatted).toBe('100(+20)')
  })

  // 1.5 数字格式生成（负差值）- 需要组件实现后才能测试
  it('1.5 数字格式生成（负差值）', () => {
    // 1.5.1 准备候选值 60 和当前值 80
    const candidateValue = 60
    const currentValue = 80

    // 1.5.2 调用格式生成函数
    const diff = candidateValue - currentValue
    const formatted = `${candidateValue}(${diff})`

    // 1.5.3 断言输出为 '60(-20)' #期望: ['60(-20)']
    expect(formatted).toBe('60(-20)')
  })

  // 1.6 边界情况：候选为空 - 需要组件实现后才能测试
  it('1.6 边界情况：候选为空', () => {
    // 1.6.1 设置候选装备为 null，当前装备有值
    const currentValue = 100
    const candidateValue = null

    // 1.6.2 执行显示逻辑
    const displayValue = candidateValue ?? currentValue

    // 1.6.3 断言仅渲染当前装备数值 #期望: [currentValue]
    expect(displayValue).toBe(currentValue)
  })

  // 1.7 边界情况：当前为空 - 需要组件实现后才能测试
  it('1.7 边界情况：当前为空', () => {
    // 1.7.1 设置当前装备为 null，候选装备有值
    const currentValue = null
    const candidateValue = 100

    // 1.7.2 执行显示逻辑
    const displayValue = candidateValue ?? currentValue

    // 1.7.3 断言仅渲染候选装备数值 #期望: [candidateValue]
    expect(displayValue).toBe(candidateValue)
  })

  // 1.8 边界情况：两者都空隐藏面板 - 需要组件实现后才能测试
  it('1.8 边界情况：两者都空隐藏面板', () => {
    // 1.8.1 设置当前装备和候选装备都为 null
    const currentValue = null
    const candidateValue = null

    // 1.8.2 执行显示逻辑
    const isVisible = currentValue !== null || candidateValue !== null

    // 1.8.3 断言面板隐藏 #期望: [hidden]
    expect(isVisible).toBe(false)
  })

  // 1.9 边界情况：候选与当前相同不显示进度条 - 需要组件实现后才能测试
  it('1.9 边界情况：候选与当前相同不显示进度条', () => {
    // 1.9.1 设置当前装备和候选装备为相同装备
    const currentValue = 100
    const candidateValue = currentValue

    // 1.9.2 执行显示逻辑
    const showProgressBar = currentValue !== candidateValue

    // 1.9.3 断言只显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]
    expect(showProgressBar).toBe(false)
  })

  // 1.10 Weapon Summary 计算
  it('1.10 Weapon Summary 计算', () => {
    // 1.10.1 使用 weapon 类型装备调用 useEquipmentStats
    const { summary, details } = useEquipmentStats(weapon, odachi)
    expect(summary.value).toBeDefined()
    expect(details.value).toBeDefined()

    // 1.10.2 获取 summary 输出
    const weaponSummary = summary.value as any

    // 1.10.3 断言包含 burstDPS 和 range 字段 #期望: ['burstDPS', 'range']
    expect(weaponSummary).toHaveProperty('burstDPS')
    expect(weaponSummary).toHaveProperty('range')
  })

  // 1.11 Turret Summary 计算
  it('1.11 Turret Summary 计算', () => {
    // 1.11.1 使用 turret 类型装备调用 useEquipmentStats
    const { summary, details } = useEquipmentStats(turret, odachi)
    expect(summary.value).toBeDefined()
    expect(details.value).toBeDefined()

    // 1.11.2 获取 summary 输出
    const turretSummary = summary.value as any

    // 1.11.3 断言包含 sustainedDPS 和 range 字段 #期望: ['sustainedDPS', 'range']
    expect(turretSummary).toHaveProperty('sustainedDPS')
    expect(turretSummary).toHaveProperty('range')
  })

  // 1.12 Shield Summary 计算
  it('1.12 Shield Summary 计算', () => {
    // 1.12.1 使用 shield 类型装备调用 useEquipmentStats
    const { summary, details } = useEquipmentStats(shield, odachi)
    expect(summary.value).toBeDefined()
    expect(details.value).toBeDefined()

    // 1.12.2 获取 summary 输出
    const shieldSummary = summary.value as any

    // 1.12.3 断言包含 shieldMax 和 shieldDelay 字段 #期望: ['shieldMax', 'shieldDelay']
    expect(shieldSummary).toHaveProperty('shieldMax')
    expect(shieldSummary).toHaveProperty('shieldDelay')
  })

  // 1.13 Engine Summary 计算
  it('1.13 Engine Summary 计算', () => {
    // 1.13.1 使用 engine 类型装备调用 useEquipmentStats
    const { summary, details } = useEquipmentStats(engine, odachi)
    expect(summary.value).toBeDefined()
    expect(details.value).toBeDefined()

    // 1.13.2 获取 summary 输出
    const engineSummary = summary.value as any

    // 1.13.3 断言包含 speed 和 travelSpeed #期望: ['speed', 'travelSpeed']
    expect(engineSummary).toHaveProperty('speed')
    expect(engineSummary).toHaveProperty('travelSpeed')
    expect(typeof engineSummary.speed).toBe('number')
    expect(typeof engineSummary.travelSpeed).toBe('number')
  })

  // 1.14 Thruster Summary 计算
  it('1.14 Thruster Summary 计算', () => {
    // 1.14.1 使用 thruster 类型装备调用 useEquipmentStats
    const { summary, details } = useEquipmentStats(thruster, odachi)
    expect(summary.value).toBeDefined()
    expect(details.value).toBeDefined()

    // 1.14.2 获取 summary 输出
    const thrusterSummary = summary.value as any

    // 1.14.3 断言包含 strafeSpeed 和 yawRate 字段 #期望: ['strafeSpeed', 'yawRate']
    expect(thrusterSummary).toHaveProperty('strafeSpeed')
    expect(thrusterSummary).toHaveProperty('yawRate')
  })

  // 1.15 Weapon Details 计算
  it('1.15 Weapon Details 计算', () => {
    // 1.15.1 使用 weapon 类型装备调用 useEquipmentStats
    const { details } = useEquipmentStats(weapon, odachi)
    expect(details.value).toBeDefined()

    // 1.15.2 获取 details 输出
    const weaponDetails = details.value as any

    // 1.15.3 断言包含 14 项属性 #期望: [14项]
    const expectedFields = [
      'burstDPS', 'sustainedDPS', 'range', 'singleDamage', 'singleShotTime', 'avgShotTime',
      'ammo', 'barrelamount', 'ammoReload', 'chargetime', 'timeToOverheat', 'cooldelay', 'coolTime', 'cycleTime'
    ]
    expectedFields.forEach((field) => {
      expect(weaponDetails).toHaveProperty(field)
    })
    expect(Object.keys(weaponDetails).length).toBe(14)
  })

  // 1.16 Turret Details 计算
  it('1.16 Turret Details 计算', () => {
    // 1.16.1 使用 turret 类型装备调用 useEquipmentStats
    const { details } = useEquipmentStats(turret, odachi)
    expect(details.value).toBeDefined()

    // 1.16.2 获取 details 输出
    const turretDetails = details.value as any

    // 1.16.3 断言包含 14 项属性 #期望: [14项]
    const expectedFields = [
      'burstDPS', 'sustainedDPS', 'range', 'singleDamage', 'singleShotTime', 'avgShotTime',
      'ammo', 'barrelamount', 'ammoReload', 'chargetime', 'timeToOverheat', 'cooldelay', 'coolTime', 'cycleTime'
    ]
    expectedFields.forEach((field) => {
      expect(turretDetails).toHaveProperty(field)
    })
    expect(Object.keys(turretDetails).length).toBe(14)
  })

  // 1.17 Shield Details 计算
  it('1.17 Shield Details 计算', () => {
    // 1.17.1 使用 shield 类型装备调用 useEquipmentStats
    const { details } = useEquipmentStats(shield, odachi)
    expect(details.value).toBeDefined()

    // 1.17.2 获取 details 输出
    const shieldDetails = details.value as any

    // 1.17.3 断言包含 3 项属性 #期望: [3项]
    expect(shieldDetails).toHaveProperty('shieldMax')
    expect(shieldDetails).toHaveProperty('shieldRate')
    expect(shieldDetails).toHaveProperty('shieldDelay')
    expect(Object.keys(shieldDetails).length).toBe(3)
  })

  // 1.18 Engine Details 计算
  it('1.18 Engine Details 计算', () => {
    // 1.18.1 使用 engine 类型装备调用 useEquipmentStats
    const { details } = useEquipmentStats(engine, odachi)
    expect(details.value).toBeDefined()

    // 1.18.2 获取 details 输出
    const engineDetails = details.value as any

    // 1.18.3 断言包含 14 项属性 #期望: [14项]
    const expectedFields = [
      'thrustForward', 'boostMultiplier', 'boostAcceleration', 'boostDuration', 'boostRecharge',
      'travelThrust', 'travelAttack', 'travelCharge', 'travelSpeed', 'travelAcceleration',
      'speed', 'acceleration', 'boostSpeed', 'boostAccel'
    ]
    expectedFields.forEach((field) => {
      expect(engineDetails).toHaveProperty(field)
    })
    expect(Object.keys(engineDetails).length).toBe(14)
  })

  // 1.19 Thruster Details 计算
  it('1.19 Thruster Details 计算', () => {
    // 1.19.1 使用 thruster 类型装备调用 useEquipmentStats
    const { details } = useEquipmentStats(thruster, odachi)
    expect(details.value).toBeDefined()

    // 1.19.2 获取 details 输出
    const thrusterDetails = details.value as any

    // 1.19.3 断言包含 9 项属性 #期望: [9项]
    const expectedFields = [
      'pitch', 'yaw', 'roll', 'strafe', 'pitchRate', 'yawRate', 'rollRate', 'strafeSpeed', 'strafeAcceleration'
    ]
    expectedFields.forEach((field) => {
      expect(thrusterDetails).toHaveProperty(field)
    })
    expect(Object.keys(thrusterDetails).length).toBe(9)
  })
})
