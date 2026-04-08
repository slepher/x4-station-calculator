<script setup lang="ts">
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

defineProps<{
  clusterPolygons: MapSectorPolygonCluster[]
  sectorLabelFontSize: number
  mapFontFamily: string
  sectorLabelWeight: (sectorId: string) => number
  sectorLabelFill: (sectorId: string) => string
}>()
</script>

<template>
  <g class="sector-label-layer">
    <template v-for="cluster in clusterPolygons" :key="cluster.id">
      <text
        v-if="cluster.sectors.length === 1"
        class="sector-label"
        :x="(cluster.sectors[0]?.sx || cluster.cx).toFixed(1)"
        :y="(cluster.singleLabelY || cluster.sectors[0]?.labelY || 0).toFixed(1)"
        text-anchor="middle"
        dominant-baseline="text-before-edge"
        alignment-baseline="text-before-edge"
        :font-size="(cluster.singleLabelFontSize || sectorLabelFontSize).toFixed(1)"
        :font-family="mapFontFamily"
        :font-weight="sectorLabelWeight(cluster.sectors[0]?.id || '')"
        :fill="sectorLabelFill(cluster.sectors[0]?.id || '')"
        :data-cluster-id="cluster.id"
      >
        {{ cluster.singleLabel }}
      </text>

      <template v-else>
        <text
          v-for="sector in cluster.sectors"
          :key="sector.id"
          class="sector-label"
          :x="sector.sx.toFixed(1)"
          :y="sector.labelY.toFixed(1)"
          text-anchor="middle"
          dominant-baseline="text-before-edge"
          alignment-baseline="text-before-edge"
          :font-size="sector.labelFontSize.toFixed(1)"
          :font-family="mapFontFamily"
          :font-weight="sectorLabelWeight(sector.id)"
          :fill="sectorLabelFill(sector.id)"
          :data-sector-id="sector.id"
          :data-cluster-id="cluster.id"
        >
          {{ sector.label }}
        </text>
      </template>
    </template>
  </g>
</template>
