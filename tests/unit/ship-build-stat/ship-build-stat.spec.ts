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

  // 1.1 档位默认状态
  it('1.1 默认档位为简略', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Select a ship first
    await selectShip(wrapper)

    // Check default mode is summary
    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    expect(summaryBtn.exists()).toBe(true)
    expect(summaryBtn.classes()).toContain('stats-mode-btn-active')
  })

  // 1.2 档位切换行为
  it('1.2 点击详细按钮切换到详细档位', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Click detail button
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // Verify detail button is active
    expect(detailBtn.classes()).toContain('stats-mode-btn-active')
  })

  it('1.2 点击简略按钮切回简略档位', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Switch to detail first
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // Click summary button to switch back
    const summaryBtn = wrapper.find('[data-testid="ship-build-stats-mode-summary"]')
    await summaryBtn.trigger('click')

    // Verify summary button is active
    expect(summaryBtn.classes()).toContain('stats-mode-btn-active')
  })

  // 1.3 简略字段对齐（截图 2）
  it('1.3 简略档位显示正确的字段', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Check summary fields exist
    const statsPanel = wrapper.find('[data-testid="ship-build-stats-panel"]')
    expect(statsPanel.exists()).toBe(true)

    // Summary should have basic fields
    const statsRows = wrapper.findAll('.stats-row')
    expect(statsRows.length).toBeGreaterThan(0)
  })

  // 1.4 详细字段对齐（截图 1）
  it('1.4 详细档位包含更多字段', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
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

    // Detail should have more fields than summary
    const detailRows = wrapper.findAll('.stats-row')
    expect(detailRows.length).toBeGreaterThan(summaryCount)
  })

  // 1.5 可计算字段真实值显示
  it('1.5 详细档位显示真实值', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Switch to detail
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // Check real value fields (Hull, Shield, Speed, etc.)
    const statsValues = wrapper.findAll('.stats-value')
    expect(statsValues.length).toBeGreaterThan(0)

    // At least some values should be non-placeholder (not '--')
    const valueTexts = statsValues.map((v: any) => v.text())
    const hasRealValues = valueTexts.some((v: string) => v && v !== '--' && v.trim() !== '')
    expect(hasRealValues).toBe(true)
  })

  // 1.6 不可计算字段占位显示
  it('1.6 详细档位显示占位符', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Switch to detail
    const detailBtn = wrapper.find('[data-testid="ship-build-stats-mode-detail"]')
    await detailBtn.trigger('click')

    // Check for pending message
    const pendingMsg = wrapper.find('.stats-pending')
    expect(pendingMsg.exists()).toBe(true)

    // Check placeholder rows
    const placeholderRows = wrapper.findAll('.stats-row-placeholder')
    expect(placeholderRows.length).toBeGreaterThan(0)
  })

  // 1.7 高度限制回归
  it('1.7 属性区无固定高度样式', async () => {
    const wrapper = mount(ShipBuildView, {
      global: {
        plugins: [createPinia()]
      }
    })

    // Setup: select a ship
    await selectShip(wrapper)

    // Check stats panel has no fixed height
    const statsPanel = wrapper.find('[data-testid="ship-build-stats-panel"]')
    const statsPanelStyle = statsPanel.attributes('style') || ''
    expect(statsPanelStyle).not.toContain('h-48')
    expect(statsPanelStyle).not.toContain('72px')

    // Check selection panel has no fixed height
    const selectionPanel = wrapper.find('[data-testid="ship-build-selection"]')
    if (selectionPanel.exists()) {
      const selectionStyle = selectionPanel.attributes('style') || ''
      expect(selectionStyle).not.toContain('h-48')
      expect(selectionStyle).not.toContain('72px')
    }
  })
})
