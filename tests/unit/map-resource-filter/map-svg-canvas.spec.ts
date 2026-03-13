/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/maps.json', () => ({
  default: {
    clusters: {
      cluster_01: {
        id: 'cluster_01',
        name: 'Cluster 01',
        owner: 'argon',
        owner_color: '#8899aa',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            name: 'Alpha',
            owner: 'argon',
            owner_color: '#8899aa',
            area: { sunlight: 1.2 },
            resources: [],
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 0.8
            }
          }
        }
      }
    }
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false
  })
}))

import MapSvgCanvas from '@/components/empire/MapSvgCanvas.vue'

describe('MapSvgCanvas resource pie fill', () => {
  it('renders pie slice paths for resource-highlighted sectors', () => {
    const wrapper = mount(MapSvgCanvas, {
      props: {
        resourceHighlightedSectorIds: ['sector_alpha'],
        resourceSectorFills: {
          sector_alpha: {
            mode: 'pie',
            slices: [
              { ware: 'ore', color: '#ff9900', share: 0.65 },
              { ware: 'silicon', color: '#00bbff', share: 0.35 }
            ]
          }
        }
      }
    })

    const slices = wrapper.findAll('[data-testid="resource-pie-slice"]')
    expect(slices).toHaveLength(2)
    expect(slices[0]?.attributes('fill')).toBe('#ff9900')
    expect(slices[1]?.attributes('fill')).toBe('#00bbff')
  })
})
