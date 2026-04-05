/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapSaveCategoryMenu from '@/components/map/MapSaveCategoryMenu.vue'
import type { SaveArchive } from '@/types/saveArchive'

vi.mock('vue-i18n', () => ({
  createI18n: () => ({}),
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key,
    te: () => false
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn(async () => {}),
  setGameFolderName: vi.fn()
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (item: { id: string }) => item.id,
    translateModuleGroup: (item: { id: string }) => item.id,
    translateWare: (item: { id: string }) => item.id,
    translateDlc: (item: { id: string }) => item.id
  })
}))

describe('MapSaveCategoryMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('counts all station POIs in category totals', () => {
    const archive: SaveArchive = {
      meta: {
        guid: 'g1',
        seed: 1,
        time: 1,
        playerName: 'Player',
        version: '8.0',
        filename: 'save.xml.gz',
        parser_version: 'v2',
        post_processor_version: 'v2',
        source: 'original'
      },
      sectors: {
        sector_alpha_macro: {
          name: 'Alpha',
          is_known: true,
          npcStations: [
            {
              code: 'FAC',
              macro: 'fac_macro',
              owner: 'argon',
              relative_position: { x: 0, y: 0, z: 0 },
              position: { x: 0, y: 0, z: 0, tx: 0, ty: 0 },
              tag: 'factory'
            },
            {
              code: 'SHIP',
              macro: 'ship_macro',
              owner: 'argon',
              relative_position: { x: 0, y: 0, z: 0 },
              position: { x: 1000, y: 0, z: 2000, tx: 0, ty: 0 },
              tag: 'shipyard'
            }
          ]
        }
      },
      isCompatible: true,
      isValid: true
    }

    const wrapper = mount(MapSaveCategoryMenu, {
      props: {
        archive,
        visibility: {
          playerStation: false,
          npcStation: false,
          xenonStation: false,
          khaakStation: false,
          abandonedShip: false,
          datavault: false,
          erlkingVault: false
        }
      }
    })

    expect(wrapper.text()).toContain('map.save_category_npc_station')
    expect(wrapper.text()).toContain('(2)')
  })
})
