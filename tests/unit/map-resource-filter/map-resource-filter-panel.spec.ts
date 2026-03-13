/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameDataStore } from '@/store/useGameDataStore'

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: [
    { ware: 'ore', color: '#ff9900', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'silicon', color: '#00bbff', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'methane', color: '#34d399', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'hydrogen', color: '#60a5fa', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'helium', color: '#f472b6', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] }
  ]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/maps.json', () => ({
  default: {
    clusters: {
      cluster_01: {
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            resources: [
              { ware: 'ore', yield: 'high', level: 12 },
              { ware: 'silicon', yield: 'high', level: 11 },
              { ware: 'methane', yield: 'medium', level: 8 },
              { ware: 'hydrogen', yield: 'high', level: 9 },
              { ware: 'helium', yield: 'medium', level: 7 }
            ],
            area: { sunlight: 1.5 }
          },
          sector_beta: {
            id: 'sector_beta',
            resources: [
              { ware: 'ore', yield: 'high', level: 10 },
              { ware: 'silicon', yield: 'medium', level: 6 },
              { ware: 'methane', yield: 'high', level: 10 },
              { ware: 'hydrogen', yield: 'medium', level: 7 },
              { ware: 'helium', yield: 'low', level: 3 }
            ],
            area: { sunlight: 1.2 }
          },
          sector_gamma: {
            id: 'sector_gamma',
            resources: [
              { ware: 'ore', yield: 'medium', level: 4 }
            ],
            area: { sunlight: 0.7 }
          }
        }
      }
    }
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => {
      const dict: Record<string, string> = {
        'res.ore': 'OreShort',
        'res.energycells': 'EC',
        'res.silicon': 'Si',
        'res.methane': 'CH4',
        'res.hydrogen': 'H',
        'res.helium': 'He',
        'res.ice': 'Ice',
        'res.rawscrap': 'Scr',
        'res.nividium': 'Niv',
        'map.resource_filter_button': 'Resource',
        'map.resource_filter_all': 'All',
        'map.resource_filter_mixed': 'Mixed',
        'map.resource_filter_sunlight': 'Sunlight',
        'map.resource_filter_candidates': 'Candidates',
        'map.resource_filter_no_match': 'No match',
        'map.resource_filter_resource_pill': 'Resource',
        'map.resource_filter_hub_pill': 'Hub',
      }
      return dict[key] || key
    }
  })
}))

import MapResourceFilterPanel from '@/components/empire/MapResourceFilterPanel.vue'

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn(async () => {})
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (item: { id: string }) => item.id,
    translateModuleGroup: (item: { id: string }) => item.id,
    translateWare: (item: { id: string }) => item.id
  })
}))

