import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useMapSvgLinks } from '@/composables/useMapSvgLinks'
import type { Cluster, Sector, Vec2 } from '@/components/map/types'
import type { MapSvgLayoutState } from '@/composables/useMapSvgLayout'

const layoutState = (centers: Record<string, Vec2>): MapSvgLayoutState => ({
  centers,
  clusterRadius: 100,
  viewBox: { x: 0, y: 0, width: 800, height: 600 }
})

const sectorA: Sector = {
  id: 'sector_a',
  cluster_id: 'cluster_a',
  normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
  cluster_gates: {
    gate_to_b: { raw_local_pos: { sx: 0.9, sy: 0 }, target_cluster_id: 'cluster_b' }
  }
}

const sectorB: Sector = {
  id: 'sector_b',
  cluster_id: 'cluster_b',
  normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
  cluster_gates: {
    gate_to_a: { raw_local_pos: { sx: -0.9, sy: 0 }, target_cluster_id: 'cluster_a' }
  }
}

const clusters = computed<Record<string, Cluster>>(() => ({
  cluster_a: { id: 'cluster_a', sectors: ['sector_a'] },
  cluster_b: { id: 'cluster_b', sectors: ['sector_b'] }
}))

const sectors = computed<Record<string, Sector>>(() => ({
  sector_a: sectorA,
  sector_b: sectorB
}))

const regionIds = computed(() => ['cluster_a', 'cluster_b'])
const resolveOwnerColor = vi.fn().mockReturnValue('#666666')

describe('map highway ring gate highlighting', () => {
  it('marks a cross-cluster gate line as highway ring only when both endpoints are ring gates', () => {
    const bothEndpoints = useMapSvgLinks({
      clusters,
      sectors,
      regionIds,
      layoutState: computed(() => layoutState({ cluster_a: { x: 200, y: 300 }, cluster_b: { x: 600, y: 300 } })),
      resolveOwnerColor,
      stargateVisualScale: 1.5,
      highwayRings: computed(() => [{
        sectorId: 'sector_a',
        highwayIds: ['highway_a'],
        lengthKm: 10,
        maxJoinDistanceM: 0,
        gateMatches: [{ gateId: 'gate_to_b', targetClusterId: 'cluster_b', highwayId: 'highway_a', portKind: 'entry', distanceM: 500 }]
      }, {
        sectorId: 'sector_b',
        highwayIds: ['highway_b'],
        lengthKm: 10,
        maxJoinDistanceM: 0,
        gateMatches: [{ gateId: 'gate_to_a', targetClusterId: 'cluster_a', highwayId: 'highway_b', portKind: 'entry', distanceM: 500 }]
      }])
    }).crossClusterGateLines

    expect(bothEndpoints.value).toHaveLength(1)
    expect(bothEndpoints.value[0]!.isHighwayRingGate).toBe(true)

    const oneEndpoint = useMapSvgLinks({
      clusters,
      sectors,
      regionIds,
      layoutState: computed(() => layoutState({ cluster_a: { x: 200, y: 300 }, cluster_b: { x: 600, y: 300 } })),
      resolveOwnerColor,
      stargateVisualScale: 1.5,
      highwayRings: computed(() => [{
        sectorId: 'sector_a',
        highwayIds: ['highway_a'],
        lengthKm: 10,
        maxJoinDistanceM: 0,
        gateMatches: [{ gateId: 'gate_to_b', targetClusterId: 'cluster_b', highwayId: 'highway_a', portKind: 'entry', distanceM: 500 }]
      }])
    }).crossClusterGateLines

    expect(oneEndpoint.value).toHaveLength(1)
    expect(oneEndpoint.value[0]!.isHighwayRingGate).toBe(false)
  })
})
