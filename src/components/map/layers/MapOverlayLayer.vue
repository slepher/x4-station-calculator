<script setup lang="ts">
import type { PlacementOverlay, PlacementPreview } from '@/components/map/types'

const props = defineProps<{
  overlayScreenItems: Array<PlacementOverlay & { x: number; y: number }>
  previewScreenItem: (PlacementPreview & { x: number; y: number }) | null
  draggingOverlayKey: string | null
  focusedOverlayKey: string | null
  overlayIconSize: number
  previewIconSize: number
  placementIconHref: (icon: 'factory' | 'shipyard' | 'tradestation') => string
}>()

const emit = defineEmits<{
  (e: 'overlay-pointerdown', payload: PlacementOverlay & { x: number; y: number }): void
}>()
</script>

<template>
  <g class="station-overlays">
    <g
      v-for="overlay in overlayScreenItems"
      :key="overlay.key"
      class="placement-overlay"
      :class="{ dragging: draggingOverlayKey === overlay.key, focused: focusedOverlayKey === overlay.key }"
      :transform="`translate(${overlay.x.toFixed(1)} ${overlay.y.toFixed(1)})`"
      :data-placement-key="overlay.key"
      @mousedown.stop="emit('overlay-pointerdown', overlay)"
    >
      <image
        :href="placementIconHref(overlay.icon)"
        :x="(-overlayIconSize / 2).toFixed(1)"
        :y="(-overlayIconSize / 2).toFixed(1)"
        :width="overlayIconSize"
        :height="overlayIconSize"
        preserveAspectRatio="xMidYMid meet"
      />
      <text x="0" y="-12" text-anchor="middle">{{ overlay.name }}</text>
    </g>
    <g
      v-if="previewScreenItem"
      class="placement-preview"
      :transform="`translate(${previewScreenItem.x.toFixed(1)} ${previewScreenItem.y.toFixed(1)})`"
    >
      <image
        :href="placementIconHref(previewScreenItem.icon)"
        :x="(-previewIconSize / 2).toFixed(1)"
        :y="(-previewIconSize / 2).toFixed(1)"
        :width="previewIconSize"
        :height="previewIconSize"
        preserveAspectRatio="xMidYMid meet"
      />
      <text x="0" y="-13" text-anchor="middle">{{ previewScreenItem.name }}</text>
    </g>
  </g>

</template>

<style scoped>
.placement-overlay {
  pointer-events: auto;
  cursor: grab;
}

.placement-overlay image,
.placement-preview image {
  overflow: visible;
}

.placement-overlay.dragging {
  opacity: 0.18;
  pointer-events: none;
}

.placement-overlay.focused image {
  filter:
    drop-shadow(0 0 4px rgba(253, 230, 138, 0.95))
    drop-shadow(0 0 10px rgba(245, 158, 11, 0.7));
}

.placement-overlay.focused text {
  fill: #fff7d6;
}

.placement-overlay text,
.placement-preview text {
  fill: #fef3c7;
  font-size: 10px;
  font-family: Consolas, 'Courier New', monospace;
}

.placement-preview {
  pointer-events: none;
}
</style>
