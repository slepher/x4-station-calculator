/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapResourceFilterPanel from '@/components/empire/MapResourceFilterPanel.vue'
import { useGameDataStore } from '@/store/useGameDataStore'

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
        'map.resource_filter_sunlight': 'Sunlight',
        'map.resource_filter_candidates': 'Candidates',
        'map.resource_filter_no_match': 'No match',
      }
      return dict[key] || key
    }
  })
}))

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

  it('renders top-right tags with short resource i18n and sunlight as energy cell short i18n', () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [],
        mode: 'overlay'
      }
    })

    expect(wrapper.get('[data-testid="map-resource-tag-ore"]').text()).toContain('OreShort')
    expect(wrapper.get('[data-testid="map-resource-tag-ore"]').text()).not.toContain('Ore Full')
    expect(wrapper.get('[data-testid="map-resource-tag-silicon"]').text()).toContain('Si')
    expect(wrapper.get('[data-testid="map-resource-tag-silicon"]').text()).not.toContain('Silicon Full')
    expect(wrapper.get('[data-testid="map-resource-tag-sunlight"]').text()).toContain('EC')
    expect(wrapper.get('[data-testid="map-resource-tag-sunlight"]').text()).not.toContain('Sunlight')
  })
})
