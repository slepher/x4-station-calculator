<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  rowKey: string
  edges: [string, string][]
}>()

interface RoutedEdge {
  id: string
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const svgRef = ref<SVGSVGElement | null>(null)
const lines = ref<RoutedEdge[]>([])
const canvasWidth = ref(0)
const canvasHeight = ref(0)

const STRAIGHT_THRESHOLD = 4

function tagId(nodeId: string): string {
  return `research-node:${props.rowKey}:${nodeId}`
}

function recalculate() {
  const svg = svgRef.value
  if (!svg) return

  const container = svg.parentElement
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  if (containerRect.width === 0 || containerRect.height === 0) {
    scheduleRecalculate()
    return
  }

  canvasWidth.value = Math.ceil(Math.max(container.scrollWidth, containerRect.width))
  canvasHeight.value = Math.ceil(Math.max(container.scrollHeight, containerRect.height))

  const nextLines: RoutedEdge[] = []
  for (const [sourceId, targetId] of props.edges) {
    const sourceEl = container.querySelector(`[data-tag-id="${tagId(sourceId)}"]`)
    const targetEl = container.querySelector(`[data-tag-id="${tagId(targetId)}"]`)
    if (!sourceEl || !targetEl) continue

    const sourceRect = sourceEl.getBoundingClientRect()
    const targetRect = targetEl.getBoundingClientRect()
    if (sourceRect.width === 0 || targetRect.width === 0) continue

    const x1 = sourceRect.right - containerRect.left
    const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top
    const x2 = targetRect.left - containerRect.left
    const y2 = targetRect.top + targetRect.height / 2 - containerRect.top
    const midX = Math.round((x1 + x2) / 2)
    const d = Math.abs(y1 - y2) < STRAIGHT_THRESHOLD
      ? `M ${x1},${y1} L ${x2},${y2}`
      : `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`

    nextLines.push({
      id: `${sourceId}:${targetId}`,
      d,
      x1, y1, x2, y2,
    })
  }

  lines.value = nextLines
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let pendingRaf = 0
let retryCount = 0
const MAX_RETRIES = 5

function scheduleRecalculate() {
  cancelAnimationFrame(pendingRaf)
  pendingRaf = requestAnimationFrame(() => {
    recalculate()
    if (retryCount < MAX_RETRIES) {
      retryCount += 1
      pendingRaf = requestAnimationFrame(recalculate)
    }
  })
}

onMounted(async () => {
  const container = svgRef.value?.parentElement
  if (!container) return

  resizeObserver = new ResizeObserver(scheduleRecalculate)
  resizeObserver.observe(container)

  mutationObserver = new MutationObserver(scheduleRecalculate)
  mutationObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-tag-id', 'class', 'style'],
  })

  retryCount = 0
  await nextTick()
  scheduleRecalculate()
})

onUnmounted(() => {
  cancelAnimationFrame(pendingRaf)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})

watch(() => props.edges, () => {
  retryCount = 0
  nextTick(scheduleRecalculate)
}, { deep: true })
</script>

<template>
  <svg
    ref="svgRef"
    class="research-edge-layer"
    :width="canvasWidth"
    :height="canvasHeight"
    :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
    aria-hidden="true"
  >
    <path
      v-for="line in lines"
      :key="line.id"
      class="research-edge-line"
      :d="line.d"
    />
    <circle
      v-for="dot in lines.flatMap(l => [
        { key: l.id + ':s', cx: l.x1, cy: l.y1 },
        { key: l.id + ':e', cx: l.x2, cy: l.y2 }
      ])"
      :key="dot.key"
      class="research-edge-dot"
      :cx="dot.cx"
      :cy="dot.cy"
      r="3"
    />
  </svg>
</template>

<style scoped>
.research-edge-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

.research-edge-line {
  fill: none;
  stroke: rgba(235, 246, 255, 0.92);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 2px rgba(220, 242, 255, 0.85));
}

.research-edge-dot {
  fill: rgba(235, 246, 255, 0.95);
  filter: drop-shadow(0 0 3px rgba(220, 242, 255, 0.9));
}
</style>
