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
            :save-poi-screen-items="[]"
            dragging-overlay-key=""
            focused-overlay-key=""
            focused-save-poi-key=""
            :overlay-icon-size="12"
            :preview-icon-size="12"
            :placement-icon-href="() => '/station.svg'"
            :get-save-poi-icon-url="() => null"
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
            :save-poi-screen-items="[]"
            dragging-overlay-key=""
            focused-overlay-key=""
            focused-save-poi-key=""
            :overlay-icon-size="12"
            :preview-icon-size="12"
            :placement-icon-href="() => '/station.svg'"
            :get-save-poi-icon-url="() => null"
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

  it('renders save poi icons in svg and applies faction filter ids', () => {
    const wrapper = mount({
      components: { MapOverlayLayer },
      template: `
        <svg>
          <MapOverlayLayer
            :overlay-screen-items="[]"
            :preview-screen-item="null"
            :save-poi-screen-items="savePoiScreenItems"
            dragging-overlay-key=""
            focused-overlay-key=""
            focused-save-poi-key=""
            :overlay-icon-size="12"
            :preview-icon-size="12"
            :placement-icon-href="() => '/station.svg'"
            :get-save-poi-icon-url="() => '/poi.svg'"
          />
        </svg>
      `,
      data: () => ({
        savePoiScreenItems: [{
          key: 'npc-1',
          code: 'NPC-1',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 120,
          y: 140,
          color: '#ff9900',
          factionFilterId: 'faction-color-argon',
          iconSize: 10
        }]
      })
    })

    const image = wrapper.get('.save-poi-marker image')
    expect(image.attributes('width')).toBe('10')
    expect(image.attributes('height')).toBe('10')
    expect(image.attributes('filter')).toBe('url(#faction-color-argon)')
  })
})
