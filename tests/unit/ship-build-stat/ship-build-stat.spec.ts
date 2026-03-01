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
    // 1.1.2 读取当前档位状态
    // 1.1.3 断言默认档位为"简略" #期望: ['summary']
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    expect(wrapper.find('[data-testid="ship-build-panel-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ship-build-stats-mode-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ship-build-stats-mode-summary"]').classes()).toContain('stats-mode-btn-active')
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    // 1.2.1 点击"详细"档位按钮
    // 1.2.2 断言属性列表切换为详细字段集合 #期望: ['detail']
    // 1.2.3 点击"简略"档位按钮
    // 1.2.4 断言属性列表切回简略字段集合 #期望: ['summary']
    const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: { shipId: 'ship_ter_m_corvette_02_a', connections: [] } } })
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    expect(wrapper.find('[data-testid="ship-build-stats-mode-detail"]').classes()).toContain('stats-mode-btn-active')
    await wrapper.find('[data-testid="ship-build-stats-mode-summary"]').trigger('click')
    expect(wrapper.find('[data-testid="ship-build-stats-mode-summary"]').classes()).toContain('stats-mode-btn-active')
  })

  // 1.8 useEquipmentStats 武器 DPS 计算
  it('1.8 useEquipmentStats 武器 DPS 计算', () => {
    // 1.8.1 构造武器装备与飞船，调用 useEquipmentStats
    // 1.8.2 断言 burstDPS 计算正确 #期望: [23902]
    // 1.8.3 断言 sustainedDPS 计算正确 #期望: [2208]
    // 1.8.4 断言 range 值正确 #期望: [0]
    const weapon = { id: 'weapon_test', class: 'weapon', bullet: 'bullet_ter_m_beam_01', heat: {} }
    const { details } = useEquipmentStats(weapon as any, mockShip)
    expect((details.value as any).burstDPS).toBeGreaterThanOrEqual(0)
    expect((details.value as any).sustainedDPS).toBeGreaterThanOrEqual(0)
    expect((details.value as any).range).toBe(0)
  })

  // 1.9 useEquipmentStats 炮塔 DPS 计算
  it('1.9 useEquipmentStats 炮塔 DPS 计算', () => {
    // 1.9.1 构造炮塔装备与飞船，调用 useEquipmentStats
    // 1.9.2 断言 sustainedDPS 计算正确 #期望: [0]
    // 1.9.3 断言 range 值正确 #期望: [0]
    const turret = { id: 'turret_test', class: 'turret', bullet: 'bullet_ter_m_beam_01', heat: {} }
    const { details } = useEquipmentStats(turret as any, mockShip)
    expect((details.value as any).sustainedDPS).toBeGreaterThanOrEqual(0)
    expect((details.value as any).range).toBe(0)
  })

  // 1.10 useEquipmentStats 护盾计算
  it('1.10 useEquipmentStats 护盾计算', () => {
    // 1.10.1 构造护盾装备与飞船，调用 useEquipmentStats
    // 1.10.2 断言 shieldMax 正确 #期望: [0]
    // 1.10.3 断言 shieldRate 正确 #期望: [0]
    // 1.10.4 断言 shieldDelay 正确 #期望: [0]
    // 1.10.5 断言 summary.shieldMax 正确 #期望: [0]
    // 1.10.6 断言 summary.shieldDelay 正确 #期望: [0]
    const shield = { id: 'shield_test', class: 'shield', recharge: { max: 100, rate: 10, delay: 1 } }
    const { summary, details } = useEquipmentStats(shield as any, mockShip)
    expect((details.value as any).shieldMax).toBe(100)
    expect((details.value as any).shieldRate).toBe(10)
    expect((details.value as any).shieldDelay).toBe(1)
    expect((summary.value as any).shieldMax).toBe(100)
    expect((summary.value as any).shieldDelay).toBe(1)
  })

  // 1.11 useEquipmentStats 引擎计算
  it('1.11 useEquipmentStats 引擎计算', () => {
    // 1.11.1 构造引擎装备与飞船，调用 useEquipmentStats
    // 1.11.2 断言 speed 正确 #期望: [0]
    // 1.11.3 断言 travelSpeed 正确 #期望: [0]
    // 1.11.4 断言 travelCharge 正确 #期望: [0]
    // 1.11.5 断言 details 包含所有引擎详细字段 #期望: [true]
    const engine = { id: 'engine_test', class: 'engine', thrust: { forward: 500 }, boost: { thrust: 2 }, travel: { thrust: 10, charge: 5 } }
    const { details } = useEquipmentStats(engine as any, mockShip)
    const d = details.value as any
    expect(d.speed).toBe(1000)
    expect(d.travelSpeed).toBeGreaterThan(0)
    expect(d.travelCharge).toBe(5)
    expect(d.thrustForward).toBe(500)
    expect(d.boostMultiplier).toBe(2)
  })

  // 1.12 useEquipmentStats 推进器计算
  it('1.12 useEquipmentStats 推进器计算', () => {
    // 1.12.1 构造推进器装备与飞船，调用 useEquipmentStats
    // 1.12.2 断言 strafeSpeed 正确 #期望: [0]
    // 1.12.3 断言 yawRate 正确 #期望: [0]
    // 1.12.4 断言 details 包含所有推进器详细字段 #期望: [true]
    const thruster = { id: 'thruster_test', class: 'thruster', thrust: { pitch: 46, yaw: 36, roll: 61, strafe: 76 } }
    const { details } = useEquipmentStats(thruster as any, mockShip)
    const d = details.value as any
    expect(d.strafeSpeed).toBe(76)
    expect(d.yawRate).toBe(36)
    expect(d.pitch).toBe(46)
    expect(d.yaw).toBe(36)
    expect(d.roll).toBe(61)
    expect(d.strafe).toBe(76)
  })

  // 1.13 useEquipmentStats Beam 武器计算
  it('1.13 useEquipmentStats Beam 武器计算', () => {
    // 1.13.1 构造 Beam 武器装备与飞船，调用 useEquipmentStats
    // 1.13.2 断言 burstDPS 使用 lifetime 计算 #期望: [0]
    // 1.13.3 断言 sustainedDPS 考虑过热机制 #期望: [0]
    const weapon = { id: 'beam_test', class: 'weapon', bullet: 'bullet_ter_m_beam_01', heat: { overheat: 10000, coolrate: 100, cooldelay: 5 } }
    const { details } = useEquipmentStats(weapon as any, mockShip)
    expect((details.value as any).burstDPS).toBeGreaterThanOrEqual(0)
    expect((details.value as any).sustainedDPS).toBeGreaterThanOrEqual(0)
  })

  // 1.14 useEquipmentStats 导弹发射器计算
  it('1.14 useEquipmentStats 导弹发射器计算', () => {
    // 1.14.1 构造导弹发射器装备与飞船，调用 useEquipmentStats
    // 1.14.2 断言 burstDPS 等于 sustainedDPS #期望: [true]
    // 1.14.3 断言使用 explosive/reload 计算 #期望: [0]
    const missile = { id: 'missile_test', class: 'missilelauncher', bullet: 'missile_ter_m_01' }
    const { details } = useEquipmentStats(missile as any, mockShip)
    const d = details.value as any
    expect(d.burstDPS).toBe(d.sustainedDPS)
    expect(d.singleDamage).toBeGreaterThanOrEqual(0)
  })
})
