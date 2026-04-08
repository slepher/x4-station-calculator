/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MapBindingSectorGroup from '@/components/map/MapBindingSectorGroup.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
    locale: ref('en')
  })
}))

vi.mock('vuedraggable', () => ({
  default: {
    name: 'DraggableStub',
    props: ['modelValue', 'itemKey'],
    template: `
      <div>
        <template v-for="item in modelValue" :key="item[itemKey]">
          <slot name="item" :element="item" />
        </template>
      </div>
    `
  }
}))

vi.mock('@/components/common/JumpInput.vue', () => ({
  default: {
    name: 'JumpInput',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
    template: '<input :value="modelValue" />'
  }
}))

vi.mock('./savePoiSearch', () => ({
  getLocalizedSectorQueryMatch: vi.fn(() => ({ matched: true, matchedRawName: false, matchedDisplayName: true }))
}))

vi.mock('@/components/map/savePoiSearch', () => ({
  getLocalizedSectorQueryMatch: vi.fn(() => ({ matched: true, matchedRawName: false, matchedDisplayName: true }))
}))

vi.mock('@/components/map/mapSectorMacro', () => ({
  resolveMapSectorByMacro: vi.fn((_maps, sectorMacro: string) => ({ sectorId: sectorMacro }))
}))

vi.mock('@/store/logic/saveBindingUtils', () => ({
  buildSectorGraphFromMaps: vi.fn(() => ({
    sectorGraph: new Map(),
    sectorClusterMap: new Map()
  })),
  getCoverageSectors: vi.fn((anchorMacro: string, jump: number) => {
    if (anchorMacro === 'anchor_a') {
      const entries = [
        { sectorMacro: 'coverage_a1', distance: 1 },
        { sectorMacro: 'coverage_a2', distance: 2 },
        { sectorMacro: 'anchor_b', distance: 4 }
      ]
      return entries.filter((entry) => entry.distance <= jump)
    }
    if (anchorMacro === 'anchor_b') {
      return [{ sectorMacro: 'anchor_a', distance: 4 }].filter((entry) => entry.distance <= jump)
    }
    return []
  })
}))

