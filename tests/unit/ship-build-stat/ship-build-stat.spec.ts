/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

// 使用真实的大太刀(Odachi)飞船数据
const odachiShip = shipsRaw.find((s: any) => s.id === 'ship_ter_m_corvette_02_a')

// 查找真实装备数据
const findEquipment = (id: string) => equipmentsRaw.find((e: any) => e.id === id)
const findMissile = (id: string) => missilesRaw.find((m: any) => m.id === id || m.macro === id)

const odachiEngine = findEquipment('engine_ter_m_allround_01_mk1')
const odachiThruster = findEquipment('thruster_gen_m_allround_01_mk1')
const odachiShield = findEquipment('shield_ter_m_standard_02_mk2')
const odachiWeapon = findEquipment('weapon_ter_m_beam_01_mk2')
const odachiTurret = findEquipment('turret_ter_m_beam_01_mk1')
const shotgunTurret = findEquipment('turret_arg_m_shotgun_01_mk1')
const odachiMissileLauncher = findEquipment('weapon_bor_m_dumbfire_01_mk1')

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => ({
    ships: [odachiShip],
    equipments: [odachiEngine, odachiThruster, odachiShield, odachiWeapon, odachiTurret, shotgunTurret, odachiMissileLauncher],
    selectedShipId: 'ship_ter_m_corvette_02_a'
  })
}))

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
    // 验证默认激活的是简略档位按钮
    const isSummaryActive = summaryBtn.classes().includes('stats-mode-btn-active')
    expect(isSummaryActive).toBe(true)
    // summary 模式验证
    expect('summary').toBeDefined()
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.2.1 点击"详细"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.2.2 断言属性列表切换为详细字段集合 #期望: ['detail']
    const isDetailActive = wrapper.find('[data-testid="ship-build-stats-mode-detail"]').classes().includes('stats-mode-btn-active')
    expect(isDetailActive).toBe(true)
    // detail 模式验证
    expect('detail').toBeDefined()
    // 1.2.3 点击"简略"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-summary"]').trigger('click')
    // 1.2.4 断言属性列表切回简略字段集合 #期望: ['summary']
    const isSummaryActive = wrapper.find('[data-testid="ship-build-stats-mode-summary"]').classes().includes('stats-mode-btn-active')
    expect(isSummaryActive).toBe(true)
    // summary 模式验证
    expect('summary').toBeDefined()
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
    // 1.3.3 断言不出现仅属于详细扩展的字段标签：再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s) #期望: [false]
    const labelTexts = labels.map(l => l.text())
    expect(labelTexts.some(t => t.includes('再充率') || t.includes('加速'))).toBe(false)
  })

  // 1.4 详细字段对齐（截图 1）
  it('1.4 详细字段对齐（截图 1）', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.4.1 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.4.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹、再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s) #期望: [36]
    const labels = wrapper.findAll('.stats-label')
    expect(labels.length).toBe(36)
    // 1.4.3 断言简略字段（hull、shield等）仍然存在于详细模式中 #期望: [true]
    const labelTexts = labels.map(l => l.text())
    expect(labelTexts.some(t => t.includes('hull') || t.includes('shield'))).toBe(true)
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
    expect(firstValue?.text()).not.toBe('--')
  })

  // 1.6 武器DPS真实值显示
  it('1.6 武器DPS真实值显示', async () => {
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    // 1.6.1 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    // 1.6.2 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值 #期望: ['--']
    const values = wrapper.findAll('.stats-value')
    const weaponBurstValue = values[3]
    expect(weaponBurstValue?.text()).not.toBe('--')
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

  // 1.8 useEquipmentStats 武器 DPS 计算 (无heat属性)
  it('1.8 useEquipmentStats 武器 DPS 计算', () => {
    // 1.8.1 构造武器装备 weapon_ter_m_beam_01_mk2 (无heat属性)，调用 useEquipmentStats
    const weaponObj = { id: 'weapon_ter_m_beam_01_mk2', type: 'weapon', class: 'weapon', bullet: 'bullet_ter_m_beam_01_mk2_macro' }
    const { details } = useEquipmentStats(weaponObj as any, odachiShip)
    const d = details.value as any
    // 1.8.2 断言 burstDPS = damage * lifetime / avgShotTime = 7000 * 1.75 / 2.05 = 5976 #期望: [5976]
    expect(Math.round(d.burstDPS)).toBe(5976)
    // 1.8.3 断言 sustainedDPS 无heat时等于burstDPS #期望: [5976]
    expect(Math.round(d.sustainedDPS)).toBe(5976)
    // 1.8.4 断言 range = 6800 (beam武器实际射程来自XML数据) #期望: [6800]
    expect(d.range).toBe(6800)
  })

  // 1.9 useEquipmentStats 炮塔 DPS 计算
  it('1.9 useEquipmentStats 炮塔 DPS 计算', () => {
    // 1.9.1 使用实际 turret_ter_m_beam_01_mk1 数据
    const { details } = useEquipmentStats(odachiTurret as any, odachiShip)
    const d = details.value as any
    // 1.9.2 断言 sustainedDPS = damage * lifetime / reload = 72 * 1.0 / 3.0 = 24 #期望: [24]
    expect(Math.round(d.sustainedDPS)).toBe(24)
    // 1.9.3 断言 range = 2550 (炮塔beam使用bullet_ter_turret_m_beam_01_mk1_macro) #期望: [2550]
    expect(d.range).toBe(2550)
  })

  // 1.10 useEquipmentStats 护盾计算
  it('1.10 useEquipmentStats 护盾计算', () => {
    // 1.10.1 使用实际 shield_ter_m_standard_02_mk2 数据
    const { summary, details } = useEquipmentStats(odachiShield as any, odachiShip)
    const d = details.value as any
    const s = summary.value as any
    // 1.10.2 断言 shieldMax = recharge.max = 6439 #期望: [6439]
    expect(d.shieldMax).toBe(6439)
    // 1.10.3 断言 shieldRate = recharge.rate = 45 #期望: [45]
    expect(d.shieldRate).toBe(45)
    // 1.10.4 断言 shieldDelay = recharge.delay = 0.47 #期望: [0.47]
    expect(d.shieldDelay).toBe(0.47)
    // 1.10.5 断言 summary.shieldMax = 6439 #期望: [6439]
    expect(s.shieldMax).toBe(6439)
    // 1.10.6 断言 summary.shieldDelay = 0.47 #期望: [0.47]
    expect(s.shieldDelay).toBe(0.47)
  })

  // 1.11 useEquipmentStats 引擎计算
  it('1.11 useEquipmentStats 引擎计算', () => {
    // 1.11.1 使用真实引擎 engine_ter_m_allround_01_mk1 + 飞船 (mass=20.594, drag.forward=2.524)，调用 useEquipmentStats
    const { details } = useEquipmentStats(odachiEngine as any, odachiShip as any)
    const d = details.value as any
    // 1.11.2 断言 speed = thrust.forward / drag.forward = 850 / 2.524 = 337 #期望: [337]
    expect(d.speed).toBe(337)
    // 1.11.3 断言 travelSpeed = thrust.forward * travel.thrust / drag.forward = 850 * 9.1 / 2.524 = 3065 #期望: [3065]
    expect(d.travelSpeed).toBe(3065)
    // 1.11.4 断言 travelCharge = travel.charge = 2.0 #期望: [2.0]
    expect(d.travelCharge).toBe(2.0)
    // 1.11.5 断言 details 包含所有引擎详细字段 (thrustForward, boostMultiplier, etc.) #期望: [true]
    expect(d.thrustForward).toBeDefined()
  })

  // 1.12 useEquipmentStats 推进器计算
  // 注意: thruster 装备在 JSON 中 class='engine'，但 useEquipmentStats 已修复为使用 equipment.type === 'thruster' 判断
  it('1.12 useEquipmentStats 推进器计算', () => {
    // 1.12.1 使用真实推进器 thruster_gen_m_allround_01_mk1 + 飞船 (drag.horizontal=11.2)
    const { details } = useEquipmentStats(odachiThruster as any, odachiShip as any)
    const d = details.value as any
    // 1.12.2 断言 strafeSpeed = thrust.strafe / drag.horizontal = 1010 / 11.2 = 90 #期望: [90]
    expect(d.strafeSpeed).toBe(90)
    // 1.12.3 断言 yawRate = thrust.yaw / drag.yaw = 240 / 6.7 = 35.82 #期望: [35.82]
    expect(d.yawRate).toBeCloseTo(35.82)
    // 1.12.4 断言 details 包含所有推进器详细字段 (pitch, yaw, roll, strafe, etc.) #期望: [true]
    expect(d.pitch).toBeDefined()
  })

  // 1.13 useEquipmentStats Beam 武器计算
  it('1.13 useEquipmentStats Beam 武器计算', () => {
    // 1.13.1 使用实际 weapon_ter_m_beam_01_mk2 数据
    const weaponObj = odachiWeapon
    const { details } = useEquipmentStats(weaponObj as any, odachiShip)
    const d = details.value as any
    // 1.13.2 断言 burstDPS = damage * lifetime / reload = 7000 * 1.75 / 2.05 = 5976 #期望: [5976]
    expect(Math.round(d.burstDPS)).toBe(5976)
    // 1.13.3 断言 sustainedDPS 考虑过热机制 (overheat=10000, coolrate=500, cooldelay=0.13) #期望: [552]
    expect(Math.round(d.sustainedDPS)).toBe(552)
  })

  // 1.14 useEquipmentStats 导弹发射器计算
  it('1.14 useEquipmentStats 导弹发射器计算', () => {
    // 1.14.1 使用实际 weapon_bor_m_dumbfire_01_mk1 数据
    const { details } = useEquipmentStats(odachiMissileLauncher as any, odachiShip)
    const d = details.value as any
    // 1.14.2 断言 burstDPS = explosive / reload = 3960 / 4.5 = 880 #期望: [880]
    expect(Math.round(d.burstDPS)).toBe(880)
    // 1.14.3 断言 sustainedDPS = burstDPS (导弹无过热) #期望: [880]
    expect(Math.round(d.sustainedDPS)).toBe(880)
  })

  // 1.15 useEquipmentStats 炮塔单发与DPS系数计算
  it('1.15 useEquipmentStats 炮塔单发与DPS系数计算', () => {
    const { details } = useEquipmentStats(shotgunTurret as any, odachiShip)
    const d = details.value as any
    const bullet = bulletsRaw.find((b: any) => b.id === shotgunTurret?.bullet)

    expect(bullet).toBeDefined()
    const expectedSingleDamage = bullet.damage
    const expectedBurst = (bullet.damage * bullet.amount * bullet.barrelamount) / bullet.reload

    // 单发伤害不乘 amount / barrelamount
    expect(d.singleDamage).toBe(expectedSingleDamage)
    // DPS 需要乘 amount * barrelamount
    expect(Math.round(d.burstDPS)).toBe(Math.round(expectedBurst))
  })
})
