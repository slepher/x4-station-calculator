/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapLinkIconScreenLayer from '@/components/map/MapLinkIconScreenLayer.vue'

describe('MapLinkIconScreenLayer', () => {
  it('renders sector link endpoint icons in viewport coordinates', () => {
    const wrapper = mount(MapLinkIconScreenLayer, {
      props: {
        sectorLinkLines: [{
          id: 'link-1',
          start: { x: 100, y: 200 },
          end: { x: 150, y: 250 }
        }],
        gateCircles: [],
        screenScale: 2,
        panX: 10,
        panY: 20,
        stargateVisualScale: 1.5
      }
    })

    const icons = wrapper.findAll('.superhighway-icon')
    expect(icons).toHaveLength(2)
    expect(icons[0]?.attributes('style')).toContain('left: 210px;')
    expect(icons[0]?.attributes('style')).toContain('top: 420px;')
    expect(icons[0]?.attributes('style')).toContain('width: 12.6px;')
  })

  it('renders gate icons in viewport coordinates', () => {
    const wrapper = mount(MapLinkIconScreenLayer, {
      props: {
        sectorLinkLines: [],
        gateCircles: [{
          id: 'gate-1',
          point: { x: 50, y: 60 },
          r: 1.2,
          color: '#fff',
          clusterId: 'cluster_01'
        }],
        screenScale: 3,
        panX: 5,
        panY: 15,
        stargateVisualScale: 1.5
      }
    })

    const gate = wrapper.get('.gate-circle')
    expect(gate.attributes('data-gate-id')).toBe('gate-1')
    expect(gate.attributes('data-cluster-id')).toBe('cluster_01')
    expect(gate.attributes('style')).toContain('left: 155px;')
    expect(gate.attributes('style')).toContain('top: 195px;')
    expect(gate.attributes('style')).toContain('width: 21.6px;')
  })
})
