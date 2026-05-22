<script setup lang="ts">
import { computed } from 'vue'
import { hexPoints } from '@/components/map/utils/geometry'
import { SMALL_ICON_SIZE } from '@/components/map/utils/style'
import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { PlacementOverlay, PlacementPreview } from '@/components/map/types'

const props = defineProps<{
  overlayScreenItems: Array<PlacementOverlay & { x: number; y: number; color?: string; factionFilterId?: string | null; iconSize?: number }>
  previewScreenItem: (PlacementPreview & { x: number; y: number; color?: string; factionFilterId?: string | null; iconSize?: number }) | null
  savePoiScreenItems: Array<SavePoiOverlayItem & { x: number; y: number; color: string; factionFilterId: string | null; iconSize?: number }>
  draggingOverlayKey: string | null
  focusedOverlayKey: string | null
  focusedSavePoiKey: string | null
  overlayIconSize: number
  previewIconSize: number
  placementIconHref: (icon: 'factory' | 'shipyard' | 'tradestation') => string
  getSavePoiIconUrl: (poi: SavePoiOverlayItem) => string | null
}>()

const emit = defineEmits<{
  (e: 'overlay-pointerdown', payload: PlacementOverlay & { x: number; y: number }): void
  (e: 'save-poi-pointerdown', payload: SavePoiOverlayItem & { x: number; y: number; color: string; factionFilterId: string | null; iconSize?: number }): void
}>()

const normalPoiItems = computed(() => props.savePoiScreenItems.filter(poi => poi.key !== props.focusedSavePoiKey))
const focusedPoiItem = computed(() => props.savePoiScreenItems.find(poi => poi.key === props.focusedSavePoiKey))
const SAVE_POI_HEX_RADIUS_RATIO = 53.268 / 128
const SAVE_POI_HEX_BORDER_RATIO = 4 / 128
const BINDING_OUTLINE_OFFSET = 0.8
const bindingHexPoints = (iconSize: number) =>
  hexPoints(0, 0, iconSize * SAVE_POI_HEX_RADIUS_RATIO + BINDING_OUTLINE_OFFSET)
const bindingOutlineStrokeWidth = (iconSize: number) =>
  Number((iconSize * SAVE_POI_HEX_BORDER_RATIO).toFixed(3))
</script>

