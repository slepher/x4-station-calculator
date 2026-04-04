/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapSaveCoordList from '@/components/map/MapSaveCoordList.vue'
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

describe('MapSaveCoordList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters non-persistent small station icons from the displayed POI list when culling is enabled', () => {
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

    const wrapper = mount(MapSaveCoordList, {
      props: {
        archive,
        category: 'npcStation',
        excludeConditionalSmallStations: true,
        isClusterOverview: false
      }
    })

    const text = wrapper.text()
    expect(text).toContain('SHIP')
    expect(text).not.toContain('FAC')
  })
})
