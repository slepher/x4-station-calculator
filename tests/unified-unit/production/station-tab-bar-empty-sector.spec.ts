/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    orderedStationsBySector: [
      { id: 'st-1', name: 'Station-1', type: 'industrial', sectorId: 'sec-b', showTransitTab: false }
    ],
    sectors: [
      { id: 'sec-a', name: 'Empty Sector', order: 0 },
      { id: 'sec-b', name: 'Busy Sector', order: 1 }
    ],
    activeStationId: null,
    activeTransitSectorId: null,
    productionSource: 'empire',
    getLinkedSectors: () => [],
    getTransitTabId: () => null,
    selectStation: vi.fn(),
    selectTransitSector: vi.fn(),
    createStation: vi.fn(),
    duplicateStation: vi.fn(),
    deleteStation: vi.fn()
  })
}))

import StationTabBar from '@/components/empire/StationTabBar.vue'

describe('StationTabBar empty sector rendering', () => {
  it('does not show empty sector label nor its separator in tabs', () => {
    const wrapper = mount(StationTabBar)

    const sectorGroups = wrapper.findAll('.sector-tab-group')
    const sectorSeparators = wrapper.findAll('.tab-separator-sector')

    expect(sectorGroups.length).toBe(1)
    expect(sectorSeparators.length).toBe(1)
    expect(wrapper.text()).toContain('Busy Sector')
    expect(wrapper.text()).not.toContain('Empty Sector')
  })
})
