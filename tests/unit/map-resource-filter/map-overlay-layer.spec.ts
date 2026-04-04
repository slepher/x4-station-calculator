/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapOverlayLayer from '@/components/map/layers/MapOverlayLayer.vue'

describe('MapOverlayLayer placement rendering', () => {
  it('renders placement overlays', () => {
    const wrapper = mount({
      components: { MapOverlayLayer },
      template: `
        <svg>
          <MapOverlayLayer
            :overlay-screen-items="overlayScreenItems"
            :preview-screen-item="null"
            dragging-overlay-key=""
            focused-overlay-key=""
            :overlay-icon-size="12"
            :preview-icon-size="12"
            :placement-icon-href="() => '/station.svg'"
          />
        </svg>
      `,
      data: () => ({
        overlayScreenItems: [{
          key: 'station-1',
          id: 'station-1',
          kind: 'station',
          name: 'Station 1',
          icon: 'factory',
          x: 120,
          y: 140,
          location: {
            cluster_id: 'cluster_alpha',
            sector_id: 'sector_alpha',
            pos: { x: 0, z: 0 }
          }
        }]
      })
    })

    expect(wrapper.find('.placement-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Station 1')
  })

  it('renders preview overlay', () => {
    const wrapper = mount({
      components: { MapOverlayLayer },
      template: `
        <svg>
          <MapOverlayLayer
            :overlay-screen-items="[]"
            :preview-screen-item="previewScreenItem"
            dragging-overlay-key=""
            focused-overlay-key=""
            :overlay-icon-size="12"
            :preview-icon-size="12"
            :placement-icon-href="() => '/station.svg'"
          />
        </svg>
      `,
      data: () => ({
        previewScreenItem: {
          kind: 'station',
          name: 'Preview',
          icon: 'factory',
          x: 220,
          y: 240,
          location: {
            cluster_id: 'cluster_alpha',
            sector_id: 'sector_alpha',
            pos: { x: 0, z: 0 }
          }
        }
      })
    })

    expect(wrapper.find('.placement-preview').exists()).toBe(true)
    expect(wrapper.text()).toContain('Preview')
  })
})
