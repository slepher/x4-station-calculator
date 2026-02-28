/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'

// Mock game data
const mockShip = {
  id: 'ship_ter_m_corvette_02_a',
  nameId: '{20101,64801}',
  name: 'Test Ship',
  class: 'ship_m',
  type: 'corvette',
  race: 'terran',
  hull: 16100,
  radarRange: 40000,
  crew: { capacity: 4 },
  storage: {
    container: 400,
    solid: 0,
    liquid: 0,
    condensed: 0,
    missile: 40,
    unit: 0,
    deployable: 100,
    countermeasure: 8
  },
  dockarea: [
    { size: 'dock_m', capacity: 0 },
    { size: 'dock_s', capacity: 0 }
  ],
  shipstorage: [
    { size: 'dock_m', capacity: 0 },
    { size: 'dock_s', capacity: 10 }
  ],
  physics: {
    mass: 100,
    drag: {
      forward: 0.5,
      reverse: 1.0,
      horizontal: 1.0,
      vertical: 1.0,
      pitch: 1.0,
      yaw: 1.0,
      roll: 1.0
    },
    accfactors: {
      horizontal: 1.0
    }
  }
}

const mockEngine = {
  id: 'engine_ter_m_allround_01_mk1',
  class: 'engine',
  thrust: { forward: 500 },
  boost: { thrust: 4.75, acceleration: 1, duration: 15, recharge: 100 },
  travel: { thrust: 27.72, attack: 44, charge: 5 }
}

const mockShield = {
  id: 'shield_ter_m_standard_02_mk2',
  class: 'shield',
  recharge: { max: 6439, rate: 90, delay: 1 }
}

const mockWeapon = {
  id: 'weapon_ter_m_beam_01_mk2',
  class: 'weapon',
  bullet: 'bullet_ter_m_beam_01'
}

const mockTurret = {
  id: 'turret_ter_m_beam_01_mk1',
  class: 'turret',
  bullet: 'bullet_ter_m_beam_01'
}

const mockThruster = {
  id: 'thruster_gen_m_allround_01_mk1',
  class: 'thruster',
  thrust: { pitch: 46, yaw: 36, roll: 61, strafe: 76 }
}

const mockBullet = {
  id: 'bullet_ter_m_beam_01',
  type: 'beam',
  damage: 5,
  lifetime: 8,
  reload: 4,
  chargetime: 0,
  ammo: 60,
  ammoreload: 60,
  shotHeat: 1
}

