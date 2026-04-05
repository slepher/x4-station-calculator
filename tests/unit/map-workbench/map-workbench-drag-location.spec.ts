/**
 * @vitest-environment jsdom
 */
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameDataStore } from '@/store/useGameDataStore'
import MapWorkbenchView from '@/components/map/MapWorkbenchView.vue'

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: [{ ware: 'ore', color: '#ff9900' }]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/factions.json', () => ({
  default: [
    { id: 'argon', nameId: 'faction.argon' },
    { id: 'ownerless', name: '', nameId: '' }
  ]
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('en'),
      t: (key: string) => key,
      te: () => false
    })
  }
})

const empireStoreMock = vi.hoisted(() => ({
  activeEmpire: {
    id: 'empire-1',
    name: 'Empire',
    sectors: [],
    stations: [
      {
        id: 'station-2',
        name: 'Beta Station',
        type: 'industrial',
        location: {
          cluster_id: 'cluster_01',
          sector_id: 'sector_alpha',
          pos: { x: 64400, z: 128200 },
          sunlight: 100,
          resources: ['ore']
        }
      }
    ]
  },
  clearStationLocation: vi.fn(),
  clearSectorLocation: vi.fn(),
  setStationLocation: vi.fn(),
  setSectorLocation: vi.fn()
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => empireStoreMock
}))

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

describe('MapWorkbenchView drag location', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    empireStoreMock.setStationLocation.mockReset()

    const gameData = useGameDataStore()
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              name: 'Alpha',
              area: { sunlight: 1 },
              raw_center_pos: { x: 64000, y: 0, z: 128000 },
              resources: [{ ware: 'ore' }],
              normalized: {
                center_offset_ratio: { x: 0, y: 0 },
                sector_radius_ratio: 1,
                scale_per_radius: 0.001
              },
              zones: {
                zone_1: {
                  raw_sector_pos: { x: 63000, y: 0, z: 127000 }
                },
                zone_2: {
                  raw_sector_pos: { x: 65000, y: 0, z: 129000 }
                }
              }
            }
          }
        }
      }
    } as never
  })

  it('writes absolute raw coordinates when re-dragging an overlay in a sector with a non-zero center', async () => {
    const wrapper = mount(MapWorkbenchView, {
      attachTo: document.body,
      global: {
        stubs: {
          MapSvgCanvas: {
            name: 'MapSvgCanvas',
            props: ['placementOverlays'],
            template: '<div data-testid="map-svg-canvas" data-map-sector-id="sector_alpha"></div>'
          },
          MapSectorTooltip: true,
          MapResourceFilterPanel: true,
          MapSavePanel: true,
          MapSavePoiTooltip: true,
          MapStationPanel: {
            name: 'MapStationPanel',
            props: ['items'],
            template: '<div data-testid="map-station-panel">{{ items.length }}</div>'
          }
        }
      }
    })

    const viewport = wrapper.get('.map-viewport')
    setViewportMetrics(viewport.element)

    await wrapper.get('[data-testid="map-station-entry-button"]').trigger('click')

    const sectorTarget = wrapper.get('[data-testid="map-svg-canvas"]').element
    ;(sectorTarget as HTMLElement).getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 300,
      width: 200,
      height: 200,
      x: 100,
      y: 100,
      toJSON: () => ({})
    }))
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => sectorTarget)
    })

    const canvas = wrapper.getComponent({ name: 'MapSvgCanvas' })
    canvas.vm.$emit('overlay-pointerdown', {
      key: 'station:station-2',
      id: 'station-2',
      kind: 'station',
      name: 'Beta Station',
      icon: 'factory'
    })

    await viewport.trigger('mousemove', {
      clientX: 240,
      clientY: 180
    })
    await viewport.trigger('mouseup')

    expect(empireStoreMock.setStationLocation).toHaveBeenCalledWith('station-2', {
      cluster_id: 'cluster_01',
      sector_id: 'sector_alpha',
      pos: {
        x: 64816,
        z: 128408
      },
      sunlight: 100,
      resources: ['ore']
    })
  })
})
