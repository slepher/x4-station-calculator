/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameDataStore } from '@/store/useGameDataStore'
import MapSectorTooltip from '@/components/map/MapSectorTooltip.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' },
      t: (key: string) => {
        const dict: Record<string, string> = {
          'faction.argon': 'Argon Federation',
          'map.owner_ownerless': 'Ownerless',
          'map.resource_filter_sunlight': 'Sunlight',
          'map.resource_filter_sunlight_suffix': '%',
          'map.yield_levels.medium': 'Medium',
          'map.sector_center_coords': 'Center'
        }
        return dict[key] || key
      },
      te: (key: string) => key === 'faction.argon'
    })
  }
})

describe('MapSectorTooltip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    const gameData = useGameDataStore()
    gameData.factions = [{ id: 'argon', nameId: 'faction.argon' }] as never
    gameData.res = [] as never
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          name: 'Cluster 01',
          owner: 'argon',
          owner_color: '#8899aa',
          dlc_tag: 'base',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              cluster_id: 'cluster_01',
              name: 'Argon Prime',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              raw_center_pos: { x: 64000, y: 0, z: -128000 },
              resources: []
            }
          }
        }
      }
    } as never
  })

  it('shows raw center coordinates when the sector has raw_center_pos', () => {
    const wrapper = mount(MapSectorTooltip, {
      props: {
        sectorId: 'sector_alpha'
      }
    })

    expect(wrapper.get('[data-testid="map-sector-tooltip-center"]').text()).toBe('(64km, -128km)')
    expect(wrapper.text()).toContain('Center')
  })
})
