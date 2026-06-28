/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapLinkLayer from '@/components/map/layers/MapLinkLayer.vue'

const baseProps = {
  sectorLinkLines: [{
    id: 'link-1',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 }
  }],
  highwaySegments: [{
    id: 'highway-1',
    type: 'line' as const,
    start: { x: 0, y: 10 },
    end: { x: 100, y: 10 }
  }],
  gateCircles: [{
    id: 'gate-1',
    point: { x: 50, y: 50 },
    r: 1,
    color: '#e5e7eb',
    clusterId: 'cluster_01',
    sectorId: 'sector_alpha',
    gateId: 'gate_1'
  }],
  crossClusterGateLines: [{
    id: 'gate-line-1',
    left: { x: 10, y: 20 },
    right: { x: 90, y: 20 },
    isHighwayRingGate: false
  }],
  stargateVisualScale: 1.5,
  visible: true
}

describe('MapLinkLayer', () => {
  it('renders only native link strokes in base mode', () => {
    const wrapper = mount(MapLinkLayer, {
      props: {
        ...baseProps,
        renderMode: 'base'
      }
    })

    expect(wrapper.find('g.sector-links line').exists()).toBe(true)
    expect(wrapper.find('g.highways line').exists()).toBe(true)
    expect(wrapper.find('g.cross-links line').exists()).toBe(true)
    expect(wrapper.find('g.sector-link-icons image').exists()).toBe(false)
    expect(wrapper.find('g.gates image.gate-circle').exists()).toBe(false)
  })

  it('renders only endpoint and gate icons in icons mode', () => {
    const wrapper = mount(MapLinkLayer, {
      props: {
        ...baseProps,
        renderMode: 'icons'
      }
    })

    expect(wrapper.find('g.sector-links line').exists()).toBe(false)
    expect(wrapper.find('g.highways line').exists()).toBe(false)
    expect(wrapper.find('g.cross-links line').exists()).toBe(false)
    expect(wrapper.findAll('g.sector-link-icons image')).toHaveLength(2)
    expect(wrapper.find('g.gates image.gate-circle').exists()).toBe(true)
  })
})
