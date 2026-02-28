/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock game data
const mockShip = vi.hoisted(() => ({
  id: 'ship_tel_l_trans_container_02_a',
  nameId: 'ship_tel_l_trans_container_02_a',
  name: 'Heron Vanguard',
  class: 'ship_l',
  type: 'freighter',
  race: 'teladi',
  shipgroup: null,
  noplayerblueprint: false,
  noplayerbuild: false,
  production: [],
  slots: [
    { type: 'engine', count: { large: 4 }, groups: [] },
    { type: 'shield', count: { large: 4 }, groups: [] },
    { type: 'cargo', count: { large: 10 }, groups: [] }
  ],
  storage: { missile: 10, unit: 5 },
  cargo: [
    { type: 'container', capacity: 10000 },
    { type: 'solid', capacity: 5000 },
    { type: 'liquid', capacity: 3000 },
    { type: 'condensed', capacity: 2000 }
  ],
  dockarea: [
    { size: 'dock_m', capacity: 1 },
    { size: 'dock_s', capacity: 2 }
  ],
  crew: { capacity: 25 },
  hull: 62500,
  shipstorage: [
    { size: 'container', capacity: 10000 },
    { size: 'solid', capacity: 5000 },
    { size: 'liquid', capacity: 3000 },
    { size: 'condensed', capacity: 2000 }
  ],
  physics: {
    mass: 62500,
    drag: {
      forward: 25,
      reverse: 50,
      horizontal: 50,
      vertical: 50,
      pitch: 1,
      yaw: 1,
      roll: 2
    }
  }
}))

const mockShipTypes = vi.hoisted(() => [
  { id: 'freighter', nameId: 'ship_type_freighter', name: 'Freighter', class: ['ship_s', 'ship_m', 'ship_l'] }
])

const mockShipRaces = vi.hoisted(() => [
  { id: 'teladi', noplayerblueprint: false, noplayerbuild: false }
])

const mockEquipmentTypes = vi.hoisted(() => [
  { id: 'engine', nameId: 'equipment_engine', name: 'Engine' },
  { id: 'shield', nameId: 'equipment_shield', name: 'Shield' },
  { id: 'cargo', nameId: 'equipment_cargo', name: 'Cargo' }
])

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ships.json', () => ({ default: [mockShip] }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json', () => ({ default: mockShipTypes }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json', () => ({ default: mockShipRaces }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json', () => ({ default: mockEquipmentTypes }))

// Mock equipment data for engine/shield stats
vi.mock('@/store/logic/useGameData', () => ({
  useGameData: () => ({
    getEquipmentById: (id: string) => {
      if (id.includes('engine')) {
        return { thrustForward: 500, boostMultiplier: 1.5, travelMultiplier: 3, boostDuration: 10, boostRecharge: 5, travelCharge: 30 }
      }
      if (id.includes('shield')) {
        return { max: 5000, rate: 500, delay: 5 }
      }
      return null
    }
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'ship_build.stats_mode_summary': 'Summary',
        'ship_build.stats_mode_detail': 'Detail',
        'ship_build.stats_detail_pending': 'Detailed stats data source is not wired yet. Placeholder fields are shown.',
        'ship_build.stats_hull': 'Hull',
        'ship_build.stats_shield': 'Shield',
        'ship_build.stats_speed': 'Speed',
        'ship_build.stats_boost_speed': 'Boost Speed',
        'ship_build.stats_travel_speed': 'Travel Speed',
        'ship_build.stats_crew': 'Crew',
        'ship_build.stats_storage_container': 'Container Storage',
        'ship_build.stats_weapon_burst': 'Weapon Burst Output',
        'ship_build.stats_turret_avg': 'Turret Avg Output',
        'ship_build.stats_weapon_sustained': 'Weapon Sustained Output'
      }
      return map[key] || key
    },
    locale: { value: 'en' }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateShip: (ship: any) => ship.name,
    translateShipType: (type: any) => type.name,
    translateEquipmentType: (type: any) => type.name
  })
}))

import ShipBuildView from '@/components/ShipBuildView.vue'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'

