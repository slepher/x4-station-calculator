<script setup lang="ts">
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

defineProps<{
  clusterPolygons: MapSectorPolygonCluster[]
  hexPoints: (cx: number, cy: number, radius: number) => string
  sectorFillColor: (sectorId: string, defaultColor: string) => string
  sectorFillOpacity: (sectorId: string) => number
}>()
</script>

<template>
  <g class="sector-fill-layer">
    <template v-for="cluster in clusterPolygons" :key="cluster.id">
      <template v-if="cluster.sectors.length === 1">
        <polygon
          :points="hexPoints(cluster.sectors[0]?.sx || cluster.cx, cluster.sectors[0]?.sy || cluster.cy, cluster.sectors[0]?.radius || cluster.singleRadius || 0)"
          :fill="sectorFillColor(cluster.sectors[0]?.id || '', cluster.sectors[0]?.color || cluster.color)"
          :fill-opacity="sectorFillOpacity(cluster.sectors[0]?.id || '')"
          stroke="none"
          class="sector-polygon-fill"
          :data-sector-fill-id="cluster.sectors[0]?.id || ''"
          :data-cluster-id="cluster.id"
        />
      </template>
      <template v-else>
        <polygon
          v-for="sector in cluster.sectors"
          :key="`${cluster.id}-${sector.id}`"
          :points="hexPoints(sector.sx, sector.sy, sector.radius)"
          :fill="sectorFillColor(sector.id, sector.color)"
          :fill-opacity="sectorFillOpacity(sector.id)"
          stroke="none"
          class="sector-polygon-fill"
          :data-sector-fill-id="sector.id"
          :data-cluster-id="cluster.id"
        />
      </template>
    </template>
  </g>
</template>
