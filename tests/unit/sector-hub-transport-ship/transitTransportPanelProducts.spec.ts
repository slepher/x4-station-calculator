/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitTransportPanel from '@/components/empire/transit-hub/TransitTransportPanel.vue'
import type { TransitTransportPanelState, TransportRouteSegmentView } from '@/components/empire/presenters/useTransitTransportPresenter'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'transit_transport.products') return '产物'
      if (key === 'transit_transport.route_action.arrive_to_station') return '抵达空间站'
      if (key === 'transit_transport.station_count') return '座空间站'
      if (key === 'transit_transport.gates_value') return `${params?.count} 星门`
      return key
    }
  })
}))

function panel(
  productItems: Array<{ wareId: string; name: string }> = [],
  segments: TransportRouteSegmentView[] = [
    {
      kind: 'gate-to-station',
      fromLabel: '星区 A',
      toLabel: '空间站 A',
      distanceKm: 10,
      countsInSummaryDistance: true
    }
  ]
): TransitTransportPanelState {
  return {
    sectorGroupRows: [],
    stationSectorGroups: [
      {
        id: 'sector-a',
        sectorName: '星区 A',
        summary: {
          gateCount: 0,
          normalDistanceKm: 10,
          superhighwayDistanceKm: 0,
          highwayDistanceKm: 0,
          engineDistanceKm: 10,
          highwayGateCount: 0,
          engineGateCount: 0
        },
        segments: [],
        terminal: { kind: 'sector', label: '星区 A', sectorMacro: 'sector-a', position: { x: 0, y: 0, z: 0 } },
        stations: [
          {
            id: 'station-a',
            stationName: '空间站 A',
            stationCode: 'STA-001',
            sectorName: '星区 A',
            coordinateKm: { x: 0, y: 0, z: 0 },
            terminalDistanceKm: 10,
            totalNormalDistanceKm: 10,
            summary: {
              gateCount: 0,
              normalDistanceKm: 10,
              superhighwayDistanceKm: 0,
              highwayDistanceKm: 0,
              engineDistanceKm: 10,
              highwayGateCount: 0,
              engineGateCount: 0
            },
            segments,
            products: {
              label: productItems.length > 0 ? productItems.map((item) => item.name).join(', ') : '无产物',
              count: productItems.length,
              items: productItems.map((item) => ({
                ...item,
                priority: 1,
                tier: 1,
                netRate: 1
              }))
            },
            productionLineCount: 0
          }
        ]
      }
    ],
    problems: [],
    shipSelector: {
      groups: [],
      selectedBlueprintId: null,
      selectedProfile: null,
      selectedBlueprintValid: false,
      hasCandidates: false
    },
    empty: false
  }
}

describe('TransitTransportPanel station products', () => {
  it('does not render product detail block for empty products after expanding route details', async () => {
    const wrapper = mount(TransitTransportPanel, {
      props: { panel: panel() }
    })

    expect(wrapper.text()).toContain('无产物')

    await wrapper.find('.station-summary').trigger('click')

    expect(wrapper.find('.station-products-detail').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('产物\n无产物')
  })

  it('renders product detail block when products exist', async () => {
    const wrapper = mount(TransitTransportPanel, {
      props: { panel: panel([{ wareId: 'energy_cells', name: '能量电池' }]) }
    })

    await wrapper.find('.station-summary').trigger('click')

    expect(wrapper.find('.station-products-detail').exists()).toBe(true)
    expect(wrapper.find('.station-products-detail').text()).toContain('产物')
    expect(wrapper.find('.station-products-detail').text()).toContain('能量电池')
  })

  it('keeps station highway alternative details under the origin sector block', async () => {
    const wrapper = mount(TransitTransportPanel, {
      props: {
        panel: panel([], [
          {
            kind: 'gate-to-station',
            fromLabel: '希望之歌的选择 I',
            toLabel: 'UFT-938',
            distanceKm: 300,
            countsInSummaryDistance: true,
            highwayAlternative: [
              {
                kind: 'highway-approach',
                fromLabel: '希望之歌的选择 I',
                toLabel: '希望之歌的选择 I',
                distanceKm: 10.7,
                countsInSummaryDistance: true
              },
              {
                kind: 'highway',
                fromLabel: '希望之歌的选择 I',
                toLabel: 'UFT-938',
                distanceKm: 207.7,
                countsInSummaryDistance: false
              },
              {
                kind: 'highway-exit',
                fromLabel: 'UFT-938',
                toLabel: 'UFT-938',
                distanceKm: 45.9,
                countsInSummaryDistance: true
              }
            ]
          }
        ])
      }
    })

    await wrapper.find('.station-summary').trigger('click')

    const sectorTitles = wrapper
      .findAll('.route-details .route-sector')
      .map((node) => node.text())

    expect(sectorTitles).toEqual(['希望之歌的选择 I'])
    expect(wrapper.find('.route-details').text()).toContain('transit_transport.segment.highway-exit')
  })

  it('keeps expanded station highway segments under the highway origin block', async () => {
    const wrapper = mount(TransitTransportPanel, {
      props: {
        panel: panel([], [
          {
            kind: 'highway',
            fromLabel: '真视',
            toLabel: 'LPZ-398',
            distanceKm: 82.2,
            countsInSummaryDistance: false
          },
          {
            kind: 'highway-exit',
            fromLabel: 'LPZ-398',
            toLabel: 'LPZ-398',
            distanceKm: 19.4,
            countsInSummaryDistance: true
          }
        ])
      }
    })

    await wrapper.find('.station-summary').trigger('click')

    const sectorTitles = wrapper
      .findAll('.route-details .route-sector')
      .map((node) => node.text())

    expect(sectorTitles).toEqual(['真视'])
    expect(wrapper.find('.route-details').text()).toContain('transit_transport.segment.highway-exit')
  })
})
