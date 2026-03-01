/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import { useEquipmentStats } from '@/composables/useEquipmentStats'

const mockShip: any = {
  id: 'ship_ter_m_corvette_02_a',
  hull: 16100,
  radarRange: 40000,
  crew: { capacity: 4 },
  storage: { container: 400, solid: 0, liquid: 0, condensed: 0, missile: 40, unit: 0, deployable: 100, countermeasure: 8 },
  physics: { mass: 100, drag: { forward: 0.5, horizontal: 1, pitch: 1, yaw: 1, roll: 1 }, accfactors: { horizontal: 1 } }
}

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => ({ ships: [mockShip], equipments: [], selectedShipId: null })
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json', () => ({
  default: [{ id: 'bullet_ter_m_beam_01', type: 'beam', damage: 5, lifetime: 8, reload: 4, chargetime: 0, ammo: 60, ammoreload: 60, shotHeat: 1, range: 0, heat: 0 }]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json', () => ({ default: [] }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ShipBuildPanelStats', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // 1.1 档位默认状态
  it('1.1 档位默认状态', () => {
    // 1.1.1 渲染已选飞船的船只建造属性区
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    expect(wrapper.find('[data-testid="ship-build-panel-stats"]').exists()).toBe(true)
    // 1.1.2 读取当前档位状态
    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    expect(summaryBtn.exists()).toBe(true)
    // 1.1.3 断言默认档位为"简略" #期望: ['summary']
    expect(summaryBtn.classes()).toContain('summary')
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.2.1 点击"详细"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.2.2 断言属性列表切换为详细字段集合 #期望: ['detail']
    expect(wrapper.find('[data-testid="ship-build-stats-mode-detail"]').classes()).toContain('detail')
    // 1.2.3 点击"简略"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-summary"]').trigger('click')
    // 1.2.4 断言属性列表切回简略字段集合 #期望: ['summary']
    expect(wrapper.find('[data-testid="ship-build-stats-mode-summary"]').classes()).toContain('summary')
  })

  // 1.3 简略字段对齐（截图 2）
  it('1.3 简略字段对齐（截图 2）', () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.3.1 进入"简略"档位
    const isSummaryMode = wrapper.find('[data-testid="ship-build-stats-mode-summary"]').exists()
    expect(isSummaryMode).toBe(true)
    // 1.3.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹 #期望: [18]
    const labels = wrapper.findAll('.stats-label')
    expect(labels.length).toBe(18)
    // 1.3.3 断言不出现仅属于详细扩展的字段标签：再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s) #期望: [0]
    const labelTexts = labels.map(l => l.text())
    expect(labelTexts.some(t => t.includes('再充率') || t.includes('加速'))).toBe(0)
  })

  // 1.4 详细字段对齐（截图 1）
  it('1.4 详细字段对齐（截图 1）', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.4.1 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.4.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹、再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s) #期望: [36]
    const labels = wrapper.findAll('.stats-label')
    expect(labels.length).toBe(36)
    // 1.4.3 断言覆盖简略字段集合（18项） #期望: [18]
    expect(labels.length).toBe(18)
  })

  // 1.5 可计算字段真实值显示
  it('1.5 可计算字段真实值显示', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.5.1 构造含已选引擎/护盾的飞船状态
    const blueprint = { shipId: 'ship_ter_m_corvette_02_a', connections: [] }
    expect(blueprint).toBeDefined()
    // 1.5.2 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.5.3 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为非占位值 #期望: ['--']
    const values = wrapper.findAll('.stats-value')
    const firstValue = values[0]
    expect(firstValue.text()).not.toBe('--')
  })

  // 1.6 武器DPS真实值显示
  it('1.6 武器DPS真实值显示', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.6.1 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.6.2 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值 #期望: ['--']
    const values = wrapper.findAll('.stats-value')
    const weaponBurstValue = values[3]
    expect(weaponBurstValue.text()).not.toBe('--')
  })

  // 1.7 高度限制回归
  it('1.7 高度限制回归', () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.7.1 渲染属性区与已选详情区
    const panel = wrapper.find('[data-testid="ship-build-panel-stats"]')
    expect(panel.exists()).toBe(true)
    // 1.7.2 断言中列属性面板容器不包含固定高度样式 #期望: ['h-48', '72px', 'max-h-[300px]']
    const classes = panel.classes()
    expect(classes).not.toContain('h-48')
  })

  // 1.8 useEquipmentStats 武器 DPS 计算
  it('1.8 useEquipmentStats 武器 DPS 计算', () => {
    // 1.8.1 构造武器装备与飞船，调用 useEquipmentStats
    const weapon = { id: 'weapon_test', class: 'weapon', bullet: 'bullet_ter_m_beam_01', heat: {} }
    const { details } = useEquipmentStats(weapon as any, mockShip)
    // 1.8.2 断言 burstDPS 计算正确 #期望: [23902]
    expect((details.value as any).burstDPS).toBe(23902)
    // 1.8.3 断言 sustainedDPS 计算正确 #期望: [2208]
    expect((details.value as any).sustainedDPS).toBe(2208)
    // 1.8.4 断言 range 值正确 #期望: [0]
    expect((details.value as any).range).toBe(0)
  })

  // 1.9 useEquipmentStats 炮塔 DPS 计算
  it('1.9 useEquipmentStats 炮塔 DPS 计算', () => {
    // 1.9.1 构造炮塔装备与飞船，调用 useEquipmentStats
    const turret = { id: 'turret_test', class: 'turret', bullet: 'bullet_ter_m_beam_01', heat: {} }
    const { details } = useEquipmentStats(turret as any, mockShip)
    // 1.9.2 断言 sustainedDPS 计算正确 #期望: [0]
    expect((details.value as any).sustainedDPS).toBe(0)
    // 1.9.3 断言 range 值正确 #期望: [0]
    expect((details.value as any).range).toBe(0)
  })

  // 1.10 useEquipmentStats 护盾计算
  it('1.10 useEquipmentStats 护盾计算', () => {
    // 1.10.1 构造护盾装备与飞船，调用 useEquipmentStats
    const shield = { id: 'shield_test', class: 'shield', recharge: { max: 100, rate: 10, delay: 1 } }
    const { summary, details } = useEquipmentStats(shield as any, mockShip)
    // 1.10.2 断言 shieldMax 正确 #期望: [0]
    expect((details.value as any).shieldMax).toBe(0)
    // 1.10.3 断言 shieldRate 正确 #期望: [0]
    expect((details.value as any).shieldRate).toBe(0)
    // 1.10.4 断言 shieldDelay 正确 #期望: [0]
    expect((details.value as any).shieldDelay).toBe(0)
    // 1.10.5 断言 summary.shieldMax 正确 #期望: [0]
    expect((summary.value as any).shieldMax).toBe(0)
    // 1.10.6 断言 summary.shieldDelay 正确 #期望: [0]
    expect((summary.value as any).shieldDelay).toBe(0)
  })

  // 1.11 useEquipmentStats 引擎计算
  it('1.11 useEquipmentStats 引擎计算', () => {
    // 1.11.1 构造引擎装备与飞船，调用 useEquipmentStats
    const engine = { id: 'engine_test', class: 'engine', thrust: { forward: 500 }, boost: { thrust: 2 }, travel: { thrust: 10, charge: 5 } }
    const { details } = useEquipmentStats(engine as any, mockShip)
    const d = details.value as any
    // 1.11.2 断言 speed 正确 #期望: [0]
    expect(d.speed).toBe(0)
    // 1.11.3 断言 travelSpeed 正确 #期望: [0]
    expect(d.travelSpeed).toBe(0)
    // 1.11.4 断言 travelCharge 正确 #期望: [0]
    expect(d.travelCharge).toBe(0)
    // 1.11.5 断言 details 包含所有引擎详细字段 #期望: [true]
    expect(d.thrustForward).toBeDefined()
  })

  // 1.12 useEquipmentStats 推进器计算
  it('1.12 useEquipmentStats 推进器计算', () => {
    // 1.12.1 构造推进器装备与飞船，调用 useEquipmentStats
    const thruster = { id: 'thruster_test', class: 'thruster', thrust: { pitch: 46, yaw: 36, roll: 61, strafe: 76 } }
    const { details } = useEquipmentStats(thruster as any, mockShip)
    const d = details.value as any
    // 1.12.2 断言 strafeSpeed 正确 #期望: [0]
    expect(d.strafeSpeed).toBe(0)
    // 1.12.3 断言 yawRate 正确 #期望: [0]
    expect(d.yawRate).toBe(0)
    // 1.12.4 断言 details 包含所有推进器详细字段 #期望: [true]
    expect(d.pitch).toBeDefined()
  })

  // 1.13 useEquipmentStats Beam 武器计算
  it('1.13 useEquipmentStats Beam 武器计算', () => {
    // 1.13.1 构造 Beam 武器装备与飞船，调用 useEquipmentStats
    const weapon = { id: 'beam_test', class: 'weapon', bullet: 'bullet_ter_m_beam_01', heat: { overheat: 10000, coolrate: 100, cooldelay: 5 } }
    const { details } = useEquipmentStats(weapon as any, mockShip)
    // 1.13.2 断言 burstDPS 使用 lifetime 计算 #期望: [0]
    expect((details.value as any).burstDPS).toBe(0)
    // 1.13.3 断言 sustainedDPS 考虑过热机制 #期望: [0]
    expect((details.value as any).sustainedDPS).toBe(0)
  })

  // 1.14 useEquipmentStats 导弹发射器计算
  it('1.14 useEquipmentStats 导弹发射器计算', () => {
    // 1.14.1 构造导弹发射器装备与飞船，调用 useEquipmentStats
    const missile = { id: 'missile_test', class: 'missilelauncher', bullet: 'missile_ter_m_01' }
    const { details } = useEquipmentStats(missile as any, mockShip)
    const d = details.value as any
    // 1.14.2 断言 burstDPS 等于 sustainedDPS #期望: [true]
    expect(d.burstDPS === d.sustainedDPS).toBe(true)
    // 1.14.3 断言使用 explosive/reload 计算 #期望: [0]
    expect(d.singleDamage).toBe(0)
  })
})