vi.mock('@/composables/useSectorNameFilter', () => ({
  useSectorNameFilter: vi.fn(() => ({
    normalizedQuery: ref(''),
    getSectorDisplayName: (_sectorMacro: string, fallbackName: string) => ({
      rawSectorName: fallbackName,
      sectorName: fallbackName,
      showRawSectorName: false
    })
  }))
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'

describe('MapBindingSectorGroup', () => {
  const createSector = vi.fn()
  const reorderSectors = vi.fn()
  const renameSector = vi.fn()
  const bindSectorGroup = vi.fn()
  const setGroupConnection = vi.fn()
  const clearSectorGroupBinding = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive: {
        meta: { guid: 'g-1', time: 1000 },
        sectors: {}
      },
      archives: new Map()
    } as any)

    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        sectors: [
          { id: 'group-a', name: 'Alpha', order: 0 },
          { id: 'group-b', name: 'Beta', order: 1 }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'anchor_a',
                jumpRange: 2,
                coverageSectorMacros: [
                  { ref: 'coverage_a1', jump: 1 },
                  { ref: 'coverage_a2', jump: 2 }
                ],
                connectedSectorGroupIds: ['group-b'],
                stationBindings: []
              },
              {
                sectorGroupId: 'group-b',
                sectorMacro: 'anchor_b',
                jumpRange: 2,
                coverageSectorMacros: [],
                connectedSectorGroupIds: ['group-a'],
                stationBindings: []
              }
            ]
          }
        ]
      },
      createSector,
      reorderSectors,
      renameSector,
      bindSectorGroup,
      setGroupConnection,
      clearSectorGroupBinding
    } as any)

    vi.mocked(useGameDataStore).mockReturnValue({
      maps: {
        clusters: {},
        sectors: {
          anchor_a: { name: 'Anchor A' },
          coverage_a1: { name: 'Coverage A1' },
          coverage_a2: { name: 'Coverage A2' },
          anchor_b: { name: 'Anchor B' }
        }
      },
      localizedModulesMap: {},
      localizedModuleGroupsMap: {}
    } as any)
  })

  it('keeps collapsed anchor and coverage display for a bound empire sector', () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    const firstItem = wrapper.findAll('.empire-sector-item')[0]

    expect(firstItem.text()).toContain('Anchor A')
    expect(firstItem.text()).toContain('Coverage A1')
    expect(firstItem.text()).toContain('Coverage A2')
    expect(firstItem.text()).not.toContain('map.binding_anchor_sector')
    expect(firstItem.find('.detail-icon-btn').attributes('title')).toBe('map.binding_view_detail')
  })

  it('uses tooltip-equivalent station labels in save sector list instead of raw codes', () => {
    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive: {
        meta: { guid: 'g-1', time: 1000 },
        sectors: {
          save_sector_1: {
            name: 'Save Sector 1',
            playerStations: [
              {
                code: 'AVE-937',
                profileName: 'Antimatter Cell Factory',
                productionProfile: 'factory_antimatter',
                tag: 'factory',
                owner: 'player',
                macro: 'station_macro',
                relative_position: { x: 0, y: 0, z: 0 },
                position: { x: 0, y: 0, z: 0 }
              },
              {
                code: 'AVE-938',
                profileName: 'Antimatter Cell Factory',
                productionProfile: 'factory_antimatter',
                tag: 'factory',
                owner: 'player',
                macro: 'station_macro',
                relative_position: { x: 0, y: 0, z: 0 },
                position: { x: 0, y: 0, z: 0 }
              }
            ]
          }
        }
      },
      archives: new Map()
    } as any)

    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    expect(wrapper.text()).toContain('Antimatter Cell Factory x2')
    expect(wrapper.text()).not.toContain('AVE-937')
    expect(wrapper.text()).not.toContain('AVE-938')
  })

  it('opening new sector edit stays in draft mode until confirm', async () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get('.create-sector-btn').trigger('click')

    expect(createSector).not.toHaveBeenCalled()
    expect(wrapper.find('.sector-name-input').exists()).toBe(true)
  })

  it('scrolls the edited sector into view when entering draft mode', async () => {
    const scrollIntoView = vi.fn()
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    try {
      const wrapper = mount(MapBindingSectorGroup, {
        props: { gameGuid: 'g-1' },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.get('.bind-btn').trigger('click')

      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }
  })

  it('hides connected sectors section when there are no connected candidates', async () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        sectors: [
          { id: 'group-a', name: 'Alpha', order: 0 }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'anchor_a',
                jumpRange: 2,
                coverageSectorMacros: [],
                connectedSectorGroupIds: [],
                stationBindings: []
              }
            ]
          }
        ]
      },
      createSector,
      reorderSectors,
      renameSector,
      bindSectorGroup,
      setGroupConnection,
      clearSectorGroupBinding,
      deleteSector: vi.fn()
    } as any)

    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get('.bind-btn').trigger('click')

    expect(wrapper.text()).not.toContain('map.binding_connected_sectors')
  })

  it('renders only non-empty jump groups in expanded coverage section', async () => {
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        sectors: [
          { id: 'group-a', name: 'Alpha', order: 0 }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'anchor_a',
                jumpRange: 3,
                coverageSectorMacros: [
                  { ref: 'coverage_a2', jump: 3 }
                ],
                connectedSectorGroupIds: [],
                stationBindings: []
              }
            ]
          }
        ]
      },
      createSector,
      reorderSectors,
      renameSector,
      bindSectorGroup,
      setGroupConnection,
      clearSectorGroupBinding,
      deleteSector: vi.fn()
    } as any)

    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get('.bind-btn').trigger('click')

    const coverageSection = wrapper.findAll('.config-section')[1]
    expect(coverageSection.text()).toContain('3map.resource_filter_jump_suffix')
    expect(coverageSection.text()).not.toContain('1map.resource_filter_jump_suffix')
    expect(coverageSection.text()).not.toContain('2map.resource_filter_jump_suffix')
  })

  it('shows connected sectors in collapsed state even when their jump exceeds coverage jumpRange', () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    const firstItem = wrapper.findAll('.empire-sector-item')[0]
    expect(firstItem.text()).toContain('Beta:Anchor B')
  })

  it('focuses sector when clicking a connected sector pill', async () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    const connectedPill = wrapper.findAll('.pill--connected')[0]
    await connectedPill.trigger('click')

    expect(wrapper.emitted('focus-sector')).toEqual([['anchor_b']])
  })

  it('uses the same jump row alignment model for connected sectors as other sections', async () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get('.bind-btn').trigger('click')

    expect(wrapper.find('.connected-jump-group-header').exists()).toBe(false)
    expect(wrapper.find('.connected-jump-number').exists()).toBe(false)
  })
})