<template>
  <g class="station-overlays">
    <g
      v-for="overlay in overlayScreenItems"
      :key="overlay.key"
      class="placement-overlay"
      :class="{
        dragging: draggingOverlayKey === overlay.key,
        focused: focusedOverlayKey === overlay.key,
        'placement-overlay--draggable': overlay.draggable,
        'placement-overlay--static': overlay.draggable === false,
        'placement-overlay--binding': !!overlay.savePoiVisual
      }"
      :transform="`translate(${overlay.x.toFixed(1)} ${overlay.y.toFixed(1)})`"
      :data-placement-key="overlay.key"
      @mousedown.stop="emit('overlay-pointerdown', overlay)"
    >
      <template v-if="overlay.savePoiVisual">
        <polygon
          class="binding-outline"
          :points="bindingHexPoints(overlay.iconSize || SMALL_ICON_SIZE)"
          :stroke="overlay.color || '#fbbf24'"
          :stroke-width="bindingOutlineStrokeWidth(overlay.iconSize || SMALL_ICON_SIZE)"
        />
        <image
          v-if="getSavePoiIconUrl(overlay.savePoiVisual)"
          :href="getSavePoiIconUrl(overlay.savePoiVisual)!"
          :x="(-(overlay.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :y="(-(overlay.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :width="overlay.iconSize || SMALL_ICON_SIZE"
          :height="overlay.iconSize || SMALL_ICON_SIZE"
          :filter="overlay.factionFilterId ? `url(#${overlay.factionFilterId})` : undefined"
          preserveAspectRatio="xMidYMid meet"
        />
        <circle v-else cx="0" cy="0" r="5" :fill="overlay.color" stroke="#fff" stroke-width="1" />
      </template>
      <template v-else>
        <image
          :href="placementIconHref(overlay.icon)"
          :x="(-overlayIconSize / 2).toFixed(1)"
          :y="(-overlayIconSize / 2).toFixed(1)"
          :width="overlayIconSize"
          :height="overlayIconSize"
          preserveAspectRatio="xMidYMid meet"
        />
        <text x="0" y="-12" text-anchor="middle">{{ overlay.name }}</text>
      </template>
    </g>
    <g
      v-if="previewScreenItem"
      class="placement-preview"
      :class="{ 'placement-preview--binding': !!previewScreenItem.savePoiVisual }"
      :transform="`translate(${previewScreenItem.x.toFixed(1)} ${previewScreenItem.y.toFixed(1)})`"
    >
      <template v-if="previewScreenItem.savePoiVisual">
        <polygon
          class="binding-outline"
          :points="bindingHexPoints(previewScreenItem.iconSize || SMALL_ICON_SIZE)"
          :stroke="previewScreenItem.color || '#fbbf24'"
          :stroke-width="bindingOutlineStrokeWidth(previewScreenItem.iconSize || SMALL_ICON_SIZE)"
        />
        <image
          v-if="getSavePoiIconUrl(previewScreenItem.savePoiVisual)"
          :href="getSavePoiIconUrl(previewScreenItem.savePoiVisual)!"
          :x="(-(previewScreenItem.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :y="(-(previewScreenItem.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :width="previewScreenItem.iconSize || SMALL_ICON_SIZE"
          :height="previewScreenItem.iconSize || SMALL_ICON_SIZE"
          :filter="previewScreenItem.factionFilterId ? `url(#${previewScreenItem.factionFilterId})` : undefined"
          preserveAspectRatio="xMidYMid meet"
        />
        <circle v-else cx="0" cy="0" r="5" :fill="previewScreenItem.color" stroke="#fff" stroke-width="1" />
      </template>
      <template v-else>
        <image
          :href="placementIconHref(previewScreenItem.icon)"
          :x="(-previewIconSize / 2).toFixed(1)"
          :y="(-previewIconSize / 2).toFixed(1)"
          :width="previewIconSize"
          :height="previewIconSize"
          preserveAspectRatio="xMidYMid meet"
        />
        <text x="0" y="-13" text-anchor="middle">{{ previewScreenItem.name }}</text>
      </template>
    </g>
  </g>

  <g class="save-poi-overlays">
    <g
      v-for="poi in normalPoiItems"
      :key="poi.key"
      class="save-poi-marker"
      :transform="`translate(${poi.x.toFixed(1)} ${poi.y.toFixed(1)})`"
      :data-save-poi-key="poi.key"
      @mousedown.stop="emit('save-poi-pointerdown', poi)"
    >
      <g class="save-poi-icon">
        <image
          v-if="getSavePoiIconUrl(poi)"
          :href="getSavePoiIconUrl(poi)!"
          :x="(-(poi.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :y="(-(poi.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :width="poi.iconSize || SMALL_ICON_SIZE"
          :height="poi.iconSize || SMALL_ICON_SIZE"
          :filter="poi.factionFilterId ? `url(#${poi.factionFilterId})` : undefined"
          preserveAspectRatio="xMidYMid meet"
        />
        <circle v-else cx="0" cy="0" r="5" :fill="poi.color" stroke="#fff" stroke-width="1" />
      </g>
    </g>
    <g
      v-if="focusedPoiItem"
      class="save-poi-marker focused"
      :transform="`translate(${focusedPoiItem.x.toFixed(1)} ${focusedPoiItem.y.toFixed(1)})`"
      :data-save-poi-key="focusedPoiItem.key"
      @mousedown.stop="emit('save-poi-pointerdown', focusedPoiItem)"
    >
      <g class="save-poi-icon">
        <image
          v-if="getSavePoiIconUrl(focusedPoiItem)"
          :href="getSavePoiIconUrl(focusedPoiItem)!"
          :x="(-(focusedPoiItem.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :y="(-(focusedPoiItem.iconSize || SMALL_ICON_SIZE) / 2).toFixed(1)"
          :width="focusedPoiItem.iconSize || SMALL_ICON_SIZE"
          :height="focusedPoiItem.iconSize || SMALL_ICON_SIZE"
          :filter="focusedPoiItem.factionFilterId ? `url(#${focusedPoiItem.factionFilterId})` : undefined"
          preserveAspectRatio="xMidYMid meet"
        />
        <circle v-else cx="0" cy="0" r="5" :fill="focusedPoiItem.color" stroke="#fff" stroke-width="1" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.placement-overlay {
  pointer-events: auto;
  cursor: pointer;
}

.placement-overlay--draggable {
  cursor: grab;
}

.placement-overlay--static {
  cursor: default;
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
  opacity: 0.92;
}

.binding-outline {
  fill: none;
  stroke-dasharray: 2.2 0.9;
  stroke-linecap: butt;
  stroke-linejoin: round;
  opacity: 0.95;
}

.placement-overlay--binding.dragging {
  opacity: 0.3;
}

.save-poi-marker {
  pointer-events: auto;
  cursor: pointer;
}

.save-poi-marker.focused .save-poi-icon {
  filter:
    drop-shadow(0 0 4px rgba(253, 230, 138, 0.95))
    drop-shadow(0 0 10px rgba(245, 158, 11, 0.7));
}
</style>
