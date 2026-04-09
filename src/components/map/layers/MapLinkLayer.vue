<script setup lang="ts">
import jumpgateIconUrl from '@/components/icons/jumpgate.svg'
import superhighwayIconUrl from '@/components/icons/superhighway.svg'
import {
  getMapCrossLinkStrokeWidth,
  getMapGateIconDiameter,
  getMapSuperhighwayEndpointIconOffset,
  getMapSuperhighwayEndpointIconSize
} from '@/components/map/utils/mapIconConfig'
import type {
  MapCrossClusterGateLine,
  MapGateCircle,
  MapHighwaySegment,
  MapSectorLinkLine
} from '@/composables/useMapSvgLinks'

defineProps<{
  sectorLinkLines: MapSectorLinkLine[]
  highwaySegments: MapHighwaySegment[]
  gateCircles: MapGateCircle[]
  crossClusterGateLines: MapCrossClusterGateLine[]
  stargateVisualScale: number
  visible?: boolean
}>()
</script>

<template>
  <g v-if="visible !== false" class="sector-links">
    <template v-for="link in sectorLinkLines" :key="link.id">
      <line
        :x1="link.start.x.toFixed(1)"
        :y1="link.start.y.toFixed(1)"
        :x2="link.end.x.toFixed(1)"
        :y2="link.end.y.toFixed(1)"
        stroke="#1d4ed8"
        stroke-width="0.4"
        stroke-opacity="0.95"
      />
      <image
        :href="superhighwayIconUrl"
        :x="(link.start.x - getMapSuperhighwayEndpointIconOffset(stargateVisualScale, 'start')).toFixed(1)"
        :y="(link.start.y - getMapSuperhighwayEndpointIconOffset(stargateVisualScale, 'start')).toFixed(1)"
        :width="getMapSuperhighwayEndpointIconSize(stargateVisualScale, 'start').toFixed(1)"
        :height="getMapSuperhighwayEndpointIconSize(stargateVisualScale, 'start').toFixed(1)"
        preserveAspectRatio="xMidYMid meet"
      />
      <image
        :href="superhighwayIconUrl"
        :x="(link.end.x - getMapSuperhighwayEndpointIconOffset(stargateVisualScale, 'end')).toFixed(1)"
        :y="(link.end.y - getMapSuperhighwayEndpointIconOffset(stargateVisualScale, 'end')).toFixed(1)"
        :width="getMapSuperhighwayEndpointIconSize(stargateVisualScale, 'end').toFixed(1)"
        :height="getMapSuperhighwayEndpointIconSize(stargateVisualScale, 'end').toFixed(1)"
        preserveAspectRatio="xMidYMid meet"
      />
    </template>
  </g>

  <g v-if="visible !== false" class="highways">
    <template v-for="segment in highwaySegments" :key="segment.id">
      <path
        v-if="segment.type === 'path'"
        :d="segment.d"
        fill="none"
        stroke="#0ea5e9"
        stroke-width="0.45"
        stroke-opacity="0.92"
      />
      <line
        v-else
        :x1="segment.start?.x.toFixed(1)"
        :y1="segment.start?.y.toFixed(1)"
        :x2="segment.end?.x.toFixed(1)"
        :y2="segment.end?.y.toFixed(1)"
        stroke="#0ea5e9"
        stroke-width="0.45"
        stroke-opacity="0.92"
      />
    </template>
  </g>

  <g v-if="visible !== false" class="gates">
    <image
      v-for="gate in gateCircles"
      :key="gate.id"
      class="gate-circle"
      :data-gate-id="gate.id"
      :data-cluster-id="gate.clusterId"
      :href="jumpgateIconUrl"
      :x="(gate.point.x - getMapGateIconDiameter(gate.r) / 2).toFixed(1)"
      :y="(gate.point.y - getMapGateIconDiameter(gate.r) / 2).toFixed(1)"
      :width="getMapGateIconDiameter(gate.r).toFixed(1)"
      :height="getMapGateIconDiameter(gate.r).toFixed(1)"
      preserveAspectRatio="xMidYMid meet"
    />
  </g>

  <g v-if="visible !== false" class="cross-links">
    <line
      v-for="line in crossClusterGateLines"
      :key="line.id"
      class="gate-path"
      :data-gate-line-id="line.id"
      :x1="line.left.x.toFixed(1)"
      :y1="line.left.y.toFixed(1)"
      :x2="line.right.x.toFixed(1)"
      :y2="line.right.y.toFixed(1)"
      stroke="#e5e7eb"
      :stroke-width="getMapCrossLinkStrokeWidth(stargateVisualScale).toFixed(2)"
      stroke-opacity="0.85"
    />
  </g>
</template>
