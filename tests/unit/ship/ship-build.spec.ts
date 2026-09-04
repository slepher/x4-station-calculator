/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mockShips = vi.hoisted(() => ([
  {
    id: 'ship_a',
    nameId: 'ship_a_name',
    name: 'Ship A',
    class: 'ship_m',
    type: 'miner',
    race: 'terran',
    shipgroup: null,
    noplayerblueprint: false,
    noplayerbuild: false,
    production: [],
    slots: [
      { type: 'engine', count: { large: 2 }, groups: [] },
      { type: 'weapon', count: { large: 1, medium: 3 }, groups: [] },
      { type: 'thruster', count: { small: 5 }, groups: [] }
    ],
    storage: { missile: 0, unit: 0 },
    crew: { capacity: 0 },
    hull: 0,
    physics: {
      mass: 0,
      drag: {
        forward: 0,
        reverse: 0,
        horizontal: 0,
        vertical: 0,
        pitch: 0,
        yaw: 0,
        roll: 0
      }
    }
  },
  {
    id: 'ship_b',
    nameId: 'ship_b_name',
    name: 'Ship B',
    class: 'ship_m',
    type: 'miner',
    race: 'teladi',
    shipgroup: null,
    noplayerblueprint: false,
    noplayerbuild: false,
    production: [],
    slots: [
      { type: 'engine', count: { medium: 1 }, groups: [] },
      { type: 'shield', count: { medium: 2 }, groups: [] }
    ],
    storage: { missile: 0, unit: 0 },
    crew: { capacity: 0 },
    hull: 0,
    physics: {
      mass: 0,
      drag: {
        forward: 0,
        reverse: 0,
        horizontal: 0,
        vertical: 0,
        pitch: 0,
        yaw: 0,
        roll: 0
      }
    }
  },
  {
    id: 'ship_c',
    nameId: 'ship_c_name',
    name: 'Ship C',
    class: 'ship_m',
    type: 'freighter',
    race: 'terran',
    shipgroup: null,
    noplayerblueprint: false,
    noplayerbuild: false,
    production: [],
    slots: [
      { type: 'engine', count: { large: 1 }, groups: [] },
      { type: 'turret', count: { small: 2 }, groups: [] }
    ],
    storage: { missile: 0, unit: 0 },
    crew: { capacity: 0 },
    hull: 0,
    physics: {
      mass: 0,
      drag: {
        forward: 0,
        reverse: 0,
        horizontal: 0,
        vertical: 0,
        pitch: 0,
        yaw: 0,
        roll: 0
      }
    }
  },
  {
    id: 'ship_d',
    nameId: 'ship_d_name',
    name: 'Ship D',
    class: 'ship_l',
    type: 'freighter',
    race: 'terran',
    shipgroup: null,
    noplayerblueprint: false,
    noplayerbuild: false,
    production: [],
    slots: [],
    storage: { missile: 0, unit: 0 },
    crew: { capacity: 0 },
    hull: 0,
    physics: {
      mass: 0,
      drag: {
        forward: 0,
        reverse: 0,
        horizontal: 0,
        vertical: 0,
        pitch: 0,
        yaw: 0,
        roll: 0
      }
    }
  }
]))

const mockShipTypes = vi.hoisted(() => ([
  { id: 'miner', nameId: 'ship_type_miner', name: 'Miner', class: ['ship_m'] },
  { id: 'freighter', nameId: 'ship_type_freighter', name: 'Freighter', class: ['ship_m', 'ship_l'] },
  { id: 'scout', nameId: 'ship_type_scout', name: 'Scout', class: ['ship_s'] }
]))

const mockShipRaces = vi.hoisted(() => ([
  { id: 'terran', noplayerblueprint: false, noplayerbuild: false },
  { id: 'teladi', noplayerblueprint: false, noplayerbuild: false }
]))

