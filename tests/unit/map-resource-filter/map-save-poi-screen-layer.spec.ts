/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapSavePoiScreenLayer from '@/components/map/MapSavePoiScreenLayer.vue'

describe('MapSavePoiScreenLayer', () => {
  it('renders POI markers in viewport coordinates', () => {
    const wrapper = mount(MapSavePoiScreenLayer, {
      props: {
        items: [{
          key: 'npc-1',
          code: 'NPC-1',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 100,
          y: 80,
          color: '#ff9900',
          factionFilterId: null,
          iconSize: 9
        }],
        focusedSavePoiKey: null,
        screenScale: 2,
        panX: 10,
        panY: 20,
        getSavePoiIconUrl: () => '/poi.svg'
      }
    })

    const marker = wrapper.get('.save-poi-marker')
    const image = wrapper.get('.save-poi-icon-image')
    expect(marker.attributes('style')).toContain('left: 210px;')
    expect(marker.attributes('style')).toContain('top: 180px;')
    expect(image.attributes('width')).toBe('18')
    expect(image.attributes('height')).toBe('18')
  })

  it('keeps the focused marker rendered last with highlight class', () => {
    const wrapper = mount(MapSavePoiScreenLayer, {
      props: {
        items: [{
          key: 'npc-1',
          code: 'NPC-1',
          category: 'npcStation',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          x: 100,
          y: 80,
          color: '#ff9900',
          factionFilterId: null,
          iconSize: 9
        }],
        focusedSavePoiKey: 'npc-1',
        screenScale: 1,
        panX: 0,
        panY: 0,
        getSavePoiIconUrl: () => '/poi.svg'
      }
    })

    expect(wrapper.findAll('.save-poi-marker')).toHaveLength(1)
    expect(wrapper.get('.save-poi-marker').classes()).toContain('focused')
  })

  it('emits the original POI payload on pointerdown', async () => {
    const item = {
      key: 'npc-2',
      code: 'NPC-2',
      category: 'npcStation',
      sectorMacro: 'sector_alpha_macro',
      sectorName: 'Alpha',
      position: { x: 0, z: 0 },
      x: 50,
      y: 60,
      color: '#ff9900',
      factionFilterId: null,
      iconSize: 9
    }

    const wrapper = mount(MapSavePoiScreenLayer, {
      props: {
        items: [item],
        focusedSavePoiKey: null,
        screenScale: 1,
        panX: 0,
        panY: 0,
        getSavePoiIconUrl: () => '/poi.svg'
      }
    })

    await wrapper.get('.save-poi-marker').trigger('mousedown')
    expect(wrapper.emitted('save-poi-pointerdown')?.[0]?.[0].key).toBe('npc-2')
  })
})
