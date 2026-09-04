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
    translateDlc: (item: { id: string }) => item.id,
    translateShip: (ship: { id: string; name?: string }) => ship.name || ship.id
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    gameData: {
      ships: [
        {
          id: 'ship_ter_m_corvette_02_a',
          name: 'Odachi',
          nameId: '{20101,1101}'
        }
      ]
    }
  })
}))

describe('MapSaveCoordList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows all station POIs without culling small conditional icons', () => {
    const archive: SaveArchive = {
      meta: {
        guid: 'g1',
        seed: 1,
        time: 1,
        playerName: 'Player',
        version: '8.0',
        filename: 'save.xml.gz',
        parser_version: 'v3',
        post_processor_version: 'v2',
        source: 'original'
      },
      sectors: {
        sector_alpha_macro: {
          name: 'Alpha',
          is_known: true,
          npc_stations: {
            FAC: {
              code: 'FAC',
              macro: 'fac_macro',
              owner: 'argon',
              relative_position: { x: 0, y: 0, z: 0 },
              position: { x: 0, y: 0, z: 0, tx: 0, ty: 0 },
              tag: 'factory'
            },
            SHIP: {
              code: 'SHIP',
              macro: 'ship_macro',
              owner: 'argon',
              relative_position: { x: 0, y: 0, z: 0 },
              position: { x: 1000, y: 0, z: 2000, tx: 0, ty: 0 },
              tag: 'shipyard'
            }
          }
        }
      },
      isCompatible: true,
      isValid: true
    }

    const wrapper = mount(MapSaveCoordList, {
      props: {
        archive,
        category: 'npcStation'
      }
    })

    const text = wrapper.text()
    expect(text).toContain('SHIP')
    expect(text).toContain('FAC')
  })

  it('shows localized ship name for abandoned ships instead of code', async () => {
    const archive: SaveArchive = {
      meta: {
        guid: 'g1',
        seed: 1,
        time: 1,
        playerName: 'Player',
        version: '8.0',
        filename: 'save.xml.gz',
        parser_version: 'v3',
        post_processor_version: 'v7',
        source: 'original'
      },
      sectors: {
        sector_alpha_macro: {
          name: 'Alpha',
          is_known: true,
          abandoned_ships: {
            'SHIP-001': {
              code: 'SHIP-001',
              macro: 'ship_ter_m_corvette_02_a_macro',
              class: 'corvette',
              shipId: 'ship_ter_m_corvette_02_a',
              purpose: 'fight',
              relative_position: { x: 0, y: 0, z: 0 },
              position: { x: 0, y: 0, z: 0, tx: 0, ty: 0 }
            }
          }
        }
      },
      isCompatible: true,
      isValid: true
    }

    const wrapper = mount(MapSaveCoordList, {
      props: {
        archive,
        category: 'abandonedShip'
      }
    })

    const text = wrapper.text()
    // Should show ship name (Odachi) instead of code (SHIP-001)
    expect(text).toContain('Odachi')
    expect(text).not.toContain('SHIP-001')
  })

  it('does not show coordinates for abandoned ships', async () => {
    const archive: SaveArchive = {
      meta: {
        guid: 'g1',
        seed: 1,
        time: 1,
        playerName: 'Player',
        version: '8.0',
        filename: 'save.xml.gz',
        parser_version: 'v3',
        post_processor_version: 'v7',
        source: 'original'
      },
      sectors: {
        sector_alpha_macro: {
          name: 'Alpha',
          is_known: true,
          abandoned_ships: {
            'SHIP-001': {
              code: 'SHIP-001',
              macro: 'ship_ter_m_corvette_02_a_macro',
              class: 'corvette',
              shipId: 'ship_ter_m_corvette_02_a',
              purpose: 'fight',
              relative_position: { x: 1000, y: 0, z: 2000 },
              position: { x: 1000, y: 0, z: 2000, tx: 0, ty: 0 }
            }
          }
        }
      },
      isCompatible: true,
      isValid: true
    }

    const wrapper = mount(MapSaveCoordList, {
      props: {
        archive,
        category: 'abandonedShip'
      }
    })

    const text = wrapper.text()
    // Should not contain coordinate format
    expect(text).not.toMatch(/\(\d+\.0km,\s*\d+\.0km\)/)
  })
})