const mockEquipmentTypes = vi.hoisted(() => ([
  { id: 'engine', nameId: 'equipment_engine', name: 'Engine' },
  { id: 'shield', nameId: 'equipment_shield', name: 'Shield' },
  { id: 'weapon', nameId: 'equipment_weapon', name: 'Weapon' },
  { id: 'turret', nameId: 'equipment_turret', name: 'Turret' },
  { id: 'thruster', nameId: 'equipment_thruster', name: 'Thruster' }
]))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ships.json', () => ({ default: mockShips }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json', () => ({ default: mockShipTypes }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json', () => ({ default: mockShipRaces }))
vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json', () => ({ default: mockEquipmentTypes }))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'ship_build.list_hint': 'list_hint',
        'ship_build.filter_class': 'Class',
        'ship_build.filter_race': 'Race',
        'ship_build.filter_type': 'Type',
        'ship_build.required': 'Required',
        'ship_build.type_hint': 'TypeHint',
        'ship_build.selected_ship': 'Selected Ship',
        'ship_build.no_selection': 'No selection',
        'ship_build.list_title': 'Ship List'
      }
      return map[key] || key
    },
    locale: { value: 'zh-CN' }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateShip: (ship: any) => `LOC-${ship.nameId}`,
    translateShipType: (type: any) => `TYPE-${type.id}`,
    translateEquipmentType: (type: any) => `FULL-${type.id}`
  })
}))

import ShipBuildView from '@/components/ShipBuildView.vue'

const mountView = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(ShipBuildView, {
    global: {
      plugins: [pinia]
    }
  })
}

describe('ShipBuildView - Filters', () => {
  it('1.1 list hidden when class not selected', () => {
    const wrapper = mountView()
    const empty = wrapper.find('[data-testid="ship-build-list-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toBe('list_hint')
  })

  it('1.2 list hidden when race/type not selected', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const empty = wrapper.find('[data-testid="ship-build-list-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toBe('list_hint')
  })

  it('1.3 intersection filtering', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')

    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    await raceButtons.find(btn => btn.text().includes('terran'))!.trigger('click')

    const typeButtons = wrapper.findAll('[data-testid="ship-build-filter-type"] button')
    await typeButtons.find(btn => btn.text().includes('TYPE-miner'))!.trigger('click')

    const items = wrapper.findAll('.list-item')
    expect(items.length).toBe(1)
    expect(items[0]!.text()).toContain('LOC-ship_a_name')
  })

  it('1.4 type linked to class', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'S')!.trigger('click')
    const typeButtons = wrapper.findAll('[data-testid="ship-build-filter-type"] button')
    expect(typeButtons.length).toBe(1)
    expect(typeButtons[0]!.text()).toContain('TYPE-scout')
  })

  it('1.5 ship name localization', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    await raceButtons.find(btn => btn.text().includes('terran'))!.trigger('click')

    const item = wrapper.find('[data-testid="ship-build-ship-name"]')
    expect(item.text()).toContain('LOC-')
  })

  it('1.6 race label counts', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const typeButtons = wrapper.findAll('[data-testid="ship-build-filter-type"] button')
    await typeButtons.find(btn => btn.text().includes('TYPE-miner'))!.trigger('click')

    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    const terran = raceButtons.find(btn => btn.text().includes('terran'))!
    const teladi = raceButtons.find(btn => btn.text().includes('teladi'))!
    expect(terran.text()).toContain('(1)')
    expect(teladi.text()).toContain('(1)')
  })

  it('1.7 type label counts', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    await raceButtons.find(btn => btn.text().includes('terran'))!.trigger('click')

    const typeButtons = wrapper.findAll('[data-testid="ship-build-filter-type"] button')
    const miner = typeButtons.find(btn => btn.text().includes('TYPE-miner'))!
    const freighter = typeButtons.find(btn => btn.text().includes('TYPE-freighter'))!
    expect(miner.text()).toContain('(1)')
    expect(freighter.text()).toContain('(1)')
  })

  it('1.8 label layout rules', async () => {
    const wrapper = mountView()
    expect(wrapper.find('.race-grid').exists()).toBe(true)

    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const typeGrid = wrapper.find('.type-grid')
    expect(typeGrid.classes()).toContain('type-grid-single')
  })

  it('1.9 equipment summary format', async () => {
    const wrapper = mountView()
    const classButtons = wrapper.findAll('[data-testid="ship-build-filter-class"] button')
    await classButtons.find(btn => btn.text() === 'M')!.trigger('click')
    const raceButtons = wrapper.findAll('[data-testid="ship-build-filter-race"] button')
    await raceButtons.find(btn => btn.text().includes('terran'))!.trigger('click')

    const equipmentLine = wrapper.find('.list-item .equipment-line')
    expect(equipmentLine.text()).toContain('E:L2')
    expect(equipmentLine.text()).toContain('W:L1M3')
    expect(equipmentLine.text()).not.toContain('thruster')

    const firstItem = wrapper.find('.list-item')
    await firstItem.trigger('click')

    const selection = wrapper.find('.selection-expanded')
    expect(selection.text()).toContain('FULL-engine:L2')
    expect(selection.text()).toContain('FULL-weapon:L1M3')
  })
})
