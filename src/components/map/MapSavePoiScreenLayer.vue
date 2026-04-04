<script setup lang="ts">
import { computed } from 'vue'
import { SMALL_ICON_SIZE } from '@/components/map/utils/style'
import type { SavePoiOverlayItem } from '@/types/saveArchive'

type SavePoiScreenItem = SavePoiOverlayItem & {
  x: number
  y: number
  color: string
  factionFilterId: string | null
  iconSize?: number
}

const props = defineProps<{
  items: SavePoiScreenItem[]
  focusedSavePoiKey: string | null
  screenScale: number
  panX: number
  panY: number
  getSavePoiIconUrl: (poi: SavePoiOverlayItem) => string | null
}>()

const emit = defineEmits<{
  (e: 'save-poi-pointerdown', payload: SavePoiScreenItem): void
}>()

const screenItems = computed(() => {
  return props.items.map((poi) => {
    const iconSize = poi.iconSize || SMALL_ICON_SIZE
    return {
      ...poi,
      screenX: poi.x * props.screenScale + props.panX,
      screenY: poi.y * props.screenScale + props.panY,
      screenSize: iconSize * props.screenScale
    }
  })
})

const normalItems = computed(() => screenItems.value.filter((poi) => poi.key !== props.focusedSavePoiKey))
const focusedItem = computed(() => screenItems.value.find((poi) => poi.key === props.focusedSavePoiKey))
</script>

<template>
  <div class="save-poi-screen-layer">
    <button
      v-for="poi in normalItems"
      :key="poi.key"
      type="button"
      class="save-poi-marker"
      :style="{ left: `${poi.screenX.toFixed(1)}px`, top: `${poi.screenY.toFixed(1)}px` }"
      :data-save-poi-key="poi.key"
      @mousedown.stop="emit('save-poi-pointerdown', poi)"
    >
      <img
        v-if="getSavePoiIconUrl(poi)"
        class="save-poi-icon-image"
        :src="getSavePoiIconUrl(poi)!"
        :alt="poi.code || poi.sectorName || poi.key"
        :width="poi.screenSize"
        :height="poi.screenSize"
        draggable="false"
      >
      <span
        v-else
        class="save-poi-fallback-dot"
        :style="{
          width: `${Math.max(poi.screenSize, 10).toFixed(1)}px`,
          height: `${Math.max(poi.screenSize, 10).toFixed(1)}px`,
          backgroundColor: poi.color
        }"
      />
    </button>
    <button
      v-if="focusedItem"
      type="button"
      class="save-poi-marker focused"
      :style="{ left: `${focusedItem.screenX.toFixed(1)}px`, top: `${focusedItem.screenY.toFixed(1)}px` }"
      :data-save-poi-key="focusedItem.key"
      @mousedown.stop="emit('save-poi-pointerdown', focusedItem)"
    >
      <img
        v-if="getSavePoiIconUrl(focusedItem)"
        class="save-poi-icon-image"
        :src="getSavePoiIconUrl(focusedItem)!"
        :alt="focusedItem.code || focusedItem.sectorName || focusedItem.key"
        :width="focusedItem.screenSize"
        :height="focusedItem.screenSize"
        draggable="false"
      >
      <span
        v-else
        class="save-poi-fallback-dot"
        :style="{
          width: `${Math.max(focusedItem.screenSize, 10).toFixed(1)}px`,
          height: `${Math.max(focusedItem.screenSize, 10).toFixed(1)}px`,
          backgroundColor: focusedItem.color
        }"
      />
    </button>
  </div>
</template>

<style scoped>
.save-poi-screen-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.save-poi-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.save-poi-icon-image {
  display: block;
  user-select: none;
}

.save-poi-fallback-dot {
  display: block;
  border: 1px solid #fff;
  border-radius: 9999px;
}

.save-poi-marker.focused {
  filter:
    drop-shadow(0 0 4px rgba(253, 230, 138, 0.95))
    drop-shadow(0 0 10px rgba(245, 158, 11, 0.7));
}
</style>
