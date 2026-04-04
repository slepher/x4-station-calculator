/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapOverlayLayer from '@/components/map/layers/MapOverlayLayer.vue'

describe('MapOverlayLayer save POI rendering', () => {
  it('renders save POI text labels', () => {
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
            :placement-icon-href="() => ''"
            :get-save-poi-icon-url="() => null"
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
          factionFilterId: null,
          iconSize: 10
        }]
      })
    })

    expect(wrapper.find('.save-poi-marker').exists()).toBe(true)
    expect(wrapper.find('.save-poi-label').exists()).toBe(true)
    expect(wrapper.text()).toContain('NPC-1')
  })

  it('does not apply SVG filters to save POI icons even when faction filters are available', () => {
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
            :placement-icon-href="() => ''"
            :get-save-poi-icon-url="() => '/poi.svg'"
          />
        </svg>
      `,
      data: () => ({
        savePoiScreenItems: [{
          key: 'npc-2',
          code: 'NPC-2',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 220,
          y: 240,
          color: '#ff9900',
          factionFilterId: 'faction-color-argon',
          iconSize: 10
        }]
      })
    })

    const image = wrapper.get('.save-poi-marker image')
    expect(image.attributes('filter')).toBeUndefined()
  })

  it('uses the computed iconSize from screen items', () => {
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
            :placement-icon-href="() => ''"
            :get-save-poi-icon-url="() => '/poi.svg'"
          />
        </svg>
      `,
      data: () => ({
        savePoiScreenItems: [{
          key: 'npc-3',
          code: 'NPC-3',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 320,
          y: 340,
          color: '#ff9900',
          factionFilterId: null,
          iconSize: 36
        }]
      })
    })

    const image = wrapper.get('.save-poi-marker image')
    expect(image.attributes('width')).toBe('36')
    expect(image.attributes('height')).toBe('36')
  })

  it('falls back to the small icon baseline when iconSize is absent', () => {
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
            :placement-icon-href="() => ''"
            :get-save-poi-icon-url="() => '/poi.svg'"
          />
        </svg>
      `,
      data: () => ({
        savePoiScreenItems: [{
          key: 'npc-4',
          code: 'NPC-4',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 320,
          y: 340,
          color: '#ff9900',
          factionFilterId: null
        }]
      })
    })

    const image = wrapper.get('.save-poi-marker image')
    expect(image.attributes('width')).toBe('12')
    expect(image.attributes('height')).toBe('12')
  })
})
