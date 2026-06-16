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
      <template v-if="cluster.sectors.length === 1">
        <polygon
          v-if="sectorGroupColorMap && sectorGroupColorMap[cluster.sectors[0]?.id || '']"
          :points="hexPoints(cluster.sectors[0]?.sx || cluster.cx, cluster.sectors[0]?.sy || cluster.cy, cluster.sectors[0]?.radius || 0)"
          :fill="sectorGroupColorMap[cluster.sectors[0]?.id || '']"
          fill-opacity="0.35"
          stroke="none"
        />
      </template>
      <template v-else>
        <polygon
          v-for="sector in cluster.sectors"
          :key="`${cluster.id}-${sector.id}`"
          v-show="sectorGroupColorMap && sectorGroupColorMap[sector.id]"
          :points="hexPoints(sector.sx, sector.sy, sector.radius)"
          :fill="sectorGroupColorMap?.[sector.id] || ''"
          fill-opacity="0.35"
          stroke="none"
        />
      </template>
    </template>
  </g>
</template>
