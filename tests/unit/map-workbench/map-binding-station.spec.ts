/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MapBindingStation from '@/components/map/MapBindingStation.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
    locale: ref('en')
  })
}))

vi.mock('@/components/map/utils/mapSectorMacro', () => ({
  resolveMapSectorByMacro: vi.fn((_maps, sectorMacro: string) => ({ sectorId: sectorMacro }))
}))

vi.mock('@/store/logic/saveBindingUtils', () => ({
  resolveStationSaveBinding: vi.fn((binding) => ({
    ...binding,
    status: binding.saveStationCode === 'missing_save' ? 'missing_at_selected_time' : 'ok'
  })),
  resolveGroupSaveBinding: vi.fn((binding) => ({
    ...binding,
    status: binding.tradestationBinding?.saveStationCode === 'missing_trade' ? 'missing_at_selected_time' : 'ok'
  }))
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn()
}))

import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'

describe('MapBindingStation', () => {
  const bindStationToSaveStation = vi.fn()
  const bindTradestationToSaveStation = vi.fn()
  const clearStationBinding = vi.fn()
  const clearStationCode = vi.fn()
  const clearTradestationBinding = vi.fn()
  const clearTradestationCode = vi.fn()
  const isSaveStationAlreadyBound = vi.fn()

  function mountComponent() {
    return mount(MapBindingStation, {
      props: {
        gameGuid: 'g-1',
        sectorGroupId: 'group-a'
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive: {
        meta: { guid: 'g-1', time: 1000 },
        sectors: {
          sector_a: {
            playerStations: [
              {
                code: 'save_1',
                tag: 'factory',
                owner: 'player',
                macro: 'player_macro_1',
                position: { x: 1000, y: 0, z: 2000 }
              },
              {
                code: 'save_2',
                tag: 'factory',
                owner: 'player',
                macro: 'player_macro_2',
                position: { x: 3000, y: 0, z: 4000 }
              }
            ]
          }
        }
      },
      archives: new Map()
    } as any)

    vi.mocked(useGameDataStore).mockReturnValue({
      maps: {
        clusters: {},
        sectors: {
          sector_a: { name: 'Sector A' }
        }
      },
      localizedModulesMap: {},
      localizedModuleGroupsMap: {}
    } as any)

    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        stations: [],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'sector_a',
                jumpRange: 0,
                coverageSectorMacros: [],
                stationBindings: []
              }
            ]
          }
        ]
      },
      bindStationToSaveStation,
      bindTradestationToSaveStation,
      clearStationBinding,
      clearStationCode,
      clearTradestationBinding,
      clearTradestationCode,
      isSaveStationAlreadyBound,
      createStation: vi.fn(() => ({ id: 'new-station' })),
      importSaveStationAsBinding: vi.fn()
    } as any)
  })

  it('does not independently render a normally bound station or tradestation', () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        stations: [
          { id: 'station-1', name: 'Alpha', type: 'industrial' }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'sector_a',
                jumpRange: 0,
                coverageSectorMacros: [],
                tradestationBinding: {
                  stationId: 'tradestation_group-a',
                  saveStationCode: 'save_1',
                  sectorMacro: 'sector_a',
                  position: { x: 1000, y: 0, z: 2000 }
                },
                stationBindings: [
                  {
                    stationId: 'station-1',
                    saveStationCode: 'save_1',
                    sectorMacro: 'sector_a',
                    position: { x: 1000, y: 0, z: 2000 }
                  }
                ]
              }
            ]
          }
        ]
      },
      bindStationToSaveStation,
      bindTradestationToSaveStation,
      clearStationBinding,
      clearStationCode,
      clearTradestationBinding,
      clearTradestationCode,
      isSaveStationAlreadyBound: vi.fn((guid: string, sectorGroupId: string, code: string) => code === 'save_1'),
      createStation: vi.fn(() => ({ id: 'new-station' })),
      importSaveStationAsBinding: vi.fn()
    } as any)

    const wrapper = mountComponent()

    expect(wrapper.findAll('.station-item').length).toBe(2)
    expect(wrapper.find('.station-item--placed').exists()).toBe(false)
    expect(wrapper.find('.station-item--missing').exists()).toBe(false)
    expect(wrapper.text()).toContain('map.binding_tradestation_virtual')
    expect(wrapper.find('.station-item--tradestation').exists()).toBe(false)
  })

  it('renders placed-unbound stations with x/z and missing stations with unbind-only action', async () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        stations: [
          { id: 'station-placed', name: 'Placed', type: 'industrial' },
          { id: 'station-missing', name: 'Missing', type: 'industrial' }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'sector_a',
                jumpRange: 0,
                coverageSectorMacros: [],
                tradestationBinding: {
                  stationId: 'tradestation_group-a',
                  saveStationCode: 'missing_trade',
                  sectorMacro: 'sector_a',
                  position: { x: 5000, y: 0, z: 6000 }
                },
                stationBindings: [
                  {
                    stationId: 'station-placed',
                    sectorMacro: 'sector_a',
                    position: { x: 1200, y: 0, z: 3400 }
                  },
                  {
                    stationId: 'station-missing',
                    saveStationCode: 'missing_save',
                    sectorMacro: 'sector_a',
                    position: { x: 2200, y: 0, z: 4400 }
                  }
                ]
              }
            ]
          }
        ]
      },
      bindStationToSaveStation,
      bindTradestationToSaveStation,
      clearStationBinding,
      clearStationCode,
      clearTradestationBinding,
      clearTradestationCode,
      isSaveStationAlreadyBound,
      createStation: vi.fn(() => ({ id: 'new-station' })),
      importSaveStationAsBinding: vi.fn()
    } as any)

    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Placed')
    expect(wrapper.text()).toContain('x: 1.2km / z: 3.4km')
    expect(wrapper.findAll('.station-item--missing').length).toBe(2)

    const missingStationClear = wrapper.findAll('.station-item--missing .placed-clear')[0]
    await missingStationClear.trigger('click')
    expect(clearStationCode).toHaveBeenCalledWith('g-1', 'group-a', 'station-missing')

    const missingTradeClear = wrapper.findAll('.station-item--missing .placed-clear')[1]
    await missingTradeClear.trigger('click')
    expect(clearTradestationCode).toHaveBeenCalledWith('g-1', 'group-a')
  })

  it('renders placed-unbound virtual tradestation with x/z coordinates', () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        stations: [],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'sector_a',
                jumpRange: 0,
                coverageSectorMacros: [],
                tradestationBinding: {
                  stationId: 'tradestation_group-a',
                  sectorMacro: 'sector_a',
                  position: { x: 5000, y: 0, z: 6000 }
                },
                stationBindings: []
              }
            ]
          }
        ]
      },
      bindStationToSaveStation,
      bindTradestationToSaveStation,
      clearStationBinding,
      clearStationCode,
      clearTradestationBinding,
      clearTradestationCode,
      isSaveStationAlreadyBound,
      createStation: vi.fn(() => ({ id: 'new-station' })),
      importSaveStationAsBinding: vi.fn()
    } as any)

    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('map.binding_tradestation_virtual')
    expect(wrapper.text()).toContain('x: 5.0km / z: 6.0km')
    expect(wrapper.find('.station-item--placed.station-item--tradestation').exists()).toBe(true)
  })

  it('greys out other bound stations in bind menu and marks placed candidates', async () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        stations: [
          { id: 'station-current', name: 'Current', type: 'industrial' },
          { id: 'station-placed', name: 'Placed', type: 'industrial' },
          { id: 'station-other', name: 'OtherBound', type: 'industrial' },
          { id: 'station-free', name: 'Free', type: 'industrial' }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'sector_a',
                jumpRange: 0,
                coverageSectorMacros: [],
                stationBindings: [
                  {
                    stationId: 'station-current',
                    saveStationCode: 'save_1',
                    sectorMacro: 'sector_a',
                    position: { x: 1000, y: 0, z: 2000 }
                  },
                  {
                    stationId: 'station-placed',
                    sectorMacro: 'sector_a',
                    position: { x: 1200, y: 0, z: 3400 }
                  },
                  {
                    stationId: 'station-other',
                    saveStationCode: 'save_2',
                    sectorMacro: 'sector_a',
                    position: { x: 1500, y: 0, z: 3600 }
                  }
                ]
              }
            ]
          }
        ]
      },
      bindStationToSaveStation,
      bindTradestationToSaveStation,
      clearStationBinding,
      clearStationCode,
      clearTradestationBinding,
      clearTradestationCode,
      isSaveStationAlreadyBound: vi.fn((guid: string, sectorGroupId: string, code: string) => code === 'save_1' || code === 'save_2'),
      createStation: vi.fn(() => ({ id: 'new-station' })),
      importSaveStationAsBinding: vi.fn()
    } as any)

    const wrapper = mountComponent()
    await wrapper.find('.station-action').trigger('click')

    const menuItems = wrapper.findAll('.bind-menu-item')
    const currentItem = menuItems.find((item) => item.text().includes('Current'))
    const placedItem = menuItems.find((item) => item.text().includes('Placed'))
    const otherItem = menuItems.find((item) => item.text().includes('OtherBound'))

    expect(currentItem?.classes()).toContain('active')
    expect(placedItem?.classes()).toContain('bind-menu-item--placed')
    expect(otherItem?.classes()).toContain('bind-menu-item--disabled')
    expect(otherItem?.attributes('disabled')).toBeDefined()
  })
})
