<script setup lang="ts">
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

defineProps<{
  clusterPolygons: MapSectorPolygonCluster[]
  sectorGroupColorMap?: Record<string, string>
  hexPoints: (cx: number, cy: number, radius: number) => string
}>()
</script>

<template>
  <g class="sector-group-color-layer">
    <template v-for="cluster in clusterPolygons" :key="cluster.id">
      <template v-for="sector in cluster.sectors" :key="`${cluster.id}-${sector.id}`">
        <polygon
          v-if="sectorGroupColorMap && sectorGroupColorMap[sector.id]"
          :points="hexPoints(sector.sx, sector.sy, sector.radius * 2 / 3)"
          :fill="sectorGroupColorMap[sector.id]"
          fill-opacity="0.35"
          stroke="none"
        />
      </template>
    </template>
  </g>
</template>