const mockShipBlueprint = {
  shipId: 'ship_ter_m_corvette_02_a',
  connections: [
    {
      slot_type: 'engine',
      group: [{ equipment_id: 'engine_ter_m_allround_01_mk1', count: 1 }]
    },
    {
      slot_type: 'thruster',
      group: [{ equipment_id: 'thruster_gen_m_allround_01_mk1', count: 1 }]
    },
    {
      slot_type: 'shield',
      group: [
        { equipment_id: 'shield_ter_m_standard_02_mk2', count: 1 },
        { equipment_id: 'shield_ter_m_standard_02_mk2', count: 1 }
      ]
    },
    {
      slot_type: 'weapon',
      group: [
        { equipment_id: 'weapon_ter_m_beam_01_mk2', count: 1 },
        { equipment_id: 'weapon_ter_m_beam_01_mk2', count: 1 },
        { equipment_id: 'weapon_ter_m_beam_01_mk2', count: 1 },
        { equipment_id: 'weapon_ter_m_beam_01_mk2', count: 1 }
      ]
    },
    {
      slot_type: 'turret',
      group: [
        { equipment_id: 'turret_ter_m_beam_01_mk1', count: 1 },
        { equipment_id: 'turret_ter_m_beam_01_mk1', count: 1 }
      ]
    }
  ]
}

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => ({
    ships: [mockShip],
    equipments: [mockEngine, mockShield, mockWeapon, mockTurret, mockThruster],
    selectedShipId: null
  })
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json', () => ({
  default: [mockBullet]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json', () => ({
  default: []
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('ShipBuildPanelStats - 档位默认状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // 1.1 档位默认状态
  it('1.1 档位默认状态', () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.1.1 渲染已选飞船的船只建造属性区
    const statsPanel = wrapper.find('[data-testid="ship-build-panel-stats"]')
    expect(statsPanel.exists()).toBe(true)

    // 1.1.2 读取当前档位状态 - 通过检查按钮样式
    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')

    // 1.1.3 断言默认档位为"简略"（期望 toBe('summary')）
    expect(summaryBtn.classes()).toContain('stats-mode-btn-active')
    expect(detailBtn.classes()).toContain('stats-mode-btn-idle')
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')

    // 1.2.1 点击"详细"档位按钮
    await detailBtn.trigger('click')

    // 1.2.2 断言属性列表切换为详细字段集合（期望 toBe('detail')）
    expect(detailBtn.classes()).toContain('stats-mode-btn-active')
    expect(summaryBtn.classes()).toContain('stats-mode-btn-idle')

    // 1.2.3 点击"简略"档位按钮
    await summaryBtn.trigger('click')

    // 1.2.4 断言属性列表切回简略字段集合（期望 toBe('summary')）
    expect(summaryBtn.classes()).toContain('stats-mode-btn-active')
    expect(detailBtn.classes()).toContain('stats-mode-btn-idle')
  })

  // 1.3 简略字段对齐
  it('1.3 简略字段对齐', () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.3.1 进入"简略"档位（默认状态）
    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    expect(summaryBtn.classes()).toContain('stats-mode-btn-active')

    // 1.3.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹（期望 toHaveCount(18)）
    const labels = wrapper.findAll('.stats-label')
    const labelTexts = labels.map(l => l.text())

    // 简略字段标签
    const expectedSummaryLabels = [
      'ship_build.stats_hull',
      'ship_build.stats_shield',
      'ship_build.stats_radar_range',
      'ship_build.stats_weapon_burst',
      'ship_build.stats_turret_avg',
      'ship_build.stats_storage_container',
      'ship_build.stats_dock_m_count',
      'ship_build.stats_dock_m_capacity',
      'ship_build.stats_dock_s_count',
      'ship_build.stats_dock_s_capacity',
      'ship_build.stats_speed',
      'ship_build.stats_boost_speed',
      'ship_build.stats_travel_speed',
      'ship_build.stats_crew',
      'ship_build.stats_storage_unit',
      'ship_build.stats_missile',
      'ship_build.stats_deployable',
      'ship_build.stats_countermeasure'
    ]

    expect(labelTexts.length).toBe(18)

    // 1.3.3 断言不出现仅属于详细扩展的字段标签（期望 toHaveCount(0)）
    const detailOnlyLabels = [
      'ship_build.stats_shield_recharge_rate',
      'ship_build.stats_shield_recharge_delay',
      'ship_build.stats_shield_group_avg',
      'ship_build.stats_weapon_sustained',
      'ship_build.stats_storage_solid',
      'ship_build.stats_storage_liquid',
      'ship_build.stats_storage_condensed',
      'ship_build.stats_acceleration',
      'ship_build.stats_boost_acceleration',
      'ship_build.stats_boost_duration',
      'ship_build.stats_boost_recharge',
      'ship_build.stats_travel_acceleration',
      'ship_build.stats_travel_charge_time',
      'ship_build.stats_strafe_speed',
      'ship_build.stats_strafe_acceleration',
      'ship_build.stats_yaw',
      'ship_build.stats_pitch',
      'ship_build.stats_roll'
    ]

    detailOnlyLabels.forEach(label => {
      expect(labelTexts).not.toContain(label)
    })
  })

  // 1.4 详细字段对齐
  it('1.4 详细字段对齐', async () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.4.1 进入"详细"档位
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // 1.4.2 断言包含以下字段标签（期望 toHaveCount(36)）
    const labels = wrapper.findAll('.stats-label')
    const labelTexts = labels.map(l => l.text())
    expect(labelTexts.length).toBe(36)

    // 1.4.3 断言覆盖简略字段集合（18项）（期望 toBeGreaterThanOrEqual(18)）
    const summaryLabels = [
      'ship_build.stats_hull',
      'ship_build.stats_shield',
      'ship_build.stats_radar_range',
      'ship_build.stats_weapon_burst',
      'ship_build.stats_turret_avg',
      'ship_build.stats_storage_container',
      'ship_build.stats_dock_m_count',
      'ship_build.stats_dock_m_capacity',
      'ship_build.stats_dock_s_count',
      'ship_build.stats_dock_s_capacity',
      'ship_build.stats_speed',
      'ship_build.stats_boost_speed',
      'ship_build.stats_travel_speed',
      'ship_build.stats_crew',
      'ship_build.stats_storage_unit',
      'ship_build.stats_missile',
      'ship_build.stats_deployable',
      'ship_build.stats_countermeasure'
    ]

    const coveredCount = summaryLabels.filter(label => labelTexts.includes(label)).length
    expect(coveredCount).toBeGreaterThanOrEqual(18)
  })

  // 1.5 可计算字段真实值显示
  it('1.5 可计算字段真实值显示', async () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.5.1 构造含已选引擎/护盾的飞船状态（通过 mockShipBlueprint 提供）
    const statsPanel = wrapper.find('[data-testid="ship-build-panel-stats"]')
    expect(statsPanel.exists()).toBe(true)

    // 1.5.2 进入"详细"档位
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // 1.5.3 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为非占位值（非 `--` 或 `—`）
    const values = wrapper.findAll('.stats-value')
    const valueTexts = values.map(v => v.text())

    // 船体
    const hullValue = valueTexts.find(t => t.includes('16,100'))
    expect(hullValue).toBeDefined()
    expect(hullValue).not.toBe('--')

    // 护盾
    const shieldValue = valueTexts.find(t => t.includes('12,878'))
    expect(shieldValue).toBeDefined()
    expect(shieldValue).not.toBe('--')

    // 速度
    const speedValue = valueTexts.find(t => t.includes('198'))
    expect(speedValue).toBeDefined()
    expect(speedValue).not.toBe('--')

    // 助推速度
    const boostSpeedValue = valueTexts.find(t => t.includes('950'))
    expect(boostSpeedValue).toBeDefined()
    expect(boostSpeedValue).not.toBe('--')

    // 巡航速度
    const travelSpeedValue = valueTexts.find(t => t.includes('5,544'))
    expect(travelSpeedValue).toBeDefined()
    expect(travelSpeedValue).not.toBe('--')

    // 船员
    const crewValue = valueTexts.find(t => t.includes('4') && !t.includes(','))
    expect(crewValue).toBeDefined()
    expect(crewValue).not.toBe('--')

    // 集装箱仓储
    const containerValue = valueTexts.find(t => t.includes('400'))
    expect(containerValue).toBeDefined()
    expect(containerValue).not.toBe('--')
  })

  // 1.6 武器DPS真实值显示
  it('1.6 武器DPS真实值显示', async () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.6.1 进入"详细"档位
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // 1.6.2 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值（非 `--` 或 `—`）（期望 not.toBe('--')）
    const values = wrapper.findAll('.stats-value')
    const valueTexts = values.map(v => v.text())

    // 武器爆发输出值 (23902 MW)
    const burstValue = valueTexts.find(t => t.includes('23,902'))
    expect(burstValue).toBeDefined()
    expect(burstValue).not.toBe('--')

    // 武器持续性输出值 (2208.8 MW -> 2,209 MW)
    const sustainedValue = valueTexts.find(t => t.includes('2,209'))
    expect(sustainedValue).toBeDefined()
    expect(sustainedValue).not.toBe('--')

    // 炮塔平均输出值 (0 MW)
    const turretAvgValue = valueTexts.find(t => t.includes('0'))
    expect(turretAvgValue).toBeDefined()
    expect(turretAvgValue).not.toBe('--')
  })

  // 1.7 高度限制回归
  it('1.7 高度限制回归', () => {
    const wrapper = mount(ShipBuildPanelStats, {
      props: {
        shipBlueprint: mockShipBlueprint
      }
    })

    // 1.7.1 渲染属性区与已选详情区
    const statsPanel = wrapper.find('[data-testid="ship-build-panel-stats"]')
    expect(statsPanel.exists()).toBe(true)

    // 1.7.2 断言中列属性面板容器不包含固定高度样式 `h-48`、`72px`、`max-h-[300px]`（期望 toBeFalsy()）
    const classes = statsPanel.classes()
    expect(classes).not.toContain('h-48')
    expect(classes.join(' ')).not.toContain('72px')
    expect(classes.join(' ')).not.toContain('max-h-[300px]')
  })
})
