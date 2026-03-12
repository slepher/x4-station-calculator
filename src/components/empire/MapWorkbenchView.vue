<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import MapSvgCanvas from './MapSvgCanvas.vue'

const clusterRefHeightPx = ref(142)

const viewportRef = ref<HTMLDivElement | null>(null)

const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

const minScale = ref(1)
const maxScale = ref(4)
const scale = ref(1)
const zoomPercent = ref(0)

const panX = ref(0)
const panY = ref(0)

const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOriginX = ref(0)
const dragOriginY = ref(0)

const displayScaleText = computed(() => `${Math.round(scale.value * 100)}%`)

const getViewportSize = () => {
  const viewport = viewportRef.value
  if (!viewport) return { width: 0, height: 0 }
  return {
    width: viewport.clientWidth,
    height: viewport.clientHeight
  }
}

const clampScale = (next: number) => Math.min(maxScale.value, Math.max(minScale.value, next))

const clampPan = (nextX: number, nextY: number) => {
  const { width: vw, height: vh } = getViewportSize()
  const scaledW = imageNaturalWidth.value * scale.value
  const scaledH = imageNaturalHeight.value * scale.value

  let x = nextX
  let y = nextY

  if (scaledW <= vw) {
    x = (vw - scaledW) / 2
  } else {
    const minX = vw - scaledW
    x = Math.min(0, Math.max(minX, x))
  }

  if (scaledH <= vh) {
    y = (vh - scaledH) / 2
  } else {
    const minY = vh - scaledH
    y = Math.min(0, Math.max(minY, y))
  }

  panX.value = x
  panY.value = y
}

const applyScaleFromSlider = (value: number) => {
  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const ratio = value / 100
  const nextScale = minScale.value + (maxScale.value - minScale.value) * ratio
  const safeScale = clampScale(nextScale)

  const centerContentX = (vw * 0.5 - panX.value) / scale.value
  const centerContentY = (vh * 0.5 - panY.value) / scale.value
  scale.value = safeScale
  const nextPanX = vw * 0.5 - centerContentX * safeScale
  const nextPanY = vh * 0.5 - centerContentY * safeScale
  clampPan(nextPanX, nextPanY)
}

const syncSliderFromScale = () => {
  if (maxScale.value <= minScale.value) {
    zoomPercent.value = 0
    return
  }
  zoomPercent.value = ((scale.value - minScale.value) / (maxScale.value - minScale.value)) * 100
}

const recomputeScaleBounds = () => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  const { width: vw } = getViewportSize()
  if (!vw) return

  const nextMin = vw / imageNaturalWidth.value
  const targetHalfScreen = window.innerHeight * 0.5
  const refHeight = Math.max(1, clusterRefHeightPx.value)
  const nextMax = Math.max(nextMin, targetHalfScreen / refHeight)

  minScale.value = nextMin
  maxScale.value = nextMax
  scale.value = clampScale(scale.value || nextMin)
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onCanvasSize = async (payload: { width: number; height: number; clusterRefHeight: number }) => {
  imageNaturalWidth.value = payload.width
  imageNaturalHeight.value = payload.height
  clusterRefHeightPx.value = payload.clusterRefHeight
  await nextTick()
  recomputeScaleBounds()
  if (scale.value < minScale.value + 1e-6) {
    scale.value = minScale.value
  }
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onSliderInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  zoomPercent.value = value
  applyScaleFromSlider(value)
}

const onMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragOriginX.value = panX.value
  dragOriginY.value = panY.value
}

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  clampPan(dragOriginX.value + dx, dragOriginY.value + dy)
}

const onWheel = (event: WheelEvent) => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  event.preventDefault()

  const { width: vw, height: vh } = getViewportSize()
  if (!vw || !vh) return

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const contentX = (mouseX - panX.value) / scale.value
  const contentY = (mouseY - panY.value) / scale.value

  const zoomStep = 0.08
  const factor = event.deltaY < 0 ? (1 + zoomStep) : (1 - zoomStep)
  const nextScale = clampScale(scale.value * factor)
  if (nextScale === scale.value) return

  scale.value = nextScale
  const nextPanX = mouseX - contentX * nextScale
  const nextPanY = mouseY - contentY * nextScale
  clampPan(nextPanX, nextPanY)
  syncSliderFromScale()
}

const stopDrag = () => {
  isDragging.value = false
}

const onResize = () => {
  recomputeScaleBounds()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <section class="map-workbench mt-4">
    <div class="map-shell">
      <div
        ref="viewportRef"
        class="map-viewport"
        :class="{ dragging: isDragging }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="stopDrag"
        @mouseleave="stopDrag"
        @wheel="onWheel"
      >
        <div
          class="map-content"
          :style="{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transformOrigin: 'top left'
          }"
        >
          <MapSvgCanvas @content-size="onCanvasSize" />
        </div>
      </div>

      <div class="zoom-panel">
        <div class="zoom-label-row">
          <span class="zoom-label">Scale</span>
          <span class="zoom-value">{{ displayScaleText }}</span>
        </div>
        <input
          class="zoom-slider"
          type="range"
          min="0"
          max="100"
          step="0.5"
          :value="zoomPercent"
          @input="onSliderInput"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-workbench {
  @apply w-full;
}

.map-shell {
  @apply relative bg-black/70 rounded-lg border border-amber-300/35 p-3 overflow-hidden;
  min-height: 70vh;
}

.map-viewport {
  @apply relative w-full overflow-hidden cursor-grab;
  height: calc(70vh - 1.5rem);
  min-height: 560px;
}

.map-viewport.dragging {
  @apply cursor-grabbing;
}

.map-content {
  @apply select-none;
  will-change: transform;
}

.zoom-panel {
  @apply absolute left-6 bottom-5 z-10 rounded-md border border-amber-300/40 bg-black/70 px-3 py-2;
  width: 220px;
  backdrop-filter: blur(4px);
}

.zoom-label-row {
  @apply mb-1 flex items-center justify-between text-xs text-amber-200;
}

.zoom-label {
  @apply uppercase tracking-wider;
}

.zoom-value {
  @apply font-semibold text-amber-100;
}

.zoom-slider {
  @apply w-full accent-amber-400;
}
</style>