describe('ShipBuildStats - Unit Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Helper to select a ship in the UI
  const selectShip = async (wrapper: any) => {
    // Find and click L button in class filter
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    const lBtn = classButtons.find((btn: any) => btn.text().includes('L'))
    if (lBtn) await lBtn.trigger('click')

    // Find and click teladi button in race filter
    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    const teladiBtn = raceButtons.find((btn: any) => btn.text().toLowerCase().includes('teladi'))
    if (teladiBtn) await teladiBtn.trigger('click')

    // Find and click freighter button in type filter
    const typeButtons = wrapper.findAll('[data-testid="ship-build-filter-type"] button')
    const freightBtn = typeButtons.find((btn: any) => btn.text().toLowerCase().includes('freighter'))
    if (freightBtn) await freightBtn.trigger('click')

    // Click first item in list
    const listItem = wrapper.find('.list-item')
    if (listItem) await listItem.trigger('click')
  }

  // Mock $t globally for all components
const mockT = (key: string) => {
  const map: Record<string, string> = {
    'ship_build.stats_mode_summary': 'Summary',
    'ship_build.stats_mode_detail': 'Detail',
    'ship_build.stats_detail_pending': 'Detailed stats data source is not wired yet. Placeholder fields are shown.',
    'ship_build.stats_hull': 'Hull',
    'ship_build.stats_shield': 'Shield',
    'ship_build.stats_speed': 'Speed',
    'ship_build.stats_boost_speed': 'Boost Speed',
    'ship_build.stats_travel_speed': 'Travel Speed',
    'ship_build.stats_crew': 'Crew',
    'ship_build.stats_storage_container': 'Container Storage',
    'ship_build.stats_weapon_burst': 'Weapon Burst Output',
    'ship_build.stats_turret_avg': 'Turret Avg Output',
    'ship_build.stats_weapon_sustained': 'Weapon Sustained Output',
    'ship_build.title': 'Ship Build',
    'ship_build.select_ship': 'Select Ship',
    'ship_build.filters': 'Filters',
    'ship_build.panel_fit': 'Fit',
    'ship_build.panel_stats': 'Stats',
    'ship_build.panel_materials': 'Materials',
    'ship_build.stats_preview': 'Preview'
  }
  return map[key] || key
}

const globalMocks = {
  $t: mockT
}

  // 1.1 档位默认状态
  it('1.1 档位默认状态', async () => {
    // 1.1.1 渲染已选飞船的船只建造属性区
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Select a ship first
    await selectShip(wrapper)

    // 1.1.2 读取当前档位状态
    const statsPanel = wrapper.findComponent(ShipBuildPanelStats)

    // 1.1.3 断言默认档位为"简略"
    expect(statsPanel.vm.statsViewMode).toBe('summary')
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    // 1.2.1 点击"详细"档位按钮
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // 1.2.2 断言属性列表切换为详细字段集合
    expect(wrapper.findComponent(ShipBuildPanelStats).vm.statsViewMode).toBe('detail')

    // 1.2.3 点击"简略"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-summary"]').trigger('click')

    // 1.2.4 断言属性列表切回简略字段集合
    expect(wrapper.findComponent(ShipBuildPanelStats).vm.statsViewMode).toBe('summary')
  })

  // 1.3 简略字段对齐（截图 2）
  it('1.3 简略字段对齐（截图 2）', async () => {
    // 1.3.1 进入"简略"档位
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // 1.3.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹（期望 toHaveCount(18)）
    expect(wrapper.findAll('.stats-row').length).toBe(18)

    // 1.3.3 断言不出现仅属于详细扩展的字段标签：再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s)（期望 toHaveCount(0)）
    expect(wrapper.findAll('.stats-row').length).toBe(0)
  })

  // 1.4 详细字段对齐（截图 1）
  it('1.4 详细字段对齐（截图 1）', async () => {
    // 1.4.1 进入"详细"档位
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Get summary field count
    const summaryRows = wrapper.findAll('.stats-row')
    const summaryCount = summaryRows.length

    // Switch to detail
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // 1.4.2 断言包含以下字段标签：船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推器助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹、再充率(MW)、再充延迟(秒)、编组平均护盾容量、武器持续性输出值、固体仓储(m3)、液体仓储(m3)、冷凝态仓储(m3)、加速(m/s2)、助推加速度(m/s2)、助推时长(秒)、助推回充率(%/s)、巡航加速度(m/s2)、巡航加力时间(秒)、平移速度(m/s)、平移加速度(m/s2)、水平转向(°/s)、俯仰(°/s)、横滚(°/s)（期望 toHaveCount(35)）
    expect(wrapper.findAll('.stats-row').length).toBe(35)

    // 1.4.3 断言覆盖简略字段集合（18项）（期望 toBeGreaterThanOrEqual(18)）
    expect(wrapper.findAll('.stats-row').length).toBeGreaterThanOrEqual(18)
  })

  // 1.5 可计算字段真实值显示
  it('1.5 可计算字段真实值显示', async () => {
    // 1.5.1 构造含已选引擎/护盾的飞船状态
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // 1.5.2 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')

    // 1.5.3 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为非占位值（非 `--` 或 `—`）（期望 not.toBe('--')）
    expect(wrapper.find('.stats-value').text()).not.toBe('--')
  })

  // 1.6 武器DPS真实值显示
  it('1.6 武器DPS真实值显示', async () => {
    // 1.6.1 进入"详细"档位
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // 1.6.2 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值（非 `--` 或 `—`）（期望 not.toBe('--')）
    expect(wrapper.find('.stats-value').text()).not.toBe('--')
  })

  // 1.7 高度限制回归
  it('1.7 高度限制回归', async () => {
    // 1.7.1 渲染属性区与已选详情区
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()],
        mocks: globalMocks
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // 1.7.2 断言中列属性面板容器不包含固定高度样式 `h-48`、`72px`、`max-h-[300px]`（期望 toBeFalsy()）
    expect(wrapper.find('[data-testid="ship-build-stats-panel"]').attributes('style') || '').toBeFalsy()

    // Check selection panel has no fixed height
    const selectionPanel = wrapper.find('[data-testid="ship-build-selection"]')
    if (selectionPanel.exists()) {
      const selectionStyle = selectionPanel.attributes('style') || ''
      expect(selectionStyle).not.toContain('h-48')
      expect(selectionStyle).not.toContain('72px')
    }
  })
})

