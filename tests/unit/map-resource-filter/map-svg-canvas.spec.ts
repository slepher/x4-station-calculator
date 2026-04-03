/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameDataStore } from '@/store/useGameDataStore'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key,
    te: () => false
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn(async () => {}),
  setGameFolderName: vi.fn()
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (item: { id: string }) => item.id,
    translateModuleGroup: (item: { id: string }) => item.id,
    translateWare: (item: { id: string }) => item.id,
    translateDlc: (item: { id: string }) => item.id
  })
}))

import MapSvgCanvas from '@/components/map/MapSvgCanvas.vue'

describe('MapSvgCanvas resource pie fill', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const gameData = useGameDataStore()
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          name: 'Cluster 01',
          owner: 'argon',
          owner_color: '#8899aa',
          dlc_tag: 'base',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              cluster_id: 'cluster_01',
              name: 'Alpha',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: -0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 1
              },
              zones: {
                zone_left: {
                  id: 'zone_left',
                  raw_sector_pos: { x: 0, y: 0, z: 0, sx: 0.2, sy: 0 }
                }
              }
            },
            sector_beta: {
              id: 'sector_beta',
              cluster_id: 'cluster_01',
              name: 'Beta',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: 0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 1
              },
              zones: {
                zone_right: {
                  id: 'zone_right',
                  raw_sector_pos: { x: 0, y: 0, z: 0, sx: -0.2, sy: 0 }
                }
              }
            }
          },
          sector_links: {
            link_ab: {
              id: 'link_ab',
              sector_a_id: 'sector_alpha',
              sector_b_id: 'sector_beta',
              from_zone_id: 'zone_left',
              to_zone_id: 'zone_right'
            }
          }
        }
      }
    } as never
  })

  it('renders bottom-center group badges only for resource-filled sectors', () => {
    const wrapper = mount(MapSvgCanvas, {
      props: {
        resourceHighlightedSectorIds: ['sector_alpha'],
        resourceSectorFills: {
          sector_alpha: {
            mode: 'solid',
            ware: 'ore',
            color: '#ff9900'
          }
        },
        resourceSectorGroupBadges: {
          sector_alpha: ['1', '2'],
          sector_hub: ['3']
        }
      }
    })

    const badges = wrapper.findAll('[data-testid="resource-group-badge"]')
    expect(badges).toHaveLength(2)
    expect(wrapper.get('[data-testid="resource-group-badge-sector_alpha-1"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="resource-group-badge-sector_alpha-2"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="resource-group-badge-sector_hub-3"]').exists()).toBe(false)
  })

  it('renders sector links from zones without shcon_anchors', () => {
    const wrapper = mount(MapSvgCanvas)

    const lines = wrapper.findAll('g.sector-links line')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.attributes('x1')).not.toBe(lines[0]?.attributes('x2'))
  })

  it('maps sector highways into the same scaled sector space as the clip polygon', () => {
    const gameData = useGameDataStore()
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          name: 'Cluster 01',
          owner: 'argon',
          owner_color: '#8899aa',
          dlc_tag: 'base',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              cluster_id: 'cluster_01',
              name: 'Alpha',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: -0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 1
              },
              zones: {},
              highways: {
                highway_a: {
                  entry: { sx: 0, sy: 0 },
                  exit: { sx: 0.1, sy: 0 }
                }
              }
            },
            sector_beta: {
              id: 'sector_beta',
              cluster_id: 'cluster_01',
              name: 'Beta',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: 0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 1
              },
              zones: {}
            }
          },
          sector_links: {}
        }
      }
    } as never

    const wrapper = mount(MapSvgCanvas)
    const line = wrapper.get('g.highways line')
    const sectorPolygon = wrapper.get('polygon.sector-polygon[data-sector-id="sector_alpha"]')
    const points = (sectorPolygon.attributes('points') || '').split(' ').map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x, y }
    })
    const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length

    expect(Number(line.attributes('x1'))).toBeCloseTo(centerX, 1)
    expect(Number(line.attributes('y1'))).toBeCloseTo(centerY, 1)
  })

  it('renders sector links from raw zone coordinates centered by the full zone bounding box', () => {
    const gameData = useGameDataStore()
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          name: 'Cluster 01',
          owner: 'argon',
          owner_color: '#8899aa',
          dlc_tag: 'base',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              cluster_id: 'cluster_01',
              name: 'Alpha',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: -0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 0.05
              },
              zones: {
                zone_left: {
                  id: 'zone_left',
                  raw_sector_pos: { x: 10, y: 0, z: 0 }
                },
                zone_right: {
                  id: 'zone_right',
                  raw_sector_pos: { x: 30, y: 0, z: 0 }
                }
              }
            },
            sector_beta: {
              id: 'sector_beta',
              cluster_id: 'cluster_01',
              name: 'Beta',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: 0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 0.05
              },
              zones: {
                zone_beta_left: {
                  id: 'zone_beta_left',
                  raw_sector_pos: { x: 100, y: 0, z: 0 }
                },
                zone_beta_right: {
                  id: 'zone_beta_right',
                  raw_sector_pos: { x: 140, y: 0, z: 0 }
                }
              }
            }
          },
          sector_links: {
            link_ab: {
              id: 'link_ab',
              sector_a_id: 'sector_alpha',
              sector_b_id: 'sector_beta',
              from_zone_id: 'zone_left',
              to_zone_id: 'zone_beta_right'
            }
          }
        }
      }
    } as never

    const wrapper = mount(MapSvgCanvas)
    const lines = wrapper.findAll('g.sector-links line')

    expect(lines).toHaveLength(1)
  })

  it('projects placement overlays and preview using the shifted sector center', () => {
    const gameData = useGameDataStore()
    gameData.maps = {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          name: 'Cluster 01',
          owner: 'argon',
          owner_color: '#8899aa',
          dlc_tag: 'base',
          normalized: { pixel_basis: { x: 0, y: 0 } },
          sectors: {
            sector_alpha: {
              id: 'sector_alpha',
              cluster_id: 'cluster_01',
              name: 'Alpha',
              owner: 'argon',
              owner_color: '#8899aa',
              area: { sunlight: 1.2 },
              resources: [],
              normalized: {
                center_offset_ratio: { x: -0.4, y: 0 },
                sector_radius_ratio: 0.35,
                scale_per_radius: 0.05
              },
              zones: {
                zone_left: {
                  id: 'zone_left',
                  raw_sector_pos: { x: 10, y: 0, z: 0 }
                },
                zone_right: {
                  id: 'zone_right',
                  raw_sector_pos: { x: 30, y: 0, z: 0 }
                }
              }
            }
          },
          sector_links: {}
        }
      }
    } as never

    const wrapper = mount(MapSvgCanvas, {
      props: {
        placementOverlays: [{
          key: 'station-1',
          id: 'station-1',
          kind: 'station',
          name: 'Station One',
          icon: 'factory',
          location: {
            cluster_id: 'cluster_01',
            sector_id: 'sector_alpha',
            pos: { x: 30, z: 0 }
          }
        }],
        placementPreview: {
          kind: 'station',
          name: 'Preview One',
          icon: 'factory',
          location: {
            cluster_id: 'cluster_01',
            sector_id: 'sector_alpha',
            pos: { x: 10, z: 0 }
          }
        }
      }
    })

    const sectorPolygon = wrapper.get('polygon.sector-polygon[data-sector-id="sector_alpha"]')
    const polygonPoints = (sectorPolygon.attributes('points') || '').split(' ').map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x, y }
    })
    const minX = Math.min(...polygonPoints.map((point) => point.x))
    const maxX = Math.max(...polygonPoints.map((point) => point.x))

    const parseTranslateX = (value: string) => Number((value.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/) || [])[1])

    const overlayX = parseTranslateX(wrapper.get('g.placement-overlay').attributes('transform'))
    const previewX = parseTranslateX(wrapper.get('g.placement-preview').attributes('transform'))

    expect(overlayX).toBeGreaterThanOrEqual(minX)
    expect(overlayX).toBeLessThanOrEqual(maxX)
    expect(previewX).toBeGreaterThanOrEqual(minX)
    expect(previewX).toBeLessThanOrEqual(maxX)
  })

})
