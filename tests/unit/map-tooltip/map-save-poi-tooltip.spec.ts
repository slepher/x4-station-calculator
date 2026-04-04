/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import MapSavePoiTooltip from '@/components/map/MapSavePoiTooltip.vue'
import en from '@/locales/en.json'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    factions: [
      {
        id: 'argon',
        name: 'Argon Federation',
        nameId: '{20201,101}'
      }
    ]
  })
}))

describe('MapSavePoiTooltip', () => {
  it('renders localized owner name and xyz coordinates in km with one decimal', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          ...en,
          '{20201,101}': 'Argon Federation'
        }
      }
    })

    const wrapper = mount(MapSavePoiTooltip, {
      global: {
        plugins: [i18n]
      },
      props: {
        poi: {
          key: 'npcStation:ABC-123',
          code: 'ABC-123',
          category: 'npcStation',
          owner: 'argon',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 1000, y: 200, z: -3000, tx: 0.1, ty: 0.2 }
        }
      }
    })

    expect(wrapper.text()).toContain('Argon Federation')
    expect(wrapper.text()).toContain('x:')
    expect(wrapper.text()).toContain('1.0km')
    expect(wrapper.text()).toContain('y:')
    expect(wrapper.text()).toContain('0.2km')
    expect(wrapper.text()).toContain('z:')
    expect(wrapper.text()).toContain('-3.0km')
  })
})
