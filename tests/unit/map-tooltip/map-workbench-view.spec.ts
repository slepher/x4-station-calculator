/**
 * @vitest-environment jsdom
 */
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: [{ ware: 'ore', color: '#ff9900' }]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/factions.json', () => ({
  default: [{ id: 'argon', nameId: 'faction.argon' }]
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('en'),
      t: (key: string) => {
        const dict: Record<string, string> = {
          'faction.argon': 'Argon Federation',
          'map.resource_filter_sunlight': 'Sunlight',
          'map.resource_filter_sunlight_suffix': '%',
          'map.search_sector_placeholder': 'Search sector',
          'map.scale': 'Scale'
        }
        return dict[key] || key
      },
      te: (key: string) => key === 'faction.argon'
    })
  }
})

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    activeEmpire: {
      id: 'empire-1',
      name: 'Empire',
      sectors: [
        { id: 'sector-plan-1', name: 'Transit One', order: 0 },
        {
          id: 'sector-plan-2',
          name: 'Transit Two',
          order: 1,
          location: {
            cluster_id: 'cluster_01',
            sector_id: 'sector_alpha',
            pos: { x: 1200, z: -800 },
            sunlight: 100,
            resources: ['ore']
          }
        }
      ],
      stations: [
        { id: 'station-1', name: 'Alpha Station', type: 'industrial' },
        {
          id: 'station-2',
          name: 'Beta Station',
          type: 'industrial',
          location: {
            cluster_id: 'cluster_01',
            sector_id: 'sector_alpha',
            pos: { x: 400, z: 900 },
            sunlight: 100,
            resources: ['ore', 'silicon']
          }
        }
      ]
    },
    clearStationLocation: vi.fn(),
    clearSectorLocation: vi.fn(),
    setStationLocation: vi.fn(),
    setSectorLocation: vi.fn()
  })
}))

import MapWorkbenchView from '@/components/empire/MapWorkbenchView.vue'

const hoverPayload = {
  sectorId: 'sector_alpha',
  clusterId: 'cluster_01',
  name: 'Argon Prime',
  displayName: 'Argon Prime',
  owner: 'argon',
  sunlight: 100,
  resources: [],
  anchorRect: {
    left: 100,
    top: 80,
    right: 140,
    bottom: 120,
    width: 40,
    height: 40
  }
}

const setViewportMetrics = (element: Element) => {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 600 })
  ;(element as HTMLElement).getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }))
}

const setSectorAnchorMetrics = (element: Element) => {
  ;(element as HTMLElement).getBoundingClientRect = vi.fn(() => ({
    left: 100,
    top: 80,
    right: 140,
    bottom: 120,
    width: 40,
    height: 40,
    x: 100,
    y: 80,
    toJSON: () => ({})
  }))
}

const setPointerSectorTarget = (element: Element | null) => {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element)
  })
}

