/**
 * @vitest-environment jsdom
 */
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapWorkbenchView from '@/components/map/MapWorkbenchView.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('en'),
      t: (key: string) => key,
      te: () => false
    })
  }
})

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: []
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/factions.json', () => ({
  default: []
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    activeEmpire: {
      id: 'empire-1',
      name: 'Empire',
      sectors: [],
      stations: []
    }
  })
}))

describe('MapWorkbenchView panel entries', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps save entry but does not render deprecated station or binding tabs', () => {
    const wrapper = mount(MapWorkbenchView, {
      global: {
        stubs: {
          MapSvgCanvas: true,
          MapSectorTooltip: true,
          MapResourceFilterPanel: true,
          MapSavePanel: true,
          MapBindingPanel: true
        }
      }
    })

    expect(wrapper.find('[data-testid="map-save-panel-tab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="map-station-entry-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="map-binding-panel-tab"]').exists()).toBe(false)
  })
})
