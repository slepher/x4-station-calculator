/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import { describe, expect, it } from 'vitest'
import MapLinkLayer from '@/components/map/layers/MapLinkLayer.vue'
import { useMapSvgLinks } from '@/composables/useMapSvgLinks'
import type { Cluster, Sector } from '@/components/map/types'
import type { MapSvgLayoutState } from '@/composables/useMapSvgLayout'

const CLUSTER_15 = 'cluster_15_macro'
const CLUSTER_408 = 'cluster_408_macro'
const SECTOR_15 = 'cluster_15_sector002_macro'
const SECTOR_408 = 'cluster_408_sector001_macro'
const GATE_15 = 'connection_clustergate015to408'
const GATE_408 = 'connection_clustergate408to015'
const LINE_ID = `${CLUSTER_15}:${SECTOR_15}:${GATE_15}<->${CLUSTER_408}:${SECTOR_408}:${GATE_408}`

const allClusters = computed<Record<string, Cluster>>(() => ({
  [CLUSTER_15]: { id: CLUSTER_15, sectors: [SECTOR_15] },
  [CLUSTER_408]: { id: CLUSTER_408, sectors: [SECTOR_408] }
}))

const sectors = computed<Record<string, Sector>>(() => ({
  [SECTOR_15]: {
    id: SECTOR_15,
    cluster_id: CLUSTER_15,
    normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
    cluster_gates: {
      [GATE_15]: { raw_local_pos: { sx: 0.9, sy: 0 }, target_cluster_id: CLUSTER_408 }
    }
  },
  [SECTOR_408]: {
    id: SECTOR_408,
    cluster_id: CLUSTER_408,
    normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
    cluster_gates: {
      [GATE_408]: { raw_local_pos: { sx: -0.9, sy: 0 }, target_cluster_id: CLUSTER_15 }
    }
  }
}))

const layoutState = computed<MapSvgLayoutState>(() => ({
  cfg: { width: 800, height: 600, padX: 0, padY: 0, topPad: 0 },
  fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
  centers: {
    [CLUSTER_15]: { x: 200, y: 300 },
    [CLUSTER_408]: { x: 600, y: 300 }
  },
  clusterRadius: 100
}))

const visibleBaseCluster = computed<Record<string, Cluster>>(() => ({
  [CLUSTER_15]: allClusters.value[CLUSTER_15]!
}))

const noVisibleClusters = computed<Record<string, Cluster>>(() => ({}))

function gateLines(clusters: typeof visibleBaseCluster, regionIds: string[]) {
  return useMapSvgLinks({
    clusters,
    allClusters,
    sectors,
    regionIds: computed(() => regionIds),
    layoutState,
    resolveOwnerColor: () => '#666666',
    stargateVisualScale: 1.5
  }).crossClusterGateLines
}

describe('map DLC gate retention', () => {
  it('keeps the cluster 15 to filtered cluster 408 gate line with the native style', () => {
    const lines = gateLines(visibleBaseCluster, [CLUSTER_15])

    expect(lines.value).toHaveLength(1)
    expect(lines.value[0]!.id).toBe(LINE_ID)

    const wrapper = mount(MapLinkLayer, {
      props: {
        sectorLinkLines: [],
        highwaySegments: [],
        gateCircles: [],
        crossClusterGateLines: lines.value,
        stargateVisualScale: 1.5,
        renderMode: 'base',
        visible: true
      }
    })
    const renderedLine = wrapper.get(`line[data-gate-line-id="${LINE_ID}"]`)
    expect(renderedLine.attributes('stroke')).toBe('#e5e7eb')
    expect(renderedLine.attributes('stroke-dasharray')).toBeUndefined()
  })

  it('omits the gate line when neither endpoint cluster is visible', () => {
    expect(gateLines(noVisibleClusters, []).value).toHaveLength(0)
  })
})
