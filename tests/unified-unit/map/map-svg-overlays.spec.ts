/**
 * @vitest-environment jsdom
 */
import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useMapSvgOverlays } from '@/composables/useMapSvgOverlays'

const sectorsFromClusters = (clusters: ReturnType<typeof computed<Record<string, any>>>) =>
  computed(() =>
    Object.fromEntries(
      Object.values(clusters.value).flatMap((cluster: any) =>
        Object.values(cluster.sectors || {}).map((sector: any) => [sector.id, sector])
      )
    )
  )

const clustersForMap = (clusters: ReturnType<typeof computed<Record<string, any>>>) =>
  computed(() =>
    Object.fromEntries(
      Object.entries(clusters.value).map(([clusterId, cluster]: [string, any]) => [
        clusterId,
        {
          ...cluster,
          sectors: Array.isArray(cluster.sectors) ? cluster.sectors : Object.keys(cluster.sectors || {})
        }
      ])
    )
  )

describe('useMapSvgOverlays save POI culling', () => {
  it('keeps only save POIs inside the viewport content bounds', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 1
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const savePoiOverlays = ref([
      {
        key: 'poi-in',
        code: 'IN',
        category: 'datavault' as const,
        sectorMacro: 'sector_alpha_macro',
        sectorName: 'Alpha',
        position: { x: 0, z: 0, tx: 0, ty: 0 }
      },
      {
        key: 'poi-out',
        code: 'OUT',
        category: 'datavault' as const,
        sectorMacro: 'sector_alpha_macro',
        sectorName: 'Alpha',
        position: { x: 0, z: 0, tx: 8, ty: 0 }
      }
    ])

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays,
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.6),
      maxScale: ref(1.2),
      currentScale: ref(1),
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(false),
      factionColorMap: ref(undefined)
    })

    expect(overlays.savePoiScreenItems.value.map((item) => item.key)).toEqual(['poi-in'])
  })

  it('keeps save POIs visible while dragging when they are present in the source data', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 1
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays: ref([
        {
          key: 'npc-large',
          code: 'LARGE',
          category: 'npcStation' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 },
          tag: 'shipyard'
        },
        {
          key: 'vault',
          code: 'DV',
          category: 'datavault' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 }
        }
      ]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.6),
      maxScale: ref(1.2),
      currentScale: ref(1),
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(true),
      factionColorMap: ref(undefined)
    })

    expect(overlays.savePoiScreenItems.value.map((item) => item.key)).toEqual(['npc-large', 'vault'])
  })

  it('treats player headquarter POIs as large icons', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 1
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays: ref([{
        key: 'player-hq',
        code: 'HQ',
        category: 'playerStation' as const,
        owner: 'player',
        is_headquarter: true,
        sectorMacro: 'sector_alpha_macro',
        sectorName: 'Alpha',
        position: { x: 0, z: 0, tx: 0, ty: 0 }
      }]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.6),
      maxScale: ref(1.2),
      currentScale: ref(1),
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(false),
      factionColorMap: ref(undefined)
    })

    expect((overlays.savePoiScreenItems.value[0]?.iconSize || 0)).toBeGreaterThan(6)
  })

  it('uses special fixed size for abandoned ships and vaults', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 1
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays: ref([
        {
          key: 'abandoned',
          code: 'ABN',
          category: 'abandonedShip' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 }
        },
        {
          key: 'vault',
          code: 'DVA',
          category: 'datavault' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 }
        }
      ]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.6),
      maxScale: ref(1.2),
      currentScale: ref(1),
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(false),
      factionColorMap: ref(undefined)
    })

    expect(overlays.savePoiScreenItems.value.map((item) => item.iconSize)).toEqual([8, 8])
  })

  it('builds faction color filters for visible save POI owners', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 0.5
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays: ref([
        {
          key: 'xen',
          code: 'XEN',
          category: 'xenonStation' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 },
          owner: 'xenon',
          tag: 'shipyard'
        },
        {
          key: 'kha',
          code: 'KHA',
          category: 'khaakStation' as const,
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0, tx: 0, ty: 0 },
          owner: 'khaak',
          tag: 'hive'
        }
      ]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.6),
      maxScale: ref(1.2),
      currentScale: ref(1),
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(250),
      isDragging: ref(false),
      factionColorMap: ref({
        xenon: '#ff0000',
        khaak: '#00ff00'
      })
    })

    expect(overlays.factionColorFilters.value).toHaveLength(2)
    expect(overlays.savePoiScreenItems.value.map((item) => item.factionFilterId)).toEqual([
      'faction-color-ff0000',
      'faction-color-00ff00'
    ])
  })

  it('keeps large icons at half cluster up to scale 0.5, then smoothly shrinks to 10xscale on screen at max scale', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 0.6
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))
    const currentScale = ref(0.4)
    const minScale = ref(0.4)
    const maxScale = ref(1.2)

    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([]),
      placementPreview: ref(null),
      savePoiOverlays: ref([{
        key: 'npc-large',
        code: 'LARGE',
        category: 'npcStation' as const,
        sectorMacro: 'sector_alpha_macro',
        sectorName: 'Alpha',
        position: { x: 0, z: 0, tx: 0, ty: 0 },
        tag: 'shipyard'
      }]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale,
      maxScale,
      currentScale,
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(false),
      factionColorMap: ref(undefined)
    })

    const scale04Size = overlays.savePoiScreenItems.value[0]?.iconSize
    currentScale.value = 0.5
    const scale05Size = overlays.savePoiScreenItems.value[0]?.iconSize
    currentScale.value = 0.85
    const midSize = overlays.savePoiScreenItems.value[0]?.iconSize
    currentScale.value = 1.2
    const maxScaleSize = overlays.savePoiScreenItems.value[0]?.iconSize

    expect((scale04Size || 0) * 0.4).toBeCloseTo(100 * 0.4, 1)
    expect((scale05Size || 0) * 0.5).toBeCloseTo(100 * 0.5, 1)
    expect(midSize).toBeLessThan(scale05Size || 0)
    expect(midSize).toBeGreaterThan(10)
    expect((maxScaleSize || 0) * 1.2).toBeCloseTo(10 * 1.2, 1)
  })

  it('freezes binding non-hub large icon map size below the configured scale', () => {
    const clusters = computed(() => ({
      cluster_01: {
        id: 'cluster_01',
        normalized: { pixel_basis: { x: 0, y: 0 } },
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            macro: 'sector_alpha_macro',
            normalized: {
              center_offset_ratio: { x: 0, y: 0 },
              sector_radius_ratio: 0.6
            }
          }
        }
      }
    }))

    const layoutState = computed(() => ({
      cfg: { width: 1000, height: 1000, padX: 0, padY: 0, topPad: 0 },
      fit: { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      centers: {
        cluster_01: { x: 500, y: 500 }
      },
      clusterRadius: 100
    }))

    const currentScale = ref(0.7)
    const overlays = useMapSvgOverlays({
      clusters: clustersForMap(clusters),
      sectors: sectorsFromClusters(clusters),
      layoutState,
      placementOverlays: ref([{
        key: 'binding:station:factory',
        id: 'factory',
        kind: 'station' as const,
        name: 'Factory',
        icon: 'factory' as const,
        location: {
          cluster_id: 'cluster_01',
          sector_id: 'sector_alpha',
          pos: { x: 0, z: 0 },
          sunlight: 0,
          resources: []
        },
        localRatio: { x: 0, y: 0 },
        savePoiVisual: {
          key: 'binding:station:factory',
          code: 'Factory',
          category: 'playerStation' as const,
          owner: 'player',
          sectorMacro: 'sector_alpha_macro',
          sectorName: 'Alpha',
          position: { x: 0, z: 0 },
          tag: 'shipyard',
          largeIconFreezeBelowScale: 0.8
        }
      }]),
      placementPreview: ref(null),
      savePoiOverlays: ref([]),
      viewportContentBounds: ref({
        left: 350,
        top: 350,
        right: 650,
        bottom: 650
      }),
      minScale: ref(0.4),
      maxScale: ref(1.2),
      currentScale,
      zoomProgress: ref(0),
      clusterVisibilityThresholdPx: ref(0),
      isDragging: ref(false),
      factionColorMap: ref(undefined)
    })

    const iconSize = overlays.overlayScreenItems.value[0]?.iconSize || 0
    expect(iconSize * 0.8).toBeCloseTo(33.714, 1)
    expect(iconSize * currentScale.value).toBeCloseTo(29.5, 1)
  })
})
