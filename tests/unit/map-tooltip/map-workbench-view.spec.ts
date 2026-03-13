/**
 * @vitest-environment jsdom
 */
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: [{ ware: 'ore', color: '#ff9900' }]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/factions.json', () => ({
  default: [{ id: 'argon', nameId: 'faction.argon' }]
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('en'),
      t: (key: string) => {
        const dict: Record<string, string> = {
          'faction.argon': 'Argon Federation',
          'map.resource_filter_sunlight': 'Sunlight',
          'map.resource_filter_sunlight_suffix': '%',
          'map.search_sector_placeholder': 'Search sector',
          'map.scale': 'Scale'
        }
        return dict[key] || key
      },
      te: (key: string) => key === 'faction.argon'
    })
  }
})

import MapWorkbenchView from '@/components/empire/MapWorkbenchView.vue'

describe('MapWorkbenchView tooltip interactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const buildWrapper = () => mount(MapWorkbenchView, {
    attachTo: document.body,
    global: {
      stubs: {
        MapSvgCanvas: {
          name: 'MapSvgCanvas',
          template: '<div data-testid="map-svg-canvas"></div>'
        },
        MapSectorTooltip: {
          name: 'MapSectorTooltip',
          props: ['title'],
          template: '<section class="sector-tooltip-card" data-testid="map-sector-tooltip">{{ title }}</section>'
        },
        MapResourceFilterPanel: {
          name: 'MapResourceFilterPanel',
          template: '<div data-testid="map-resource-filter-panel"></div>'
        }
      }
    }
  })

  it('clears browser text selection when map drag starts', async () => {
    const removeAllRanges = vi.fn()
    vi.stubGlobal('getSelection', vi.fn(() => ({
      removeAllRanges
    })))

    const wrapper = buildWrapper()

    const viewport = wrapper.get('.map-viewport')
    await viewport.trigger('mousedown', {
      button: 0,
      clientX: 220,
      clientY: 180
    })

    expect(removeAllRanges).toHaveBeenCalledTimes(1)
  })
})
