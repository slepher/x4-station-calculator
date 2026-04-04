<script setup lang="ts">
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
}>()
</script>

<template>
  <g class="sector-links">
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
    </template>
  </g>

  <g class="highways">
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

  <g class="gates" />

  <g class="cross-links">
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
      :stroke-width="(0.6 * stargateVisualScale).toFixed(2)"
      stroke-opacity="0.85"
    />
  </g>
</template>
