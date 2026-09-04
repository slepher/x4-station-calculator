/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapHubLinkRouteLayer from '@/components/map/layers/MapHubLinkRouteLayer.vue'

describe('MapHubLinkRouteLayer', () => {
  it('renders group color side strokes and a gate-style center stroke', () => {
    const wrapper = mount(MapHubLinkRouteLayer, {
      props: {
        visible: true,
        routeLines: [{
          id: 'route-1',
          type: 'path',
          color: '#22c55e',
          colors: {
            from: '#22c55e',
            to: '#a855f7'
          },
          trackPaths: {
            center: 'M 0,0 L 100,0',
            from: 'M 0,-1 L 100,-1',
            to: 'M 0,1 L 100,1'
          }
        }]
      }
    })

    const paths = wrapper.findAll('path.hub-link-route')
    expect(paths).toHaveLength(3)
    expect(paths[0]?.attributes('stroke')).toBe('#22c55e')
    expect(paths[0]?.attributes('stroke-width')).toBe('1.2')
    expect(paths[1]?.attributes('stroke')).toBe('#a855f7')
    expect(paths[1]?.attributes('stroke-width')).toBe('1.2')
    expect(paths[2]?.attributes('stroke')).toBe('#e5e7eb')
    expect(paths[2]?.attributes('stroke-width')).toBe('0.9')
    expect(paths[2]?.attributes('stroke-opacity')).toBe('0.85')
  })
})