describe('MapWorkbenchView tooltip interactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const buildWrapper = () => mount(MapWorkbenchView, {
    attachTo: document.body,
    global: {
      stubs: {
        MapSvgCanvas: {
          name: 'MapSvgCanvas',
          props: ['resourceHighlightedSectorIds', 'resourceSectorFills', 'placementOverlays'],
          template: '<div data-testid="map-svg-canvas" data-sector-hover-id="sector_alpha"></div>'
        },
        MapSectorTooltip: {
          name: 'MapSectorTooltip',
          props: ['title'],
          template: '<section class="sector-tooltip-card" data-testid="map-sector-tooltip">{{ title }}</section>'
        },
        MapResourceFilterPanel: {
          name: 'MapResourceFilterPanel',
          template: '<div data-testid="map-resource-filter-panel"></div>'
        },
        MapStationPanel: {
          name: 'MapStationPanel',
          props: ['items'],
          template: `
            <div data-testid="map-station-panel">
              <button data-testid="map-station-panel-close" @click="$emit('close')">close</button>
              <div data-testid="map-station-panel-count">{{ items.length }}</div>
            </div>
          `
        }
      }
    }
  })

  it('hides tooltip while wheel zoom is still in progress', async () => {
    vi.useFakeTimers()

    const wrapper = buildWrapper()
    const viewport = wrapper.get('.map-viewport')
    setViewportMetrics(viewport.element)
    const sectorTarget = wrapper.get('[data-testid="map-svg-canvas"]').element
    setSectorAnchorMetrics(sectorTarget)
    setPointerSectorTarget(sectorTarget)

    const canvas = wrapper.getComponent({ name: 'MapSvgCanvas' })
    canvas.vm.$emit('content-size', {
      width: 1200,
      height: 900,
      clusterRefHeight: 142
    })
    await nextTick()

    canvas.vm.$emit('sector-hover', hoverPayload)
    await nextTick()
    expect(wrapper.find('[data-testid="map-sector-tooltip"]').exists()).toBe(true)

    viewport.element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
      clientX: 120,
      clientY: 100
    }))
    await nextTick()

    expect(wrapper.find('[data-testid="map-sector-tooltip"]').exists()).toBe(false)

    vi.advanceTimersByTime(100)
    await nextTick()

    expect(wrapper.find('[data-testid="map-sector-tooltip"]').exists()).toBe(false)
  })

  it('restores tooltip after wheel zoom settles when pointer is still over a sector', async () => {
    vi.useFakeTimers()

    const wrapper = buildWrapper()
    const viewport = wrapper.get('.map-viewport')
    setViewportMetrics(viewport.element)
    const sectorTarget = wrapper.get('[data-testid="map-svg-canvas"]').element
    setSectorAnchorMetrics(sectorTarget)
    setPointerSectorTarget(sectorTarget)

    const canvas = wrapper.getComponent({ name: 'MapSvgCanvas' })
    canvas.vm.$emit('content-size', {
      width: 1200,
      height: 900,
      clusterRefHeight: 142
    })
    await nextTick()

    canvas.vm.$emit('sector-hover', hoverPayload)
    await nextTick()

    viewport.element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
      clientX: 120,
      clientY: 100
    }))
    await nextTick()

    expect(wrapper.find('[data-testid="map-sector-tooltip"]').exists()).toBe(false)

    vi.advanceTimersByTime(260)
    await nextTick()

    expect(wrapper.find('[data-testid="map-sector-tooltip"]').exists()).toBe(true)
  })

  it('clears browser text selection when map drag starts', async () => {
    const removeAllRanges = vi.fn()
    vi.stubGlobal('getSelection', vi.fn(() => ({
      removeAllRanges
    })))

    const wrapper = buildWrapper()

    const viewport = wrapper.get('.map-viewport')
    await viewport.trigger('mousedown', {
      button: 0,
      clientX: 220,
      clientY: 180
    })

    expect(removeAllRanges).toHaveBeenCalledTimes(1)
  })

  it('forwards resource sector fill descriptions from panel to canvas', async () => {
    const wrapper = buildWrapper()
    const canvas = wrapper.getComponent({ name: 'MapSvgCanvas' })
    const panel = wrapper.getComponent({ name: 'MapResourceFilterPanel' })

    panel.vm.$emit('resource-visual-change', {
      highlightedSectorIds: ['sector_alpha'],
      sectorFills: {
        sector_alpha: {
          mode: 'pie',
          slices: [
            { ware: 'ore', color: '#ff9900', share: 0.7 },
            { ware: 'silicon', color: '#00bbff', share: 0.3 }
          ]
        }
      }
    })
    await nextTick()

    expect(canvas.props('resourceHighlightedSectorIds')).toEqual(['sector_alpha'])
    expect(canvas.props('resourceSectorFills')).toEqual({
      sector_alpha: {
        mode: 'pie',
        slices: [
          { ware: 'ore', color: '#ff9900', share: 0.7 },
          { ware: 'silicon', color: '#00bbff', share: 0.3 }
        ]
      }
    })
  })

  it('anchors search, resource filter, zoom, and sidebars in the updated map positions', async () => {
    const wrapper = buildWrapper()

    expect(wrapper.get('.map-search-panel').classes()).toContain('right-6')
    expect(wrapper.get('.map-search-panel').classes()).not.toContain('left-6')
    expect(wrapper.get('.map-resource-entry-btn').classes()).toContain('left-6')
    expect(wrapper.get('.map-resource-entry-btn').classes()).not.toContain('right-6')
    expect(wrapper.get('.zoom-panel').classes()).toContain('right-6')
    expect(wrapper.get('.zoom-panel').classes()).not.toContain('left-6')
    expect(wrapper.get('[data-testid="map-station-entry-button"]').classes()).toContain('left-6')
    expect(wrapper.get('[data-testid="map-station-entry-button"]').classes()).toContain('bottom-5')

    const panel = wrapper.getComponent({ name: 'MapResourceFilterPanel' })
    panel.vm.$emit('panel-open')
    await nextTick()

    const layoutChildren = Array.from(wrapper.get('.map-layout').element.children)
    expect(layoutChildren[0]?.getAttribute('data-testid')).toBe('map-resource-filter-panel')
    expect(layoutChildren[1]?.classList.contains('map-shell')).toBe(true)
  })

  it('opens the station panel from the left, hides the entry button, and forwards placed overlays', async () => {
    const wrapper = buildWrapper()

    await wrapper.get('[data-testid="map-station-entry-button"]').trigger('click')

    expect(wrapper.find('[data-testid="map-station-entry-button"]').exists()).toBe(false)
    expect(wrapper.get('.map-layout').classes()).toContain('station-sidebar-active')
    expect(wrapper.get('[data-testid="map-station-panel-count"]').text()).toBe('4')

    const canvas = wrapper.getComponent({ name: 'MapSvgCanvas' })
    expect(canvas.props('placementOverlays')).toHaveLength(2)

    const layoutChildren = Array.from(wrapper.get('.map-layout').element.children)
    expect(layoutChildren[0]?.getAttribute('data-testid')).toBe('map-resource-filter-panel')
    expect(layoutChildren[1]?.getAttribute('data-testid')).toBe('map-station-panel')

    await wrapper.get('[data-testid="map-station-panel-close"]').trigger('click')
    expect(wrapper.find('[data-testid="map-station-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="map-station-entry-button"]').exists()).toBe(true)
  })
})
