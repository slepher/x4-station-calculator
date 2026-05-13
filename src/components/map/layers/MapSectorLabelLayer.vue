<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

const props = defineProps<{
  clusterPolygons: MapSectorPolygonCluster[]
  sectorLabelFontSize: number
  mapFontFamily: string
  sectorLabelWeight: (sectorId: string) => number
  sectorLabelFill: (sectorId: string) => string
  viewportWidth: number
  viewportHeight: number
  viewBoxBounds: {
    left: number
    top: number
    width: number
    height: number
  } | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let redrawFrame: number | null = null

const effectiveViewBox = computed(() => props.viewBoxBounds || {
  left: 0,
  top: 0,
  width: props.viewportWidth || 1,
  height: props.viewportHeight || 1
})

const queueDraw = () => {
  if (redrawFrame !== null) cancelAnimationFrame(redrawFrame)
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = null
    draw()
  })
}

const drawLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight: number,
  fill: string
) => {
  const viewBox = effectiveViewBox.value
  const scaleX = props.viewportWidth / Math.max(1, viewBox.width)
  const scaleY = props.viewportHeight / Math.max(1, viewBox.height)
  const screenX = (x - viewBox.left) * scaleX
  const screenY = (y - viewBox.top) * scaleY
  const screenFontSize = Math.max(8, fontSize * scaleY)

  ctx.font = `${weight} ${screenFontSize}px ${props.mapFontFamily}`
  ctx.fillStyle = fill
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(text, screenX, screenY)
}

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas || !props.viewportWidth || !props.viewportHeight) return

  const dpr = window.devicePixelRatio || 1
  const displayWidth = Math.max(1, Math.round(props.viewportWidth))
  const displayHeight = Math.max(1, Math.round(props.viewportHeight))
  const pixelWidth = Math.round(displayWidth * dpr)
  const pixelHeight = Math.round(displayHeight * dpr)

  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  canvas.style.width = `${displayWidth}px`
  canvas.style.height = `${displayHeight}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(dpr, dpr)

  props.clusterPolygons.forEach((cluster) => {
    if (cluster.sectors.length === 1) {
      const sectorId = cluster.sectors[0]?.id || ''
      drawLabel(
        ctx,
        cluster.singleLabel || cluster.sectors[0]?.label || '',
        cluster.sectors[0]?.sx || cluster.cx,
        cluster.singleLabelY || cluster.sectors[0]?.labelY || 0,
        cluster.singleLabelFontSize || props.sectorLabelFontSize,
        props.sectorLabelWeight(sectorId),
        props.sectorLabelFill(sectorId)
      )
      return
    }

    cluster.sectors.forEach((sector) => {
      drawLabel(
        ctx,
        sector.label,
        sector.sx,
        sector.labelY,
        sector.labelFontSize,
        props.sectorLabelWeight(sector.id),
        props.sectorLabelFill(sector.id)
      )
    })
  })
}

watchEffect(() => {
  void props.viewportWidth
  void props.viewportHeight
  void props.viewBoxBounds
  void props.mapFontFamily
  props.clusterPolygons.forEach((cluster) => {
    if (cluster.sectors.length === 1) {
      const sectorId = cluster.sectors[0]?.id || ''
      void props.sectorLabelWeight(sectorId)
      void props.sectorLabelFill(sectorId)
      return
    }
    cluster.sectors.forEach((sector) => {
      void props.sectorLabelWeight(sector.id)
      void props.sectorLabelFill(sector.id)
    })
  })
  queueDraw()
})

onMounted(() => {
  queueDraw()
})

onBeforeUnmount(() => {
  if (redrawFrame !== null) cancelAnimationFrame(redrawFrame)
})
</script>

<template>
  <canvas ref="canvasRef" class="sector-label-canvas" aria-hidden="true" />
</template>

<style scoped>
.sector-label-canvas {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}
</style>
