<script setup lang="ts">
import { computed } from 'vue'
import jumpgateIconUrl from '@/components/icons/jumpgate.svg'
import superhighwayIconUrl from '@/components/icons/superhighway.svg'
import type { MapGateCircle, MapSectorLinkLine } from '@/composables/useMapSvgLinks'

const props = defineProps<{
  sectorLinkLines: MapSectorLinkLine[]
  gateCircles: MapGateCircle[]
  screenScale: number
  panX: number
  panY: number
  stargateVisualScale: number
}>()

const screenSectorLinkIcons = computed(() => {
  return props.sectorLinkLines.flatMap((link) => {
    const startSize = 4.2 * props.stargateVisualScale * props.screenScale
    const endSize = 3.15 * props.stargateVisualScale * props.screenScale
    return [
      {
        id: `${link.id}:start`,
        x: link.start.x * props.screenScale + props.panX,
        y: link.start.y * props.screenScale + props.panY,
        size: startSize
      },
      {
        id: `${link.id}:end`,
        x: link.end.x * props.screenScale + props.panX,
        y: link.end.y * props.screenScale + props.panY,
        size: endSize
      }
    ]
  })
})

const screenGateIcons = computed(() => {
  return props.gateCircles.map((gate) => ({
    ...gate,
    x: gate.point.x * props.screenScale + props.panX,
    y: gate.point.y * props.screenScale + props.panY,
    size: gate.r * 6 * props.screenScale
  }))
})
</script>

<template>
  <div class="map-link-icon-screen-layer">
    <img
      v-for="icon in screenSectorLinkIcons"
      :key="icon.id"
      class="superhighway-icon"
      :src="superhighwayIconUrl"
      alt=""
      :style="{
        left: `${icon.x.toFixed(1)}px`,
        top: `${icon.y.toFixed(1)}px`,
        width: `${icon.size.toFixed(1)}px`,
        height: `${icon.size.toFixed(1)}px`
      }"
      draggable="false"
    >
    <img
      v-for="gate in screenGateIcons"
      :key="gate.id"
      class="gate-circle"
      :data-gate-id="gate.id"
      :data-cluster-id="gate.clusterId"
      :src="jumpgateIconUrl"
      alt=""
      :style="{
        left: `${gate.x.toFixed(1)}px`,
        top: `${gate.y.toFixed(1)}px`,
        width: `${gate.size.toFixed(1)}px`,
        height: `${gate.size.toFixed(1)}px`
      }"
      draggable="false"
    >
  </div>
</template>

<style scoped>
.map-link-icon-screen-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.superhighway-icon,
.gate-circle {
  position: absolute;
  display: block;
  transform: translate(-50%, -50%);
  user-select: none;
}
</style>