describe('MapResourceFilterPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const gameData = useGameDataStore()
    gameData.localizedWaresMap = {
      ore: { id: 'ore', localeName: 'Ore Full' },
      silicon: { id: 'silicon', localeName: 'Silicon Full' }
    }
  })

  it('renders sidebar tags with short resource i18n and sunlight as energy cell short i18n', () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [],
        mode: 'sidebar'
      }
    })

    expect(wrapper.get('[data-testid="map-resource-tag-ore"]').text()).toContain('OreShort')
    expect(wrapper.get('[data-testid="map-resource-tag-ore"]').text()).not.toContain('Ore Full')
    expect(wrapper.get('[data-testid="map-resource-tag-silicon"]').text()).toContain('Si')
    expect(wrapper.get('[data-testid="map-resource-tag-silicon"]').text()).not.toContain('Silicon Full')
    expect(wrapper.get('[data-testid="map-resource-tag-sunlight"]').text()).toContain('EC')
    expect(wrapper.get('[data-testid="map-resource-tag-sunlight"]').text()).not.toContain('Sunlight')
  })

  it('shows only the entry button in overlay mode and emits open request on click', async () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [],
        mode: 'overlay'
      }
    })

    expect(wrapper.get('[data-testid="map-resource-entry-button"]').text()).toContain('Resource')
    expect(wrapper.find('[data-testid="map-resource-tag-ore"]').isVisible()).toBe(false)

    await wrapper.get('[data-testid="map-resource-entry-button"]').trigger('click')

    expect(wrapper.emitted('panel-open')).toEqual([[]])
    expect(wrapper.find('[data-testid="map-resource-tag-ore"]').isVisible()).toBe(false)
  })

  it('closes without resetting filters and re-emits highlights when reopened', async () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [
          {
            sectorId: 'sector_alpha',
            clusterId: 'cluster_01',
            name: 'Alpha',
            displayName: 'Alpha',
            centerX: 0,
            centerY: 0
          }
        ],
        mode: 'sidebar'
      }
    })

    await wrapper.get('[data-testid="map-resource-tag-ore"]').trigger('click')

    expect(wrapper.emitted('highlight-change')?.at(-1)).toEqual([['sector_alpha']])
    expect(wrapper.find('[data-testid="map-resource-yield-ore"]').exists()).toBe(true)

    await wrapper.get('[data-testid="map-resource-close-panel"]').trigger('click')

    expect(wrapper.emitted('panel-close')).toEqual([[]])

    await wrapper.setProps({ mode: 'overlay' })

    expect(wrapper.emitted('highlight-change')?.at(-1)).toEqual([[]])
    expect(wrapper.find('[data-testid="map-resource-tag-ore"]').isVisible()).toBe(false)

    await wrapper.setProps({ mode: 'sidebar' })

    expect(wrapper.find('[data-testid="map-resource-yield-ore"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="map-resource-tag-ore"]').classes()).toContain('selected')
    expect(wrapper.emitted('highlight-change')?.at(-1)).toEqual([['sector_alpha']])
  })

  it('shows default top ten candidates in sidebar when no tag is selected', () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [
          {
            sectorId: 'sector_alpha',
            clusterId: 'cluster_01',
            name: 'Alpha',
            displayName: 'Alpha',
            centerX: 0,
            centerY: 0
          },
          {
            sectorId: 'sector_beta',
            clusterId: 'cluster_01',
            name: 'Beta',
            displayName: 'Beta',
            centerX: 0,
            centerY: 0
          },
          {
            sectorId: 'sector_gamma',
            clusterId: 'cluster_01',
            name: 'Gamma',
            displayName: 'Gamma',
            centerX: 0,
            centerY: 0
          }
        ],
        mode: 'sidebar'
      }
    })

    const candidates = wrapper.findAll('[data-testid^="map-resource-candidate-"]')
    expect(candidates).toHaveLength(3)
    expect(candidates[0]?.attributes('data-testid')).toBe('map-resource-candidate-sector_alpha')
    expect(candidates[1]?.attributes('data-testid')).toBe('map-resource-candidate-sector_beta')
    expect(candidates[2]?.attributes('data-testid')).toBe('map-resource-candidate-sector_gamma')
  })

  it('keeps close button and tags in the same header flow when nothing is selected', () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [],
        mode: 'sidebar'
      }
    })

    expect(wrapper.find('[data-testid="map-resource-close-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="map-resource-panel-header"]').exists()).toBe(true)
    expect(wrapper.find('.resource-tag-grid').classes()).not.toContain('compact')
  })

  it('emits sector visual fills with pie slices for multi-resource selection', async () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [
          {
            sectorId: 'sector_alpha',
            clusterId: 'cluster_01',
            name: 'Alpha',
            displayName: 'Alpha',
            centerX: 0,
            centerY: 0
          }
        ],
        mode: 'sidebar'
      }
    })

    await wrapper.get('[data-testid="map-resource-tag-ore"]').trigger('click')
    await wrapper.get('[data-testid="map-resource-tag-silicon"]').trigger('click')

    const payload = wrapper.emitted('resource-visual-change')?.at(-1)?.[0] as any

    expect(payload.highlightedSectorIds).toEqual(['sector_alpha'])
    expect(payload.sectorFills.sector_alpha.mode).toBe('pie')
    expect(payload.sectorFills.sector_alpha.slices.map((slice: any) => slice.ware)).toEqual(['ore', 'silicon'])
    expect(payload.sectorFills.sector_alpha.slices.reduce((sum: number, slice: any) => sum + slice.share, 0)).toBeCloseTo(1, 6)
  })

  it('renders advanced candidate rows with equal type pills and group badges', async () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [
          {
            sectorId: 'sector_alpha',
            clusterId: 'cluster_01',
            name: 'Alpha',
            displayName: 'Alpha',
            centerX: 0,
            centerY: 0
          },
          {
            sectorId: 'sector_beta',
            clusterId: 'cluster_01',
            name: 'Beta',
            displayName: 'Beta',
            centerX: 120,
            centerY: 40
          }
        ],
        mode: 'sidebar'
      }
    })

    await wrapper.get('[data-testid="map-resource-tab-advanced"]').trigger('click')
    await wrapper.get('[data-testid="map-resource-advanced-tag-group_1-ore"]').trigger('click')
    await wrapper.get('[data-testid="map-resource-advanced-add-group"]').trigger('click')
    await wrapper.findAll('[data-testid$="-methane"]').at(-1)!.trigger('click')
    await wrapper.get('[data-testid="map-resource-advanced-refresh"]').trigger('click')

    const summaryTag = wrapper.get('[data-testid^="map-resource-advanced-summary-tag-"][data-testid$="-ore"]')
    expect(summaryTag.attributes('style')).toContain('background-color')

    const candidate = wrapper.get('[data-testid^="map-resource-advanced-candidate-"]')
    const resourcePill = candidate.get('[data-testid="map-resource-advanced-resource-pill"]')
    const hubPill = candidate.get('[data-testid="map-resource-advanced-hub-pill"]')
    expect(resourcePill.text()).toBe('Resource')
    expect(hubPill.text()).toBe('Hub')
    expect(resourcePill.classes()).toContain('candidate-type-pill')
    expect(hubPill.classes()).toContain('candidate-type-pill')
    expect(resourcePill.get('[data-testid="map-resource-advanced-resource-pill-icon"]').exists()).toBe(true)
    expect(hubPill.get('[data-testid="map-resource-advanced-hub-pill-icon"]').exists()).toBe(true)

    const resourceChip = candidate.get('[data-testid="map-resource-advanced-resource-chip-sector_alpha"]')
    const badge = resourceChip.get('[data-testid="map-resource-advanced-group-badge-sector_alpha-1"]')
    expect(badge.text()).toBe('1')
  })
})
