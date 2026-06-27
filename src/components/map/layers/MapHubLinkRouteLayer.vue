<script setup lang="ts">
import type { MapHubLinkRouteLine } from '@/composables/useMapHubLinkRoutes'

defineProps<{
  routeLines: MapHubLinkRouteLine[]
  visible?: boolean
}>()
</script>

<template>
  <g v-if="visible !== false" class="hub-link-routes">
    <template v-for="line in routeLines" :key="line.id">
      <path
        v-if="line.type === 'path'"
        class="hub-link-route-halo"
        :d="line.d"
        :stroke="line.color"
        fill="none"
        stroke-width="2.6"
        stroke-opacity="0.28"
        stroke-linecap="round"
        stroke-linejoin="round"
        shape-rendering="geometricPrecision"
      />
      <path
        v-if="line.type === 'path'"
        class="hub-link-route"
        :d="line.d"
        :stroke="line.color"
        fill="none"
        stroke-width="1.45"
        stroke-opacity="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        shape-rendering="geometricPrecision"
      />
      <line
        v-else
        class="hub-link-route-halo"
        :x1="line.start?.x.toFixed(1)"
        :y1="line.start?.y.toFixed(1)"
        :x2="line.end?.x.toFixed(1)"
        :y2="line.end?.y.toFixed(1)"
        :stroke="line.color"
        stroke-width="2.6"
        stroke-opacity="0.28"
        stroke-linecap="round"
        shape-rendering="geometricPrecision"
      />
      <line
        v-if="line.type !== 'path'"
        class="hub-link-route"
        :x1="line.start?.x.toFixed(1)"
        :y1="line.start?.y.toFixed(1)"
        :x2="line.end?.x.toFixed(1)"
        :y2="line.end?.y.toFixed(1)"
        :stroke="line.color"
        stroke-width="1.45"
        stroke-opacity="1"
        stroke-linecap="round"
        shape-rendering="geometricPrecision"
      />
    </template>
  </g>
</template>

<style scoped>
.hub-link-routes {
  pointer-events: none;
}
</style>
