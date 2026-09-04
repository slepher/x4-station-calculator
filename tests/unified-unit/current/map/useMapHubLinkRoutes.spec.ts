import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useMapHubLinkRoutes } from '@/composables/useMapHubLinkRoutes'
import type { Cluster, Sector } from '@/components/map/types'
import type { HubLinkRouteEntry } from '@/store/logic/hubLinkRoutes'
import type { X4MapHighwayRingChain } from '@/types/x4'

describe('useMapHubLinkRoutes', () => {
  it('reserves the center lane when final gate-to-gate endpoints match a ring highway channel', () => {
    const { routeLines } = useMapHubLinkRoutes({
      clusters: computed(() => clusters),
      sectors: computed(() => sectors),
      highwayRingChains: computed(() => ringChains),
      layoutState: computed(() => ({
        cfg: { width: 400, height: 300, padX: 0, padY: 0, topPad: 0 },
        fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
        centers: { 'cluster-a': { x: 100, y: 100 } },
        clusterRadius: 100
      })),
      routeEntries: ref([routeEntry])
    })

    expect(routeLines.value).toHaveLength(1)
    expect(routeLines.value[0]?.d).toBe('M 100.0,100.0 L 104.0,96.0 L 142.2,96.0 L 146.2,100.0')
  })

  it('does not reserve the center lane when only an internal highway id matches but final gates do not match the ring channel', () => {
    const { routeLines } = useMapHubLinkRoutes({
      clusters: computed(() => clusters),
      sectors: computed(() => sectors),
      highwayRingChains: computed(() => ringChains),
      layoutState: computed(() => ({
        cfg: { width: 400, height: 300, padX: 0, padY: 0, topPad: 0 },
        fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
        centers: { 'cluster-a': { x: 100, y: 100 } },
        clusterRadius: 100
      })),
      routeEntries: ref([nonMatchingGateRouteEntry])
    })

    expect(routeLines.value).toHaveLength(1)
    expect(routeLines.value[0]?.d).toBe('M 100.0,100.0 L 146.2,100.0')
  })

  it('keeps both endpoint group colors for dual-track route rendering', () => {
    const { routeLines } = useMapHubLinkRoutes({
      clusters: computed(() => clusters),
      sectors: computed(() => sectors),
      highwayRingChains: computed(() => ringChains),
      layoutState: computed(() => ({
        cfg: { width: 400, height: 300, padX: 0, padY: 0, topPad: 0 },
        fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
        centers: { 'cluster-a': { x: 100, y: 100 } },
        clusterRadius: 100
      })),
      routeEntries: ref([{
        ...routeEntry,
        endpointColors: {
          from: '#00ffff',
          to: '#ff8800'
        }
      } as HubLinkRouteEntry])
    })

    expect(routeLines.value).toHaveLength(1)
    expect(routeLines.value[0]?.colors).toEqual({
      from: '#00ffff',
      to: '#ff8800'
    })
    expect(routeLines.value[0]?.trackPaths).toEqual({
      from: 'M 99.5,99.5 L 103.9,95.3 L 142.3,95.3 L 146.7,99.5',
      to: 'M 100.5,100.5 L 104.1,96.7 L 142.1,96.7 L 145.7,100.5'
    })
  })
})

const clusters: Record<string, Cluster> = {
  'cluster-a': {
    id: 'cluster-a',
    normalized: { pixel_basis: { x: 0, y: 0 } },
    sectors: ['sector-a']
  }
}

const sectors: Record<string, Sector> = {
  'sector-a': {
    id: 'sector-a',
    cluster_id: 'cluster-a',
    raw_center_pos: { x: 0, y: 0, z: 0 },
    normalized: {
      center_offset_ratio: { x: 0, y: 0 },
      sector_radius_ratio: 1,
      scale_per_radius: 0.01
    },
    cluster_gates: {
      'gate-a': {
        id: 'gate-a',
        raw_local_pos: { x: 0, z: 0 }
      },
      'gate-b': {
        id: 'gate-b',
        raw_local_pos: { x: 100, z: 0 }
      },
      'gate-c': {
        id: 'gate-c',
        raw_local_pos: { x: 150, z: 0 }
      }
    }
  }
}

const ringChains: X4MapHighwayRingChain[] = [{
  totalLengthKm: 1,
  hops: [{
    sectorId: 'sector-a',
    prevGateId: 'gate-a',
    nextGateId: 'gate-b',
    forwardHighwayId: 'highway-forward',
    forwardHighwayLengthKm: 1,
    backwardHighwayId: 'highway-backward',
    backwardHighwayLengthKm: 1
  }]
}]

const routeEntry: HubLinkRouteEntry = {
  id: 'link-a',
  scope: 'binding',
  fromGroupId: 'group-a',
  toGroupId: 'group-b',
  from: {
    groupId: 'group-a',
    sectorMacro: 'sector-a',
    stationLabel: 'A',
    position: { x: 0, y: 0, z: 0 }
  },
  to: {
    groupId: 'group-b',
    sectorMacro: 'sector-a',
    stationLabel: 'B',
    position: { x: 100, y: 0, z: 0 }
  },
  colorGroupId: 'group-a',
  color: '#00ffff',
  candidates: [{
    candidateOrder: 0,
    sectors: ['sector-a'],
    segments: [{
      kind: 'gate-to-gate',
      fromLabel: 'A',
      toLabel: 'B',
      distanceKm: 1,
      countsInSummaryDistance: false,
      fromPosition: { x: 0, y: 0, z: 0 },
      toPosition: { x: 100, y: 0, z: 0 },
      fromEndpoint: { kind: 'cluster-gate', sectorMacro: 'sector-a', gateId: 'gate-a' },
      toEndpoint: { kind: 'cluster-gate', sectorMacro: 'sector-a', gateId: 'gate-b' }
    }],
    terminal: {
      sectorMacro: 'sector-a',
      label: 'B',
      position: { x: 100, y: 0, z: 0 }
    },
    summary: {
      gateCount: 0,
      normalDistanceKm: 1,
      superhighwayDistanceKm: 0,
      highwayDistanceKm: 0,
      highwayGateCount: 0,
      engineDistanceKm: 1
    },
    problems: []
  }],
  problems: []
}

const nonMatchingGateRouteEntry: HubLinkRouteEntry = {
  ...routeEntry,
  id: 'link-b',
  candidates: [{
    ...routeEntry.candidates[0]!,
    segments: [{
      ...routeEntry.candidates[0]!.segments[0]!,
      fromEndpoint: { kind: 'cluster-gate', sectorMacro: 'sector-a', gateId: 'gate-a' },
      toEndpoint: { kind: 'cluster-gate', sectorMacro: 'sector-a', gateId: 'gate-c' },
      highwayId: 'highway-forward'
    }]
  }]
}