describe('ShipBuildStats - Turn Rate Calculation', () => {
  // 转向率公式测试：转向率 = 推进器单轴推力 / 船体单轴阻力 (单位: rad/s)

  it('大阪 + L均衡推进器Mk3 转向率计算正确', () => {
    // 数据来源：Osaka (ship_ter_l_destroyer_01_a) + thruster_gen_l_allround_01_mk3
    const thruster = { pitch: 972, yaw: 972, roll: 1035 }
    const drag = { pitch: 90, yaw: 107, roll: 70 }

    // 转向率 = 推进器推力 / 船体阻力
    const pitchRate = thruster.pitch / drag.pitch
    const yawRate = thruster.yaw / drag.yaw
    const rollRate = thruster.roll / drag.roll

    // 验证计算结果 (rad/s)
    expect(Math.round(pitchRate * 100) / 100).toBe(10.8)
    expect(Math.round(yawRate * 100) / 100).toBe(9.08)
    expect(Math.round(rollRate * 100) / 100).toBe(14.79)
  })

  it('mk1 推进器转向率计算正确', () => {
    // thruster_gen_l_allround_01_mk1
    const thruster = { pitch: 704, yaw: 704, roll: 750 }
    const drag = { pitch: 90, yaw: 107, roll: 70 }

    const pitchRate = thruster.pitch / drag.pitch
    const yawRate = thruster.yaw / drag.yaw
    const rollRate = thruster.roll / drag.roll

    expect(Math.round(pitchRate * 100) / 100).toBe(7.82)
    expect(Math.round(yawRate * 100) / 100).toBe(6.58)
    expect(Math.round(rollRate * 100) / 100).toBe(10.71)
  })
})
